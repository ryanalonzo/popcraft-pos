/**
 * Auth state.
 *
 * `cashier` and `token` mirror what's persisted in `expo-secure-store`.
 * On cold start, the root layout calls `restoreSession()` once — until
 * it resolves, `isRestoring` is true and the app shows a splash. After
 * that:
 *   - cashier present → /(cashier) routes render
 *   - cashier null    → (cashier) layout redirects to /login
 */

import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { fetchCurrentCashier, login as loginApi, logout as logoutApi } from '@/api/auth';
import type { Cashier } from '@/types';

const TOKEN_KEY = 'auth_token';
const CASHIER_KEY = 'auth_cashier';

export interface AuthState {
  cashier: Cashier | null;
  token: string | null;
  /** A login attempt is in-flight. */
  isLoading: boolean;
  /** Initial `restoreSession` hasn't completed yet. */
  isRestoring: boolean;
  /** Last login error, cleared on the next attempt. */
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Wipe local session without calling the server. Used by the 401 handler. */
  clearLocalSession: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  cashier: null,
  token: null,
  isLoading: false,
  isRestoring: true,
  error: null,

  login: async (username, password) => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const { token, cashier } = await loginApi(username, password);
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(CASHIER_KEY, JSON.stringify(cashier));
      set({ token, cashier, isLoading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed.';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  logout: async () => {
    // Voluntary logout: tell the server, then wipe local state.
    // Server failures are non-fatal — local wipe still proceeds.
    try {
      await logoutApi();
    } catch {
      // Best-effort.
    }
    await get().clearLocalSession();
  },

  clearLocalSession: async () => {
    // Used by the 401 handler in api/client.ts. Must NOT call /api/auth/logout
    // — that endpoint with a dead token re-triggers the 401 handler and
    // recurses forever.
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(CASHIER_KEY);
    set({ cashier: null, token: null, error: null });
  },

  restoreSession: async () => {
    try {
      const [token, cashierJson] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(CASHIER_KEY),
      ]);
      if (!token || !cashierJson) return;

      // Optimistically hydrate from the secure-store blob so the UI can
      // render immediately, then validate the token against the server.
      let cashier: Cashier;
      try {
        cashier = JSON.parse(cashierJson) as Cashier;
      } catch {
        await SecureStore.deleteItemAsync(CASHIER_KEY);
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        return;
      }
      set({ token, cashier });

      // Best-effort: confirm the token is still valid and refresh the
      // cashier payload. On 401 the client.ts handler clears state for
      // us; on network errors we keep the cached session.
      try {
        const fresh = await fetchCurrentCashier();
        await SecureStore.setItemAsync(CASHIER_KEY, JSON.stringify(fresh));
        set({ cashier: fresh });
      } catch {
        // Either offline (keep cached session) or 401 (already cleared).
      }
    } finally {
      set({ isRestoring: false });
    }
  },

  clearError: () => set({ error: null }),
}));
