import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { F, TNUM } from '@/lib/fonts';
import { formatPeso } from '@/lib/money';
import {
  buildReceiptBytes,
  decodeReceipt,
  getPrintAdapter,
} from '@/print';
import { mockPrintAdapter } from '@/print/MockPrintAdapter';
import { useAuthStore } from '@/state/authStore';
import { useSaleStore } from '@/state/saleStore';

const STORE_NAME = 'POPCRAFT ARTS';

interface SaleDetailScreenProps {
  saleId: string;
}

export function SaleDetailScreen({ saleId }: SaleDetailScreenProps) {
  const sale = useSaleStore((s) => s.getSaleById(saleId));
  const cashier = useAuthStore((s) => s.cashier);

  const [reprintStatus, setReprintStatus] = useState<'idle' | 'printing' | 'ok' | 'failed'>(
    'idle',
  );
  const [reprintError, setReprintError] = useState<string | null>(null);

  const receiptText = useMemo(() => {
    if (!sale) return '';
    const cached = mockPrintAdapter.getEntryByJobId(sale.id);
    if (cached) return decodeReceipt(cached.bytes).text;
    const bytes = buildReceiptBytes(sale, STORE_NAME, {
      includeDrawerKick: false,
      cashierName: cashier?.name,
    });
    return decodeReceipt(bytes).text;
  }, [sale, cashier?.name]);

  const handleReprint = useCallback(async () => {
    if (!sale) return;
    setReprintStatus('printing');
    setReprintError(null);
    const bytes = buildReceiptBytes(sale, STORE_NAME, {
      includeDrawerKick: false,
      cashierName: cashier?.name,
    });
    const result = await getPrintAdapter().print({
      bytes,
      openDrawer: false,
      jobId: `${sale.id}-reprint-${Date.now()}`,
    });
    if (result.success) {
      setReprintStatus('ok');
    } else {
      setReprintStatus('failed');
      setReprintError(result.error ?? 'Unknown printer error');
    }
  }, [sale, cashier?.name]);

  if (!sale) {
    return (
      <View className="flex-1 items-center justify-center" style={{ padding: 32 }}>
        <Text
          style={{
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: 2,
            color: '#7a6a55',
            marginBottom: 8,
          }}
        >
          RECEIPT NOT FOUND
        </Text>
        <Text
          style={{
            fontFamily: F.serifItalic,
            fontSize: 28,
            color: '#1a1410',
            letterSpacing: -0.4,
          }}
        >
          Sale not in this session.
        </Text>
        <Pressable
          onPress={() => router.replace('/(cashier)')}
          style={{
            marginTop: 24,
            paddingHorizontal: 28,
            paddingVertical: 14,
            backgroundColor: '#1a1410',
            borderRadius: 4,
          }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: '#f4ede0' }}>
            BACK TO HOME
          </Text>
        </Pressable>
      </View>
    );
  }

  const created = new Date(sale.created_at);
  const itemCount = sale.lines.reduce((n, l) => n + l.quantity, 0);
  const synced = sale.synced_at !== null;
  const discount = sale.subtotal_centavos - sale.total_centavos;

  return (
    <View className="flex-1 flex-row">
      {/* Left: details */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 56, paddingVertical: 48 }}
      >
        <View
          className="flex-row items-baseline justify-between"
          style={{ marginBottom: 16 }}
        >
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: 2.2,
              color: '#7a6a55',
            }}
          >
            <Text style={{ color: '#d23a1a' }} onPress={() => router.back()}>
              CASHIER
            </Text>
            {'  ›  RECEIPT'}
          </Text>
          <Pressable onPress={() => router.back()}>
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                letterSpacing: 2,
                color: '#1a1410',
              }}
            >
              ← BACK
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            fontFamily: F.serifMedium,
            fontSize: 52,
            color: '#1a1410',
            letterSpacing: -0.8,
            lineHeight: 56,
          }}
          numberOfLines={1}
        >
          {sale.id.slice(0, 8)}
          <Text style={{ fontFamily: F.serifItalic, color: '#7a6a55' }}>…</Text>
        </Text>
        <Text
          style={{
            marginTop: 6,
            fontFamily: F.mono,
            fontSize: 13,
            letterSpacing: 2,
            color: '#7a6a55',
          }}
        >
          {formatLongDate(created)} · {formatClock(created)}
        </Text>

        {/* Info grid */}
        <View
          className="flex-row"
          style={{
            marginTop: 36,
            paddingVertical: 22,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'rgba(26, 20, 16, 0.12)',
            gap: 28,
          }}
        >
          <Info label="CASHIER" value={cashier?.name ?? sale.cashier_id} />
          <Info label="ITEMS" value={String(itemCount)} />
          <Info label="METHOD" value={sale.payment_method.toUpperCase()} accent />
          <Info
            label="SYNC"
            value={
              synced
                ? `SYNCED · ${formatClock(new Date(sale.synced_at!))}`
                : 'QUEUED · OFFLINE'
            }
            tone={synced ? 'green' : 'gold'}
          />
        </View>

        {/* Line items table */}
        <View style={{ marginTop: 28 }}>
          <View
            className="flex-row"
            style={{
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderColor: '#1a1410',
              gap: 16,
            }}
          >
            <Th flex={1}>ITEM</Th>
            <Th width={60} right>QTY</Th>
            <Th width={100} right>PRICE</Th>
            <Th width={100} right>TOTAL</Th>
          </View>
          {sale.lines.map((line, i) => (
            <View
              key={`${line.item_id}-${i}`}
              className="flex-row items-baseline"
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderColor: 'rgba(26, 20, 16, 0.12)',
                gap: 16,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.serif, fontSize: 17, color: '#1a1410' }} numberOfLines={1}>
                  {line.item_name}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: F.mono,
                    fontSize: 10,
                    letterSpacing: 0.7,
                    color: '#d23a1a',
                  }}
                >
                  {line.item_code}
                </Text>
              </View>
              <NumCell width={60}>{line.quantity}</NumCell>
              <NumCell width={100}>{formatPeso(line.unit_price_centavos)}</NumCell>
              <NumCell width={100} bold>{formatPeso(line.line_total_centavos)}</NumCell>
            </View>
          ))}

          {/* Totals (right-aligned, max 380) */}
          <View style={{ marginLeft: 'auto', maxWidth: 420, marginTop: 24 }}>
            <Row label="SUBTOTAL" value={formatPeso(sale.subtotal_centavos)} />
            {discount > 0 ? (
              <Row label="DISCOUNT" value={`− ${formatPeso(discount)}`} />
            ) : null}
            <View
              className="flex-row items-baseline justify-between"
              style={{
                marginTop: 12,
                paddingTop: 16,
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
                TOTAL
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                style={{
                  fontFamily: F.serifMedium,
                  fontSize: 36,
                  color: '#1a1410',
                  letterSpacing: -0.6,
                  ...TNUM,
                }}
              >
                {formatPeso(sale.total_centavos)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Right: paper receipt */}
      <View
        style={{
          width: 480,
          backgroundColor: '#ece1cc',
          borderLeftWidth: 1,
          borderColor: 'rgba(26, 20, 16, 0.12)',
          paddingHorizontal: 40,
          paddingVertical: 48,
        }}
      >
        <Text
          style={{
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 2.2,
            color: '#7a6a55',
            marginBottom: 16,
          }}
        >
          THERMAL PREVIEW
        </Text>

        <View
          style={{
            backgroundColor: '#fefcf7',
            paddingHorizontal: 24,
            paddingVertical: 28,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 24,
          }}
        >
          <Text
            selectable
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              lineHeight: 17,
              color: '#1a1410',
            }}
          >
            {receiptText}
          </Text>
        </View>

        <View style={{ marginTop: 22, gap: 10 }}>
          <Pressable
            onPress={handleReprint}
            disabled={reprintStatus === 'printing'}
            style={{
              paddingVertical: 18,
              backgroundColor: reprintStatus === 'printing' ? 'rgba(26, 20, 16, 0.4)' : '#1a1410',
              borderRadius: 4,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: F.monoSemibold,
                fontSize: 12,
                letterSpacing: 2.5,
                color: '#f4ede0',
              }}
            >
              {reprintStatus === 'printing' ? 'REPRINTING…' : 'REPRINT'}
            </Text>
          </Pressable>
          {reprintStatus === 'ok' ? (
            <Text
              style={{
                textAlign: 'center',
                fontFamily: F.serifItalic,
                fontSize: 14,
                color: '#4a6b3a',
              }}
            >
              Reprint sent to the printer.
            </Text>
          ) : null}
          {reprintStatus === 'failed' ? (
            <Text
              style={{
                textAlign: 'center',
                fontFamily: F.serifItalic,
                fontSize: 14,
                color: '#a02b10',
              }}
            >
              {reprintError}
            </Text>
          ) : null}
          <Text
            style={{
              textAlign: 'center',
              fontFamily: F.mono,
              fontSize: 9,
              letterSpacing: 1.6,
              color: '#7a6a55',
            }}
          >
            REPRINTS DON'T RE-OPEN THE DRAWER
          </Text>
        </View>
      </View>
    </View>
  );
}

