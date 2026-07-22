# CLAUDE.md — The Forge (native)

Instructions for any Claude instance working on this repo. Written by Claude
Fable 5 at handoff (Theta 6, 2026 / Jul 17) after building v0.1.0 → v0.4.0
with Connor. Read this fully before changing anything.

## What this is

Native Android task manager for Connor's four-goal life system (G1–G4),
running on his 13-month Greek calendar. Companion app to The Hearth
(calendar); both share `lib/constants.js` VERBATIM — a change to the
calendar math in either repo must be copied to the other and both test
suites must stay green.

Stack: Expo SDK 54 · React Native 0.81.5 · expo-sqlite · EAS `preview`
profile → standalone APK. Owner `lightbearer77`, EAS project id
`6764deaf-e1ff-49d7-b6c8-c49a545afc7a`.

## Current state (v0.4.0)

- Eta ✓ foundation: schema, sync engine, minimal list, seed proven on device
- Theta ✓ views: task editor (auto Greek-month + ISO-week tags from due
  date), Kanban (paged lanes, move chevrons), Greek-month calendar (due
  banners, day sheet, add-for-date), dashboard (stats, per-goal bars,
  overdue/due-soon)
- Iota ✓ milestones (first-class, taskIds-linked), dependencies (blockedBy
  + 🔒 badges), subtasks (parentId, quick-add, n/m progress)
- Kappa-1 ✓ bidirectional sync: settings table (schema v3), in-app push
  with on-device fine-grained token, Share-sheet export
- Test suite: `npm test` → **3,498 assertions**, zero deps. Any change to
  lib/ must keep it green; engine changes must EXTEND it.

## Settled decisions — do not re-open

1. **Schema is a full web-Forge superset from day one** so the eventual
   web→native import is lossless; behavior ships by phase. Columns exist
   before their features.
2. **`status` is authoritative over `completed`.** normalizeTask derives
   completed from status; never trust a bare completed flag.
3. **Milestone completion is MANUAL.** Linked-task progress (n/m) is
   derived and displayed, but the app never auto-completes a milestone —
   evidence informs, Connor judges. Do not "fix" this.
4. **Sync conflict resolution is whole-record LWW on `updatedAt` (ms).**
   Strictly greater wins; a tie keeps local. No field-level merging, ever.
5. **Deletion is a tombstone** (`deleted: true` + fresh updatedAt), never a
   row removal, and tombstones participate in LWW symmetrically: newer
   tombstone kills live, newer live resurrects tombstone.
6. **Absence = no opinion.** A record missing from a sync file is never a
   deletion. Partial patches and full snapshots are both valid files.
7. **Lists and board show top-level tasks only; orphans surface.** A child
   whose parent is missing/tombstoned appears at top level — subtasks must
   never silently vanish.
8. **Recurrence column is inert.** HabitNow owns recurring habits at this
   layer. Do not build task recurrence without Connor asking.
9. Local edits set `updatedAt = Date.now()` BEFORE saveTask; the sync path
   writes merge-decided timestamps through untouched.

## forge-sync.json — authoring guide for Claude instances

This file is the Claude ⇄ Forge bridge. The app pulls on launch and via
⟳ SYNC; the phone pushes full snapshots via ⚙ → PUSH.

Shape:
```json
{ "version": 1, "lastUpdated": "<ISO>", "updatedBy": "Claude",
  "tasks": [ { camelCase fields, "updatedAt": <ms> , "deleted": true? } ],
  "milestones": [ ...same semantics, optional key ] }
```

