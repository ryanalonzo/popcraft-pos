/**
 * Subtle diagonal-stripe texture overlay (matches the mockup's
 * `repeating-linear-gradient(45deg, ...)` paper-soft pattern on the
 * vermillion art panels).
 *
 * Implemented with `react-native-svg`. Same require-and-fallback pattern
 * as `Gradient` — if the native module isn't in the dev client yet, we
 * render an empty View so layouts don't crash. Stripes light up after
 * the next dev-client rebuild.
 */

import {
  NativeModules,
  UIManager,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type SvgModule = typeof import('react-native-svg');

let svg: SvgModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  svg = require('react-native-svg') as SvgModule;
} catch {
  svg = null;
}

function isSvgNativeAvailable(): boolean {
  if (!svg) return false;
  const getCfg = (UIManager as unknown as {
    getViewManagerConfig?: (n: string) => unknown;
  }).getViewManagerConfig;
  if (typeof getCfg === 'function') {
    try {
      if (getCfg('RNSVGSvgViewAndroid')) return true;
      if (getCfg('RNSVGSvgView')) return true;
    } catch {
      // continue
    }
  }
  const nm = NativeModules as Record<string, unknown>;
  if (nm.RNSVGSvgViewManager) return true;
  return false;
}

const NATIVE_OK = isSvgNativeAvailable();

interface DiagonalStripesProps {
  /** Stripe stroke colour. Defaults to a paper-soft tint. */
  color?: string;
  /** Distance between adjacent stripes (px). */
  spacing?: number;
  /** Stripe stroke width (px). */
  strokeWidth?: number;
  /** Rotation angle in degrees. 45 is the mockup default. */
  angle?: number;
  /** Wrapper style (typically `position: absolute, inset: 0`). */
  style?: StyleProp<ViewStyle>;
}

export function DiagonalStripes({
  color = 'rgba(244,237,224,0.06)',
  spacing = 32,
  strokeWidth = 1.5,
  angle = 45,
  style,
}: DiagonalStripesProps) {
  if (!NATIVE_OK || !svg) {
    return <View style={style} pointerEvents="none" />;
  }
  const { Svg, Defs, Pattern, Line, Rect } = svg;
  return (
    <View style={[{ overflow: 'hidden' }, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="popcraft-stripes"
            patternUnits="userSpaceOnUse"
            width={spacing}
            height={spacing}
            patternTransform={`rotate(${angle})`}
          >
            <Line
              x1="0"
              y1="0"
              x2="0"
              y2={spacing}
              stroke={color}
              strokeWidth={strokeWidth}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#popcraft-stripes)" />
      </Svg>
    </View>
  );
}
