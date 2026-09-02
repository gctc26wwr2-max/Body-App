# Rackside — function inventory (v312)

For code review in a Claude chat. Vanilla JS PWA, no build step. One IIFE in
`js/app.js` holds nearly everything; data catalogues live in `js/library.js`
and `js/plans.js`; `js/db.js` wraps IndexedDB; `sw.js` is the offline cache.
Line numbers refer to v312.

## File layout

| File | Role |
|---|---|
| `js/app.js` | The app: all views, controls, domain logic (~8300 lines) |
| `js/db.js` | Tiny IndexedDB wrapper (`DB.all/get/put/del`, `DB.uid`) |
| `js/library.js` | Data: exercise catalogue, demos, movement/stress tags, equipment, timed-exercise list |
| `js/plans.js` | Data: 57 ready-made training blocks (`window.READY_PLANS`) |
| `sw.js` | Service worker: pre-cache app shell, cache-first fetch |
| `index.html` | Static shell: views, sheets, forms |

Storage: IndexedDB stores `exercises, plans, sessions, workouts, bodyweight,
cardio, media`; localStorage holds `profile`, `equip`, `injuries(+On)`,
`liveWorkout`, `liveCardio`, coach-mark flags, migration stamps
(`equipV2`, `timedMig1`), `lastBackup`.

---

## js/app.js

### DOM & formatting utilities
- `el(tag, cls, txt)` L8 — element factory used everywhere
- `svgIcon(path, size, fill)` L18 — inline SVG from a path string
- `todayStr()` L47 — local date as `YYYY-MM-DD`
- `dateOf(s)` L51 — parse a date string at local midnight
- `fmtClock(s)` L52 — seconds → `m:ss`
- `fmtKg(v)` L56 — number → trimmed string (no unit)

### Units (kg/lb honesty layer)
- `wUnit() / toW / fromW / fmtWn / fmtW` L62–66 — active unit, kg↔display conversion, formatting
- `wStep()` L67 — ruler tick (0.5 kg or 1 lb)
- `wPlates()` L68 — quick-add chip sizes per unit
- `wBump()` L69 — generic nudge expressed in kg
- `jumpKind(ex)` L81 — classify exercise → `db | mach | bar`
- `jumpKg(ex)` L87 — configured progression jump (kg) for that kind
- `jumpW / jumpBase / jumpLabel` L96–100 — the jump in on-screen units; lb users climb in real plate steps (`KG2LB_JUMP`), never converted decimals
- `wRound(kg)` L108 — snap a weight to the rack's step
- `weekStartDow / dowFrom / weekStripOff` L116–118 — user-chosen week start (any weekday) → strip math
- `hUnit / fmtH` L120–121 — height units

### Accessibility & onboarding
- `a11ySlider(wrap, o)` L133 — retrofits slider role, aria-value*, tabIndex, Arrow-key stepping onto any custom drag control; returns a repaint fn
- `coachSeen(k)` L161 — one-shot coach-mark flag
- `coachMark(anchor, text, key)` L162 — first-run hint bubble, shown once

### Training math
- `est1RM(kg, reps)` L185 — Epley estimate
- `isAssisted(ex)` L188 — assisted machines: less weight = more achievement (flag or name match)
- `isTimedEx(ex)` L191 — measured in seconds, not reps (`TIMED_EXERCISES` or notes)
- `suggestion(sets, ex)` L194 — next-weight advice from last session (inverted wording/direction for assisted)
- `applySuggestion(sets, nextKg)` L211 — write advice into working (not warm-up) sets
- `repTone(set)` L214 — colour class for a rep result vs target
- `plateMath(totalKg, barKg)` L220 — per-side plate breakdown (float-tolerant)
- `plateLine(kg)` L234 — human plate string; 20 kg / 45 lb bars
- `isBarbell(ex)` L245

### Block/plan state
- `planWeek(plan)` L247 — calendar week since start
- `progressWeek(plan)` L252 — first week whose days aren't all done
- `isDeloadWeek(plan, wk)` L266
- `weekOf(plan)` L269 — the week shown to the user
- `planFinished / activePlan / queuedPlans` L273–280
- `promoteQueued()` L283 — auto-start the next queued block when one finishes
- `blockNumber(plan)` L294 — ordinal by creation

### Media & modals
- `mediaURL(id)` L303 — object URL for a stored photo/video
- `demoEl / thumbFor / warmMark / animFor` L311–357 — exercise imagery helpers
- `appConfirm({...})` L364 — promise-based confirm modal
- `askOnClose({what, save, leave})` L386 — Save / Discard / Keep editing on dirty close
- `appChoose({...})` L402 — n-way modal
- `openSheet / closeSheets / dismissSheet` L425–428 — bottom sheets

### Navigation & Today
- `show(view)` L442 — switch views, manage tabbar
- `renderTab()` L455 — load DB, run one-time migrations (`timedMig1`), route to the active tab
- `renderToday()` L488 — Today tab: hero, week strip, day cards, empty states
- `blockArcSVG(total, done, weeks)` L812 — progress arc with week labels along the legs
- `resumePlan(plan)` L848
- `weekStreak(workouts)` L860
- `heroTop / heroStat / pairCard / sameWeek` L876–896

