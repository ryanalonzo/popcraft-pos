/**
 * Auth API. Wires the cashier login screen to the Laravel backend.
 *
 * `POST /api/pos/auth/login`  → { token, cashier }
 * `POST /api/pos/auth/logout` → 204
 * `GET  /api/pos/auth/me`     → { cashier } (used by session restore validation)
 *
 * The mobile client lives at /api/pos/auth/* so the web admin's
 * cookie-session auth at /api/auth/* (UserResource envelope) stays
 * untouched. Login field is `email` server-side; the POS UI labels it
 * "USERNAME" but submits whatever the cashier typed.
 */

import { ApiError, apiGet, apiPost } from '@/api/client';
import type { Cashier } from '@/types';

export interface LoginResponse {
  token: string;
  cashier: Cashier;
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  try {
    return await apiPost<LoginResponse>('/api/pos/auth/login', {
      email: username,
      password,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      throw new Error(humanizeLoginError(err));
    }
    throw err;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiPost<null>('/api/pos/auth/logout');
  } catch {
    // Best-effort — if the network is down or the token already expired,
    // the local state is still cleared by the auth store.
  }
}

export async function fetchCurrentCashier(): Promise<Cashier> {
  const res = await apiGet<{ cashier: Cashier }>('/api/pos/auth/me');
  return res.cashier;
}

function humanizeLoginError(err: ApiError): string {
  if (err.status === 422) {
    // Laravel validation error envelope: { message, errors: { field: [..] } }
    const body = err.body as { errors?: Record<string, string[]> } | null;
    const firstField = body?.errors ? Object.values(body.errors)[0] : undefined;
    const firstMessage = firstField?.[0];
    if (firstMessage) return firstMessage;
    return 'The provided credentials are incorrect.';
  }
  if (err.status === 429) return 'Too many attempts. Wait a minute and try again.';
  return err.message || 'Login failed.';
}
