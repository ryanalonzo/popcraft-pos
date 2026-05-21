import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { pauseScanner } from '@/hooks/useScannerInput';

interface QuantityNumpadProps {
  visible: boolean;
  initialValue: number;
  itemName: string;
  onCancel: () => void;
  onConfirm: (qty: number) => void;
}

/**
 * Tablet-friendly numpad modal for setting a line quantity. While the
 * modal is open the global scanner is paused so the focus thief doesn't
 * fight with the cashier.
 */
export function QuantityNumpad({
  visible,
  initialValue,
  itemName,
  onCancel,
  onConfirm,
}: QuantityNumpadProps) {
  const [draft, setDraft] = useState<string>(String(initialValue));

  useEffect(() => {
    if (visible) setDraft(String(initialValue));
  }, [visible, initialValue]);

  useEffect(() => {
    if (!visible) return;
    const release = pauseScanner();
    return release;
  }, [visible]);

  const append = (d: string) =>
    setDraft((cur) => {
      if (cur === '0') return d;
      if (cur.length >= 4) return cur;
      return cur + d;
    });

  const backspace = () =>
    setDraft((cur) => (cur.length <= 1 ? '0' : cur.slice(0, -1)));

  const clear = () => setDraft('0');

  const confirm = () => {
    const qty = Number.parseInt(draft, 10);
    onConfirm(Number.isFinite(qty) && qty > 0 ? qty : 0);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        onPress={onCancel}
        className="flex-1 items-center justify-center bg-black/40"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-[420px] rounded-2xl bg-paper p-6"
        >
          <Text className="text-sm text-ink-muted">Set quantity</Text>
          <Text className="mt-1 text-lg font-semibold text-ink" numberOfLines={1}>
            {itemName}
          </Text>

          <View className="mt-4 rounded-md bg-paper-warm px-4 py-4">
            <Text className="text-right text-4xl font-bold text-ink">
              {draft}
            </Text>
          </View>

          <View className="mt-4">
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
            ].map((row, ri) => (
              <View key={ri} className="flex-row">
                {row.map((d) => (
                  <NumpadKey key={d} label={d} onPress={() => append(d)} />
                ))}
              </View>
            ))}
            <View className="flex-row">
              <NumpadKey label="C" onPress={clear} variant="ghost" />
              <NumpadKey label="0" onPress={() => append('0')} />
              <NumpadKey label="⌫" onPress={backspace} variant="ghost" />
            </View>
          </View>

          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={onCancel}
              className="flex-1 rounded-md border border-ink-muted px-4 py-3"
            >
              <Text className="text-center text-base font-semibold text-ink">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              className="flex-1 rounded-md bg-accent px-4 py-3 active:opacity-80"
            >
              <Text className="text-center text-base font-semibold text-paper">
                Confirm
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NumpadKey({
  label,
  onPress,
  variant = 'solid',
}: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'ghost';
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`m-1 flex-1 items-center justify-center rounded-md py-4 ${
        variant === 'ghost' ? 'bg-paper-warm' : 'bg-ink'
      } active:opacity-70`}
    >
      <Text
        className={`text-2xl font-bold ${
          variant === 'ghost' ? 'text-ink' : 'text-paper'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
