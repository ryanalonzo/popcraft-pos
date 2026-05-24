/**
 * Pure ESC/POS byte builders. No I/O — every function returns a
 * `Uint8Array` fragment. Compose with `concat` and hand the result to a
 * `PrintAdapter`.
 *
 * Targets the Xprinter XP-Q80I (80mm thermal) with a Poseidon CD4141 cash
 * drawer wired via RJ11. The drawer fires when the byte stream contains
 * the ESC p kick sequence emitted by `kickDrawer`.
 *
 * NOTE: Non-ASCII characters (including ₱) are encoded as UTF-8. Real
 * thermal printers usually want a single-byte code page — the eventual
 * fix is to switch the printer to a code page that has ₱ and transcode
 * here. For mock printing and human-readable logs the UTF-8 path is fine.
 */

import type { Sale } from '@/types';
import { formatPesoNoSymbol } from '@/lib/money';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const textEncoder = new TextEncoder();

/** Concatenate ESC/POS fragments into a single byte stream. */
export function concat(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** ESC @ — reset printer to power-on defaults. */
export function init(): Uint8Array {
  return new Uint8Array([ESC, 0x40]);
}

/** UTF-8 encode a string to bytes. */
export function text(str: string): Uint8Array {
  return textEncoder.encode(str);
}

/** ESC E n — bold on/off. */
export function bold(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 0x01 : 0x00]);
}

/** GS ! n — double width + height when on, normal when off. */
export function doubleSize(on: boolean): Uint8Array {
  return new Uint8Array([GS, 0x21, on ? 0x11 : 0x00]);
}

/** ESC a 1 — center justify. */
export function alignCenter(): Uint8Array {
  return new Uint8Array([ESC, 0x61, 0x01]);
}

/** ESC a 0 — left justify. */
export function alignLeft(): Uint8Array {
  return new Uint8Array([ESC, 0x61, 0x00]);
}

/** ESC a 2 — right justify. */
export function alignRight(): Uint8Array {
  return new Uint8Array([ESC, 0x61, 0x02]);
}

/** Emit `n` line feeds (n = 1 by default). */
export function lineFeed(n: number = 1): Uint8Array {
  const out = new Uint8Array(n);
  out.fill(LF);
  return out;
}

/** GS V 1 — partial cut. */
export function cut(): Uint8Array {
  return new Uint8Array([GS, 0x56, 0x01]);
}

/** ESC p 0 25 250 — fire the cash drawer kick on pin 2. */
export function kickDrawer(): Uint8Array {
  return new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xfa]);
}

/** Width of the printable area in monospace columns (58mm @ font A = 32). */
export const RECEIPT_WIDTH = 32;

/** A line of em-dashes followed by LF. */
export function divider(width: number = RECEIPT_WIDTH): Uint8Array {
  return text('-'.repeat(width) + '\n');
}

/**
 * Left-right justify two strings to fit `width` columns. Truncates the
 * left side if needed so the right side is never lost.
 */
function lr(left: string, right: string, width: number = RECEIPT_WIDTH): string {
  const space = Math.max(1, width - right.length);
  const l = left.length > space - 1 ? left.slice(0, space - 1) : left;
  return l.padEnd(space) + right;
}

/** Format an ISO timestamp as "YYYY-MM-DD HH:mm". */
function formatTimestamp(iso: string): string {
  // "2026-05-19T14:32:00.000Z" -> "2026-05-19 14:32"
  return iso.slice(0, 16).replace('T', ' ');
}

export interface BuildReceiptOptions {
  includeDrawerKick: boolean;
  /** Optional human-readable cashier name; falls back to `sale.cashier_id`. */
  cashierName?: string;
}

/**
 * Compose the full byte stream for a sale receipt.
 *
 * @param sale       - the sale to print
 * @param storeName  - business name shown at the top (e.g. "POPCRAFT ARTS")
 * @param options    - whether to kick the drawer, optional cashier name
 * @returns the complete ESC/POS byte stream, cut included
 */
