/**
 * Expo runtime config.
 *
 * We keep the bulk of the manifest in `app.json` so EAS / Expo tooling can
 * still introspect it statically; this file layers environment-specific
 * extras (api base URL, default printer host/port, build channel) on top.
 *
 * Variant resolution:
 *   - `APP_VARIANT=preview`     → staging
 *   - `APP_VARIANT=production`  → prod
 *   - anything else (incl. unset) → development
 *
 * The settings store (src/state/settingsStore.ts) hydrates from these
 * defaults the first time the app launches, then persists user overrides
 * via AsyncStorage. On-device debug-screen edits take precedence over
 * these compile-time defaults.
 */

import type { ConfigContext, ExpoConfig } from 'expo/config';

type Variant = 'development' | 'preview' | 'production';

interface EnvDefaults {
  apiBaseUrl: string;
  printerHost: string;
  printerPort: number;
  useRealPrinter: boolean;
}

const ENV_DEFAULTS: Record<Variant, EnvDefaults> = {
  development: {
    // Android emulator's loopback to the host machine. Override per-device
    // via Settings → API base URL.
    apiBaseUrl: 'http://10.0.2.2:8000',
    printerHost: '192.168.1.50',
    printerPort: 9100,
    useRealPrinter: false,
  },
  preview: {
    apiBaseUrl: 'https://store.popcraft.ph',
    printerHost: '192.168.1.50',
    printerPort: 9100,
    useRealPrinter: true,
  },
  production: {
    apiBaseUrl: 'https://store.popcraft.ph',
    printerHost: '192.168.1.50',
    printerPort: 9100,
    useRealPrinter: true,
  },
};

function resolveVariant(): Variant {
  const raw = process.env.APP_VARIANT;
  if (raw === 'production' || raw === 'preview' || raw === 'development') return raw;
  return 'development';
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = resolveVariant();
  const defaults = ENV_DEFAULTS[variant];

  return {
    ...config,
    name: config.name ?? 'Popcraft POS',
    slug: config.slug ?? 'popcraft-pos',
    extra: {
      ...(config.extra ?? {}),
      variant,
      apiBaseUrl: defaults.apiBaseUrl,
      printerHost: defaults.printerHost,
      printerPort: defaults.printerPort,
      useRealPrinter: defaults.useRealPrinter,
    },
  };
};
