import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { TAX_RATE } from '@/lib/tax';
import {
  buildReceiptBytes,
  getActiveAdapterKind,
  getPrintAdapter,
  mockPrintAdapter,
  setPrintAdapterOverride,
  TcpPrintAdapter,
  type AdapterKind,
  type PrintResult,
} from '@/print';
import type { MockPrintEntry } from '@/print/MockPrintAdapter';
import { useSettingsStore } from '@/state/settingsStore';
import type { Sale } from '@/types';

const STORE_NAME = 'POPCRAFT ARTS';

function buildSampleSale(): Sale {
  const id = `test-${Date.now()}`;
  // Mix of short and long names + a quantity > 1 line, so the printed
  // receipt exercises every formatting branch (line wrap, quantity row,
  // multiple renters).
  const lines = [
    {
      item_id: 'itm-1',
      item_code: 'R001-00000001',
      item_name: 'Demon Slayer keychain',
      renter_id: 'R001',
      quantity: 1,
      unit_price_centavos: 15000,
      line_total_centavos: 15000,
    },
    {
      item_id: 'itm-2',
      item_code: 'R001-00000002',
      item_name: 'Studio Ghibli poster (A2)',
      renter_id: 'R001',
      quantity: 2,
      unit_price_centavos: 35000,
      line_total_centavos: 70000,
    },
    {
      item_id: 'itm-3',
      item_code: 'R002-00000004',
      item_name: 'Hand-painted jeepney sign',
      renter_id: 'R002',
      quantity: 1,
      unit_price_centavos: 120000,
      line_total_centavos: 120000,
    },
    {
      item_id: 'itm-4',
      item_code: 'R003-00000001',
      item_name: 'Handmade pottery mug',
      renter_id: 'R003',
      quantity: 3,
      unit_price_centavos: 45000,
      line_total_centavos: 135000,
    },
  ];
  const subtotal = lines.reduce((n, l) => n + l.line_total_centavos, 0);
  const total = subtotal; // gross — tax-inclusive, no register-side tax addition
  const tax = Math.round((total * TAX_RATE) / (1 + TAX_RATE)); // embedded tax for reports
  const tendered = Math.ceil(total / 10000) * 10000 + 10000;
  return {
    id,
    cashier_id: 'C-MARIA',
    lines,
    subtotal_centavos: subtotal,
    tax_centavos: tax,
    total_centavos: total,
    payment_method: 'cash',
    amount_tendered_centavos: tendered,
    change_centavos: tendered - total,
    created_at: new Date().toISOString(),
    synced_at: null,
  };
}

function bytesToHex(bytes: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    out.push(bytes[i]!.toString(16).padStart(2, '0'));
    if ((i + 1) % 16 === 0) out.push('\n');
    else out.push(' ');
  }
  return out.join('').trim();
}

