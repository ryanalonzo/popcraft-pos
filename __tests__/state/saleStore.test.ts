import { filterTodaysSales, useSaleStore } from '@/state/saleStore';
import type { Sale } from '@/types';

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: `sale-${Math.random().toString(36).slice(2)}`,
    cashier_id: 'C-MARIA',
    lines: [],
    subtotal_centavos: 10000,
    tax_centavos: 1200,
    total_centavos: 11200,
    payment_method: 'cash',
    amount_tendered_centavos: 20000,
    change_centavos: 8800,
    created_at: new Date().toISOString(),
    synced_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  useSaleStore.getState().reset();
});

describe('saleStore', () => {
  it('records sales most-recent first', () => {
    const a = makeSale({ total_centavos: 10000 });
    const b = makeSale({ total_centavos: 20000 });
    useSaleStore.getState().recordSale(a);
    useSaleStore.getState().recordSale(b);
    const list = useSaleStore.getState().recentSales;
    expect(list[0]?.id).toBe(b.id);
    expect(list[1]?.id).toBe(a.id);
  });

  it('caps history at 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      useSaleStore.getState().recordSale(makeSale({ id: `s-${i}` }));
    }
    expect(useSaleStore.getState().recentSales).toHaveLength(50);
    expect(useSaleStore.getState().recentSales[0]?.id).toBe('s-59');
  });

  it('markSynced updates the matching sale only', () => {
    const a = makeSale({ id: 'a' });
    const b = makeSale({ id: 'b' });
    useSaleStore.getState().recordSale(a);
    useSaleStore.getState().recordSale(b);
    useSaleStore.getState().markSynced('a', '2026-05-19T10:00:00.000Z');
    const list = useSaleStore.getState().recentSales;
    expect(list.find((s) => s.id === 'a')?.synced_at).toBe(
      '2026-05-19T10:00:00.000Z',
    );
    expect(list.find((s) => s.id === 'b')?.synced_at).toBeNull();
  });

  it('getSaleById returns the sale or undefined', () => {
    const a = makeSale({ id: 'a' });
    useSaleStore.getState().recordSale(a);
    expect(useSaleStore.getState().getSaleById('a')?.id).toBe('a');
    expect(useSaleStore.getState().getSaleById('missing')).toBeUndefined();
  });

  it('filterTodaysSales ignores yesterday', () => {
    const today = makeSale({ total_centavos: 5000 });
    const yesterday = makeSale({
      id: 'yest',
      total_centavos: 99999,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
    useSaleStore.getState().recordSale(yesterday);
    useSaleStore.getState().recordSale(today);
    const list = filterTodaysSales(useSaleStore.getState().recentSales);
    expect(list).toHaveLength(1);
    expect(list.reduce((n, s) => n + s.total_centavos, 0)).toBe(5000);
  });
});