**The discipline (violating this silently loses Connor's data):**
1. NEVER blind-write the file. Always FETCH the current file first — the
   phone may have pushed since you last looked.
2. Merge your changes INTO it using the same LWW rules (use
   `tools/claude-publish.mjs`, which reuses the repo's tested merge engine).
3. Push the full merged result via the GitHub Contents API (GET sha → PUT).
4. Every entry you author gets `updatedAt: Date.now()` at write time. Never
   lower an existing updatedAt. Never omit it.
5. To delete: `{ "id": ..., "updatedAt": <now>, "deleted": true }`.

`tools/claude-publish.mjs` does 1–2 mechanically:
`node tools/claude-publish.mjs my-changes.json > merged-forge-sync.json`
where my-changes.json is `{ "tasks": [...], "milestones": [...] }`.

## Web → native migration (not yet executed)

Connor's real corpus still lives in the web Forge's localStorage. Procedure:
1. Connor, in a browser on the web Forge:
   `copy(localStorage.getItem('forge-pm-tasks-v5'))` → save/paste,
   then same for `forge-pm-milestones-v6`.
2. `node tools/convert-web.mjs tasks.json milestones.json > converted.json`
   (reuses the repo's tested fromWebTask/fromWebMilestone mappers).
3. Feed converted.json through `tools/claude-publish.mjs` and push.
4. Connor taps ⟳ SYNC. Corpus lands. Web Forge then retires (Kappa).

## Notifications (v0.6.0)

Forge notifies on **due dates only** — tasks and milestones — at a configured
time of day with configurable lead days. Deliberately no per-task reminder
offsets: HabitNow owns recurring cadence, The Hearth owns time-of-day events,
Forge owns "this is due".

- `lib/notifySchedule.js` — **pure**, no expo imports, unit-tested (37
  assertions). Owns what fires and when.
- `lib/notifications.js` — expo-notifications glue. Cancel-all + reschedule on
  every refresh so state stays duplicate-free. 48-alarm cap, nearest-first,
  90-day horizon. Channels `forge-tasks` / `forge-milestones`.
- Settings live in the schema-v3 settings table: `notifyEnabled`, `notifyTime`,
  `notifyLead`.
- Refresh is **debounced 2s** off `reload()` in App.js — that's the single
  choke point after every mutation, and a full reschedule is too expensive to
  run per-keystroke.
- Overdue items never fire. Completed/deleted never fire. Blocked tasks DO
  fire, tagged `blocked` in the body — the due date is still real.
- Deps pinned to Hearth's proven versions: `expo-notifications ~0.32.17`,
  `expo-device ~8.0.10`. Android permissions added to app.json.

Not built (deliberately): overdue digest, per-task offsets, snooze.

## Parked decisions — Connor's, not yours

- **`level` field**: carried inert since Eta (pre-reformation residue).
  Ratify-or-retire is HIS call. Surface it; do not decide it.
- **Unbound Time tracker**: listed for Forge in his notes, but needs his
  spec (what is tracked, how the earned tier accrues) before anything is
  built. Do not design it unprompted.

## Known bugs / remaining Kappa work (ordinary — safe for any model)

- ~~Keyboard clips low text inputs~~ FIXED in v0.5.1. Root cause was
  `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — `undefined`
  makes KeyboardAvoidingView inert on Android. Fix = `'height'` on Android
  plus enough bodyContent paddingBottom (220) for the deepest input to
  scroll clear. Same fix applied in Hearth v1.7.2.
- Manual reordering (sort_order is stored but no drag UI), section grouping
  in list view, per-goal filter chips, web Forge archival after migration.

## Working rules (hard-won; violating these cost days on Hearth)

- `npx expo install <pkg>` — NEVER plain `npm install <pkg>` for expo-* or
  react-native-* packages. Wrong-version pins caused a week of crashes.
- `npm test` before every push. Babel-parse every changed JS/JSX
  (`@babel/parser`, plugins ['jsx']). Bump app.json version per batch.
- `npm audit fix` is banned — it chases semver past SDK 54's pins.
- Local bundle check when EAS fails opaquely:
  `npx expo export --platform android` shows the real error.
- Push pattern: GitHub Contents API (GET sha → PUT base64). Connor supplies
  a fresh classic PAT per session; any token that appears in chat is
  auto-revoked by GitHub. The app's own sync token is FINE-GRAINED (Forge
  repo only, Contents RW) and lives in the on-device settings table.
- Connor's laptop is Qubes OS. The dom0 thin pool can flip the AppVM
  filesystem to `emergency_ro` mid-operation (`mount | grep xvdb` to
  check). This has corrupted git indexes (`rm .git/index && git reset`),
  emptied object files (`find .git/objects -size 0 -delete`), and written
  0-byte files — an empty package-lock.json broke EAS installs once.
  After ANY EROFS event, verify file sizes before trusting writes.
- Verification cycle: Claude builds + tests in sandbox → pushes via API →
  Connor pulls, `npm test`, `eas build --platform android --profile
  preview`, installs APK, runs the device checklist Claude provides.
