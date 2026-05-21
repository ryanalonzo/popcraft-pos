/**
 * USB-OTG adapter for ESC/POS thermal printers.
 *
 * Talks to the local Expo module `popcraft-usb-printer` (Android only),
 * which wraps Android's UsbManager: enumerate attached devices, request
 * user permission, bulk-transfer the receipt bytes.
 *
 * Picks the printer by the user-selected `deviceId` (stored in the
 * settings store). The Settings screen exposes a discovery + permission
 * flow before a print is ever attempted, so by the time we land in
 * `print()`, the device should be plugged in AND granted.
 */

import {
  hasUsbPermission,
  isUsbPrintingAvailable,
  listUsbDevices,
  printUsbBytes,
  requestUsbPermission,
} from 'popcraft-usb-printer';

import type { PrintAdapter, PrintJob, PrintResult } from './types';

export interface UsbPrintAdapterOptions {
  /** The Android USB deviceId returned by `listUsbDevices()`. */
  deviceId: number;
  /** Identifying label kept for diagnostics (e.g. "Generic 58MM Printer"). */
  label?: string;
}

export class UsbPrintAdapter implements PrintAdapter {
  readonly deviceId: number;
  readonly label: string;

  constructor(options: UsbPrintAdapterOptions) {
    this.deviceId = options.deviceId;
    this.label = options.label ?? `usb#${options.deviceId}`;
  }

  async print(job: PrintJob): Promise<PrintResult> {
    const start = performance.now();

    if (!isUsbPrintingAvailable) {
      return {
        success: false,
        error: 'USB printing not available on this platform / build',
        durationMs: performance.now() - start,
      };
    }

    try {
      const granted = await hasUsbPermission(this.deviceId);
      if (!granted) {
        const ok = await requestUsbPermission(this.deviceId);
        if (!ok) {
          return {
            success: false,
            error: `USB permission denied for ${this.label}`,
            durationMs: performance.now() - start,
          };
        }
      }

      await printUsbBytes(this.deviceId, job.bytes);
      return { success: true, durationMs: performance.now() - start };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        durationMs: performance.now() - start,
      };
    }
  }
}

/* Re-export the discovery helpers so the Settings screen can build its picker. */
export {
  hasUsbPermission,
  isUsbPrintingAvailable,
  listUsbDevices,
  requestUsbPermission,
} from 'popcraft-usb-printer';
export type { UsbDeviceInfo } from 'popcraft-usb-printer';
