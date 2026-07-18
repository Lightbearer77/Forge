import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, FONTS, GOAL_COLORS, PRIORITY_COLORS } from '../lib/theme';
import { GOALS, PRIORITIES, STATUSES, STATUS_LABELS } from '../lib/model';
import { fmtGreekLong, fmtGreg, gregToGreek, todayISO } from '../lib/constants';
import { isoWeekTag } from '../lib/selectors';
import TaskPicker from './TaskPicker';

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function TaskEditor({
  task, isNew, allTasks = [], onSave, onDelete, onClose,
  onOpenTask, onToggleChild, onCreateSubtask,
}) {
  const [form, setForm] = useState(task);
  const [picker, setPicker] = useState(null); // 'due' | 'start' | null
  const [pickingBlocker, setPickingBlocker] = useState(false);
  const [subDraft, setSubDraft] = useState('');

  const parent = form.parentId ? allTasks.find(t => t.id === form.parentId) : null;
  const children = allTasks.filter(t => t.parentId === form.id);
  const blockers = (form.blockedBy || [])
    .map(id => allTasks.find(t => t.id === id))
    .filter(Boolean);
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Give the task a name before saving.');
      return;
    }
    const final = { ...form, name: form.name.trim(), updatedAt: Date.now() };
    // Status is authoritative for completion
    if (final.status === 'done' && !final.completedAt) final.completedAt = todayISO();
    if (final.status !== 'done') final.completedAt = '';
    // Due date drives the Greek month / ISO week tags (the tagging spine)
    if (final.dueDate) {
      const g = gregToGreek(final.dueDate);
      final.month = g?.isPlanningDay ? 'PLANNING' : (g?.monthId || '');
      final.week = isoWeekTag(final.dueDate);
    }
    onSave(final);
  };

  const handleDelete = () => {
    Alert.alert('Delete task?', `"${form.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(form.id) },
    ]);
  };

  const onPick = (field) => (event, date) => {
    setPicker(null);
    if (event.type === 'dismissed' || !date) return;
    update(field, toISO(date));
  };

  const Chip = ({ active, color, label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, {
        backgroundColor: active ? `${color}22` : COLORS.bgSurface,
        borderColor: active ? color : COLORS.borderMid,
      }]}
    >
      <Text style={[styles.chipText, { color: active ? color : COLORS.textMuted }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const DateField = ({ label, field }) => (
    <View style={styles.dateField}>
      <Text style={styles.dateLabel}>{label}</Text>
      {form[field] ? (
        <View style={styles.dateRow}>
          <TouchableOpacity onPress={() => setPicker(field)} style={styles.dateBtn}>
            <Text style={styles.dateBtnText}>
              {fmtGreekLong(form[field])} · {fmtGreg(form[field])}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => update(field, '')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.dateClear}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setPicker(field)} style={styles.dateAdd}>
          <Text style={styles.dateAddText}>+ SET</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.backdrop}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.headerCancel}>CANCEL</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isNew ? 'New Task' : 'Edit Task'}</Text>
            <TouchableOpacity onPress={handleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.headerSave}>SAVE</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <TextInput
              value={form.name}
              onChangeText={(t) => update('name', t)}
              placeholder="Task name"
              placeholderTextColor={COLORS.textFaint}
              style={styles.nameInput}
              multiline
            />

            {parent && (
              <View style={styles.parentLine}>
                <Text style={styles.parentText} numberOfLines={1}>
                  SUBTASK OF · {parent.name}
                </Text>
                <TouchableOpacity onPress={() => update('parentId', '')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.parentDetach}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.fieldLabel}>GOAL</Text>
            <View style={styles.chipRow}>
              {GOALS.map(g => (
                <Chip key={g} active={form.goal === g} color={GOAL_COLORS[g]}
                  label={g} onPress={() => update('goal', g)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>STATUS</Text>
            <View style={styles.chipRow}>
              {STATUSES.map(s => (
                <Chip key={s} active={form.status === s} color={COLORS.accent}
                  label={STATUS_LABELS[s]} onPress={() => update('status', s)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>PRIORITY</Text>
            <View style={styles.chipRow}>
              {PRIORITIES.map(p => (
                <Chip key={p} active={form.priority === p} color={PRIORITY_COLORS[p]}
                  label={p} onPress={() => update('priority', p)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>FLAGS</Text>
            <View style={styles.chipRow}>
              <Chip
                active={!!form.milestone}
                color={COLORS.accent}
                label="🏴 MILESTONE TASK"
                onPress={() => update('milestone', !form.milestone)}
              />
            </View>

            <View style={styles.dateSection}>
              <DateField label="DUE" field="dueDate" />
              <DateField label="START" field="startDate" />
            </View>

            <Text style={styles.fieldLabel}>SECTION</Text>
            <TextInput
              value={form.section}
              onChangeText={(t) => update('section', t)}
              placeholder="Optional grouping"
              placeholderTextColor={COLORS.textFaint}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>BLOCKED BY · {blockers.length}</Text>
            {blockers.map(b => (
              <View key={b.id} style={styles.linkRow}>
                <Text style={[styles.linkName, b.status === 'done' && styles.linkDone]} numberOfLines={1}>
                  {b.status === 'done' ? '✓ ' : '🔒 '}{b.name}
                </Text>
                <TouchableOpacity
                  onPress={() => update('blockedBy', form.blockedBy.filter(id => id !== b.id))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.linkRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => setPickingBlocker(true)} style={styles.dashedAdd}>
              <Text style={styles.dashedAddText}>+ ADD BLOCKER</Text>
            </TouchableOpacity>

            {!isNew && (
              <>
                <Text style={styles.fieldLabel}>SUBTASKS · {children.length}</Text>
                {children.map(c => (
                  <View key={c.id} style={styles.linkRow}>
                    <TouchableOpacity
                      onPress={() => onToggleChild && onToggleChild(c)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[styles.subCheck, c.status === 'done' && { backgroundColor: COLORS.accent, borderColor: COLORS.accent }]}
                    >
                      {c.status === 'done' && <Text style={styles.subCheckMark}>✓</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => onOpenTask && onOpenTask(c)}>
                      <Text style={[styles.linkName, c.status === 'done' && styles.linkDone]} numberOfLines={1}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.subAddRow}>
                  <TextInput
                    value={subDraft}
                    onChangeText={setSubDraft}
                    placeholder="Quick subtask…"
                    placeholderTextColor={COLORS.textFaint}
                    style={[styles.input, { flex: 1 }]}
                    onSubmitEditing={() => {
                      const n = subDraft.trim();
                      if (n && onCreateSubtask) { onCreateSubtask(form.id, n, form.goal); setSubDraft(''); }
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      const n = subDraft.trim();
                      if (n && onCreateSubtask) { onCreateSubtask(form.id, n, form.goal); setSubDraft(''); }
                    }}
                    style={styles.subAddBtn}
                  >
                    <Text style={{ color: COLORS.accent, fontSize: 15 }}>＋</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>NOTES</Text>
            <TextInput
              value={form.notes}
              onChangeText={(t) => update('notes', t)}
              placeholder="Details, context, links…"
              placeholderTextColor={COLORS.textFaint}
              style={[styles.input, styles.notesInput]}
              multiline
            />

            {form.dueDate ? (
              <Text style={styles.tagPreview}>
                tags on save: {(() => {
                  const g = gregToGreek(form.dueDate);
                  const m = g?.isPlanningDay ? 'PLANNING' : g?.monthId;
                  return `#${m} · #${isoWeekTag(form.dueDate)}`;
                })()}
              </Text>
            ) : null}

            {!isNew && (
              <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>DELETE TASK</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <TaskPicker
            visible={pickingBlocker}
            tasks={allTasks.filter(t => t.id !== form.id)}
            excludeIds={form.blockedBy || []}
            title="Blocked by which task?"
            onPick={(t) => { update('blockedBy', [...(form.blockedBy || []), t.id]); setPickingBlocker(false); }}
            onClose={() => setPickingBlocker(false)}
          />

          {picker && (
            <DateTimePicker
              value={form[picker] ? new Date(form[picker] + 'T12:00:00') : new Date()}
              mode="date"
              display="default"
              onChange={onPick(picker)}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetWrap: { maxHeight: '92%' },
  sheet: {
    backgroundColor: COLORS.bgDeep,
    borderTopWidth: 1,
    borderColor: COLORS.borderMid,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  headerCancel: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.textMuted },
  headerTitle: { fontSize: 15, fontFamily: FONTS.display, color: COLORS.textPrimary },
  headerSave: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.accent },
  body: { padding: 16, paddingBottom: 220 },
  nameInput: {
    fontSize: 17,
    fontFamily: FONTS.body,
    color: COLORS.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderMid,
    paddingBottom: 8,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    letterSpacing: 2,
    color: COLORS.textFaint,
    marginTop: 16,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 1.2 },
  dateSection: { flexDirection: 'row', gap: 16, marginTop: 16 },
  dateField: { flex: 1 },
  dateLabel: {
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2,
    color: COLORS.textFaint, marginBottom: 8,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: {
    flex: 1,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingHorizontal: 10, paddingVertical: 9,
  },
  dateBtnText: { fontSize: 11, fontFamily: FONTS.mono, color: COLORS.textSecondary },
  dateClear: { fontSize: 13, color: COLORS.textFaint, paddingHorizontal: 2 },
  dateAdd: {
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    borderStyle: 'dashed',
    paddingVertical: 9, alignItems: 'center',
  },
  dateAddText: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: COLORS.textPrimary,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  tagPreview: {
    marginTop: 14,
    fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 1,
    color: COLORS.textFaint, textAlign: 'center',
  },
  parentLine: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 10, paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 4,
  },
  parentText: { flex: 1, fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 1, color: COLORS.textMuted },
  parentDetach: { fontSize: 12, color: COLORS.textFaint, paddingLeft: 8 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 4,
    marginBottom: 5, paddingRight: 10,
  },
  linkName: { flex: 1, fontSize: 12, fontFamily: FONTS.body, color: COLORS.textPrimary, padding: 9 },
  linkDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  linkRemove: { fontSize: 13, color: COLORS.textFaint, paddingLeft: 8 },
  dashedAdd: {
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    borderStyle: 'dashed', paddingVertical: 9, alignItems: 'center', marginTop: 2,
  },
  dashedAddText: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.textMuted },
  subCheck: {
    width: 18, height: 18, borderWidth: 1.5, borderColor: COLORS.borderStrong,
    borderRadius: 3, marginLeft: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  subCheckMark: { color: COLORS.bgDeep, fontSize: 11, fontWeight: '700', lineHeight: 13 },
  subAddRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 },
  subAddBtn: {
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingHorizontal: 11, paddingVertical: 7, backgroundColor: COLORS.bgElevated,
  },
  deleteBtn: {
    marginTop: 24,
    borderWidth: 1, borderColor: COLORS.danger, borderRadius: 4,
    paddingVertical: 11, alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.danger,
  },
});