export function buildReceiptBytes(
  sale: Sale,
  storeName: string,
  options: BuildReceiptOptions,
): Uint8Array {
  const parts: Uint8Array[] = [];

  parts.push(init());

  // Header
  parts.push(alignCenter());
  parts.push(bold(true));
  parts.push(doubleSize(true));
  parts.push(text(storeName + '\n'));
  parts.push(doubleSize(false));
  parts.push(bold(false));
  parts.push(text(formatTimestamp(sale.created_at) + '\n'));
  parts.push(text(`Cashier: ${options.cashierName ?? sale.cashier_id}\n`));

  // Body
  parts.push(alignLeft());
  parts.push(divider());

  // Line items: plain decimals, no peso sign. Saves columns on the
  // narrow 58mm roll and keeps the eye on the figure. The currency
  // appears once at the TOTAL row, which is what we care about.
  for (const line of sale.lines) {
    const priceStr = formatPesoNoSymbol(line.line_total_centavos);
    // Need at least one space between name and price.
    const maxNameWidth = RECEIPT_WIDTH - priceStr.length - 1;
    if (line.item_name.length <= maxNameWidth) {
      parts.push(text(lr(line.item_name, priceStr) + '\n'));
    } else {
      // Long name: render the full name on its own line, then push the
      // price right-aligned on the next line so we never clip.
      parts.push(text(line.item_name + '\n'));
      parts.push(text(priceStr.padStart(RECEIPT_WIDTH) + '\n'));
    }
    if (line.quantity > 1) {
      const detail = `  x${line.quantity} @ ${formatPesoNoSymbol(line.unit_price_centavos)}`;
      parts.push(text(detail + '\n'));
    }
  }

  parts.push(divider());

  parts.push(text(lr('Subtotal', formatPesoNoSymbol(sale.subtotal_centavos)) + '\n'));
  if (sale.subtotal_centavos !== sale.total_centavos) {
    const discount = sale.subtotal_centavos - sale.total_centavos;
    parts.push(text(lr('Discount', '- ' + formatPesoNoSymbol(discount)) + '\n'));
  }
  // TOTAL is the only row that carries the currency prefix — anchors
  // the amount the cashier and customer are most concerned with. We
  // use the ISO code "PHP" rather than the ₱ glyph because most cheap
  // ESC/POS printers don't have a code page containing U+20B1 and end
  // up printing garbage in its place.
  parts.push(bold(true));
  parts.push(
    text(lr('TOTAL', 'PHP ' + formatPesoNoSymbol(sale.total_centavos)) + '\n'),
  );
  parts.push(bold(false));

  parts.push(lineFeed(1));
  parts.push(text(lr('Payment', sale.payment_method.toUpperCase()) + '\n'));
  if (sale.amount_tendered_centavos !== null) {
    parts.push(text(lr('Tendered', formatPesoNoSymbol(sale.amount_tendered_centavos)) + '\n'));
  }
  if (sale.change_centavos !== null) {
    parts.push(text(lr('Change', formatPesoNoSymbol(sale.change_centavos)) + '\n'));
  }

  // Footer
  parts.push(lineFeed(1));
  parts.push(alignCenter());
  parts.push(text('Thank you!\n'));
  parts.push(lineFeed(4));

  if (options.includeDrawerKick) {
    parts.push(kickDrawer());
  }
  parts.push(cut());

  return concat(...parts);
}

/**
 * Tiny ESC/POS slip used by the Settings → Test Print button.
 *
 * Previous version sent only ESC @ (init), which is invisible —
 * the bytes went through fine but nothing came out of the printer,
 * leading to "test says OK but no paper" confusion. This builds a
 * short, visibly printed slip with the timestamp + a footer feed +
 * cut, so a successful probe produces obvious evidence.
 */
export function buildTestSlipBytes(label: string = 'POS'): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(init());
  parts.push(alignCenter());
  parts.push(bold(true));
  parts.push(text('POPCRAFT POS\n'));
  parts.push(bold(false));
  parts.push(text('TEST PRINT\n'));
  parts.push(divider());
  parts.push(text(formatTimestamp(new Date().toISOString()) + '\n'));
  parts.push(text(label + '\n'));
  parts.push(lineFeed(4));
  parts.push(cut());
  return concat(...parts);
}

/* ------------------------------------------------------------------ */
/* Decoder for human-readable previews (used by the Mock adapter)     */
/* ------------------------------------------------------------------ */

const textDecoder = new TextDecoder('utf-8');

export interface DecodedReceipt {
  /** Reconstructed printable text with LFs as `\n`. */
  text: string;
  /** True if a drawer-kick sequence was found in the stream. */
  drawerKicked: boolean;
}

/**
 * Strip ESC/POS control sequences from a byte stream and return the
 * printable text. Only the subset of commands used by `buildReceiptBytes`
 * is recognised — unknown commands are skipped as two bytes which is
 * usually fine for preview purposes.
 */
export function decodeReceipt(bytes: Uint8Array): DecodedReceipt {
  const chunks: Uint8Array[] = [];
  let buffer: number[] = [];
  let drawerKicked = false;

  const flush = () => {
    if (buffer.length > 0) {
      chunks.push(new Uint8Array(buffer));
      buffer = [];
    }
  };

  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    if (b === ESC) {
      flush();
      const cmd = bytes[i + 1];
      if (cmd === 0x40) {
        i += 2; // ESC @
      } else if (cmd === 0x45 || cmd === 0x61 || cmd === 0x64) {
        i += 3; // ESC E/a/d n
      } else if (cmd === 0x70) {
        drawerKicked = true;
        i += 5; // ESC p m t1 t2
      } else {
        i += 2;
      }
    } else if (b === GS) {
      flush();
      const cmd = bytes[i + 1];
      if (cmd === 0x21 || cmd === 0x56) {
        i += 3; // GS ! / V n
      } else {
        i += 2;
      }
    } else {
      buffer.push(b);
      i++;
    }
  }
  flush();

  const decoded = chunks.map((c) => textDecoder.decode(c)).join('');
  return { text: decoded, drawerKicked };
}
