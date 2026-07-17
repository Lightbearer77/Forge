import { useState, useEffect, useCallback, Component } from 'react';
import {
  View, Text, StatusBar, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, FONTS, GOAL_COLORS } from './lib/theme';
import { fmtGreekLong, todayISO } from './lib/constants';
import { taskById, childrenOf, topLevelTasks, subtaskProgress, isBlocked } from './lib/selectors';
import { GOALS, newTask, newMilestone } from './lib/model';
import {
  initDatabase, getAllTasks, saveTask, saveTasks, deleteTask,
  getAllMilestones, saveMilestone, saveMilestones, deleteMilestone,
  getAllRunes, saveRune, saveRunes, ensureRunesSeeded,
} from './lib/storage';
import { fetchSyncFile, mergeSyncFile } from './lib/sync';
import TaskRow from './components/TaskRow';
import TaskEditor from './components/TaskEditor';
import MilestoneEditor from './components/MilestoneEditor';
import SettingsPanel from './components/SettingsPanel';
import KanbanView from './components/KanbanView';
import CalendarView from './components/CalendarView';
import DashboardView from './components/DashboardView';
import RunesView from './components/RunesView';

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
  { id: 'runes',    label: 'ᛟ' },
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
  const [milestones, setMilestones] = useState([]);
  const [runes, setRunes] = useState([]);
  const [msEditing, setMsEditing] = useState(null); // { ms, isNew }
  const [showSettings, setShowSettings] = useState(false);

  const today = todayISO();

  const reload = useCallback(async () => {
    const [t, m, r] = await Promise.all([getAllTasks(), getAllMilestones(), getAllRunes()]);
    setTasks(t);
    setMilestones(m);
    setRunes(r);
  }, []);

  const runSync = useCallback(async (quiet = false) => {
    setSyncing(true);
    try {
      const file = await fetchSyncFile();
      if (!file) {
        if (!quiet) Alert.alert('Sync', 'No sync file published yet.');
        return;
      }
      const [local, localMs, localRunes] = await Promise.all([
        getAllTasks({ includeDeleted: true }),
        getAllMilestones({ includeDeleted: true }),
        getAllRunes({ includeDeleted: true }),
      ]);
      const { changed, milestones: msRes, runes: runeRes, report } = mergeSyncFile(local, file, localMs, localRunes);
      if (changed.length > 0) await saveTasks(changed);
      if (msRes.changed.length > 0) await saveMilestones(msRes.changed);
      if (runeRes.changed.length > 0) await saveRunes(runeRes.changed);
      if (changed.length > 0 || msRes.changed.length > 0 || runeRes.changed.length > 0) await reload();
      if (!quiet) {
        const msLine = report.milestones.total > 0
          ? `\nMilestones: ${report.milestones.inserted} new · ${report.milestones.updated} updated · ${report.milestones.deletedApplied} removed`
          : '';
        Alert.alert(
          'Sync complete',
          `${report.inserted} new · ${report.updated} updated · ` +
          `${report.deletedApplied} removed\n` +
          `${report.localWon} local kept · ${report.skipped} skipped` + msLine
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
        await ensureRunesSeeded();
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

  const createSubtask = useCallback(async (parentId, name, goal) => {
    await saveTask(newTask({ name, goal, parentId }));
    await reload();
  }, [reload]);

  const toggleRuneEarned = useCallback(async (rune) => {
    const earned = !rune.earned;
    await saveRune({ ...rune, earned, earnedAt: earned ? today : '', updatedAt: Date.now() });
    await reload();
  }, [reload, today]);

  const openMilestone = useCallback((ms) => setMsEditing({ ms, isNew: false }), []);
  const startNewMilestone = useCallback(() => setMsEditing({ ms: newMilestone(), isNew: true }), []);

  const handleSaveMilestone = useCallback(async (final) => {
    await saveMilestone(final);
    await reload();
    setMsEditing(null);
  }, [reload]);

  const handleDeleteMilestone = useCallback(async (id) => {
    await deleteMilestone(id);
    await reload();
    setMsEditing(null);
  }, [reload]);

  const toggleMilestone = useCallback(async (ms) => {
    const completed = !ms.completed;
    await saveMilestone({
      ...ms,
      completed,
      completedAt: completed ? today : '',
      updatedAt: Date.now(),
    });
    await reload();
  }, [reload, today]);
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

  const byId = taskById(tasks);
  const childMap = childrenOf(tasks);
  const topTasks = topLevelTasks(tasks);

  const sorted = [...topTasks].sort((a, b) =>
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
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => runSync(false)}
            disabled={syncing}
            style={[styles.syncBtn, syncing && { opacity: 0.4 }]}
          >
            <Text style={styles.syncBtnText}>{syncing ? 'SYNCING…' : '⟳ SYNC'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.syncBtn}>
            <Text style={styles.syncBtnText}>⚙</Text>
          </TouchableOpacity>
        </View>
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
                blocked={isBlocked(item, byId)}
                progress={subtaskProgress(item, childMap)}
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
        <CalendarView
          tasks={tasks} milestones={milestones} today={today}
          onEdit={openEditor} onEditMilestone={openMilestone}
          onAddForDate={startNewForDate}
        />
      )}

      {viewMode === 'dash' && (
        <DashboardView
          tasks={tasks} milestones={milestones} today={today}
          onEdit={openEditor} onEditMilestone={openMilestone}
          onToggleMilestone={toggleMilestone} onAddMilestone={startNewMilestone}
        />
      )}

      {viewMode === 'runes' && (
        <RunesView runes={runes} onToggleEarned={toggleRuneEarned} />
      )}

      {editing && (
        <TaskEditor
          task={editing.task}
          isNew={editing.isNew}
          allTasks={tasks}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setEditing(null)}
          onOpenTask={(t) => setEditing({ task: t, isNew: false })}
          onToggleChild={toggleDone}
          onCreateSubtask={createSubtask}
        />
      )}

      <SettingsPanel visible={showSettings} onClose={() => setShowSettings(false)} />

      {msEditing && (
        <MilestoneEditor
          milestone={msEditing.ms}
          isNew={msEditing.isNew}
          allTasks={tasks}
          onSave={handleSaveMilestone}
          onDelete={handleDeleteMilestone}
          onClose={() => setMsEditing(null)}
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
