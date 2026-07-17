// ─── Runestone Tradition: static reference data ───
// Content copied verbatim from Nu_2026_Rune-Task_Assignments (Connor's own
// authored doc) — this file carries HIS text, not generated philosophy.
// Structural/display code only lives here; meaning and wording are his.

export const RUNE_GLYPHS = {
  Fehu: 'ᚠ', Uruz: 'ᚢ', Thurisaz: 'ᚦ', Ansuz: 'ᚨ', Raidho: 'ᚱ',
  Kenaz: 'ᚲ', Gebo: 'ᚷ', Wunjo: 'ᚹ', Hagalaz: 'ᚺ', Nauthiz: 'ᚾ',
  Isa: 'ᛁ', Jera: 'ᛃ', Eihwaz: 'ᛇ', Perthro: 'ᛈ', Algiz: 'ᛉ',
  Sowilo: 'ᛊ', Tiwaz: 'ᛏ', Berkano: 'ᛒ', Ehwaz: 'ᛖ', Mannaz: 'ᛗ',
  Laguz: 'ᛚ', Ingwaz: 'ᛜ', Dagaz: 'ᛞ', Othala: 'ᛟ',
};

export const DOMAINS = { PRACTICAL: 'practical', SPIRITUAL: 'spiritual', SKIP: 'skip' };

// The 20 assigned runes for the Nu 2026 cycle (practical + spiritual).
// month/tag/adoptStatus/task text are exactly as Connor's doc states.
export const NU_2026_RUNE_ASSIGNMENTS = [
  // Practical (13)
  { name: 'Fehu', domain: 'practical', task: 'Emergency fund hits 75% ($17,662)', month: 'Mu', tag: 'G4', adoptStatus: 'Adopt' },
  { name: 'Uruz', domain: 'practical', task: 'Confirm training block at 6+ months continuous', month: 'Mu', tag: 'G3', adoptStatus: 'Adopt' },
  { name: 'Sowilo', domain: 'practical', task: 'Metabolic health re-test completed', month: 'Iota', tag: 'G3', adoptStatus: 'Adopt' },
  { name: 'Kenaz', domain: 'practical', task: 'Forge Native reaches feature parity with web Forge', month: 'Iota', tag: 'G1', adoptStatus: 'Adopt' },
  { name: 'Mannaz', domain: 'practical', task: 'G1 year-end self-assessment — sovereignty, equanimity, truth-seeking', month: 'Nu', tag: 'G1', adoptStatus: 'Adopt' },
  { name: 'Raidho', domain: 'practical', task: 'G1 quarterly checkpoint — habit tracker + daily systems audit', month: 'Kappa', tag: 'G1', adoptStatus: 'Adopt' },
  { name: 'Nauthiz', domain: 'practical', task: 'HRV + sleep protocol review under shift work', month: 'Kappa', tag: 'G3', adoptStatus: 'Adopt' },
  { name: 'Jera', domain: 'practical', task: 'Annual review — 2026 gate vs. plan, draft 2027', month: 'Nu', tag: 'G1', adoptStatus: 'Adopt' },
  { name: 'Berkano', domain: 'practical', task: 'Wife-search 6-month review (gate criterion)', month: 'Mu', tag: 'G2', adoptStatus: 'Adopt' },
  { name: 'Thurisaz', domain: 'practical', task: 'SAS handbook, Ch. 3 completed', month: 'Theta', tag: 'G1', adoptStatus: 'Net-new' },
  { name: 'Gebo', domain: 'practical', task: 'Band/bracelet acquired for each tribe member', month: 'Theta', tag: 'G2', adoptStatus: 'Net-new' },
  { name: 'Ehwaz', domain: 'practical', task: 'Trust-building task for the tribe (specific task authored privately by Connor)', month: 'Theta', tag: 'G2', adoptStatus: 'Net-new' },
  { name: 'Tiwaz', domain: 'practical', task: '90%+ execution on goals by year-end', month: 'Nu', tag: 'G1', adoptStatus: 'Net-new' },
  // Spiritual / devotional (7)
  { name: 'Wunjo', domain: 'spiritual', task: 'Spoken naming of the frith over the horn at a communal gathering — gratitude naming the men present and the bond itself — followed by honest same-night journaling of the felt-state', month: 'Theta', tag: 'G2', adoptStatus: 'Adopt (onto existing horn ceremony)' },
  { name: 'Othala', domain: 'spiritual', task: "Formally incorporate grandfather's name into daily practice with a physical anchor at the Vé alongside grandmother's; open the lineage roster as first pass toward the three-generation document", month: 'Lambda', tag: 'G2', adoptStatus: 'Adopt/deepen' },
  { name: 'Algiz', domain: 'spiritual', task: 'Open deliberate relationship with the landvættir of the actual property — walk and mark the boundary, establish a fixed outdoor offering spot and a set greeting on entering/leaving the land', month: 'Iota', tag: 'G2', adoptStatus: 'Partial-adopt' },
  { name: 'Perthro', domain: 'spiritual', task: 'Begin disciplined rúnwork with the bone-carved set — fixed method, fixed question-posture, honest cast log including empty casts; earned at a defined logged-cast threshold', month: 'Theta', tag: 'G1', adoptStatus: 'Partial-adopt' },
  { name: 'Eihwaz', domain: 'spiritual', task: 'Dedicated engagement with the Rúnatal (Hávamál 138–145) — memorize and recite the self-hanging stanzas; one dedicated deep-winter observance on the descent-and-return', month: 'Mu', tag: 'G1', adoptStatus: 'Adopt (onto Wednesday Odin devotion)' },
  { name: 'Ingwaz', domain: 'spiritual', task: 'Source mugwort and yarrow, brew Gruit Ale Batch 1 per the log, bring the first sacred ale to a communal blót', month: 'Kappa', tag: 'G2', adoptStatus: 'Adopt (activates stalled project)' },
  { name: 'Hagalaz', domain: 'spiritual', task: 'Standing vow at the winter threshold: when disruption hits, bring it to the Vé rather than going dark under duress; earned on the concrete instance, not the calendar', month: 'Lambda (set) / Nu (due-by backstop)', tag: 'G1', adoptStatus: 'Adopt' },
  // Already handled — skip (4)
  { name: 'Isa', domain: 'skip', task: 'Assigned outside this cycle\u2019s formal process — no action needed in Phase 2.', month: '', tag: '', adoptStatus: 'Skip' },
  { name: 'Laguz', domain: 'skip', task: 'Assigned outside this cycle\u2019s formal process — no action needed in Phase 2.', month: '', tag: '', adoptStatus: 'Skip' },
  { name: 'Ansuz', domain: 'skip', task: 'Assigned outside this cycle\u2019s formal process — no action needed in Phase 2.', month: '', tag: '', adoptStatus: 'Skip' },
  { name: 'Dagaz', domain: 'skip', task: 'Assigned outside this cycle\u2019s formal process — no action needed in Phase 2.', month: '', tag: '', adoptStatus: 'Skip' },
];
