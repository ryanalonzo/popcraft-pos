/**
 * Printer configuration. Held in a plain module so it can be mutated by
 * the debug screen without dragging in Zustand for a two-field object.
 * A future settings UI will persist this through AsyncStorage.
 */

export interface PrinterConfig {
  host: string;
  port: number;
}

export const printerConfig: PrinterConfig = {
  host: '192.168.1.50',
  port: 9100,
};

export function setPrinterConfig(next: Partial<PrinterConfig>): void {
  if (next.host !== undefined) printerConfig.host = next.host;
  if (next.port !== undefined) printerConfig.port = next.port;
}
