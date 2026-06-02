/**
 * Color tokens — mirrors the Popcraft web admin theme (popcraft-api
 * resources/css/app.css). Gold is the primary accent; red is reserved for
 * danger/destructive. Bright `accent` (#f5c100) is for fills (use `ink`
 * text on it); `gold` (#e8981a) is the readable amber for accent TEXT on
 * light surfaces.
 */
export const colors = {
  paper:       "#fdf5e0",
  paperWarm:   "#f5e8c4",
  paperDeep:   "#ecddb0",
  paperSoft:   "#fffdf0",
  ink:         "#231508",
  inkSoft:     "#3d2410",
  inkMuted:    "#7a5530",
  inkFaint:    "#b8956a",
  accent:      "#f5c100",
  accentDeep:  "#c99500",
  accentSoft:  "#fef3c0",
  gold:        "#e8981a",
  danger:      "#c0392b",
  dangerDeep:  "#992d22",
  green:       "#4a6b3a",
  line:        "rgba(35, 21, 8, 0.12)",
  lineStrong:  "rgba(35, 21, 8, 0.25)",
} as const;
