import { buildReceiptBytes } from '@/print/escpos';
import { MockPrintAdapter } from '@/print/MockPrintAdapter';
import type { Sale } from '@/types';

function sampleSale(): Sale {
  return {
    id: 'sale-mock',
    cashier_id: 'C001',
    lines: [
      {
        item_id: 'i1',
        item_code: 'R042-00000001',
        item_name: 'Anime keychain',
        renter_id: 'R042',
        quantity: 1,
        unit_price_centavos: 15000,
        line_total_centavos: 15000,
      },
    ],
    subtotal_centavos: 15000,
    tax_centavos: 1800,
    total_centavos: 16800,
    payment_method: 'cash',
    amount_tendered_centavos: 20000,
    change_centavos: 3200,
    created_at: '2026-05-19T14:32:00.000Z',
    synced_at: null,
  };
}

describe('MockPrintAdapter', () => {
  it('returns success and records history', async () => {
    const adapter = new MockPrintAdapter();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const sale = sampleSale();
    const bytes = buildReceiptBytes(sale, 'POPCRAFT ARTS', { includeDrawerKick: true });
    const result = await adapter.print({ bytes, openDrawer: true, jobId: sale.id });

    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    const history = adapter.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.jobId).toBe(sale.id);
    expect(history[0]?.preview).toContain('POPCRAFT ARTS');
    expect(history[0]?.preview).toContain('[DRAWER KICK FIRED]');

    logSpy.mockRestore();
  });

  it('honours failNext exactly once', async () => {
    const adapter = new MockPrintAdapter();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    adapter.failNext = true;

    const bytes = buildReceiptBytes(sampleSale(), 'POPCRAFT ARTS', { includeDrawerKick: false });
    const fail = await adapter.print({ bytes, openDrawer: false, jobId: 'a' });
    const ok = await adapter.print({ bytes, openDrawer: false, jobId: 'b' });

    expect(fail.success).toBe(false);
    expect(fail.error).toBeDefined();
    expect(ok.success).toBe(true);
  });

  it('caps history at 10 most-recent entries', async () => {
    const adapter = new MockPrintAdapter();
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const bytes = buildReceiptBytes(sampleSale(), 'POPCRAFT ARTS', { includeDrawerKick: false });
    for (let i = 0; i < 12; i++) {
      await adapter.print({ bytes, openDrawer: false, jobId: `job-${i}` });
    }
    const history = adapter.getHistory();
    expect(history).toHaveLength(10);
    expect(history[0]?.jobId).toBe('job-11');
    expect(history[9]?.jobId).toBe('job-2');
  });
});
