# Rackside — working notes for Claude Code

Vanilla-JS training PWA, no build step, everything on-device. Live at
https://gctc26wwr2-max.github.io/Body-App/ (case-sensitive URL).

**Read FUNCTIONS.md first** — it maps every function to its file and states
the app's structure. Keep both documents updated when code moves or a new
area appears.

## How the code is organized

The app is 14 plain scripts in `js/`, loaded in order by `index.html`
(core → today → workout → controls → plan → settings → profile → stats →
planmaker → cardio → libviews → ai → detail → boot). Classic scripts share
one global scope: top-level `const`/`let`/`function` in an earlier file are
visible in every later file. Rules that follow from this:

- Do NOT wrap a part file in an IIFE or convert it to a module — that would
  hide its declarations from the other parts.
- Shared mutable state (`exercises`, `plans`, `currentTab`, drafts…) is
  top-level `let`, mostly in `core.js`. Declare new shared state at top
  level in the earliest file that needs it.
- A file may only *call into* later files at runtime (event handlers,
  renderers), never during its own top-level execution.
- New top-level names must be unique across all 14 files, and must not
  shadow the data globals from `js/library.js` / `js/plans.js`.

## Invariants (check before and after any edit)

1. Weights are STORED in kg everywhere; lb exists only at the display/input
   edge (`toW/fromW`, `jumpBase`, `JUMP_LB_OPTS` in core.js).
2. Assisted exercises invert in one place: `isAssisted` drives suggestion
   direction, PRs (min-help), deload, and trend wording together.
3. Timed exercises route reps UI → seconds UI via `isTimedEx` (plan maker,
   live workout, migrations, backups).
4. Every drag control pairs with `a11ySlider` AND a tap/type door
   (numpad); every call site passes an aria label.
5. The injury filter is a filter, not medical advice — wording lives in the
   injuries UI and INJURY-FLAGS-REVIEW.md; flags come from MOVEMENTS stress
   tags in js/library.js.
6. Any change to stored data shape: bump `BACKUP_SCHEMA` and add a
   `BACKUP_MIGRATIONS` step (profile.js), plus an in-app one-time migration
   if live devices carry the old shape.

## UI rules (owner's standing preferences)

- Minimum text; it's a phone app — space is scarce; check text size always.
- Custom controls over stock inputs (rulers, rails, wheels, the bezel
  watch); clicky/haptic feedback on detents.
- All font sizes in rem (root 17px, `-apple-system-body` on iOS) — never px.

## Ship loop (every change)

1. Bump `APP_VERSION` in `js/core.js`, cache name in `sw.js`
   (`body-app-vNNN`), and `version.json` — all three, same number.
2. Verify headlessly: Playwright, chromium at `/opt/pw-browsers/chromium`,
   iPhone 13 profile, local server on :8899. Test scripts live in the
   session scratchpad; seed state via `DB.put` in `page.evaluate`, not UI
   clicking. Known pitfalls: settings hides the tabbar (leave via
   `#view-prefs .w-chip`); prefs commit via the Save modal on close;
   dialogs need a handler.
3. Commit to branch `claude/training-practices-tracker-rwcbe5` ONLY; never
   create PRs unless asked.
4. Deploy: copy changed files into the gh-pages clone (/tmp/ghp), push
   gh-pages, then poll
   `https://gctc26wwr2-max.github.io/Body-App/version.json` until it
   serves the new version (background until-loop; plain `sleep` chains are
   blocked).

## Documents

- FUNCTIONS.md — function-level map of the codebase (keep current).
- FEATURES.md — user-facing feature inventory.
- INJURY-FLAGS-REVIEW.md — physio review pack for the injury filter.
