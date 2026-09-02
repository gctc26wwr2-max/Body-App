# Rackside — function inventory (v325)

Vanilla JS PWA, no build step. The old 8,300-line `js/app.js` is split into
14 plain scripts loaded in order from `index.html`; classic scripts share one
global scope, so top-level `const`/`let`/`function` in an earlier file are
visible to every later one — one namespace, zero build. Data catalogues live
in `js/library.js` and `js/plans.js`; `js/db.js` wraps IndexedDB; `sw.js` is
the offline cache. Each `###` heading below names the file that section
lives in.

## File layout

| File | Role |
|---|---|
| `js/core.js` | APP_VERSION, shared state, DOM/format/unit helpers, a11y, training math, plan state, modals, navigation |
| `js/today.js` | Today tab, progress arc, hero cards |
| `js/workout.js` | Live session, hold timer, audio, rest timer |
| `js/controls.js` | Faces/stars, drag/swipe, ruler, numpad, weight/time/rep scales, dial picker |
| `js/plan.js` | Finish workout, summary, Plan tab, optionRail |
| `js/settings.js` | Profile getters, About you, Settings (prefs) |
| `js/profile.js` | Profile tab, bodyweight graph, reports, backup/restore |
| `js/stats.js` | Stats tab, injuries + equipment filters, substitutions |
| `js/planmaker.js` | Plan-maker wheels flow |
| `js/cardio.js` | Cardio tab, pickerWheel, bezelDial watch |
| `js/libviews.js` | Library shell, coaching content, ready-made blocks |
| `js/ai.js` | AI import flow, segToggle, equipment picker, starter |
| `js/detail.js` | Exercise detail, muscle panel, exercise form/media |
| `js/boot.js` | Plan form editor, migrate(), boot sequence |
| `js/db.js` | Tiny IndexedDB wrapper (`DB.all/get/put/del`, `DB.uid`) |
| `js/library.js` | Data: exercise catalogue, demos, movement/stress tags, equipment, timed-exercise list |
| `js/plans.js` | Data: 57 ready-made training blocks (`window.READY_PLANS`) |
| `sw.js` | Service worker: pre-cache app shell, cache-first fetch |
| `index.html` | Static shell: views, sheets, forms |
| `tests.html` | Framework-free unit suite (39 checks) — fakes localStorage and DB, safe to open anywhere |

Storage: IndexedDB stores `exercises, plans, sessions, workouts, bodyweight,
cardio, media` (media only via the mediaStore seam); localStorage holds
`profile` (units, goal, level, sex, birth, name, avatarId, accent, jumps,
weekStart…), `equip`, `injuries(+On)`, `liveWorkout`, `liveCardio` (both
shape-validated on read, cleared if corrupt), coach-mark flags, migration
stamps (`equipV2`, `timedMig1`), `lastBackup`, `lastSeen`.

---

## App sections (per file)

### DOM & formatting utilities — `core.js`
- `el(tag, cls, txt)` — element factory used everywhere
- `svgIcon(path, size, fill)` — inline SVG from a path string
- `todayStr()` — local date as `YYYY-MM-DD`
- `dateOf(s)` — parse a date string at local midnight
- `fmtClock(s)` — seconds → `m:ss`
- `fmtKg(v)` — number → trimmed string (no unit)

### Units (kg/lb honesty layer) — `core.js`
- `wUnit() / toW / fromW / fmtWn / fmtW` — active unit, kg↔display conversion, formatting
- `wStep()` — ruler tick (0.5 kg or 1 lb)
- `wPlates()` — quick-add chip sizes per unit
- `wBump()` — generic nudge expressed in kg
- `jumpKind(ex)` — classify exercise → `db | mach | bar`
- `jumpKg(ex)` — configured progression jump (kg) for that kind
- `jumpW / jumpBase / jumpLabel` — the jump in on-screen units; lb users climb in real plate steps (`KG2LB_JUMP`), never converted decimals
- `wRound(kg)` — snap a weight to the rack's step
- `weekStartDow / dowFrom / weekStripOff` — user-chosen week start (any weekday) → strip math
- `hUnit / fmtH` — height units

### Accent colour — `core.js`
- `ACCENTS` — six preset swatches (clay default)
- `ACC` — the live accent hex; JS-built SVGs draw from it
- `hexRGB / mixHex / accRGB` — colour math
- `hslHex(h,s,l) / hueOf(hex)` — the hue wheel's register (fixed S/L)
- `applyAccent(sel?)` — repaints the --lime family, --acc-rgb and --clay-dim
  from a preset key, a raw hex, or the saved profile; garbage → clay

