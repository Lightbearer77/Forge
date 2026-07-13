// ─── Pure task selectors: grouping, date mapping, dashboard stats ───
// No React, no SQLite — everything here is covered by the test suite.

import { STATUSES } from './model';
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
