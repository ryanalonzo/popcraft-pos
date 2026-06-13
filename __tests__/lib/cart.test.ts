import {
  calculateChange,
  calculateLineTotal,
  calculateSubtotal,
  calculateTax,
  calculateTotal,
  priceLine,
} from '@/lib/cart';
import type { CartLine, Item, PriceTier } from '@/types';

function makeItem(price_centavos: number, price_tiers?: PriceTier[]): Item {
  return {
    id: 'itm-' + price_centavos,
    code: 'R042-00000001',
    barcode_value: null,
    name: 'Test item',
    description: '',
    renter_id: 'R042',
    price_centavos,
    price_tiers,
    stock: null,
    is_active: true,
    updated_at: '2026-05-19T00:00:00.000Z',
  };
}

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

  it('prices a full bundle at the tier rate', () => {
    // "65 each, 2 for 120" → base 6500, tier (min 2 → 6000).
    const item = makeItem(6500, [{ min_quantity: 2, unit_price_centavos: 6000 }]);
    expect(calculateLineTotal({ item, quantity: 2 })).toBe(12000);
  });

  it('charges the odd unit at the base price (PH multi-buy)', () => {
    // qty 3 of "2 for 120" (base 65) → 120 + 65 = 185.
    const item = makeItem(6500, [{ min_quantity: 2, unit_price_centavos: 6000 }]);
    expect(calculateLineTotal({ item, quantity: 3 })).toBe(18500);
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
    const item = makeItem(6500, [{ min_quantity: 2, unit_price_centavos: 6000 }]);
    expect(priceLine(item, 1)).toEqual([{ quantity: 1, unit_price_centavos: 6500 }]);
  });

  it('splits an odd quantity into a discounted pair and a regular single', () => {
    const item = makeItem(6500, [{ min_quantity: 2, unit_price_centavos: 6000 }]);
    expect(priceLine(item, 3)).toEqual([
      { quantity: 2, unit_price_centavos: 6000 },
      { quantity: 1, unit_price_centavos: 6500 },
    ]);
  });

  it('packs multiple full bundles into one group (no leftover)', () => {
    const item = makeItem(6500, [{ min_quantity: 2, unit_price_centavos: 6000 }]);
    // 4 = two pairs, all at the tier rate.
    expect(priceLine(item, 4)).toEqual([{ quantity: 4, unit_price_centavos: 6000 }]);
  });

  it('packs the biggest bundle first across tiers, then smaller, then base', () => {
    // base 6500, tiers: 2 → 6000, 3 → 5500. qty 5 → one 3-pack + one 2-pack.
    const tiers: PriceTier[] = [
      { min_quantity: 2, unit_price_centavos: 6000 },
      { min_quantity: 3, unit_price_centavos: 5500 },
    ];
    const item = makeItem(6500, tiers);
    expect(priceLine(item, 5)).toEqual([
      { quantity: 3, unit_price_centavos: 5500 },
      { quantity: 2, unit_price_centavos: 6000 },
    ]);
    // qty 4 → one 3-pack + one base single (greedy biggest-first).
    expect(priceLine(item, 4)).toEqual([
      { quantity: 3, unit_price_centavos: 5500 },
      { quantity: 1, unit_price_centavos: 6500 },
    ]);
  });

  it('is order-independent — unsorted tiers resolve the same', () => {
    const unsorted = makeItem(6500, [
      { min_quantity: 3, unit_price_centavos: 5500 },
      { min_quantity: 2, unit_price_centavos: 6000 },
    ]);
    expect(priceLine(unsorted, 5)).toEqual([
      { quantity: 3, unit_price_centavos: 5500 },
      { quantity: 2, unit_price_centavos: 6000 },
    ]);
  });

  it('merges a leftover that matches the base into one group', () => {
    // Tier unit price equals base — a degenerate but valid config.
    const item = makeItem(6500, [{ min_quantity: 2, unit_price_centavos: 6500 }]);
    expect(priceLine(item, 3)).toEqual([{ quantity: 3, unit_price_centavos: 6500 }]);
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
