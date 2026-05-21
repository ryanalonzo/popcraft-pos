/**
 * Printer adapter contract.
 *
 * The cashier flow never imports a concrete adapter — it depends on this
 * interface and resolves the implementation through `getPrintAdapter`.
 * That keeps the mock and the real TCP adapter swappable without touching
 * any business logic.
 */

export interface PrintJob {
  /** Raw bytes to send to the printer (already-built ESC/POS stream). */
  bytes: Uint8Array;
  /** Whether the byte stream includes a cash-drawer kick sequence. */
  openDrawer: boolean;
  /** Stable ID for tracing / retries (typically the Sale.id). */
  jobId: string;
}

export interface PrintResult {
  success: boolean;
  /** Populated on failure. Always include something operator-readable. */
  error?: string;
  /** Wall-clock duration of the print attempt, in milliseconds. */
  durationMs: number;
}

export interface PrintAdapter {
  print(job: PrintJob): Promise<PrintResult>;
}
