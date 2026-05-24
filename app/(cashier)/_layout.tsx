import { StatusBar } from 'expo-status-bar';
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PopcraftChrome } from '@/components/PopcraftChrome';
import { useCatalogSync } from '@/hooks/useCatalogSync';
import { useSyncWorker } from '@/hooks/useSyncWorker';
import { useAuthStore } from '@/state/authStore';

export default function CashierLayout() {
  const cashier = useAuthStore((s) => s.cashier);
  const isRestoring = useAuthStore((s) => s.isRestoring);
  const insets = useSafeAreaInsets();

  useSyncWorker();
  useCatalogSync();

  if (isRestoring) return null;
  if (!cashier) return <Redirect href="/login" />;

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" backgroundColor="#ece1cc" />
      <PopcraftChrome />
      {/*
       * Reserve space for Android's nav / gesture bar AND the (One UI)
       * taskbar that some Samsung tablets render permanently along the
       * bottom edge. Without this padding, the Open cart CTA and the
       * cart's CHARGE / CLEAR CART controls draw under the system UI.
       *
       * Note: Samsung's taskbar is not reported via window insets — it
       * lives in the same band as the nav bar but takes extra height
       * when expanded. We pad with an extra 12 px floor so a thin
       * inset (e.g. gesture-only navigation) still clears the chrome.
       */}
      <View style={{ flex: 1, paddingBottom: Math.max(insets.bottom, 16) }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}
