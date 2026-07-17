#!/usr/bin/env node
// Claude-side publish discipline, mechanized. Fetches the CURRENT
// forge-sync.json, merges your changes into it with the repo's tested LWW
// engine, and emits the full merged snapshot to stdout — ready to PUT via
// the GitHub Contents API. This ordering is what guarantees a publish can
// never clobber a phone push you haven't seen.
//
// Usage: node tools/claude-publish.mjs my-changes.json > merged.json
//   my-changes.json = { "tasks": [...], "milestones": [...] }
//   (entries need id + updatedAt in ms; tombstones = { id, updatedAt, deleted: true })

import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stage = mkdtempSync(join(tmpdir(), 'publish-'));
for (const name of ['constants', 'model', 'sync', 'selectors']) {
  const src = readFileSync(join(root, 'lib', `${name}.js`), 'utf8')
    .replace(/from '\.\/model'/g, "from './model.mjs'")
    .replace(/from '\.\/constants'/g, "from './constants.mjs'");
  writeFileSync(join(stage, `${name}.mjs`), src);
}
const { mergeSyncFile, DEFAULT_SYNC_URL, SYNC_FILE_VERSION } =
  await import(pathToFileURL(join(stage, 'sync.mjs')).href);

const changesPath = process.argv[2];
if (!changesPath) { console.error('Usage: claude-publish.mjs <changes.json>'); process.exit(1); }
const changes = JSON.parse(readFileSync(changesPath, 'utf8'));

// Current published state (404 → clean slate)
let current = { tasks: [], milestones: [] };
const res = await fetch(`${DEFAULT_SYNC_URL}?t=${Date.now()}`);
if (res.ok) current = await res.json();
else if (res.status !== 404) { console.error(`Fetch failed: HTTP ${res.status}`); process.exit(1); }

// Direction: published file = "local", your changes = "incoming".
// LWW + tombstones + absence-keeps do the rest.
const merged = mergeSyncFile(
  current.tasks || [],
  { tasks: changes.tasks || [], milestones: changes.milestones || [] },
  current.milestones || []
);

const out = {
  version: SYNC_FILE_VERSION,
  lastUpdated: new Date().toISOString(),
  updatedBy: 'Claude',
  tasks: merged.merged,
  milestones: merged.milestones.merged,
};

console.error(`Tasks:      ${merged.report.inserted} new · ${merged.report.updated} updated · ${merged.report.deletedApplied} removed · ${merged.report.localWon} kept`);
console.error(`Milestones: ${merged.report.milestones.inserted} new · ${merged.report.milestones.updated} updated · ${merged.report.milestones.deletedApplied} removed · ${merged.report.milestones.localWon} kept`);
console.log(JSON.stringify(out, null, 2));
