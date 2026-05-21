import { Text, View } from 'react-native';

import { F, TNUM } from '@/lib/fonts';
import { formatPeso } from '@/lib/money';
import {
  useCartDiscount,
  useCartItemCount,
  useCartSubtotal,
  useCartTotal,
} from '@/state/cartStore';

/**
 * Editorial summary panel for the cart right rail. Mono micro-labels,
 * serif values, a heavy ink rule above the grand total to anchor the
 * customer's eye.
 */
export function CartSummary() {
  const subtotal = useCartSubtotal();
  const discount = useCartDiscount();
  const total = useCartTotal();
  const itemCount = useCartItemCount();

  return (
    <View>
      <Row label="ITEMS" value={`${itemCount}`} />
      <Row label="SUBTOTAL" value={formatPeso(subtotal)} />
      {discount > 0 ? (
        <Row label="DISCOUNT" value={`− ${formatPeso(discount)}`} />
      ) : null}

      <View
        className="flex-row items-baseline justify-between"
        style={{
          marginTop: 16,
          paddingTop: 18,
          paddingBottom: 8,
          borderTopWidth: 2,
          borderColor: '#1a1410',
        }}
      >
        <Text
          style={{
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: 2.5,
            color: '#1a1410',
          }}
        >
          TOTAL DUE
        </Text>
        <Text
          style={{
            fontFamily: F.serifMedium,
            fontSize: 48,
            color: '#1a1410',
            letterSpacing: -1,
            ...TNUM,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatPeso(total)}
        </Text>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-row items-baseline justify-between"
      style={{ paddingVertical: 10 }}
    >
      <Text
        style={{
          fontFamily: F.mono,
          fontSize: 11,
          letterSpacing: 2,
          color: '#7a6a55',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: F.serifMedium,
          fontSize: 17,
          color: '#1a1410',
          ...TNUM,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
