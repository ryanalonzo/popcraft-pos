import {
  selectIsEmpty,
  selectItemCount,
  selectSubtotal,
  selectTax,
  selectTotal,
  TAX_RATE,
  useCartStore,
} from '@/state/cartStore';
import type { Item } from '@/types';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'itm-1',
    code: 'R042-00000001',
    barcode_value: null,
    name: 'Test item',
    description: '',
    renter_id: 'R042',
    price_centavos: 10000,
    is_active: true,
    updated_at: '2026-05-19T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  useCartStore.getState().clearCart();
});

describe('cartStore actions', () => {
  it('starts empty', () => {
    const s = useCartStore.getState();
    expect(s.lines).toEqual([]);
    expect(selectIsEmpty(s)).toBe(true);
  });

  it('adds a new item with quantity 1', () => {
    useCartStore.getState().addItem(makeItem());
    const s = useCartStore.getState();
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]?.quantity).toBe(1);
    expect(selectItemCount(s)).toBe(1);
  });

  it('increments quantity when the same item is added again', () => {
    const item = makeItem();
    useCartStore.getState().addItem(item);
    useCartStore.getState().addItem(item);
    const s = useCartStore.getState();
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]?.quantity).toBe(2);
    expect(selectItemCount(s)).toBe(2);
  });

  it('setQuantity replaces the quantity', () => {
    const item = makeItem();
    useCartStore.getState().addItem(item);
    useCartStore.getState().setQuantity(item.id, 5);
    expect(useCartStore.getState().lines[0]?.quantity).toBe(5);
  });

  it('setQuantity <= 0 removes the line', () => {
    const item = makeItem();
    useCartStore.getState().addItem(item);
    useCartStore.getState().setQuantity(item.id, 0);
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it('removeLine drops the line', () => {
    const a = makeItem({ id: 'a' });
    const b = makeItem({ id: 'b', code: 'R042-00000002' });
    useCartStore.getState().addItem(a);
    useCartStore.getState().addItem(b);
    useCartStore.getState().removeLine('a');
    const s = useCartStore.getState();
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]?.item.id).toBe('b');
  });

  it('applyDiscount clamps negatives and floors', () => {
    useCartStore.getState().applyDiscount(-500);
    expect(useCartStore.getState().discount_centavos).toBe(0);
    useCartStore.getState().applyDiscount(150.9);
    expect(useCartStore.getState().discount_centavos).toBe(150);
  });

  it('clearCart resets lines and discount', () => {
    useCartStore.getState().addItem(makeItem());
    useCartStore.getState().applyDiscount(500);
    useCartStore.getState().clearCart();
    const s = useCartStore.getState();
    expect(s.lines).toEqual([]);
    expect(s.discount_centavos).toBe(0);
  });
});

describe('cartStore selectors', () => {
  it('total equals gross subtotal (tax is back-office only)', () => {
    const item = makeItem({ price_centavos: 24950 });
    useCartStore.getState().addItem(item);
    const s = useCartStore.getState();
    expect(selectSubtotal(s)).toBe(24950);
    expect(selectTotal(s)).toBe(24950);
    // selectTax stays exposed for reports — independent from total.
    const expectedReportTax = Math.round(24950 * TAX_RATE);
    expect(selectTax(s)).toBe(expectedReportTax);
  });

  it('total subtracts the discount (no tax addition)', () => {
    const item = makeItem({ price_centavos: 24950 });
    useCartStore.getState().addItem(item);
    useCartStore.getState().applyDiscount(1000);
    const s = useCartStore.getState();
    expect(selectTotal(s)).toBe(24950 - 1000);
  });

  it('itemCount sums quantities across lines', () => {
    const a = makeItem({ id: 'a' });
    const b = makeItem({ id: 'b', code: 'R042-00000002' });
    useCartStore.getState().addItem(a);
    useCartStore.getState().addItem(a);
    useCartStore.getState().addItem(b);
    expect(selectItemCount(useCartStore.getState())).toBe(3);
  });
});
