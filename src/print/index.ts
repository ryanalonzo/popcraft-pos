/**
 * Print-adapter factory.
 *
 * Adapter selection is driven by the settings store:
 *
 *   useRealPrinter = false  → MockPrintAdapter (dev / no hardware yet)
 *   useRealPrinter = true
 *     · printerTransport = 'usb' → UsbPrintAdapter pointed at the
 *       saved deviceId. If no USB device is selected, falls back to
 *       mock so the cashier flow doesn't hard-fail.
 *     · printerTransport = 'tcp' → TcpPrintAdapter pointed at the
 *       saved host/port.
 *
 * A debug override still lets the printer screen point the live app at
 * an ad-hoc adapter without flipping the toggles:
 *
 *   setPrintAdapterOverride(new TcpPrintAdapter({ host, port }));
 *   setPrintAdapterOverride(null); // revert to settings-driven default
 */

import { useSettingsStore } from '@/state/settingsStore';

import { mockPrintAdapter } from './MockPrintAdapter';
import { TcpPrintAdapter } from './TcpPrintAdapter';
import { UsbPrintAdapter } from './UsbPrintAdapter';
import type { PrintAdapter } from './types';

export type AdapterKind = 'mock' | 'tcp' | 'usb';

let override: PrintAdapter | null = null;

export function setPrintAdapterOverride(adapter: PrintAdapter | null): void {
  override = adapter;
}

export function getPrintAdapter(): PrintAdapter {
  if (override) return override;
  const s = useSettingsStore.getState();
  if (!s.useRealPrinter) return mockPrintAdapter;

  if (s.printerTransport === 'usb') {
    if (s.printerUsbDeviceId == null) return mockPrintAdapter;
    return new UsbPrintAdapter({
      deviceId: s.printerUsbDeviceId,
      label: s.printerUsbDeviceLabel,
    });
  }

  return new TcpPrintAdapter({ host: s.printerHost, port: s.printerPort });
}

/** Best-effort label for the currently active adapter. */
export function getActiveAdapterKind(): AdapterKind {
  if (override instanceof TcpPrintAdapter) return 'tcp';
  if (override instanceof UsbPrintAdapter) return 'usb';
  if (override) return 'mock';
  const s = useSettingsStore.getState();
  if (!s.useRealPrinter) return 'mock';
  if (s.printerTransport === 'usb') {
    return s.printerUsbDeviceId == null ? 'mock' : 'usb';
  }
  return 'tcp';
}

export { mockPrintAdapter, MockPrintAdapter } from './MockPrintAdapter';
export { TcpPrintAdapter } from './TcpPrintAdapter';
export { UsbPrintAdapter } from './UsbPrintAdapter';
export type { UsbDeviceInfo } from './UsbPrintAdapter';
export {
  isUsbPrintingAvailable,
  listUsbDevices,
  requestUsbPermission,
} from './UsbPrintAdapter';
export type { PrinterConfig } from './config';
export type { PrintAdapter, PrintJob, PrintResult } from './types';
export { buildReceiptBytes, buildTestSlipBytes, decodeReceipt } from './escpos';
