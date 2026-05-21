import { router } from 'expo-router';
import { useCallback } from 'react';

import LoginScreen from '@/screens/LoginScreen';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';

export default function LoginRoute() {
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const isLoading = useAuthStore((s) => s.isLoading);
  const clearError = useAuthStore((s) => s.clearError);
  const apiBaseUrl = useSettingsStore((s) => s.apiBaseUrl);

  const handleSubmit = useCallback(
    async ({ username, pin }: { username: string; pin: string }) => {
      if (!username.trim() || !pin) return;
      clearError();
      try {
        await login(username, pin);
        router.replace('/(cashier)');
      } catch {
        // surfaced via authStore.error → rendered by LoginScreen below
      }
    },
    [login, clearError],
  );

  return (
    <LoginScreen
      onSubmit={handleSubmit}
      error={error}
      busy={isLoading}
      apiBaseUrl={apiBaseUrl}
    />
  );
}
