import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { QuantityNumpad } from '@/components/QuantityNumpad';
import { calculateLineTotal, priceLine } from '@/lib/cart';
import { F, TNUM } from '@/lib/fonts';
import { formatPeso } from '@/lib/money';
import { useCartStore } from '@/state/cartStore';
import type { CartLine } from '@/types';

export function CartLineItem({ line }: { line: CartLine }) {
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const [numpadOpen, setNumpadOpen] = useState(false);

  const stock = line.item.stock;
  const atCap = stock != null && line.quantity >= stock;

  const increment = useCallback(() => {
    if (stock != null && line.quantity >= stock) return;
    setQuantity(line.item.id, line.quantity + 1);
  }, [line, setQuantity, stock]);
  const decrement = useCallback(
    () => setQuantity(line.item.id, line.quantity - 1),
    [line, setQuantity],
  );
  const confirmRemove = useCallback(() => {
    Alert.alert('Remove item?', `Remove "${line.item.name}" from the cart?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeLine(line.item.id),
      },
    ]);
  }, [line, removeLine]);

  const lineTotal = calculateLineTotal(line);
  const groups = priceLine(line.item, line.quantity);
  const regular = line.item.price_centavos;
  // Spell out what's actually charged. Multiple price groups mean a quantity
  // tier split ("2 @ ₱60 + 1 @ ₱65"). A single group below the regular price
  // means a markdown ("on sale") or a full tier pack — show the discounted
  // unit price with the regular one struck through so the cashier sees both.
  const singleUnit = groups[0]?.unit_price_centavos ?? regular;
  const discounted = groups.length === 1 && singleUnit !== regular;
  const priceNode =
    groups.length > 1 ? (
      groups.map((g) => `${g.quantity} @ ${formatPeso(g.unit_price_centavos)}`).join(' + ')
    ) : discounted ? (
      <>
        {formatPeso(singleUnit)} ea{' '}
        <Text style={{ textDecorationLine: 'line-through', color: '#a98a63' }}>
          {formatPeso(regular)}
        </Text>
      </>
    ) : (
      `${formatPeso(regular)} ea`
    );

  return (
    <View
      className="flex-row items-center"
      style={{
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderColor: 'rgba(35, 21, 8, 0.12)',
        gap: 24,
      }}
    >
      <Pressable
        onLongPress={confirmRemove}
        delayLongPress={400}
        style={{ flex: 1 }}
      >
        <Text
          style={{
            fontFamily: F.serif,
            fontSize: 20,
            color: '#231508',
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
        >
          {line.item.name}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: 1.1,
            color: '#7a5530',
          }}
        >
          {line.item.code} · {priceNode}
          {stock != null ? ` · ${stock} in stock` : ''}
        </Text>
      </Pressable>

      {/* Stepper as a single bordered group, mockup-faithful */}
      <View
        className="flex-row items-center"
        style={{
          borderWidth: 1,
          borderColor: 'rgba(35, 21, 8, 0.25)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <StepKey label="−" onPress={decrement} />
        <Pressable
          onPress={() => setNumpadOpen(true)}
          style={{
            width: 48,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 248, 235, 0.5)',
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: 'rgba(35, 21, 8, 0.12)',
          }}
        >
          <Text
            style={{
              fontFamily: F.monoSemibold,
              fontSize: 15,
              color: '#231508',
              ...TNUM,
            }}
          >
            {line.quantity}
          </Text>
        </Pressable>
        <StepKey label="+" onPress={increment} disabled={atCap} />
      </View>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={{
          minWidth: 110,
          textAlign: 'right',
          fontFamily: F.serifMedium,
          fontSize: 22,
          color: '#231508',
          letterSpacing: -0.2,
          ...TNUM,
        }}
      >
        {formatPeso(lineTotal)}
      </Text>

      {/* Explicit remove affordance — long-press still works but the
       * visible × means cashiers don't have to discover it. */}
      <Pressable
        onPress={confirmRemove}
        hitSlop={8}
        android_ripple={{ color: 'rgba(35, 21, 8, 0.08)', borderless: true, radius: 22 }}
        style={{
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 18,
        }}
      >
        <Text
          style={{
            fontFamily: F.mono,
            fontSize: 20,
            lineHeight: 22,
            color: '#7a5530',
          }}
        >
          ×
        </Text>
      </Pressable>

      <QuantityNumpad
        visible={numpadOpen}
        initialValue={line.quantity}
        itemName={line.item.name}
        onCancel={() => setNumpadOpen(false)}
        onConfirm={(qty) => {
          const res = setQuantity(line.item.id, qty);
          if (res.capped) {
            Alert.alert(
              'Not enough stock',
              `Only ${res.available} of "${line.item.name}" in stock. Quantity set to ${res.applied}.`,
            );
          }
          setNumpadOpen(false);
        }}
      />
    </View>
  );
}

function StepKey({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: F.serifMedium,
          fontSize: 22,
          color: '#231508',
          lineHeight: 24,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
