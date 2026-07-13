import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS, PRIORITY_COLORS } from '../lib/theme';
import { STATUS_LABELS } from '../lib/model';
import { fmtGreek } from '../lib/constants';
import { isOverdue } from '../lib/selectors';

export default function TaskRow({ task, today, blocked = false, progress = null, onToggleDone, onPress, onLongPress }) {
  const goalColor = GOAL_COLORS[task.goal] || COLORS.textMuted;
  const done = task.status === 'done';
  const overdue = isOverdue(task, today);

  return (
    <TouchableOpacity
      onPress={() => onPress(task)}
      onLongPress={() => onLongPress(task)}
      activeOpacity={0.7}
      style={styles.row}
    >
      <View style={[styles.goalBar, { backgroundColor: goalColor }]} />

      <TouchableOpacity
        onPress={() => onToggleDone(task)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
        style={[styles.checkbox, done && { backgroundColor: goalColor, borderColor: goalColor }]}
      >
        {done && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>

      <View style={styles.body}>
        <Text
          style={[styles.name, task.milestone && styles.nameMilestone, done && styles.nameDone]}
          numberOfLines={2}
        >
          {task.milestone ? '🏴 ' : ''}{task.name}
        </Text>
        <View style={styles.subRow}>
          <Text style={styles.subText}>{STATUS_LABELS[task.status] || task.status}</Text>
          {blocked && <Text style={styles.blockedTag}> 🔒 BLOCKED</Text>}
          {progress && progress.total > 0 && (
            <Text style={styles.progressTag}> · {progress.done}/{progress.total}</Text>
          )}
          {!!task.dueDate && (
            <Text style={[styles.subText, overdue && { color: COLORS.priorityHigh }]}>
              {' '}· due {fmtGreek(task.dueDate)}
            </Text>
          )}
          <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] || COLORS.textFaint }]} />
        </View>
      </View>

      <Text style={styles.goalTag}>{task.goal}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 4,
    marginBottom: 6,
    paddingRight: 12,
    overflow: 'hidden',
  },
  goalBar: {
    width: 3,
    alignSelf: 'stretch',
  },
  checkbox: {
    width: 20, height: 20,
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    borderRadius: 3,
    marginLeft: 10, marginVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  checkmark: {
    color: COLORS.bgDeep,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
  },
  body: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  name: {
    fontSize: 14,
    fontFamily: FONTS.body,
    color: COLORS.textPrimary,
  },
  nameDone: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  nameMilestone: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  blockedTag: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    letterSpacing: 1,
    color: COLORS.priorityHigh,
  },
  progressTag: {
    fontSize: 10,
    fontFamily: FONTS.mono,
    color: COLORS.textMuted,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  subText: {
    fontSize: 10,
    fontFamily: FONTS.mono,
    letterSpacing: 0.5,
    color: COLORS.textMuted,
  },
  priorityDot: {
    width: 6, height: 6,
    borderRadius: 3,
    marginLeft: 8,
  },
  goalTag: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    letterSpacing: 1,
    color: COLORS.textFaint,
  },
});
