import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, StyleSheet } from 'react-native';
import { COLORS, FONTS, GOAL_COLORS } from '../lib/theme';
import { STATUS_LABELS } from '../lib/model';

// Generic task chooser: used for "blocked by" and milestone task links.
export default function TaskPicker({ visible, tasks, excludeIds = [], title, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter(t => !excluded.has(t.id))
      .filter(t => !q || t.name.toLowerCase().includes(q))
      .slice(0, 60);
  }, [tasks, excluded, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks…"
            placeholderTextColor={COLORS.textFaint}
            style={styles.search}
            autoFocus
          />
          <FlatList
            data={results}
            keyExtractor={(t) => t.id}
            style={{ maxHeight: 380 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => onPick(item)}>
                <View style={[styles.bar, { backgroundColor: GOAL_COLORS[item.goal] || COLORS.textMuted }]} />
                <View style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 10 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowSub}>{STATUS_LABELS[item.status]}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No matching tasks.</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgDeep,
    borderTopWidth: 1, borderColor: COLORS.borderMid,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    padding: 16, paddingBottom: 28,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 14, fontFamily: FONTS.display, color: COLORS.textPrimary },
  close: { fontSize: 15, color: COLORS.textMuted },
  search: {
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: 4,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: COLORS.textPrimary, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 4,
    marginBottom: 5, overflow: 'hidden',
  },
  bar: { width: 3, alignSelf: 'stretch' },
  rowName: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textPrimary },
  rowSub: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 1, color: COLORS.textMuted, marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.textFaint, fontSize: 12, paddingVertical: 16 },
});
