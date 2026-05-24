/**
 * Thin wrapper around `expo-network`.
 *
 * `expo-network` is a native module — if the running dev client was built
 * before the package was added, the import throws "Cannot find native
 * module 'ExpoNetwork'". The wrapper loads the module behind a try/catch
 * and exposes a safe API that returns `null` when the probe is
 * unavailable. Callers treat `null` as "unknown — try anyway".
 *
 * Once the dev client is rebuilt to include the native module, every
 * function in here lights up automatically; no calling code changes.
 */

type NetworkModule = typeof import('expo-network');

let mod: NetworkModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('expo-network') as NetworkModule;
} catch {
  mod = null;
}

export const isNetworkModuleAvailable: boolean = mod !== null;

/**
 * Probe current connectivity.
 *
 * Returns:
 *  - `true`  → device is online (has a network connection)
 *  - `false` → confirmed offline (no network of any kind)
 *  - `null`  → unknown (no native module, or probe threw)
 *
 * Intentionally does NOT consult `isInternetReachable`. That property
 * is Android's heuristic "can we reach a public connectivity check
 * endpoint" — it goes `false` under captive portals, slow Wi-Fi, and
 * networks that route to our private API but block Google's probe
 * host. Our actual fetch attempt is the canonical truth; the only
 * reason for this probe is to skip the 10s timeout when the device
 * genuinely has no link at all.
 */
export async function probeOnline(): Promise<boolean | null> {
  if (!mod) return null;
  try {
    const state = await mod.getNetworkStateAsync();
    if (state.isConnected === false) return false;
    return true;
  } catch {
    return null;
  }
}

export type NetworkUnsubscribe = () => void;

/**
 * Subscribe to connectivity changes. No-op when the native module is
 * unavailable; the returned unsubscribe is still safe to call.
 */
export function subscribeOnline(
  handler: (online: boolean | null) => void,
): NetworkUnsubscribe {
  if (!mod) return () => {};
  try {
    const sub = mod.addNetworkStateListener((event) => {
      // Mirror `probeOnline`: trust `isConnected`, ignore the noisy
      // `isInternetReachable` flag so a captive-portal or local-only LAN
      // doesn't flip us to "offline" while the API is reachable.
      const online = event.isConnected !== false;
      handler(online);
    });
    return () => {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    };
  } catch {
    return () => {};
  }
}
