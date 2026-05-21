import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { pauseScanner } from '@/hooks/useScannerInput';
import { calculateChange } from '@/lib/cart';
import { F, TNUM } from '@/lib/fonts';
import { formatPeso, formatPesoNoSymbol } from '@/lib/money';
import type { PaymentMethod } from '@/types';

interface PaymentSheetProps {
  visible: boolean;
  totalCentavos: number;
  onCancel: () => void;
  onConfirm: (input: {
    method: PaymentMethod;
    amountTendered: number | null;
    reference: string | null;
  }) => void;
}

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
  { id: 'maya', label: 'Maya' },
  { id: 'card', label: 'Card' },
];

const QUICK_AMOUNTS = [20000, 50000, 100000, 150000, 200000, 500000, 1000000];
const MAX_CENTAVOS = 99_999_999;

export function PaymentSheet({
  visible,
  totalCentavos,
  onCancel,
  onConfirm,
}: PaymentSheetProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tenderedCentavos, setTenderedCentavos] = useState(0);
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (!visible) return;
    return pauseScanner();
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setMethod('cash');
      setTenderedCentavos(0);
      setReference('');
    }
  }, [visible]);

  const change = calculateChange(totalCentavos, tenderedCentavos);
  const isCash = method === 'cash';
  const canConfirm = isCash ? tenderedCentavos >= totalCentavos : true;

  const appendDigit = (d: number) =>
    setTenderedCentavos((c) => Math.min(c * 10 + d, MAX_CENTAVOS));
  const backspace = () => setTenderedCentavos((c) => Math.floor(c / 10));
  const clear = () => setTenderedCentavos(0);
  const setExact = () => setTenderedCentavos(totalCentavos);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      method,
      amountTendered: isCash ? tenderedCentavos : null,
      reference:
        !isCash && reference.trim().length > 0 ? reference.trim() : null,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: 'rgba(26, 20, 16, 0.55)',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: isCash ? 880 : 600,
              maxWidth: '98%',
              backgroundColor: '#f4ede0',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingTop: 36,
              paddingHorizontal: 44,
              paddingBottom: 40,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -20 },
              shadowOpacity: 0.4,
              shadowRadius: 80,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 44,
                height: 4,
                borderRadius: 100,
                backgroundColor: '#b3a48c',
                marginTop: -16,
                marginBottom: 22,
              }}
            />

            {/* Head */}
            <View
              className="flex-row items-baseline justify-between"
              style={{
                paddingBottom: 22,
                borderBottomWidth: 1,
                borderColor: 'rgba(26, 20, 16, 0.12)',
                marginBottom: 24,
              }}
            >
              <View>
                <Text
                  style={{
                    fontFamily: F.mono,
                    fontSize: 11,
                    letterSpacing: 2.5,
                    color: '#7a6a55',
                  }}
                >
                  TOTAL DUE
                </Text>
                <Text
                  style={{
                    marginTop: 6,
                    fontFamily: F.serifItalic,
                    fontSize: 16,
                    color: '#7a6a55',
                  }}
                >
                  Collect from the customer.
                </Text>
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                style={{
                  fontFamily: F.serifMedium,
                  fontSize: 60,
                  color: '#d23a1a',
                  letterSpacing: -1.2,
                  ...TNUM,
                }}
              >
                {formatPeso(totalCentavos)}
              </Text>
            </View>

            {/* Method tabs */}
            <View
              style={{
                flexDirection: 'row',
                gap: 10,
                marginBottom: 24,
              }}
            >
              {METHODS.map((m) => {
                const active = m.id === method;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setMethod(m.id)}
                    style={{
                      flex: 1,
                      paddingVertical: 16,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor: active ? '#1a1410' : 'rgba(26, 20, 16, 0.25)',
                      backgroundColor: active ? '#1a1410' : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: F.mono,
                        fontSize: 12,
                        letterSpacing: 1.6,
                        color: active ? '#f4ede0' : '#3a2f24',
                      }}
                    >
                      {m.label.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {isCash ? (
              <CashBody
                tenderedCentavos={tenderedCentavos}
                totalCentavos={totalCentavos}
                change={change}
                onDigit={appendDigit}
                onBackspace={backspace}
                onClear={clear}
                onExact={setExact}
                onQuick={setTenderedCentavos}
              />
            ) : (
              <NonCashBody
                method={method}
                reference={reference}
                onChange={setReference}
              />
            )}

            {/* Footer actions */}
            <View
              style={{
                marginTop: 28,
                flexDirection: 'row',
                gap: 12,
              }}
            >
              <Pressable
                onPress={onCancel}
                style={{
                  flex: 1,
                  paddingVertical: 22,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: 'rgba(26, 20, 16, 0.25)',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: F.mono,
                    fontSize: 12,
                    letterSpacing: 2.5,
                    color: '#3a2f24',
                  }}
                >
                  CANCEL
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                disabled={!canConfirm}
                style={{
                  flex: 2.2,
                  paddingVertical: 22,
                  borderRadius: 4,
                  backgroundColor: canConfirm ? '#d23a1a' : 'rgba(210, 58, 26, 0.45)',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: F.monoSemibold,
                    fontSize: 14,
                    letterSpacing: 3,
                    color: '#f4ede0',
                  }}
                >
                  CONFIRM CHARGE
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

/* ─── Cash body ─────────────────────────────────────────────────── */

function CashBody({
  tenderedCentavos,
  totalCentavos,
  change,
  onDigit,
  onBackspace,
  onClear,
  onExact,
  onQuick,
}: {
  tenderedCentavos: number;
  totalCentavos: number;
  change: number;
  onDigit: (d: number) => void;
  onBackspace: () => void;
  onClear: () => void;
  onExact: () => void;
  onQuick: (c: number) => void;
}) {
  const sufficient = tenderedCentavos >= totalCentavos;
  const short = totalCentavos - tenderedCentavos;

  return (
    <View className="flex-row" style={{ gap: 24 }}>
      <View style={{ flex: 1, gap: 18 }}>
        <View>
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: 2.2,
              color: '#7a6a55',
              marginBottom: 10,
            }}
          >
            TENDERED
          </Text>
          <View
            style={{
              borderWidth: 1.5,
              borderColor: '#1a1410',
              borderRadius: 4,
              paddingHorizontal: 22,
              paddingVertical: 18,
              backgroundColor: 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              style={{
                textAlign: 'right',
                fontFamily: F.serifMedium,
                fontSize: 38,
                color: tenderedCentavos === 0 ? '#b3a48c' : '#1a1410',
                letterSpacing: -0.6,
                ...TNUM,
              }}
            >
              {formatPeso(tenderedCentavos)}
            </Text>
          </View>
        </View>

        <View>
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 10,
              letterSpacing: 2,
              color: '#7a6a55',
              marginBottom: 8,
            }}
          >
            QUICK
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <QuickPill label="EXACT" onPress={onExact} primary />
            {QUICK_AMOUNTS.map((c) => (
              <QuickPill
                key={c}
                label={formatPesoNoSymbol(c)}
                onPress={() => onQuick(c)}
              />
            ))}
          </View>
        </View>

        <View
          className="flex-row items-baseline justify-between"
          style={{
            paddingVertical: 18,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'rgba(26, 20, 16, 0.12)',
          }}
        >
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: 2.5,
              color: '#7a6a55',
            }}
          >
            {sufficient ? 'CHANGE' : 'SHORT'}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={{
              fontFamily: F.serifMedium,
              fontSize: 36,
              color: sufficient ? '#4a6b3a' : '#a02b10',
              letterSpacing: -0.6,
              ...TNUM,
            }}
          >
            {sufficient ? formatPeso(change) : formatPeso(short)}
          </Text>
        </View>
      </View>

      {/* Numpad */}
      <View style={{ width: 320, gap: 6 }}>
        <Row keys={['7', '8', '9']} onDigit={onDigit} />
        <Row keys={['4', '5', '6']} onDigit={onDigit} />
        <Row keys={['1', '2', '3']} onDigit={onDigit} />
        <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
          <Key label="CLR" onPress={onClear} ghost />
          <Key label="0" onPress={() => onDigit(0)} />
          <Key label="⌫" onPress={onBackspace} ghost />
        </View>
      </View>
    </View>
  );
}

