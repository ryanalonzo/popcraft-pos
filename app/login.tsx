import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';

import LoginScreen from '@/screens/LoginScreen';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';

export default function LoginRoute() {
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const isLoading = useAuthStore((s) => s.isLoading);
  const clearError = useAuthStore((s) => s.clearError);
  const apiBaseUrl = useSettingsStore((s) => s.apiBaseUrl);

  // Pre-warm the API connection as soon as the login screen appears. The
  // first network call to this host pays a cold DNS+TLS cost (~2-5s on
  // store.popcraft.ph — an IPv6/AAAA lookup stall that resolves, then
  // caches). Firing a throwaway request now, while the cashier types,
  // lets the actual login POST reuse a resolved/keep-alive connection and
  // return in ~100ms instead of waiting on a cold lookup.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/pos/auth/me`, {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    // No abort on unmount — let the warm-up finish so DNS stays cached
    // even if the cashier logs in immediately.
  }, [apiBaseUrl]);

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
