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
