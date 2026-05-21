import {
  calculateChange,
  calculateLineTotal,
  calculateSubtotal,
  calculateTax,
  calculateTotal,
} from '@/lib/cart';
import type { CartLine, Item } from '@/types';

function makeItem(price_centavos: number): Item {
  return {
    id: 'itm-' + price_centavos,
    code: 'R042-00000001',
    barcode_value: null,
    name: 'Test item',
    description: '',
    renter_id: 'R042',
    price_centavos,
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
