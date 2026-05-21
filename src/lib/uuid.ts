/**
 * UUID v4 helper.
 *
 * Hermes (RN 0.81) ships `crypto.randomUUID`; we prefer that when
 * available and fall back to a Math.random-based generator. The fallback
 * is fine for sale-IDs — they're idempotency keys, not security tokens.
 */

declare const globalThis: { crypto?: { randomUUID?: () => string } };

export function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return fallbackUuid();
}

function fallbackUuid(): string {
  // Pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where y is 8, 9, a, or b (variant bits).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
