import {
  calculateChange,
  calculateLineTotal,
  calculateSubtotal,
  calculateTax,
  calculateTotal,
  effectiveUnitPrice,
  isMarkdownActive,
  priceLine,
} from '@/lib/cart';
import type { CartLine, Item, ItemMarkdown, PriceTier } from '@/types';

function makeItem(
  price_centavos: number,
  price_tiers?: PriceTier[],
  markdown?: ItemMarkdown,
): Item {
  return {
    id: 'itm-' + price_centavos,
    code: 'R042-00000001',
    barcode_value: null,
    name: 'Test item',
    description: '',
    renter_id: 'R042',
    price_centavos,
    price_tiers,
    markdown,
    stock: null,
    is_active: true,
    updated_at: '2026-05-19T00:00:00.000Z',
  };
}

// A fixed local "now" so markdown-window tests don't depend on the wall clock.
const NOW = new Date(2026, 6, 15, 10, 0, 0); // 2026-07-15, local time

function makeLine(price_centavos: number, quantity: number): CartLine {
  return { item: makeItem(price_centavos), quantity };
}

describe('calculateLineTotal', () => {
  it('multiplies price by quantity', () => {
    expect(calculateLineTotal(makeLine(24950, 2))).toBe(49900);
  });

  it('returns 0 for quantity 0', () => {
    expect(calculateLineTotal(makeLine(24950, 0))).toBe(0);
  });

  it('charges every unit at the tier rate once the threshold is met', () => {
    // "₱80 each, ₱75 each at 2+" → qty 2 is 2 × 75 = ₱150.
    const item = makeItem(8000, [{ min_quantity: 2, unit_price_centavos: 7500 }]);
    expect(calculateLineTotal({ item, quantity: 2 })).toBe(15000);
  });

  it('keeps the tier rate above the threshold — no odd unit at base', () => {
    // qty 3 of "2+ at ₱75" (base 80) → 3 × 75 = ₱225, not 150 + 80.
    const item = makeItem(8000, [{ min_quantity: 2, unit_price_centavos: 7500 }]);
    expect(calculateLineTotal({ item, quantity: 3 })).toBe(22500);
  });
});

describe('priceLine', () => {
  it('returns no groups for quantity 0', () => {
    expect(priceLine(makeItem(6500), 0)).toEqual([]);
  });

  it('returns a single base-price group when the item has no tiers', () => {
    expect(priceLine(makeItem(6500), 3)).toEqual([
      { quantity: 3, unit_price_centavos: 6500 },
    ]);
    expect(priceLine(makeItem(6500, []), 3)).toEqual([
      { quantity: 3, unit_price_centavos: 6500 },
    ]);
  });

  it('keeps a sub-threshold quantity at the base price', () => {
    const item = makeItem(8000, [{ min_quantity: 2, unit_price_centavos: 7500 }]);
    expect(priceLine(item, 1)).toEqual([{ quantity: 1, unit_price_centavos: 8000 }]);
  });

  it('prices the whole line at the tier rate above the threshold', () => {
    // "2+ at ₱75" is a threshold, not a pair: qty 3 is 3 × 75, no odd unit.
    const item = makeItem(8000, [{ min_quantity: 2, unit_price_centavos: 7500 }]);
    expect(priceLine(item, 3)).toEqual([{ quantity: 3, unit_price_centavos: 7500 }]);
    expect(priceLine(item, 4)).toEqual([{ quantity: 4, unit_price_centavos: 7500 }]);
  });

  it('takes the highest tier the quantity qualifies for', () => {
    // base 8000; "2+ at ₱75", "5+ at ₱70".
    const tiers: PriceTier[] = [
      { min_quantity: 2, unit_price_centavos: 7500 },
      { min_quantity: 5, unit_price_centavos: 7000 },
    ];
    const item = makeItem(8000, tiers);
    expect(priceLine(item, 4)).toEqual([{ quantity: 4, unit_price_centavos: 7500 }]);
    expect(priceLine(item, 5)).toEqual([{ quantity: 5, unit_price_centavos: 7000 }]);
    expect(priceLine(item, 6)).toEqual([{ quantity: 6, unit_price_centavos: 7000 }]);
  });

  it('is order-independent — unsorted tiers resolve the same', () => {
    const unsorted = makeItem(8000, [
      { min_quantity: 5, unit_price_centavos: 7000 },
      { min_quantity: 2, unit_price_centavos: 7500 },
    ]);
    expect(priceLine(unsorted, 6)).toEqual([{ quantity: 6, unit_price_centavos: 7000 }]);
    expect(priceLine(unsorted, 3)).toEqual([{ quantity: 3, unit_price_centavos: 7500 }]);
  });

  it('takes the cheaper of two tiers sharing a threshold', () => {
    const item = makeItem(8000, [
      { min_quantity: 2, unit_price_centavos: 7500 },
      { min_quantity: 2, unit_price_centavos: 7200 },
    ]);
    expect(priceLine(item, 2)).toEqual([{ quantity: 2, unit_price_centavos: 7200 }]);
  });

  it('bills "2+ at ₱75" as ₱150 for a pair, not ₱75 (regression: undercharge bug)', () => {
    // The exact real-store config from the Hestia charm: base ₱80, "2+ pcs
    // → ₱75.00 each". The web POS charges ₱150; the tablet must agree.
    const item = makeItem(8000, [{ min_quantity: 2, unit_price_centavos: 7500 }]);
    expect(priceLine(item, 2)).toEqual([{ quantity: 2, unit_price_centavos: 7500 }]);
    expect(calculateLineTotal({ item, quantity: 2 })).toBe(15000); // ₱150, not ₱75
  });
});

