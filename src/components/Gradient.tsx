/**
 * Linear-gradient wrapper with graceful fallback.
 *
 * `expo-linear-gradient` is a native module. There are two ways a dev
 * client can be missing it:
 *
 *   1. `require('expo-linear-gradient')` itself throws (rare — only when
 *      the JS shim can't load).
 *   2. JS loads fine, but the native view manager isn't registered in
 *      the APK. Fabric then throws `IllegalViewOperationException:
 *      Can't find ViewManager` the moment a `<LinearGradient>` mounts.
 *      This is the common case when the dev client was built before the
 *      package was added.
 *
 * We guard against both: try the JS require, then probe `UIManager` /
 * `NativeModules` at runtime. If either check fails we render a solid
 * `View` painted with the first colour stop. Once the dev client is
 * rebuilt to include the native module, real gradients light up
 * automatically.
 */

import {
  NativeModules,
  UIManager,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type LinearGradientModule = typeof import('expo-linear-gradient');

let mod: LinearGradientModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('expo-linear-gradient') as LinearGradientModule;
} catch {
  mod = null;
}

function isViewManagerRegistered(name: string): boolean {
  // `getViewManagerConfig` exists on both Paper and Fabric; returns null
  // when the manager isn't registered.
  const getCfg = (UIManager as unknown as { getViewManagerConfig?: (n: string) => unknown })
    .getViewManagerConfig;
  if (typeof getCfg === 'function') {
    try {
      if (getCfg(name)) return true;
    } catch {
      // continue
    }
  }
  return false;
}

function detectNative(): boolean {
  if (!mod) return false;
  // Module name varies by package version / arch; check both.
  if (isViewManagerRegistered('ExpoLinearGradient')) return true;
  if (isViewManagerRegistered('ExponentLinearGradient')) return true;
  const nm = NativeModules as Record<string, unknown>;
  if (nm.ExpoLinearGradient) return true;
  if (nm.ExponentLinearGradient) return true;
  return false;
}

export const isGradientNative: boolean = detectNative();

export interface GradientProps {
  colors: [string, string, ...string[]];
  /** Default: top-to-bottom. */
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  /** Optional explicit stops, 0..1. */
  locations?: [number, number, ...number[]];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Gradient({ colors, start, end, locations, style, children }: GradientProps) {
  if (isGradientNative && mod) {
    const LG = mod.LinearGradient;
    return (
      <LG colors={colors} start={start} end={end} locations={locations} style={style}>
        {children}
      </LG>
    );
  }
  // Fallback: paint with the first stop. Visually flatter but the layout
  // stays intact.
  return <View style={[{ backgroundColor: colors[0] }, style]}>{children}</View>;
}
