// ─── Theme constants for The Forge (native) ───
// Same palette family as The Hearth for system cohesion.

export const COLORS = {
  bgDeep:     '#16120e',
  bgSurface:  '#1e1910',
  bgElevated: '#262014',
  bgHover:    '#2e271a',

  textPrimary:   '#ede4d4',
  textSecondary: '#c4b49a',
  textMuted:     '#8a7a62',
  textFaint:     '#50463a',

  borderSubtle: '#2e271a',
  borderMid:    '#3e3628',
  borderStrong: '#504638',

  accent:    '#c9a84c',
  accentDim: '#8a7234',

  // Goal colors — identical to Hearth's category colors
  g1: '#c9a84c',
  g2: '#5b8a72',
  g3: '#8b4a4a',
  g4: '#4a6a8b',

  // Priority accents
  priorityHigh: '#b85838',
  priorityMid:  '#8a7234',
  priorityLow:  '#50463a',

  danger: '#8b4a4a',
  ok:     '#5b8a72',

  // Viability flag — a bright lemon yellow, deliberately brighter and
  // greener (hue ~53°) than the gold accent / G1 (#c9a84c, hue 44°) so a
  // flagged row reads as "flagged", not "G1" or "accent". Calendar banners
  // also carry a ⚑ prefix, since an 11px banner can't rely on hue alone.
  // flagText / textPrimary on flagBg are ~7:1 contrast.
  flag:     '#f0dc3c', // borders, calendar banner fill
  flagBg:   '#544c12', // flagged row/card fill
  flagText: '#f3e7a6', // secondary text on flagBg
};

// Applied to any flagged (open, unresolved) task's row, card or banner.
export const FLAG_ROW = { backgroundColor: COLORS.flagBg, borderColor: COLORS.flag };

export const FONTS = {
  display: 'serif',
  body:    'serif',
  mono:    'monospace',
};

export const GOAL_COLORS = {
  G1: COLORS.g1,
  G2: COLORS.g2,
  G3: COLORS.g3,
  G4: COLORS.g4,
};

export const PRIORITY_COLORS = {
  High: COLORS.priorityHigh,
  Mid:  COLORS.priorityMid,
  Low:  COLORS.priorityLow,
};