### Live workout
- `restDefault()` L914 — session rest length from profile
- `wElapsed(lw)` L924 — elapsed minus paused time
- `pauseWorkout / paintPausePop / closePausePop / resumeWorkout` L927–991
- `fmtRange(lo, hi)` L1009
- `startWorkout(plan, dayIndex)` L1011 — build `liveWorkout` (warm-up sets from rotating pools, carry-forward weights per kind)
- `renderWorkout()` L1165 — the live session screen
- `exerciseCard(lw, cur, ei, sessions)` L1292 — one exercise: sets, scales, advice, kit-gap tags (~390 lines, the biggest function)
- `cancelHold / closeHoldPop / toggleHold(exIdx, si)` L1684–1699 — timed-set hold countdown
- `stepper(set, key, step, onChange)` L1857 — ± stepper row

### Audio & haptics
- `ensureAudio / tone / tickBeep` L1897–1913 — WebAudio graph
- `bezelClick()` L1921 — 15 ms filtered-noise ratchet for wheels/bezel
- `alertOf / alertKey / playAlert / buildBeepAudio / beep` L1958–2009 — rest-end alert sounds (incl. background `<audio>` fallback)
- `haptic()` L2139 — vibrate if supported

### Rest timer
- `startRest / stopRest / armRestTick / restTick` L2023–2073 — persisted countdown, ticks, auto-alert
- `updatePill(justDone)` L2107 — floating rest/session pill
- `setDelta(cur, si)` L2128 — vs-last-time delta chip

### Icons & touch primitives
- `feelIcon / starIcon / starRow` L2156–2205 — session-feel and difficulty widgets
- `dragReorder(container, rowSel, onDrop, prep)` L2225 — long-press row reorder
- `swipeToRemove(row, onRemove)` L2283
- `gripEl(title)` L2326

### Custom controls (the app's signature widgets)
- `rulerScale(opts)` L2341 — horizontal drag ruler; off-grid rebase, label/unit, a11y slider
- `paintReadout(big, text)` L2491
- `openNumPad(opts)` L2502 — tap-to-type door used by every scale
- `weightScale / timeScale / repScale` L2543–2672 — per-set weight, seconds, reps editors built on the ruler/strip
- `inlineRest(lw, cur)` L2779 — in-session rest nudge row
- `openDialPicker / renderDialPicker` L2866–2878 — full-screen dial chooser
- `optionRail(labels, index, onChange, tickW, clicky, ariaLabel)` L3398 — horizontal inertial rail (russian-roulette coast, bezel clicks, a11y)
- `pickerWheel(labels, index, onChange, cls, tickFor, onTap, onDetent, ariaLabel)` L5684 — vertical wheel; per-detent live callbacks, a11y
- `bezelDial(opts)` L5837 — Sea-Dweller cardio watch: turnable bezel, inner running dial, centre-tap numpad, dead-zone guard, a11y
- `segToggle(items, activeKey, onPick, extra)` L7286 — segmented control

### Workout finish & summary
- `finishWorkout()` L2991 — score, save session+workout, advance block
- `renderSummary(w, plan)` L3094 — post-session screen
- `sumCard(v, l)` L3161

### Plan tab
- `renderPlanTab()` L3171 — block overview, week rows, queue, finish/abandon

### Profile, settings, about
- `getProfile / setProfile` L3545–3548
- `goalOf()` L3553
- `navyBodyFat(pr)` L3557 — US Navy estimate
- `dayMinutes(items)` L3572 — session length estimate
- `openAbout / renderAbout` L3577–3582 — About you (tape measures, goals)
- `openPrefs / renderPrefs` L3852–3854 — Settings: rest, sound, equipment count, focus, weight-jump wheels, units, week start; draft + save-on-close
- `renderProfile()` L4096 — profile tab: identity, bodyweight card+graph, data & backup controls
- `smoothPath(P)` L4305 — Catmull-Rom-ish path
- `bwGraphSVG(entries)` L4333

### Reports, backup, reset
- `shareReport / trainingReport` L4363–4375 — plain-text training summary for a Claude chat
- `backupData()` L4593 — export JSON stamped `version: BACKUP_SCHEMA` + `appVersion`
- `restoreData(fileBlob)` L4619 — validate, refuse newer-schema files, walk `BACKUP_MIGRATIONS` ladder (v5→6: machine-bucket split, timed reps→seconds), merge by id
- `resetHistory()` L4648 — wipe sessions/workouts, keep exercises/blocks
- `agoDays(ds)` L4662

### Stats
- `renderStats()` L4671 — trends, PRs (min-help for assisted), attendance
- `sparkSVG(vals, w, h)` L4839

