/**
 * Scanner bus + hook.
 *
 * A USB/Bluetooth barcode scanner behaves like a HID keyboard: it types
 * the code into the focused input and presses Enter. `<ScannerInput />`
 * is the always-focused TextInput that catches that keystroke. Whenever
 * it fires, `emitScan()` is called and every subscriber gets the code.
 *
 * Screens consume the stream through `useScannerInput()`. Multiple
 * subscribers per screen is fine — each receives every scan.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type ScanHandler = (code: string) => void;

const handlers = new Set<ScanHandler>();
let lastScannedCode: string | null = null;
let pauseRefcount = 0;

/** Called by `<ScannerInput />` when a scan is recognised. */
export function emitScan(code: string): void {
  const trimmed = code.trim();
  if (trimmed.length === 0) return;
  lastScannedCode = trimmed;
  // Snapshot to avoid mutation during iteration.
  for (const h of Array.from(handlers)) h(trimmed);
}

/**
 * Increment the pause refcount — `<ScannerInput />` reads it to decide
 * whether to keep stealing focus. Returns a function that decrements.
 *
 * Use this when another input (search, numpad) needs to own the keyboard.
 */
export function pauseScanner(): () => void {
  pauseRefcount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pauseRefcount = Math.max(0, pauseRefcount - 1);
  };
}

export function isScannerPaused(): boolean {
  return pauseRefcount > 0;
}

export function getLastScannedCode(): string | null {
  return lastScannedCode;
}

export interface UseScannerInput {
  lastScannedCode: string | null;
  setOnScan: (handler: ScanHandler | null) => void;
}

/**
 * Subscribe to scans from any screen.
 *
 *   const { lastScannedCode, setOnScan } = useScannerInput();
 *   useEffect(() => {
 *     setOnScan((code) => { ...handle code... });
 *   }, [setOnScan]);
 */
export function useScannerInput(): UseScannerInput {
  const [last, setLast] = useState<string | null>(lastScannedCode);
  const handlerRef = useRef<ScanHandler | null>(null);

  useEffect(() => {
    const fn: ScanHandler = (code) => {
      setLast(code);
      handlerRef.current?.(code);
    };
    handlers.add(fn);
    return () => {
      handlers.delete(fn);
    };
  }, []);

  const setOnScan = useCallback((handler: ScanHandler | null) => {
    handlerRef.current = handler;
  }, []);

  return { lastScannedCode: last, setOnScan };
}
