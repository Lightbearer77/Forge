// ─── SQLite persistence for The Forge ───
import * as SQLite from 'expo-sqlite';
import { normalizeTask } from './model';

let dbPromise = null;
const getDb = () => {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync('forge.db');
  return dbPromise;
};

// ─── Schema versioning ───
// v1: full-superset tasks table (see lib/model.js for phasing notes).
// Pattern inherited from Hearth: CREATE reflects the current shape for
// fresh installs; MIGRATIONS bring older DBs forward; the runner stamps
// PRAGMA user_version either way, so both paths converge.
const SCHEMA_VERSION = 1;

const MIGRATIONS = {
  // 2: async (db) => { await db.execAsync("ALTER TABLE tasks ADD COLUMN ..."); },
};

const runMigrations = async (db) => {
  const row = await db.getFirstAsync('PRAGMA user_version');
  let current = row?.user_version ?? 0;
  while (current < SCHEMA_VERSION) {
    const next = current + 1;
    const migrate = MIGRATIONS[next];
    if (migrate) await migrate(db);
    await db.execAsync(`PRAGMA user_version = ${next}`);
    current = next;
  }
};

export const initDatabase = async () => {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      goal TEXT NOT NULL DEFAULT 'G1',
      priority TEXT NOT NULL DEFAULT 'Mid',
      status TEXT NOT NULL DEFAULT 'todo',
      section TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 0,
      month TEXT NOT NULL DEFAULT '',
      week TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      parent_id TEXT NOT NULL DEFAULT '',
      blocked_by TEXT NOT NULL DEFAULT '[]',
      milestone INTEGER NOT NULL DEFAULT 0,
      recurrence TEXT NOT NULL DEFAULT 'none',
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_due    ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_goal   ON tasks(goal);
  `);
  await runMigrations(db);
};

const parseJSONArray = (raw) => {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const rowToTask = (r) => ({
  id: r.id,
  name: r.name,
  notes: r.notes,
  goal: r.goal,
  priority: r.priority,
  status: r.status,
  section: r.section,
  level: r.level || 0,
  month: r.month,
  week: r.week,
  startDate: r.start_date,
  dueDate: r.due_date,
  parentId: r.parent_id,
  blockedBy: parseJSONArray(r.blocked_by),
  milestone: !!r.milestone,
  recurrence: r.recurrence || 'none',
  completed: !!r.completed,
  completedAt: r.completed_at,
  sortOrder: r.sort_order || 0,
  deleted: !!r.deleted,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const taskToParams = (t) => [
  t.id, t.name, t.notes, t.goal, t.priority, t.status, t.section,
  t.level || 0, t.month, t.week, t.startDate || '', t.dueDate || '',
  t.parentId || '', JSON.stringify(Array.isArray(t.blockedBy) ? t.blockedBy : []),
  t.milestone ? 1 : 0, t.recurrence || 'none',
  t.completed ? 1 : 0, t.completedAt || '',
  t.sortOrder || 0, t.deleted ? 1 : 0,
  t.createdAt || Date.now(), t.updatedAt || Date.now(),
];

const UPSERT_SQL = `
  INSERT INTO tasks (id, name, notes, goal, priority, status, section,
    level, month, week, start_date, due_date, parent_id, blocked_by,
    milestone, recurrence, completed, completed_at, sort_order, deleted,
    created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    notes = excluded.notes,
    goal = excluded.goal,
    priority = excluded.priority,
    status = excluded.status,
    section = excluded.section,
    level = excluded.level,
    month = excluded.month,
    week = excluded.week,
    start_date = excluded.start_date,
    due_date = excluded.due_date,
    parent_id = excluded.parent_id,
    blocked_by = excluded.blocked_by,
    milestone = excluded.milestone,
    recurrence = excluded.recurrence,
    completed = excluded.completed,
    completed_at = excluded.completed_at,
    sort_order = excluded.sort_order,
    deleted = excluded.deleted,
    updated_at = excluded.updated_at
`;

// Live tasks only, unless tombstones are explicitly requested (the sync
// merge needs them so an old file entry cannot resurrect a deleted task).
export const getAllTasks = async ({ includeDeleted = false } = {}) => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    includeDeleted
      ? 'SELECT * FROM tasks ORDER BY sort_order, created_at'
      : 'SELECT * FROM tasks WHERE deleted = 0 ORDER BY sort_order, created_at'
  );
  return rows.map(rowToTask);
};

// Writes exactly the task given — including updatedAt. Local edits must
// set updatedAt = Date.now() BEFORE calling; the sync path passes through
// merge-decided timestamps untouched.
export const saveTask = async (task) => {
  const t = normalizeTask(task);
  if (!t) return;
  const db = await getDb();
  await db.runAsync(UPSERT_SQL, taskToParams(t));
};

export const saveTasks = async (tasks) => {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const task of tasks) {
      const t = normalizeTask(task);
      if (!t) continue;
      await db.runAsync(UPSERT_SQL, taskToParams(t));
    }
  });
};

// Deletion is a tombstone, never a row removal — sync propagates it.
export const deleteTask = async (id) => {
  const db = await getDb();
  await db.runAsync(
    'UPDATE tasks SET deleted = 1, updated_at = ? WHERE id = ?',
    [Date.now(), id]
  );
};
