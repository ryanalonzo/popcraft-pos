/**
 * Print-adapter factory.
 *
 * Adapter selection is driven by the settings store:
 *   - `useRealPrinter === true`  → TcpPrintAdapter pointed at the host/port from settings
 *   - `useRealPrinter === false` → MockPrintAdapter
 *
 * A debug override still lets the printer screen point the live app at
 * an ad-hoc adapter without flipping the toggle:
 *
 *   setPrintAdapterOverride(new TcpPrintAdapter({ host, port }));
 *   setPrintAdapterOverride(null); // revert to settings-driven default
 */

import { useSettingsStore } from '@/state/settingsStore';

import { mockPrintAdapter } from './MockPrintAdapter';
import { TcpPrintAdapter } from './TcpPrintAdapter';
import type { PrintAdapter } from './types';

export type AdapterKind = 'mock' | 'tcp';

let override: PrintAdapter | null = null;

export function setPrintAdapterOverride(adapter: PrintAdapter | null): void {
  override = adapter;
}

export function getPrintAdapter(): PrintAdapter {
  if (override) return override;
  const { useRealPrinter, printerHost, printerPort } = useSettingsStore.getState();
  if (useRealPrinter) {
    return new TcpPrintAdapter({ host: printerHost, port: printerPort });
  }
  return mockPrintAdapter;
}

/** Best-effort label for the currently active adapter. */
export function getActiveAdapterKind(): AdapterKind {
  if (override instanceof TcpPrintAdapter) return 'tcp';
  if (override) return 'mock';
  return useSettingsStore.getState().useRealPrinter ? 'tcp' : 'mock';
}

export { mockPrintAdapter, MockPrintAdapter } from './MockPrintAdapter';
export { TcpPrintAdapter } from './TcpPrintAdapter';
export type { PrinterConfig } from './config';
export type { PrintAdapter, PrintJob, PrintResult } from './types';
export { buildReceiptBytes, decodeReceipt } from './escpos';
