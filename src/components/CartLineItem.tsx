import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { QuantityNumpad } from '@/components/QuantityNumpad';
import { calculateLineTotal } from '@/lib/cart';
import { F, TNUM } from '@/lib/fonts';
import { formatPeso } from '@/lib/money';
import { useCartStore } from '@/state/cartStore';
import type { CartLine } from '@/types';

export function CartLineItem({ line }: { line: CartLine }) {
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const [numpadOpen, setNumpadOpen] = useState(false);

  const increment = useCallback(
    () => setQuantity(line.item.id, line.quantity + 1),
    [line, setQuantity],
  );
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

  return (
    <View
      className="flex-row items-center"
      style={{
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderColor: 'rgba(26, 20, 16, 0.12)',
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
            color: '#1a1410',
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
            color: '#7a6a55',
          }}
        >
          {line.item.code} · {formatPeso(line.item.price_centavos)} ea
        </Text>
      </Pressable>

      {/* Stepper as a single bordered group, mockup-faithful */}
      <View
        className="flex-row items-center"
        style={{
          borderWidth: 1,
          borderColor: 'rgba(26, 20, 16, 0.25)',
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
            borderColor: 'rgba(26, 20, 16, 0.12)',
          }}
        >
          <Text
            style={{
              fontFamily: F.monoSemibold,
              fontSize: 15,
              color: '#1a1410',
              ...TNUM,
            }}
          >
            {line.quantity}
          </Text>
        </Pressable>
        <StepKey label="+" onPress={increment} />
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
          color: '#1a1410',
          letterSpacing: -0.2,
          ...TNUM,
        }}
      >
        {formatPeso(lineTotal)}
      </Text>

      <QuantityNumpad
        visible={numpadOpen}
        initialValue={line.quantity}
        itemName={line.item.name}
        onCancel={() => setNumpadOpen(false)}
        onConfirm={(qty) => {
          setQuantity(line.item.id, qty);
          setNumpadOpen(false);
        }}
      />
    </View>
  );
}

function StepKey({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <Text
        style={{
          fontFamily: F.serifMedium,
          fontSize: 22,
          color: '#1a1410',
          lineHeight: 24,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
