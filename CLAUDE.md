# Rackside — working notes for Claude Code

Vanilla-JS training PWA, no build step, everything on-device. Live at
https://gctc26wwr2-max.github.io/Body-App/ (case-sensitive URL).

Repo layout since the Capacitor scaffold: the web app lives in `www/`
(everything GitHub Pages serves); `ios/` is the generated Xcode shell
(`ios/App/App/public` is gitignored — `npx cap sync ios` regenerates it);
`capacitor.config.json` pins appId com.rackside.training and webDir www;
`codemagic.yaml` builds and uploads to TestFlight on Codemagic's Macs, so
no local Mac is needed. Docs stay at repo root.

**Read FUNCTIONS.md first** — it maps every function to its file and states
the app's structure. Keep both documents updated when code moves or a new
area appears.

## How the code is organized

The app is 14 plain scripts in `www/js/`, loaded in order by `index.html`
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
7. Media blobs only move through `mediaStore` (core.js) — never touch the
   'media' IndexedDB store directly. This is the Capacitor seam: blobs in
   IndexedDB inside WKWebView are the fragile piece on iOS. The read side
   (mediaURL) already handles both {blob} and {path} records.

## Capacitor wrap-day checklist (do DURING the wrap, not after)

- **Move the media store first.** On first native launch, before anything
  renders: run the migration sketched in migrate() (js/boot.js) — every
  'media' record's blob becomes a file under Directory.Data/media/<id>,
  the record keeps {id, exerciseId, type, path}, stamp 'mediaNative1'.
  Give mediaStore.save/remove native branches the same day. Callers never
  change.
- **The update model flips.** "Update lands on next open" is the web
  build's story; native releases go through App Store review (days, not
  minutes). checkUpdate() is already gated on IS_NATIVE (core.js) so the
  native build never prompts reloads that do nothing — keep it that way,
  and bump the marketing version in the native shell instead.
- IS_NATIVE also counts the wrap as "installed", so the Add-to-Home-Screen
  hint stays hidden.

## Design review (v6) — the standing layout decisions

- Today: one hero. Eyebrow (date · greeting · streak) → arc with the day
  name inside → Start → exercise list → weekday strip → install hint last.
  No block card; the greeting never takes the title slot.
- Five tabs. Blocks is folded into Plan as segments (`masterTab`); keep
  `show('library')` aliased to Plan.
- Stats compares full weeks only; the running week is 'so far' and hollow.
- Never render a table header without rows; pluralise counts.
- Faint text that carries words is #857C73, not #6A625A.

## UI rules (owner's standing preferences)

- Minimum text; it's a phone app — space is scarce; check text size always.
- Custom controls over stock inputs (rulers, rails, wheels, the bezel
  watch); clicky/haptic feedback on detents.
- All font sizes in rem (root 17px, `-apple-system-body` on iOS) — never px.

## Ship loop (every change)

1. Bump `APP_VERSION` in `www/js/core.js`, cache name in `www/sw.js`
   (`body-app-vNNN`), and `www/version.json` — all three, same number.
2. Run the unit suite: open `www/tests.html` (headless: load it in Playwright
   and read `window.__results`). It covers the untrusted-input paths
   (parseBlockReply, restoreData + the migration ladder) and the training
   math; it fakes localStorage and DB, so it never touches real data. Add
   cases there when touching those functions.
3. Verify UI headlessly: Playwright, chromium at `/opt/pw-browsers/chromium`,
   iPhone 13 profile, local server on :8899 rooted at `www/`. Test scripts live in the
   session scratchpad; seed state via `DB.put` in `page.evaluate`, not UI
   clicking. Known pitfalls: settings hides the tabbar (leave via
   `#view-prefs .w-chip`); prefs commit via the Save modal on close;
   dialogs need a handler.
4. Commit to branch `claude/training-practices-tracker-rwcbe5` ONLY; never
   create PRs unless asked.
5. Deploy: copy changed files FROM `www/` into the gh-pages clone
   (/tmp/ghp — Pages keeps the old flat layout), push
   gh-pages, then poll
   `https://gctc26wwr2-max.github.io/Body-App/version.json` until it
   serves the new version (background until-loop; plain `sleep` chains are
   blocked).

## Documents

- FUNCTIONS.md — function-level map of the codebase (keep current).
- FEATURES.md — user-facing feature inventory.
- INJURY-FLAGS-REVIEW.md — physio review pack for the injury filter.
