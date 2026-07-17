#!/usr/bin/env node
// ─── Forge test suite ───
// Run with: npm test  (or: node test/run-tests.mjs)
//
// Zero dependencies. lib/*.js use ESM syntax but the package is CJS, so the
// runner stages copies into a temp dir as .mjs (rewriting relative imports)
// and dynamic-imports them. Nothing is written inside the repo.
//
// Three guarded layers:
//   1. Calendar math (inherited verbatim from Hearth, with its guarantees)
//   2. Task model — vocabulary clamping, web-import mapping
//   3. Sync merge — every load-bearing rule of the forge-sync.json protocol

import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stage = mkdtempSync(join(tmpdir(), 'forge-test-'));

for (const name of ['constants', 'model', 'sync', 'selectors', 'runeData']) {
  const src = readFileSync(join(root, 'lib', `${name}.js`), 'utf8')
    .replace(/from '\.\/model'/g, "from './model.mjs'")
    .replace(/from '\.\/constants'/g, "from './constants.mjs'");
  writeFileSync(join(stage, `${name}.mjs`), src);
}

const {
  GREEK_MONTHS, gregToGreek, greekToGreg, greekMonthRange, greekMonthDays,
  isLeapYear, fmtGreekLong,
} = await import(pathToFileURL(join(stage, 'constants.mjs')).href);
const { newTask, normalizeTask, fromWebTask, STATUSES, PRIORITIES, GOALS,
  newMilestone, normalizeMilestone, fromWebMilestone,
  newRune, normalizeRune } =
  await import(pathToFileURL(join(stage, 'model.mjs')).href);
const { mergeSyncFile, serializeTasks, SYNC_FILE_VERSION } =
  await import(pathToFileURL(join(stage, 'sync.mjs')).href);
const { NU_2026_RUNE_ASSIGNMENTS, RUNE_GLYPHS } =
  await import(pathToFileURL(join(stage, 'runeData.mjs')).href);
