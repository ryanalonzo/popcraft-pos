/**
 * JS bridge for the local Expo USB printer module.
 *
 * The Android side lives at modules/popcraft-usb-printer/android/.
 * iOS is not implemented (iOS doesn't expose USB host APIs to apps);
 * every call here throws on iOS.
 */

import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export interface UsbDeviceInfo {
  deviceId: number;
  deviceName: string;
  vendorId: number;
  productId: number;
  manufacturerName: string;
  productName: string;
  hasPermission: boolean;
}

export interface UsbPrintResult {
  ok: true;
  bytesWritten: number;
}

interface NativeModule {
  listDevices(): Promise<UsbDeviceInfo[]>;
  hasPermission(deviceId: number): Promise<boolean>;
  requestPermission(deviceId: number): Promise<boolean>;
  print(deviceId: number, base64Bytes: string): Promise<UsbPrintResult>;
}

let _native: NativeModule | null = null;
function native(): NativeModule {
  if (Platform.OS !== 'android') {
    throw new Error('popcraft-usb-printer is Android-only');
  }
  if (!_native) {
    _native = requireNativeModule<NativeModule>('PopcraftUsbPrinter');
  }
  return _native;
}

/** True only on Android with the native module compiled in. */
export const isUsbPrintingAvailable: boolean = (() => {
  if (Platform.OS !== 'android') return false;
  try {
    requireNativeModule('PopcraftUsbPrinter');
    return true;
  } catch {
    return false;
  }
})();

export async function listUsbDevices(): Promise<UsbDeviceInfo[]> {
  return native().listDevices();
}

export async function hasUsbPermission(deviceId: number): Promise<boolean> {
  return native().hasPermission(deviceId);
}

export async function requestUsbPermission(deviceId: number): Promise<boolean> {
  return native().requestPermission(deviceId);
}

export async function printUsbBytes(
  deviceId: number,
  bytes: Uint8Array,
): Promise<UsbPrintResult> {
  return native().print(deviceId, encodeBase64(bytes));
}

/** Minimal base64 encoder — avoids pulling in a buffer polyfill. */
function encodeBase64(bytes: Uint8Array): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1]!;
    const b2 = bytes[i + 2]!;
    out += alphabet[b0 >> 2];
    out += alphabet[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += alphabet[((b1 & 0x0f) << 2) | (b2 >> 6)];
    out += alphabet[b2 & 0x3f];
  }
  if (i < bytes.length) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    out += alphabet[b0 >> 2];
    out += alphabet[((b0 & 0x03) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) {
      out += alphabet[(b1 & 0x0f) << 2];
      out += '=';
    } else {
      out += '==';
    }
  }
  return out;
}
