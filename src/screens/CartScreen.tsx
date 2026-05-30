import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { submitSale } from '@/api/sales';
import { getItemByCode } from '@/api/catalog';
import { CartLineItem } from '@/components/CartLineItem';
import { CartSummary } from '@/components/CartSummary';
import { PaymentSheet } from '@/components/PaymentSheet';
import { PrintingOverlay, type PrintingState } from '@/components/PrintingOverlay';
import { ScannerInput } from '@/components/ScannerInput';
import { focusScanner, pauseScanner, useScannerInput } from '@/hooks/useScannerInput';
import { refreshPendingCount } from '@/hooks/useSyncWorker';
import { F, TNUM } from '@/lib/fonts';
import { isValidItemCode } from '@/lib/itemCode';
import { buildSaleFromCart } from '@/lib/saleBuilder';
import { buildReceiptBytes, getPrintAdapter } from '@/print';
import { useAuthStore } from '@/state/authStore';
import {
  useCartIsEmpty,
  useCartItemCount,
  useCartLines,
  useCartStore,
  useCartTotal,
} from '@/state/cartStore';
import { useSaleStore } from '@/state/saleStore';
import type { PaymentMethod, Sale } from '@/types';

type ToastTone = 'success' | 'warn' | 'error';
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

const TOAST_DURATION_MS = 2000;
const STORE_NAME = 'POPCRAFT ARTS';

