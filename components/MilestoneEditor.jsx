import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, FONTS, GOAL_COLORS } from '../lib/theme';
import { GOALS } from '../lib/model';
import { fmtGreekLong, fmtGreg, gregToGreek, todayISO } from '../lib/constants';
import { isoWeekTag } from '../lib/selectors';
import TaskPicker from './TaskPicker';

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function MilestoneEditor({ milestone, isNew, allTasks, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(milestone);
  const [showPicker, setShowPicker] = useState(false);
  const [linking, setLinking] = useState(false);
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const linkedTasks = (form.taskIds || [])
    .map(id => allTasks.find(t => t.id === id))
    .filter(Boolean);

  const handleSave = () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Give the milestone a name before saving.');
      return;
    }
    const final = { ...form, name: form.name.trim(), updatedAt: Date.now() };
    if (final.completed && !final.completedAt) final.completedAt = todayISO();
    if (!final.completed) final.completedAt = '';
    if (final.dueDate) {
      const g = gregToGreek(final.dueDate);
      final.month = g?.isPlanningDay ? 'PLANNING' : (g?.monthId || '');
      if (!final.msWeek) final.msWeek = `MS${isoWeekTag(final.dueDate)}`;
    }
    onSave(final);
  };

  const handleDelete = () => {
    Alert.alert('Delete milestone?', `"${form.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(form.id) },
    ]);
  };

  return (
    <View style={styles.backdrop}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: '90%' }}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.headerCancel}>CANCEL</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isNew ? 'New Milestone' : 'Edit Milestone'}</Text>
            <TouchableOpacity onPress={handleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.headerSave}>SAVE</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <TextInput
              value={form.name}
              onChangeText={(t) => update('name', t)}
              placeholder="Milestone name"
              placeholderTextColor={COLORS.textFaint}
              style={styles.nameInput}
              multiline
            />

            <Text style={styles.fieldLabel}>GOAL</Text>
            <View style={styles.chipRow}>
              {GOALS.map(g => (
                <TouchableOpacity
                  key={g}
                  onPress={() => update('goal', g)}
                  style={[styles.chip, {
                    backgroundColor: form.goal === g ? `${GOAL_COLORS[g]}22` : COLORS.bgSurface,
                    borderColor: form.goal === g ? GOAL_COLORS[g] : COLORS.borderMid,
                  }]}
                >
                  <Text style={[styles.chipText, { color: form.goal === g ? GOAL_COLORS[g] : COLORS.textMuted }]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>TARGET</Text>
                {form.dueDate ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.dateBtn}>
                      <Text style={styles.dateBtnText}>{fmtGreekLong(form.dueDate)} · {fmtGreg(form.dueDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => update('dueDate', '')}>
                      <Text style={{ color: COLORS.textFaint, fontSize: 13 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.dateAdd}>
                    <Text style={styles.dateAddText}>+ SET</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ width: 96 }}>
                <Text style={styles.fieldLabel}>MS TAG</Text>
                <TextInput
                  value={form.msTag}
                  onChangeText={(t) => update('msTag', t)}
                  placeholder="MS7"
                  placeholderTextColor={COLORS.textFaint}
                  style={styles.input}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>LINKED TASKS · {linkedTasks.length}</Text>
            {linkedTasks.map(t => (
              <View key={t.id} style={styles.linkRow}>
                <View style={[styles.linkBar, { backgroundColor: GOAL_COLORS[t.goal] || COLORS.textMuted }]} />
                <Text style={[styles.linkName, t.status === 'done' && styles.linkDone]} numberOfLines={1}>
                  {t.name}
                </Text>
                <TouchableOpacity
                  onPress={() => update('taskIds', form.taskIds.filter(id => id !== t.id))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.linkRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => setLinking(true)} style={styles.dateAdd}>
              <Text style={styles.dateAddText}>+ LINK TASK</Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>NOTES</Text>
            <TextInput
              value={form.notes}
              onChangeText={(t) => update('notes', t)}
              placeholder="Evidence, criteria, context…"
              placeholderTextColor={COLORS.textFaint}
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              multiline
            />

            {!isNew && (
              <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>DELETE MILESTONE</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {showPicker && (
            <DateTimePicker
              value={form.dueDate ? new Date(form.dueDate + 'T12:00:00') : new Date()}
              mode="date"
              display="default"
              onChange={(e, d) => {
                setShowPicker(false);
                if (e.type !== 'dismissed' && d) update('dueDate', toISO(d));
              }}
            />
          )}

          <TaskPicker
            visible={linking}
            tasks={allTasks}
            excludeIds={form.taskIds || []}
            title="Link a task"
            onPick={(t) => { update('taskIds', [...(form.taskIds || []), t.id]); setLinking(false); }}
            onClose={() => setLinking(false)}
          />
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
  sheet: {
    backgroundColor: COLORS.bgDeep,
    borderTopWidth: 1, borderColor: COLORS.borderMid,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  headerCancel: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.textMuted },
  headerTitle: { fontSize: 15, fontFamily: FONTS.display, color: COLORS.textPrimary },
  headerSave: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.accent },
  body: { padding: 16, paddingBottom: 32 },
  nameInput: {
    fontSize: 16, fontFamily: FONTS.body, color: COLORS.textPrimary,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderMid,
    paddingBottom: 8, marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2,
    color: COLORS.textFaint, marginTop: 16, marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 1.2 },
  dateBtn: {
    flex: 1, backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingHorizontal: 10, paddingVertical: 9,
  },
  dateBtnText: { fontSize: 11, fontFamily: FONTS.mono, color: COLORS.textSecondary },
  dateAdd: {
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    borderStyle: 'dashed', paddingVertical: 9, alignItems: 'center',
  },
  dateAddText: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: COLORS.textPrimary,
  },
  linkRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 4,
    marginBottom: 5, overflow: 'hidden',
  },
  linkBar: { width: 3, alignSelf: 'stretch' },
  linkName: { flex: 1, fontSize: 12, fontFamily: FONTS.body, color: COLORS.textPrimary, padding: 9 },
  linkDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  linkRemove: { fontSize: 13, color: COLORS.textFaint, paddingHorizontal: 10 },
  deleteBtn: {
    marginTop: 24, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 4,
    paddingVertical: 11, alignItems: 'center',
  },
  deleteBtnText: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 2, color: COLORS.danger },
});
