/**
 * Authenticated fetch wrapper.
 *
 * One place for every cross-cutting concern:
 *   - reads the base URL from the settings store (so on-site overrides
 *     from the debug screen take effect without a rebuild)
 *   - attaches `Authorization: Bearer <token>`
 *   - parses JSON bodies and surfaces non-2xx as typed errors
 *   - retries transient network failures with exponential backoff (2x)
 *   - enforces a 10-second per-request timeout
 *   - on 401: clears the session and redirects to /login
 *   - in __DEV__: logs request line + status + duration
 */

import { router } from 'expo-router';

import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 400;

function resolveBaseUrl(): string {
  return useSettingsStore.getState().apiBaseUrl;
}

/** Thrown on 401. Caller can decide whether to swallow or re-throw. */
export class AuthError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

/** Thrown on any non-2xx response other than 401, except where the caller opts to handle a specific status (e.g. 409 idempotent sales). */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Thrown when the request timed out before any response arrived. */
export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/** Thrown for fetch-level network failures after retries are exhausted. */
export class NetworkError extends Error {
  readonly cause?: unknown;
  constructor(cause?: unknown) {
    super('Network request failed');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Status codes the caller wants to handle without a thrown ApiError (e.g. [409]). */
  acceptStatuses?: number[];
  /** Override default timeout (ms). */
  timeoutMs?: number;
}

export interface RawResponse<T> {
  status: number;
  body: T;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: RequestOptions = {},
): Promise<RawResponse<T>> {
  const baseUrl = resolveBaseUrl();
  const url = buildUrl(baseUrl, path, options.query);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const accept = new Set(options.acceptStatuses ?? []);

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const externalAbort = options.signal;
    const onExternalAbort = () => controller.abort(externalAbort?.reason);
    externalAbort?.addEventListener('abort', onExternalAbort);
    const timer = setTimeout(() => controller.abort(new TimeoutError(timeoutMs)), timeoutMs);

    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    };

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[api] → ${method} ${url}${attempt > 0 ? ` (retry ${attempt})` : ''}`);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);
      externalAbort?.removeEventListener('abort', onExternalAbort);

      const text = await response.text();
      const parsed = text.length > 0 ? safeJsonParse(text) : null;

      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log(`[api] ← ${response.status} ${method} ${url} (${Date.now() - startedAt}ms)`);
      }

      if (response.status === 401) {
        // Clear session locally and bounce to login. Do NOT call
        // authStore.logout() here — that posts to /api/auth/logout with
        // the same dead token, which 401s, which re-fires this handler.
        // The server-side token is already invalid; just wipe local state.
        try {
          await useAuthStore.getState().clearLocalSession();
        } finally {
          try {
            router.replace('/login');
          } catch {
            // router not ready (e.g. on cold start) — caller handles redirect.
          }
        }
        throw new AuthError();
      }

      if (response.ok || accept.has(response.status)) {
        return { status: response.status, body: parsed as T };
      }

      const message =
        (parsed &&
          typeof parsed === 'object' &&
          'message' in parsed &&
          typeof (parsed as { message: unknown }).message === 'string'
          ? (parsed as { message: string }).message
          : null) ?? `HTTP ${response.status}`;
      throw new ApiError(response.status, message, parsed);
    } catch (err) {
      clearTimeout(timer);
      externalAbort?.removeEventListener('abort', onExternalAbort);

      // Non-retriable: AuthError, ApiError (HTTP-level), and external aborts.
      if (err instanceof AuthError || err instanceof ApiError) throw err;
      if (externalAbort?.aborted) throw err;

      // Distinguish timeout from generic network failure for the final throw.
      lastError = isTimeoutAbort(err, timeoutMs) ? new TimeoutError(timeoutMs) : err;

      if (attempt < MAX_RETRIES) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log(`[api] ✗ ${method} ${url} → retry in ${delay}ms (${describe(lastError)})`);
        }
        await sleep(delay);
        continue;
      }
    }
  }

  if (lastError instanceof TimeoutError) throw lastError;
  throw new NetworkError(lastError);
}

function isTimeoutAbort(err: unknown, timeoutMs: number): boolean {
  if (err instanceof TimeoutError) return true;
  if (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') return true;
  if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError') {
    return true;
  }
  // Fallback heuristic so we report timeouts cleanly even if AbortError typing differs.
  return false;
}

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: RequestOptions['query'],
): string {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : '/' + path;
  let url = trimmedBase + trimmedPath;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs.length > 0) url += '?' + qs;
  }
  return url;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/* ----------------------- Convenience wrappers ---------------------- */

export async function apiGet<T>(
  path: string,
  query?: RequestOptions['query'],
  options?: Omit<RequestOptions, 'query'>,
): Promise<T> {
  const { body } = await request<T>('GET', path, { ...options, query });
  return body;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>,
): Promise<T> {
  const { body: out } = await request<T>('POST', path, { ...options, body });
  return out;
}

export async function apiPut<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>,
): Promise<T> {
  const { body: out } = await request<T>('PUT', path, { ...options, body });
  return out;
}

export async function apiDelete<T>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  const { body } = await request<T>('DELETE', path, options ?? {});
  return body;
}

/** Same as `apiPost`, but the caller wants the status code too (used by sales submission so 409 can be treated as success). */
export async function apiPostRaw<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>,
): Promise<RawResponse<T>> {
  return request<T>('POST', path, { ...options, body });
}

/** Exposed for tests / debug screens. */
export function getApiBaseUrl(): string {
  return resolveBaseUrl();
}
