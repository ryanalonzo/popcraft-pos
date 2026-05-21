import { useEffect } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { F, TNUM } from '@/lib/fonts';
import { formatPeso } from '@/lib/money';
import type { Sale } from '@/types';

export type PrintingState =
  | { kind: 'idle' }
  | { kind: 'printing' }
  | { kind: 'success' }
  | { kind: 'failure'; error: string };

interface PrintingOverlayProps {
  state: PrintingState;
  /** Most recently completed sale — drives the receipt card on success. */
  sale: Sale | null;
  /** Display name for the cashier line on the receipt. */
  cashierName?: string;
  /** Store label printed at the top of the receipt card. */
  storeName?: string;
  /** Terminal label printed at the top of the receipt card. */
  terminalLabel?: string;
  onRetry: () => void;
  onSkip: () => void;
  onSuccessDismiss: () => void;
  successDelayMs?: number;
}

export function PrintingOverlay({
  state,
  sale,
  cashierName,
  storeName = 'POPCRAFT',
  terminalLabel = 'TERMINAL 01',
  onRetry,
  onSkip,
  onSuccessDismiss,
  successDelayMs = 2200,
}: PrintingOverlayProps) {
  useEffect(() => {
    if (state.kind !== 'success') return;
    const t = setTimeout(onSuccessDismiss, successDelayMs);
    return () => clearTimeout(t);
  }, [state.kind, successDelayMs, onSuccessDismiss]);

  const visible = state.kind !== 'idle';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: '#f4ede0',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}
      >
        {state.kind === 'printing' ? (
          <Printing />
        ) : state.kind === 'success' ? (
          <SuccessReceipt
            sale={sale}
            cashierName={cashierName}
            storeName={storeName}
            terminalLabel={terminalLabel}
          />
        ) : state.kind === 'failure' ? (
          <Failure error={state.error} onRetry={onRetry} onSkip={onSkip} />
        ) : null}
      </View>
    </Modal>
  );
}

function Printing() {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: '#1a1410',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 28,
        }}
      >
        <ActivityIndicator size="large" color="#f4ede0" />
      </View>
      <Text
        style={{
          fontFamily: F.mono,
          fontSize: 12,
          letterSpacing: 3,
          color: '#7a6a55',
          marginBottom: 10,
        }}
      >
        PROCESSING
      </Text>
      <Text
        style={{
          fontFamily: F.serifItalic,
          fontSize: 48,
          color: '#1a1410',
          letterSpacing: -0.8,
        }}
      >
        Printing receipt…
      </Text>
      <Text
        style={{
          marginTop: 14,
          fontFamily: F.serifItalic,
          fontSize: 18,
          color: '#7a6a55',
        }}
      >
        Opening the cash drawer.
      </Text>
    </View>
  );
}

