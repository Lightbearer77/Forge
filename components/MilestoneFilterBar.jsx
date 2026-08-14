import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS } from '../lib/theme';
import { GOALS } from '../lib/model';
import { MS_DEFAULT_FILTERS, msFilterCount } from '../lib/selectors';

const PANEL_WIDTH = 200;

// Dashboard-only sibling to FilterBar — same trigger/badge/panel visual
// language, but scoped to what a milestone actually has: hideCompleted and
// goal. No statuses/priorities dimension exists on a milestone, so those
// controls simply don't appear here rather than being disabled/hidden
// versions of FilterBar's. Deliberately a separate component rather than
// an extension of FilterBar, which is the settled shared control for the
// List view + SectionDetailView task-filtering contract (see CLAUDE.md #11)
// — milestones don't share that contract and shouldn't reshape it.
export default function MilestoneFilterBar({ filters, onChange }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const triggerRef = useRef(null);
  const count = msFilterCount(filters);

  const openPanel = () => {
    if (triggerRef.current) {
      triggerRef.current.measureInWindow((x, y, width, height) => {
        setAnchor({ top: y + height + 4, left: Math.max(8, x + width - PANEL_WIDTH) });
        setOpen(true);
      });
    } else {
      setOpen(true);
    }
  };
  const closePanel = () => setOpen(false);

  const toggleGoal = (g) => {
    const cur = filters.goals || [];
    const next = cur.includes(g) ? cur.filter(v => v !== g) : [...cur, g];
    onChange({ ...filters, goals: next });
  };

  const toggleHideCompleted = () => {
    onChange({ ...filters, hideCompleted: !filters.hideCompleted });
  };

  const clear = () => onChange({ ...MS_DEFAULT_FILTERS });

  return (
    <View style={styles.wrap}>
      <TouchableOpacity ref={triggerRef} onPress={() => (open ? closePanel() : openPanel())} style={styles.trigger}>
        <Text style={styles.triggerText}>FILTER {open ? '▴' : '▾'}</Text>
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={closePanel} statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={closePanel} />

        {anchor && (
          <View style={[styles.panel, { top: anchor.top, left: anchor.left }]}>
            <TouchableOpacity onPress={toggleHideCompleted} style={styles.toggleRow}>
              <View style={[styles.toggleBox, filters.hideCompleted && styles.toggleBoxOn]}>
                <Text style={styles.toggleMark}>{filters.hideCompleted ? '✓' : ''}</Text>
              </View>
              <Text style={styles.toggleLabel}>Hide completed</Text>
            </TouchableOpacity>

            <Text style={styles.groupLabel}>GOAL</Text>
            <View style={styles.chipRow}>
              {GOALS.map(g => {
                const on = (filters.goals || []).includes(g);
                const color = GOAL_COLORS[g] || COLORS.textMuted;
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => toggleGoal(g)}
                    style={[styles.chip, { borderColor: color }, on && { backgroundColor: `${color}33` }]}
                  >
                    <Text style={[styles.chipText, on && { color }]}>{g}</Text>
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
      </Modal>
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
  triggerText: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 1, color: COLORS.textSecondary },
  badge: {
    marginLeft: 6, minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontFamily: FONTS.mono, color: COLORS.bgDeep },
  panel: {
    position: 'absolute',
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: 4,
    padding: 12,
    minWidth: PANEL_WIDTH,
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
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 1.5,
    color: COLORS.textFaint, marginTop: 6, marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 0.5, color: COLORS.textSecondary },
  clearRow: {
    marginTop: 10, paddingTop: 10, borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle, alignItems: 'center',
  },
  clearText: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 1.5, color: COLORS.priorityHigh },
});
