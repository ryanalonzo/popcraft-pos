import { buildSaleFromCart, TAX_RATE } from '@/lib/saleBuilder';
import type { CartLine, Item } from '@/types';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'itm-1',
    code: 'R001-00000001',
    barcode_value: null,
    name: 'Demon Slayer keychain',
    description: '',
    renter_id: 'R001',
    price_centavos: 15000,
    stock: null,
    is_active: true,
    updated_at: '2026-05-19T00:00:00.000Z',
    ...overrides,
  };
}

function makeLine(item: Item, qty: number): CartLine {
  return { item, quantity: qty };
}

describe('buildSaleFromCart', () => {
  it('snapshots item code/name/price into each line', () => {
    const item = makeItem();
    const sale = buildSaleFromCart({
      cartLines: [makeLine(item, 2)],
      paymentMethod: 'cash',
      cashierId: 'C-MARIA',
      amountTendered: 50000,
    });
    expect(sale.lines).toHaveLength(1);
    expect(sale.lines[0]?.item_id).toBe(item.id);
    expect(sale.lines[0]?.item_code).toBe(item.code);
    expect(sale.lines[0]?.item_name).toBe(item.name);
    expect(sale.lines[0]?.renter_id).toBe(item.renter_id);
    expect(sale.lines[0]?.quantity).toBe(2);
    expect(sale.lines[0]?.unit_price_centavos).toBe(15000);
    expect(sale.lines[0]?.line_total_centavos).toBe(30000);
  });

  it('snapshots a full bundle as one line at the tier price', () => {
    // "65 each, 2 for 120": base 6500, tier group total 12000 → 60 ea. qty 2 = one pair.
    const item = makeItem({
      price_centavos: 6500,
      price_tiers: [{ min_quantity: 2, unit_price_centavos: 12000 }],
    });
    const sale = buildSaleFromCart({
      cartLines: [makeLine(item, 2)],
      paymentMethod: 'cash',
      cashierId: 'C-MARIA',
      amountTendered: 50000,
    });
    expect(sale.lines).toHaveLength(1);
    expect(sale.lines[0]?.unit_price_centavos).toBe(6000);
    expect(sale.lines[0]?.line_total_centavos).toBe(12000);
    expect(sale.subtotal_centavos).toBe(12000);
  });

  it('splits an odd bulk quantity into a discounted line and a regular line', () => {
    // qty 3 of "2 for 120" (base 65, tier total 12000) → 2 @ 60 (=120) + 1 @ 65 (=65) = 185.
    const item = makeItem({
      price_centavos: 6500,
      price_tiers: [{ min_quantity: 2, unit_price_centavos: 12000 }],
    });
    const sale = buildSaleFromCart({
      cartLines: [makeLine(item, 3)],
      paymentMethod: 'cash',
      cashierId: 'C-MARIA',
      amountTendered: 50000,
    });
    expect(sale.lines).toHaveLength(2);
    // Discounted pair first, regular single second.
    expect(sale.lines[0]).toMatchObject({
      item_id: item.id,
      quantity: 2,
      unit_price_centavos: 6000,
      line_total_centavos: 12000,
    });
    expect(sale.lines[1]).toMatchObject({
      item_id: item.id,
      quantity: 1,
      unit_price_centavos: 6500,
      line_total_centavos: 6500,
    });
    // Every emitted line keeps line_total == unit_price × quantity.
    for (const l of sale.lines) {
      expect(l.line_total_centavos).toBe(l.unit_price_centavos * l.quantity);
    }
    expect(sale.subtotal_centavos).toBe(18500);
    expect(sale.total_centavos).toBe(18500);
  });

  it('snapshots the discounted price for an item on sale (markdown)', () => {
    // ₱120 with an open-ended 20% markdown → ₱96 each is what's charged.
    const item = makeItem({
      price_centavos: 12000,
      markdown: { percentage: 20, date_from: null, date_to: null },
    });
    const sale = buildSaleFromCart({
      cartLines: [makeLine(item, 2)],
      paymentMethod: 'cash',
      cashierId: 'C-MARIA',
      amountTendered: 50000,
    });
    expect(sale.lines).toHaveLength(1);
    expect(sale.lines[0]?.unit_price_centavos).toBe(9600);
    expect(sale.lines[0]?.line_total_centavos).toBe(19200);
    expect(sale.subtotal_centavos).toBe(19200);
    expect(sale.total_centavos).toBe(19200);
  });

  it('treats item prices as gross (tax-inclusive); total = subtotal in integer centavos', () => {
    const item = makeItem({ price_centavos: 24950 });
    const sale = buildSaleFromCart({
      cartLines: [makeLine(item, 1)],
      paymentMethod: 'cash',
      cashierId: 'C-MARIA',
      amountTendered: 50000,
    });
    // Customer pays gross subtotal; tax is back-office only.
    expect(sale.subtotal_centavos).toBe(24950);
    expect(sale.total_centavos).toBe(24950);
    // Embedded tax = round(gross * rate / (1 + rate))
    const expectedTax = Math.round((24950 * TAX_RATE) / (1 + TAX_RATE));
    expect(sale.tax_centavos).toBe(expectedTax);
  });

  it('applies an optional discount to the total (before embedded-tax calc)', () => {
    const item = makeItem({ price_centavos: 24950 });
    const sale = buildSaleFromCart({
      cartLines: [makeLine(item, 1)],
      paymentMethod: 'cash',
      cashierId: 'C-MARIA',
      amountTendered: 50000,
      discount: 1000,
    });
    expect(sale.total_centavos).toBe(24950 - 1000);
    const expectedTax = Math.round((sale.total_centavos * TAX_RATE) / (1 + TAX_RATE));
    expect(sale.tax_centavos).toBe(expectedTax);
  });

  it('records change for cash payments based on gross total', () => {
    const item = makeItem({ price_centavos: 10000 });
    const sale = buildSaleFromCart({
      cartLines: [makeLine(item, 1)],
      paymentMethod: 'cash',
      cashierId: 'C-MARIA',
      amountTendered: 20000,
    });
    expect(sale.total_centavos).toBe(10000);
    expect(sale.amount_tendered_centavos).toBe(20000);
    expect(sale.change_centavos).toBe(10000);
  });

  it('clamps change to 0 when tender is short (cart UI gates this, defensive here)', () => {
    const item = makeItem({ price_centavos: 10000 });
    const sale = buildSaleFromCart({
      cartLines: [makeLine(item, 1)],
      paymentMethod: 'cash',
      cashierId: 'C-MARIA',
      amountTendered: 5000,
    });
    expect(sale.change_centavos).toBe(0);
  });

  it('omits tendered and change for non-cash payments', () => {
    const item = makeItem();
    const sale = buildSaleFromCart({
      cartLines: [makeLine(item, 1)],
      paymentMethod: 'gcash',
      cashierId: 'C-MARIA',
    });
    expect(sale.amount_tendered_centavos).toBeNull();
    expect(sale.change_centavos).toBeNull();
  });

  it('generates a unique sale id per call and sets synced_at to null', () => {
    const item = makeItem();
    const a = buildSaleFromCart({
      cartLines: [makeLine(item, 1)],
      paymentMethod: 'cash',
      cashierId: 'C-MARIA',
      amountTendered: 50000,
    });
    const b = buildSaleFromCart({
      cartLines: [makeLine(item, 1)],
      paymentMethod: 'cash',
      cashierId: 'C-MARIA',
      amountTendered: 50000,
    });
    expect(a.id).not.toBe(b.id);
    expect(a.synced_at).toBeNull();
    expect(b.synced_at).toBeNull();
    expect(a.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
