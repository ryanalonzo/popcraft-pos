/**
 * In-memory printer used for development and demos. Simulates a
 * 200–400 ms print, logs a box-art preview of the receipt to the console,
 * and keeps the last 10 jobs so a debug screen can render them.
 *
 * Set `MockPrintAdapter.failNext = true` to simulate a single failure —
 * useful for exercising error paths in the cashier flow.
 */

import { decodeReceipt } from './escpos';
import type { PrintAdapter, PrintJob, PrintResult } from './types';

const MIN_DELAY_MS = 200;
const MAX_DELAY_MS = 400;
const HISTORY_LIMIT = 10;

export interface MockPrintEntry {
  jobId: string;
  bytes: Uint8Array;
  preview: string;
  result: PrintResult;
  printedAt: string;
}

export class MockPrintAdapter implements PrintAdapter {
  /** Toggle to make the next call fail; resets after firing. */
  public failNext = false;

  private history: MockPrintEntry[] = [];

  async print(job: PrintJob): Promise<PrintResult> {
    const start = Date.now();
    const delay =
      MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
    await sleep(delay);

    const preview = renderPreview(job);
    // eslint-disable-next-line no-console
    console.log(`\n[MockPrintAdapter] job ${job.jobId}\n${preview}\n`);

    let result: PrintResult;
    if (this.failNext) {
      this.failNext = false;
      result = {
        success: false,
        error: 'Simulated printer failure (debug)',
        durationMs: Date.now() - start,
      };
    } else {
      result = { success: true, durationMs: Date.now() - start };
    }

    this.history.unshift({
      jobId: job.jobId,
      bytes: job.bytes,
      preview,
      result,
      printedAt: new Date().toISOString(),
    });
    if (this.history.length > HISTORY_LIMIT) {
      this.history.length = HISTORY_LIMIT;
    }

    return result;
  }

  /** Most recent jobs first. Returns a copy. */
  getHistory(): MockPrintEntry[] {
    return this.history.slice();
  }

  /**
   * Find the most-recent print of the given job ID. Used by the receipt
   * preview screen to reconstruct bytes for sales already off the cart.
   */
  getEntryByJobId(jobId: string): MockPrintEntry | undefined {
    return this.history.find((entry) => entry.jobId === jobId);
  }

  clearHistory(): void {
    this.history = [];
  }
}

/** Singleton so all callers share the same in-memory history. */
export const mockPrintAdapter = new MockPrintAdapter();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reconstruct a readable receipt from the raw bytes and wrap it in a box.
 * Visual only — the box art has no semantic meaning, it just makes
 * console output easier to scan during development.
 */
function renderPreview(job: PrintJob): string {
  const decoded = decodeReceipt(job.bytes);
  const lines = decoded.text.split('\n');
  // Drop the trailing empty line from the closing newline, if any.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (decoded.drawerKicked) lines.push('[DRAWER KICK FIRED]');

  const inner = Math.max(28, ...lines.map((l) => l.length));
  const top = '╔' + '═'.repeat(inner + 4) + '╗';
  const bot = '╚' + '═'.repeat(inner + 4) + '╝';
  const body = lines.map((l) => '║  ' + l.padEnd(inner) + '  ║');
  return [top, ...body, bot].join('\n');
}
