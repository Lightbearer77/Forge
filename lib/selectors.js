// ─── Pure task selectors: grouping, date mapping, dashboard stats ───
// No React, no SQLite — everything here is covered by the test suite.

import { STATUSES, GOALS } from './model';
import { greekMonthRange, gregToGreek } from './constants';

// { backlog: [...], todo: [...], 'in-progress': [...], done: [...] }
export const groupByStatus = (tasks) => {
  const groups = {};
  for (const s of STATUSES) groups[s] = [];
  for (const t of tasks) {
    (groups[t.status] || (groups[t.status] = [])).push(t);
  }
  return groups;
};

export const isOverdue = (task, todayISO) =>
  !!task.dueDate && task.status !== 'done' && task.dueDate < todayISO;

// Map of dueDate ISO -> tasks, restricted to the given day list (a Greek
// month from greekMonthDays). Tasks without dueDate are ignored here.
export const tasksByDueDate = (tasks, dayISOs) => {
  const daySet = new Set(dayISOs);
  const map = {};
  for (const iso of dayISOs) map[iso] = [];
  for (const t of tasks) {
    if (t.dueDate && daySet.has(t.dueDate)) map[t.dueDate].push(t);
  }
  return map;
};

// ISO-8601 week tag (Monday-based) — 'W01'..'W53'. The Thursday trick:
// a date's ISO week is the week of its Thursday.
export const isoWeekTag = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  const day = (d.getDay() + 6) % 7;          // Mon=0..Sun=6
  d.setDate(d.getDate() - day + 3);          // shift to Thursday
  const jan1 = new Date(d.getFullYear(), 0, 1, 12);
  const week = Math.ceil(((d - jan1) / 86400000 + 1) / 7);
  return `W${String(week).padStart(2, '0')}`;
};

