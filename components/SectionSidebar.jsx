import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS } from '../lib/theme';
import { buildGoalSections, UNSORTED_ID } from '../lib/selectors';

// Left drawer: goal → section, matching the Asana project → section model.
// A "section" is a distinct value of the existing task `section` field,
// scoped to its goal — see lib/selectors buildGoalSections. Collapse state
// is local to this mount (not persisted) and starts fully expanded; that's
// a deliberate scope trim to avoid a schema/settings-table change for a
// convenience feature, not an oversight.
export default function SectionSidebar({
  visible, tasks, milestones = [], today, activeKey = null, onSelect, onClose,
}) {
  const tree = useMemo(
    () => (visible ? buildGoalSections(tasks, milestones, today) : []),
    [visible, tasks, milestones, today],
  );
  const [collapsed, setCollapsed] = useState({});

  if (!visible) return null;

  const totalOpen = tree.reduce((a, g) => a + g.open, 0);
  const toggleGoal = (g) => setCollapsed(c => ({ ...c, [g]: !c[g] }));

  return (
    <View style={styles.backdrop}>
      <View style={styles.drawer}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>SECTIONS</Text>
            <Text style={styles.subtitle}>{totalOpen} open across G1–G4</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {tree.map(g => {
            const color = GOAL_COLORS[g.goal] || COLORS.textMuted;
            const isCollapsed = !!collapsed[g.goal];
            return (
              <View key={g.goal} style={styles.goalGroup}>
                <TouchableOpacity
                  onPress={() => toggleGoal(g.goal)}
                  activeOpacity={0.7}
                  style={[styles.goalHeader, { borderColor: color }]}
                >
                  <View style={[styles.goalDot, { backgroundColor: color }]} />
                  <Text style={[styles.goalLabel, { color }]}>{g.goal}</Text>
                  <Text style={styles.goalCount}>
                    {g.sections.length} section{g.sections.length === 1 ? '' : 's'} · {g.open} open
                  </Text>
                  <Text style={styles.chevron}>{isCollapsed ? '▸' : '▾'}</Text>
                </TouchableOpacity>

                {!isCollapsed && g.sections.length === 0 && (
                  <Text style={styles.emptyGoal}>No tasks yet.</Text>
                )}

                {!isCollapsed && g.sections.map(s => {
                  const active = s.id === activeKey;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => onSelect(s)}
                      activeOpacity={0.7}
                      style={[styles.row, active && styles.rowActive]}
                    >
                      <View style={[styles.goalBar, { backgroundColor: color }]} />
                      <View style={styles.rowBody}>
                        <View style={styles.rowTop}>
                          <Text
                            style={[
                              styles.name,
                              s.section === UNSORTED_ID && styles.nameUnsorted,
                              active && { color: COLORS.accent },
                            ]}
                            numberOfLines={1}
                          >
                            {s.name}
                          </Text>
                        </View>

                        <View style={styles.track}>
                          <View style={[styles.fill, {
                            width: `${Math.round(s.progress * 100)}%`,
                            backgroundColor: color,
                          }]} />
                        </View>

                        <View style={styles.rowSub}>
                          <Text style={styles.sub}>{s.open} open · {s.done}/{s.total}</Text>
                          {s.msTotal > 0 && (
                            <Text style={styles.sub}> · ◆ {s.msDone}/{s.msTotal}</Text>
                          )}
                          {s.blocked > 0 && (
                            <Text style={styles.blocked}> · 🔒 {s.blocked}</Text>
                          )}
                          {s.overdue > 0 && (
                            <Text style={styles.overdue}> · {s.overdue} overdue</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}

          <Text style={styles.footnote}>
            Sections come from each task's SECTION field, scoped to its GOAL —
            the same section name under two goals is two different sections.
          </Text>
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 50,
  },
  drawer: {
    width: '82%',
    maxWidth: 340,
    backgroundColor: COLORS.bgDeep,
    borderRightWidth: 1,
    borderRightColor: COLORS.borderMid,
  },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  title: { fontSize: 14, fontFamily: FONTS.display, letterSpacing: 3, color: COLORS.accent },
  subtitle: {
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 1,
    color: COLORS.textMuted, marginTop: 3,
  },
  close: { fontSize: 15, color: COLORS.textMuted },
  list: { padding: 10, paddingBottom: 40 },
  goalGroup: { marginBottom: 14 },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: COLORS.bgSurface,
  },
  goalDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  goalLabel: { fontSize: 12, fontFamily: FONTS.mono, letterSpacing: 2, fontWeight: '700' },
  goalCount: {
    flex: 1, textAlign: 'right', marginRight: 8,
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 0.5, color: COLORS.textMuted,
  },
  chevron: { fontSize: 11, color: COLORS.textMuted },
  emptyGoal: {
    fontSize: 10, fontFamily: FONTS.mono, color: COLORS.textFaint,
    paddingVertical: 8, paddingLeft: 8, fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 4,
    marginTop: 6,
    marginLeft: 10,
    overflow: 'hidden',
  },
  rowActive: { borderColor: COLORS.accent, backgroundColor: COLORS.bgElevated },
  goalBar: { width: 3, alignSelf: 'stretch' },
  rowBody: { flex: 1, paddingHorizontal: 10, paddingVertical: 9 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 13, fontFamily: FONTS.body, color: COLORS.textPrimary },
  nameUnsorted: { color: COLORS.textMuted, fontStyle: 'italic' },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.bgElevated,
    overflow: 'hidden',
    marginTop: 7,
  },
  fill: { height: 3, borderRadius: 2 },
  rowSub: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 5 },
  sub: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 0.5, color: COLORS.textMuted },
  blocked: { fontSize: 9, fontFamily: FONTS.mono, color: COLORS.priorityHigh },
  overdue: { fontSize: 9, fontFamily: FONTS.mono, color: COLORS.priorityHigh },
  footnote: {
    marginTop: 14, paddingHorizontal: 4,
    fontSize: 8, fontFamily: FONTS.mono, letterSpacing: 0.5,
    color: COLORS.textFaint, lineHeight: 13,
  },
});
