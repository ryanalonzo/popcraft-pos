/**
 * Font-family constants.
 *
 * Brand direction (client feedback, 2026-05-29):
 *   • Titles / headings → Fredoka (friendly rounded sans)
 *   • Sub-headings / body / numerical values → Noto Serif
 *   • Small chrome labels / IDs / timestamps → JetBrains Mono
 *
 * For the migration period, the legacy `F.serif*` names that used to
 * point at Fraunces now alias to the matching Noto Serif weight, so
 * existing call sites pick up the new typeface without changes. New
 * code should prefer `F.heading*` for titles and `F.text*` for body.
 *
 * RN can't pick weights via `fontWeight` alone for Google-Fonts that
 * load as separate files. Use these constants in `style={{ fontFamily }}`
 * when a weight-specific family is needed.
 */

export const F = {
  /* Headings — Fredoka (rounded sans). Use for screen titles, hero
     headlines, the Popcraft wordmark. */
  heading: 'Fredoka_500Medium',
  headingRegular: 'Fredoka_400Regular',
  headingMedium: 'Fredoka_500Medium',
  headingSemibold: 'Fredoka_600SemiBold',
  headingBold: 'Fredoka_700Bold',

  /* Body / sub-headings / numerical values — Noto Serif. */
  text: 'NotoSerif_400Regular',
  textItalic: 'NotoSerif_400Regular_Italic',
  textMedium: 'NotoSerif_500Medium',
  textMediumItalic: 'NotoSerif_500Medium_Italic',
  textSemibold: 'NotoSerif_600SemiBold',
  textSemiboldItalic: 'NotoSerif_600SemiBold_Italic',
  textBold: 'NotoSerif_700Bold',
  textBoldItalic: 'NotoSerif_700Bold_Italic',

  /* Legacy Fraunces names — aliased to Noto Serif so every existing
     `F.serif*` usage picks up the new typeface for free. Remove the
     aliases after the call sites have been migrated to `F.text*` /
     `F.heading*`. */
  serif: 'NotoSerif_400Regular',
  serifItalic: 'NotoSerif_400Regular_Italic',
  serifMedium: 'NotoSerif_500Medium',
  serifSemibold: 'NotoSerif_600SemiBold',
  serifSemiboldItalic: 'NotoSerif_600SemiBold_Italic',
  serifBold: 'NotoSerif_700Bold',
  serifBoldItalic: 'NotoSerif_700Bold_Italic',
  serifBlack: 'NotoSerif_700Bold',
  serifBlackItalic: 'NotoSerif_700Bold_Italic',

  /* Mono — kept for chrome labels, IDs, timestamps, kbd hints. */
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/** Use as Text `style` for tabular numeric alignment on money columns. */
export const TNUM = { fontVariant: ['tabular-nums' as const] };