function Info({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: 'green' | 'gold';
}) {
  const color =
    tone === 'green' ? '#4a6b3a' : tone === 'gold' ? '#b8893d' : accent ? '#d23a1a' : '#1a1410';
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 2,
          color: '#7a6a55',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: accent || tone ? F.monoSemibold : F.serif,
          fontSize: accent || tone ? 13 : 16,
          letterSpacing: accent || tone ? 1.5 : -0.1,
          color,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function Th({
  children,
  width,
  flex,
  right,
}: {
  children: React.ReactNode;
  width?: number;
  flex?: number;
  right?: boolean;
}) {
  return (
    <Text
      style={{
        width,
        flex,
        textAlign: right ? 'right' : 'left',
        fontFamily: F.mono,
        fontSize: 10,
        letterSpacing: 2,
        color: '#7a6a55',
      }}
    >
      {children}
    </Text>
  );
}

function NumCell({
  children,
  width,
  bold,
}: {
  children: React.ReactNode;
  width: number;
  bold?: boolean;
}) {
  return (
    <Text
      style={{
        width,
        textAlign: 'right',
        fontFamily: bold ? F.monoSemibold : F.mono,
        fontSize: 13,
        color: '#1a1410',
        ...TNUM,
      }}
    >
      {children}
    </Text>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-row items-baseline justify-between"
      style={{ paddingVertical: 8 }}
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
          fontSize: 18,
          color: '#1a1410',
          letterSpacing: -0.2,
          ...TNUM,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function formatClock(d: Date): string {
  return d
    .toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    .toUpperCase();
}

function formatLongDate(d: Date): string {
  return d
    .toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();
}