### Accessibility & onboarding — `core.js`
- `a11ySlider(wrap, o)` — retrofits slider role, aria-value*, tabIndex, Arrow-key stepping onto any custom drag control; returns a repaint fn
- `coachSeen(k)` — one-shot coach-mark flag
- `coachMark(anchor, text, key)` — first-run hint bubble, shown once

### Training math — `core.js`
- `est1RM(kg, reps)` — Epley estimate
- `isAssisted(ex)` — assisted machines: less weight = more achievement (flag or name match)
- `isTimedEx(ex)` — measured in seconds, not reps (`TIMED_EXERCISES` or notes)
- `suggestion(sets, ex)` — next-weight advice from last session (inverted wording/direction for assisted)
- `applySuggestion(sets, nextKg)` — write advice into working (not warm-up) sets
- `repTone(set)` — colour class for a rep result vs target
- `plateMath(totalKg, barKg)` — per-side plate breakdown (float-tolerant)
- `plateLine(kg)` — human plate string; 20 kg / 45 lb bars
- `isBarbell(ex)`

### Block/plan state — `core.js`
- `planWeek(plan)` — calendar week since start
- `progressWeek(plan)` — first week whose days aren't all done
- `isDeloadWeek(plan, wk)`
- `weekOf(plan)` — the week shown to the user
- `planFinished / activePlan / queuedPlans`
- `promoteQueued()` — auto-start the next queued block when one finishes
- `blockNumber(plan)` — ordinal by creation

### Media & modals — `core.js`
- `mediaStore` — the ONLY door to the 'media' store (save/meta/remove);
  the Capacitor seam — swap its backend to the native filesystem on wrap day
- `mediaURL(id)` — object URL for a stored photo/video (cached, revoked on remove)
- `demoEl / thumbFor / warmMark / animFor` — exercise imagery helpers
- `appConfirm({...})` — promise-based confirm modal
- `askOnClose({what, save, leave})` — Save / Discard / Keep editing on dirty close
- `appChoose({...})` — n-way modal
- `openSheet / closeSheets / dismissSheet` — bottom sheets

### Navigation & Today — `core.js + today.js`
- `show(view)` — switch views, manage tabbar
- `renderTab()` — load DB, run one-time migrations (`timedMig1`), route to the active tab
- `renderToday()` — Today tab: hero, week strip, day cards, empty states,
  and the greeting ("Welcome back, <name>" after 6 h away, else time of day;
  `greetPick` holds the choice for the visit)
- `blockArcSVG(total, done, weeks)` — progress arc, week labels along the
  legs; inputs coerced to bounded numbers (its string becomes innerHTML)
- `resumePlan(plan)`
- `weekStreak(workouts)`
- `heroTop / heroStat / pairCard / sameWeek`

### Live workout — `workout.js`
- `restDefault()` — session rest length from profile
- `wElapsed(lw)` — elapsed minus paused time
- `pauseWorkout / paintPausePop / closePausePop / resumeWorkout`
- `fmtRange(lo, hi)`
- `startWorkout(plan, dayIndex)` — build `liveWorkout` (warm-up sets from rotating pools, carry-forward weights per kind)
- `renderWorkout()` — the live session screen
- `exerciseCard(lw, cur, ei, sessions)` — one exercise: sets, scales, advice, kit-gap tags (~390 lines, the biggest function)
- `cancelHold / closeHoldPop / toggleHold(exIdx, si)` — timed-set hold countdown
- `stepper(set, key, step, onChange)` — ± stepper row

### Audio & haptics — `workout.js`
- `ensureAudio / tone / tickBeep` — WebAudio graph
- `bezelClick()` — 15 ms filtered-noise ratchet for wheels/bezel
- `alertOf / alertKey / playAlert / buildBeepAudio / beep` — rest-end alert sounds (incl. background `<audio>` fallback)
- `haptic()` — vibrate if supported

### Rest timer — `workout.js`
- `startRest / stopRest / armRestTick / restTick` — persisted countdown, ticks, auto-alert
- `updatePill(justDone)` — floating rest/session pill
- `setDelta(cur, si)` — vs-last-time delta chip

### Icons & touch primitives — `controls.js`
- `feelIcon / starIcon / starRow` — session-feel and difficulty widgets
- `dragReorder(container, rowSel, onDrop, prep)` — long-press row reorder
- `swipeToRemove(row, onRemove)`
- `gripEl(title)`

