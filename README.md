# Body App — Training Tracker

A mobile training tracker you install straight from the browser (PWA — no App Store needed).

**What it does**

- 🏋️ **Exercises** — add your training practices with **photos or videos** (recorded with your camera or picked from your gallery), muscle group, and notes.
- ✅ **Workout** — log your **reps, sets, and weight** for today; edit any session later.
- 🗓️ **Plans** — build workout plans (exercise + target sets × reps), then **Start** a plan and check off exercises as you go — the target is prefilled when you log.
- 📈 **History** — every session, grouped by day, tap to edit or delete.

Everything is stored **on your phone** (IndexedDB), so it works fully offline — including your photos and videos. Nothing is uploaded anywhere.

## Install on iPhone

1. Host the app (see below) and open the link in **Safari**.
2. Tap the **Share** button (square with arrow).
3. Tap **Add to Home Screen** → **Add**.

It now opens fullscreen from your home screen like a native app, works offline, and keeps your data.

> Tip: use it from the home-screen icon (not the Safari tab) — installed web apps get their own permanent storage on iOS.

## Hosting (one-time, free)

The repo includes a GitHub Pages workflow. To turn it on:

1. On GitHub: **Settings → Pages → Source → GitHub Actions**.
2. Merge/push this code to `main`.
3. Your app will be live at `https://<username>.github.io/Body-App/`.

Any static host works too — just serve the files over HTTPS (required for the service worker and camera access).

## Development

No build step — plain HTML/CSS/JS. Serve the folder with any static server:

```sh
python3 -m http.server 8000
```

Structure:

```
index.html            app shell (tabs, sheets/modals)
css/styles.css        mobile-first dark UI
js/db.js              IndexedDB wrapper (exercises, media blobs, sessions, plans)
js/app.js             all app logic
sw.js                 service worker (offline app shell)
manifest.webmanifest  PWA manifest
icons/                app icons
```
