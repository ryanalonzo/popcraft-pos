import '../global.css';

import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
  Fraunces_900Black,
  Fraunces_900Black_Italic,
} from '@expo-google-fonts/fraunces';
import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
  useFonts,
} from '@expo-google-fonts/jetbrains-mono';
import {
  NotoSerif_400Regular,
  NotoSerif_400Regular_Italic,
  NotoSerif_500Medium,
  NotoSerif_500Medium_Italic,
  NotoSerif_600SemiBold,
  NotoSerif_600SemiBold_Italic,
  NotoSerif_700Bold,
  NotoSerif_700Bold_Italic,
} from '@expo-google-fonts/noto-serif';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { F } from '@/lib/fonts';
import { useAuthStore } from '@/state/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Splash({ label }: { label: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-paper">
      <Text style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: 2.4, color: '#7a6a55' }}>
        POPCRAFT POS
      </Text>
      <Text
        style={{
          fontFamily: F.serifItalic,
          fontSize: 28,
          color: '#1a1410',
          marginTop: 6,
          letterSpacing: -0.4,
        }}
      >
        Arts & Collectibles
      </Text>
      <Text
        style={{
          fontFamily: F.mono,
          fontSize: 10,
          color: '#7a6a55',
          marginTop: 16,
          letterSpacing: 1.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Headings — Fredoka (rounded sans).
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    // Body / sub-headings / numbers — Noto Serif.
    NotoSerif_400Regular,
    NotoSerif_400Regular_Italic,
    NotoSerif_500Medium,
    NotoSerif_500Medium_Italic,
    NotoSerif_600SemiBold,
    NotoSerif_600SemiBold_Italic,
    NotoSerif_700Bold,
    NotoSerif_700Bold_Italic,
    // Mono chrome — JetBrains Mono.
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
    // Legacy Fraunces — kept temporarily so any cached/in-flight bundle
    // referencing it doesn't crash. Safe to remove once we cut a fresh
    // build and stop seeing Fraunces refs in `git grep`.
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    Fraunces_700Bold,
    Fraunces_700Bold_Italic,
    Fraunces_900Black,
    Fraunces_900Black_Italic,
  });

  const isRestoring = useAuthStore((s) => s.isRestoring);

  useEffect(() => {
    useAuthStore.getState().restoreSession();
  }, []);

  if (!fontsLoaded) {
    return <Splash label="LOADING FONTS…" />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {isRestoring ? (
        <Splash label="RESTORING SESSION…" />
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(cashier)" />
          <Stack.Screen name="debug/printer" options={{ headerShown: true, title: 'Printer debug' }} />
          <Stack.Screen name="debug/catalog" options={{ headerShown: true, title: 'Catalog debug' }} />
        </Stack>
      )}
    </QueryClientProvider>
  );
}