function Row({ keys, onDigit }: { keys: string[]; onDigit: (d: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
      {keys.map((k) => (
        <Key key={k} label={k} onPress={() => onDigit(Number(k))} />
      ))}
    </View>
  );
}

function Key({
  label,
  onPress,
  ghost,
}: {
  label: string;
  onPress: () => void;
  ghost?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 60,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ghost ? '#ece1cc' : '#1a1410',
        borderRadius: 4,
      }}
    >
      <Text
        style={{
          fontFamily: F.monoSemibold,
          fontSize: 22,
          color: ghost ? '#1a1410' : '#f4ede0',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function QuickPill({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: primary ? '#1a1410' : 'rgba(26, 20, 16, 0.12)',
        backgroundColor: primary ? '#1a1410' : '#ece1cc',
      }}
    >
      <Text
        style={{
          fontFamily: F.monoSemibold,
          fontSize: 12,
          letterSpacing: 1.2,
          color: primary ? '#f4ede0' : '#1a1410',
          ...TNUM,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── Non-cash body ─────────────────────────────────────────────── */

function NonCashBody({
  method,
  reference,
  onChange,
}: {
  method: PaymentMethod;
  reference: string;
  onChange: (next: string) => void;
}) {
  return (
    <View>
      <Text
        style={{
          fontFamily: F.mono,
          fontSize: 11,
          letterSpacing: 2.2,
          color: '#7a6a55',
          marginBottom: 10,
        }}
      >
        REFERENCE (OPTIONAL)
      </Text>
      <TextInput
        value={reference}
        onChangeText={onChange}
        placeholder={`${method.toUpperCase()} REFERENCE / APPROVAL CODE`}
        placeholderTextColor="#b3a48c"
        autoCapitalize="characters"
        autoCorrect={false}
        style={{
          borderWidth: 1.5,
          borderColor: '#1a1410',
          borderRadius: 4,
          paddingHorizontal: 18,
          paddingVertical: 16,
          fontFamily: F.mono,
          fontSize: 16,
          letterSpacing: 0.8,
          color: '#1a1410',
        }}
      />
      <Text
        style={{
          marginTop: 14,
          fontFamily: F.serifItalic,
          fontSize: 14,
          color: '#7a6a55',
          lineHeight: 20,
        }}
      >
        Confirm the payment on the customer's app before charging. The reference
        number isn't required, but it's the easiest way to trace a disputed sale.
      </Text>
    </View>
  );
}