describe('isMarkdownActive', () => {
  it('is false with no markdown or a zero percentage', () => {
    expect(isMarkdownActive(undefined, NOW)).toBe(false);
    expect(
      isMarkdownActive({ percentage: 0, date_from: null, date_to: null }, NOW),
    ).toBe(false);
  });

  it('is active when today is inside an inclusive window', () => {
    expect(
      isMarkdownActive({ percentage: 20, date_from: '2026-07-15', date_to: '2026-07-15' }, NOW),
    ).toBe(true);
    expect(
      isMarkdownActive({ percentage: 20, date_from: '2026-07-01', date_to: '2026-07-31' }, NOW),
    ).toBe(true);
  });

  it('treats null bounds as open-ended', () => {
    expect(
      isMarkdownActive({ percentage: 20, date_from: null, date_to: null }, NOW),
    ).toBe(true);
  });

  it('is inactive before the window starts or after it ends', () => {
    expect(
      isMarkdownActive({ percentage: 20, date_from: '2026-07-16', date_to: null }, NOW),
    ).toBe(false);
    expect(
      isMarkdownActive({ percentage: 20, date_from: null, date_to: '2026-07-14' }, NOW),
    ).toBe(false);
  });
});

describe('effectiveUnitPrice', () => {
  it('returns the base price when no markdown applies', () => {
    expect(effectiveUnitPrice(makeItem(12000), NOW)).toBe(12000);
  });

  it('applies an active markdown, rounded to the nearest centavo', () => {
    const item = makeItem(12000, undefined, {
      percentage: 20,
      date_from: null,
      date_to: null,
    });
    expect(effectiveUnitPrice(item, NOW)).toBe(9600); // 20% off ₱120
  });

  it('ignores a markdown whose window is not open today', () => {
    const future = makeItem(12000, undefined, {
      percentage: 50,
      date_from: '2026-08-01',
      date_to: '2026-08-31',
    });
    expect(effectiveUnitPrice(future, NOW)).toBe(12000);
  });
});

describe('priceLine — markdowns', () => {
  it('discounts a plain marked-down item', () => {
    // ₱120, 20% off → ₱96 each.
    const item = makeItem(12000, undefined, {
      percentage: 20,
      date_from: '2026-07-01',
      date_to: '2026-07-31',
    });
    expect(priceLine(item, 2, NOW)).toEqual([{ quantity: 2, unit_price_centavos: 9600 }]);
  });

  it('charges full price once the markdown window has passed', () => {
    const item = makeItem(12000, undefined, {
      percentage: 20,
      date_from: '2026-06-01',
      date_to: '2026-06-30',
    });
    expect(priceLine(item, 2, NOW)).toEqual([{ quantity: 2, unit_price_centavos: 12000 }]);
  });

  it('applies the markdown below the tier but never stacks it on the tier', () => {
    // Base ₱100 (10% off → ₱90), plus a "2+ at ₱80 each" tier.
    const item = makeItem(
      10000,
      [{ min_quantity: 2, unit_price_centavos: 8000 }],
      { percentage: 10, date_from: null, date_to: null },
    );
    // qty 1: below the tier → discounted base ₱90.
    expect(priceLine(item, 1, NOW)).toEqual([{ quantity: 1, unit_price_centavos: 9000 }]);
    // qty 2: the tier wins and is used as-is (₱80, NOT ₱72).
    expect(priceLine(item, 2, NOW)).toEqual([{ quantity: 2, unit_price_centavos: 8000 }]);
    // qty 3: still every unit at the tier rate — the markdown does not resurface.
    expect(priceLine(item, 3, NOW)).toEqual([{ quantity: 3, unit_price_centavos: 8000 }]);
  });
});

describe('calculateSubtotal', () => {
  it('returns 0 for an empty cart', () => {
    expect(calculateSubtotal([])).toBe(0);
  });

  it('sums line totals', () => {
    expect(
      calculateSubtotal([makeLine(10000, 2), makeLine(4950, 1)]),
    ).toBe(24950);
  });
});

describe('calculateTax', () => {
  it('computes 12% VAT and rounds to the nearest centavo', () => {
    expect(calculateTax(24950, 0.12)).toBe(2994);
  });

  it('returns 0 for a zero subtotal', () => {
    expect(calculateTax(0, 0.12)).toBe(0);
  });
});

describe('calculateTotal', () => {
  it('adds subtotal and tax', () => {
    expect(calculateTotal(24950, 2994)).toBe(27944);
  });

  it('subtracts an optional discount', () => {
    expect(calculateTotal(24950, 2994, 1000)).toBe(26944);
  });
});

describe('calculateChange', () => {
  it('returns the difference when tendered exceeds total', () => {
    expect(calculateChange(27944, 30000)).toBe(2056);
  });

  it('returns 0 when tendered equals total', () => {
    expect(calculateChange(27944, 27944)).toBe(0);
  });

  it('returns 0 (never negative) when tendered is short', () => {
    expect(calculateChange(27944, 20000)).toBe(0);
  });
});
