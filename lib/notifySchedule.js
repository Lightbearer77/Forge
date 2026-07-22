// ─── Pure notification-trigger construction ───
// No expo/react-native imports live here on purpose: this is the part that
// decides WHAT fires and WHEN, so it stays unit-testable. lib/notifications.js
// wraps it with the expo-notifications scheduling calls.

export const CHANNELS = {
  tasks: 'forge-tasks',
  milestones: 'forge-milestones',
};

export const NOTIFY_DEFAULTS = {
  enabled: true,
  time: '09:00',     // local time-of-day for every reminder
  lead: [0, 1],      // days before the due date; 0 = on the day itself
};

export const MAX_SCHEDULED = 48;
export const HORIZON_DAYS = 90;

const pad = (n) => String(n).padStart(2, '0');

export const parseTime = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return { h: 9, min: 0 };
  return {
    h: Math.min(23, Math.max(0, parseInt(m[1], 10))),
    min: Math.min(59, Math.max(0, parseInt(m[2], 10))),
  };
};

// "0,1,3" -> [0,1,3]; invalid/empty -> default. Deduped, sorted, sane bounds.
export const parseLead = (s) => {
  if (s === undefined || s === null || String(s).trim() === '') return [...NOTIFY_DEFAULTS.lead];
  const out = String(s)
    .split(',')
    .map(x => parseInt(x.trim(), 10))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 30);
  if (out.length === 0) return [...NOTIFY_DEFAULTS.lead];
  return [...new Set(out)].sort((a, b) => a - b);
};

// Local-midday anchor avoids DST edge cases, then the configured time is set.
const atLocal = (iso, h, min) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  d.setHours(h, min, 0, 0);
  return d;
};

const dayWord = (lead) =>
  lead === 0 ? 'Due today' : lead === 1 ? 'Due tomorrow' : `Due in ${lead} days`;

const isOpenTask = (t) =>
  !t.deleted && t.status !== 'done' && !t.completed && !!t.dueDate;

const isOpenMilestone = (m) =>
  !m.deleted && !m.completed && !!m.dueDate;

/**
 * Build the full trigger list. Pure: same inputs -> same output.
 * Returns triggers sorted nearest-first and capped.
 */
export const buildTriggers = ({
  tasks = [],
  milestones = [],
  now = new Date(),
  time = NOTIFY_DEFAULTS.time,
  lead = NOTIFY_DEFAULTS.lead,
  horizonDays = HORIZON_DAYS,
  max = MAX_SCHEDULED,
} = {}) => {
  const { h, min } = parseTime(time);
  const leads = Array.isArray(lead) ? lead : parseLead(lead);
  const horizon = new Date(now.getTime() + horizonDays * 86400000);

  // A task is "blocked" if any of its blockedBy ids points at a task that
  // still isn't done. Stale/missing ids are ignored (never block on a ghost).
  const byId = {};
  for (const t of tasks) if (!t.deleted) byId[t.id] = t;
  const blocked = (t) =>
    Array.isArray(t.blockedBy) &&
    t.blockedBy.some(id => byId[id] && byId[id].status !== 'done' && !byId[id].completed);

  const out = [];

  for (const t of tasks.filter(isOpenTask)) {
    const due = atLocal(t.dueDate, h, min);
    if (!due) continue;
    for (const L of leads) {
      const fireAt = new Date(due.getTime() - L * 86400000);
      if (fireAt <= now || fireAt > horizon) continue;
      const bits = [dayWord(L)];
      if (t.goal) bits.push(t.goal);
      if (t.priority && t.priority !== 'Mid') bits.push(t.priority);
      if (blocked(t)) bits.push('blocked');
      out.push({
        id: `task-${t.id}-${L}`,
        fireAt,
        channelId: CHANNELS.tasks,
        title: t.name || 'Untitled task',
        body: bits.join(' · '),
        data: { kind: 'task', taskId: t.id, lead: L },
      });
    }
  }

  for (const m of milestones.filter(isOpenMilestone)) {
    const due = atLocal(m.dueDate, h, min);
    if (!due) continue;
    for (const L of leads) {
      const fireAt = new Date(due.getTime() - L * 86400000);
      if (fireAt <= now || fireAt > horizon) continue;
      const bits = [dayWord(L)];
      if (m.goal) bits.push(m.goal);
      if (m.msTag) bits.push(m.msTag);
      out.push({
        id: `ms-${m.id}-${L}`,
        fireAt,
        channelId: CHANNELS.milestones,
        title: `Milestone: ${m.name || 'Untitled'}`,
        body: bits.join(' · '),
        data: { kind: 'milestone', milestoneId: m.id, lead: L },
      });
    }
  }

  out.sort((a, b) => a.fireAt - b.fireAt || a.id.localeCompare(b.id));
  return out.slice(0, max);
};

// Convenience for the settings screen: what's coming up, human-readable.
export const summarize = (triggers) => {
  const t = triggers.filter(x => x.data.kind === 'task').length;
  const m = triggers.length - t;
  const first = triggers[0];
  return {
    total: triggers.length,
    tasks: t,
    milestones: m,
    nextAt: first ? first.fireAt : null,
    nextTitle: first ? first.title : null,
  };
};
