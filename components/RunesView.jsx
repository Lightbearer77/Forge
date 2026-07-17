import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS } from '../lib/theme';
import { DOMAINS } from '../lib/runeData';

const DOMAIN_COLOR = {
  [DOMAINS.PRACTICAL]: '#8a9bb0',
  [DOMAINS.SPIRITUAL]: '#a878b8',
  [DOMAINS.SKIP]: COLORS.textFaint,
};

const BEAD = 52;

export default function RunesView({ runes, onToggleEarned }) {
  const [selected, setSelected] = useState(null);

  const { practical, spiritual, skipped, earnedCount, totalCount } = useMemo(() => {
    const p = runes.filter(r => r.domain === DOMAINS.PRACTICAL);
    const s = runes.filter(r => r.domain === DOMAINS.SPIRITUAL);
    const k = runes.filter(r => r.domain === DOMAINS.SKIP);
    const tracked = [...p, ...s];
    return {
      practical: p, spiritual: s, skipped: k,
      earnedCount: tracked.filter(r => r.earned).length,
      totalCount: tracked.length,
    };
  }, [runes]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>THE BRACELET</Text>
        <Text style={styles.subtitle}>{earnedCount} / {totalCount} beads earned</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <Section label="PRACTICAL" runes={practical} onSelect={setSelected} />
        <Section label="SPIRITUAL & DEVOTIONAL" runes={spiritual} onSelect={setSelected} />
        {skipped.length > 0 && (
          <Section label="HANDLED OUTSIDE THIS CYCLE" runes={skipped} onSelect={setSelected} dim />
        )}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setSelected(null)}>
          {selected && (
            <TouchableOpacity activeOpacity={1} style={styles.detailCard}>
              <Text style={[styles.detailGlyph, { color: DOMAIN_COLOR[selected.domain] }]}>
                {selected.glyph}
              </Text>
              <Text style={styles.detailName}>{selected.name}</Text>
              {!!selected.month && (
                <Text style={styles.detailMeta}>
                  {selected.month}{selected.tag ? `  ·  #${selected.tag}` : ''}
                  {selected.adoptStatus ? `  ·  ${selected.adoptStatus}` : ''}
                </Text>
              )}
              <Text style={styles.detailTask}>{selected.task}</Text>

              {selected.domain !== DOMAINS.SKIP && (
                <TouchableOpacity
                  onPress={() => { onToggleEarned(selected); setSelected(null); }}
                  style={[styles.earnBtn, selected.earned && styles.earnBtnActive]}
                >
                  <Text style={[styles.earnBtnText, selected.earned && styles.earnBtnTextActive]}>
                    {selected.earned ? '✓ BEAD EARNED' : 'MARK BEAD EARNED'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => setSelected(null)} style={{ marginTop: 14 }}>
                <Text style={styles.detailClose}>CLOSE</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function Section({ label, runes, onSelect, dim }) {
  if (runes.length === 0) return null;
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.cordWrap}>
        <View style={styles.cordLine} />
        <View style={styles.beadRow}>
          {runes.map(r => (
            <Bead key={r.id} rune={r} dim={dim} onPress={() => onSelect(r)} />
          ))}
        </View>
      </View>
    </View>
  );
}

function Bead({ rune, dim, onPress }) {
  const color = dim ? COLORS.textFaint : DOMAIN_COLOR[rune.domain];
  return (
    <TouchableOpacity onPress={onPress} style={styles.beadTouch}>
      <View style={[
        styles.bead,
        {
          borderColor: color,
          backgroundColor: rune.earned ? `${color}30` : COLORS.bgSurface,
        },
      ]}>
        <Text style={[styles.beadGlyph, { color: rune.earned ? color : COLORS.textMuted }]}>
          {rune.glyph}
        </Text>
      </View>
      <Text style={styles.beadName} numberOfLines={1}>{rune.name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  title: { fontSize: 15, fontFamily: FONTS.display, letterSpacing: 3, color: COLORS.accent },
  subtitle: { fontSize: 10, fontFamily: FONTS.mono, color: COLORS.textMuted, marginTop: 2 },
  scrollBody: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2,
    color: COLORS.textFaint, marginBottom: 10,
  },
  cordWrap: { position: 'relative' },
  cordLine: {
    position: 'absolute', top: BEAD / 2, left: 0, right: 0,
    height: 1, backgroundColor: COLORS.borderMid,
  },
  beadRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, columnGap: 6 },
  beadTouch: { width: 60, alignItems: 'center' },
  bead: {
    width: BEAD, height: BEAD, borderRadius: BEAD / 2,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  beadGlyph: { fontSize: 22 },
  beadName: {
    fontSize: 7, fontFamily: FONTS.mono, color: COLORS.textFaint,
    marginTop: 4, textAlign: 'center',
  },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  detailCard: {
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 10,
    padding: 24, alignItems: 'center', maxWidth: 360,
  },
  detailGlyph: { fontSize: 48, marginBottom: 8 },
  detailName: { fontSize: 18, fontFamily: FONTS.display, color: COLORS.textPrimary },
  detailMeta: {
    fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 1,
    color: COLORS.textMuted, marginTop: 4, textAlign: 'center',
  },
  detailTask: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary,
    marginTop: 14, textAlign: 'center', lineHeight: 19,
  },
  earnBtn: {
    marginTop: 20, borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  earnBtnActive: { borderColor: COLORS.accent, backgroundColor: `${COLORS.accent}18` },
  earnBtnText: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 1.5, color: COLORS.textMuted },
  earnBtnTextActive: { color: COLORS.accent },
  detailClose: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.textFaint },
});