export function CartScreen() {
  const lines = useCartLines();
  const isEmpty = useCartIsEmpty();
  const totalCentavos = useCartTotal();
  const itemCount = useCartItemCount();
  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const cashier = useAuthStore((s) => s.cashier);
  const recordSale = useSaleStore((s) => s.recordSale);
  const markSynced = useSaleStore((s) => s.markSynced);

  const { lastScannedCode, setOnScan } = useScannerInput();

  // Toasts
  const [toast, setToast] = useState<Toast | null>(null);
  const toastSeq = useRef(0);
  const showToast = useCallback((tone: ToastTone, message: string) => {
    const id = ++toastSeq.current;
    setToast({ id, tone, message });
    setTimeout(() => {
      setToast((cur) => (cur && cur.id === id ? null : cur));
    }, TOAST_DURATION_MS);
  }, []);

  // Second-layer dedupe for the qty-2 scan bug. The bus-level
  // emitScan dedupe has a 1s window; on slow scanners or under JS
  // thread lag the gap drifts above 1s and a duplicate gets through.
  // This belt-and-suspenders guard at the cart-add layer drops a
  // repeat of the same item within 1500 ms.
  const lastAddRef = useRef<{ code: string; at: number } | null>(null);

  // Lookup (shared between scanner + manual)
  const lookupAndAdd = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return;
      if (!isValidItemCode(code)) {
        showToast('error', `INVALID BARCODE · ${code}`);
        return;
      }
      const item = await getItemByCode(code);
      if (!item) {
        showToast('warn', `NOT IN CATALOG · ${code}`);
        return;
      }

      const now = Date.now();
      const last = lastAddRef.current;
      if (last && last.code === code && now - last.at < 1500) {
        // Same item added < 1.5 s ago — almost certainly a scanner
        // double-fire that the bus-level dedupe missed. Suppress.
        return;
      }
      lastAddRef.current = { code, at: now };

      addItem(item);
      showToast('success', `ADDED · ${item.name.toUpperCase()}`);
    },
    [addItem, showToast],
  );

  useEffect(() => {
    setOnScan(lookupAndAdd);
    return () => setOnScan(null);
  }, [setOnScan, lookupAndAdd]);

  // Manual entry
  const [manualCode, setManualCode] = useState('');
  const manualPauseReleaseRef = useRef<(() => void) | null>(null);
  const handleManualFocus = () => {
    if (!manualPauseReleaseRef.current) {
      manualPauseReleaseRef.current = pauseScanner();
    }
  };
  const handleManualBlur = () => {
    manualPauseReleaseRef.current?.();
    manualPauseReleaseRef.current = null;
  };
  useEffect(() => () => manualPauseReleaseRef.current?.(), []);
  const submitManual = () => {
    if (!manualCode.trim()) return;
    lookupAndAdd(manualCode);
    setManualCode('');
    // Tapping "Add" leaves the manual field focused, so its scanner pause
    // stays active and the next scan would land here. Release the pause and
    // hand focus back to the hidden scanner.
    manualPauseReleaseRef.current?.();
    manualPauseReleaseRef.current = null;
    focusScanner();
  };

  // Clear cart
  const confirmClear = useCallback(() => {
    if (isEmpty) return;
    Alert.alert('Clear cart?', 'This removes every line from the cart.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearCart() },
    ]);
  }, [isEmpty, clearCart]);

  // Checkout
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [printingState, setPrintingState] = useState<PrintingState>({ kind: 'idle' });
  const lastSaleRef = useRef<Sale | null>(null);
  const lastBytesRef = useRef<Uint8Array | null>(null);

  const handleCharge = () => {
    if (isEmpty || !cashier) return;
    setPaymentOpen(true);
  };

  const fireSubmit = (sale: Sale) => {
    submitSale(sale).then(async (result) => {
      if (result.status === 'synced') {
        markSynced(sale.id, new Date().toISOString());
      }
      await refreshPendingCount();
    });
  };

  const runPrint = async (sale: Sale, bytes: Uint8Array) => {
    setPrintingState({ kind: 'printing' });
    try {
      const result = await getPrintAdapter().print({
        bytes,
        openDrawer: sale.payment_method === 'cash',
        jobId: sale.id,
      });
      if (result.success) {
        setPrintingState({ kind: 'success' });
      } else {
        setPrintingState({
          kind: 'failure',
          error: result.error ?? 'Unknown printer error',
        });
      }
    } catch (err) {
      setPrintingState({
        kind: 'failure',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handlePaymentConfirm = async (input: {
    method: PaymentMethod;
    amountTendered: number | null;
    reference: string | null;
  }) => {
    if (!cashier) return;
    setPaymentOpen(false);

    const sale = buildSaleFromCart({
      cartLines: lines,
      paymentMethod: input.method,
      cashierId: cashier.id,
      amountTendered: input.amountTendered,
    });
    const bytes = buildReceiptBytes(sale, STORE_NAME, {
      includeDrawerKick: input.method === 'cash',
      cashierName: cashier.name,
    });
    lastSaleRef.current = sale;
    lastBytesRef.current = bytes;

    recordSale(sale);
    fireSubmit(sale);
    clearCart();
    await runPrint(sale, bytes);
  };

  const handleRetryPrint = async () => {
    const sale = lastSaleRef.current;
    const bytes = lastBytesRef.current;
    if (!sale || !bytes) return;
    await runPrint(sale, bytes);
  };
  const handleSkipPrint = () => setPrintingState({ kind: 'idle' });
  const handleSuccessDismiss = () => setPrintingState({ kind: 'idle' });

  return (
    <View className="flex-1 flex-row">
      {/* Main column */}
      <View style={{ flex: 1.6, paddingHorizontal: 40, paddingVertical: 32 }}>
        {/* Head */}
        <View
          className="flex-row items-baseline justify-between"
          style={{ marginBottom: 18 }}
        >
          <Text
            style={{
              fontFamily: F.heading,
              fontSize: 36,
              color: '#1a1410',
              letterSpacing: -0.6,
            }}
          >
            Cart
          </Text>
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: 2.2,
              color: '#7a6a55',
            }}
          >
            {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'} · {lines.length}{' '}
            {lines.length === 1 ? 'LINE' : 'LINES'}
          </Text>
        </View>

        {/* Scan bar */}
        <View
          className="flex-row items-center"
          style={{
            backgroundColor: '#1a1410',
            borderRadius: 4,
            paddingHorizontal: 20,
            paddingVertical: 14,
            gap: 16,
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: '#4a6b3a',
              shadowColor: '#4a6b3a',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.9,
              shadowRadius: 6,
            }}
          />
          <View>
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 2.5,
                color: 'rgba(244, 237, 224, 0.55)',
              }}
            >
              SCAN
            </Text>
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: F.monoSemibold,
              fontSize: 14,
              letterSpacing: 1.1,
              color: lastScannedCode ? '#f4ede0' : 'rgba(244, 237, 224, 0.4)',
              ...TNUM,
            }}
            numberOfLines={1}
          >
            {lastScannedCode
              ? formatScanCode(lastScannedCode)
              : 'READY · WAITING FOR SCAN'}
          </Text>
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 10,
              letterSpacing: 2,
              color: 'rgba(244, 237, 224, 0.45)',
            }}
          >
            HANDHELD READY
          </Text>
        </View>

        {/* Manual entry */}
        <View
          className="flex-row items-center"
          style={{ marginTop: 12, gap: 8 }}
        >
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 10,
              letterSpacing: 2,
              color: '#7a6a55',
              width: 110,
            }}
          >
            OR ENTER CODE
          </Text>
          <TextInput
            value={manualCode}
            onChangeText={setManualCode}
            onFocus={handleManualFocus}
            onBlur={handleManualBlur}
            onSubmitEditing={submitManual}
            placeholder="R001-00000001"
            placeholderTextColor="#b3a48c"
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              flex: 1,
              fontFamily: F.mono,
              fontSize: 13,
              letterSpacing: 0.8,
              color: '#1a1410',
              borderBottomWidth: 1,
              borderColor: 'rgba(26, 20, 16, 0.25)',
              paddingVertical: 8,
            }}
          />
          <Pressable
            onPress={submitManual}
            disabled={!manualCode.trim()}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              backgroundColor: manualCode.trim() ? '#1a1410' : 'rgba(26, 20, 16, 0.2)',
            }}
          >
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                letterSpacing: 2,
                color: '#f4ede0',
              }}
            >
              ADD
            </Text>
          </Pressable>
        </View>

        {/* Toast */}
        {toast ? <ToastView toast={toast} /> : null}

        {/* Lines */}
        <View style={{ flex: 1, marginTop: 24 }}>
          {isEmpty ? (
            <View
              className="flex-1 items-center justify-center"
              style={{ paddingBottom: 80 }}
            >
              <Text
                style={{
                  fontFamily: F.serifItalic,
                  fontSize: 26,
                  color: '#7a6a55',
                  letterSpacing: -0.2,
                }}
              >
                Scan an item to start.
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  fontFamily: F.mono,
                  fontSize: 10,
                  letterSpacing: 2,
                  color: '#b3a48c',
                }}
              >
                SCANNER ALWAYS LISTENING
              </Text>
            </View>
          ) : (
            <FlatList
              data={lines}
              keyExtractor={(line) => line.item.id}
              renderItem={({ item }) => <CartLineItem line={item} />}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </View>

      {/* Side panel */}
      <View
        style={{
          flex: 1,
          backgroundColor: '#ece1cc',
          borderLeftWidth: 1,
          borderColor: 'rgba(26, 20, 16, 0.12)',
          padding: 32,
        }}
      >
        <CartSummary />

        <Pressable
          onPress={handleCharge}
          disabled={isEmpty}
          style={{
            marginTop: 'auto',
            paddingVertical: 22,
            backgroundColor: isEmpty ? 'rgba(210, 58, 26, 0.45)' : '#d23a1a',
            borderRadius: 4,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: F.monoSemibold,
              fontSize: 14,
              letterSpacing: 4,
              color: '#f4ede0',
            }}
          >
            CHARGE
          </Text>
        </Pressable>

        <Pressable
          onPress={confirmClear}
          disabled={isEmpty}
          style={{
            marginTop: 12,
            paddingVertical: 10,
            alignItems: 'center',
            opacity: isEmpty ? 0.4 : 1,
          }}
        >
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: 2,
              color: '#7a6a55',
              textDecorationLine: 'underline',
            }}
          >
            CLEAR CART
          </Text>
        </Pressable>
      </View>

      <ScannerInput />
      <PaymentSheet
        visible={paymentOpen}
        totalCentavos={totalCentavos}
        onCancel={() => setPaymentOpen(false)}
        onConfirm={handlePaymentConfirm}
      />
      <PrintingOverlay
        state={printingState}
        sale={lastSaleRef.current}
        cashierName={cashier?.name}
        onRetry={handleRetryPrint}
        onSkip={handleSkipPrint}
        onSuccessDismiss={handleSuccessDismiss}
      />
    </View>
  );
}

function formatScanCode(code: string): string {
  // Renter prefix gets the accent treatment via two Text spans in the UI;
  // here we just return the uppercase code untouched. The scan bar is on
  // a dark surface, so renter color highlighting wouldn't read anyway.
  return code;
}

function ToastView({ toast }: { toast: Toast }) {
  const palette =
    toast.tone === 'success'
      ? { bg: '#4a6b3a', fg: '#f4ede0' }
      : toast.tone === 'warn'
        ? { bg: '#b8893d', fg: '#1a1410' }
        : { bg: '#a02b10', fg: '#f4ede0' };
  return (
    <View
      style={{
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: palette.bg,
        borderRadius: 4,
      }}
    >
      <Text
        style={{
          fontFamily: F.monoSemibold,
          fontSize: 11,
          letterSpacing: 1.4,
          color: palette.fg,
        }}
      >
        {toast.message}
      </Text>
    </View>
  );
}
