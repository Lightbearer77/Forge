import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS } from '../lib/theme';
import { GOALS } from '../lib/model';
import {
  dashboardStats, taskById, milestoneProgress,
  sortMilestonesForList, applyMsFilters, msFilterCount, MS_SORT_MODES, MS_SORT_LABELS,
} from '../lib/selectors';
import { gregToGreek, fmtGreek } from '../lib/constants';
import UnboundTimeDonut from './UnboundTimeDonut';
import OutputChart from './OutputChart';
import MilestoneFilterBar from './MilestoneFilterBar';

export default function DashboardView({
  tasks, milestones = [], today, onEdit, onEditMilestone, onToggleMilestone, onAddMilestone,
  msFilters, onMsFiltersChange, msSortBy, onMsSortByChange,
}) {
  const stats = useMemo(() => dashboardStats(tasks, today), [tasks, today]);
  const byId = useMemo(() => taskById(tasks), [tasks]);
  const [msSortMenuOpen, setMsSortMenuOpen] = useState(false);

  // Total counts are always over the FULL live set, independent of the
  // filter — the header should read as ground truth, not as "however many
  // happen to be showing right now."
  const liveMs = useMemo(() => milestones.filter(m => !m.deleted), [milestones]);
  const doneMsCount = liveMs.filter(m => m.completed).length;
  const openMsCount = liveMs.length - doneMsCount;

  const shownMs = useMemo(
    () => sortMilestonesForList(applyMsFilters(milestones, msFilters), msSortBy),
    [milestones, msFilters, msSortBy]
  );
  const msActiveFilters = msFilterCount(msFilters);

  const g = gregToGreek(today);
  const monthName = g?.isPlanningDay ? 'Planning' : (g?.monthName || 'month');

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.statGrid}>
        <Stat label="OPEN" value={stats.open} />
        <Stat label="IN PROGRESS" value={stats.inProgress} color={COLORS.ok} />
        <Stat label={`DONE · ${monthName.toUpperCase()}`} value={stats.doneThisMonth} color={COLORS.accent} />
        <Stat label="OVERDUE" value={stats.overdue.length}
          color={stats.overdue.length > 0 ? COLORS.priorityHigh : undefined} />
      </View>

      <UnboundTimeDonut tasks={tasks} today={today} />
      <OutputChart tasks={tasks} today={today} />

      <Text style={styles.sectionTitle}>BY GOAL</Text>
      {GOALS.map(goal => {
        const s = stats.byGoal[goal] || { open: 0, doneThisMonth: 0 };
        const total = s.open + s.doneThisMonth;
        const ratio = total > 0 ? s.doneThisMonth / total : 0;
        return (
          <View key={goal} style={styles.goalRow}>
            <Text style={[styles.goalTag, { color: GOAL_COLORS[goal] }]}>{goal}</Text>
            <View style={styles.goalBarTrack}>
              <View style={[styles.goalBarFill, {
                width: `${Math.round(ratio * 100)}%`,
                backgroundColor: GOAL_COLORS[goal],
              }]} />
            </View>
            <Text style={styles.goalNums}>{s.doneThisMonth}✓ · {s.open} open</Text>
          </View>
        );
      })}

      <View style={{ marginTop: 20 }}>
        <Text style={styles.sectionTitle}>MILESTONES · {openMsCount} OPEN · {doneMsCount} DONE</Text>

        <View style={styles.msControls}>
          <View style={styles.sortWrap}>
            <TouchableOpacity onPress={() => setMsSortMenuOpen(o => !o)} style={styles.sortTrigger}>
              <Text style={styles.sortTriggerText}>
                SORT: {MS_SORT_LABELS[msSortBy].toUpperCase()} {msSortMenuOpen ? '▴' : '▾'}
              </Text>
            </TouchableOpacity>
            {msSortMenuOpen && (
              <View style={styles.sortMenu}>
                {MS_SORT_MODES.map(mode => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => { onMsSortByChange(mode); setMsSortMenuOpen(false); }}
                    style={styles.sortMenuItem}
                  >
                    <Text style={[styles.sortMenuItemText, mode === msSortBy && { color: COLORS.accent }]}>
                      {MS_SORT_LABELS[mode]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <MilestoneFilterBar filters={msFilters} onChange={onMsFiltersChange} />
        </View>

        {msActiveFilters > 0 && (
          <Text style={styles.msResultCount}>
            {shownMs.length} shown · {msActiveFilters} filter{msActiveFilters === 1 ? '' : 's'} active
          </Text>
        )}

        {shownMs.map(ms => {
          const prog = milestoneProgress(ms, byId);
          return (
            <TouchableOpacity key={ms.id} style={styles.msRow} onPress={() => onEditMilestone(ms)}>
              <TouchableOpacity
                onPress={() => onToggleMilestone(ms)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[
                  styles.msCheck,
                  ms.completed && {
                    backgroundColor: GOAL_COLORS[ms.goal] || COLORS.accent,
                    borderColor: GOAL_COLORS[ms.goal] || COLORS.accent,
                  },
                ]}
              >
                {ms.completed && <Text style={styles.msCheckMark}>✓</Text>}
              </TouchableOpacity>
              <Text style={[styles.msDiamond, { color: GOAL_COLORS[ms.goal] || COLORS.textMuted }]}>◆</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.msName, ms.completed && styles.msNameDone]} numberOfLines={1}>{ms.name}</Text>
                <Text style={styles.msSub}>
                  {ms.msTag ? `${ms.msTag} · ` : ''}
                  {ms.dueDate ? `due ${fmtGreek(ms.dueDate)}` : 'no target'}
                  {prog.total > 0 ? ` · ${prog.done}/${prog.total} tasks` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {shownMs.length === 0 && (
          <Text style={styles.emptyText}>
            {msActiveFilters > 0 ? 'No milestones match the current filters.' : 'No milestones yet.'}
          </Text>
        )}
        <TouchableOpacity onPress={onAddMilestone} style={styles.msAdd}>
          <Text style={styles.msAddText}>＋ NEW MILESTONE</Text>
        </TouchableOpacity>
      </View>

      <TaskListSection title="OVERDUE" tasks={stats.overdue} today={today}
        onEdit={onEdit} tint={COLORS.priorityHigh} empty="Nothing overdue." />
      <TaskListSection title="DUE SOON · NEXT 7 DAYS" tasks={stats.dueSoon} today={today}
        onEdit={onEdit} empty="Nothing due in the next week." />
    </ScrollView>
  );
}

function Stat({ label, value, color }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TaskListSection({ title, tasks, onEdit, tint, empty }) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {tasks.length === 0 ? (
        <Text style={styles.emptyText}>{empty}</Text>
      ) : tasks.map(task => (
        <TouchableOpacity key={task.id} style={styles.taskRow} onPress={() => onEdit(task)}>
          <View style={[styles.taskBar, { backgroundColor: GOAL_COLORS[task.goal] || COLORS.textMuted }]} />
          <Text style={styles.taskName} numberOfLines={1}>{task.name}</Text>
          <Text style={[styles.taskDue, tint && { color: tint }]}>{fmtGreek(task.dueDate)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, paddingBottom: 40 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    flexBasis: '48%', flexGrow: 1,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 6,
    paddingVertical: 14, alignItems: 'center',
  },
  statValue: { fontSize: 26, fontFamily: FONTS.display, color: COLORS.textPrimary },
  statLabel: {
    fontSize: 8, fontFamily: FONTS.mono, letterSpacing: 1.5,
    color: COLORS.textMuted, marginTop: 4,
  },
  sectionTitle: {
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2,
    color: COLORS.textFaint, marginTop: 20, marginBottom: 8,
  },
  goalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  goalTag: { width: 24, fontSize: 11, fontFamily: FONTS.mono, letterSpacing: 1 },
  goalBarTrack: {
    flex: 1, height: 6, borderRadius: 3,
    backgroundColor: COLORS.bgElevated,
    overflow: 'hidden',
  },
  goalBarFill: { height: 6, borderRadius: 3 },
  goalNums: { width: 92, textAlign: 'right', fontSize: 9, fontFamily: FONTS.mono, color: COLORS.textMuted },
  taskRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 4,
    marginBottom: 6, overflow: 'hidden',
  },
  taskBar: { width: 3, alignSelf: 'stretch' },
  taskName: { flex: 1, fontSize: 13, fontFamily: FONTS.body, color: COLORS.textPrimary, padding: 10 },
  taskDue: { fontSize: 10, fontFamily: FONTS.mono, color: COLORS.textMuted, paddingRight: 12 },
  emptyText: { fontSize: 11, fontFamily: FONTS.mono, color: COLORS.textFaint, paddingVertical: 6 },
  msRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 4,
    marginBottom: 6, paddingVertical: 8, paddingHorizontal: 10, gap: 8,
  },
  msCheck: {
    width: 18, height: 18, borderWidth: 1.5,
    borderColor: COLORS.borderStrong, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  msDiamond: { fontSize: 12 },
  msName: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textPrimary },
  msNameDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  msSub: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 0.5, color: COLORS.textMuted, marginTop: 2 },
  msCheckMark: { fontSize: 11, color: COLORS.bgDeep, textAlign: 'center', lineHeight: 17 },
  msControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  msResultCount: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 0.5, color: COLORS.textFaint, marginBottom: 6 },
  sortWrap: { position: 'relative' },
  sortTrigger: {
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.bgSurface,
  },
  sortTriggerText: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 1, color: COLORS.textSecondary },
  sortMenu: {
    position: 'absolute', top: 32, left: 0, zIndex: 20,
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.borderMid,
    borderRadius: 4, paddingVertical: 4,
  },
  sortMenuItem: { paddingHorizontal: 12, paddingVertical: 9 },
  sortMenuItemText: { fontSize: 11, fontFamily: FONTS.mono, letterSpacing: 1, color: COLORS.textSecondary },
  msAdd: {
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    borderStyle: 'dashed', paddingVertical: 10, alignItems: 'center', marginTop: 4,
  },
  msAddText: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.accent },
});