### Custom controls (the app's signature widgets) — `controls.js; optionRail in plan.js, pickerWheel/bezelDial in cardio.js, segToggle in ai.js`
- `rulerScale(opts)` — horizontal drag ruler; off-grid rebase, label/unit, a11y slider
- `paintReadout(big, text)`
- `openNumPad(opts)` — tap-to-type door used by every scale
- `weightScale / timeScale / repScale` — per-set weight, seconds, reps editors built on the ruler/strip
- `inlineRest(lw, cur)` — in-session rest nudge row
- `openDialPicker / renderDialPicker` — full-screen dial chooser
- `optionRail(labels, index, onChange, tickW, clicky, ariaLabel)` — horizontal inertial rail (russian-roulette coast, bezel clicks, a11y)
- `pickerWheel(labels, index, onChange, cls, tickFor, onTap, onDetent, ariaLabel)` — vertical wheel; per-detent live callbacks, a11y
- `bezelDial(opts)` — Sea-Dweller cardio watch: turnable bezel, inner running dial, centre-tap numpad, dead-zone guard, a11y
- `segToggle(items, activeKey, onPick, extra)` — segmented control

### Workout finish & summary — `plan.js`
- `finishWorkout()` — score, save session+workout, advance block
- `renderSummary(w, plan)` — post-session screen
- `sumCard(v, l)`

### Plan tab — `plan.js`
- `renderPlanTab()` — block overview, week rows, queue, finish/abandon

### Profile, settings, about — `settings.js; renderProfile in profile.js`
- `getProfile / setProfile` — non-object JSON falls back to {}
- `ageYears(pr)` — live age from profile.birth ('YYYY-MM'); legacy age fallback
- `MONTHS3` — month labels for the Born wheels
- `goalOf()`
- `navyBodyFat(pr)` — US Navy estimate
- `dayMinutes(items)` — session length estimate
- `openAbout / renderAbout` — About you (tape measures, goals)
- `openPrefs / renderPrefs` — Settings: rest, sound, equipment count, focus,
  weight-jump wheels, accent hue wheel + preset dots (live preview, reverts
  on discard), units, week start; draft + save-on-close
- About-you Born card — month + year pickerWheels writing profile.birth
- `shrinkImg(file)` — cap an avatar photo at 512px JPEG before storage
- `renderProfile()` — profile tab: identity card (avatar via mediaStore,
  inline name editor, vitals with body-fat, training-since), lifetime
  stats, bodyweight card+graph, data & backup controls
- `smoothPath(P)` — Catmull-Rom-ish path
- `bwGraphSVG(entries)`

### Reports, backup, reset — `profile.js`
- `shareReport / trainingReport` — plain-text training summary for a Claude chat
- `backupData()` — export JSON stamped `version: BACKUP_SCHEMA` + `appVersion`
- `BACKUP_SCHEMA / BACKUP_MIGRATIONS` — versioned backup format + forward
  migration ladder
- `restoreData(fileBlob)` — validate, refuse newer-schema files, walk the
  ladder (v5→6: machine-bucket split, timed reps→seconds), then scrub every
  restored record to sane types (numbers bounded, names sliced) before
  merging by id
- `resetHistory()` — wipe sessions/workouts, keep exercises/blocks
- `agoDays(ds)`

### Stats — `stats.js`
- `renderStats()` — trends, PRs (min-help for assisted), attendance
- `sparkSVG(vals, w, h)`

### Injuries & equipment filters — `stats.js`
- `getInjuries / setInjuries / injEnabled`
- `equipKeys / getEquip / setEquip` — kit set; one-time `equipV2` machine split
- `equipOf(ex)` — kit an exercise needs (map + regex inference)
- `equipOK(ex)` — available with current kit?
- `moveOf / patternOf / stressOf` — movement pattern + stress tags
- `injuryTags()` — flagged areas → avoid-tag set
- `isRisky(ex, tags)` — stress ∩ avoid (the injury filter; see INJURY-FLAGS-REVIEW.md)
- `substituteFor(ex, allowed)` — same-pattern safe swap
- `demoSlug / showMove` — demo viewer

### Plan maker — `planmaker.js`
- `orderRank / sortDayHardestFirst` — compounds first
- `pmExerciseList()` — searchable, kit- and injury-aware pool
- `openPlanMaker / renderPlanMaker` — three wheels (sets / exercise / reps-or-seconds), difficulty line repaints per detent
- `createPlanFromMaker()`

### Cardio — `cardio.js`
- `actsFor / metOf / mulOf` — activities, MET values, effort multiplier
- `progsFor(act)` — per-activity program rails with activity-specific time targets
- `cardioKcal(met, mins, kg, effort)` / `liftKcal`
- `renderCardio()` — activity/program rails + bezel-dial watch; manual turn resets Program to None; Start disabled at 0
- `finishCardio(auto)` — save, kcal, streak

