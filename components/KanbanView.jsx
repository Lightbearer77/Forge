import { View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS, PRIORITY_COLORS } from '../lib/theme';
import { STATUSES, STATUS_LABELS } from '../lib/model';
import { groupByStatus, isOverdue, taskById, childrenOf, topLevelTasks, subtaskProgress, isBlocked } from '../lib/selectors';
import { useMemo } from 'react';
import { fmtGreek } from '../lib/constants';

const STATUS_COLORS = {
  backlog: COLORS.textFaint,
  todo: COLORS.accent,
  'in-progress': COLORS.ok,
  done: COLORS.textMuted,
};

export default function KanbanView({ tasks, today, onEdit, onMove }) {
  const { width } = useWindowDimensions();
  const laneWidth = Math.min(width * 0.78, 340);
  // Lanes show top-level tasks; subtasks are managed inside their parent.
  const byId = useMemo(() => taskById(tasks), [tasks]);
  const childMap = useMemo(() => childrenOf(tasks), [tasks]);
  const groups = useMemo(() => groupByStatus(topLevelTasks(tasks)), [tasks]);

  return (
    <ScrollView
      horizontal
      snapToInterval={laneWidth + 10}
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.lanes}
    >
      {STATUSES.map((status) => (
        <View key={status} style={[styles.lane, { width: laneWidth }]}>
          <View style={styles.laneHeader}>
            <View style={[styles.laneDot, { backgroundColor: STATUS_COLORS[status] }]} />
            <Text style={styles.laneTitle}>{STATUS_LABELS[status].toUpperCase()}</Text>
            <Text style={styles.laneCount}>{groups[status].length}</Text>
          </View>
          <FlatList
            data={groups[status]}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <Card
                task={item} status={status} today={today}
                blocked={isBlocked(item, byId)}
                progress={subtaskProgress(item, childMap)}
                onEdit={onEdit} onMove={onMove}
              />
            )}
            ListEmptyComponent={<Text style={styles.laneEmpty}>—</Text>}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function Card({ task, status, today, blocked, progress, onEdit, onMove }) {
  const idx = STATUSES.indexOf(status);
  const overdue = isOverdue(task, today);
  return (
    <TouchableOpacity onPress={() => onEdit(task)} activeOpacity={0.7} style={styles.card}>
      <View style={[styles.cardBar, { backgroundColor: GOAL_COLORS[task.goal] || COLORS.textMuted }]} />
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, task.milestone && { color: COLORS.accent, fontWeight: '700' }]} numberOfLines={2}>
          {task.milestone ? '🏴 ' : ''}{blocked ? '🔒 ' : ''}{task.name}
        </Text>
        <View style={styles.cardFooter}>
          {progress?.total > 0 && (
            <Text style={styles.cardProgress}>{progress.done}/{progress.total}</Text>
          )}
          {!!task.dueDate && (
            <Text style={[styles.cardDue, overdue && { color: COLORS.priorityHigh }]}>
              {fmtGreek(task.dueDate)}
            </Text>
          )}
          <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] || COLORS.textFaint }]} />
          <View style={styles.moveBtns}>
            <TouchableOpacity
              disabled={idx === 0}
              onPress={() => onMove(task, STATUSES[idx - 1])}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Text style={[styles.moveArrow, idx === 0 && { opacity: 0.2 }]}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={idx === STATUSES.length - 1}
              onPress={() => onMove(task, STATUSES[idx + 1])}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Text style={[styles.moveArrow, idx === STATUSES.length - 1 && { opacity: 0.2 }]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  lanes: { padding: 12, gap: 10 },
  lane: {
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 6,
    padding: 8,
    alignSelf: 'flex-start',
    maxHeight: '100%',
  },
  laneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  laneDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  laneTitle: {
    flex: 1,
    fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 2,
    color: COLORS.textSecondary,
  },
  laneCount: { fontSize: 10, fontFamily: FONTS.mono, color: COLORS.textFaint },
  laneEmpty: { textAlign: 'center', color: COLORS.textFaint, paddingVertical: 16, fontSize: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 4,
    marginBottom: 6,
    overflow: 'hidden',
  },
  cardBar: { width: 3, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 9 },
  cardName: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textPrimary },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  cardDue: { fontSize: 10, fontFamily: FONTS.mono, color: COLORS.textMuted },
  cardProgress: { fontSize: 9, fontFamily: FONTS.mono, color: COLORS.textMuted, marginRight: 8 },
  priorityDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 8 },
  moveBtns: { flexDirection: 'row', marginLeft: 'auto', gap: 14, paddingRight: 2 },
  moveArrow: { fontSize: 16, color: COLORS.textMuted, lineHeight: 18 },
});
