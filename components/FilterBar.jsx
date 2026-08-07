import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS, PRIORITY_COLORS } from '../lib/theme';
import { STATUSES, STATUS_LABELS, PRIORITIES, GOALS } from '../lib/model';
import { DEFAULT_FILTERS, filterCount } from '../lib/selectors';

// Shared filter control for List view and SectionDetailView. One component,
// two mount points — showGoals=false in section detail, since a section is
// already goal-scoped and a goal filter there would be meaningless at best,
// contradictory at worst. When hidden, `filters.goals` passes through
// untouched on CLEAR so a List view goal selection survives a trip into a
// section and back.
export default function FilterBar({ filters, onChange, showGoals = true }) {
  const [open, setOpen] = useState(false);
  const count = filterCount(filters);

  const toggleArrayValue = (key, value) => {
    const cur = filters[key] || [];
    const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
    onChange({ ...filters, [key]: next });
  };

  const toggleHideCompleted = () => {
    onChange({ ...filters, hideCompleted: !filters.hideCompleted });
  };

  const clear = () => {
    onChange({
      ...DEFAULT_FILTERS,
      // Preserve goal selection when this instance doesn't expose the goal
      // dimension — clearing section-detail filters shouldn't silently wipe
      // a goal filter set back in List view.
      goals: showGoals ? [] : (filters.goals || []),
    });
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={styles.trigger}>
        <Text style={styles.triggerText}>
          FILTER {open ? '▴' : '▾'}
        </Text>
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>

      {open && (
        <View style={styles.panel}>
          <TouchableOpacity onPress={toggleHideCompleted} style={styles.toggleRow}>
            <View style={[styles.toggleBox, filters.hideCompleted && styles.toggleBoxOn]}>
              <Text style={styles.toggleMark}>{filters.hideCompleted ? '✓' : ''}</Text>
            </View>
            <Text style={styles.toggleLabel}>Hide completed</Text>
          </TouchableOpacity>

          {showGoals && (
            <>
              <Text style={styles.groupLabel}>GOAL</Text>
              <View style={styles.chipRow}>
                {GOALS.map(g => {
                  const on = (filters.goals || []).includes(g);
                  const color = GOAL_COLORS[g] || COLORS.textMuted;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => toggleArrayValue('goals', g)}
                      style={[
                        styles.chip,
                        { borderColor: color },
                        on && { backgroundColor: `${color}33` },
                      ]}
                    >
                      <Text style={[styles.chipText, on && { color }]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.groupLabel}>STATUS</Text>
          <View style={styles.chipRow}>
            {STATUSES.map(s => {
              const on = (filters.statuses || []).includes(s);
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => toggleArrayValue('statuses', s)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && { color: COLORS.accent }]}>
                    {(STATUS_LABELS[s] || s).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.groupLabel}>PRIORITY</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map(p => {
              const on = (filters.priorities || []).includes(p);
              const color = PRIORITY_COLORS[p] || COLORS.textMuted;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => toggleArrayValue('priorities', p)}
                  style={[
                    styles.chip,
                    { borderColor: color },
                    on && { backgroundColor: `${color}33` },
                  ]}
                >
                  <Text style={[styles.chipText, on && { color }]}>{p.toUpperCase()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {count > 0 && (
            <TouchableOpacity onPress={clear} style={styles.clearRow}>
              <Text style={styles.clearText}>CLEAR FILTERS</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.bgSurface,
  },
  triggerText: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    letterSpacing: 1,
    color: COLORS.textSecondary,
  },
  badge: {
    marginLeft: 6,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    color: COLORS.bgDeep,
  },
  // Panel z-index stays below 100 (the TaskEditor/MilestoneEditor backdrop
  // layer) and below SectionDetailView's own 60 is fine since this panel is
  // a child of that view when mounted there — it only needs to clear the
  // sort menu (20) and its own siblings, not the app-wide overlay stack.
  panel: {
    position: 'absolute',
    top: 32,
    right: 0,
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: 4,
    padding: 12,
    minWidth: 220,
    zIndex: 30,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  toggleBox: {
    width: 18, height: 18, borderRadius: 3, borderWidth: 1,
    borderColor: COLORS.borderMid, alignItems: 'center', justifyContent: 'center',
  },
  toggleBoxOn: { borderColor: COLORS.accent, backgroundColor: `${COLORS.accent}22` },
  toggleMark: { fontSize: 11, color: COLORS.accent },
  toggleLabel: { fontSize: 12, fontFamily: FONTS.mono, color: COLORS.textPrimary },
  groupLabel: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    letterSpacing: 1.5,
    color: COLORS.textFaint,
    marginTop: 6,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipOn: {
    borderColor: COLORS.accent,
    backgroundColor: `${COLORS.accent}22`,
  },
  chipText: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
  },
  clearRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    alignItems: 'center',
  },
  clearText: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    letterSpacing: 1.5,
    color: COLORS.priorityHigh,
  },
});
