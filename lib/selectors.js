// ─── Pure task selectors: grouping, date mapping, dashboard stats ───
// No React, no SQLite — everything here is covered by the test suite.

import { STATUSES, GOALS, PRIORITIES } from './model';
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

// ─── Sections (Asana model: goal = project, section = section) ───
// ADOPT-FIRST: still no Project entity, no foreign keys, no schema or sync
// change. The existing `goal` field is the project; the existing `section`
// field is the section within it. A section is therefore scoped to a
// single goal — the same section NAME under two different goals (e.g.
// "Identity & Practice" under both G1 and G2) is two distinct sections,
// not one that happens to repeat. That is why every node's identity is the
// (goal, section) pair, never the section string alone.
//
// Milestones have no section of their own. A milestone always carries its
// `goal` directly (no derivation needed there), and its section is DERIVED
// from the sections of its linked tasks — but only tasks that share the
// milestone's own goal count toward that derivation, since a milestone
// cannot sensibly inherit a section from a different project's task.
//
// Tasks with an empty section collect under UNSORTED_ID within their goal
// rather than vanishing — an unfiled task is still work.
export const UNSORTED_ID = '';
export const UNSORTED_LABEL = 'Unsorted';

export const sectionLabel = (id) => (id === UNSORTED_ID ? UNSORTED_LABEL : id);

// Stable composite id for a (goal, section) node. Section names are only
// unique within a goal, so this — not the bare section string — is what
// callers use to select/filter/link to a specific node.
export const sectionKey = (goal, section) => `${goal}::${section || UNSORTED_ID}`;

const live = (rows) => rows.filter(r => r && !r.deleted);

const topCounts = (counts) => {
  const keys = Object.keys(counts);
  if (keys.length === 0) return null;
  keys.sort((a, b) => (counts[b] - counts[a]) || a.localeCompare(b));
  return keys[0];
};

// A milestone's section within its own goal, derived from its linked
// tasks (counting only links that share the milestone's goal). Returns
// null when nothing can be derived — null means "no section", NOT
// "Unsorted"; the milestone simply doesn't attach to any node.
export const milestoneSectionId = (ms, byId) => {
  const ids = Array.isArray(ms.taskIds) ? ms.taskIds : [];
  const counts = {};
  for (const id of ids) {
    const t = byId.get(id);
    if (!t || t.deleted || t.goal !== ms.goal) continue;
    const s = t.section || UNSORTED_ID;
    counts[s] = (counts[s] || 0) + 1;
  }
  return topCounts(counts);
};

export const tasksInSection = (tasks, goal, section) =>
  live(tasks).filter(t => t.goal === goal && (t.section || UNSORTED_ID) === (section || UNSORTED_ID));

export const milestonesInSection = (milestones, tasks, goal, section) => {
  const byId = taskById(live(tasks));
  return live(milestones).filter(m =>
    m.goal === goal && milestoneSectionId(m, byId) === (section || UNSORTED_ID));
};

// Full sidebar payload: one node per goal (G1..G4, always present even at
// zero tasks), each carrying its sections sorted alphabetically with
// Unsorted pinned last. Counts on a section are ALL live tasks filed
// there (subtasks included) — matching how the rest of the app already
// counts (dashboardStats does the same); the visual task list in the
// detail view is what nests subtasks under their parent, not these totals.
export const buildGoalSections = (tasks, milestones = [], todayISO = '') => {
  const liveTasks = live(tasks);
  const byId = taskById(liveTasks);
  const buckets = new Map();

  const bucket = (goal, section) => {
    const key = sectionKey(goal, section);
    if (!buckets.has(key)) {
      buckets.set(key, {
        id: key, goal, section: section || UNSORTED_ID, name: sectionLabel(section),
        total: 0, open: 0, done: 0, inProgress: 0, blocked: 0, overdue: 0,
        msTotal: 0, msDone: 0,
      });
    }
    return buckets.get(key);
  };

  for (const t of liveTasks) {
    const b = bucket(t.goal, t.section);
    b.total++;
    if (t.status === 'done') b.done++;
    else {
      b.open++;
      if (t.status === 'in-progress') b.inProgress++;
      if (isBlocked(t, byId)) b.blocked++;
      if (todayISO && t.dueDate && t.dueDate < todayISO) b.overdue++;
    }
  }

  for (const m of live(milestones)) {
    const section = milestoneSectionId(m, byId);
    if (section === null) continue;
    const key = sectionKey(m.goal, section);
    if (!buckets.has(key)) continue; // no live task anchors this node — milestone floats unfiled
    const b = buckets.get(key);
    b.msTotal++;
    if (m.completed) b.msDone++;
  }

  const withProgress = [...buckets.values()].map(b => ({
    ...b, progress: b.total > 0 ? b.done / b.total : 0,
  }));

  const byGoal = {};
  for (const g of GOALS) byGoal[g] = [];
  for (const b of withProgress) byGoal[b.goal].push(b);

  return GOALS.map(g => {
    const sections = byGoal[g].sort((a, b) => {
      if (a.section === UNSORTED_ID) return 1;
      if (b.section === UNSORTED_ID) return -1;
      return a.section.localeCompare(b.section);
    });
    return {
      goal: g,
      sections,
      open: sections.reduce((a, s) => a + s.open, 0),
      total: sections.reduce((a, s) => a + s.total, 0),
    };
  });
};

