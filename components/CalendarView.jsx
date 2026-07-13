import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useWindowDimensions, Modal } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS } from '../lib/theme';
import {
  GREEK_MONTHS, greekMonthDays, gregToGreek, dayOfWeek,
  nextGreekMonth, prevGreekMonth, fmtGreekLong, fmtGreg,
} from '../lib/constants';
import { STATUS_LABELS } from '../lib/model';
import { tasksByDueDate, milestonesByDueDate } from '../lib/selectors';

const CELL_GAP = 2;
const PAD = 8;

export default function CalendarView({ tasks, milestones = [], today, onEdit, onEditMilestone, onAddForDate }) {
  const { width } = useWindowDimensions();
  const cellSize = (width - PAD * 2 - CELL_GAP * 6) / 7;

  const t = gregToGreek(today) || { monthId: 'M01', year: new Date().getFullYear() };
  const [view, setView] = useState({ monthId: t.isPlanningDay ? 'PLANNING' : t.monthId, year: t.year });
  const [sheetDate, setSheetDate] = useState(null);

  const days = useMemo(() => greekMonthDays(view.monthId, view.year), [view]);
  const dayMap = useMemo(() => tasksByDueDate(tasks, days), [tasks, days]);
  const msMap = useMemo(() => milestonesByDueDate(milestones, days), [milestones, days]);

  const monthMeta = view.monthId === 'PLANNING'
    ? { name: 'Planning Day', letter: '✦' }
    : GREEK_MONTHS.find(m => m.id === view.monthId);

  const leading = view.monthId === 'PLANNING' ? 0 : (dayOfWeek(days[0]) + 6) % 7;
  const cells = [
    ...Array.from({ length: leading }, (_, i) => ({ blank: true, key: `b${i}` })),
    ...days.map(iso => ({ iso, key: iso })),
  ];

  const sheetTasks = sheetDate ? (dayMap[sheetDate] || []) : [];
  const sheetMs = sheetDate ? (msMap[sheetDate] || []) : [];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.navRow}>
        <TouchableOpacity onPress={() => setView(v => prevGreekMonth(v.monthId, v.year))} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setView({ monthId: t.isPlanningDay ? 'PLANNING' : t.monthId, year: t.year })}>
          <Text style={styles.navTitle}>
            <Text style={{ color: COLORS.accent }}>{monthMeta.letter} </Text>
            {monthMeta.name} · {view.year}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setView(v => nextGreekMonth(v.monthId, v.year))} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dowRow}>
        {['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => (
          <Text key={d} style={[styles.dowText, { width: cellSize }]}>{d}</Text>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.gridWrap}>
        <View style={styles.grid}>
          {cells.map((c) => c.blank ? (
            <View key={c.key} style={{ width: cellSize, height: cellSize * 1.15 }} />
          ) : (
            <DayCell
              key={c.key}
              iso={c.iso}
              cellSize={cellSize}
              isToday={c.iso === today}
              tasks={dayMap[c.iso] || []}
              hasMilestone={(msMap[c.iso] || []).length > 0}
              onPress={() => setSheetDate(c.iso)}
            />
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!sheetDate} transparent animationType="slide" onRequestClose={() => setSheetDate(null)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setSheetDate(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <Text style={styles.sheetTitle}>{sheetDate ? fmtGreekLong(sheetDate) : ''}</Text>
            <Text style={styles.sheetSub}>{sheetDate ? fmtGreg(sheetDate) : ''}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {sheetMs.map(ms => (
                <TouchableOpacity
                  key={ms.id}
                  style={[styles.sheetRow, { borderColor: COLORS.accentDim }]}
                  onPress={() => { setSheetDate(null); onEditMilestone && onEditMilestone(ms); }}
                >
                  <View style={[styles.sheetRowBar, { backgroundColor: GOAL_COLORS[ms.goal] || COLORS.accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetRowName} numberOfLines={1}>◆ {ms.name}</Text>
                    <Text style={styles.sheetRowStatus}>MILESTONE{ms.msTag ? ` · ${ms.msTag}` : ''}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {sheetTasks.map(task => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.sheetRow}
                  onPress={() => { setSheetDate(null); onEdit(task); }}
                >
                  <View style={[styles.sheetRowBar, { backgroundColor: GOAL_COLORS[task.goal] || COLORS.textMuted }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetRowName, task.status === 'done' && styles.sheetRowDone]} numberOfLines={1}>
                      {task.name}
                    </Text>
                    <Text style={styles.sheetRowStatus}>{STATUS_LABELS[task.status]}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {sheetTasks.length === 0 && (
                <Text style={styles.sheetEmpty}>Nothing due this day.</Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.sheetAdd}
              onPress={() => { const d = sheetDate; setSheetDate(null); onAddForDate(d); }}
            >
              <Text style={styles.sheetAddText}>＋ ADD TASK DUE THIS DAY</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function DayCell({ iso, cellSize, isToday, tasks, hasMilestone, onPress }) {
  const g = gregToGreek(iso);
  const gregDay = new Date(iso + 'T12:00:00').getDate();
  const visible = tasks.slice(0, 2);
  const hidden = tasks.length - visible.length;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.cell, {
        width: cellSize,
        height: cellSize * 1.15,
        borderColor: isToday ? COLORS.accent : COLORS.borderSubtle,
        backgroundColor: isToday ? `${COLORS.accent}18` : COLORS.bgSurface,
      }]}
    >
      <View style={styles.cellHead}>
        <Text style={[styles.cellDay, isToday && { color: COLORS.accent }]}>
          {g?.isPlanningDay ? '✦' : g?.day}
        </Text>
        <Text style={styles.cellGreg}>{gregDay}</Text>
      </View>
      {hasMilestone && <Text style={styles.cellMs}>◆</Text>}
      {visible.map(task => (
        <View
          key={task.id}
          style={[styles.cellBanner, {
            backgroundColor: GOAL_COLORS[task.goal] || COLORS.textMuted,
            opacity: task.status === 'done' ? 0.4 : 1,
          }]}
        >
          <Text style={styles.cellBannerText} numberOfLines={1}>{task.name}</Text>
        </View>
      ))}
      {hidden > 0 && <Text style={styles.cellMore}>+{hidden}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  navBtn: { paddingHorizontal: 14, paddingVertical: 4 },
  navArrow: { fontSize: 22, color: COLORS.textSecondary },
  navTitle: { fontSize: 15, fontFamily: FONTS.display, color: COLORS.textPrimary },
  dowRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: PAD, marginBottom: 4 },
  dowText: {
    textAlign: 'center', fontSize: 8, fontFamily: FONTS.mono, letterSpacing: 1.5,
    color: COLORS.textFaint,
  },
  gridWrap: { paddingHorizontal: PAD, paddingBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP },
  cell: {
    borderWidth: 1, borderRadius: 3, padding: 3, overflow: 'hidden',
  },
  cellHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cellDay: { fontSize: 14, fontFamily: FONTS.display, color: COLORS.textPrimary },
  cellGreg: { fontSize: 7, fontFamily: FONTS.mono, color: COLORS.textFaint },
  cellMs: { position: 'absolute', top: 2, right: 3, fontSize: 8, color: COLORS.accent },
  cellBanner: {
    height: 11, borderRadius: 2, justifyContent: 'center',
    paddingHorizontal: 3, marginTop: 2,
  },
  cellBannerText: { fontSize: 7, fontWeight: '700', color: COLORS.bgDeep },
  cellMore: { fontSize: 7, fontFamily: FONTS.mono, color: COLORS.textMuted, textAlign: 'center', marginTop: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgDeep,
    borderTopWidth: 1, borderColor: COLORS.borderMid,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    padding: 16, paddingBottom: 28,
  },
  sheetTitle: { fontSize: 17, fontFamily: FONTS.display, color: COLORS.textPrimary },
  sheetSub: { fontSize: 10, fontFamily: FONTS.mono, color: COLORS.textMuted, marginTop: 2, marginBottom: 12 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 4,
    marginBottom: 6, overflow: 'hidden',
  },
  sheetRowBar: { width: 3, alignSelf: 'stretch' },
  sheetRowName: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textPrimary, paddingTop: 8, paddingHorizontal: 10 },
  sheetRowDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  sheetRowStatus: {
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 1,
    color: COLORS.textMuted, paddingBottom: 8, paddingHorizontal: 10, paddingTop: 2,
  },
  sheetEmpty: { textAlign: 'center', color: COLORS.textFaint, fontSize: 12, paddingVertical: 18 },
  sheetAdd: {
    marginTop: 10, borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    borderStyle: 'dashed', paddingVertical: 11, alignItems: 'center',
  },
  sheetAddText: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.accent },
});