// Everything the dashboard shows, computed in one pass.
//   open           — not done
//   inProgress     — status in-progress
//   doneThisMonth  — completedAt inside today's Greek month
//   overdue        — open tasks with dueDate < today (sorted oldest first)
//   dueSoon        — open tasks due within the next `soonDays` days incl.
//                    today (sorted soonest first)
//   byGoal         — per-goal { open, doneThisMonth }
export const dashboardStats = (tasks, todayISO, soonDays = 7) => {
  const g = gregToGreek(todayISO);
  const range = g
    ? greekMonthRange(g.isPlanningDay ? 'PLANNING' : g.monthId, g.year)
    : null;

  const soonLimit = (() => {
    const d = new Date(todayISO + 'T12:00:00');
    d.setDate(d.getDate() + soonDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const stats = {
    open: 0,
    inProgress: 0,
    doneThisMonth: 0,
    overdue: [],
    dueSoon: [],
    byGoal: {},
  };

  for (const t of tasks) {
    const goal = stats.byGoal[t.goal] || (stats.byGoal[t.goal] = { open: 0, doneThisMonth: 0 });

    if (t.status !== 'done') {
      stats.open++;
      goal.open++;
      if (t.status === 'in-progress') stats.inProgress++;
      if (t.dueDate && t.dueDate < todayISO) stats.overdue.push(t);
      else if (t.dueDate && t.dueDate >= todayISO && t.dueDate <= soonLimit) stats.dueSoon.push(t);
    } else if (range && t.completedAt && t.completedAt >= range.start && t.completedAt <= range.end) {
      stats.doneThisMonth++;
      goal.doneThisMonth++;
    }
  }

  stats.overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  stats.dueSoon.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return stats;
};

// ─── Dependencies & subtasks ───
export const taskById = (tasks) => {
  const map = new Map();
  for (const t of tasks) map.set(t.id, t);
  return map;
};

// Blocked = at least one blocker that exists, is live, and is not done.
// Missing or tombstoned blockers do not block (stale references are inert).
export const isBlocked = (task, byId) => {
  if (!Array.isArray(task.blockedBy) || task.blockedBy.length === 0) return false;
  return task.blockedBy.some(id => {
    const b = byId.get(id);
    return !!b && !b.deleted && b.status !== 'done';
  });
};

export const childrenOf = (tasks) => {
  const map = {};
  for (const t of tasks) {
    if (t.parentId) (map[t.parentId] || (map[t.parentId] = [])).push(t);
  }
  return map;
};

export const subtaskProgress = (task, childMap) => {
  const kids = childMap[task.id] || [];
  return { done: kids.filter(k => k.status === 'done').length, total: kids.length };
};

// Top level = no parent, or parent missing/tombstoned (orphans surface
// rather than vanish).
export const topLevelTasks = (tasks) => {
  const byId = taskById(tasks);
  return tasks.filter(t => {
    if (!t.parentId) return true;
    const p = byId.get(t.parentId);
    return !p || p.deleted;
  });
};

// ─── Milestones ───
export const milestoneProgress = (ms, byId) => {
  const ids = Array.isArray(ms.taskIds) ? ms.taskIds : [];
  let done = 0, total = 0;
  for (const id of ids) {
    const t = byId.get(id);
    if (!t || t.deleted) continue;
    total++;
    if (t.status === 'done') done++;
  }
  return { done, total };
};

export const milestonesByDueDate = (milestones, dayISOs) => {
  const daySet = new Set(dayISOs);
  const map = {};
  for (const m of milestones) {
    if (m.dueDate && daySet.has(m.dueDate)) (map[m.dueDate] || (map[m.dueDate] = [])).push(m);
  }
  return map;
};

// ─── Projects ───
// ADOPT-FIRST: a "project" is a distinct value of the existing `section`
// field. No Project entity, no foreign keys, no schema or sync change —
// section already carries this meaning in the live data.
//
// Milestones have no section of their own, so a milestone's project is
// DERIVED from the sections of the tasks it links (taskIds). In the live
// data no milestone spans more than one section, so the derivation is
// unambiguous; where it ever is ambiguous, the most-linked section wins
// and ties break alphabetically so the result stays deterministic.
//
// Tasks with an empty section collect under UNSORTED_ID rather than
// vanishing — an unfiled task is still work.
export const UNSORTED_ID = '';
export const UNSORTED_LABEL = 'Unsorted';

export const projectLabel = (id) => (id === UNSORTED_ID ? UNSORTED_LABEL : id);

const live = (rows) => rows.filter(r => r && !r.deleted);

// section string -> count, highest first, alphabetical tiebreak
const topKey = (counts) => {
  const keys = Object.keys(counts);
  if (keys.length === 0) return null;
  keys.sort((a, b) => (counts[b] - counts[a]) || a.localeCompare(b));
  return keys[0];
};

// Map of taskId -> section, for milestone derivation.
export const sectionByTaskId = (tasks) => {
  const map = new Map();
  for (const t of live(tasks)) map.set(t.id, t.section || UNSORTED_ID);
  return map;
};

// A milestone's project id, derived from its linked tasks. Returns null when
// nothing can be derived (no links, or every link is missing/tombstoned) —
// null means "belongs to no project", NOT "belongs to Unsorted".
export const milestoneProjectId = (ms, secByTask) => {
  const ids = Array.isArray(ms.taskIds) ? ms.taskIds : [];
  const counts = {};
  for (const id of ids) {
    if (!secByTask.has(id)) continue;
    const s = secByTask.get(id);
    counts[s] = (counts[s] || 0) + 1;
  }
  return topKey(counts);
};

export const tasksInProject = (tasks, projectId) =>
  live(tasks).filter(t => (t.section || UNSORTED_ID) === projectId);

export const milestonesInProject = (milestones, tasks, projectId) => {
  const secByTask = sectionByTaskId(tasks);
  return live(milestones).filter(m => milestoneProjectId(m, secByTask) === projectId);
};

// Full sidebar payload: one row per project with the counts the UI shows.
// Sorted by open descending, then name — the projects with live work rise.
// Unsorted is pinned last regardless of size; it's a holding pen, not a project.
export const buildProjects = (tasks, milestones = [], todayISO = '') => {
  const liveTasks = live(tasks);
  const byId = taskById(liveTasks);
  const buckets = new Map();

  const bucket = (id) => {
    if (!buckets.has(id)) {
      buckets.set(id, {
        id,
        name: projectLabel(id),
        goal: 'G1',
        goalCounts: {},
        total: 0, open: 0, done: 0, inProgress: 0, blocked: 0, overdue: 0,
        msTotal: 0, msDone: 0,
      });
    }
    return buckets.get(id);
  };

  for (const t of liveTasks) {
    const p = bucket(t.section || UNSORTED_ID);
    p.total++;
    p.goalCounts[t.goal] = (p.goalCounts[t.goal] || 0) + 1;
    if (t.status === 'done') p.done++;
    else {
      p.open++;
      if (t.status === 'in-progress') p.inProgress++;
      if (isBlocked(t, byId)) p.blocked++;
      if (todayISO && t.dueDate && t.dueDate < todayISO) p.overdue++;
    }
  }

  const secByTask = sectionByTaskId(liveTasks);
  for (const m of live(milestones)) {
    const pid = milestoneProjectId(m, secByTask);
    if (pid === null || !buckets.has(pid)) continue;
    const p = buckets.get(pid);
    p.msTotal++;
    if (m.completed) p.msDone++;
  }

  const out = [...buckets.values()].map(p => {
    const { goalCounts, ...rest } = p;
    return {
      ...rest,
      // Sections mostly sit inside one goal, but 7 of them span two in the
      // live data. The dominant goal colors the row; it is a display hint,
      // never a reassignment of any task's own goal.
      goal: topKey(goalCounts) || 'G1',
      mixedGoals: Object.keys(goalCounts).length > 1,
      progress: p.total > 0 ? p.done / p.total : 0,
    };
  });

  out.sort((a, b) => {
    if (a.id === UNSORTED_ID) return 1;
    if (b.id === UNSORTED_ID) return -1;
    return (b.open - a.open) || a.name.localeCompare(b.name);
  });
  return out;
};

// ─── List view sorting ───
// Four modes for the List view's sort control. Every mode falls through to
// the same manual tiebreak (sortOrder, then createdAt) so ties never
// reshuffle unpredictably between renders.
export const SORT_MODES = ['due', 'goal', 'status', 'manual'];

export const SORT_LABELS = {
  due:    'Due Date',
  goal:   'Goal',
  status: 'Status',
  manual: 'Manual',
};

const GOAL_ORDER = Object.fromEntries(GOALS.map((g, i) => [g, i]));

// Status display order is deliberately not STATUSES's storage order —
// in-progress work surfaces first regardless of sort mode's tiebreak.
const STATUS_ORDER = { 'in-progress': 0, todo: 1, backlog: 2, done: 3 };

const byManual = (a, b) => (a.sortOrder - b.sortOrder) || (a.createdAt - b.createdAt);

// Pure, stable sort for the List view. Does not mutate its input.
//   due    — ascending by dueDate; undated tasks sort after all dated ones
//   goal   — G1..G4
//   status — in-progress, todo, backlog, done (the pre-sort-control default)
//   manual — sortOrder/createdAt only, no grouping
export const sortTasksForList = (tasks, mode) => {
  const list = [...tasks];
  if (mode === 'due') {
    list.sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || byManual(a, b);
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return byManual(a, b);
    });
  } else if (mode === 'goal') {
    list.sort((a, b) => ((GOAL_ORDER[a.goal] ?? 9) - (GOAL_ORDER[b.goal] ?? 9)) || byManual(a, b));
  } else if (mode === 'status') {
    list.sort((a, b) => ((STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)) || byManual(a, b));
  } else {
    list.sort(byManual);
  }
  return list;
};
