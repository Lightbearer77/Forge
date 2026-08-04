import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS } from '../lib/theme';
import { STATUS_LABELS } from '../lib/model';
import { fmtGreek } from '../lib/constants';
import {
  tasksInSection, milestonesInSection, taskById, childrenOf,
  subtaskProgress, isBlocked, isOverdue, milestoneProgress,
  sectionByKey, sectionLabel, UNSORTED_ID,
} from '../lib/selectors';

// Lanes in the order work actually moves, not storage order.
const LANES = ['in-progress', 'todo', 'backlog', 'done'];

export default function SectionDetailView({
  sectionKey, tasks, milestones = [], today,
  onEditTask, onToggleTask, onEditMilestone, onToggleMilestone, onClose,
}) {
  // sectionKey carries goal+section (see lib/selectors sectionKey/sectionByKey).
  // Recomputed from live tasks on every render, not frozen at selection
  // time — checking a task off updates these counters immediately. If the
  // section empties out entirely it stops appearing in buildGoalSections,
  // so fall back to a zeroed shell rather than crashing on undefined.
  const node = useMemo(
    () => sectionByKey(tasks, milestones, today, sectionKey),
    [tasks, milestones, today, sectionKey],
  );

  const [goal, rawSection] = useMemo(() => {
    const idx = sectionKey.indexOf('::');
    return idx === -1 ? ['G1', ''] : [sectionKey.slice(0, idx), sectionKey.slice(idx + 2)];
  }, [sectionKey]);

  const section = node || {
    id: sectionKey, goal, section: rawSection, name: sectionLabel(rawSection),
    total: 0, open: 0, done: 0, inProgress: 0, blocked: 0, overdue: 0,
    msTotal: 0, msDone: 0, progress: 0,
  };

  const mine = useMemo(
    () => tasksInSection(tasks, section.goal, section.section),
    [tasks, section.goal, section.section],
  );
  const myMs = useMemo(
    () => milestonesInSection(milestones, tasks, section.goal, section.section)
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')),
    [milestones, tasks, section.goal, section.section],
  );

  // Subtasks live under their parent here rather than as loose rows — the
  // whole point of the section view is structure, not a flat dump.
  const byId = useMemo(() => taskById(tasks), [tasks]);
  const childMap = useMemo(() => childrenOf(mine), [mine]);
  const mineIds = useMemo(() => new Set(mine.map(t => t.id)), [mine]);
  const roots = useMemo(
    () => mine.filter(t => !t.parentId || !mineIds.has(t.parentId)),
    [mine, mineIds],
  );

  const lanes = useMemo(() => {
    const g = {};
    for (const l of LANES) g[l] = [];
    for (const t of roots) (g[t.status] || (g[t.status] = [])).push(t);
    for (const l of Object.keys(g)) {
      g[l].sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return (a.sortOrder - b.sortOrder) || (a.createdAt - b.createdAt);
      });
    }
    return g;
  }, [roots]);

  const color = GOAL_COLORS[section.goal] || COLORS.textMuted;

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.back}>‹ BACK</Text>
          </TouchableOpacity>
          <Text style={[styles.goalChip, { color, borderColor: color }]}>
            {section.goal}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text
            style={[styles.sectionName, section.section === UNSORTED_ID && styles.nameUnsorted]}
          >
            {section.name}
          </Text>

          <View style={styles.track}>
            <View style={[styles.fill, {
              width: `${Math.round(section.progress * 100)}%`, backgroundColor: color,
            }]} />
          </View>

          <View style={styles.statRow}>
            <Stat label="OPEN" value={section.open} />
            <Stat label="DONE" value={section.done} color={COLORS.accent} />
            <Stat label="BLOCKED" value={section.blocked}
              color={section.blocked > 0 ? COLORS.priorityHigh : undefined} />
            <Stat label="OVERDUE" value={section.overdue}
              color={section.overdue > 0 ? COLORS.priorityHigh : undefined} />
          </View>

          {myMs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>MILESTONES · {myMs.length}</Text>
              {myMs.map(ms => {
                const prog = milestoneProgress(ms, byId);
                return (
                  <TouchableOpacity
                    key={ms.id}
                    style={styles.msRow}
                    onPress={() => onEditMilestone(ms)}
                    activeOpacity={0.7}
                  >
                    <TouchableOpacity
                      onPress={() => onToggleMilestone(ms)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[styles.msCheck, ms.completed && {
                        backgroundColor: COLORS.accent, borderColor: COLORS.accent,
                      }]}
                    />
                    <Text style={[styles.msDiamond, { color: GOAL_COLORS[ms.goal] || COLORS.textMuted }]}>◆</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.msName, ms.completed && styles.strike]} numberOfLines={1}>
                        {ms.name}
                      </Text>
                      <Text style={styles.msSub}>
                        {ms.msTag ? `${ms.msTag} · ` : ''}
                        {ms.dueDate ? `due ${fmtGreek(ms.dueDate)}` : 'no target'}
                        {prog.total > 0 ? ` · ${prog.done}/${prog.total} tasks` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {LANES.map(lane => {
            const rows = lanes[lane] || [];
            if (rows.length === 0) return null;
            return (
              <View key={lane}>
                <Text style={styles.sectionTitle}>
                  {(STATUS_LABELS[lane] || lane).toUpperCase()} · {rows.length}
                </Text>
                {rows.map(t => (
                  <TaskLine
                    key={t.id}
                    task={t}
                    today={today}
                    blocked={isBlocked(t, byId)}
                    progress={subtaskProgress(t, childMap)}
                    childRows={childMap[t.id] || []}
                    onEditTask={onEditTask}
                    onToggleTask={onToggleTask}
                  />
                ))}
              </View>
            );
          })}

          {mine.length === 0 && (
            <Text style={styles.empty}>
              No tasks in this section. Set a {section.goal} task's SECTION to "{section.name}" to file it here.
            </Text>
          )}
        </ScrollView>
      </View>
    </View>
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

function TaskLine({ task, today, blocked, progress, childRows, onEditTask, onToggleTask }) {
  const done = task.status === 'done';
  const overdue = isOverdue(task, today);
  const color = GOAL_COLORS[task.goal] || COLORS.textMuted;

  return (
    <View style={styles.taskWrap}>
      <TouchableOpacity
        style={styles.taskRow}
        onPress={() => onEditTask(task)}
        activeOpacity={0.7}
      >
        <View style={[styles.taskBar, { backgroundColor: color }]} />
        <TouchableOpacity
          onPress={() => onToggleTask(task)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
          style={[styles.check, done && { backgroundColor: color, borderColor: color }]}
        >
          {done && <Text style={styles.checkMark}>✓</Text>}
        </TouchableOpacity>
        <View style={styles.taskBody}>
          <Text style={[styles.taskName, done && styles.strike]} numberOfLines={2}>
            {task.milestone ? '🏴 ' : ''}{task.name}
          </Text>
          <View style={styles.taskSub}>
            {blocked && <Text style={styles.blockedTag}>🔒 BLOCKED </Text>}
            {progress.total > 0 && (
              <Text style={styles.subText}>{progress.done}/{progress.total} sub · </Text>
            )}
            <Text style={[styles.subText, overdue && { color: COLORS.priorityHigh }]}>
              {task.dueDate ? `due ${fmtGreek(task.dueDate)}` : 'no date'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {childRows.map(c => (
        <TouchableOpacity
          key={c.id}
          style={styles.subRow}
          onPress={() => onEditTask(c)}
          activeOpacity={0.7}
        >
          <TouchableOpacity
            onPress={() => onToggleTask(c)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
            style={[styles.subCheck, c.status === 'done' && {
              backgroundColor: COLORS.accent, borderColor: COLORS.accent,
            }]}
          >
            {c.status === 'done' && <Text style={styles.subCheckMark}>✓</Text>}
          </TouchableOpacity>
          <Text
            style={[styles.subName, c.status === 'done' && styles.strike]}
            numberOfLines={1}
          >
            {c.name}
          </Text>
          {!!c.dueDate && <Text style={styles.subDue}>{fmtGreek(c.dueDate)}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.bgDeep, zIndex: 60 },
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  back: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.textMuted },
  goalChip: {
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 1,
    borderWidth: 1, borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  body: { padding: 12, paddingBottom: 60 },
  sectionName: { fontSize: 21, fontFamily: FONTS.display, color: COLORS.textPrimary },
  nameUnsorted: { color: COLORS.textMuted, fontStyle: 'italic' },
  track: {
    height: 4, borderRadius: 2, marginTop: 12,
    backgroundColor: COLORS.bgElevated, overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 2 },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: {
    flex: 1,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 6,
    paddingVertical: 10, alignItems: 'center',
  },
  statValue: { fontSize: 19, fontFamily: FONTS.display, color: COLORS.textPrimary },
  statLabel: {
    fontSize: 7, fontFamily: FONTS.mono, letterSpacing: 1.2,
    color: COLORS.textMuted, marginTop: 3,
  },
  sectionTitle: {
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2,
    color: COLORS.textFaint, marginTop: 22, marginBottom: 8,
  },
  taskWrap: { marginBottom: 6 },
  taskRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 4,
    paddingRight: 10, overflow: 'hidden',
  },
  taskBar: { width: 3, alignSelf: 'stretch' },
  check: {
    width: 18, height: 18, borderWidth: 1.5, borderColor: COLORS.borderStrong,
    borderRadius: 3, marginLeft: 9, marginVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: COLORS.bgDeep, fontSize: 12, fontWeight: '700', lineHeight: 14 },
  taskBody: { flex: 1, paddingHorizontal: 9, paddingVertical: 8 },
  taskName: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textPrimary },
  strike: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  taskSub: { flexDirection: 'row', alignItems: 'center', marginTop: 3, flexWrap: 'wrap' },
  subText: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 0.5, color: COLORS.textMuted },
  blockedTag: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 1, color: COLORS.priorityHigh },
  subRow: {
    flexDirection: 'row', alignItems: 'center',
    marginLeft: 22, marginTop: 4,
    backgroundColor: COLORS.bgDeep,
    borderLeftWidth: 1, borderLeftColor: COLORS.borderMid,
    paddingLeft: 10, paddingRight: 10, paddingVertical: 6,
  },
  subCheck: {
    width: 14, height: 14, borderWidth: 1.5, borderColor: COLORS.borderStrong,
    borderRadius: 2, alignItems: 'center', justifyContent: 'center',
  },
  subCheckMark: { color: COLORS.bgDeep, fontSize: 9, fontWeight: '700', lineHeight: 11 },
  subName: {
    flex: 1, fontSize: 12, fontFamily: FONTS.body,
    color: COLORS.textSecondary, paddingHorizontal: 8,
  },
  subDue: { fontSize: 9, fontFamily: FONTS.mono, color: COLORS.textMuted },
  msRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 4,
    marginBottom: 6, paddingVertical: 8, paddingHorizontal: 10, gap: 8,
  },
  msCheck: {
    width: 16, height: 16, borderWidth: 1.5,
    borderColor: COLORS.borderStrong, borderRadius: 8,
  },
  msDiamond: { fontSize: 11 },
  msName: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textPrimary },
  msSub: {
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 0.5,
    color: COLORS.textMuted, marginTop: 2,
  },
  empty: {
    textAlign: 'center', marginTop: 40, paddingHorizontal: 20,
    fontSize: 11, fontFamily: FONTS.mono, color: COLORS.textFaint, lineHeight: 18,
  },
});
