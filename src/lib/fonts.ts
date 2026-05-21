/**
 * Font-family constants — Editorial Craft (Design A).
 *
 * Display & body: **Fraunces** (serif). The mockup uses Fraunces with
 * `opsz`, `SOFT`, and `WONK` axes; React Native's text renderer doesn't
 * expose variable-font axes, so we load the static weight files and
 * accept that the WONK character is absent on-device.
 *
 * Mono micro-labels: **JetBrains Mono**.
 *
 * RN can't pick weights via `fontWeight` alone for Google-Fonts that
 * load as separate files. Use these constants in `style={{ fontFamily }}`
 * when a weight-specific family is needed.
 */

export const F = {
  serif: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifMedium: 'Fraunces_500Medium',
  serifSemibold: 'Fraunces_600SemiBold',
  serifSemiboldItalic: 'Fraunces_600SemiBold_Italic',
  serifBold: 'Fraunces_700Bold',
  serifBoldItalic: 'Fraunces_700Bold_Italic',
  serifBlack: 'Fraunces_900Black',
  serifBlackItalic: 'Fraunces_900Black_Italic',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/** Use as Text `style` for tabular numeric alignment on money columns. */
export const TNUM = { fontVariant: ['tabular-nums' as const] };
