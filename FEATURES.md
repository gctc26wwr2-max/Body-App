# Rackside — every feature, in plain words
*As of v333 · https://gctc26wwr2-max.github.io/Body-App/*

Rackside is a training app that lives entirely on your phone. No account, no
server, no subscription — everything is stored on the device, it works offline,
and you can install it to your home screen like any app.

---

## Today

- **Home screen** with your current block drawn as an arc of days — what is
  banked, what is next, where the deload falls, week labels anchored under
  the arc's feet.
- **One hero, Start above the fold** — the eyebrow line carries the date,
  a greeting by name ("Welcome back, Amin" after six hours away, else the
  time of day) and the streak; the arc with today's day name inside it is
  the only hero; a single Start button sits right under it, then the
  exercise list, then the quiet weekday strip.
- A **floating rest pill** follows you to other tabs while a rest timer runs.
- **First-run coach marks** — one hint each for the weight scale, the reps
  strip and the rest pill, shown once, plus honest empty states before any
  block exists (starter block, ready programs, build-your-own).

## Training (the live workout)

- **Exercise rail** — the day's movements on a vertical timeline with photos.
  The active one expands; done ones dim; the line never draws through markers.
- **Weight scale** — a sliding ruler under every set. Drag it like a real
  scale, with a haptic tick per notch. It is infinite (rebased mid-drag),
  empty below zero, and steps in your equipment's real jumps — all three
  kinds configurable per gym in Settings on picker wheels.
- **Type a weight** — the pencil chip opens the app's own number pad (no
  system keyboard). A typed value becomes a real tick on the ruler, even
  off-grid (19 kg on a 2.5 machine stays 19).
- Quick chips: **+2.5 / +5 / +10**, back-to-opening-weight, zero — in lb
  mode the chips, ruler ticks, advice and plate math all speak real lb
  plates (5/10/25, 45 lb bar), never converted decimals.
- **Plate math** — the bar loading spelled out per side, float-proof.
- **Warm-up ramp** — with warm-up on, the first lift gets two lighter W sets
  (50% × 8, 75% × 5). They keep to themselves: changing a W weight never
  drags the working sets down, and they never trigger progression advice.
- **Warm-up routine** — five easy minutes dealt from a pool: pulse work plus
  two drills matched to the day. The deal advances every banked day, so no
  two sessions in a row warm up the same. Every step photographed.
- **Timed sets** — 24 movements the app knows are measured in seconds
  (planks, carries, sleds, dead hangs…) run on a seconds ruler with a
  full-screen countdown: 3-second lead-in, per-side phases, pause, and Stop
  that records the time actually held. The plan maker offers a seconds
  wheel for them, and old rep-based plans were migrated once, honestly.
- **Assisted machines count backwards** — on assisted pull-ups/dips, less
  help is the achievement: advice says "drop the help", PRs are minimum
  help, deloads add help, and trends read the right way up.
- **Reps logging** — tap the number to type it, or adjust on a strip; the
  row colours by where you landed against the target range.
- **Rest timer** — starts on logging a set, adjustable ±15 s, skippable.
  When it ends, the next unfinished exercise expands and scrolls into view.
- **Progression advice** — hit the top of the rep range and the app offers
  the next real jump for that equipment; one tap applies it to the
  remaining working sets.
- **PR detection** — beat your best estimated 1RM (or minimum help) and the
  session banks a PR.
- **Pass**, **add mid-workout**, **pause overlay**, live status line, and a
  one-confirmation save into a summary with duration, volume, records and a
  5-star rating.

## Plan (your block, and where blocks come from)

Five tabs, not six: a block *is* the plan, so Ready · Build · Ask AI ·
Library live as segments under the Plan header, with your running block as
the default. Done days carry their own summary (Mon · 3,760 kg · 14 sets ·
46 min); past sessions delete by swipe, not a permanent ✕.

- **Build** — a block builder on three picker wheels: sets · exercise ·
  reps (or seconds), with search, kit- and injury-aware pool, difficulty
  line that repaints per detent, hardest-first ordering, drag to reorder.
- **Ready — 57 installable programs** (203 days, 970 exercises, every name
  validated, every movement photographed), browsable as picture-card
  shelves grouped by days-per-week, filtered by audience and split, with a
  Start-here pick from your About-you answers, full preview sheets, kit-gap
  callouts, and install / queue / replace.
