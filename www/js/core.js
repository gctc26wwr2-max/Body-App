/* RACKSIDE — strength training app. All data on-device (IndexedDB). */
/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
  const APP_VERSION = 'v328';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    /* a bare <button> inside a <form> defaults to type=submit, so any control
       we build and drop into one would save and close it on the first tap.
       The two real submit buttons are declared in the markup. */
    if (tag === 'button') e.type = 'button';
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  };
  const svgIcon = (path, size = 11, fill = 'currentColor') => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 12 12');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', path);
    p.setAttribute('fill', fill);
    s.appendChild(p);
    s.style.verticalAlign = '-1px';
    return s;
  };
  const PLAY = 'M2.5 1.2 L10.8 6 L2.5 10.8 Z';
  const PAUSE = 'M2.5 1.5 h2.6 v9 h-2.6 Z M6.9 1.5 h2.6 v9 h-2.6 Z';

  /* Running inside a Capacitor wrap? The web build must already know the
     difference: native releases ship through App Store review, so the
     self-update loop is meaningless there, and media lives on the native
     filesystem instead of as blobs in a WKWebView's IndexedDB. */
  const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform
    && window.Capacitor.isNativePlatform());

  /* ---------------- state ---------------- */
  let exercises = [];
  let plans = [];
  let currentTab = 'today';
  let mediaURLs = new Map();
  let pendingMedia = [];
  let editingExerciseId = null;
  let editingPlanId = null;
  let planDraft = null;
  let statsLift = null;
  let planHistOpen = false;   // Plan tab shows the last few sessions until asked
  let cardioHistOpen = false;
  let detailReturn = null;   // where the detail screen goes back to

  const todayStr = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const dateOf = s => new Date(s + 'T00:00:00');
  const fmtClock = s => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(ss).padStart(2, '0');
  };
  const fmtKg = v => (Math.round(v * 100) / 100).toLocaleString('en-US');

  /* ---------------- units ----------------
     Everything is stored metric — kilos and centimetres — and converted only
     where it is shown or typed, so switching units never rewrites history. */
  const LB_PER_KG = 2.20462262;
  const wUnit = () => (getProfile().units === 'lb' ? 'lb' : 'kg');
  const toW = kg => (wUnit() === 'lb' ? kg * LB_PER_KG : kg);
  const fromW = v => +(wUnit() === 'lb' ? v / LB_PER_KG : v).toFixed(3);
  const fmtWn = kg => fmtKg(toW(kg));
  const fmtW = kg => fmtWn(kg) + ' ' + wUnit();
  const wStep = () => (wUnit() === 'lb' ? 1 : 0.5);
  const wPlates = () => (wUnit() === 'lb' ? [5, 10, 25] : [2.5, 5, 10]);
  const wBump = () => (wUnit() === 'lb' ? 5 / LB_PER_KG : 2.5);
  /* nearest weight you could actually load, in the increment this user works
     in — a deload of 61.4kg helps nobody */
  /* How much one notch is worth depends on what you are holding: dumbbells
     go up a pair at a time, a stack goes up a pin, a bar goes up a pair of
     plates — and every gym's rack is different, so Settings can re-pin each
     one. Stored in kg; shown in whatever unit you use. */
  const JUMP_KINDS = [
    { key: 'db', label: 'Dumbbells & kettlebells', short: 'Dumbbell', opts: [0.5, 1, 1.25, 2, 2.5, 4, 5], def: 2 },
    { key: 'mach', label: 'Machines & cables', short: 'Machine', opts: [0.5, 1, 1.25, 2, 2.5, 5, 7.5, 10], def: 2.5 },
    { key: 'bar', label: 'Barbell', short: 'Barbell', opts: [0.5, 1, 1.25, 2.5, 5, 10], def: 2.5 }
  ];
  const jumpKind = ex => {
    const ks = equipOf(ex);
    if (ks.includes('barbell')) return 'bar';
    if (ks.some(k => k === 'machine' || k === 'cable' || k.startsWith('m-'))) return 'mach';
    return 'db';
  };
  const jumpKg = ex => {
    const kind = jumpKind(ex);
    const j = +((getProfile().jumps || {})[kind]);
    return j > 0 ? j : JUMP_KINDS.find(k => k.key === kind).def;
  };
  /* the same jump in the unit on screen — lb racks move in their own steps,
     so a stored metric jump maps to the real plate next to it, never to a
     converted decimal */
  const KG2LB_JUMP = { 0.5: 1, 1: 2.5, 1.25: 2.5, 2: 5, 2.5: 5, 4: 10, 5: 10, 7.5: 15, 10: 20 };
  const jumpW = ex => (wUnit() === 'lb' ? (KG2LB_JUMP[jumpKg(ex)] || 5) : jumpKg(ex));
  /* one on-screen jump expressed in kg — what progression actually adds, so
     an lb lifter climbs in 5 lb, not in 2.5 kg dressed up as 5.51 */
  const jumpBase = ex => (wUnit() === 'lb' ? (KG2LB_JUMP[jumpKg(ex)] || 5) / LB_PER_KG : jumpKg(ex));
  const jumpLabel = kgv => (wUnit() === 'lb' ? fmtKg(KG2LB_JUMP[kgv] || 5) : fmtKg(kgv)) + ' ' + wUnit();
  /* lb gyms rack lb options; stored value stays in kg so nothing else moves */
  const JUMP_LB_OPTS = {
    db: [[1, 0.5], [2.5, 1], [5, 2], [10, 4]],
    mach: [[1, 0.5], [2.5, 1], [5, 2.5], [10, 5], [15, 7.5], [20, 10]],
    bar: [[1, 0.5], [2.5, 1.25], [5, 2.5], [10, 5], [20, 10]]
  };

  /* ---------------- accent ----------------
     One colour runs the whole app. The stylesheet leans on --lime and
     friends; the JS-built SVGs use ACC. applyAccent() points both at the
     chosen swatch — pass a key to preview, no argument to follow whatever
     the saved profile says. */
  const ACCENTS = [
    { key: 'clay', label: 'Clay', hex: '#CE6B3D' },
    { key: 'moss', label: 'Moss', hex: '#9AA84E' },
    { key: 'sea', label: 'Sea', hex: '#4E9FA8' },
    { key: 'sky', label: 'Sky', hex: '#6B8FCE' },
    { key: 'orchid', label: 'Orchid', hex: '#B06BCE' },
    { key: 'ember', label: 'Ember', hex: '#CE4B55' }
  ];
  let ACC = '#CE6B3D';
  const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixHex = (a, b, t) => {
    const A = hexRGB(a), B = hexRGB(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const accRGB = () => hexRGB(ACC).join(',');
  /* hue in, hex out — the wheel works in HSL at the palette's fixed
     saturation and lightness, so every pick sits in the app's register */
  const hslHex = (h, s, l) => {
    s /= 100; l /= 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return ('#' + f(0) + f(8) + f(4)).toUpperCase();
  };
  const hueOf = hex => {
    const [r, g, b] = hexRGB(hex).map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === mn) return 0;
    const d = mx - mn;
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round(h * 60) % 360;
  };
  /* accepts a preset key ('sea'), a raw hex from the wheel, or nothing —
     nothing means follow whatever the saved profile says */
  function applyAccent(sel) {
    const v = sel ?? getProfile().accent;
    ACC = /^#[0-9A-Fa-f]{6}$/.test(String(v || ''))
      ? String(v).toUpperCase()
      : (ACCENTS.find(x => x.key === v) || ACCENTS[0]).hex;
    const s = document.documentElement.style;
    s.setProperty('--lime', ACC);
    s.setProperty('--acc-rgb', accRGB());
    s.setProperty('--lime-bg', `rgba(${accRGB()},.08)`);
    s.setProperty('--lime-border', `rgba(${accRGB()},.30)`);
    s.setProperty('--lime-dim', mixHex(ACC, '#000000', .15));
    s.setProperty('--lime-pale', mixHex(ACC, '#FFFFFF', .18));
    /* the accent at half strength, flattened onto the canvas — done-day
       markers on the plan rail */
    s.setProperty('--clay-dim', mixHex(ACC, '#0B0908', .5));
    return ACC;
  }

  const wRound = kg => {
    const step = wBump();
    return kg > 0 ? Math.max(step, Math.round(kg / step) * step) : 0;
  };      // one small jump, in kg
  /* which day the week turns over — a Monday gym week is not universal:
     plenty of the world starts Saturday or Sunday, and every weekly number
     in the app moves with it */
  const WEEK_DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const weekStartDow = () => WEEK_DOW[getProfile().weekStart] ?? 1;
  const dowFrom = d => (d.getDay() - weekStartDow() + 7) % 7;   // 0 = the week's first day
  const weekStripOff = () => (weekStartDow() + 6) % 7;          // Mon-based index of cell 0

  const hUnit = () => (getProfile().hUnits === 'ft' ? 'ft' : 'cm');
  const fmtH = cm => {
    if (!(cm > 0)) return '—';
    if (hUnit() !== 'ft') return Math.round(cm) + ' cm';
    const inch = Math.round(cm / 2.54);
    return `${Math.floor(inch / 12)}'${inch % 12}"`;
  };

  /* ---------------- accessibility ----------------
     Every drag control also answers to a screen reader and a keyboard:
     role=slider, a spoken value, and arrow keys stepping the exact same
     commit the drag makes. The gesture stays; it stops being the only
     door in. */
  function a11ySlider(wrap, o) {
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'slider');
    wrap.setAttribute('aria-label', o.label || 'value');
    if (o.min != null) wrap.setAttribute('aria-valuemin', o.min);
    if (o.max != null) wrap.setAttribute('aria-valuemax', o.max);
    wrap.setAttribute('aria-orientation', o.orient || 'horizontal');
    const paint = () => {
      wrap.setAttribute('aria-valuenow', o.now());
      wrap.setAttribute('aria-valuetext', o.text());
    };
    paint();
    wrap.addEventListener('keydown', e => {
      let d = 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -1;
      else return;
      e.preventDefault();
      o.step(d);
      paint();
    });
    return paint;
  }

  /* ---------------- coach marks ----------------
     A control you built explains itself to you; to a stranger it is
     somebody else's machine. One short line, anchored to the control,
     shown once ever, gone on the first touch. Never a tutorial deck. */
  const coachSeen = k => localStorage.getItem('coach.' + k) === '1';
  function coachMark(anchor, text, key) {
    if (!anchor || coachSeen(key)) return;
    localStorage.setItem('coach.' + key, '1');
    const tip = el('div', 'coach-tip');
    tip.textContent = text;
    document.body.appendChild(tip);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const r = anchor.getBoundingClientRect();
      if (!r.width) { tip.remove(); return; }
      tip.style.left = Math.max(10, Math.min(innerWidth - tip.offsetWidth - 10,
        r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
      const above = r.top > tip.offsetHeight + 24;
      tip.style.top = (above ? r.top - tip.offsetHeight - 10 : r.bottom + 10) + 'px';
      tip.classList.toggle('below', !above);
      tip.classList.add('in');
    }));
    const go = () => { tip.classList.remove('in'); setTimeout(() => tip.remove(), 300); };
    setTimeout(go, 7000);
    ['pointerdown', 'scroll'].forEach(ev =>
      addEventListener(ev, go, { once: true, capture: true, passive: true }));
  }

  /* ---------------- pure logic (design spec) ---------------- */
  const est1RM = (kg, reps) => reps > 0 ? kg * (1 + reps / 30) : 0;   // Epley
  /* On an assisted machine the stack is help, not load — progress runs the
     other way. Less weight is the achievement, and zero is graduation. */
  const isAssisted = ex => !!(ex && (ex.assisted || /assisted/i.test(ex.name || '')));
  /* seconds, not reps: the catalogue names its timed movements outright;
     a custom exercise opts in by mentioning seconds in its notes */
  const isTimedEx = ex => !!(ex && (
    (window.TIMED_EXERCISES || []).includes(ex.name) || /second/i.test(ex.notes || '')));

  function suggestion(sets, ex) {
    // warm ramp sets are deliberately light — they neither earn an
    // increase nor set the weight the working sets should hold
    const logged = sets.filter(s => s.done && !s.warm);
    if (!logged.length) return { kind: 'idle' };
    const last = logged[logged.length - 1];
    const step = ex ? jumpBase(ex) : wBump();  // the jump the kit in hand allows, in the unit on screen
    if (last.reps >= last.targetHi) {
      const down = isAssisted(ex);
      return {
        kind: 'increase', step, down,
        nextKg: +(down ? Math.max(0, last.kg - step) : last.kg + step).toFixed(3),
        last
      };
    }
    return { kind: 'hold', kg: last.kg, last };
  }
  function applySuggestion(sets, nextKg) {
    sets.forEach(s => { if (!s.done && !s.warm) s.kg = nextKg; });
  }
  function repTone(set) {
    // colour code vs the target range (e.g. 8-10): under / in / above
    if (set.reps < set.targetLo) return 'below';
    if (set.reps > set.targetHi) return 'above';
    return 'inrange';
  }
  function plateMath(totalKg, barKg = 20) {
    const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
    let side = (totalKg - barKg) / 2;
    if (side <= 0) return [];
    const out = [];
    /* a hundredth of tolerance: unit round-trips leave float dust on the
       side weight, and 89.999 must still load as two 45s */
    for (const p of plates) {
      while (side >= p - 0.01) { out.push(p); side -= p; }
    }
    return out;
  }
  /* the loading line in the gym's own iron: 20 kg bar and kg plates, or a
     45 lb bar and lb plates — never a metric bar converted */
  function plateLine(kg) {
    if (wUnit() !== 'lb') return { bar: 20, list: plateMath(kg) };
    const bar = 45;
    let side = (toW(kg) - bar) / 2;
    if (side <= 0) return { bar, list: [] };
    const out = [];
    for (const p of [45, 35, 25, 10, 5, 2.5]) {
      while (side >= p - 0.01) { out.push(p); side -= p; }
    }
    return { bar, list: out };
  }
  const isBarbell = ex => /(^|\s)bar(bell)?\b/i.test((ex.name || '') + ' ' + (ex.notes || ''));

  function planWeek(plan) {          // calendar week since start
    if (!plan.startDate) return null;
    const days = Math.floor((Date.now() - dateOf(plan.startDate).getTime()) / 86400000);
    return Math.floor(days / 7) + 1;
  }
  function progressWeek(plan) {      // first week whose days aren't all done
    const weeks = plan.weeks || 4;
    const nDays = (plan.days || []).length || 1;
    for (let w = 1; w <= weeks; w++) {
      const done = new Set((plan.completed || []).filter(c => c.week === w).map(c => c.day));
      if (done.size < nDays) return w;
    }
    return weeks;
  }
  /* the week you're allowed to train: can't run ahead of the calendar, and
     can't skip into the next week until every day of this one is banked */
  /* The last week of a block can be a deload: same movements, two thirds of
     the sets, and the bar loaded back to about 60% of what you last hit. The
     point is to keep the pattern and drop the fatigue. */
  const isDeloadWeek = (plan, wk) => !!(plan && plan.deload) && wk >= (plan.weeks || 4);
  const DELOAD_LOAD = 0.6, DELOAD_SETS = 2 / 3;

  function weekOf(plan) {
    if (!plan.startDate) return null;
    return Math.min(planWeek(plan) || 1, progressWeek(plan), plan.weeks || 4);
  }
  const planFinished = p => !!p.finishedAt;

  function activePlan() {
    const open = plans.filter(p => !planFinished(p) && !p.queued);
    if (open.length) return open.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    return plans.filter(p => !p.queued).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
  }
  const queuedPlans = () => plans.filter(p => p.queued).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  /* when nothing is running any more, the next queued block takes over */
  async function promoteQueued() {
    const running = plans.some(p => !planFinished(p) && !p.queued);
    if (running) return false;
    const next = queuedPlans()[0];
    if (!next) return false;
    next.queued = false;
    next.createdAt = Date.now();
    await DB.put('plans', next);
    plans = await DB.all('plans');
    return true;
  }
  const blockNumber = plan => plans.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).findIndex(p => p.id === plan.id) + 1;

  /* ---------------- live workout ----------------
     The in-flight session survives restarts through this key, so a corrupt
     value here would brick the app for exactly the user mid-session. get()
     therefore checks the shape the renderers iterate, not just that the
     JSON parses — anything else is dropped so the next boot starts clean. */
  const live = {
    get() {
      const raw = localStorage.getItem('liveWorkout');
      if (raw == null) return null;
      let v = null;
      try { v = JSON.parse(raw); } catch {}
      const ok = v && typeof v === 'object' && !Array.isArray(v)
        && Array.isArray(v.exs) && v.exs.every(x => x && typeof x === 'object' && Array.isArray(x.sets));
      if (!ok) { try { localStorage.removeItem('liveWorkout'); } catch {} return null; }
      return v;
    },
    set(v) {
      try { v ? localStorage.setItem('liveWorkout', JSON.stringify(v)) : localStorage.removeItem('liveWorkout'); }
      catch (e) { console.error('liveWorkout save failed', e); }
    }
  };

  /* ---------------- media store ----------------
     Every photo/video blob goes through this seam — nothing else touches the
     'media' store directly. Today the backend is IndexedDB. When the app is
     wrapped in Capacitor, blobs in IndexedDB inside WKWebView are the one
     piece of this storage known to be fragile on iOS, so the wrap-day job is
     contained here: reimplement these four functions over the native
     filesystem (write the file, keep {id, exerciseId, type, path} in the
     DB), plus a one-time migration that walks DB.all('media') and moves
     each blob out. Callers only ever see an id, a {type} record, and a
     displayable URL. */
  const mediaStore = {
    /* the stored record — callers may read .type; .blob is backend detail */
    meta: id => DB.get('media', id),
    async save(exerciseId, file) {
      const id = DB.uid();
      await DB.put('media', { id, exerciseId, type: file.type, blob: file });
      return id;
    },
    async remove(id) {
      const url = mediaURLs.get(id);
      if (url) { URL.revokeObjectURL(url); mediaURLs.delete(id); }
      await DB.del('media', id);
    }
  };
  async function mediaURL(id) {
    if (mediaURLs.has(id)) return mediaURLs.get(id);
    const rec = await mediaStore.meta(id);
    if (!rec) return null;
    /* two record shapes: {blob} is the web build; {path} is a file on the
       native filesystem after the wrap-day migration — the read side is
       ready for both, so moving the store is a write-side change only */
    let url = null;
    if (rec.blob) url = URL.createObjectURL(rec.blob);
    else if (rec.path && window.Capacitor && window.Capacitor.convertFileSrc)
      url = window.Capacitor.convertFileSrc(rec.path);
    if (!url) return null;
    mediaURLs.set(id, url);
    return url;
  }
  function demoEl(slug, extra, still) {
    const wrap = el('div', 'demo-anim' + (still ? ' still' : '') + (extra ? ' ' + extra : ''));
    for (const i of (still ? [0] : [0, 1])) {
      const img = document.createElement('img');
      img.src = `demos/${slug}/${i}.jpg`;
      img.loading = 'lazy';
      img.alt = '';
      wrap.appendChild(img);
    }
    return wrap;
  }
  /* thumbnails are still pictures — the movement only plays on the
     opened exercise page (animFor) */
  function thumbFor(ex, extra) {
    if (ex && ex.demo) return demoEl(ex.demo, extra, true);
    const ph = el('div', 'demo-anim ph' + (extra ? ' ' + extra : ''));
    return ph;
  }
  /* The warm-up is the app's own card and has no photograph of a movement to
     show, so it gets a drawn one: a sun coming up over the horizon, filling
     the tile the way a picture would. Rays are struck in clay, the disc is
     lit from the top, and the ground line grounds it — small enough to read
     at 52 pixels, and the only mark of its kind in the app. */
  function warmMark(extra) {
    const d = el('div', 'demo-anim warm-mark' + (extra ? ' ' + extra : ''));
    d.innerHTML = '<svg viewBox="0 0 52 52" width="100%" height="100%" aria-hidden="true">'
      + '<defs>'
      + '<radialGradient id="wmSky" cx="50%" cy="74%" r="72%">'
      + '<stop offset="0" stop-color="#3A2115"/><stop offset="1" stop-color="#140E0B"/>'
      + '</radialGradient>'
      + '<linearGradient id="wmSun" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="' + mixHex(ACC, '#FFFFFF', .3) + '"/><stop offset="1" stop-color="' + ACC + '"/>'
      + '</linearGradient>'
      + '</defs>'
      + '<rect width="52" height="52" fill="url(#wmSky)"/>'
      + '<g stroke="' + ACC + '" stroke-width="1.8" stroke-linecap="round" opacity=".85">'
      + '<path d="M26 8v4.4"/><path d="M13.6 13.6l3.1 3.1"/><path d="M38.4 13.6l-3.1 3.1"/>'
      + '<path d="M7.5 26h4.4"/><path d="M40.1 26h4.4"/>'
      + '</g>'
      + '<path d="M15 34a11 11 0 0 1 22 0z" fill="url(#wmSun)"/>'
      + '<path d="M6 34h40" stroke="#8A5233" stroke-width="2" stroke-linecap="round"/>'
      + '<path d="M11 40h12M27 40h14" stroke="#5C3A27" stroke-width="1.7" stroke-linecap="round"/>'
      + '</svg>';
    return d;
  }

  function animFor(ex, extra) {
    if (ex && ex.demo) return demoEl(ex.demo, extra, false);
    const ph = el('div', 'demo-anim ph' + (extra ? ' ' + extra : ''));
    return ph;
  }

  /* ---------------- themed confirm dialog ---------------- */
  function appConfirm({ title, body, ok = 'OK', cancel = 'Cancel', warn = false }) {
    return new Promise(res => {
      const back = el('div', 'modal-back');
      const m = el('div', 'modal' + (warn ? ' warn' : ''));
      m.appendChild(el('div', 'modal-title', title));
      if (body) m.appendChild(el('div', 'modal-body', body));
      const acts = el('div', 'modal-acts');
      const no = el('button', 'btn-ghost', cancel);
      no.onclick = () => { back.remove(); res(false); };
      const yes = el('button', 'btn-lime', ok);
      yes.onclick = () => { back.remove(); res(true); };
      acts.append(no, yes);
      m.appendChild(acts);
      back.appendChild(m);
      back.onclick = e => { if (e.target === back) { back.remove(); res(false); } };
      document.body.appendChild(back);
    });
  }

  /* Leaving an editor with unsaved work: save it, throw it away, or stay.
     One question, asked the same way by Settings, About you and the block
     editor — so none of them need a Cancel/Save row at the bottom. */
  async function askOnClose({ what, save, leave }) {
    const pick = await appChoose({
      title: 'Save your changes?',
      body: `Your ${what} has changed and is not saved yet.`,
      options: [
        { label: 'Save', value: 'save', primary: true },
        { label: 'Discard', value: 'discard' },
        { label: 'Keep editing', value: null }
      ]
    });
    if (!pick) return;
    if (pick === 'save') { await save(); return; }
    leave();
  }

  /* same dialog, but with more than two ways out */
  function appChoose({ title, body, options }) {
    return new Promise(res => {
      const back = el('div', 'modal-back');
      const m = el('div', 'modal');
      m.appendChild(el('div', 'modal-title', title));
      if (body) m.appendChild(el('div', 'modal-body', body));
      const acts = el('div', 'modal-acts stack');
      options.forEach(o => {
        const b = el('button', o.primary ? 'btn-lime' : 'btn-ghost', o.label);
        b.onclick = () => { back.remove(); res(o.value); };
        acts.appendChild(b);
      });
      m.appendChild(acts);
      back.appendChild(m);
      back.onclick = e => { if (e.target === back) { back.remove(); res(null); } };
      document.body.appendChild(back);
    });
  }

  /* ---------------- sheets ----------------
     One sheet can open another — the block editor opens the exercise picker,
     the picker opens the write-your-own form. Closing the inner one has to
     put you back in the outer one, not tip you out of both. */
  function openSheet(id) { closeSheets(); $('#sheet-backdrop').hidden = false; $(id).hidden = false; }
  function closeSheets() { $('#sheet-backdrop').hidden = true; $$('.sheet').forEach(s => s.hidden = true); }
  let sheetBack = null;
  function dismissSheet() {
    const back = sheetBack;
    sheetBack = null;
    addTarget = null;
    pickerAfterSave = null;
    closeSheets();
    if (back) back(); else renderTab();
  }
  $('#sheet-backdrop').onclick = dismissSheet;
  $$('[data-close]').forEach(b => b.onclick = dismissSheet);
  $('#media-viewer-close').onclick = () => { $('#media-viewer-body').innerHTML = ''; $('#media-viewer').hidden = true; };

  /* ---------------- navigation ---------------- */
  const VIEWS = ['today', 'plan', 'cardio', 'stats', 'library', 'profile', 'workout', 'summary', 'detail', 'planmaker', 'about', 'prefs'];
  function show(view) {
    VIEWS.forEach(v => $('#view-' + v).hidden = v !== view);
    const isTab = ['today', 'plan', 'cardio', 'stats', 'library', 'profile'].includes(view);
    $('#tabbar').hidden = !isTab;
    if (isTab) {
      currentTab = view;
      $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    }
    window.scrollTo(0, 0);
    updatePill();
  }
  $$('.tabbar button').forEach(b => b.onclick = () => { show(b.dataset.view); renderTab(); });

  async function renderTab() {
    exercises = (await DB.all('exercises')).sort((a, b) => a.name.localeCompare(b.name));
    plans = await DB.all('plans');
    /* one-time: blocks written before the timed split carry rep targets on
       movements the app now measures in seconds — 2×10 Wall Sit becomes an
       honest 30–45 s, once, and only where the numbers are clearly reps */
    if (!localStorage.getItem('timedMig1')) {
      for (const pl of plans) {
        let dirty = false;
        for (const d of (pl.days || [])) {
          for (const it of (d.items || [])) {
            const ex2 = exercises.find(e => e.id === it.exerciseId);
            if (ex2 && isTimedEx(ex2) && (it.repHi || 0) <= 20) {
              it.repLo = 30; it.repHi = 45; dirty = true;
            }
          }
        }
        if (dirty) await DB.put('plans', pl);
      }
      localStorage.setItem('timedMig1', '1');
    }
    await promoteQueued();
    if (currentTab === 'today') await renderToday();
    else if (currentTab === 'plan') await renderPlanTab();
    else if (currentTab === 'cardio') await renderCardio();
    else if (currentTab === 'stats') await renderStats();
    else if (currentTab === 'library') renderLibrary();
    else if (currentTab === 'profile') await renderProfile();
  }