### Exercise library & detail — `libviews.js + detail.js`
- `loadContent / contentIdFor / contentFor` — coaching notes lookup
- `hardshipOf / hardChip / addHardship` — difficulty labels (plain wording)
- `renderLibrary()` — library tab shell
- `planItemRow(it, from)`
- `renderMasterNew(root)` — "start a block" chooser
- `contentForDetail / muscleSets / musclePanel` — muscle-map panel
- `blockMembership(ex)` — which blocks use this move
- `openDetail(exId, from)` — exercise detail: history, PRs, demo, media
- `detStat / goBackFromDetail`
- `openExerciseForm(ex)` — custom exercise form (incl. assisted flag, timed detection)
- `renderMediaPreview()` — attach photos/videos

### Ready-made blocks — `libviews.js`
- `readyKitGap(plan)` — moves needing kit you switched off
- `installReady(plan)`
- `openReadySheet / readyCover / readyName` — picture-card shelves + detail sheet
- `renderMasterReady(root)`

### AI import — `ai.js`
- `aiPool()` — exercises the prompt may use (kit-aware)
- `focusToggle / focusLabels / focusPicker`
- `aiDaysDefault()`
- `buildPlanPrompt()` — the copyable prompt: goals, kit, injuries, history trends, PRs, attendance
- `aiNorm / matchExercise` — fuzzy name → catalogue match
- `aiReps(v, fallback)`
- `aiCarveJSON(text)` — dig the JSON block out of a chat reply
- `parseBlockReply(raw)` — validate/normalise an imported block
- `createPlanFromImport(block)` — install (kit-gap tags on unavailable moves)
- `renderMasterAI(root)` — the AI flow UI

### Equipment picker & misc library — `ai.js`
- `equipPicker(after)` — photo rails with tick-all/untick-all
- `renderMasterLib / renderLibList`
- `installStarter()`
- `isCatalogName / isCustomEx / ensureExercise` — custom-vs-catalogue identity

### Plan form (manual editor) — `boot.js`
- `planDirty` / `openPlanForm(plan, template)` / `renderPlanDays()`
- `numIn(val, set)` — numeric input row

### Boot — `boot.js`
- `migrate()` — seed/patch stored data on upgrade
- `setWinH()` — real viewport height var
- `checkUpdate()` — poll `version.json`, prompt reload

---

## js/db.js
- `open()` — open `body-app-db`, create stores on upgrade
- `tx(store, mode, fn)` — one-transaction helper
- `uid()` — crypto UUID with fallback
- returns `DB.{all, get, put, del, uid}`

## js/library.js (data, no logic)
- `EXERCISE_LIBRARY` — 183-move catalogue (name, group, notes)
- `EXERCISE_DEMOS` — demo slugs
- `STARTER_BLOCK`
- `MOVEMENTS` — per-move `[pattern, ...stressTags]` (drives the injury filter)
- `MOVE_FAMILY / MOVE_INFER / MOVE_BY_GROUP` — substitution families + fallbacks
- `TIMED_EXERCISES` — 24 second-measured moves
- `EQUIPMENT` — 34 kit keys (9 named machines)
- `EXERCISE_EQUIP / EQUIP_INFER`, — kit requirements per move
- `CONTENT_*` — coaching-note lookups

## js/plans.js (data)
- `READY_PLANS` — 57 ready blocks with cover art metadata

## sw.js
- `install` — pre-cache `ASSETS` under `body-app-v325`
- `activate` — drop old caches
- `fetch` — cache-first, network fallback

---

## Known cross-cutting invariants (worth checking in review)
1. Weights are STORED in kg everywhere; lb exists only at the display/input
   edge (`toW/fromW`, `jumpBase`, `JUMP_LB_OPTS`).
2. Assisted exercises invert everywhere at once: `suggestion`, PR direction,
   deload, trend wording (`isAssisted` is the single switch).
3. Timed exercises route reps UI → seconds UI via `isTimedEx` (plan maker,
   live workout, migrations, backups).
4. Every drag control must pair with `a11ySlider` + a numpad/tap door.
5. Injury filter is a filter, not advice — wording lives in the injuries UI
   and INJURY-FLAGS-REVIEW.md.
6. Backups: bump `BACKUP_SCHEMA` + add a `BACKUP_MIGRATIONS` step for any
   stored-shape change.
7. Media blobs only move through `mediaStore` (the Capacitor seam).
8. Imported text (AI replies, backups) never reaches innerHTML — names render
   via el()/textContent, SVG builders coerce inputs to numbers, restore
   scrubs types.
9. Stored-state reads (`live`, `liveCardio`, `getProfile`, `getEquip`,
   `getInjuries`) validate shape and fall back — corruption must never brick
   boot.
10. New behaviour in the ingestion paths or the training math gets a case in
   tests.html (run it via Playwright; it fakes storage, so it is safe anywhere).
