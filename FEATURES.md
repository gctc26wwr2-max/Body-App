# Rackside — every feature, in plain words
*As of v279 · https://gctc26wwr2-max.github.io/Body-App/*

Rackside is a training app that lives entirely on your phone. No account, no
server, no subscription — everything is stored on the device, it works offline,
and you can install it to your home screen like any app.

---

## Today

- **Home screen** with your current block drawn as an arc of days — what is
  banked, what is next, where the deload falls.
- One tap starts today's training day.
- A **floating rest pill** follows you to other tabs while a rest timer runs.

## Training (the live workout)

- **Exercise rail** — the day's movements on a vertical timeline with photos.
  The active one expands; done ones dim; the line never draws through markers.
- **Weight scale** — a sliding ruler under every set. Drag it like a real
  scale, with a haptic tick per notch. It is infinite (rebased mid-drag),
  empty below zero, and steps in your equipment's real jumps:
  dumbbells 1–2 kg, machines and cables 2.5, barbells 2.5 — all three
  configurable per gym in Settings.
- **Type a weight** — the pencil chip opens the app's own number pad (no
  system keyboard). A typed value becomes a real tick on the ruler, even
  off-grid (19 kg on a 2.5 machine stays 19).
- Quick chips: **+2.5 / +5 / +10**, back-to-opening-weight, zero.
- **Warm-up ramp** — with warm-up on, the first lift gets two lighter W sets
  (50% × 8, 75% × 5). They keep to themselves: changing a W weight never
  drags the working sets down, and they never trigger progression advice.
- **Warm-up routine** — five easy minutes dealt from a pool: pulse work plus
  two drills matched to the day (lower days loosen hips/knees, upper days
  shoulders/trunk). The deal advances every banked day, so no two sessions
  in a row warm up the same. Every step is photographed and watchable while
  the timer counts.
- **Timed sets** — holds (plank, carries…) run on the same ruler in seconds,
  with a full-screen countdown you can read from the floor: 3-second lead-in,
  per-side phases, pause, and Stop that records the time actually held.
- **Reps logging** — tap the number, adjust on a strip; the row colours by
  where you landed against the target range (under / in / above).
- **Rest timer** — starts on logging a set, adjustable ±15 s, skippable.
  When it ends, the next unfinished exercise expands and scrolls into view.
- **Progression advice** — hit the top of the rep range and the app offers
  "+2.5 kg on your remaining sets" (step sized to the equipment). One tap
  applies it to the unlogged working sets.
- **PR detection** — beat your best estimated 1RM and the session banks a PR.
- **Pass** — can't face a movement today? Pass it (today only). Passed
  exercises are stepped over by rest auto-advance and reported separately.
- **Add mid-workout** — pull any exercise into the running session.
- **Pause** — a full-screen overlay freezes everything; discard lives there.
- **Live status line** — elapsed time, sets banked, and a live kcal estimate.
- **One save** — finishing is a single confirmation, then a summary screen
  with duration, volume, records, and a 5-star rating.

## Blocks (programs)

- **Build** — a block builder: name, weeks (with optional deload week),
  training days, exercises via search, sets × rep-range per movement.
  Exercises order themselves hardest-first; drag to reorder in the editor.
- **Ready — 57 installable programs** (203 days, 970 exercises, every name
  validated, every movement photographed). Browsable as picture-card shelves
  grouped by days-per-week, filtered by audience (anyone / women / men) and
  split (full body, upper/lower, PPL, push/pull, body part, home, muscle
  focus). Each card's cover is a mosaic of its own exercises.
  - **Start here** — one block picked for you from About-you answers
    (experience, sex, muscle focus). A calves focus really does surface the
    calves block.
  - **Preview sheet** — every exercise with photo, sets and reps, day by
    day; tap through to the full movement page. Kit gaps are called out.
  - Install now, **queue after the current block**, or replace it.
- **Ask AI** — the app writes a complete prompt for any chatbot: your
  program, raw sessions, **trends per lift** (climbing / stalled / reps
  under range), **often-skipped movements**, **real attendance vs plan**,
  last PR, blocks already run, body data, injuries, kit — plus the exact
  JSON shape to answer in and the catalogue of allowed exercise names
  (pre-filtered by your equipment and injuries). Paste the reply back and
  it becomes a block: fences, prose, curly quotes, trailing commas, wrong
  names and silly numbers are all survived, with anything odd flagged
  before you accept.
- **Library** — the full catalogue (183 movements) with photos, groups,
  difficulty, form cues; add your own exercises with photos/videos;
  premade ones can be hidden, yours can be edited.
- **Deload weeks** — the last week of a block can run 2/3 of the sets at
  ~60% load, automatically.
- **Week gating** — you can't run ahead of the calendar or skip into next
  week until this one is banked.

## Cardio

- **17 activities**, indoor and outdoor variants, each with honest MET
  rates (a street run costs more than a treadmill).
- **Programs per activity** — every activity has its own list with its own
  clock (Run: easy/tempo/intervals/hill/long · Boxing: rounds like the
  ring · Football: kickabout/5-a-side/the full ninety · Hiking up to two
  hours…). Picking one spins the minutes wheel to match; touching the
  minutes yourself hands the time back to you (program returns to None).
- Live session timer with progress, kcal estimate from your body weight,
  and a week summary line. History is editable (delete entries).

## Stats

- Weekly volume, session history with per-set detail, personal records,
  body-weight log with a ruler input, and trend charts.

## Profile & Settings

- **About you** — age, sex, height (cm/ft), goal, experience, session
  length, all on rails and rulers; tape measurements (waist/neck) give a
  body-fat estimate (Navy formula).
- **Muscle focus** — tap up to three muscles on a body diagram (or chips);
  biases the Ready pick and the AI prompt.
- **Injuries** — toggle current issues; risky movements are filtered from
  pickers, presets and AI suggestions, with substitutes requested instead.
- **Equipment** — tick what your gym has; everything (pickers, ready
  blocks, AI catalogue, warm-up drills) respects it.
- **Weight jumps** — how big one notch is for dumbbells, machines,
  barbells; used by rulers, chips and progression advice.
- **Units** — kg/lb and cm/ft.
- **Rest default**, warm-up on/off, and a settings draft that only commits
  on Save.
- **Backup / restore** — one JSON file out, same file back in. Files are stamped with a schema version; older files are migrated forward on restore, files from a newer app are refused with a clear message.
  **Report for Claude** — the full training report as text.
- **Reset history** with confirmation.

## The fabric

- **Offline-first PWA** — service worker, versioned cache, works in
  airplane mode; update lands on next open.
- **All data local** — IndexedDB + localStorage. Nothing leaves the phone
  unless you share a backup or copy the AI prompt.
- A **live session survives** a closed tab, a reload, even a phone restart.
- **Clay design** — dark, warm palette; Archivo type; haptics on every
  meaningful touch; built for one hand on a phone in a gym.