// Single-node lookup by composite key, used by the detail view so it
// doesn't need to rebuild and search the whole tree itself.
export const sectionByKey = (tasks, milestones, todayISO, key) => {
  for (const g of buildGoalSections(tasks, milestones, todayISO)) {
    const found = g.sections.find(s => s.id === key);
    if (found) return found;
  }
  return null;
};

// ─── Search ───
// Case-insensitive substring match against name, notes, and section (the
// project field) — so searching a project name finds its tasks too.
// Operates over ALL live tasks, not just top-level ones: a matching subtask
// must be findable even though the unfiltered List view only shows
// top-level tasks. The caller (List view) decides whether to flatten
// hierarchy when a query is active; this function only filters.
export const matchesSearch = (task, query) => {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return (
    (task.name || '').toLowerCase().includes(q) ||
    (task.notes || '').toLowerCase().includes(q) ||
    (task.section || '').toLowerCase().includes(q)
  );
};

// Empty/whitespace query returns every live task, unfiltered (but still
// excludes tombstones) — "no search" and "search nothing away" are the
// same result.
export const searchTasks = (tasks, query) =>
  live(tasks).filter(t => matchesSearch(t, query));

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

// ─── Filters (List view + SectionDetailView, shared shape) ───
//
// Empty array in goals/statuses/priorities means UNCONSTRAINED — not
// "show nothing." Do not invert this: a populated default breaks silently
// the moment STATUSES/PRIORITIES vocab changes, and "is anything filtered?"
// becomes hard to compute. Composition across dimensions is strict AND —
// hideCompleted + statuses:['done'] legitimately yields zero results.
export const DEFAULT_FILTERS = {
  hideCompleted: false,
  goals: [],
  statuses: [],
  priorities: [],
};

const clampVocabArray = (arr, list) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    if (list.includes(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
};

// Defensive against null/undefined/malformed input (e.g. a corrupt or
// pre-feature settings value) — always returns a complete, well-typed
// object, never undefined for any key.
export const sanitizeFilters = (raw) => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FILTERS };
  return {
    hideCompleted: !!raw.hideCompleted,
    goals: clampVocabArray(raw.goals, GOALS),
    statuses: clampVocabArray(raw.statuses, STATUSES),
    priorities: clampVocabArray(raw.priorities, PRIORITIES),
  };
};

// Pure, non-mutating. Excludes tombstones like searchTasks/live() do.
// hideCompleted checks `status`, not the `completed` boolean — status is
// the authoritative field per the forge-sync.json protocol.
export const applyFilters = (tasks, filters) => {
  const f = sanitizeFilters(filters);
  return live(tasks).filter((t) => {
    if (f.hideCompleted && t.status === 'done') return false;
    if (f.goals.length > 0 && !f.goals.includes(t.goal)) return false;
    if (f.statuses.length > 0 && !f.statuses.includes(t.status)) return false;
    if (f.priorities.length > 0 && !f.priorities.includes(t.priority)) return false;
    return true;
  });
};

// Number of ACTIVE DIMENSIONS (max 4), not number of selected values —
// this drives the FilterBar's count badge.
export const filterCount = (filters) => {
  const f = sanitizeFilters(filters);
  let n = 0;
  if (f.hideCompleted) n++;
  if (f.goals.length > 0) n++;
  if (f.statuses.length > 0) n++;
  if (f.priorities.length > 0) n++;
  return n;
};
