import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { F, TNUM } from '@/lib/fonts';
import { formatPeso } from '@/lib/money';
import { useAuthStore } from '@/state/authStore';
import {
  useTodaysSaleCount,
  useTodaysRevenue,
  useTodaysSales,
} from '@/state/saleStore';
import type { Sale } from '@/types';

export function CashierHomeScreen() {
  const cashier = useAuthStore((s) => s.cashier);

  const salesCount = useTodaysSaleCount();
  const revenue = useTodaysRevenue();
  const todays = useTodaysSales();
  const recent = todays.slice(0, 8);

  const itemsCount = useMemo(
    () => todays.reduce((n, s) => n + s.lines.reduce((m, l) => m + l.quantity, 0), 0),
    [todays],
  );
  const avgTicket = salesCount > 0 ? Math.round(revenue / salesCount) : 0;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const firstName = (cashier?.name ?? 'cashier').split(' ')[0] ?? 'cashier';

  return (
    <View className="flex-1 flex-row">
      {/* Main editorial column.
       * Two-region layout so the primary CTA is anchored to the bottom
       * of the viewport — header + KPIs scroll when the screen is
       * shorter than the content, but "Open cart" is always visible
       * without scrolling. */}
      <View style={{ flex: 1.5 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 56, paddingTop: 48, paddingBottom: 24 }}
      >
        <View
          className="flex-row items-baseline justify-between"
          style={{ marginBottom: 4 }}
        >
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: 2.2,
              color: '#7a6a55',
            }}
          >
            {formatDateMono(now)}
          </Text>
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: 2.2,
              color: '#7a6a55',
              ...TNUM,
            }}
          >
            {formatClock(now)}
          </Text>
        </View>

        <Text
          style={{
            fontFamily: F.heading,
            fontSize: 52,
            color: '#1a1410',
            lineHeight: 68,
            letterSpacing: -0.8,
            paddingBottom: 6,
          }}
        >
          {greetingPrefix(now)},{' '}
          <Text
            style={{
              fontFamily: F.headingSemibold,
              color: '#d23a1a',
            }}
          >
            {firstName}
          </Text>
          .
        </Text>
        <Text
          style={{
            marginTop: 6,
            fontFamily: F.serifItalic,
            fontSize: 18,
            color: '#7a6a55',
          }}
        >
          {greetingTagline(salesCount)}
        </Text>

        {/* Stat rails — each row spans full width so footer captions don't truncate. */}
        <View style={{ marginTop: 40, gap: 12 }}>
          <Stat
            label="SALES TODAY"
            big={String(salesCount)}
            delta={
              itemsCount > 0
                ? `▲ ${itemsCount} ${itemsCount === 1 ? 'item' : 'items'} since open`
                : 'awaiting first sale'
            }
          />
          <Stat
            label="REVENUE"
            big={pesoSplit(revenue).int}
            small={`.${pesoSplit(revenue).dec}`}
            delta="PHP · since open"
          />
          <Stat
            label="AVG TICKET"
            big={avgTicket > 0 ? pesoSplit(avgTicket).int : '—'}
            small={avgTicket > 0 ? `.${pesoSplit(avgTicket).dec}` : undefined}
            delta={
              avgTicket > 0
                ? `${salesCount} ${salesCount === 1 ? 'sale' : 'sales'}`
                : 'no sales yet'
            }
          />
        </View>

      </ScrollView>

      {/* Pinned primary CTA — always visible at the bottom of the
       * left column. Lives outside the ScrollView so it doesn't get
       * pushed under the system bar when the content above is tall. */}
      <View
        style={{
          paddingHorizontal: 56,
          paddingTop: 12,
          paddingBottom: 24,
          borderTopWidth: 1,
          borderTopColor: 'rgba(26, 20, 16, 0.06)',
        }}
      >
        <Pressable
          onPress={() => router.push('/(cashier)/cart')}
          android_ripple={{ color: 'rgba(244, 237, 224, 0.18)' }}
          style={{
            backgroundColor: '#1a1410',
            borderRadius: 6,
            paddingHorizontal: 36,
            paddingVertical: 22,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: 2.5,
              color: 'rgba(244, 237, 224, 0.7)',
              marginBottom: 6,
            }}
          >
            START A NEW SALE
          </Text>
          <Text
            style={{
              fontFamily: F.headingSemibold,
              fontSize: 30,
              lineHeight: 36,
              color: '#f4ede0',
              letterSpacing: -0.4,
            }}
          >
            Open cart
          </Text>
        </Pressable>
      </View>
      </View>

      {/* Recent sales side */}
      <View
        style={{
          flex: 1,
          backgroundColor: '#ece1cc',
          borderLeftWidth: 1,
          borderColor: 'rgba(26, 20, 16, 0.12)',
        }}
      >
        <View style={{ paddingHorizontal: 36, paddingVertical: 40 }}>
          <View
            className="flex-row items-baseline justify-between"
            style={{ marginBottom: 24 }}
          >
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                letterSpacing: 2.2,
                color: '#7a6a55',
              }}
            >
              RECENT SALES
            </Text>
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 1.6,
                color: '#7a6a55',
              }}
            >
              {recent.length} OF {todays.length}
            </Text>
          </View>

          {recent.length === 0 ? (
            <Text
              style={{
                fontFamily: F.serifItalic,
                fontSize: 17,
                color: '#7a6a55',
                lineHeight: 26,
              }}
            >
              No sales yet today.{'\n'}Tap{' '}
              <Text style={{ color: '#1a1410' }}>Open cart</Text> to begin.
            </Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {recent.map((sale) => (
                <RecentItem key={sale.id} sale={sale} />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

function Stat({
  label,
  big,
  small,
  delta,
}: {
  label: string;
  big: string;
  small?: string;
  delta?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255, 248, 235, 0.6)',
        borderWidth: 1,
        borderColor: 'rgba(26, 20, 16, 0.12)',
        paddingHorizontal: 24,
        paddingVertical: 18,
      }}
    >
      {/* Top rail: mono label on the left, big serif value on the right */}
      <View
        className="flex-row items-baseline justify-between"
        style={{ gap: 16 }}
      >
        <Text
          style={{
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: 2.2,
            color: '#7a6a55',
          }}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: F.serif,
            fontSize: 32,
            lineHeight: 38,
            color: '#1a1410',
            letterSpacing: -0.4,
            ...TNUM,
          }}
        >
          {big}
          {small ? (
            <Text
              style={{
                fontFamily: F.serif,
                fontSize: 16,
                color: '#7a6a55',
                letterSpacing: 0,
              }}
            >
              {small}
            </Text>
          ) : null}
        </Text>
      </View>
      {/* Caption fills the full width — no truncation. */}
      {delta ? (
        <Text
          style={{
            marginTop: 6,
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 1.4,
            color: '#4a6b3a',
          }}
        >
          {delta.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

function RecentItem({ sale }: { sale: Sale }) {
  const items = sale.lines.reduce((n, l) => n + l.quantity, 0);
  const synced = sale.synced_at !== null;
  return (
    <Pressable
      onPress={() => router.push(`/(cashier)/sale/${sale.id}` as never)}
      className="flex-row items-center justify-between"
      style={{
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderColor: 'rgba(26, 20, 16, 0.12)',
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 1.8,
            color: '#7a6a55',
            marginBottom: 4,
          }}
          numberOfLines={1}
        >
          {formatClock(new Date(sale.created_at))} ·{' '}
          {sale.payment_method.toUpperCase()} · {synced ? 'SYNCED' : 'QUEUED'}
        </Text>
        <Text
          style={{
            fontFamily: F.serif,
            fontSize: 16,
            color: '#1a1410',
          }}
          numberOfLines={1}
        >
          {items} {items === 1 ? 'item' : 'items'}
          {sale.lines[0] ? ` · ${sale.lines[0].item_name}` : ''}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={{
          fontFamily: F.serifMedium,
          fontSize: 18,
          color: '#1a1410',
          letterSpacing: -0.2,
          minWidth: 90,
          textAlign: 'right',
          ...TNUM,
        }}
      >
        {formatPeso(sale.total_centavos)}
      </Text>
    </Pressable>
  );
}

function greetingPrefix(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function greetingTagline(salesCount: number): string {
  if (salesCount === 0) return 'A fresh ledger awaits.';
  if (salesCount === 1) return 'One sale already on the books.';
  return `${salesCount} sales today. Keep going.`;
}

function formatClock(d: Date): string {
  return d
    .toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    .toUpperCase();
}

function formatDateMono(d: Date): string {
  return d
    .toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();
}

function pesoSplit(centavos: number): { int: string; dec: string } {
  const pesos = (centavos / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const idx = pesos.lastIndexOf('.');
  if (idx === -1) return { int: pesos, dec: '00' };
  return { int: pesos.slice(0, idx), dec: pesos.slice(idx + 1) };
}
