import {
  alignCenter,
  bold,
  buildReceiptBytes,
  concat,
  cut,
  decodeReceipt,
  doubleSize,
  init,
  kickDrawer,
  lineFeed,
  text,
} from '@/print/escpos';
import type { Sale } from '@/types';

describe('escpos byte builders', () => {
  it('init emits ESC @', () => {
    expect(Array.from(init())).toEqual([0x1b, 0x40]);
  });

  it('bold(true)/bold(false) emit ESC E 1 / ESC E 0', () => {
    expect(Array.from(bold(true))).toEqual([0x1b, 0x45, 0x01]);
    expect(Array.from(bold(false))).toEqual([0x1b, 0x45, 0x00]);
  });

  it('doubleSize on/off emit GS ! 0x11 / 0x00', () => {
    expect(Array.from(doubleSize(true))).toEqual([0x1d, 0x21, 0x11]);
    expect(Array.from(doubleSize(false))).toEqual([0x1d, 0x21, 0x00]);
  });

  it('alignCenter emits ESC a 1', () => {
    expect(Array.from(alignCenter())).toEqual([0x1b, 0x61, 0x01]);
  });

  it('lineFeed(n) emits n LF bytes', () => {
    expect(Array.from(lineFeed(3))).toEqual([0x0a, 0x0a, 0x0a]);
  });

  it('cut emits GS V 1', () => {
    expect(Array.from(cut())).toEqual([0x1d, 0x56, 0x01]);
  });

  it('kickDrawer emits the standard ESC p sequence', () => {
    expect(Array.from(kickDrawer())).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  });

  it('text encodes as UTF-8', () => {
    expect(Array.from(text('A'))).toEqual([0x41]);
  });

  it('concat joins multiple fragments in order', () => {
    const joined = concat(new Uint8Array([1, 2]), new Uint8Array([3]));
    expect(Array.from(joined)).toEqual([1, 2, 3]);
  });
});

function sampleSale(): Sale {
  return {
    id: 'sale-1',
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
      {
        item_id: 'i2',
        item_code: 'R042-00000002',
        item_name: 'Sticker pack',
        renter_id: 'R042',
        quantity: 2,
        unit_price_centavos: 7500,
        line_total_centavos: 15000,
      },
    ],
    subtotal_centavos: 30000,
    tax_centavos: 3600,
    total_centavos: 33600,
    payment_method: 'cash',
    amount_tendered_centavos: 50000,
    change_centavos: 16400,
    created_at: '2026-05-19T14:32:00.000Z',
    synced_at: null,
  };
}

describe('buildReceiptBytes + decodeReceipt round trip', () => {
  it('produces text containing store, cashier, items, totals, and footer', () => {
    const sale = sampleSale();
    const bytes = buildReceiptBytes(sale, 'POPCRAFT ARTS', {
      includeDrawerKick: true,
      cashierName: 'Maria',
    });
    const decoded = decodeReceipt(bytes);

    expect(decoded.drawerKicked).toBe(true);
    expect(decoded.text).toContain('POPCRAFT ARTS');
    expect(decoded.text).toContain('2026-05-19 14:32');
    expect(decoded.text).toContain('Cashier: Maria');
    expect(decoded.text).toContain('Anime keychain');
    expect(decoded.text).toContain('Sticker pack');
    expect(decoded.text).toContain('x2 @ 75.00');
    expect(decoded.text).toContain('Subtotal');
    expect(decoded.text).toContain('TOTAL');
    expect(decoded.text).toContain('CASH');
    expect(decoded.text).toContain('Tendered');
    expect(decoded.text).toContain('Change');
    expect(decoded.text).toContain('Thank you!');
  });

  it('omits the drawer kick when includeDrawerKick is false', () => {
    const sale = sampleSale();
    const bytes = buildReceiptBytes(sale, 'POPCRAFT ARTS', {
      includeDrawerKick: false,
    });
    expect(decodeReceipt(bytes).drawerKicked).toBe(false);
  });

  it('falls back to cashier_id when no cashier name is given', () => {
    const sale = sampleSale();
    const bytes = buildReceiptBytes(sale, 'POPCRAFT ARTS', {
      includeDrawerKick: false,
    });
    expect(decodeReceipt(bytes).text).toContain('Cashier: C001');
  });

  it('skips tendered/change lines for non-cash payments', () => {
    const sale: Sale = {
      ...sampleSale(),
      payment_method: 'gcash',
      amount_tendered_centavos: null,
      change_centavos: null,
    };
    const bytes = buildReceiptBytes(sale, 'POPCRAFT ARTS', {
      includeDrawerKick: false,
    });
    const decoded = decodeReceipt(bytes);
    expect(decoded.text).toContain('GCASH');
    expect(decoded.text).not.toContain('Tendered');
    expect(decoded.text).not.toContain('Change');
  });
});
