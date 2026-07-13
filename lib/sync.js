// ─── forge-sync.json: the Claude ⇄ Forge bridge ───
//
// PROTOCOL (v1, ratified Eta 2026):
//   {
//     "version": 1,
//     "lastUpdated": "<ISO-8601>",
//     "updatedBy": "Claude" | "Forge" | <agent>,
//     "tasks": [ { ...camelCase task fields, updatedAt: <ms>, deleted?: true } ]
//   }
//
// SEMANTICS — the load-bearing rules:
//   · The file is a set of UPSERTS and TOMBSTONES. A task absent from the
//     file means "no opinion" — partial patches and full snapshots are both
//     valid files. Absence NEVER deletes.
//   · Deletion is an explicit tombstone: { id, updatedAt, deleted: true }.
//   · Conflict resolution is whole-task last-write-wins on `updatedAt` (ms).
//     STRICTLY greater wins; a tie keeps local (no churn, no ping-pong).
//   · Tombstones participate in LWW symmetrically: a newer tombstone kills a
//     live task; a newer live edit resurrects a tombstoned one.
//   · Field-level merging is deliberately NOT done — whole-task LWW is
//     predictable and debuggable; field merges invite silent corruption.
//   · The file may also carry an optional `milestones: []` array with the
//     exact same upsert+tombstone+LWW semantics. Absence = no opinion.
//
// USAGE CONTRACT: mergeSyncFile must receive local tasks INCLUDING
// tombstones (getAllTasks({ includeDeleted: true })), or a stale file entry
// could resurrect a task the user deleted.

import { normalizeTask, normalizeMilestone } from './model';

export const SYNC_FILE_VERSION = 1;
export const DEFAULT_SYNC_URL =
  'https://raw.githubusercontent.com/Lightbearer77/Forge/main/forge-sync.json';

// Pure merge. Returns:
//   merged  — full post-merge task list (tombstones included)
//   changed — only the tasks that need persisting
//   report  — counts for the UI: { inserted, updated, deletedApplied,
//             localWon, skipped, total }
const emptyReport = () =>
  ({ inserted: 0, updated: 0, deletedApplied: 0, localWon: 0, skipped: 0, total: 0 });

// One engine for any collection: whole-record LWW, strictly-greater wins,
// tombstones symmetric, absence = no opinion. Live records need a name;
// tombstones only need an id.
const mergeCollection = (localArr, incomingArr, normalize) => {
  const report = emptyReport();
  const byId = new Map();
  for (const r of localArr) byId.set(r.id, r);
  const changed = [];

  const incoming = Array.isArray(incomingArr) ? incomingArr : [];
  report.total = incoming.length;

  for (const raw of incoming) {
    const inc = normalize(raw);
    if (!inc) { report.skipped++; continue; }
    if (!inc.name && !inc.deleted) { report.skipped++; continue; }

    const local = byId.get(inc.id);
    if (!local) {
      byId.set(inc.id, inc);
      changed.push(inc);
      if (inc.deleted) report.deletedApplied++;
      else report.inserted++;
      continue;
    }

    if ((inc.updatedAt || 0) > (local.updatedAt || 0)) {
      byId.set(inc.id, inc);
      changed.push(inc);
      if (inc.deleted && !local.deleted) report.deletedApplied++;
      else report.updated++;
    } else {
      report.localWon++;
    }
  }

  return { merged: [...byId.values()], changed, report };
};

// Tasks keep the original return shape (merged/changed/report at top level);
// milestone results ride alongside. Pass local milestones INCLUDING
// tombstones, same as tasks.
export const mergeSyncFile = (localTasks, fileJson, localMilestones = []) => {
  const t = mergeCollection(localTasks, fileJson?.tasks, normalizeTask);
  const m = mergeCollection(localMilestones, fileJson?.milestones, normalizeMilestone);
  const report = { ...t.report, milestones: m.report };
  return {
    merged: t.merged,
    changed: t.changed,
    milestones: { merged: m.merged, changed: m.changed },
    report,
  };
};

// Serialize for the outbound direction (and for tests / snapshots).
export const serializeTasks = (tasks, updatedBy = 'Forge', milestones = undefined) => ({
  version: SYNC_FILE_VERSION,
  lastUpdated: new Date().toISOString(),
  updatedBy,
  tasks,
  ...(milestones ? { milestones } : {}),
});

// Fetch the sync file. Cache-busted (raw.githubusercontent caches hard);
// a missing file (404) is a normal pre-first-sync state → null, not an error.
export const fetchSyncFile = async (url = DEFAULT_SYNC_URL) => {
  const busted = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const res = await fetch(busted, { headers: { 'Cache-Control': 'no-cache' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Sync fetch failed: HTTP ${res.status}`);
  const json = await res.json();
  if (json?.version !== SYNC_FILE_VERSION) {
    throw new Error(`Unsupported sync file version: ${json?.version}`);
  }
  return json;
};