### Injuries & equipment filters
- `getInjuries / setInjuries / injEnabled` L4901–4906
- `equipKeys / getEquip / setEquip` L4910–4932 — kit set; one-time `equipV2` machine split
- `equipOf(ex)` L4933 — kit an exercise needs (map + regex inference)
- `equipOK(ex)` L4942 — available with current kit?
- `moveOf / patternOf / stressOf` L4951–4960 — movement pattern + stress tags
- `injuryTags()` L4962 — flagged areas → avoid-tag set
- `isRisky(ex, tags)` L4969 — stress ∩ avoid (the injury filter; see INJURY-FLAGS-REVIEW.md)
- `substituteFor(ex, allowed)` L4974 — same-pattern safe swap
- `demoSlug / showMove` L4988–4990 — demo viewer

### Plan maker
- `orderRank / sortDayHardestFirst` L5048–5058 — compounds first
- `pmExerciseList()` L5066 — searchable, kit- and injury-aware pool
- `openPlanMaker / renderPlanMaker` L5075–5089 — three wheels (sets / exercise / reps-or-seconds), difficulty line repaints per detent
- `createPlanFromMaker()` L5471

### Cardio
- `actsFor / metOf / mulOf` L5553–5559 — activities, MET values, effort multiplier
- `progsFor(act)` L5656 — per-activity program rails with activity-specific time targets
- `cardioKcal(met, mins, kg, effort)` L5661 / `liftKcal` L5671
- `renderCardio()` L6017 — activity/program rails + bezel-dial watch; manual turn resets Program to None; Start disabled at 0
- `finishCardio(auto)` L6302 — save, kcal, streak

### Exercise library & detail
- `loadContent / contentIdFor / contentFor` L6346–6395 — coaching notes lookup
- `hardshipOf / hardChip / addHardship` L6421–6450 — difficulty labels (plain wording)
- `renderLibrary()` L6462 — library tab shell
- `planItemRow(it, from)` L6503
- `renderMasterNew(root)` L6525 — "start a block" chooser
- `contentForDetail / muscleSets / musclePanel` L7567–7592 — muscle-map panel
- `blockMembership(ex)` L7641 — which blocks use this move
- `openDetail(exId, from)` L7706 — exercise detail: history, PRs, demo, media
- `detStat / goBackFromDetail` L7874–7882
- `openExerciseForm(ex)` L7892 — custom exercise form (incl. assisted flag, timed detection)
- `renderMediaPreview()` L7917 — attach photos/videos

### Ready-made blocks
- `readyKitGap(plan)` L6597 — moves needing kit you switched off
- `installReady(plan)` L6610
- `openReadySheet / readyCover / readyName` L6627–6711 — picture-card shelves + detail sheet
- `renderMasterReady(root)` L6713

### AI import
- `aiPool()` L6846 — exercises the prompt may use (kit-aware)
- `focusToggle / focusLabels / focusPicker` L6870–6881
- `aiDaysDefault()` L6926
- `buildPlanPrompt()` L6934 — the copyable prompt: goals, kit, injuries, history trends, PRs, attendance
- `aiNorm / matchExercise` L6977–6983 — fuzzy name → catalogue match
- `aiReps(v, fallback)` L7007
- `aiCarveJSON(text)` L7019 — dig the JSON block out of a chat reply
- `parseBlockReply(raw)` L7038 — validate/normalise an imported block
- `createPlanFromImport(block)` L7085 — install (kit-gap tags on unavailable moves)
- `renderMasterAI(root)` L7123 — the AI flow UI

### Equipment picker & misc library
- `equipPicker(after)` L7326 — photo rails with tick-all/untick-all
- `renderMasterLib / renderLibList` L7434–7466
- `installStarter()` L7518
- `isCatalogName / isCustomEx / ensureExercise` L7545–7549 — custom-vs-catalogue identity

### Plan form (manual editor)
- `planDirty` L8013 / `openPlanForm(plan, template)` L8016 / `renderPlanDays()` L8056
- `numIn(val, set)` L8122 — numeric input row

### Boot
- `migrate()` L8168 — seed/patch stored data on upgrade
- `setWinH()` L8244 — real viewport height var
- `checkUpdate()` L8268 — poll `version.json`, prompt reload

---

## js/db.js
- `open()` L7 — open `body-app-db`, create stores on upgrade
- `tx(store, mode, fn)` L47 — one-transaction helper
- `uid()` L58 — crypto UUID with fallback
- returns `DB.{all, get, put, del, uid}`

## js/library.js (data, no logic)
- `EXERCISE_LIBRARY` L3 — 183-move catalogue (name, group, notes)
- `EXERCISE_DEMOS` L94 — demo slugs
- `STARTER_BLOCK` L384
- `MOVEMENTS` L420 — per-move `[pattern, ...stressTags]` (drives the injury filter)
- `MOVE_FAMILY / MOVE_INFER / MOVE_BY_GROUP` L619–662 — substitution families + fallbacks
- `TIMED_EXERCISES` L681 — 24 second-measured moves
- `EQUIPMENT` L690 — 34 kit keys (9 named machines)
- `EXERCISE_EQUIP / EQUIP_INFER` L727, L919 — kit requirements per move
- `CONTENT_*` L945+ — coaching-note lookups

## js/plans.js (data)
- `READY_PLANS` L4 — 57 ready blocks with cover art metadata

## sw.js
- `install` — pre-cache `ASSETS` under `body-app-v312`
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
