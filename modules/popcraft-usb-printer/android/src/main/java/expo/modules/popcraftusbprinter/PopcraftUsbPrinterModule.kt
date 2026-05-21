package expo.modules.popcraftusbprinter

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val ACTION_USB_PERMISSION = "ph.revlv.popcraftpos.USB_PERMISSION"
private const val CHUNK_SIZE = 4096
private const val WRITE_TIMEOUT_MS = 5000

/**
 * Minimal USB-OTG bridge for ESC/POS thermal printers.
 *
 * Exposes three calls to JS:
 *   listDevices()                          → enumerate attached USB devices
 *   requestPermission(deviceId)            → user grant for a single device
 *   print(deviceId, base64Bytes)           → bulk-write ESC/POS payload
 *
 * Intentionally tiny — no auto-detect of "printer" class, no chunking
 * smarter than 4 KB writes. Generic Chinese 58/80 mm thermal printers
 * generally enumerate as USB class 0 with a single bulk-OUT endpoint;
 * we walk the interfaces looking for that endpoint and send.
 */
class PopcraftUsbPrinterModule : Module() {

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val usbManager: UsbManager
    get() = context.getSystemService(Context.USB_SERVICE) as UsbManager

  override fun definition() = ModuleDefinition {
    Name("PopcraftUsbPrinter")

    AsyncFunction("listDevices") {
      usbManager.deviceList.values.map { device ->
        mapOf(
          "deviceId" to device.deviceId,
          "deviceName" to device.deviceName,
          "vendorId" to device.vendorId,
          "productId" to device.productId,
          "manufacturerName" to (device.manufacturerName ?: ""),
          "productName" to (device.productName ?: ""),
          "hasPermission" to usbManager.hasPermission(device)
        )
      }
    }

    AsyncFunction("hasPermission") { deviceId: Int ->
      val device = findDevice(deviceId) ?: return@AsyncFunction false
      usbManager.hasPermission(device)
    }

    AsyncFunction("requestPermission") { deviceId: Int, promise: Promise ->
      val device = findDevice(deviceId)
      if (device == null) {
        promise.reject("E_NO_DEVICE", "Device $deviceId not found", null)
        return@AsyncFunction
      }
      if (usbManager.hasPermission(device)) {
        promise.resolve(true)
        return@AsyncFunction
      }

      val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, intent: Intent) {
          if (intent.action != ACTION_USB_PERMISSION) return
          try { c.unregisterReceiver(this) } catch (_: Throwable) {}
          val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
          promise.resolve(granted)
        }
      }

      val pendingFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_IMMUTABLE
      } else {
        0
      }
      val pendingIntent = PendingIntent.getBroadcast(
        context,
        0,
        Intent(ACTION_USB_PERMISSION).setPackage(context.packageName),
        pendingFlag
      )
      val filter = IntentFilter(ACTION_USB_PERMISSION)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        @Suppress("UnspecifiedRegisterReceiverFlag")
        context.registerReceiver(receiver, filter)
      }
      usbManager.requestPermission(device, pendingIntent)
    }

    AsyncFunction("print") { deviceId: Int, base64Bytes: String, promise: Promise ->
      val device = findDevice(deviceId)
      if (device == null) {
        promise.reject("E_NO_DEVICE", "Device $deviceId not found", null)
        return@AsyncFunction
      }
      if (!usbManager.hasPermission(device)) {
        promise.reject(
          "E_NO_PERMISSION",
          "USB permission not granted for device ${device.deviceName}",
          null
        )
        return@AsyncFunction
      }

      val endpoint = findBulkOutEndpoint(device)
      if (endpoint == null) {
        promise.reject(
          "E_NO_ENDPOINT",
          "Device ${device.deviceName} has no bulk-OUT endpoint",
          null
        )
        return@AsyncFunction
      }

      val bytes = try {
        Base64.decode(base64Bytes, Base64.NO_WRAP)
      } catch (e: IllegalArgumentException) {
        promise.reject("E_BAD_PAYLOAD", "base64 decode failed: ${e.message}", e)
        return@AsyncFunction
      }

      val connection = usbManager.openDevice(device)
      if (connection == null) {
        promise.reject("E_OPEN_FAILED", "Could not open ${device.deviceName}", null)
        return@AsyncFunction
      }

      val iface = endpoint.first
      val ep = endpoint.second
      try {
        if (!connection.claimInterface(iface, true)) {
          promise.reject("E_CLAIM_FAILED", "Could not claim interface 0", null)
          return@AsyncFunction
        }

        var offset = 0
        while (offset < bytes.size) {
          val remaining = bytes.size - offset
          val len = if (remaining > CHUNK_SIZE) CHUNK_SIZE else remaining
          val written = connection.bulkTransfer(ep, bytes, offset, len, WRITE_TIMEOUT_MS)
          if (written < 0) {
            promise.reject(
              "E_WRITE_FAILED",
              "bulkTransfer returned $written at offset $offset (wrote ${offset} of ${bytes.size})",
              null
            )
            return@AsyncFunction
          }
          offset += written
        }
        promise.resolve(mapOf("ok" to true, "bytesWritten" to offset))
      } finally {
        try { connection.releaseInterface(iface) } catch (_: Throwable) {}
        try { connection.close() } catch (_: Throwable) {}
      }
    }
  }

  private fun findDevice(deviceId: Int): UsbDevice? {
    return usbManager.deviceList.values.firstOrNull { it.deviceId == deviceId }
  }

  /**
   * Walk the device's interfaces and return the first bulk-OUT endpoint.
   * Most ESC/POS thermal printers have exactly one interface with one
   * bulk-OUT endpoint, so the first match is the right one.
   */
  private fun findBulkOutEndpoint(device: UsbDevice): Pair<UsbInterface, UsbEndpoint>? {
    for (i in 0 until device.interfaceCount) {
      val iface = device.getInterface(i)
      for (e in 0 until iface.endpointCount) {
        val ep = iface.getEndpoint(e)
        if (ep.direction == UsbConstants.USB_DIR_OUT &&
          ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK
        ) {
          return Pair(iface, ep)
        }
      }
    }
    return null
  }
}
