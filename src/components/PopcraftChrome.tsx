import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SyncDetailModal } from '@/components/SyncStatusBadge';
import { useSyncWorker } from '@/hooks/useSyncWorker';
import { F } from '@/lib/fonts';
import { useAuthStore } from '@/state/authStore';

/**
 * Editorial top bar. Three zones:
 *  - Left: italic serif wordmark with all-caps mono subtitle.
 *  - Middle-right: tappable sync pill that opens the sync detail modal.
 *  - Right: cashier tag (avatar + name + role) that opens a small menu.
 *
 * The whole bar sits on a translucent warm-white panel above the
 * `paper` body, with the OS status bar background painted in the
 * matching tone so the chrome reads as one continuous surface.
 */
export function PopcraftChrome() {
  const insets = useSafeAreaInsets();
  const cashier = useAuthStore((s) => s.cashier);
  const logout = useAuthStore((s) => s.logout);
  const { isOnline, pendingCount, isProcessing } = useSyncWorker();
  const [syncOpen, setSyncOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const initial = (cashier?.name ?? '?').charAt(0).toUpperCase();
  const displayName = cashier?.name ?? 'cashier';

  const openCashierMenu = () => {
    setLogoutOpen(true);
  };

  const handleConfirmLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  return (
    <>
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: 'rgba(255, 248, 235, 0.85)',
          borderBottomWidth: 1,
          borderColor: 'rgba(26, 20, 16, 0.12)',
        }}
      >
        <View
          className="flex-row items-center"
          style={{ paddingHorizontal: 24, paddingVertical: 14 }}
        >
          {/* Wordmark. Long-press opens the hidden settings screen. */}
          <Pressable
            onPress={() => router.push('/(cashier)')}
            onLongPress={() => router.push('/(cashier)/settings')}
            delayLongPress={600}
            className="flex-row items-baseline"
            style={{ gap: 14 }}
          >
            <Text
              style={{
                fontFamily: F.headingSemibold,
                fontSize: 24,
                color: '#d23a1a',
                letterSpacing: -0.4,
              }}
            >
              Popcraft
            </Text>
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 2.2,
                color: 'rgba(26, 20, 16, 0.5)',
              }}
            >
              ARTS & COLLECTIBLES
            </Text>
          </Pressable>

          <View className="flex-1" />

          <SyncPill
            isOnline={isOnline}
            pendingCount={pendingCount}
            isProcessing={isProcessing}
            onPress={() => setSyncOpen(true)}
          />

          <CashierTag
            initial={initial}
            name={displayName}
            onPress={openCashierMenu}
          />
        </View>
      </View>

      <SyncDetailModal visible={syncOpen} onClose={() => setSyncOpen(false)} />

      <ConfirmDialog
        visible={logoutOpen}
        title={`Log out, ${cashier?.name ?? 'cashier'}?`}
        message={`Signed in as ${cashier?.username ?? '—'}.\n\nYou will need an internet connection to sign back in. If you might open the till before you have signal, stay signed in instead.`}
        cancelLabel="Stay signed in"
        confirmLabel="Log out"
        destructive
        busy={loggingOut}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
      />
    </>
  );
}

interface SyncPillProps {
  isOnline: boolean | null;
  pendingCount: number;
  isProcessing: boolean;
  onPress: () => void;
}

function SyncPill({ isOnline, pendingCount, isProcessing, onPress }: SyncPillProps) {
  const offline = isOnline === false;
  const queued = pendingCount > 0;
  const dot = isProcessing
    ? '#b8893d'
    : offline
      ? '#a02b10'
      : queued
        ? '#b8893d'
        : '#4a6b3a';
  const label = isProcessing
    ? `SYNCING ${pendingCount}`
    : offline
      ? 'OFFLINE'
      : queued
        ? `${pendingCount} PENDING`
        : 'SYNCED';

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center"
      style={{
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: 'rgba(26, 20, 16, 0.25)',
        borderRadius: 100,
        marginRight: 18,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: dot,
          shadowColor: dot,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 4,
        }}
      />
      <Text
        style={{
          fontFamily: F.mono,
          fontSize: 11,
          letterSpacing: 1.1,
          color: '#3a2f24',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CashierTag({
  initial,
  name,
  onPress,
}: {
  initial: string;
  name: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center" style={{ gap: 12 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: '#d23a1a',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: F.monoBold,
            fontSize: 14,
            color: '#f4ede0',
            letterSpacing: 0.5,
          }}
        >
          {initial}
        </Text>
      </View>
      <View>
        <Text
          style={{
            fontFamily: F.serifMedium,
            fontSize: 14,
            color: '#1a1410',
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={{
            fontFamily: F.mono,
            fontSize: 9,
            letterSpacing: 1.5,
            color: '#7a6a55',
            marginTop: 1,
          }}
        >
          CASHIER
        </Text>
      </View>
    </Pressable>
  );
}
