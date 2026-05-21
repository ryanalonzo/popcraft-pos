import { StatusBar } from 'expo-status-bar';
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';

import { PopcraftChrome } from '@/components/PopcraftChrome';
import { useCatalogSync } from '@/hooks/useCatalogSync';
import { useSyncWorker } from '@/hooks/useSyncWorker';
import { useAuthStore } from '@/state/authStore';

export default function CashierLayout() {
  const cashier = useAuthStore((s) => s.cashier);
  const isRestoring = useAuthStore((s) => s.isRestoring);

  useSyncWorker();
  useCatalogSync();

  if (isRestoring) return null;
  if (!cashier) return <Redirect href="/login" />;

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" backgroundColor="#ece1cc" />
      <PopcraftChrome />
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}
