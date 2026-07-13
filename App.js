import { useState, useEffect, useCallback, Component } from 'react';
import {
  View, Text, StatusBar, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, FONTS, GOAL_COLORS } from './lib/theme';
import { fmtGreekLong, todayISO } from './lib/constants';
import { GOALS, newTask } from './lib/model';
import { initDatabase, getAllTasks, saveTask, saveTasks, deleteTask } from './lib/storage';
import { fetchSyncFile, mergeSyncFile } from './lib/sync';
import TaskRow from './components/TaskRow';
import TaskEditor from './components/TaskEditor';
import KanbanView from './components/KanbanView';
import CalendarView from './components/CalendarView';
import DashboardView from './components/DashboardView';

// ─── ErrorBoundary: crashes render on-screen, never a silent kick-out ───
class ErrorBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('Render crash:', err, info); }
  render() {
    if (this.state.err) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#16120e', padding: 20, paddingTop: 60 }}>
          <Text style={{ color: '#c9a84c', fontSize: 18, marginBottom: 12 }}>Render error</Text>
          <Text style={{ color: '#ede4d4', fontFamily: 'monospace', fontSize: 12, marginBottom: 16 }}>
            {String(this.state.err?.message || this.state.err)}
          </Text>
          <Text style={{ color: '#8a7a62', fontSize: 11, fontFamily: 'monospace' }}>
            {String(this.state.err?.stack || '').slice(0, 2000)}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ err: null })}
            style={{ marginTop: 24, padding: 12, borderWidth: 1, borderColor: '#3e3628', borderRadius: 4, alignItems: 'center' }}
          >
            <Text style={{ color: '#c4b49a', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>RETRY</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const VIEWS = [
  { id: 'list',     label: 'LIST' },
  { id: 'board',    label: 'BOARD' },
  { id: 'calendar', label: 'CAL' },
  { id: 'dash',     label: 'DASH' },
];

const STATUS_ORDER = { 'in-progress': 0, todo: 1, backlog: 2, done: 3 };

function AppContent() {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState([]);
  const [ready, setReady] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [draft, setDraft] = useState('');
  const [draftGoal, setDraftGoal] = useState('G1');
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState(null); // { task, isNew }

  const today = todayISO();

  const reload = useCallback(async () => {
    setTasks(await getAllTasks());
  }, []);

  const runSync = useCallback(async (quiet = false) => {
    setSyncing(true);
    try {
      const file = await fetchSyncFile();
      if (!file) {
        if (!quiet) Alert.alert('Sync', 'No sync file published yet.');
        return;
      }
      const local = await getAllTasks({ includeDeleted: true });
      const { changed, report } = mergeSyncFile(local, file);
      if (changed.length > 0) {
        await saveTasks(changed);
        await reload();
      }
      if (!quiet) {
        Alert.alert(
          'Sync complete',
          `${report.inserted} new · ${report.updated} updated · ` +
          `${report.deletedApplied} removed\n` +
          `${report.localWon} local kept · ${report.skipped} skipped`
        );
      }
    } catch (e) {
      if (!quiet) Alert.alert('Sync failed', String(e?.message || e));
      else console.log('[Forge] Launch sync skipped:', e?.message);
    } finally {
      setSyncing(false);
    }
  }, [reload]);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await reload();
      } catch (e) {
        console.warn('Init failed', e);
      } finally {
        setReady(true);
      }
      await runSync(true);
    })();
  }, []);

  const addTask = useCallback(async () => {
    const name = draft.trim();
    if (!name) return;
    await saveTask(newTask({ name, goal: draftGoal }));
    setDraft('');
    await reload();
  }, [draft, draftGoal, reload]);

  const toggleDone = useCallback(async (task) => {
    const done = task.status !== 'done';
    await saveTask({
      ...task,
      status: done ? 'done' : 'todo',
      completedAt: done ? today : '',
      updatedAt: Date.now(),
    });
    await reload();
  }, [reload, today]);

  const moveTask = useCallback(async (task, newStatus) => {
    await saveTask({
      ...task,
      status: newStatus,
      completedAt: newStatus === 'done' ? today : '',
      updatedAt: Date.now(),
    });
    await reload();
  }, [reload, today]);

  const openEditor = useCallback((task) => setEditing({ task, isNew: false }), []);
  const startNewForDate = useCallback((iso) => {
    setEditing({ task: newTask({ dueDate: iso, goal: draftGoal }), isNew: true });
  }, [draftGoal]);

  const handleSaveTask = useCallback(async (final) => {
    await saveTask(final);
    await reload();
    setEditing(null);
  }, [reload]);

  const handleDeleteTask = useCallback(async (id) => {
    await deleteTask(id);
    await reload();
    setEditing(null);
  }, [reload]);

  const confirmDelete = useCallback((task) => {
    Alert.alert('Delete task?', `"${task.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteTask(task.id); await reload(); },
      },
    ]);
  }, [reload]);

  const cycleDraftGoal = () => {
    const idx = GOALS.indexOf(draftGoal);
    setDraftGoal(GOALS[(idx + 1) % GOALS.length]);
  };

  const sorted = [...tasks].sort((a, b) =>
    (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
    || (a.sortOrder - b.sortOrder)
    || (a.createdAt - b.createdAt)
  );

  if (!ready) {
    return <View style={[styles.container, { paddingTop: insets.top }]} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bgDeep} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>THE FORGE</Text>
          <Text style={styles.subtitle}>{fmtGreekLong(today)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => runSync(false)}
          disabled={syncing}
          style={[styles.syncBtn, syncing && { opacity: 0.4 }]}
        >
          <Text style={styles.syncBtnText}>{syncing ? 'SYNCING…' : '⟳ SYNC'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.viewToggle}>
        {VIEWS.map(v => (
          <TouchableOpacity
            key={v.id}
            onPress={() => setViewMode(v.id)}
            style={[styles.viewChip, viewMode === v.id && styles.viewChipActive]}
          >
            <Text style={[styles.viewChipText, viewMode === v.id && { color: COLORS.accent }]}>
              {v.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'list' && (
        <>
          <View style={styles.addRow}>
            <TouchableOpacity
              onPress={cycleDraftGoal}
              style={[styles.goalChip, { borderColor: GOAL_COLORS[draftGoal] }]}
            >
              <Text style={[styles.goalChipText, { color: GOAL_COLORS[draftGoal] }]}>
                {draftGoal}
              </Text>
            </TouchableOpacity>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addTask}
              placeholder="Forge a task…"
              placeholderTextColor={COLORS.textFaint}
              style={styles.input}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={addTask} style={styles.addBtn}>
              <Text style={styles.addBtnText}>＋</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={sorted}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => (
              <TaskRow
                task={item}
                today={today}
                onToggleDone={toggleDone}
                onPress={openEditor}
                onLongPress={confirmDelete}
              />
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                Nothing on the anvil. Add a task, or Sync to pull forge-sync.json.
              </Text>
            }
          />
          <Text style={styles.hint}>tap = edit · box = done · hold = delete</Text>
        </>
      )}

      {viewMode === 'board' && (
        <KanbanView tasks={tasks} today={today} onEdit={openEditor} onMove={moveTask} />
      )}

      {viewMode === 'calendar' && (
        <CalendarView tasks={tasks} today={today} onEdit={openEditor} onAddForDate={startNewForDate} />
      )}

      {viewMode === 'dash' && (
        <DashboardView tasks={tasks} today={today} onEdit={openEditor} />
      )}

      {editing && (
        <TaskEditor
          task={editing.task}
          isNew={editing.isNew}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AppContent />
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.display,
    letterSpacing: 4,
    color: COLORS.accent,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: FONTS.mono,
    letterSpacing: 1,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  syncBtn: {
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncBtnText: {
    fontSize: 10,
    fontFamily: FONTS.mono,
    letterSpacing: 2,
    color: COLORS.textSecondary,
  },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: 4,
    overflow: 'hidden',
  },
  viewChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
  },
  viewChipActive: {
    backgroundColor: COLORS.bgElevated,
  },
  viewChipText: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    letterSpacing: 2,
    color: COLORS.textMuted,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  goalChip: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  goalChipText: {
    fontSize: 11,
    fontFamily: FONTS.mono,
    letterSpacing: 1,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  addBtn: {
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: {
    fontSize: 16,
    color: COLORS.accent,
  },
  empty: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 12,
    fontFamily: FONTS.mono,
    color: COLORS.textFaint,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  hint: {
    textAlign: 'center',
    fontSize: 9,
    fontFamily: FONTS.mono,
    letterSpacing: 1,
    color: COLORS.textFaint,
    paddingBottom: 6,
  },
});
