import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS } from '../lib/theme';
import { buildProjects, UNSORTED_ID } from '../lib/selectors';

// Left drawer listing projects. A "project" is a distinct value of the
// existing task `section` field — see lib/selectors buildProjects.
export default function ProjectSidebar({
  visible, tasks, milestones = [], today, activeId = null, onSelect, onClose,
}) {
  const projects = useMemo(
    () => (visible ? buildProjects(tasks, milestones, today) : []),
    [visible, tasks, milestones, today],
  );

  if (!visible) return null;

  const totalOpen = projects.reduce((a, p) => a + p.open, 0);

  return (
    <View style={styles.backdrop}>
      <View style={styles.drawer}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>PROJECTS</Text>
            <Text style={styles.subtitle}>{projects.length} · {totalOpen} open</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {projects.map(p => {
            const color = GOAL_COLORS[p.goal] || COLORS.textMuted;
            const active = p.id === activeId;
            return (
              <TouchableOpacity
                key={p.id || '__unsorted__'}
                onPress={() => onSelect(p)}
                activeOpacity={0.7}
                style={[styles.row, active && styles.rowActive]}
              >
                <View style={[styles.goalBar, { backgroundColor: color }]} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text
                      style={[
                        styles.name,
                        p.id === UNSORTED_ID && styles.nameUnsorted,
                        active && { color: COLORS.accent },
                      ]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    <Text style={[styles.goalTag, { color }]}>
                      {p.goal}{p.mixedGoals ? '*' : ''}
                    </Text>
                  </View>

                  <View style={styles.track}>
                    <View style={[styles.fill, {
                      width: `${Math.round(p.progress * 100)}%`,
                      backgroundColor: color,
                    }]} />
                  </View>

                  <View style={styles.rowSub}>
                    <Text style={styles.sub}>{p.open} open · {p.done}/{p.total}</Text>
                    {p.msTotal > 0 && (
                      <Text style={styles.sub}> · ◆ {p.msDone}/{p.msTotal}</Text>
                    )}
                    {p.blocked > 0 && (
                      <Text style={styles.blocked}> · 🔒 {p.blocked}</Text>
                    )}
                    {p.overdue > 0 && (
                      <Text style={styles.overdue}> · {p.overdue} overdue</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {projects.length === 0 && (
            <Text style={styles.empty}>No tasks yet — nothing to group.</Text>
          )}

          <Text style={styles.footnote}>
            Projects come from each task's SECTION field. * = spans more than one goal.
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
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 4,
    marginBottom: 6,
    overflow: 'hidden',
  },
  rowActive: { borderColor: COLORS.accent, backgroundColor: COLORS.bgElevated },
  goalBar: { width: 3, alignSelf: 'stretch' },
  rowBody: { flex: 1, paddingHorizontal: 10, paddingVertical: 9 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 13, fontFamily: FONTS.body, color: COLORS.textPrimary },
  nameUnsorted: { color: COLORS.textMuted, fontStyle: 'italic' },
  goalTag: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 1, paddingLeft: 8 },
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
  empty: {
    textAlign: 'center', marginTop: 40,
    fontSize: 11, fontFamily: FONTS.mono, color: COLORS.textFaint,
  },
  footnote: {
    marginTop: 14, paddingHorizontal: 4,
    fontSize: 8, fontFamily: FONTS.mono, letterSpacing: 0.5,
    color: COLORS.textFaint, lineHeight: 13,
  },
});
