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

/**
 * Window during which a repeat of the same code is treated as the
 * scanner firing twice on one trigger press (a common default on cheap
 * USB scanners) rather than a deliberate second scan. 1 s sits well
 * below human "scan, glance, scan the same item again" pace (typically
 * 2–3 s) but wide enough to absorb scanners whose internal repeat
 * timing varies with battery / signal / JS-thread lag.
 *
 * If a real "rescan same item fast" workflow ever needs <1 s repeats,
 * either lower this OR have the cashier tap the "+" on the cart line.
 */
const SCAN_DEDUPE_WINDOW_MS = 1000;

let lastEmittedCode: string | null = null;
let lastEmittedAt = 0;

/** Called by `<ScannerInput />` when a scan is recognised. */
export function emitScan(code: string): void {
  const trimmed = code.trim();
  if (trimmed.length === 0) return;

  const now = Date.now();
  const gap = now - lastEmittedAt;
  if (trimmed === lastEmittedCode && gap < SCAN_DEDUPE_WINDOW_MS) {
    // Same code within the dedupe window — almost certainly the
    // scanner double-firing on a single trigger press. Suppress.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[scan] deduped repeat of "${trimmed}" (${gap}ms gap)`);
    }
    return;
  }
  lastEmittedCode = trimmed;
  lastEmittedAt = now;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[scan] → "${trimmed}"`);
  }

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

let scannerRefocus: (() => void) | null = null;

/**
 * Registered by `<ScannerInput />` so other code can hand the keyboard
 * back to the hidden scanner input. No-op until a ScannerInput mounts.
 */
export function registerScannerRefocus(fn: (() => void) | null): void {
  scannerRefocus = fn;
}

/**
 * Return focus to the hidden scanner input. Call this after another field
 * is done owning the keyboard (e.g. submitting a manual code) so the next
 * scan lands on the scanner instead of the field the cashier just used.
 * Respects the pause refcount, so it won't steal focus from another input
 * that is still actively paused.
 */
export function focusScanner(): void {
  scannerRefocus?.();
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