const { groupByStatus, isOverdue, tasksByDueDate, dashboardStats, isoWeekTag,
  taskById, isBlocked, childrenOf, subtaskProgress, topLevelTasks,
  milestoneProgress, milestonesByDueDate } =
  await import(pathToFileURL(join(stage, 'selectors.mjs')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// ══ 1. Calendar math (inherited guarantees) ══
for (const year of [2026, 2027, 2028]) {
  const leap = isLeapYear(year);
  const daysInYear = leap ? 366 : 365;

  let planningCount = 0, echoCount = 0;
  const d = new Date(year, 0, 1, 12);
  for (let i = 0; i < daysInYear; i++) {
    const s = iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const g = gregToGreek(s);
    ok(g !== null, `${s} maps to null`);
    if (g.isPlanningDay) {
      planningCount++;
      ok(s === `${year}-12-31`, `Planning Day landed on ${s}`);
    } else {
      ok(g.day >= 1 && g.day <= 28, `${s} day out of range: ${g.day}`);
      if (g.isLeapEcho) { echoCount++; ok(s === `${year}-02-29`, `echo on ${s}`); }
      if (!g.isLeapEcho) {
        ok(greekToGreg(g) === s, `roundtrip ${s} -> ${g.monthId} ${g.day} -> ${greekToGreg(g)}`);
      } else {
        ok(greekToGreg(g) === `${year}-02-28`, `echo roundtrip should hit Feb 28, got ${greekToGreg(g)}`);
      }
    }
    d.setDate(d.getDate() + 1);
  }
  ok(planningCount === 1, `${year}: ${planningCount} Planning Days (want exactly 1)`);
  ok(echoCount === (leap ? 1 : 0), `${year}: echo count ${echoCount}`);

  for (const m of GREEK_MONTHS) {
    const r = greekMonthRange(m.id, year);
    ok(r.start === `${year}-${m.start}`, `${year} ${m.name} start ${r.start} != ${m.start}`);
    ok(r.end === `${year}-${m.end}`, `${year} ${m.name} end ${r.end} != ${m.end}`);
    ok(greekMonthDays(m.id, year).length === 28, `${year} ${m.name} day count`);
  }
  ok(greekMonthDays('PLANNING', year).length === 1, `${year} Planning has 1 day`);
  ok(greekMonthRange('PLANNING', year).start === `${year}-12-31`, `${year} Planning range`);
}

ok(gregToGreek('2026-06-21').monthId === 'M07' && gregToGreek('2026-06-21').day === 4, 'solstice 2026 = Eta 4');
ok(gregToGreek('2028-06-21').monthId === 'M07' && gregToGreek('2028-06-21').day === 4, 'solstice 2028 = Eta 4 (perpetual)');
ok(gregToGreek('2028-02-28').day === 3 && gregToGreek('2028-02-29').day === 3, 'Feb 28/29 2028 both Gamma 3');
ok(gregToGreek('2028-12-31').isPlanningDay === true, 'Dec 31 2028 = Planning');
ok(fmtGreekLong('2026-12-31') === 'Planning Day', 'fmtGreekLong planning');
ok(gregToGreek(new Date(2026, 5, 21, 0, 30)).day === 4, 'Date input 00:30 local = Eta 4 (DST-safe)');

// ══ 2. Task model ══
const t = newTask({ name: 'Test' });
ok(t.id.startsWith('t_'), 'newTask id prefix');
ok(t.status === 'todo' && t.priority === 'Mid' && t.goal === 'G1', 'newTask defaults');
ok(t.updatedAt > 0 && t.createdAt > 0, 'newTask timestamps');
ok(Array.isArray(t.blockedBy) && t.blockedBy.length === 0, 'newTask blockedBy');

ok(normalizeTask(null) === null, 'normalize null');
ok(normalizeTask({}) === null, 'normalize no id');
const norm = normalizeTask({ id: 'x', name: '  Trim me  ', status: 'doing', priority: 'URGENT', goal: 'G9', blockedBy: 'nope', level: '3' });
ok(norm.name === 'Trim me', 'normalize trims name');
ok(norm.status === 'todo', `invalid status clamped: ${norm.status}`);
ok(norm.priority === 'Mid', 'invalid priority clamped');
ok(norm.goal === 'G1', 'invalid goal clamped');
ok(Array.isArray(norm.blockedBy) && norm.blockedBy.length === 0, 'non-array blockedBy -> []');
ok(norm.level === 3, 'level coerced to number');

const done = normalizeTask({ id: 'y', name: 'Done', status: 'done', completedAt: '2026-07-10' });
ok(done.completed === true && done.completedAt === '2026-07-10', 'status done -> completed');
const undone = normalizeTask({ id: 'z', name: 'Open', status: 'todo', completed: true, completedAt: '2026-07-10' });
ok(undone.completed === false && undone.completedAt === '', 'status authoritative over completed flag');

const web = fromWebTask({
  id: 'w1', name: 'Web task', goal: 'G2', priority: 'High', status: 'done',
  level: 2, month: 'M04', week: 'W14', start: '2026-01-05', due: '2026-01-20',
  section: 'S', parentId: 'p', blockedBy: ['b1'], milestone: true,
  recurrence: 'none', completed: true, completedDate: '2026-01-19', notes: 'n',
});
ok(web.startDate === '2026-01-05' && web.dueDate === '2026-01-20', 'web start/due mapped');
ok(web.completedAt === '2026-01-19' && web.completed === true, 'web completedDate mapped');
ok(web.level === 2 && web.milestone === true && web.blockedBy[0] === 'b1', 'web inert fields carried');
ok(web.updatedAt > 0 && web.createdAt > 0, 'web import stamped with timestamps');

// ══ 3. Sync merge — the protocol's load-bearing rules ══
const mk = (id, updatedAt, extra = {}) =>
  normalizeTask({ id, name: `Task ${id}`, updatedAt, createdAt: 1, ...extra });

// insert
let res = mergeSyncFile([], { version: 1, tasks: [{ id: 'a', name: 'A', updatedAt: 100 }] });
ok(res.report.inserted === 1 && res.merged.length === 1, 'merge: insert new');
ok(res.changed.length === 1 && res.changed[0].id === 'a', 'merge: insert in changed');

// remote newer wins
res = mergeSyncFile([mk('a', 100)], { tasks: [{ id: 'a', name: 'Newer', updatedAt: 200 }] });
ok(res.report.updated === 1 && res.merged[0].name === 'Newer', 'merge: remote newer wins');

// local newer wins
res = mergeSyncFile([mk('a', 300, { name: 'Local' })], { tasks: [{ id: 'a', name: 'Stale', updatedAt: 200 }] });
ok(res.report.localWon === 1 && res.merged[0].name === 'Local', 'merge: local newer wins');
ok(res.changed.length === 0, 'merge: localWon not in changed');

// tie keeps local (no churn)
res = mergeSyncFile([mk('a', 200, { name: 'Local' })], { tasks: [{ id: 'a', name: 'Tie', updatedAt: 200 }] });
ok(res.report.localWon === 1 && res.merged[0].name === 'Local', 'merge: tie keeps local');

// newer tombstone kills live
res = mergeSyncFile([mk('a', 100)], { tasks: [{ id: 'a', updatedAt: 200, deleted: true }] });
ok(res.report.deletedApplied === 1 && res.merged[0].deleted === true, 'merge: tombstone kills live');

// newer live resurrects tombstone
res = mergeSyncFile([mk('a', 100, { deleted: true })], { tasks: [{ id: 'a', name: 'Back', updatedAt: 200 }] });
ok(res.report.updated === 1 && res.merged[0].deleted === false, 'merge: live resurrects tombstone');

// older live does NOT resurrect newer tombstone
res = mergeSyncFile([mk('a', 300, { deleted: true })], { tasks: [{ id: 'a', name: 'Zombie', updatedAt: 200 }] });
ok(res.report.localWon === 1 && res.merged[0].deleted === true, 'merge: stale live cannot resurrect');

// tombstone for unknown id persists
res = mergeSyncFile([], { tasks: [{ id: 'ghost', updatedAt: 100, deleted: true }] });
ok(res.report.deletedApplied === 1 && res.merged[0].deleted === true, 'merge: unknown tombstone stored');

// absence = no opinion
res = mergeSyncFile([mk('a', 100), mk('b', 100)], { tasks: [{ id: 'a', name: 'A2', updatedAt: 200 }] });
ok(res.merged.length === 2 && res.merged.find(x => x.id === 'b').name === 'Task b', 'merge: absent local kept');
ok(res.changed.length === 1, 'merge: only touched tasks in changed');

// malformed skipped
res = mergeSyncFile([], { tasks: [{ name: 'no id', updatedAt: 1 }, { id: 'ok1', name: 'Fine', updatedAt: 1 }] });
ok(res.report.skipped === 1 && res.report.inserted === 1, 'merge: malformed (no id) skipped');

// live entry with empty name skipped; tombstone without name allowed
res = mergeSyncFile([], { tasks: [{ id: 'e1', name: '   ', updatedAt: 1 }, { id: 'e2', updatedAt: 1, deleted: true }] });
ok(res.report.skipped === 1 && res.report.deletedApplied === 1, 'merge: nameless live skipped, nameless tombstone ok');

// vocab normalized on the way in
res = mergeSyncFile([], { tasks: [{ id: 'v', name: 'V', status: 'doing', priority: 'X', goal: 'G7', updatedAt: 1 }] });
ok(res.merged[0].status === 'todo' && res.merged[0].priority === 'Mid' && res.merged[0].goal === 'G1', 'merge: vocab clamped');

// empty / missing file shapes
res = mergeSyncFile([mk('a', 100)], null);
ok(res.merged.length === 1 && res.report.total === 0, 'merge: null file is a no-op');
res = mergeSyncFile([mk('a', 100)], { version: 1, tasks: [] });
ok(res.merged.length === 1 && res.report.total === 0, 'merge: empty tasks is a no-op');

// serialize shape
const ser = serializeTasks([mk('a', 100)], 'Claude');
ok(ser.version === SYNC_FILE_VERSION && ser.updatedBy === 'Claude' && ser.tasks.length === 1, 'serialize shape');
ok(typeof ser.lastUpdated === 'string' && ser.lastUpdated.includes('T'), 'serialize timestamp');

// idempotence: merging a serialization of the merged state changes nothing
const state = mergeSyncFile([], { tasks: [{ id: 'a', name: 'A', updatedAt: 100 }, { id: 'b', name: 'B', updatedAt: 100 }] }).merged;
res = mergeSyncFile(state, serializeTasks(state));
ok(res.changed.length === 0 && res.report.localWon === 2, 'merge: idempotent on own snapshot');

// vocab sanity for UI layers
ok(STATUSES.length === 4 && PRIORITIES.length === 3 && GOALS.length === 4, 'vocab sizes');

// ══ 4. Selectors ══
const st = (id, status, extra = {}) => normalizeTask({ id, name: id, status, updatedAt: 1, ...extra });

const grouped = groupByStatus([st('a','todo'), st('b','done'), st('c','in-progress'), st('d','todo')]);
ok(grouped.todo.length === 2 && grouped.done.length === 1 && grouped['in-progress'].length === 1, 'groupByStatus buckets');
ok(Array.isArray(grouped.backlog) && grouped.backlog.length === 0, 'groupByStatus empty lane present');

ok(isOverdue(st('x','todo',{dueDate:'2026-07-10'}), '2026-07-12') === true, 'overdue past-due open');
ok(isOverdue(st('x','done',{dueDate:'2026-07-10'}), '2026-07-12') === false, 'done never overdue');
ok(isOverdue(st('x','todo'), '2026-07-12') === false, 'no due -> not overdue');
ok(isOverdue(st('x','todo',{dueDate:'2026-07-12'}), '2026-07-12') === false, 'due today not overdue');

const days3 = ['2026-07-11','2026-07-12','2026-07-13'];
const dmap = tasksByDueDate([st('a','todo',{dueDate:'2026-07-12'}), st('b','todo',{dueDate:'2026-07-20'}), st('c','todo')], days3);
ok(dmap['2026-07-12'].length === 1 && dmap['2026-07-11'].length === 0, 'tasksByDueDate maps only in-range dues');

// Dashboard: today = Eta 25 (2026-07-12); Eta = Jun 18 – Jul 15
const dtasks = [
  st('a','todo',        {goal:'G1', dueDate:'2026-07-10'}),                 // overdue
  st('b','in-progress', {goal:'G1', dueDate:'2026-07-14'}),                 // due soon
  st('c','done',        {goal:'G2', completedAt:'2026-07-01'}),             // done this Greek month
  st('d','done',        {goal:'G2', completedAt:'2026-06-01'}),             // done LAST month (Zeta)
  st('e','todo',        {goal:'G3'}),                                       // open, dateless
  st('f','backlog',     {goal:'G1', dueDate:'2026-07-30'}),                 // open, beyond soon window
];
const ds = dashboardStats(dtasks, '2026-07-12');
ok(ds.open === 4, `dash open: ${ds.open}`);
ok(ds.inProgress === 1, 'dash inProgress');
ok(ds.doneThisMonth === 1, `dash doneThisMonth: ${ds.doneThisMonth}`);
ok(ds.overdue.length === 1 && ds.overdue[0].id === 'a', 'dash overdue list');
ok(ds.dueSoon.length === 1 && ds.dueSoon[0].id === 'b', `dash dueSoon: ${ds.dueSoon.map(t=>t.id)}`);
ok(ds.byGoal.G1.open === 3 && ds.byGoal.G2.doneThisMonth === 1 && ds.byGoal.G3.open === 1, 'dash byGoal');

const ds2 = dashboardStats([st('p','todo',{dueDate:'2026-07-01'}), st('q','todo',{dueDate:'2026-06-20'})], '2026-07-12');
ok(ds2.overdue.map(t=>t.id).join(',') === 'q,p', 'overdue sorted oldest first');

ok(isoWeekTag('2026-01-01') === 'W01', `W tag Jan1: ${isoWeekTag('2026-01-01')}`);
ok(isoWeekTag('2026-07-12') === 'W28', `W tag Jul12 Sun: ${isoWeekTag('2026-07-12')}`);
ok(isoWeekTag('2026-07-13') === 'W29', `W tag Jul13 Mon: ${isoWeekTag('2026-07-13')}`);
ok(isoWeekTag('2026-12-28') === 'W53', `W tag Dec28 (53-week year): ${isoWeekTag('2026-12-28')}`);
ok(isoWeekTag('2027-01-04') === 'W01', `W tag 2027 W1 start: ${isoWeekTag('2027-01-04')}`);

// ══ 5. Milestones: model + merge + progress ══
const wm = fromWebMilestone({ id: 'ms4_04', name: 'Habit tracker configured', goal: 'G1',
  month: 'M04', due: '2026-04-05', msTag: 'MS4', msWeek: 'MSW14',
  taskIds: ['a05','a06'], completed: true, completedDate: '2026-05-30' });
ok(wm.dueDate === '2026-04-05' && wm.completedAt === '2026-05-30', 'web milestone date mapping');
ok(wm.msTag === 'MS4' && wm.msWeek === 'MSW14' && wm.taskIds.length === 2, 'web milestone tags + links');
ok(normalizeMilestone({ id: 'm1', name: 'X', completed: false, completedAt: '2026-01-01' }).completedAt === '',
   'milestone completedAt cleared when not completed');
ok(normalizeMilestone({}) === null, 'milestone requires id');

// milestone merge rides the same engine
let mres = mergeSyncFile([], { tasks: [], milestones: [{ id: 'm1', name: 'M', updatedAt: 100 }] }, []);
ok(mres.milestones.merged.length === 1 && mres.report.milestones.inserted === 1, 'ms merge insert');
mres = mergeSyncFile([], { tasks: [], milestones: [{ id: 'm1', updatedAt: 200, deleted: true }] },
  [normalizeMilestone({ id: 'm1', name: 'M', updatedAt: 100 })]);
ok(mres.milestones.merged[0].deleted === true && mres.report.milestones.deletedApplied === 1, 'ms tombstone kills live');
mres = mergeSyncFile([], { tasks: [], milestones: [{ id: 'm1', name: 'Stale', updatedAt: 50 }] },
  [normalizeMilestone({ id: 'm1', name: 'Fresh', updatedAt: 100 })]);
ok(mres.milestones.merged[0].name === 'Fresh' && mres.report.milestones.localWon === 1, 'ms local newer wins');
ok(mergeSyncFile([mk('a',100)], { tasks: [{ id:'a', name:'N', updatedAt:200 }] }).merged[0].name === 'N',
   'task merge unchanged by milestone extension (default arg)');

const msP = normalizeMilestone({ id: 'mp', name: 'P', taskIds: ['x1','x2','gone'], updatedAt: 1 });
const msById = taskById([st('x1','done'), st('x2','todo')]);
const prog = milestoneProgress(msP, msById);
ok(prog.done === 1 && prog.total === 2, `milestone progress skips missing links: ${JSON.stringify(prog)}`);
const msMap = milestonesByDueDate([normalizeMilestone({ id:'md', name:'D', dueDate:'2026-07-14', updatedAt:1 })],
  ['2026-07-13','2026-07-14']);
ok(msMap['2026-07-14']?.length === 1, 'milestonesByDueDate');

// ══ 6. Dependencies & subtasks ══
const depTasks = [
  st('blocker', 'todo'),
  st('doneBlocker', 'done'),
  normalizeTask({ id: 'b1', name: 'b1', status: 'todo', blockedBy: ['blocker'], updatedAt: 1 }),
  normalizeTask({ id: 'b2', name: 'b2', status: 'todo', blockedBy: ['doneBlocker'], updatedAt: 1 }),
  normalizeTask({ id: 'b3', name: 'b3', status: 'todo', blockedBy: ['ghost'], updatedAt: 1 }),
];
const depById = taskById(depTasks);
ok(isBlocked(depTasks[2], depById) === true,  'blocked by open task');
ok(isBlocked(depTasks[3], depById) === false, 'done blocker does not block');
ok(isBlocked(depTasks[4], depById) === false, 'missing blocker does not block');

const famTasks = [
  st('p1', 'todo'),
  normalizeTask({ id: 'c1', name: 'c1', status: 'done', parentId: 'p1', updatedAt: 1 }),
  normalizeTask({ id: 'c2', name: 'c2', status: 'todo', parentId: 'p1', updatedAt: 1 }),
  normalizeTask({ id: 'orphan', name: 'o', status: 'todo', parentId: 'nope', updatedAt: 1 }),
];
const cmap = childrenOf(famTasks);
ok(cmap.p1.length === 2, 'childrenOf groups');
const sp = subtaskProgress(famTasks[0], cmap);
ok(sp.done === 1 && sp.total === 2, 'subtaskProgress');
const tops = topLevelTasks(famTasks).map(t => t.id).sort().join(',');
ok(tops === 'orphan,p1', `topLevel surfaces orphans: ${tops}`);

// serialize: optional milestones key present only when given
const serM = serializeTasks([mk('a', 100)], 'Forge', [normalizeMilestone({ id: 'm1', name: 'M', updatedAt: 1 })]);
ok(Array.isArray(serM.milestones) && serM.milestones.length === 1, 'serialize includes milestones when given');
ok(!('milestones' in serializeTasks([mk('a', 100)], 'Forge')), 'serialize omits milestones when absent');
// full-loop: a serialized snapshot (tasks + milestones) merges as a no-op
const loopT = [mk('a', 100)], loopM = [normalizeMilestone({ id: 'm1', name: 'M', updatedAt: 100 })];
const loopRes = mergeSyncFile(loopT, serializeTasks(loopT, 'Forge', loopM), loopM);
ok(loopRes.changed.length === 0 && loopRes.milestones.changed.length === 0, 'snapshot roundtrip is a no-op');

// ══ Runes: data integrity ══
ok(NU_2026_RUNE_ASSIGNMENTS.length === 24, `rune count ${NU_2026_RUNE_ASSIGNMENTS.length}`);
ok(NU_2026_RUNE_ASSIGNMENTS.filter(r => r.domain === 'practical').length === 13, 'practical runes = 13');
ok(NU_2026_RUNE_ASSIGNMENTS.filter(r => r.domain === 'spiritual').length === 7, 'spiritual runes = 7');
ok(NU_2026_RUNE_ASSIGNMENTS.filter(r => r.domain === 'skip').length === 4, 'skip runes = 4');
ok(NU_2026_RUNE_ASSIGNMENTS.every(r => RUNE_GLYPHS[r.name]), 'every rune has a glyph');
ok(new Set(NU_2026_RUNE_ASSIGNMENTS.map(r => r.name)).size === 24, 'no duplicate rune names');

// ══ Rune model ══
const rn = newRune({ name: 'Fehu', glyph: 'ᚠ' });
ok(rn.id === 'rune_Fehu' && rn.earned === false && rn.taskId === '', 'newRune defaults, unlinked/unearned');
ok(normalizeRune({}) === null, 'normalizeRune requires id');
const re1 = normalizeRune({ id: 'rune_X', name: 'X', earned: false, earnedAt: '2026-01-01' });
ok(re1.earnedAt === '', 'rune earnedAt cleared when not earned');
const re2 = normalizeRune({ id: 'rune_Y', name: 'Y', earned: true, earnedAt: '2026-11-01', taskId: 't_1' });
ok(re2.earned === true && re2.earnedAt === '2026-11-01' && re2.taskId === 't_1', 'earned rune keeps earnedAt + taskId link');

// ══ Rune sync: third collection, same LWW/tombstone engine ══
const rune = (id, ua, extra = {}) => normalizeRune({ id, name: id, updatedAt: ua, ...extra });
let rr = mergeSyncFile([], { tasks: [], milestones: [], runes: [{ id: 'rune_Fehu', name: 'Fehu', updatedAt: 100 }] }, [], []);
ok(rr.runes.merged.length === 1 && rr.report.runes.inserted === 1, 'rune merge insert');
rr = mergeSyncFile([], { tasks: [], runes: [{ id: 'rune_Fehu', name: 'Fehu', earned: true, updatedAt: 200 }] },
  [], [rune('rune_Fehu', 100)]);
ok(rr.runes.merged[0].earned === true && rr.report.runes.updated === 1, 'rune earned via newer sync wins');
rr = mergeSyncFile([], { tasks: [], runes: [{ id: 'rune_Fehu', updatedAt: 50, deleted: true }] },
  [], [rune('rune_Fehu', 100)]);
ok(rr.runes.merged[0].deleted === false && rr.report.runes.localWon === 1, 'stale rune tombstone cannot kill newer local');
// seed timestamp is below any plausible real edit → real edits always win
ok(1000000000000 < Date.now(), 'seed timestamp is in the past');
// task/milestone shape unchanged by the runes extension (defaults)
ok(mergeSyncFile([mk('a', 100)], { tasks: [{ id: 'a', name: 'N', updatedAt: 200 }] }).merged[0].name === 'N',
   'task merge unaffected by runes arg default');

// serialize carries runes only when given
const serR = serializeTasks([mk('a', 100)], 'Forge', [], [rune('rune_Fehu', 1)]);
ok(Array.isArray(serR.runes) && serR.runes.length === 1, 'serialize includes runes when given');
ok(!('runes' in serializeTasks([mk('a', 100)], 'Forge')), 'serialize omits runes when absent');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