export function PrinterDebugScreen() {
  const [activeKind, setActiveKind] = useState<AdapterKind>(getActiveAdapterKind());
  const settingsHost = useSettingsStore((s) => s.printerHost);
  const settingsPort = useSettingsStore((s) => s.printerPort);
  const setPrinterHost = useSettingsStore((s) => s.setPrinterHost);
  const setPrinterPort = useSettingsStore((s) => s.setPrinterPort);
  const [host, setHost] = useState(settingsHost);
  const [port, setPort] = useState(String(settingsPort));
  const [lastResult, setLastResult] = useState<PrintResult | null>(null);
  const [history, setHistory] = useState<MockPrintEntry[]>(mockPrintAdapter.getHistory());
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const refreshHistory = useCallback(() => {
    setHistory(mockPrintAdapter.getHistory());
  }, []);

  const handlePrintTest = useCallback(async () => {
    const sale = buildSampleSale();
    const bytes = buildReceiptBytes(sale, STORE_NAME, {
      includeDrawerKick: sale.payment_method === 'cash',
    });
    const adapter = getPrintAdapter();
    const result = await adapter.print({
      bytes,
      openDrawer: sale.payment_method === 'cash',
      jobId: sale.id,
    });
    setLastResult(result);
    refreshHistory();
  }, [refreshHistory]);

  const handleToggleAdapter = useCallback(() => {
    if (activeKind === 'mock') {
      const portNum = Number.parseInt(port, 10);
      const resolvedPort = Number.isFinite(portNum) ? portNum : 9100;
      setPrinterHost(host);
      setPrinterPort(resolvedPort);
      setPrintAdapterOverride(new TcpPrintAdapter({ host, port: resolvedPort }));
      setActiveKind('tcp');
    } else {
      setPrintAdapterOverride(null);
      setActiveKind(getActiveAdapterKind());
    }
  }, [activeKind, host, port, setPrinterHost, setPrinterPort]);

  const handleClearHistory = useCallback(() => {
    mockPrintAdapter.clearHistory();
    refreshHistory();
  }, [refreshHistory]);

  const headerLabel = useMemo(
    () => (activeKind === 'mock' ? 'MOCK (console only)' : `TCP ${host}:${port}`),
    [activeKind, host, port],
  );

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="p-6">
      <Text className="text-2xl font-bold text-ink">Printer debug</Text>
      <Text className="mt-1 text-base text-ink-muted">
        Active adapter: <Text className="font-semibold text-ink">{headerLabel}</Text>
      </Text>

      <View className="mt-4 rounded-md bg-paper-warm p-4">
        <Text className="text-sm font-semibold text-ink">Host</Text>
        <TextInput
          value={host}
          onChangeText={setHost}
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-1 rounded border border-ink-muted bg-paper px-3 py-2 text-base text-ink"
        />
        <Text className="mt-3 text-sm font-semibold text-ink">Port</Text>
        <TextInput
          value={port}
          onChangeText={setPort}
          keyboardType="number-pad"
          className="mt-1 rounded border border-ink-muted bg-paper px-3 py-2 text-base text-ink"
        />
        <Text className="mt-2 text-xs text-ink-muted">
          Changes take effect when you toggle the adapter.
        </Text>
      </View>

      <View className="mt-4 flex-row gap-3">
        <Pressable
          onPress={handlePrintTest}
          className="flex-1 rounded-md bg-accent px-4 py-3 active:opacity-80"
        >
          <Text className="text-center text-base font-semibold text-paper">
            Print test receipt
          </Text>
        </Pressable>
        <Pressable
          onPress={handleToggleAdapter}
          className="flex-1 rounded-md border border-ink px-4 py-3 active:opacity-70"
        >
          <Text className="text-center text-base font-semibold text-ink">
            Switch to {activeKind === 'mock' ? 'TCP' : 'Mock'}
          </Text>
        </Pressable>
      </View>

      {lastResult ? (
        <View className="mt-4 rounded-md bg-paper-warm p-3">
          <Text className="text-sm font-semibold text-ink">Last result</Text>
          <Text className="mt-1 text-sm text-ink-soft">
            {lastResult.success ? 'OK' : `FAIL: ${lastResult.error}`}{' '}
            ({lastResult.durationMs.toFixed(0)} ms)
          </Text>
        </View>
      ) : null}

      <View className="mt-6 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-ink">History (mock only)</Text>
        <Pressable
          onPress={handleClearHistory}
          className="rounded border border-ink-muted px-3 py-1 active:opacity-70"
        >
          <Text className="text-sm text-ink-soft">Clear</Text>
        </Pressable>
      </View>

      {history.length === 0 ? (
        <Text className="mt-2 text-sm text-ink-muted">No jobs yet.</Text>
      ) : (
        history.map((entry) => {
          const expanded = expandedJobId === entry.jobId;
          return (
            <View
              key={entry.jobId + entry.printedAt}
              className="mt-3 rounded-md bg-paper-warm p-3"
            >
              <Pressable
                onPress={() => setExpandedJobId(expanded ? null : entry.jobId)}
              >
                <Text className="text-sm font-semibold text-ink">
                  {entry.jobId}
                </Text>
                <Text className="text-xs text-ink-muted">
                  {entry.printedAt} ·{' '}
                  {entry.result.success ? 'OK' : `FAIL: ${entry.result.error}`} ·{' '}
                  {entry.result.durationMs.toFixed(0)} ms ·{' '}
                  {entry.bytes.length} bytes
                </Text>
              </Pressable>
              {expanded ? (
                <View className="mt-2">
                  <Text className="text-xs font-semibold text-ink">Preview</Text>
                  <ScrollView
                    horizontal
                    className="mt-1 rounded bg-ink p-2"
                    showsHorizontalScrollIndicator={false}
                  >
                    <Text
                      selectable
                      style={{
                        fontFamily: 'Courier',
                        color: '#f7f4ee',
                        fontSize: 11,
                      }}
                    >
                      {entry.preview}
                    </Text>
                  </ScrollView>
                  <Text className="mt-2 text-xs font-semibold text-ink">
                    Raw bytes
                  </Text>
                  <ScrollView
                    horizontal
                    className="mt-1 rounded bg-ink p-2"
                    showsHorizontalScrollIndicator={false}
                  >
                    <Text
                      selectable
                      style={{
                        fontFamily: 'Courier',
                        color: '#f7f4ee',
                        fontSize: 11,
                      }}
                    >
                      {bytesToHex(entry.bytes)}
                    </Text>
                  </ScrollView>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
