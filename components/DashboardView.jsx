import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS } from '../lib/theme';
import { GOALS } from '../lib/model';
import { dashboardStats, taskById, milestoneProgress } from '../lib/selectors';
import { gregToGreek, fmtGreek } from '../lib/constants';

export default function DashboardView({ tasks, milestones = [], today, onEdit, onEditMilestone, onToggleMilestone, onAddMilestone }) {
  const stats = useMemo(() => dashboardStats(tasks, today), [tasks, today]);
  const byId = useMemo(() => taskById(tasks), [tasks]);
  const openMs = useMemo(() =>
    milestones.filter(m => !m.completed)
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')),
    [milestones]);
  const doneMsCount = milestones.length - openMs.length;
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
        <Text style={styles.sectionTitle}>MILESTONES · {openMs.length} OPEN</Text>
        {openMs.map(ms => {
          const prog = milestoneProgress(ms, byId);
          return (
            <TouchableOpacity key={ms.id} style={styles.msRow} onPress={() => onEditMilestone(ms)}>
              <TouchableOpacity
                onPress={() => onToggleMilestone(ms)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.msCheck}
              />
              <Text style={[styles.msDiamond, { color: GOAL_COLORS[ms.goal] || COLORS.textMuted }]}>◆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.msName} numberOfLines={1}>{ms.name}</Text>
                <Text style={styles.msSub}>
                  {ms.msTag ? `${ms.msTag} · ` : ''}
                  {ms.dueDate ? `due ${fmtGreek(ms.dueDate)}` : 'no target'}
                  {prog.total > 0 ? ` · ${prog.done}/${prog.total} tasks` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {openMs.length === 0 && <Text style={styles.emptyText}>No open milestones.</Text>}
        {doneMsCount > 0 && (
          <Text style={styles.msDoneCount}>{doneMsCount} completed</Text>
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
  },
  msDiamond: { fontSize: 12 },
  msName: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textPrimary },
  msSub: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 0.5, color: COLORS.textMuted, marginTop: 2 },
  msDoneCount: { fontSize: 9, fontFamily: FONTS.mono, color: COLORS.textFaint, paddingVertical: 4 },
  msAdd: {
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    borderStyle: 'dashed', paddingVertical: 10, alignItems: 'center', marginTop: 4,
  },
  msAddText: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.accent },
});
