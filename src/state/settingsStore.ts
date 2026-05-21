/**
 * Device-level settings — API base URL, printer host/port, real-printer
 * toggle. Persisted via AsyncStorage so on-site overrides survive cold
 * starts. Defaults come from `expo-constants` extras (see `app.config.ts`),
 * which means the first launch on each device picks up the right values
 * for its build channel.
 *
 * Synchronous reads (`useSettingsStore.getState().apiBaseUrl`) are safe
 * after the first launch; cold-start callers (`api/client.ts`,
 * `print/index.ts`) fall back to the Constants defaults until the
 * persist middleware finishes rehydrating.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PrinterTransport = 'tcp' | 'usb';

interface ConstantsExtras {
  apiBaseUrl?: string;
  printerHost?: string;
  printerPort?: number;
  useRealPrinter?: boolean;
  printerTransport?: PrinterTransport;
  variant?: 'development' | 'preview' | 'production';
}

function readExtras(): ConstantsExtras {
  const extra =
    (Constants.expoConfig?.extra as ConstantsExtras | undefined) ??
    (Constants.manifest2?.extra?.expoClient?.extra as ConstantsExtras | undefined);
  return extra ?? {};
}

const EXTRAS = readExtras();

const DEFAULTS = {
  apiBaseUrl: EXTRAS.apiBaseUrl ?? 'http://10.0.2.2:8000',
  printerHost: EXTRAS.printerHost ?? '192.168.1.50',
  printerPort: EXTRAS.printerPort ?? 9100,
  useRealPrinter: EXTRAS.useRealPrinter ?? false,
  printerTransport: EXTRAS.printerTransport ?? 'usb',
  /**
   * Android USB deviceId for the currently-selected printer. Null when no
   * device has been picked yet — the print path falls back to TCP or mock
   * in that case (see src/print/index.ts).
   */
  printerUsbDeviceId: null as number | null,
  /** Friendly label for the selected USB device (for the Settings screen). */
  printerUsbDeviceLabel: '' as string,
} as const;

export interface SettingsState {
  apiBaseUrl: string;
  printerHost: string;
  printerPort: number;
  useRealPrinter: boolean;
  printerTransport: PrinterTransport;
  printerUsbDeviceId: number | null;
  printerUsbDeviceLabel: string;

  setApiBaseUrl: (url: string) => void;
  setPrinterHost: (host: string) => void;
  setPrinterPort: (port: number) => void;
  setUseRealPrinter: (on: boolean) => void;
  setPrinterTransport: (transport: PrinterTransport) => void;
  setPrinterUsbDevice: (deviceId: number | null, label?: string) => void;
  resetToDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setApiBaseUrl: (url) => set({ apiBaseUrl: url.trim().replace(/\/+$/, '') }),
      setPrinterHost: (host) => set({ printerHost: host.trim() }),
      setPrinterPort: (port) => set({ printerPort: Number.isFinite(port) ? port : DEFAULTS.printerPort }),
      setUseRealPrinter: (on) => set({ useRealPrinter: on }),
      setPrinterTransport: (transport) => set({ printerTransport: transport }),
      setPrinterUsbDevice: (deviceId, label) =>
        set({ printerUsbDeviceId: deviceId, printerUsbDeviceLabel: label ?? '' }),
      resetToDefaults: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'popcraft.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/** Variant for diagnostic display. Not user-configurable. */
export function getBuildVariant(): 'development' | 'preview' | 'production' {
  return EXTRAS.variant ?? 'development';
}
