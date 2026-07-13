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
