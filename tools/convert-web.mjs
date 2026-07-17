#!/usr/bin/env node
// Web Forge -> sync-file converter. Reuses the repo's REAL mappers so the
// conversion logic is exactly what the test suite covers.
//
// Usage: node tools/convert-web.mjs <tasks.json> <milestones.json> > converted.json
//   tasks.json      = raw value of localStorage 'forge-pm-tasks-v5'
//   milestones.json = raw value of localStorage 'forge-pm-milestones-v6'
// Output shape: { tasks: [...], milestones: [...] } — feed it to
// tools/claude-publish.mjs, do not push it raw.

import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stage = mkdtempSync(join(tmpdir(), 'convert-'));
writeFileSync(join(stage, 'model.mjs'), readFileSync(join(root, 'lib/model.js'), 'utf8'));
const { fromWebTask, fromWebMilestone } = await import(pathToFileURL(join(stage, 'model.mjs')).href);

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const [tasksPath, msPath] = process.argv.slice(2);
const webTasks = tasksPath ? readJSON(tasksPath) : [];
const webMs = msPath ? readJSON(msPath) : [];

const tasks = webTasks.map(fromWebTask).filter(Boolean);
const milestones = webMs.map(fromWebMilestone).filter(Boolean);

console.error(`Converted: ${tasks.length} tasks, ${milestones.length} milestones`);
console.error(`Dropped:   ${webTasks.length - tasks.length} tasks, ${webMs.length - milestones.length} milestones (no id)`);
console.log(JSON.stringify({ tasks, milestones }, null, 2));
