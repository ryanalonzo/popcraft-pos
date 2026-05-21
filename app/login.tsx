import { router } from 'expo-router';
import { useCallback } from 'react';

import LoginScreen from '@/screens/LoginScreen';
import { useAuthStore } from '@/state/authStore';

export default function LoginRoute() {
  const login = useAuthStore((s) => s.login);

  const handleSubmit = useCallback(
    async ({ username, pin }: { username: string; pin: string }) => {
      if (!username.trim() || !pin) return;
      try {
        await login(username, pin);
        router.replace('/(cashier)');
      } catch {
        // surfaced via store.error
      }
    },
    [login],
  );

  return <LoginScreen onSubmit={handleSubmit} />;
}
