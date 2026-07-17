// ─── Task model: vocabulary, factory, normalization, web import ───
//
// Schema v1 carries the FULL web-Forge field superset so the eventual
// web→native import is lossless. Behavior ships by phase:
//   Eta   — core fields (name, goal, priority, status, dates, notes)
//   Iota  — parentId (subtasks), blockedBy (dependencies), milestone
// `level` is carried inert for import fidelity; it is pre-reformation
// residue and goes to ratify-or-retire at Iota. `recurrence` is carried
// inert; HabitNow owns recurring habits at this layer.

export const STATUSES = ['backlog', 'todo', 'in-progress', 'done'];
export const STATUS_LABELS = {
  backlog:       'Backlog',
  todo:          'To Do',
  'in-progress': 'In Progress',
  done:          'Done',
};

export const PRIORITIES = ['High', 'Mid', 'Low'];
export const GOALS = ['G1', 'G2', 'G3', 'G4'];

const genId = () =>
  `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const newTask = (overrides = {}) => {
  const now = Date.now();
  return {
    id: genId(),
    name: '',
    notes: '',
    goal: 'G1',
    priority: 'Mid',
    status: 'todo',
    section: '',
    level: 0,
    month: '',
    week: '',
    startDate: '',
    dueDate: '',
    parentId: '',
    blockedBy: [],
    milestone: false,
    recurrence: 'none',
    completed: false,
    completedAt: '',
    sortOrder: 0,
    deleted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const clampVocab = (v, list, fallback) => (list.includes(v) ? v : fallback);

// Bring any raw object (sync file entry, web import, old row) to a full,
// vocabulary-valid task. Returns null when there is no usable id.
// `status` is authoritative for completion: completed := (status === 'done').
export const normalizeTask = (raw) => {
  if (!raw || !str(raw.id)) return null;
  const status = clampVocab(str(raw.status), STATUSES, 'todo');
  const completed = status === 'done';
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    id: str(raw.id),
    name: str(raw.name).trim(),
    notes: str(raw.notes),
    goal: clampVocab(str(raw.goal), GOALS, 'G1'),
    priority: clampVocab(str(raw.priority), PRIORITIES, 'Mid'),
    status,
    section: str(raw.section),
    level: num(raw.level, 0),
    month: str(raw.month),
    week: str(raw.week),
    startDate: str(raw.startDate),
    dueDate: str(raw.dueDate),
    parentId: str(raw.parentId),
    blockedBy: Array.isArray(raw.blockedBy) ? raw.blockedBy.map(str).filter(Boolean) : [],
    milestone: !!raw.milestone,
    recurrence: str(raw.recurrence) || 'none',
    completed,
    completedAt: completed ? str(raw.completedAt) : '',
    sortOrder: num(raw.sortOrder, 0),
    deleted: !!raw.deleted,
    createdAt: num(raw.createdAt, Date.now()),
    updatedAt: num(raw.updatedAt, Date.now()),
  };
};

// ─── Milestones ───
// First-class objects (web store forge-pm-milestones-v6), linked to tasks
// via taskIds[]. Linked-task progress is DERIVED; `completed` stays a
// manual judgment toggle — the app never auto-completes a milestone.

export const newMilestone = (overrides = {}) => {
  const now = Date.now();
  return {
    id: `ms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    notes: '',
    goal: 'G1',
    month: '',
    dueDate: '',
    msTag: '',
    msWeek: '',
    taskIds: [],
    completed: false,
    completedAt: '',
    sortOrder: 0,
    deleted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

export const normalizeMilestone = (raw) => {
  if (!raw || !str(raw.id)) return null;
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const completed = !!raw.completed;
  return {
    id: str(raw.id),
    name: str(raw.name).trim(),
    notes: str(raw.notes),
    goal: clampVocab(str(raw.goal), GOALS, 'G1'),
    month: str(raw.month),
    dueDate: str(raw.dueDate),
    msTag: str(raw.msTag),
    msWeek: str(raw.msWeek),
    taskIds: Array.isArray(raw.taskIds) ? raw.taskIds.map(str).filter(Boolean) : [],
    completed,
    completedAt: completed ? str(raw.completedAt) : '',
    sortOrder: num(raw.sortOrder, 0),
    deleted: !!raw.deleted,
    createdAt: num(raw.createdAt, Date.now()),
    updatedAt: num(raw.updatedAt, Date.now()),
  };
};

export const fromWebMilestone = (w) => {
  if (!w) return null;
  const now = Date.now();
  return normalizeMilestone({
    id: w.id,
    name: w.name,
    notes: w.notes,
    goal: w.goal,
    month: w.month,
    dueDate: w.due,
    msTag: w.msTag,
    msWeek: w.msWeek,
    taskIds: w.taskIds,
    completed: w.completed,
    completedAt: w.completedDate,
    createdAt: now,
    updatedAt: now,
  });
};

// ─── Runestones ───
// One record per bead. Content (name/task/month/tag/adoptStatus) comes
// from lib/runeData.js (Connor's authored doc); this layer only adds the
// tracking fields: earned (manual, like milestone completion — never
// auto-derived), and an optional taskId link once a rune is folded into a
// real Forge task. Until fold-in, taskId stays empty and the bead is purely
// reference/display, untouched by the task graph.

export const newRune = (overrides = {}) => {
  const now = Date.now();
  return {
    id: `rune_${overrides.name || 'x'}`,
    name: '',
    glyph: '',
    domain: 'practical',
    task: '',
    month: '',
    tag: '',
    adoptStatus: '',
    taskId: '',
    earned: false,
    earnedAt: '',
    sortOrder: 0,
    deleted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

export const normalizeRune = (raw) => {
  if (!raw || !str(raw.id)) return null;
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const earned = !!raw.earned;
  return {
    id: str(raw.id),
    name: str(raw.name),
    glyph: str(raw.glyph),
    domain: str(raw.domain) || 'practical',
    task: str(raw.task),
    month: str(raw.month),
    tag: str(raw.tag),
    adoptStatus: str(raw.adoptStatus),
    taskId: str(raw.taskId),
    earned,
    earnedAt: earned ? str(raw.earnedAt) : '',
    sortOrder: num(raw.sortOrder, 0),
    deleted: !!raw.deleted,
    createdAt: num(raw.createdAt, Date.now()),
    updatedAt: num(raw.updatedAt, Date.now()),
  };
};

// Web-Forge (localStorage forge-pm-tasks-v5) → native field mapping.
// Web tasks carry no updatedAt; import time becomes their timestamp so
// LWW sync behaves deterministically afterwards.
export const fromWebTask = (w) => {
  if (!w) return null;
  const now = Date.now();
  return normalizeTask({
    id: w.id,
    name: w.name,
    notes: w.notes,
    goal: w.goal,
    priority: w.priority,
    status: w.status,
    section: w.section,
    level: w.level,
    month: w.month,
    week: w.week,
    startDate: w.start,
    dueDate: w.due,
    parentId: w.parentId,
    blockedBy: w.blockedBy,
    milestone: w.milestone,
    recurrence: w.recurrence,
    completedAt: w.completedDate,
    createdAt: now,
    updatedAt: now,
  });
};
