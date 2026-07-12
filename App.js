import { useState, useEffect, useCallback, Component } from 'react';
import {
  View, Text, StatusBar, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, FONTS, GOAL_COLORS } from './lib/theme';
import { fmtGreekLong, todayISO } from './lib/constants';
import { GOALS, STATUSES, newTask } from './lib/model';
import { initDatabase, getAllTasks, saveTask, saveTasks, deleteTask } from './lib/storage';
import { fetchSyncFile, mergeSyncFile } from './lib/sync';
import TaskRow from './components/TaskRow';

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

const STATUS_ORDER = { 'in-progress': 0, todo: 1, backlog: 2, done: 3 };

function AppContent() {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState([]);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftGoal, setDraftGoal] = useState('G1');
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    setTasks(await getAllTasks());
  }, []);

  // Pull-merge from forge-sync.json. Silent when quiet=true (launch path);
  // reports via Alert when run from the Sync button.
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
    const t = newTask({ name, goal: draftGoal });
    await saveTask(t);
    setDraft('');
    await reload();
  }, [draft, draftGoal, reload]);

  const toggleDone = useCallback(async (task) => {
    const done = task.status !== 'done';
    await saveTask({
      ...task,
      status: done ? 'done' : 'todo',
      completedAt: done ? todayISO() : '',
      updatedAt: Date.now(),
    });
    await reload();
  }, [reload]);

  const cycleStatus = useCallback(async (task) => {
    const idx = STATUSES.indexOf(task.status);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    await saveTask({
      ...task,
      status: next,
      completedAt: next === 'done' ? todayISO() : '',
      updatedAt: Date.now(),
    });
    await reload();
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
          <Text style={styles.subtitle}>{fmtGreekLong(todayISO())}</Text>
        </View>
        <TouchableOpacity
          onPress={() => runSync(false)}
          disabled={syncing}
          style={[styles.syncBtn, syncing && { opacity: 0.4 }]}
        >
          <Text style={styles.syncBtnText}>{syncing ? 'SYNCING…' : '⟳ SYNC'}</Text>
        </TouchableOpacity>
      </View>

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
            onToggleDone={toggleDone}
            onCycleStatus={cycleStatus}
            onLongPress={confirmDelete}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing on the anvil. Add a task, or Sync to pull forge-sync.json.
          </Text>
        }
      />

      <Text style={styles.hint}>tap = cycle status · box = done · hold = delete</Text>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
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