function SuccessReceipt({
  sale,
  cashierName,
  storeName,
  terminalLabel,
}: {
  sale: Sale | null;
  cashierName?: string;
  storeName: string;
  terminalLabel: string;
}) {
  const paymentLabel = sale ? formatPaymentMethod(sale.payment_method) : 'CASH';
  const tendered =
    sale && sale.amount_tendered_centavos != null
      ? formatPeso(sale.amount_tendered_centavos)
      : null;
  const change =
    sale && sale.change_centavos != null
      ? formatPeso(sale.change_centavos)
      : null;
  const itemCount = sale
    ? sale.lines.reduce((n, l) => n + l.quantity, 0)
    : 0;
  const itemNoun = itemCount === 1 ? 'item' : 'items';
  const total = sale ? formatPeso(sale.total_centavos) : '₱0.00';
  const receiptNo = sale ? truncateId(sale.id) : '—';
  const soldAt = sale ? new Date(sale.created_at) : new Date();

  return (
    <View
      style={{
        width: 380,
        backgroundColor: '#fbf6ea',
        borderWidth: 1,
        borderColor: 'rgba(26, 20, 16, 0.18)',
        paddingHorizontal: 32,
        paddingVertical: 36,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header — mono chrome, deckled top edge. */}
      <Text style={chromeStyle}>{storeName} · {terminalLabel}</Text>
      <Text style={[chromeStyle, { marginTop: 4, opacity: 0.6 }]}>
        EST. 2026 — MANILA
      </Text>

      <Dashes />

      {/* Receipt meta */}
      <Text style={metaMonoStyle}>{receiptNo}</Text>
      <Text style={metaItalicStyle}>{formatSoldAt(soldAt)}</Text>
      {cashierName ? (
        <Text style={[metaItalicStyle, { color: '#7a6a55', fontSize: 13, marginTop: 2 }]}>
          {cashierName}
        </Text>
      ) : null}

      {/* PAID stamp — rotated, semi-transparent, in red */}
      <View
        style={{
          marginTop: 28,
          marginBottom: 28,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            transform: [{ rotate: '-8deg' }],
            borderWidth: 4,
            borderColor: 'rgba(210, 58, 26, 0.55)',
            paddingHorizontal: 28,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              fontFamily: F.serifBoldItalic,
              fontSize: 68,
              lineHeight: 72,
              letterSpacing: 4,
              color: 'rgba(210, 58, 26, 0.7)',
            }}
          >
            PAID
          </Text>
        </View>
      </View>

      <Dashes />

      {/* Totals block — Fraunces tabular for monetary alignment */}
      <View style={{ marginTop: 18, gap: 4 }}>
        <Row
          left={`${itemCount} ${itemNoun}`}
          right={total}
          rightSize={26}
          rightWeight="bold"
        />
        <Row
          left={paymentLabel}
          right={tendered ?? total}
          rightSize={16}
          dim
        />
        {change ? (
          <Row
            left="Change"
            right={change}
            rightSize={16}
            dim
          />
        ) : null}
      </View>

      <Dashes />

      <Text
        style={[
          chromeStyle,
          { textAlign: 'center', marginTop: 8, opacity: 0.7 },
        ]}
      >
        READY · SCAN NEXT
      </Text>
    </View>
  );
}

function Row({
  left,
  right,
  rightSize,
  rightWeight = 'regular',
  dim = false,
}: {
  left: string;
  right: string;
  rightSize: number;
  rightWeight?: 'regular' | 'bold';
  dim?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text
        style={{
          fontFamily: F.serifItalic,
          fontSize: 16,
          color: dim ? '#7a6a55' : '#1a1410',
        }}
      >
        {left}
      </Text>
      <Text
        style={[
          {
            fontFamily: rightWeight === 'bold' ? F.serifBold : F.serif,
            fontSize: rightSize,
            color: dim ? '#7a6a55' : '#1a1410',
          },
          TNUM,
        ]}
      >
        {right}
      </Text>
    </View>
  );
}

function Dashes() {
  return (
    <View
      style={{
        marginTop: 14,
        marginBottom: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(26, 20, 16, 0.18)',
        borderStyle: 'dashed',
      }}
    />
  );
}

function truncateId(id: string): string {
  // POS-side ids are uuids; the server assigns the canonical receipt_no on
  // ack but we show a friendly short id here for visual confirmation.
  const head = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `POS-${head}`;
}

function formatSoldAt(d: Date): string {
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  const hh = ((d.getHours() + 11) % 12) + 1;
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() < 12 ? 'am' : 'pm';
  return `${weekday} · ${month} ${day} · ${hh}:${mm} ${ampm}`;
}

function formatPaymentMethod(method: Sale['payment_method']): string {
  switch (method) {
    case 'cash': return 'Cash';
    case 'gcash': return 'GCash';
    case 'maya': return 'Maya';
    case 'card': return 'Card';
  }
}

const chromeStyle = {
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: 1.8,
  color: '#7a6a55',
  textAlign: 'center' as const,
};

const metaMonoStyle = {
  fontFamily: F.mono,
  fontSize: 13,
  letterSpacing: 1.4,
  color: '#1a1410',
  textAlign: 'center' as const,
  marginTop: 4,
};

const metaItalicStyle = {
  fontFamily: F.serifItalic,
  fontSize: 15,
  color: '#3a2f24',
  textAlign: 'center' as const,
  marginTop: 4,
};

function Failure({
  error,
  onRetry,
  onSkip,
}: {
  error: string;
  onRetry: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', maxWidth: 560 }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: '#a02b10',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 28,
        }}
      >
        <Text
          style={{
            fontFamily: F.serifBold,
            fontSize: 52,
            color: '#f4ede0',
            lineHeight: 56,
          }}
        >
          ✕
        </Text>
      </View>
      <Text
        style={{
          fontFamily: F.mono,
          fontSize: 12,
          letterSpacing: 3,
          color: '#7a6a55',
          marginBottom: 10,
        }}
      >
        PRINTER FAULT
      </Text>
      <Text
        style={{
          fontFamily: F.serifItalic,
          fontSize: 44,
          color: '#1a1410',
          letterSpacing: -0.6,
          textAlign: 'center',
        }}
      >
        Receipt didn't print.
      </Text>
      <Text
        style={{
          marginTop: 12,
          fontFamily: F.mono,
          fontSize: 11,
          letterSpacing: 1.4,
          color: '#7a6a55',
          textAlign: 'center',
        }}
      >
        {error.toUpperCase()}
      </Text>

      <View style={{ flexDirection: 'row', gap: 14, marginTop: 28 }}>
        <Pressable
          onPress={onSkip}
          style={{
            paddingHorizontal: 32,
            paddingVertical: 18,
            borderRadius: 4,
            borderWidth: 1.5,
            borderColor: '#1a1410',
          }}
        >
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 12,
              letterSpacing: 2.5,
              color: '#1a1410',
            }}
          >
            SKIP
          </Text>
        </Pressable>
        <Pressable
          onPress={onRetry}
          style={{
            paddingHorizontal: 32,
            paddingVertical: 18,
            borderRadius: 4,
            backgroundColor: '#d23a1a',
          }}
        >
          <Text
            style={{
              fontFamily: F.monoSemibold,
              fontSize: 12,
              letterSpacing: 3,
              color: '#f4ede0',
            }}
          >
            RETRY PRINT
          </Text>
        </Pressable>
      </View>
      <Text
        style={{
          marginTop: 18,
          fontFamily: F.serifItalic,
          fontSize: 14,
          color: '#7a6a55',
        }}
      >
        Skip records the sale without a receipt — reprint from the sale detail.
      </Text>
    </View>
  );
}