- **Ask AI** — the app writes a complete prompt for any chatbot: program,
  raw sessions, trends per lift, often-skipped movements, real attendance,
  last PR, blocks already run, body data, injuries, kit — plus the exact
  JSON shape and the allowed exercise names. Paste the reply back and it
  becomes a block: fences, prose, curly quotes, trailing commas, bare
  arrays, duplicate keys, wrong names, other alphabets and silly numbers
  are all survived (unit-tested against garbage), with kit gaps tagged on
  import.
- **Library** — the full catalogue (183 movements): the photo sits in the
  palette (desaturated under a gradient) with the name on it, level chip,
  two-line "what it is for" with more, form cues; add your own exercises with
  photos/videos, a load-vs-assistance switch, and automatic seconds
  detection.
- **Deload weeks** and **week gating** as before.

## Cardio

- **17 activities** (Padel included), indoor and outdoor variants, honest
  MET rates.
- **Programs per activity** — each activity has its own list with its own
  clock. Picking one turns the watch to match; turning the bezel yourself
  hands the time back (program returns to None and the bezel winds home).
- **The watch** — the timer is a dive-watch dial: a turnable outer bezel
  with ratchet clicks sets the minutes (5-minute detents, centre-tap to
  type instead), and while running an inner dial takes over with a minute
  orbit dot and progress ring. Accidental grazes near the centre can't
  reset it. Default is zero — Start stays off until you set a time.
- Live session with pause, kcal from your body weight, week summary line,
  editable history.

## Stats

- **Honest weeks** — the running week is incomplete, so headline numbers
  are the **last full week** with its delta, this week shows as "so far",
  and sparklines draw it as a hollow point off the line. Consistency dots
  (target × per week, current week hollow) sit at the top.
- Session history with per-set detail, last-vs-previous for the same day,
  personal records (minimum-help for assisted machines), body-weight trend.

## Profile & Settings

- **Your profile** — an identity card: photo (downscaled and stored
  on-device), name typed inline, and a vitals line — age, height, latest
  body weight, tape body-fat — plus "Training since …". The name powers
  the Today greeting and leads the Claude report.
- **About you** — birth month + year on wheels (the age computes itself and
  never goes stale), sex, height (cm/ft), goal, experience, session
  length, tape measurements for the Navy body-fat estimate.
- **Accent colour** — a hue wheel: drag the ring for any colour (always at
  the app's own saturation and lightness), six preset dots beneath, live
  preview, Save to keep. Recolours everything, done-day dots included.
- **Muscle focus**, **Injuries** (filter, not medical advice — the flag
  table ships as a review pack for a physio, INJURY-FLAGS-REVIEW.md, with
  desk-research citations), **Equipment** on a photo grid with All /
  untick-all.
- **Weight jumps** on three centred wheels (dumbbell / machine / barbell),
  with micro-plates to stack pins and real lb options in lb mode.
- **Units** (kg/lb, cm/ft), **week start day** (any weekday — every weekly
  number moves with it), rest default, alert sound, warm-up switch; the
  whole settings screen is a draft that commits on Save.
- **Backup / restore** — one JSON file out, same file back in. Files are
  stamped with a schema version; older files are migrated forward on
  restore (kit split, reps→seconds), files from a newer app are refused
  with a clear message, and everything restored is type-scrubbed so a
  crafted file can't plant garbage or markup.
- **Report for Claude** — the full training report as text.
- **Reset history** with confirmation.

## Accessibility

- Every drag control — rulers, rails, wheels, the bezel, the hue wheel —
  is a real slider to VoiceOver: labelled, valued, and steppable with
  arrow keys.
- Every gesture has a typing door: pencil chips, tappable readouts, the
  watch's centre tap.
- All text follows the system font size (Dynamic Type).

## The fabric

- **Offline-first PWA** — service worker, versioned cache, works in
  airplane mode; update lands on next open.
- **All data local** — IndexedDB + localStorage. Nothing leaves the phone
  unless you share a backup or copy the AI prompt.
- A **live session survives** a closed tab, a reload, a phone restart —
  and corrupted stored state is dropped cleanly at boot instead of
  bricking the app.
- **Hardened edges** — the two untrusted inputs (AI replies, backup files)
  are unit-tested against garbage and scrubbed; nothing imported reaches
  the page as markup.
- **Small files, no build** — 14 plain scripts sharing one namespace
  (FUNCTIONS.md maps them), a browser test page (tests.html, 39 checks
  against faked storage), and CLAUDE.md carrying the invariants.
- **Clay by default, yours by choice** — dark, warm palette; Archivo type;
  haptics and ratchet clicks on every meaningful touch; built for one hand
  on a phone in a gym.
