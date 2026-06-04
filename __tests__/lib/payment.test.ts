import { opensCashDrawer } from '@/lib/payment';
import { buildReceiptBytes, decodeReceipt } from '@/print/escpos';
import type { PaymentMethod, Sale } from '@/types';

const ALL_METHODS: PaymentMethod[] = ['cash', 'gcash', 'maya', 'card'];

function saleWith(method: PaymentMethod): Sale {
  return {
    id: 'sale-1',
    cashier_id: 'C001',
    lines: [
      {
        item_id: 'i1',
        item_code: 'R042-00000001',
        item_name: 'Keychain',
        renter_id: 'R042',
        quantity: 1,
        unit_price_centavos: 15000,
        line_total_centavos: 15000,
      },
    ],
    subtotal_centavos: 15000,
    tax_centavos: 0,
    total_centavos: 15000,
    payment_method: method,
    amount_tendered_centavos: method === 'cash' ? 20000 : null,
    change_centavos: method === 'cash' ? 5000 : null,
    created_at: '2026-06-04T10:00:00.000Z',
    synced_at: null,
  };
}

describe('opensCashDrawer', () => {
  it('opens only for physical cash', () => {
    expect(opensCashDrawer('cash')).toBe(true);
  });

  it.each(['gcash', 'maya', 'card'] as PaymentMethod[])(
    'does NOT open for %s',
    (method) => {
      expect(opensCashDrawer(method)).toBe(false);
    },
  );
});

describe('receipt drawer kick follows payment method', () => {
  it.each(ALL_METHODS)(
    'method %s embeds a drawer kick only when it is cash',
    (method) => {
      const bytes = buildReceiptBytes(saleWith(method), 'POPCRAFT ARTS', {
        includeDrawerKick: opensCashDrawer(method),
      });
      expect(decodeReceipt(bytes).drawerKicked).toBe(method === 'cash');
    },
  );
});
