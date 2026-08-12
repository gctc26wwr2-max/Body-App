/* RACKSIDE — strength training app. All data on-device (IndexedDB). */
(() => {
  'use strict';
  const APP_VERSION = 'v214';

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
  const wRound = kg => {
    const step = wBump();
    return kg > 0 ? Math.max(step, Math.round(kg / step) * step) : 0;
  };      // one small jump, in kg
  const hUnit = () => (getProfile().hUnits === 'ft' ? 'ft' : 'cm');
  const fmtH = cm => {
    if (!(cm > 0)) return '—';
    if (hUnit() !== 'ft') return Math.round(cm) + ' cm';
    const inch = Math.round(cm / 2.54);
    return `${Math.floor(inch / 12)}'${inch % 12}"`;
  };

  /* ---------------- pure logic (design spec) ---------------- */
  const est1RM = (kg, reps) => reps > 0 ? kg * (1 + reps / 30) : 0;   // Epley

  function suggestion(sets) {
    const logged = sets.filter(s => s.done);
    if (!logged.length) return { kind: 'idle' };
    const last = logged[logged.length - 1];
    const step = wBump();     // 2.5 kg, or the 5 lb equivalent
    if (last.reps >= last.targetHi) return { kind: 'increase', step, nextKg: +(last.kg + step).toFixed(3), last };
    return { kind: 'hold', kg: last.kg, last };
  }
  function applySuggestion(sets, nextKg) {
    sets.forEach(s => { if (!s.done) s.kg = nextKg; });
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
    for (const p of plates) {
      while (side >= p - 1e-9) { out.push(p); side -= p; }
    }
    return out;
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

  /* ---------------- live workout ---------------- */
  const live = {
    get() { try { return JSON.parse(localStorage.getItem('liveWorkout')); } catch { return null; } },
    set(v) { v ? localStorage.setItem('liveWorkout', JSON.stringify(v)) : localStorage.removeItem('liveWorkout'); }
  };

  /* ---------------- media ---------------- */
  async function mediaURL(id) {
    if (mediaURLs.has(id)) return mediaURLs.get(id);
    const rec = await DB.get('media', id);
    if (!rec) return null;
    const url = URL.createObjectURL(rec.blob);
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
    await promoteQueued();
    if (currentTab === 'today') await renderToday();
    else if (currentTab === 'plan') await renderPlanTab();
    else if (currentTab === 'cardio') await renderCardio();
    else if (currentTab === 'stats') await renderStats();
    else if (currentTab === 'library') renderLibrary();
    else if (currentTab === 'profile') await renderProfile();
  }

  /* ============================================================
     TODAY
     ============================================================ */
  async function renderToday() {
    const root = $('#view-today');
    root.innerHTML = '';
    const plan = activePlan();
    const workouts = (await DB.all('workouts')).sort((a, b) => b.ts - a.ts);
    const cardio = await DB.all('cardio');

    // meta row: date left, streak right
    const head = el('header', 'meta-row');
    const now = new Date();
    head.appendChild(el('div', 'date', now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })));
    const stk = el('div', 'streak');
    const streakN = weekStreak(workouts);
    stk.appendChild(el('span', 'l', 'Streak'));
    stk.appendChild(el('span', 'v num', streakN + 'w'));
    head.appendChild(stk);
    root.appendChild(head);
    if (!plan) root.appendChild(el('h1', 't-title', 'Rackside'));

    // running in the browser tab (not installed) — layout loses the bottom strip to Safari
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (!standalone) {
      const hint = el('div', 'coach-note');
      hint.innerHTML = '<b>Install ·</b> You are in the browser, so Safari keeps a strip at the bottom. Tap <b>Share</b> → <b>Add to Home Screen</b> and open Rackside from the icon for true fullscreen.';
      root.appendChild(hint);
    }

    if (!plan) {
      // ready-made starter program
      if (window.STARTER_BLOCK) {
        const sb = window.STARTER_BLOCK;
        const rc = el('div', 'card hero');
        rc.appendChild(heroTop('Ready-made plan', `${sb.days.length}× / week · ${sb.weeks} weeks`));
        rc.appendChild(el('div', 'hero-title', sb.name));
        rc.appendChild(el('div', 'hero-sub',
          'Machine-based, low spinal load — chest, back, shoulders, legs and core across 3 days. Made for you by Claude; installs with every exercise and target set up.'));
        const cta = el('button', 'btn-cta', 'Install this block');
        cta.onclick = () => installStarter();
        rc.appendChild(cta);
        root.appendChild(rc);
      }
      const empty = el('div', 'empty-state');
      empty.appendChild(el('p', null, 'Or build your own from scratch:'));
      const cta = el('button', 'btn-ghost', 'Create a custom block');
      cta.onclick = () => openPlanForm(null);
      empty.appendChild(cta);
      root.appendChild(empty);
      return;
    }

    const weeks = plan.weeks || 4;
    const started = !!plan.startDate;
    const curWeek = started ? weekOf(plan) : 0;
    const finished = planFinished(plan);
    const behind = started && !finished && (planWeek(plan) || 1) > progressWeek(plan);

    // today's state drives the arc layout — it renders in EVERY state
    const lwNow = live.get();
    const trainedToday = workouts.some(x => x.date === todayStr());
    const dtwSet = new Set((plan.completed || []).filter(c => c.week === (curWeek || 1)).map(c => c.day));
    const nextIdxArc = (plan.days && plan.days.length) ? plan.days.findIndex((_, i) => !dtwSet.has(i)) : -1;
    let mode = 'next';
    if (lwNow) mode = 'live';
    else if (plan.pausedAt) mode = 'paused';
    else if (finished) mode = 'complete';
    else if (trainedToday) mode = 'banked';
    else if (nextIdxArc < 0) mode = 'weekdone';

    if (behind && !plan.pausedAt) {
    // ---- block card ----
    const bc = el('div', 'card');
    const bh = el('div', 'block-head');
    bh.appendChild(el('div', 'micro', `${weeks}-week block`));
    bh.appendChild(finished
      ? el('div', 'block-note final', 'BLOCK COMPLETE')
      : (behind
        ? el('div', 'block-note', `Finish week ${curWeek} to unlock week ${Math.min(curWeek + 1, weeks)}`)
        : (started && curWeek === weeks
          ? el('div', 'block-note final', 'FINAL WEEK')
          : el('div', 'block-note', started ? `${weeks - curWeek} week${weeks - curWeek === 1 ? '' : 's'} left in Block ${blockNumber(plan)}` : 'Not started'))));
    bc.appendChild(bh);
    const seg = el('div', 'week-seg');
    for (let i = 1; i <= weeks; i++) {
      const dl = isDeloadWeek(plan, i);
      const b = el('button',
        (i < curWeek ? 'past' : (i === curWeek ? 'current' : '')) + (dl ? ' deload' : ''),
        dl ? 'DL' : 'W' + i);
      if (dl) b.title = 'Deload week — lighter, fewer sets';
      b.type = 'button';
      b.onclick = async () => {
        const d = new Date(Date.now() - (i - 1) * 7 * 86400000);
        plan.startDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        plan.finishedAt = null;
        await DB.put('plans', plan);
        renderTab();
      };
      seg.appendChild(b);
    }
    bc.appendChild(seg);
    root.appendChild(bc);
    }

    // ---- renewal card (final week or finished) ----
    if (finished || (started && curWeek === weeks)) {
      const rc = el('div', 'card amber');
      const tag = el('div', 'renew-tag');
      tag.appendChild(el('i', 'dot'));
      tag.appendChild(el('span', null, `Block ${blockNumber(plan)} ${finished ? 'is complete' : 'ends this week'}`));
      rc.appendChild(tag);
      rc.appendChild(el('div', 'renew-title', 'Time to renew your plan'));
      const vol = workouts.filter(x => x.planId === plan.id).reduce((a, x) => a + (x.volume || 0), 0);
      rc.appendChild(el('div', 'renew-body',
        `You moved ${fmtW(vol)} across ${workouts.filter(x => x.planId === plan.id).length} sessions this block. ` +
        `Build Block ${blockNumber(plan) + 1} with fresh targets, or repeat this one and beat your numbers.`));
      const acts = el('div', 'renew-actions');
      const bNew = el('button', 'btn-lime', `Build Block ${blockNumber(plan) + 1}`);
      bNew.type = 'button';
      bNew.onclick = () => openPlanForm(null, plan);
      const bRep = el('button', 'btn-ghost', 'Repeat');
      bRep.type = 'button';
      bRep.onclick = async () => {
        const copy = {
          id: DB.uid(), createdAt: Date.now(), name: plan.name.replace(/\d+$/, s => Number(s) + 1),
          weeks: plan.weeks, days: JSON.parse(JSON.stringify(plan.days)),
          startDate: null, completed: [], finishedAt: null
        };
        if (!plan.finishedAt) { plan.finishedAt = Date.now(); await DB.put('plans', plan); }
        await DB.put('plans', copy);
        renderTab();
      };
      acts.append(bNew, bRep);
      rc.appendChild(acts);
      root.appendChild(rc);
    }

    // ---- 7-day strip (rings = preferred training days) ----
    const strip = el('div', 'day-strip');
    const dow = (now.getDay() + 6) % 7; // Mon=0
    const monday = new Date(now); monday.setDate(now.getDate() - dow);
    const doneDates = new Set(workouts.map(x => x.date));
    const pref = plan.prefDays || [];
    'MTWTFSS'.split('').forEach((ch, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const cell = el('div', 'cell'
        + (ds === todayStr() ? ' today' : '')
        + (doneDates.has(ds) ? ' done' : '')
        + (pref.includes(i) ? ' pref' : '')
        + (pref.includes(i) && i < dow && !doneDates.has(ds) && !plan.pausedAt ? ' missed' : ''));
      cell.appendChild(el('span', null, ch));
      cell.appendChild(el('i'));
      strip.appendChild(cell);
    });
    root.appendChild(strip);

    // ---- the v5 arc layout, in every state ----
    {
      const dayIdx = mode === 'live' ? lwNow.dayIndex : (nextIdxArc >= 0 ? nextIdxArc : 0);
      const day = (plan.days && plan.days[dayIdx]) || { name: plan.name, items: [] };
      const totalSess = weeks * Math.max(1, (plan.days || []).length);
      const doneSess = Math.min((plan.completed || []).length, totalSess);
      const wrap = el('div', 'arc-wrap');
      wrap.innerHTML = blockArcSVG(totalSess, doneSess, weeks);
      const overlay = el('div', 'arc-title');

      const prefD = plan.prefDays || [];
      const todayIdx = (now.getDay() + 6) % 7;
      const doneThisWk = workouts.filter(x => sameWeek(x.date)).length;
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      let nextPref = '';
      for (let k = 1; k <= 6; k++) {
        const di = (todayIdx + k) % 7;
        if (prefD.includes(di)) { nextPref = dayNames[di]; break; }
      }

      let title = day.name, meta = '', sess = `Session ${Math.min(doneSess + 1, totalSess)} of ${totalSess}`;
      if (mode === 'next') {
        const lastDoneC = (plan.completed || []).filter(c => c.day === dayIdx && c.duration).pop();
        const totalSets = day.items.reduce((a, it) => a + (it.sets || 3), 0);
        const due = prefD.length && doneThisWk < prefD.filter(x => x <= todayIdx).length;
        meta = `${day.items.length} exercises · ~${lastDoneC ? lastDoneC.duration : Math.round(totalSets * 2.5)} min${due ? ' · due today' : ''}`;
      } else if (mode === 'live') {
        meta = (lwNow.pausedAt ? 'Paused · ' : 'In progress · ')
          + `${fmtClock(wElapsed(lwNow))} elapsed`;
      } else if (mode === 'banked') {
        sess = `Session ${doneSess} of ${totalSess} · done`;
        title = 'Banked.';
        meta = nextIdxArc >= 0
          ? `Recovery is part of the program. Next: ${plan.days[nextIdxArc].name}${nextPref ? ' · ' + nextPref : ''}`
          : 'Every day of this week is done — rest up.';
      } else if (mode === 'weekdone') {
        sess = `Week ${curWeek || 1} of ${weeks} · done`;
        title = 'Rest';
        meta = `All of week ${curWeek || 1} is banked. Week ${Math.min((curWeek || 1) + 1, weeks)} unlocks as the calendar rolls over.`;
      } else if (mode === 'complete') {
        sess = `Block ${blockNumber(plan)} · complete`;
        title = 'Done';
        meta = 'Every session is banked. Renew the block to keep progressing.';
      } else if (mode === 'paused') {
        sess = 'On a break since ' + new Date(plan.pausedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        title = 'Paused';
        meta = 'The block is frozen — missed days and weeks don\'t count until you resume.';
      }
      overlay.appendChild(el('div', 'arc-sess', sess));
      const dn = el('div', 'arc-day' + (mode === 'next' || mode === 'live' ? '' : ' status'), title);
      if (title.length > 8) dn.style.fontSize = '34px';
      overlay.appendChild(dn);
      overlay.appendChild(el('div', 'arc-meta', meta));
      wrap.appendChild(overlay);
      root.appendChild(wrap);

      // numbered exercise index — today's session, or a preview of the next one
      let idxDay = null, idxLabel = '';
      if ((mode === 'next' || mode === 'live') && day.items.length) {
        idxDay = day;
      } else if ((mode === 'banked' || mode === 'weekdone' || mode === 'paused') && plan.days && plan.days.length) {
        idxDay = nextIdxArc >= 0 ? plan.days[nextIdxArc] : plan.days[0];
        idxLabel = mode === 'paused'
          ? `When you're back · ${idxDay.name}`
          : `Up next · ${idxDay.name}${nextPref ? ' · ' + nextPref : ''}`;
      }
      if (idxDay && idxDay.items.length) {
        if (idxLabel) root.appendChild(el('div', 'micro', idxLabel));
        const idx = el('div', 'ex-index');
        idxDay.items.forEach((it, i) => {
          const ex = exercises.find(e => e.id === it.exerciseId);
          const r = el('div', 'exi-row');
          r.appendChild(el('div', 'exi-num', String(i + 1).padStart(2, '0')));
          const nmc = el('div', 'exi-name', ex ? ex.name : '(deleted)');
          if (ex) {
            const hb = el('div', 'exi-hard');
            if (addHardship(hb, ex)) nmc.appendChild(hb);
          }
          r.appendChild(nmc);
          r.appendChild(el('div', 'exi-scheme', `${it.sets || 3} × ${it.repLo || 8}–${it.repHi || 12}${it.kg ? ' · ' + fmtW(it.kg) : ''}`));
          if (ex) r.onclick = () => openDetail(ex.id, 'library');
          idx.appendChild(r);
        });
        root.appendChild(idx);
      }

      // stats baseline row
      const base = el('div', 'base-row');
      const bs = (v, l, cls) => {
        const d = el('div', 'base-stat' + (cls ? ' ' + cls : ''));
        d.appendChild(el('div', 'v num', v));
        d.appendChild(el('div', 'l', l));
        return d;
      };
      base.appendChild(bs(String(doneThisWk), 'This week'));
      const lastW0 = workouts[0];
      base.appendChild(bs(lastW0 ? String(lastW0.duration) : '—', 'Last min'));
      const wkVol0 = workouts.filter(x => sameWeek(x.date)).reduce((a, x) => a + (x.volume || 0), 0);
      base.appendChild(bs(fmtWn(wkVol0), wUnit() + ' this week', 'earn'));
      root.appendChild(base);

      // calories burned — today's cardio, or the week's
      const cdToday = cardio.filter(c => c.date === todayStr());
      const cdWeek = cardio.filter(c => sameWeek(c.date));
      if (cdWeek.length) {
        const useToday = cdToday.length > 0;
        const src = useToday ? cdToday : cdWeek;
        const line = el('div', 'burn-line');
        line.appendChild(el('span', 'l', useToday ? 'Burned today' : 'Burned this week'));
        const v = el('span', 'v num', src.reduce((a, c) => a + c.calories, 0) + ' kcal');
        line.appendChild(v);
        line.appendChild(el('span', 'm num',
          `${src.reduce((a, c) => a + c.minutes, 0)} min · ${src.length} session${src.length === 1 ? '' : 's'}`));
        line.onclick = () => { show('cardio'); renderTab(); };
        root.appendChild(line);
      }

      // primary CTA per state + text links
      if (mode === 'next') {
        const cta = el('button', 'btn-cta big');
        cta.appendChild(svgIcon(PLAY, 13));
        cta.appendChild(document.createTextNode(' Start ' + day.name));
        cta.onclick = () => startWorkout(plan, dayIdx);
        root.appendChild(cta);
      } else if (mode === 'live') {
        const cta = el('button', 'btn-cta big');
        cta.appendChild(svgIcon(PLAY, 13));
        cta.appendChild(document.createTextNode(
          (lwNow.pausedAt ? ' Start ' : ' Resume ') + day.name + (lwNow.pausedAt ? ' again' : '')));
        cta.onclick = () => {
          if (lwNow.pausedAt) { resumeWorkout(); return; }
          show('workout'); renderWorkout();
        };
        root.appendChild(cta);
      } else if (mode === 'complete') {
        const cta = el('button', 'btn-cta big', 'Build Block ' + (blockNumber(plan) + 1));
        cta.onclick = () => openPlanForm(null, plan);
        root.appendChild(cta);
      } else if (mode === 'paused') {
        const cta = el('button', 'btn-cta big', 'Resume training');
        cta.onclick = async () => { await resumePlan(plan); renderTab(); };
        root.appendChild(cta);
      }
    }

    // ---- monthly backup reminder ----
    const lb = Number(localStorage.getItem('lastBackup')) || 0;
    if (workouts.length && (!lb || Date.now() - lb > 30 * 86400000)) {
      const note = el('div', 'coach-note');
      const days = lb ? Math.floor((Date.now() - lb) / 86400000) : null;
      note.innerHTML = `<b>Backup ·</b> ${days ? days + ' days since your last backup.' : 'Your training data has never been backed up.'} `;
      const b = el('button', 'rest-edit', 'Back up now');
      b.onclick = backupData;
      note.appendChild(b);
      root.appendChild(note);
    }
  }

  /* Block arc — N session dots on a semicircle, today at the crest (v5 handoff) */
  function blockArcSVG(total, doneCount, weeks) {
    const R = 150, CX = 170, CY = 190;
    const pt = i => {
      const a = Math.PI - i * (Math.PI / Math.max(1, total - 1));
      return [CX + R * Math.cos(a), CY - R * Math.sin(a)];
    };
    const ramp = ['#8E5330', '#A05E36', '#B0663A', '#BF6E3E', '#CE6B3D'];
    let dots = '';
    for (let i = 0; i < total; i++) {
      const [x, y] = pt(i);
      const X = x.toFixed(1), Y = y.toFixed(1);
      if (i < doneCount) {
        const c = ramp[Math.min(ramp.length - 1, Math.floor(i / Math.max(1, total - 1) * ramp.length))];
        dots += `<circle cx="${X}" cy="${Y}" r="4" fill="${c}"/>`;
      } else if (i === doneCount) {
        dots += `<circle cx="${X}" cy="${Y}" r="13" fill="#0B0908" stroke="#CE6B3D" stroke-width="2"/>`
              + `<circle cx="${X}" cy="${Y}" r="6" fill="#CE6B3D"/>`;
      } else {
        const op = Math.max(.10, .20 - (i - doneCount) * .015);
        dots += `<circle cx="${X}" cy="${Y}" r="3.5" fill="rgba(255,255,255,${op.toFixed(3)})"/>`;
      }
    }
    const [px, py] = pt(Math.min(doneCount, total - 1));
    const prog = doneCount > 0
      ? `<path d="M20 190 A150 150 0 0 1 ${px.toFixed(1)} ${py.toFixed(1)}" fill="none" stroke="#CE6B3D" stroke-width="2" stroke-linecap="round"/>`
      : '';
    return `<svg viewBox="0 0 340 208" style="width:100%;height:auto;display:block" role="img" aria-label="Block progress">
      <path d="M20 190 A150 150 0 0 1 320 190" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1.5" stroke-dasharray="3 6"/>
      ${prog}${dots}
      <text x="20" y="205" text-anchor="middle" fill="#4A443E" font-size="9" font-weight="800" font-family="Archivo, sans-serif">W1</text>
      <text x="320" y="205" text-anchor="middle" fill="#4A443E" font-size="9" font-weight="800" font-family="Archivo, sans-serif">W${weeks}</text>
    </svg>`;
  }

  /* Resume a paused block — shift its start date by the length of the
     break so the calendar continues exactly where it left off. */
  async function resumePlan(plan) {
    const days = Math.max(0, Math.round((Date.now() - plan.pausedAt) / 86400000));
    if (plan.startDate && days > 0) {
      const d = dateOf(plan.startDate);
      d.setDate(d.getDate() + days);
      plan.startDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    plan.pausedAt = null;
    await DB.put('plans', plan);
  }

  /* consecutive weeks (incl. this one) with at least one session */
  function weekStreak(workouts) {
    const has = ws => workouts.some(x => {
      const d = dateOf(x.date);
      return d >= ws && d < new Date(ws.getTime() + 7 * 86400000);
    });
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    let ws = new Date(now); ws.setDate(now.getDate() - dow); ws.setHours(0, 0, 0, 0);
    let n = has(ws) ? 1 : 0;
    for (;;) {
      ws = new Date(ws.getTime() - 7 * 86400000);
      if (has(ws)) n++; else break;
    }
    return n;
  }

  function heroTop(tag, meta) {
    const t = el('div', 'hero-top');
    t.appendChild(el('div', 'hero-tag', tag));
    t.appendChild(el('div', 'hero-meta', meta));
    return t;
  }
  function heroStat(v, unit, label) {
    const d = el('div', 'hstat');
    const val = el('div', 'v num', v + ' ');
    val.appendChild(el('small', null, unit));
    d.appendChild(val);
    d.appendChild(el('div', 'l', label));
    return d;
  }
  function pairCard(v, l) {
    const c = el('div', 'card');
    c.appendChild(el('div', 'v num', v));
    c.appendChild(el('div', 'l', l));
    return c;
  }
  function sameWeek(ds) {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now); monday.setDate(now.getDate() - dow); monday.setHours(0, 0, 0, 0);
    const d = dateOf(ds);
    return d >= monday && d < new Date(monday.getTime() + 7 * 86400000);
  }

  /* ============================================================
     ACTIVE WORKOUT
     ============================================================ */
  let elapsedInt = null;

  /* How long you rest between sets is a decision you make once, in Settings —
     not something to re-pick six times a session. Mid-workout you can only
     nudge it up or down, which is all anyone actually wants to do with a
     running clock. */
  const REST_LENS = [45, 60, 75, 90, 120, 150, 180, 240, 300];
  const restDefault = () => {
    const v = +getProfile().restSec;
    return v >= 15 && v <= 900 ? v : 120;
  };

  /* ---------------- pausing a session ----------------
     Pause used to mean "put the screen away and keep counting", which is not
     what the word means. It stops the clock: the session timer freezes, the
     rest countdown holds where it is, and nothing can be logged until you
     start again. Time spent paused is taken off the duration that gets saved. */
  const wElapsed = lw => Math.max(0,
    Math.floor((((lw.pausedAt || Date.now()) - lw.startedAt) - (lw.pausedMs || 0)) / 1000));

  function pauseWorkout() {
    const lw = live.get();
    if (!lw || lw.pausedAt) return;
    lw.pausedAt = Date.now();
    // hold the rest countdown where it stands rather than letting it run out
    if (lw.restEndsAt) {
      lw.restLeft = Math.max(1, Math.ceil((lw.restEndsAt - Date.now()) / 1000));
      lw.restEndsAt = null;
    }
    cancelHold();          // a hold cannot be paused halfway — it starts again
    clearInterval(restInt); restInt = null;
    clearInterval(elapsedInt); elapsedInt = null;
    live.set(lw);
    haptic();
    updatePill();
    renderWorkout();
  }

  /* The paused screen is a popup, not a panel on the page — a session that
     is not running should not look like one you can carry on tapping. */
  let pauseInt = null;
  function paintPausePop() {
    const pop = $('#pause-pop');
    if (!pop) return;
    const lw = live.get();
    if (!lw || !lw.pausedAt || $('#view-workout').hidden) { closePausePop(); return; }
    /* the number on this screen is the one that is actually moving: how long
       the break has been. The session clock is the one that has stopped, so
       it is stated once and left alone. */
    const tick = () => {
      const now = live.get();
      if (!now || !now.pausedAt) { closePausePop(); return; }
      $('#pause-pop-time').textContent = fmtClock(Math.floor((Date.now() - now.pausedAt) / 1000));
    };
    $('#pause-pop-held').textContent = `Session held at ${fmtClock(wElapsed(lw))}`;
    $('#pause-pop-body').textContent = lw.restLeft
      ? `Your rest is holding at ${fmtClock(lw.restLeft)}. Nothing logs until you start again.`
      : 'Nothing logs until you start again.';
    $('#pause-pop-go').onclick = () => resumeWorkout();
    /* one button, like the hold timer. Tapping off the card puts the popup
       away without starting anything — the session stays paused and the
       header is right there if you want to leave or finish. */
    pop.onclick = e => { if (e.target === pop) closePausePop(); };
    pop.hidden = false;
    tick();
    clearInterval(pauseInt);
    pauseInt = setInterval(tick, 1000);
  }
  function closePausePop() {
    clearInterval(pauseInt); pauseInt = null;
    const p2 = $('#pause-pop'); if (p2) p2.hidden = true;
  }

  function resumeWorkout() {
    const lw = live.get();
    if (!lw || !lw.pausedAt) return;
    lw.pausedMs = (lw.pausedMs || 0) + (Date.now() - lw.pausedAt);
    lw.pausedAt = null;
    if (lw.restLeft) {
      lw.restEndsAt = Date.now() + lw.restLeft * 1000;
      delete lw.restLeft;
    }
    live.set(lw);
    haptic();
    closePausePop();
    if (lw.restEndsAt) armRestTick();
    show('workout');
    renderWorkout();
  }

  async function startWorkout(plan, dayIndex) {
    if (plan.pausedAt) await resumePlan(plan);   // training again ends the break
    const day = plan.days[dayIndex];
    const wk = plan.startDate ? weekOf(plan) : 1;
    if ((plan.completed || []).some(c => c.week === wk && c.day === dayIndex)) {
      alert(`${day.name} is already done this week. To redo it, delete its session in Plan → history first.`);
      return;
    }
    if (!plan.startDate) { plan.startDate = todayStr(); await DB.put('plans', plan); }
    const sessions = await DB.all('sessions');
    const exList = [];
    const deload = isDeloadWeek(plan, wk);
    for (const item of day.items) {
      const ex = exercises.find(e => e.id === item.exerciseId);
      if (!ex) continue;
      const lo = item.repLo || item.reps || 8;
      const hi = item.repHi || item.reps || 12;
      // remember what you did last time: prefill each set with the weight
      // and reps from the most recent session of this exercise
      const hist = sessions.filter(s => s.exerciseId === ex.id).sort((a, b) => b.ts - a.ts);
      const lastSets = hist.length ? hist[0].sets : null;
      const lastMax = lastSets ? Math.max(...lastSets.map(s => s.weight || 0)) : 0;
      exList.push({
        exerciseId: ex.id, name: ex.name,
        timed: /second/i.test(ex.notes || ''),   // hold/interval exercises log seconds
        perSide: /side/i.test(ex.notes || ''),   // run the hold once per side
        repLo: lo, repHi: hi, rest: restDefault(), deload,
        sets: Array.from({ length: deload
          ? Math.max(1, Math.round((item.sets || 3) * DELOAD_SETS))
          : (item.sets || 3) }, (_, si) => {
          const prev = lastSets ? lastSets[si] : null;
          // start every set at the heaviest weight you reached last time —
          // weight you earned mid-session carries into the whole next session
          const base = lastMax || item.kg || 0;
          const kg = deload ? wRound(base * DELOAD_LOAD) : base;
          const reps = (prev && prev.reps) || lo;
          return { kg, reps, targetLo: lo, targetHi: hi, done: false };
        })
      });
    }
    live.set({
      planId: plan.id, dayIndex, dayName: day.name,
      startedAt: Date.now(), exIndex: 0,
      restEndsAt: null, restLen: restDefault(), pickerOpen: false,
      exercises: exList
    });
    show('workout');
    renderWorkout();
  }

  async function renderWorkout() {
    const lw = live.get();
    const root = $('#view-workout');
    const keepY = window.scrollY;   // re-renders must not move the page
    root.innerHTML = '';
    if (!lw) { show('today'); renderTab(); return; }
    const sessions = await DB.all('sessions');

    // ---- fixed glass header: live dot + clock · sets banked · actions · track ----
    const paused = !!lw.pausedAt;
    const head = el('div', 'w-head' + (paused ? ' paused' : ''));
    const hl = el('div', 'w-left');
    const liveRow = el('div', 'w-live');
    liveRow.appendChild(el('i', 'live-dot' + (paused ? ' idle' : '')));
    liveRow.appendChild(document.createTextNode(
      (paused ? ' Paused · ' : ' Live · ') + lw.dayName));
    hl.appendChild(liveRow);
    const clock = el('div', 'w-clock num', '0:00');
    hl.appendChild(clock);
    head.appendChild(hl);

    /* a passed exercise is out of the count entirely — leaving its sets in the
       total makes the session look unfinished when you decided it was done */
    const banked = lw.exercises.reduce((a, e2) => a + e2.sets.filter(x => x.done).length, 0);
    const totSets = lw.exercises.reduce((a, e2) => a + (e2.passed ? 0 : e2.sets.length), 0);
    const bank = el('div', 'w-banked');
    bank.appendChild(el('div', 'v num', `${banked}/${totSets}`));
    bank.appendChild(el('div', 'l', 'Sets banked'));
    head.appendChild(bank);

    const btns = el('div', 'w-btns');
    const addEx = el('button', 'w-chip', '＋');
    addEx.title = 'Add an exercise to this session';
    addEx.onclick = () => openAddToSession();
    btns.appendChild(addEx);
    const fin = el('button', 'w-chip fin');
    fin.innerHTML = '<svg viewBox="0 0 14 14" width="15" height="15"><path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    fin.title = 'Finish workout';
    fin.onclick = () => finishWorkout();
    const pause = el('button', 'w-chip' + (paused ? ' fin' : ''));
    if (paused) {
      pause.appendChild(svgIcon(PLAY, 12));
      pause.title = 'Start the clock again';
      pause.onclick = () => resumeWorkout();
    } else {
      pause.appendChild(svgIcon(PAUSE, 11));
      pause.title = 'Pause the session';
      pause.onclick = () => pauseWorkout();
    }
    const quit = el('button', 'w-chip', '✕');
    quit.onclick = async () => {
      if (!await appConfirm({
        title: 'Discard session?', body: 'Logged sets will not be saved.',
        ok: 'Discard', cancel: 'Keep training', warn: true
      })) return;
      live.set(null);
      stopRest();
      show('today'); renderTab();
    };
    btns.append(fin, pause, quit);
    head.appendChild(btns);

    // one 4pt bar per exercise
    const prog = el('div', 'ex-progress');
    lw.exercises.forEach((e2, i) => {
      const allDone = e2.sets.length > 0 && e2.sets.every(x => x.done);
      const someDone = !allDone && e2.sets.some(x => x.done);
      const s = el('span', (e2.passed ? 'passed' : (allDone ? 'done' : (someDone ? 'part' : '')))
        + (i === lw.exIndex ? ' cur' : ''));
      s.onclick = () => { lw.exIndex = i; lw.advanceAfterRest = false; live.set(lw); scrollToEx = true; renderWorkout(); };
      prog.appendChild(s);
    });
    head.appendChild(prog);
    root.appendChild(head);
    clearInterval(elapsedInt);
    elapsedInt = null;
    const tickClock = () => clock.textContent = fmtClock(wElapsed(lw));
    tickClock();
    // a paused clock does not tick — that is the whole point of the button
    if (!paused) elapsedInt = setInterval(tickClock, 1000);

    /* paused: the popup takes the screen so there is nothing to poke at, and
       the rail behind it is out of reach either way */
    paintPausePop();

    // ---- the rail: every exercise threaded on one line ----
    const rail = el('div', 'rail' + (paused ? ' held' : ''));
    lw.exercises.forEach((cur2, ei) => {
      rail.appendChild(exerciseCard(lw, cur2, ei, sessions));
    });
    /* reorder mid-session: the rack you wanted is taken, so do the next one
       first. The exercise you were on stays the one you are on, wherever it
       lands. */
    dragReorder(rail, '.exx', (from, to) => {
      const moved = lw.exercises.splice(from, 1)[0];
      lw.exercises.splice(to, 0, moved);
      const cur0 = lw.exIndex;
      lw.exIndex = cur0 === from ? to
        : (cur0 > from && cur0 <= to) ? cur0 - 1
        : (cur0 < from && cur0 >= to) ? cur0 + 1
        : cur0;
      live.set(lw);
      renderWorkout();
    }, on => rail.classList.toggle('reordering', on));
    rail.appendChild(el('div', 'end-label', 'End of session'));
    root.appendChild(rail);

    // docked rest bar — only while resting
    if (lw.restEndsAt) root.appendChild(dockedRestBar(lw));

    if (scrollToEx) {
      // only on a deliberate tap (progress bar or exercise header) —
      // never on logging or auto-advancing. Centre the sets on screen.
      scrollToEx = false;
      requestAnimationFrame(() => {
        const t = root.querySelector('.exx.active .w-set') || root.querySelector('.exx.active');
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else {
      requestAnimationFrame(() => window.scrollTo(0, keepY));
    }
  }

  function exerciseCard(lw, cur, ei, sessions) {
    const ex = exercises.find(e => e.id === cur.exerciseId);
    const allDone = cur.sets.length > 0 && cur.sets.every(s => s.done);
    /* passed: you decided you could not do this one today. It stays on the
       rail, folded and marked, so the session is an honest record of what
       happened rather than quietly shorter. */
    const active = ei === lw.exIndex && !cur.passed;
    const card = el('div', 'exx' + (active ? ' active' : '') + (allDone ? ' is-done' : '')
      + (cur.passed ? ' passed' : ''));

    // node on the rail
    const node = el('i', 'ex-node');
    node.appendChild(el('i'));
    card.appendChild(node);

    // header — always visible; tap to focus this exercise
    const hd = el('div', 'exx-head');
    const th = el('div', 'exx-thumb');
    th.appendChild(thumbFor(ex));
    th.onclick = e => { e.stopPropagation(); if (ex) openDetail(ex.id, 'workout'); };
    hd.appendChild(th);
    const col = el('div', 'exx-col');
    col.appendChild(el('div', 'exx-name', cur.name));
    const exMeta = el('div', 'exx-meta',
      `${(ex && ex.group) ? ex.group + ' · ' : ''}${cur.sets.length} × ${cur.repLo}–${cur.repHi}${cur.timed ? (cur.perSide ? ' s / side' : ' s') : ''}`);
    addHardship(exMeta, ex || { name: cur.name });
    col.appendChild(exMeta);
    hd.appendChild(col);
    const doneN = cur.sets.filter(s => s.done).length;
    hd.appendChild(el('div', 'exx-count num', `${doneN}/${cur.sets.length}`));
    hd.appendChild(gripEl('Drag to move it up or down the session'));
    hd.onclick = () => {
      if (lw.exIndex === ei) return;
      lw.exIndex = ei;
      lw.advanceAfterRest = false;
      live.set(lw);
      scrollToEx = true;   // you asked for it — bring its sets to centre
      renderWorkout();
    };
    card.appendChild(hd);

    // collapsed: a finished exercise is one line of numbers; a pending one just its header
    if (!active) {
      if (cur.passed) {
        const row = el('div', 'exx-passed');
        row.appendChild(el('span', 'pass-tag', 'Passed'));
        row.appendChild(el('span', 'pass-why', 'Skipped today — the block is unchanged'));
        const back = el('button', 'pass-undo', 'Put it back');
        back.onclick = e => {
          e.stopPropagation();
          delete cur.passed;
          lw.exIndex = ei;
          live.set(lw);
          renderWorkout();
        };
        row.appendChild(back);
        card.appendChild(row);
      } else if (allDone) {
        const sum = el('div', 'exx-sum num',
          cur.sets.map(s => cur.timed ? `${s.reps}s` : `${fmtWn(s.kg)} × ${s.reps}`).join('  ·  '));
        if (cur.feel) {
          const tag = el('span', 'hd-feel ' + cur.feel);
          tag.title = cur.feel;
          tag.appendChild(feelIcon(cur.feel, 15));
          sum.appendChild(tag);
        }
        card.appendChild(sum);
      }
      return card;
    }

    // --- expanded (active exercise) ---
    const watch = el('div', 'ex-watch');
    watch.appendChild(svgIcon(PLAY, 10));
    watch.appendChild(document.createTextNode(' Watch the movement'));
    watch.onclick = () => { if (ex) openDetail(ex.id, 'workout'); };
    card.appendChild(watch);

    /* One way out of an exercise you cannot do today. Taking it out for good
       is a different decision and lives on the exercise's own page. */
    const outs = el('div', 'exx-outs');
    const passB = el('button', 'exx-out', 'Pass');
    passB.title = 'Skip it for today';
    passB.onclick = async () => {
      const banked2 = cur.sets.filter(s => s.done).length;
      if (banked2 && !await appConfirm({
        title: `Pass on ${cur.name}?`,
        body: `${banked2} set${banked2 > 1 ? 's are' : ' is'} already logged and will still be saved. `
          + 'It is marked passed for today only.',
        ok: 'Pass', cancel: 'Keep going', warn: true
      })) return;
      cur.passed = true;
      const next = lw.exercises.findIndex((e2, i) => i !== ei && !e2.passed && !e2.sets.every(s => s.done));
      if (next >= 0) lw.exIndex = next;
      lw.advanceAfterRest = false;
      live.set(lw);
      haptic();
      scrollToEx = true;
      renderWorkout();
    };
    outs.appendChild(passB);
    outs.appendChild(el('span', 'exx-out-note', 'today only'));
    card.appendChild(outs);

    // plate math
    if (ex && isBarbell(ex)) {
      const firstPendingSet = cur.sets.find(s => !s.done) || cur.sets[cur.sets.length - 1];
      const plates = plateMath(firstPendingSet.kg);
      if (plates.length) {
        const ps = el('div', 'plate-strip');
        ps.appendChild(el('span', 'bar', 'BAR'));
        const pSpan = el('span', 'plates num', '20 + ' + plates.join(' + '));
        pSpan.id = 'plate-live-' + ei;
        ps.appendChild(pSpan);
        ps.appendChild(el('span', 'side', 'per side'));
        card.appendChild(ps);
      }
    }

    // in-place refresh for value edits — avoids full re-render flicker
    const updateVals = () => {
      cur.sets.forEach((s, i) => {
        const kv = $('#val-kg-' + ei + '-' + i);
        if (kv) kv.textContent = String(s.kg);
        const sv = $('#val-sec-' + ei + '-' + i);
        if (sv) sv.textContent = fmtClock(s.reps);
        const rv = $('#val-reps-' + ei + '-' + i);
        if (rv) {
          rv.textContent = String(s.reps);
          rv.classList.remove('pending', 'inrange', 'below', 'above');
          rv.classList.add(repTone(s));
        }
      });
      const ps = $('#plate-live-' + ei);
      if (ps) {
        const fp = cur.sets.find(s => !s.done) || cur.sets[cur.sets.length - 1];
        const plates = plateMath(fp.kg);
        ps.textContent = plates.length ? '20 + ' + plates.join(' + ') : 'bar only';
      }
    };

    /* column headers — the rep range lives here, never inline in a row.
       A held exercise has no weight worth a column, so the seconds take the
       weight's place and its own scale, and the play button gets room. */
    const gh = el('div', 'set-grid-head' + (cur.timed ? ' timed' : ''));
    (cur.timed
      ? ['#', `Sec · ${cur.repLo}–${cur.repHi}`, 'Hold', 'Log']
      : ['#', 'Kg', `Reps · ${cur.repLo}–${cur.repHi}`, 'Log'])
      .forEach(t => gh.appendChild(el('span', null, t)));
    card.appendChild(gh);

    // set rows — weight is a tap target that opens the scale inside the row
    cur.sets.forEach((set, si) => {
      const r = el('div', 'w-set' + (set.done ? ' logged' : ''));
      const inner = el('div', 'w-set-row' + (cur.timed ? ' timed' : ''));
      inner.appendChild(el('div', 'sn num', String(si + 1)));

      /* the first value cell: seconds on a held exercise, weight on every
         other — same tap target, same scale sliding open underneath */
      const valCell = el('button', 'kg-cell');
      const kvWrap = el('span', 'kv-wrap');
      const kv = el('span', 'kv num', cur.timed ? fmtClock(set.reps) : String(set.kg));
      kv.id = (cur.timed ? 'val-sec-' : 'val-kg-') + ei + '-' + si;
      kvWrap.appendChild(kv);
      kvWrap.appendChild(el('small', null, cur.timed ? 's' : wUnit()));
      valCell.appendChild(kvWrap);
      // a logged set is locked — untick it first to change anything
      valCell.disabled = set.done;
      valCell.onclick = () => {
        if (set.done) return;
        const key = ei + ':' + si;
        lw.scaleOpenAt = lw.scaleOpenAt === key ? null : key;
        lw.repScaleAt = null;
        live.set(lw);
        renderWorkout();
      };
      inner.appendChild(valCell);

      if (cur.timed) {
        // the hold gets a column of its own instead of being wedged between
        // two steppers it kept getting confused with
        const play = el('button', 'hold-cell' + (holdInt && holdExIdx === ei && holdIdx === si ? ' on' : ''));
        play.id = 'hold-' + ei + '-' + si;
        play.appendChild(svgIcon(PLAY, 13));
        play.appendChild(el('span', 'hold-lbl', set.done ? 'Done' : 'Start'));
        play.disabled = set.done;
        play.onclick = () => { if (!set.done) toggleHold(ei, si); };
        inner.appendChild(play);
      } else {
        // the rep number is a tap target — it opens the vertical wheel
        const repBtn = el('button', 'rep-cell');
        const rv = el('span', 'reps-val num ' + repTone(set), String(set.reps));
        rv.id = 'val-reps-' + ei + '-' + si;
        repBtn.appendChild(rv);
        repBtn.disabled = set.done;
        repBtn.onclick = () => {
          if (set.done) return;
          const key = ei + ':' + si;
          lw.repScaleAt = lw.repScaleAt === key ? null : key;
          lw.scaleOpenAt = null;
          live.set(lw);
          renderWorkout();
        };
        inner.appendChild(repBtn);
      }
      const log = el('button', 'log-btn' + (set.done ? ' on' : ''));
      log.innerHTML = '<svg viewBox="0 0 14 14" width="14" height="14"><path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      log.onclick = () => {
        set.done = !set.done;
        if (set.done) {
          set.doneAt = Date.now();
          lw.exIndex = ei;                 // you're working here now
          const key = ei + ':' + si;       // close this row's picker — the set is locked
          if (lw.scaleOpenAt === key) lw.scaleOpenAt = null;
          if (lw.repScaleAt === key) lw.repScaleAt = null;
        }
        // last set banked -> advance AFTER the rest finishes, not abruptly now
        lw.advanceAfterRest = set.done && cur.sets.every(s => s.done)
          && lw.exercises.some((e2, i) => i > ei && !e2.passed);
        live.set(lw);
        if (set.done) startRest(cur.rest);   // after save — startRest re-reads state
        renderWorkout();
      };
      inner.appendChild(log);
      r.appendChild(inner);

      // the weight / seconds / rep scale expands inside this row
      if (lw.scaleOpenAt === ei + ':' + si) {
        r.appendChild(cur.timed
          ? timeScale(lw, cur, ei, si, updateVals)
          : weightScale(lw, cur, ei, si, updateVals));
      } else if (lw.repScaleAt === ei + ':' + si && !cur.timed) {
        r.appendChild(repScale(lw, cur, ei, si, updateVals));
      }
      card.appendChild(r);
    });

    // progression strip
    const sug = suggestion(cur.sets);
    if (sug.kind === 'increase') {
      const s = el('div', 'suggest up');
      const t = el('div');
      t.appendChild(el('div', 's-title', `Top of range · ${sug.last.reps}/${cur.repLo}-${cur.repHi}`));
      t.appendChild(el('div', 's-body', cur.timed
        ? 'Full hold banked — add 5 s to your remaining sets.'
        : `Go up to ${fmtW(sug.nextKg)} on your remaining sets.`));
      s.appendChild(t);
      if (cur.sets.some(x => !x.done)) {
        const act = el('button', 's-act num', cur.timed ? '+5 s' : '+' + fmtW(sug.step));
        act.onclick = () => {
          if (cur.timed) cur.sets.forEach(x => { if (!x.done) x.reps += 5; });
          else applySuggestion(cur.sets, sug.nextKg);
          live.set(lw);
          renderWorkout();
        };
        s.appendChild(act);
      }
      card.appendChild(s);
    } else if (sug.kind === 'hold') {
      const s = el('div', 'suggest hold');
      const t = el('div');
      t.appendChild(el('div', 's-title', `Hold steady · ${sug.last.reps}/${cur.repLo}-${cur.repHi}`));
      t.appendChild(el('div', 's-body', cur.timed
        ? `Build up to ${cur.repHi} s holds before adding time.`
        : `Stay at ${fmtW(sug.kg)} until you reach ${cur.repHi} reps.`));
      s.appendChild(t);
      card.appendChild(s);
    } else {
      const s = el('div', 'suggest idle');
      const t = el('div');
      t.appendChild(el('div', 's-title', 'Progression'));
      t.appendChild(el('div', 's-body', cur.timed
        ? `Tap ▸ on a set to run the hold timer — reach ${cur.repHi} s to progress.`
        : `Hit ${cur.repHi} reps on a set to earn +${fmtW(wBump())}.`));
      s.appendChild(t);
      card.appendChild(s);
    }

    /* difficulty feedback, on the card the whole time the exercise is open —
       it used to appear only once every set was banked, by which point you
       are already resting and looking at the next thing */
    if (cur.sets.length) {
      const allDone2 = cur.sets.every(s => s.done);
      const fw = el('div', 'feel-wrap');
      /* the heading carries the word, so the buttons do not have to — and it
         answers back the moment you tap one */
      const ask = allDone2 ? 'How was it?' : 'How is it going?';
      const head2 = el('div', 'micro');
      const sayFeel = () => {
        head2.textContent = cur.feel
          ? (allDone2 ? 'Felt ' : 'Feeling ') + cur.feel
          : ask;
        head2.classList.toggle('on', !!cur.feel);
      };
      sayFeel();
      fw.appendChild(head2);
      const strip = el('div', 'feel-strip');
      [['easy', 'Easy'], ['moderate', 'Moderate'], ['hard', 'Hard']].forEach(([k, label]) => {
        const b = el('button', 'feel-btn ' + k + (cur.feel === k ? ' sel' : ''));
        b.appendChild(feelIcon(k));
        b.title = label;
        b.setAttribute('aria-label', label);
        b.onclick = () => {
          cur.feel = cur.feel === k ? null : k;
          live.set(lw);
          strip.querySelectorAll('.feel-btn').forEach(x => x.classList.remove('sel'));
          if (cur.feel) b.classList.add('sel');
          sayFeel();
          haptic();
        };
        strip.appendChild(b);
      });
      fw.appendChild(strip);
      card.appendChild(fw);
    }

    // inline rest timer — lives at the bottom of the active exercise
    card.appendChild(inlineRest(lw, cur));

    // last time line
    const hist = sessions.filter(s => s.exerciseId === cur.exerciseId && s.date !== todayStr()).sort((a, b) => b.ts - a.ts);
    if (hist.length) {
      const h = hist[0];
      const kg = Math.max(...h.sets.map(s => s.weight || 0));
      const line = el('div', 'last-line');
      line.appendChild(el('i'));
      line.appendChild(el('span', 'num', `Last time · ${fmtW(kg)} × ${h.sets.map(s => s.reps).join(', ')}`));
      card.appendChild(line);
    }

    // weight history graph for this move, right under its sets
    {
      const asc = [...hist].sort((a, b) => a.ts - b.ts);
      const hasWeight = asc.some(s => s.sets.some(x => (x.weight || 0) > 0));
      const pts = asc.map(s => ({
        ts: s.ts,
        kg: hasWeight
          ? Math.max(...s.sets.map(x => x.weight || 0))
          : Math.max(...s.sets.map(x => x.reps || 0))
      })).filter(p => p.kg > 0);
      if (pts.length >= 2) {
        const g = el('div', 'bw-graph');
        g.innerHTML = bwGraphSVG(pts);
        card.appendChild(g);
      }
    }
    /* everything below the header goes in one wrapper, so grabbing a grip can
       fold the open exercise shut — you cannot aim a drop at a card that is
       taller than the screen */
    const openBits = [...card.children].filter(n => n !== node && n !== hd);
    if (openBits.length) {
      const bodyWrap = el('div', 'exx-body');
      openBits.forEach(n => bodyWrap.appendChild(n));
      card.appendChild(bodyWrap);
    }
    return card;
  }

  /* ---- live hold timer for timed exercises (plank etc.) ---- */
  let holdInt = null, holdIdx = -1, holdExIdx = -1, holdEndTs = 0;
  let scrollToEx = false;   // scroll the current exercise into view on next render

  function cancelHold() {
    clearInterval(holdInt);
    holdInt = null;
    holdIdx = -1;
    holdExIdx = -1;
    closeHoldPop();
  }
  function closeHoldPop() {
    const pop = $('#hold-pop');
    if (pop) pop.hidden = true;
  }
  /* The hold runs in a popup, big enough to read from the floor, and it opens
     on a three-second lead-in — nobody is in position the instant they take
     their thumb off the screen. */
  function toggleHold(exIdx, si) {
    if (holdInt && holdExIdx === exIdx && holdIdx === si) { cancelHold(); renderWorkout(); return; }
    cancelHold();
    const lw0 = live.get();
    if (!lw0) return;
    const exRef = lw0.exercises[exIdx];
    const secs = exRef.sets[si].reps;
    /* three to get set, then the hold — two-sided holds run it once per side
       with a short switch break between */
    const phases = [{ label: 'Get set', dur: 3, lead: true }].concat(exRef.perSide
      ? [{ label: 'Left side', dur: secs }, { label: 'Switch', dur: 10, lead: true }, { label: 'Right side', dur: secs }]
      : [{ label: 'Hold', dur: secs }]);
    let phase = 0;
    holdIdx = si;
    holdExIdx = exIdx;
    holdEndTs = Date.now() + phases[0].dur * 1000;
    ensureAudio();

    const pop = $('#hold-pop');
    const timeEl = $('#hold-pop-time');
    const phaseEl = $('#hold-pop-phase');
    const barEl = $('#hold-pop-bar').firstElementChild;
    $('#hold-pop-name').textContent = exRef.name;
    pop.hidden = false;
    $('#hold-pop-stop').onclick = () => { cancelHold(); renderWorkout(); };
    pop.onclick = e => { if (e.target === pop) { cancelHold(); renderWorkout(); } };

    const paint = (left, ph) => {
      pop.classList.toggle('lead', !!ph.lead);
      phaseEl.textContent = ph.lead ? ph.label : (exRef.perSide ? ph.label : 'Hold');
      timeEl.textContent = ph.lead ? String(left) : fmtClock(left);
      barEl.style.width = Math.max(0, Math.min(100, (left / ph.dur) * 100)) + '%';
      const btn = $('#hold-' + exIdx + '-' + si);
      if (btn) {
        btn.classList.add('on');
        const lbl = btn.querySelector('.hold-lbl');
        if (lbl) lbl.textContent = ph.lead ? ph.label : fmtClock(left);
      }
    };
    paint(phases[0].dur, phases[0]);

    let lastHoldTick = 0;
    holdInt = setInterval(() => {
      const ph = phases[phase];
      const left = Math.ceil((holdEndTs - Date.now()) / 1000);
      if (left > 0) {
        if (left <= (ph.lead ? 3 : 5) && lastHoldTick !== phase * 1000 + left) {
          lastHoldTick = phase * 1000 + left;
          tickBeep();
        }
        paint(left, ph);
        return;
      }
      /* The alert marks a moment something is due — a rest run out, a hold
         served. A lead-in ends by starting work, which needs no announcement:
         its three ticks already counted you in. */
      if (ph.lead) {
        haptic();
      } else {
        beep();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
      if (phase < phases.length - 1) {
        phase++;
        holdEndTs = Date.now() + phases[phase].dur * 1000;
        paint(phases[phase].dur, phases[phase]);
        return;
      }
      cancelHold();
      const fresh = live.get();
      if (!fresh) return;
      const set = fresh.exercises[exIdx].sets[si];
      set.done = true;
      set.doneAt = Date.now();
      const curEx = fresh.exercises[exIdx];
      fresh.exIndex = exIdx;
      fresh.advanceAfterRest = curEx.sets.every(s => s.done) && exIdx < fresh.exercises.length - 1;
      live.set(fresh);
      startRest(curEx.rest);
      if (!$('#view-workout').hidden) renderWorkout();
    }, 200);
    renderWorkout();
  }

  function stepper(set, key, step, onChange) {
    const wrap = el('div', 'stepper');
    const minus = el('button', null, '−');
    minus.onclick = () => { set[key] = Math.max(0, +(set[key] - step).toFixed(2)); val.textContent = String(set[key]); onChange(); };
    const val = el('div', 'val num', String(set[key]));
    // tap the number to type it directly (number pad)
    val.onclick = () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = '0';
      inp.inputMode = key === 'kg' ? 'decimal' : 'numeric';
      inp.step = key === 'kg' ? '0.5' : '1';
      inp.value = set[key];
      inp.className = 'val-edit num';
      val.replaceWith(inp);
      inp.focus();
      inp.select();
      const commit = () => {
        const v = Math.max(0, Number(inp.value) || 0);
        set[key] = key === 'kg' ? +v.toFixed(2) : Math.round(v);
        val.textContent = String(set[key]);
        inp.replaceWith(val);
        onChange();
      };
      inp.onblur = commit;
      inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
    };
    const plus = el('button', null, '+');
    plus.onclick = () => { set[key] = +(set[key] + step).toFixed(2); val.textContent = String(set[key]); onChange(); };
    wrap.append(minus, val, plus);
    return wrap;
  }

  /* ---------------- rest timer ---------------- */
  let restInt = null, audioCtx = null;

  /* our beeps must MIX with whatever the user is listening to —
     never pause the Music app (iOS Audio Session API, 16.4+) */
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch { /* older iOS */ }

  function ensureAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch { /* no audio */ }
  }
  function tone(freq, at, dur, gain) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq;
    o.connect(g); g.connect(audioCtx.destination);
    const t = audioCtx.currentTime + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur - 0.02);
    o.start(t); o.stop(t + dur);
  }
  function tickBeep() {
    ensureAudio();
    try { tone(660, 0, 0.13, 0.5); } catch { /* best-effort */ }
  }

  /* Five alerts, built out of oscillators rather than downloaded. Nothing to
     licence, nothing to ship, nothing to fetch — and each one is a handful of
     notes: [frequency, start, length, loudness]. */
  const ALERTS = [
    { key: 'chime', label: 'Chime',
      notes: [[880, 0, .26], [1175, .3, .26], [880, .6, .26], [1175, .9, .26]] },
    { key: 'bell', label: 'Bell',
      notes: [[1046, 0, 1.1, .55], [1568, .01, .85, .3], [2093, .02, .5, .12]] },
    { key: 'marimba', label: 'Marimba',
      notes: [[784, 0, .17, .8], [988, .15, .17, .8], [1319, .3, .4, .85]] },
    { key: 'ping', label: 'Ping',
      notes: [[1760, 0, .12, .7], [1760, .22, .12, .7]] },
    { key: 'knock', label: 'Knock',
      notes: [[196, 0, .2, .95], [147, .26, .3, .95]] }
  ];
  const alertOf = k => ALERTS.find(a => a.key === k) || ALERTS[0];
  const alertKey = () => alertOf(getProfile().alertSound).key;

  /* play one now — used by the settings list so you hear what you are picking */
  function playAlert(key) {
    ensureAudio();
    try {
      if (audioCtx && audioCtx.state === 'running') {
        alertOf(key).notes.forEach(([f, t0, d, g]) => tone(f, t0, d, g == null ? .85 : g));
        return;
      }
    } catch { /* best-effort */ }
    buildBeepAudio(key);
    if (beepAudio) { try { beepAudio.currentTime = 0; beepAudio.play().catch(() => {}); } catch { /* blocked */ } }
  }
  /* pre-rendered beep clip — second audio path for when WebAudio is blocked.
     Built LAZILY on first use: creating a media element at boot grabs the
     audio session on iOS and stops the Music app. */
  let beepAudio = null, beepBuiltFor = null;
  function buildBeepAudio(key) {
    const k = key || alertKey();
    if (beepBuiltFor === k) return;
    beepBuiltFor = k;
    try {
      const notes = alertOf(k).notes;
      const sr = 22050;
      const n = Math.floor(sr * (Math.max(...notes.map(([, t0, d]) => t0 + d)) + 0.1));
      const bytes = new Uint8Array(44 + n * 2);
      const dv = new DataView(bytes.buffer);
      const ws = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
      ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVEfmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
      dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
      ws(36, 'data'); dv.setUint32(40, n * 2, true);
      const pcm = new Int16Array(bytes.buffer, 44);
      notes.forEach(([f, t0, d, g]) => {
        const amp = (g == null ? 0.85 : g) / Math.max(1, notes.length > 2 ? 1.4 : 1);
        const s0 = Math.floor(t0 * sr), s1 = Math.min(n, Math.floor((t0 + d) * sr));
        for (let i = s0; i < s1; i++) {
          const env = Math.max(0, Math.min(1, (i - s0) / 200, (s1 - i) / 400));
          const v = pcm[i] + Math.sin(2 * Math.PI * f * (i / sr)) * 32767 * amp * env;
          pcm[i] = Math.max(-32768, Math.min(32767, Math.round(v)));
        }
      });
      let bin = '';
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      beepAudio = new Audio('data:audio/wav;base64,' + btoa(bin));
      beepAudio.preload = 'auto';
    } catch { beepAudio = null; }
  }
  function beep() {
    ensureAudio();
    buildBeepAudio();
    let ok = false;
    try {
      if (audioCtx && audioCtx.state === 'running') {
        alertOf(alertKey()).notes.forEach(([f, t0, d, g]) => tone(f, t0, d, g == null ? .85 : g));
        ok = true;
      }
    } catch { /* audio best-effort */ }
    if (!ok && beepAudio) {
      try { beepAudio.currentTime = 0; beepAudio.play().catch(() => {}); } catch { /* blocked */ }
    }
  }
  function startRest(len) {
    ensureAudio();
    buildBeepAudio();
    try {
      // prime the context inside the user gesture so later beeps are allowed
      const buf = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx.destination);
      src.start(0);
    } catch { /* no audio */ }
    if (beepAudio && !startRest.primed) {
      // unlock the media-element path inside the same gesture
      beepAudio.muted = true;
      beepAudio.play().then(() => {
        beepAudio.pause();
        beepAudio.currentTime = 0;
        beepAudio.muted = false;
        startRest.primed = true;
      }).catch(() => { /* try again next set */ });
    }
    restTick.last = 0;
    const lw = live.get();
    if (!lw) return;
    lw.restLen = len;
    lw.restEndsAt = Date.now() + len * 1000;
    live.set(lw);
    armRestTick();
  }
  function stopRest() {
    const lw = live.get();
    if (lw) {
      if (lw.restEndsAt && lw.advanceAfterRest) {
        lw.advanceAfterRest = false;
        // step over anything you passed on the way to the next one
        const next = lw.exercises.findIndex((e, i) => i > lw.exIndex && !e.passed);
        if (next >= 0) lw.exIndex = next;
      }
      lw.restEndsAt = null;
      live.set(lw);
    }
    clearInterval(restInt);
    restInt = null;
    updatePill();
  }
  function armRestTick() {
    clearInterval(restInt);
    restInt = setInterval(restTick, 250);
    restTick();
  }
  function restTick() {
    const lw = live.get();
    if (!lw || !lw.restEndsAt) { clearInterval(restInt); restInt = null; updatePill(); return; }
    const left = Math.ceil((lw.restEndsAt - Date.now()) / 1000);
    if (left <= 0) {
      lw.restEndsAt = null;
      if (lw.advanceAfterRest) {
        lw.advanceAfterRest = false;
        if (lw.exIndex < lw.exercises.length - 1) lw.exIndex++;
      }
      live.set(lw);
      clearInterval(restInt); restInt = null;
      beep();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if (!$('#view-workout').hidden) renderWorkout();
      updatePill(true);
      return;
    }
    // 5-4-3-2-1 warning ticks before GO
    if (left <= 5 && left >= 1 && restTick.last !== left) {
      restTick.last = left;
      tickBeep();
    }
    // update in-place
    const t = $('#rest-time-live');
    if (t) t.textContent = fmtClock(left);
    const dt = $('#dock-time');
    if (dt) dt.textContent = fmtClock(left);
    const bar = $('#rest-bar-fill');
    if (bar) bar.style.width = Math.max(0, Math.min(100, (left / lw.restLen) * 100)) + '%';
    updatePill();
  }
  function updatePill(justDone) {
    const pill = $('#timer-pill');
    const lw = live.get();
    const inWorkout = !$('#view-workout').hidden;
    // the workout has its own floating timer panel; on the exercise page the
    // demo fills the top so the pill docks at the bottom there
    pill.classList.toggle('bottom', !$('#view-detail').hidden);
    if (justDone && !inWorkout) {
      pill.hidden = false;
      $('#pill-time').textContent = 'GO';
      setTimeout(() => { pill.hidden = true; updatePill(); }, 4000);
      return;
    }
    if (lw && lw.restEndsAt && !inWorkout) {
      pill.hidden = false;
      $('#pill-time').textContent = fmtClock(Math.max(0, Math.ceil((lw.restEndsAt - Date.now()) / 1000)));
    } else pill.hidden = true;
  }
  $('#pill-cancel').onclick = stopRest;

  /* "+2.5 kg vs set 2" readout for the weight scale */
  function setDelta(cur, si) {
    if (si === 0) return 'Opening set';
    const d = +(cur.sets[si].kg - cur.sets[si - 1].kg).toFixed(2);
    if (d === 0) return `Same as set ${si}`;
    return `${d > 0 ? '+' : '−'}${Math.abs(d)} kg vs set ${si}`;
  }

  /* Haptic tick — navigator.vibrate on Android; on iOS (no vibrate API)
     programmatically toggling a hidden switch control fires the system
     haptic in Safari 17.4+. */
  const hapticSwitch = (() => {
    const label = document.createElement('label');
    label.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    label.setAttribute('aria-hidden', 'true');
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.setAttribute('switch', '');
    inp.tabIndex = -1;
    label.appendChild(inp);
    document.body.appendChild(label);
    return inp;
  })();
  function haptic() {
    if (navigator.vibrate) { navigator.vibrate(8); return; }
    try { hapticSwitch.click(); } catch (e) { /* no haptics available */ }
  }

  /* ---------------- how it felt, as a face ----------------
     Three words in three pills is a lot of reading for a question you answer
     between sets with one thumb. The same line-art the rest of the icons use:
     mouth up, mouth flat, mouth down. The heading above says the word, so
     nothing has to be guessed. */
  /* How hard it was, as load on a bar — one plate a side is a warm-up, three
     is a grind. Effort, not mood: a frowning face says you had a bad time,
     which is not the question being asked. */
  const FEEL_PLATES = {
    easy: [[9.7, 3.6]],
    moderate: [[9.7, 4.6], [6.7, 3.4]],
    hard: [[9.7, 5.2], [6.7, 4.1], [3.7, 3]]
  };
  function feelIcon(key, size = 30) {
    const NS = 'http://www.w3.org/2000/svg';
    const plates = FEEL_PLATES[key] || FEEL_PLATES.moderate;
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-linecap', 'round');
    const add = (d, w) => {
      const n = document.createElementNS(NS, 'path');
      n.setAttribute('d', d);
      n.setAttribute('stroke-width', w);
      s.appendChild(n);
    };
    add('M2.2 12 H21.8', 1.5);                       // the bar
    plates.forEach(([x, h]) => {                     // loaded both ends,
      add(`M${x} ${12 - h} V ${12 + h}`, 2.1);       // heaviest plate inside
      add(`M${24 - x} ${12 - h} V ${12 + h}`, 2.1);
    });
    s.style.display = 'block';
    return s;
  }

  /* ---------------- drag to reorder ----------------
     One grip per row. A touch screen has no HTML5 drag worth having, so this
     is pointer-driven: hold the grip and the row lifts, the rows it passes
     slide out of its way, letting go commits the new order. Nothing moves
     until you let go, so a mis-grab costs nothing.
     `prep` runs before anything is measured — the workout rail uses it to
     fold the open exercise shut so you can see where you are dropping. */
  function dragReorder(container, rowSel, onDrop, prep) {
    container.addEventListener('pointerdown', e => {
      const grip = e.target.closest && e.target.closest('.drag-grip');
      if (!grip || !container.contains(grip)) return;
      const row = grip.closest(rowSel);
      if (!row) return;
      e.preventDefault();

      if (prep) prep(true);
      const rows = [...container.querySelectorAll(rowSel)];
      const from = rows.indexOf(row);
      if (from < 0) { if (prep) prep(false); return; }
      const boxes = rows.map(r => r.getBoundingClientRect());
      const mids = boxes.map(b => b.top + b.height / 2);
      const lift = boxes[from].height + 12;   // how far a displaced row shifts

      let to = from;
      const startY = e.clientY;
      row.classList.add('drag-lift');
      grip.setPointerCapture(e.pointerId);
      haptic();

      const move = ev => {
        const dy = ev.clientY - startY;
        row.style.transform = `translateY(${dy}px)`;
        const centre = mids[from] + dy;
        let next = from;
        for (let i = 0; i < rows.length; i++) {
          if (i === from) continue;
          if (i < from && centre < mids[i]) { next = Math.min(next, i); }
          if (i > from && centre > mids[i]) { next = Math.max(next, i); }
        }
        if (next !== to) { to = next; haptic(); }
        rows.forEach((r, i) => {
          if (i === from) return;
          let shift = 0;
          if (to > from && i > from && i <= to) shift = -lift;
          if (to < from && i >= to && i < from) shift = lift;
          r.style.transform = shift ? `translateY(${shift}px)` : '';
        });
      };
      const end = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', end);
        grip.removeEventListener('pointercancel', end);
        rows.forEach(r => { r.style.transform = ''; r.classList.remove('drag-lift'); });
        if (prep) prep(false);
        if (to !== from) onDrop(from, to);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    });
  }

  const gripEl = title => {
    const g = el('button', 'drag-grip');
    g.title = title || 'Drag to reorder';
    // the workout card's header switches exercises on tap — the grip is not
    // a tap on the card
    g.onclick = e => { e.preventDefault(); e.stopPropagation(); };
    g.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">'
      + '<circle cx="6" cy="4" r="1.35"/><circle cx="10" cy="4" r="1.35"/>'
      + '<circle cx="6" cy="8" r="1.35"/><circle cx="10" cy="8" r="1.35"/>'
      + '<circle cx="6" cy="12" r="1.35"/><circle cx="10" cy="12" r="1.35"/></svg>';
    return g;
  };

  /* Sliding ruler — ticks glide left/right under a fixed indicator.
     Drag it like a real scale, or tap a tick / the ± buttons. */
  function rulerScale(opts) {
    // opts: value, step, tickW, span, min, labelEvery, decimals, cls, onChange(v)
    const st = { base: opts.value, val: opts.value };
    const lblEvery = opts.labelEvery || 1;
    const fmt = opts.fmt || (v => opts.decimals ? v.toFixed(opts.decimals) : String(+v.toFixed(2)));
    const wrap = el('div', 'ks-ruler' + (opts.cls ? ' ' + opts.cls : ''));
    wrap.appendChild(el('i', 'ks-ind'));
    const strip = el('div', 'ks-strip');
    wrap.appendChild(strip);

    const idxOf = v => Math.round((v - (st.base - opts.span * opts.step)) / opts.step);
    const offFor = v => -(idxOf(v) * opts.tickW + opts.tickW / 2);
    let suppress = false;

    const build = () => {
      strip.innerHTML = '';
      const majorEvery = opts.majorEvery || 5;
      for (let d = -opts.span; d <= opts.span; d++) {
        const v = +(st.base + d * opts.step).toFixed(3);
        const ok = v >= (opts.min ?? 0);
        const stepsFromZero = Math.round(v / opts.step);
        const t = el('button', 'ks-tick');
        t.style.width = opts.tickW + 'px';
        t.dataset.v = v;
        t.appendChild(el('i', stepsFromZero % majorEvery === 0 ? 'h20' : (stepsFromZero % 2 ? 'h11' : 'h15')));
        const showLbl = ok && stepsFromZero % lblEvery === 0;
        t.dataset.lbl = ok ? (showLbl ? fmt(v) : '') : '—';
        t.appendChild(el('span', 'num', t.dataset.lbl));
        if (ok) t.onclick = () => { if (suppress) return; setVal(v, true); };
        strip.appendChild(t);
      }
      mark();
    };
    const mark = () => {
      [...strip.children].forEach(t => {
        const sel = Math.abs(+t.dataset.v - st.val) < opts.step / 2;
        t.classList.toggle('sel', sel);
        // the selected tick is always labelled; others follow the every-Nth rule
        t.lastChild.textContent = sel ? fmt(+t.dataset.v) : t.dataset.lbl;
      });
    };
    const slide = anim => {
      strip.style.transition = anim ? 'transform .18s ease-out' : 'none';
      strip.style.transform = `translateX(${offFor(st.val)}px)`;
    };
    const setVal = (v, anim) => {
      v = Math.max(opts.min ?? 0, +v.toFixed(3));
      if (v !== st.val) haptic();
      st.val = v;
      opts.onChange(v);
      // rebuild around the value when it drifts near the strip's edge
      if (idxOf(v) < 2 || idxOf(v) > 2 * opts.span - 2) {
        st.base = v; build(); slide(false);
      } else { mark(); slide(anim); }
    };

    // drag like a real scale — a haptic tick per detent.
    // touch-action none: the browser must never hesitate between our drag
    // and a page scroll, which is what made horizontal drags laggy.
    let sx = null, so = 0, lastN = 0;
    wrap.style.touchAction = 'none';
    wrap.addEventListener('pointerdown', e => {
      sx = e.clientX; so = offFor(st.val); lastN = 0;
      strip.style.transition = 'none';
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      strip.style.transform = `translateX(${so + dx}px)`;
      const n = Math.round(dx / opts.tickW);
      if (n !== lastN) { lastN = n; haptic(); }
    });
    const endDrag = e => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) < (opts.dragOnly ? 14 : 5)) {
        // dragOnly scales ignore taps outright — nothing moves without a swipe
        slide(false);
        if (opts.dragOnly) return;
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const tick = t && t.closest ? t.closest('.ks-tick') : null;
        if (tick && tick.dataset.v !== undefined) {
          const v = +tick.dataset.v;
          if (v >= (opts.min ?? 0)) setVal(v, true);
        }
        return;
      }
      suppress = true;
      setTimeout(() => { suppress = false; }, 350);
      setVal(st.val - Math.round(dx / opts.tickW) * opts.step, true);
    };
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', () => { if (sx !== null) { sx = null; slide(false); } });

    build();
    slide(false);
    return { el: wrap, setVal: v => setVal(v, true), get: () => st.val };
  }

  /* The weight scale — expands inside the set row. The ruler runs in whatever
     unit you picked (0.5 kg or 1 lb per notch); kilos are what get stored. */
  function weightScale(lw, cur, ei, si, updateVals) {
    const set = cur.sets[si];
    const box = el('div', 'kg-scale');

    const top = el('div', 'ks-top');
    const big = el('div', 'ks-val num', fmtWn(set.kg));
    top.appendChild(big);
    const deltaEl = el('div', 'ks-delta', setDelta(cur, si));
    top.appendChild(deltaEl);
    box.appendChild(top);

    const commit = shown => {
      const v = fromW(shown);
      set.kg = v;
      // the new weight carries forward to the remaining unlogged sets
      for (let j = si + 1; j < cur.sets.length; j++) {
        if (!cur.sets[j].done) cur.sets[j].kg = v;
      }
      live.set(lw);
      updateVals();
      big.firstChild.nodeValue = fmtKg(shown);
      deltaEl.textContent = setDelta(cur, si);
    };
    const ruler = rulerScale({
      value: +toW(set.kg).toFixed(1), step: wStep(), tickW: 30, span: 14, min: 0,
      labelEvery: 2, majorEvery: 2, onChange: commit
    });
    box.appendChild(ruler.el);

    const ctr = el('div', 'ks-controls');
    const openedWith = set.kg;   // for reverting a mistaken change
    const undo = el('button', 'ks-adj ks-reset num', '↺ ' + fmtWn(openedWith));
    undo.title = 'Back to ' + fmtW(openedWith);
    undo.onclick = () => ruler.setVal(+toW(openedWith).toFixed(1));
    const reset = el('button', 'ks-adj ks-reset num', '0');
    reset.title = 'Reset to 0';
    reset.onclick = () => ruler.setVal(0);
    ctr.append(undo, reset);
    const plates = el('div', 'ks-plates');
    wPlates().forEach(p => {
      const b = el('button', 'num', '+' + p);
      b.onclick = () => ruler.setVal(ruler.get() + p);
      plates.appendChild(b);
    });
    ctr.appendChild(plates);
    box.appendChild(ctr);
    return box;
  }

  /* The hold length, on the same sliding scale the weight uses — a held set
     has no weight to set, so the seconds inherit its whole treatment rather
     than being squeezed between two tiny steppers. */
  function timeScale(lw, cur, ei, si, updateVals) {
    const set = cur.sets[si];
    const box = el('div', 'kg-scale');

    const top = el('div', 'ks-top');
    const big = el('div', 'ks-val num', fmtClock(set.reps));
    top.appendChild(big);
    top.appendChild(el('div', 'ks-delta', `target ${cur.repLo}–${cur.repHi} s`
      + (cur.perSide ? ' / side' : '')));
    box.appendChild(top);

    const commit = v => {
      set.reps = Math.max(5, Math.round(v));
      // the new length carries forward to the sets you have not held yet
      for (let j = si + 1; j < cur.sets.length; j++) {
        if (!cur.sets[j].done) cur.sets[j].reps = set.reps;
      }
      live.set(lw);
      updateVals();
      big.textContent = fmtClock(set.reps);
    };
    const ruler = rulerScale({
      value: set.reps, step: 5, tickW: 30, span: 14, min: 5,
      labelEvery: 2, majorEvery: 2, fmt: v => fmtClock(v), onChange: commit
    });
    box.appendChild(ruler.el);

    const ctr = el('div', 'ks-controls');
    const openedWith = set.reps;
    const undo = el('button', 'ks-adj ks-reset num', '↺ ' + fmtClock(openedWith));
    undo.title = 'Back to ' + fmtClock(openedWith);
    undo.onclick = () => ruler.setVal(openedWith);
    ctr.appendChild(undo);
    /* three suggestions at most, and they come from this exercise's own
       target rather than a fixed list — a 10 s side plank has no use for a
       one-minute button, and six pills in a row was unreadable anyway */
    const quick = el('div', 'ks-plates');
    const round5 = v => Math.max(5, Math.round(v / 5) * 5);
    [...new Set([round5(cur.repLo), round5(cur.repHi), round5(cur.repHi + 15)])]
      .slice(0, 3)
      .forEach(s => {
        const b = el('button', 'num', fmtClock(s));
        b.onclick = () => ruler.setVal(s);
        quick.appendChild(b);
      });
    ctr.appendChild(quick);
    box.appendChild(ctr);
    return box;
  }

  /* The rep scale — a vertical wheel that expands inside the set row.
     Drag up/down like a dial, or tap a number. */
  function repScale(lw, cur, ei, si, updateVals) {
    const set = cur.sets[si];
    const TICK = 34, SPAN = 8;
    let base = set.reps;
    const box = el('div', 'rep-scale');

    const top = el('div', 'ks-top');
    const big = el('div', 'ks-val num', String(set.reps));
    big.appendChild(el('small', null, ' reps'));
    top.appendChild(big);
    top.appendChild(el('div', 'ks-delta', `Target ${cur.repLo}–${cur.repHi}`));
    box.appendChild(top);

    const wrap = el('div', 'vs-ruler');
    wrap.appendChild(el('i', 'vs-ind'));
    const strip = el('div', 'vs-strip');
    wrap.appendChild(strip);
    box.appendChild(wrap);

    const idxOf = v => Math.round(v - (base - SPAN));
    const offFor = v => -(idxOf(v) * TICK + TICK / 2);
    let suppress = false;
    const build = () => {
      strip.innerHTML = '';
      for (let d = -SPAN; d <= SPAN; d++) {
        const v = base + d;
        const ok = v >= 0;
        const t = el('button', 'vs-tick');
        t.dataset.v = v;
        const slot = el('span', 'vs-slot');
        slot.appendChild(el('i', v % 5 === 0 ? 'w20' : (v % 2 ? 'w11' : 'w15')));
        t.appendChild(slot);
        t.appendChild(el('span', 'num', ok ? String(v) : ''));
        if (ok) t.onclick = () => { if (!suppress) setVal(v, true); };
        strip.appendChild(t);
      }
      mark();
    };
    const mark = () => {
      [...strip.children].forEach(t => {
        const v = +t.dataset.v;
        t.classList.toggle('sel', v === set.reps);
        t.classList.toggle('inband', v >= cur.repLo && v <= cur.repHi);
      });
    };
    const slide = anim => {
      strip.style.transition = anim ? 'transform .18s ease-out' : 'none';
      strip.style.transform = `translateY(${offFor(set.reps)}px)`;
    };
    const setVal = (v, anim) => {
      v = Math.max(0, Math.round(v));
      if (v !== set.reps) haptic();
      set.reps = v;
      live.set(lw);
      updateVals();
      big.firstChild.nodeValue = String(v);
      if (idxOf(v) < 2 || idxOf(v) > 2 * SPAN - 2) { base = v; build(); slide(false); }
      else { mark(); slide(anim); }
    };

    // vertical drag, snapping one rep per notch — a haptic tick per detent
    let sy = null, so = 0, lastN = 0;
    wrap.style.touchAction = 'none';
    wrap.addEventListener('pointerdown', e => {
      sy = e.clientY; so = offFor(set.reps); lastN = 0;
      strip.style.transition = 'none';
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e => {
      if (sy === null) return;
      const dy = e.clientY - sy;
      strip.style.transform = `translateY(${so + dy}px)`;
      const n = Math.round(dy / TICK);
      if (n !== lastN) { lastN = n; haptic(); }
    });
    const endDrag = e => {
      if (sy === null) return;
      const dy = e.clientY - sy;
      sy = null;
      if (Math.abs(dy) < 5) {
        // a tap — pointer capture eats the click, so hit-test the tick ourselves
        slide(false);
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const tick = t && t.closest ? t.closest('.vs-tick') : null;
        if (tick && tick.dataset.v !== undefined && +tick.dataset.v >= 0) setVal(+tick.dataset.v, true);
        return;
      }
      suppress = true;
      setTimeout(() => { suppress = false; }, 350);
      setVal(set.reps - Math.round(dy / TICK), true);
    };
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', () => { if (sy !== null) { sy = null; slide(false); } });

    build();
    slide(false);
    return box;
  }

  /* Inline rest timer at the bottom of the active exercise — presets always visible */
  function inlineRest(lw, cur) {
    const resting = !!lw.restEndsAt;
    // a paused session holds its rest rather than dropping it — say so, and
    // show the number it is holding, not the length it would start at
    const held = !resting && lw.pausedAt && lw.restLeft;
    const c = el('div', 'rest-inline' + (resting || held ? ' on' : ''));
    const top = el('div', 'ri-state' + (resting ? ' on' : ''));
    top.appendChild(el('i', 'live-dot' + (resting ? '' : ' idle')));
    const nextEx = lw.advanceAfterRest
      && lw.exercises.find((e2, i) => i > lw.exIndex && !e2.passed);
    top.appendChild(document.createTextNode(resting
      ? (nextEx ? ' Resting · next: ' + nextEx.name : ' Resting')
      : (held ? ' Rest held' : ' Rest timer · ready')));
    c.appendChild(top);

    const mid = el('div', 'rest-mid');
    const t = el('div', 'rest-time num', resting
      ? fmtClock(Math.max(0, Math.ceil((lw.restEndsAt - Date.now()) / 1000)))
      : fmtClock(held ? lw.restLeft : cur.rest));
    t.id = 'rest-time-live';
    mid.appendChild(t);
    /* the only rest control in a session: nudge the running clock, or nudge
       the length the next rest will start at */
    const bump = d => {
      if (lw.restEndsAt) {
        lw.restEndsAt = Math.max(Date.now(), lw.restEndsAt + d * 1000);
        live.set(lw); restTick();
      } else {
        cur.rest = Math.max(15, Math.min(900, cur.rest + d));
        live.set(lw);
        t.textContent = fmtClock(cur.rest);
        note.textContent = cur.rest === restDefault()
          ? `Default ${fmtClock(restDefault())} — change it in Settings`
          : `Default is ${fmtClock(restDefault())} · nudged for this exercise`;
      }
      haptic();
    };
    const m15 = el('button', 'adj num', '−15');
    m15.onclick = () => bump(-15);
    const p15 = el('button', 'adj num', '+15');
    p15.onclick = () => bump(15);
    const act = el('button', 'skip', resting ? 'Skip' : 'Start');
    act.onclick = () => {
      if (resting) { stopRest(); renderWorkout(); }
      else { startRest(cur.rest); renderWorkout(); }
    };
    mid.append(m15, p15, act);
    c.appendChild(mid);

    const bar = el('div', 'rest-bar');
    const fill = el('div');
    fill.id = 'rest-bar-fill';
    fill.style.width = resting ? Math.min(100, ((lw.restEndsAt - Date.now()) / 1000 / lw.restLen) * 100) + '%' : '100%';
    bar.appendChild(fill);
    c.appendChild(bar);

    /* where the number came from, and what changing it here costs you —
       the presets used to live on this card and got picked by accident */
    const note = el('div', 'rest-note');
    note.textContent = resting
      ? `Started at ${fmtClock(lw.restLen)}`
      : held ? 'Holding until you start the session again'
      : (cur.rest === restDefault()
        ? `Default ${fmtClock(restDefault())} — change it in Settings`
        : `Default is ${fmtClock(restDefault())} · nudged for this exercise`);
    c.appendChild(note);

    if (resting) armRestTick();
    return c;
  }

  /* ---------------- adding an exercise mid-session ----------------
     Same three dials as the block builder, because a session you are already
     inside is no place to learn a second way of picking something. What you
     add lands at the end of the rail and is logged like everything else — it
     does not touch the block you are running. */
  let addSets = 3, addExIx = 0, addReps = 3, addQuery = '', addGroup = 'All';
  /* set when the exercise form was opened from the dial sheet, so what you
     write goes straight where you were adding it instead of only into the
     library */
  let pickerAfterSave = null;

  /* The dial sheet is used from two places now — a live session and the
     block editor — so it takes what to call itself and what to do with the
     pick, and knows nothing else about either. */
  let addTarget = null;

  function openDialPicker(opts) {
    addTarget = opts;
    sheetBack = opts.back || null;
    addSets = opts.sets || 3;
    addReps = opts.repIx != null ? opts.repIx : 3;
    addExIx = 0; addQuery = ''; addGroup = 'All';
    const h2 = $('#sheet-addex h2');
    if (h2) h2.textContent = opts.title;
    renderDialPicker();
    openSheet('#sheet-addex');
  }

  function openAddToSession() {
    openDialPicker({
      title: 'Add to this session',
      cta: 'Add to this session',
      live: true,
      onPick: (item, sets, reps) => addExerciseToLive(item, sets, reps)
    });
  }

  function renderDialPicker() {
    const root = $('#addex-body');
    const opts = addTarget;
    if (!root || !opts) return;
    root.innerHTML = '';
    if (opts.live && !live.get()) { closeSheets(); return; }

    /* your own list first — anything you have ever added or written — then
       the rest of the catalog */
    const seen = new Set(exercises.map(e => e.name.toLowerCase()));
    const pool = [
      ...exercises.map(e => ({ name: e.name, group: e.group || 'Other', notes: e.notes, demo: e.demo, mine: true })),
      ...(window.EXERCISE_LIBRARY || []).filter(i => equipOK(i) && !seen.has(i.name.toLowerCase()))
    ];

    const groups = ['All', ...[...new Set(pool.map(x => x.group))].sort()];
    if (!groups.includes(addGroup)) addGroup = 'All';
    const chips = el('div', 'gchip-row');
    groups.forEach(g => {
      const b = el('button', 'gchip' + (g === addGroup ? ' on' : ''), g);
      b.onclick = () => { addGroup = g; addExIx = 0; renderDialPicker(); };
      chips.appendChild(b);
    });
    root.appendChild(chips);

    const find = el('input', 'search-input');
    find.placeholder = 'Search exercises';
    find.value = addQuery;
    find.oninput = () => { addQuery = find.value; addExIx = 0; renderDialPicker(); };
    root.appendChild(find);

    const q = addQuery.trim().toLowerCase();
    const shown = pool.filter(x =>
      (addGroup === 'All' || x.group === addGroup) &&
      (!q || x.name.toLowerCase().includes(q)));
    addExIx = Math.max(0, Math.min(shown.length - 1, addExIx));

    if (!shown.length) {
      root.appendChild(el('div', 'coach-note', 'Nothing matches — clear the search, or write your own below.'));
    } else {
      const wheels = el('div', 'cd-wheels pm-wheels');
      const c1 = el('div', 'cd-col pm-sets');
      c1.appendChild(el('div', 'micro', 'Sets'));
      c1.appendChild(pickerWheel(PM_SETS.map(String), PM_SETS.indexOf(addSets),
        i => { addSets = PM_SETS[i]; }, null,
        i => (PM_SETS[i] % 5 === 0 ? 'w20' : (PM_SETS[i] % 2 ? 'w11' : 'w15'))));
      wheels.appendChild(c1);
      const c2 = el('div', 'cd-col pm-exx');
      c2.appendChild(el('div', 'micro', shown.length === pool.length ? 'Exercise' : `Exercise · ${shown.length}`));
      c2.appendChild(pickerWheel(shown.map(x => x.name), addExIx, i => { addExIx = i; paintPick(); }, 'wide',
        i => (i % 5 === 0 ? 'w20' : (i % 2 ? 'w11' : 'w15'))));
      wheels.appendChild(c2);
      const c3 = el('div', 'cd-col pm-reps');
      c3.appendChild(el('div', 'micro', 'Reps'));
      c3.appendChild(pickerWheel(PM_REPS.map(r => r.label), addReps, i => { addReps = i; }, null,
        i => (i % 2 ? 'w11' : 'w15')));
      wheels.appendChild(c3);
      root.appendChild(wheels);

      const hardLine = el('div', 'pm-hard');
      const paintPick = () => {
        hardLine.innerHTML = '';
        const item = shown[addExIx];
        const h = item && hardshipOf(item);
        if (!h) return;
        hardLine.appendChild(hardChip(item));
        hardLine.appendChild(el('span', 'pm-hard-note', h.note));
      };
      paintPick();
      root.appendChild(hardLine);

      const go = el('button', 'btn-cta big');
      go.style.width = '100%';
      go.textContent = opts.cta;
      go.onclick = async () => {
        const item = shown[addExIx];
        if (!item) return;
        // the pick lands where it belongs, so there is nothing to go back to
        sheetBack = null;
        addTarget = null;
        await opts.onPick(item, addSets, PM_REPS[addReps]);
      };
      root.appendChild(go);
    }

    const own = el('button', 'btn-ghost');
    own.style.width = '100%';
    own.textContent = '＋ Write your own';
    own.onclick = () => {
      const spec = { sets: addSets, reps: PM_REPS[addReps], onPick: opts.onPick };
      pickerAfterSave = spec;
      // cancelling the form drops you back on the dials, not out of everything
      sheetBack = () => { openDialPicker(opts); };
      openExerciseForm(null);
    };
    root.appendChild(own);
  }

  /* one exercise, appended to the session you are standing in */
  async function addExerciseToLive(item, sets, reps) {
    const lw = live.get();
    if (!lw) return;
    const ex = await ensureExercise(item);
    const sessions = await DB.all('sessions');
    const hist = sessions.filter(s => s.exerciseId === ex.id).sort((a, b) => b.ts - a.ts);
    const lastMax = hist.length ? Math.max(...hist[0].sets.map(s => s.weight || 0)) : 0;
    const timed = /second/i.test(ex.notes || '');
    lw.exercises.push({
      exerciseId: ex.id, name: ex.name,
      timed, perSide: /side/i.test(ex.notes || ''),
      repLo: reps.lo, repHi: reps.hi, rest: restDefault(), added: true,
      sets: Array.from({ length: sets }, () => ({
        kg: timed ? 0 : lastMax, reps: reps.lo,
        targetLo: reps.lo, targetHi: reps.hi, done: false
      }))
    });
    lw.exIndex = lw.exercises.length - 1;
    live.set(lw);
    haptic();
    closeSheets();
    scrollToEx = true;
    show('workout');
    renderWorkout();
  }

  /* Docked rest bar — a slim glass strip over the page while resting */
  function dockedRestBar(lw) {
    const outer = el('div', 'dock-rest');
    const bar = el('div', 'dock-inner');
    bar.appendChild(el('i', 'live-dot'));
    const t = el('span', 'dock-time num', fmtClock(Math.max(0, Math.ceil((lw.restEndsAt - Date.now()) / 1000))));
    t.id = 'dock-time';
    bar.appendChild(t);
    const nextEx = lw.advanceAfterRest
      && lw.exercises.find((e2, i) => i > lw.exIndex && !e2.passed);
    bar.appendChild(el('span', 'dock-next', nextEx ? 'Next · ' + nextEx.name : lw.exercises[lw.exIndex].name));
    const p15 = el('button', 'dock-btn num', '+15');
    p15.onclick = () => { lw.restEndsAt += 15000; live.set(lw); restTick(); };
    const skip = el('button', 'dock-skip', 'Skip');
    skip.onclick = () => { stopRest(); renderWorkout(); };
    bar.append(p15, skip);
    outer.appendChild(bar);
    return outer;
  }

  /* ---------------- finish workout ---------------- */
  async function finishWorkout() {
    const lw = live.get();
    if (!lw) return;
    const loggedEx = lw.exercises.filter(e => e.sets.some(s => s.done));
    if (!loggedEx.length) {
      if (!await appConfirm({
        title: 'Finish workout?', body: 'No sets were logged — nothing will be saved.',
        ok: 'Finish anyway', cancel: 'Keep training', warn: true
      })) return;
    } else {
      /* a passed exercise is not an oversight — it gets its own line rather
         than being listed as something you forgot */
      const passed = lw.exercises.filter(e => e.passed);
      const missed = lw.exercises.filter(e => !e.passed && !e.sets.some(s => s.done));
      const partial = lw.exercises.filter(e => !e.passed && e.sets.some(s => s.done) && !e.sets.every(s => s.done));
      let opts = { title: 'Finished?', body: 'The session will be saved.', ok: 'Save session', cancel: 'Keep training' };
      if (passed.length && !missed.length && !partial.length) {
        opts.body = 'Passed: ' + passed.map(e => e.name).join(', ')
          + '\n\nThe block is unchanged — they are back next week.';
      }
      if (missed.length || partial.length) {
        const parts = [];
        if (missed.length) parts.push('Not logged: ' + missed.map(e => e.name).join(', '));
        if (partial.length) parts.push('Sets left open: ' + partial.map(e => e.name).join(', '));
        if (passed.length) parts.push('Passed: ' + passed.map(e => e.name).join(', '));
        opts = {
          title: 'Finish anyway?', body: parts.join('\n') + '\n\nUnlogged sets will not be saved.',
          ok: 'Finish anyway', cancel: 'Keep training', warn: true
        };
      }
      if (!await appConfirm(opts)) return;
    }

    const sessionsAll = await DB.all('sessions');
    const mins = Math.max(1, Math.round(wElapsed(lw) / 60));
    let volume = 0, setCount = 0;
    const prs = [];

    for (const e of loggedEx) {
      const done = e.sets.filter(s => s.done);
      volume += done.reduce((a, s) => a + s.kg * s.reps, 0);
      setCount += done.length;
      // PR detection vs history
      const bestToday = Math.max(...done.map(s => est1RM(s.kg, s.reps)));
      const prior = sessionsAll.filter(s => s.exerciseId === e.exerciseId)
        .flatMap(s => s.sets.map(x => est1RM(x.weight || 0, x.reps)));
      const bestPrior = prior.length ? Math.max(...prior) : 0;
      if (bestPrior > 0 && bestToday > bestPrior) {
        prs.push({ name: e.name, before: Math.round(bestPrior), after: Math.round(bestToday) });
      }
      await DB.put('sessions', {
        id: DB.uid(), exerciseId: e.exerciseId, date: todayStr(), ts: Date.now(),
        planId: lw.planId, timed: !!e.timed, feel: e.feel || null,
        sets: done.map(s => ({ reps: s.reps, weight: s.kg }))
      });
    }

    // write last weights back into the plan prescription
    const plan = await DB.get('plans', lw.planId);
    if (plan && plan.days && plan.days[lw.dayIndex]) {
      for (const item of plan.days[lw.dayIndex].items) {
        const e = lw.exercises.find(x => x.exerciseId === item.exerciseId);
        if (e) {
          const done = e.sets.filter(s => s.done);
          if (done.length) item.kg = Math.max(...done.map(s => s.kg));
        }
      }
      const w = weekOf(plan) || 1;
      plan.completed = plan.completed || [];
      plan.completed.push({ week: w, day: lw.dayIndex, date: todayStr(), duration: mins });
      if (w >= (plan.weeks || 4)) {
        const doneFinal = new Set(plan.completed.filter(c => c.week >= (plan.weeks || 4)).map(c => c.day));
        if (doneFinal.size >= plan.days.length) plan.finishedAt = Date.now();
      }
      await DB.put('plans', plan);
    }

    const workout = {
      id: DB.uid(), date: todayStr(), ts: Date.now(),
      planId: lw.planId, dayIndex: lw.dayIndex, name: lw.dayName,
      duration: mins, volume: Math.round(volume), sets: setCount,
      prs, feel: null
    };
    await DB.put('workouts', workout);
    live.set(null);
    stopRest();
    clearInterval(elapsedInt);
    renderSummary(workout, plan);
    show('summary');
  }

  /* ============================================================
     SUMMARY
     ============================================================ */
  function renderSummary(w, plan) {
    const root = $('#view-summary');
    root.innerHTML = '';
    const head = el('div');
    head.appendChild(el('div', 'hero-tag', `${w.name} · Complete`));
    const title = el('div', 'sum-title');
    title.innerHTML = 'Banked.' + (w.prs.length ? `<br>${w.prs.length} PR${w.prs.length > 1 ? 's' : ''}.` : '');
    head.appendChild(title);
    if (plan && plan.finishedAt) {
      head.appendChild(el('div', 'sum-body', `That was the last session of the block — all ${plan.weeks || 4} weeks done. Renew your plan from Today.`));
    } else {
      head.appendChild(el('div', 'sum-body', 'Progress is saved. Weights you hit today are pre-loaded for next time.'));
    }
    root.appendChild(head);

    const grid = el('div', 'sum-grid');
    grid.appendChild(sumCard(w.duration + ' min', 'Duration'));
    grid.appendChild(sumCard(fmtW(w.volume), 'Volume'));
    grid.appendChild(sumCard(String(w.sets), 'Sets logged'));
    const prC = sumCard(String(w.prs.length), 'Records');
    prC.classList.add('hl');
    grid.appendChild(prC);
    root.appendChild(grid);

    for (const pr of w.prs) {
      const r = el('div', 'pr-row');
      r.appendChild(el('div', 'pr-badge', '1RM'));
      const c = el('div');
      c.appendChild(el('div', 'pr-name', pr.name));
      c.appendChild(el('div', 'pr-detail num', `Est. 1RM ${pr.after} kg · was ${pr.before} kg`));
      r.appendChild(c);
      r.appendChild(el('div', 'pr-delta num', '+' + fmtW(pr.after - pr.before)));
      root.appendChild(r);
    }

    /* the whole session, on the same three faces as the exercises */
    const feelAsk = el('div', 'micro', 'How did it feel?');
    if (w.feel) { feelAsk.textContent = 'Felt ' + w.feel.toLowerCase(); feelAsk.classList.add('on'); }
    root.appendChild(feelAsk);
    const feel = el('div', 'feel-row');
    [['Easy', 'easy'], ['Solid', 'moderate'], ['Brutal', 'hard']].forEach(([f, face]) => {
      const b = el('button', w.feel === f ? 'sel' : null);
      b.appendChild(feelIcon(face, 28));
      b.title = f;
      b.setAttribute('aria-label', f);
      b.onclick = async () => {
        w.feel = f;
        await DB.put('workouts', w);
        feelAsk.textContent = 'Felt ' + f.toLowerCase();
        feelAsk.classList.add('on');
        $$('.feel-row button').forEach(x => x.classList.toggle('sel', x === b));
        haptic();
      };
      feel.appendChild(b);
    });
    root.appendChild(feel);

    const save = el('button', 'btn-cta', 'Save session');
    save.onclick = () => { show('today'); renderTab(); };
    root.appendChild(save);
  }
  function sumCard(v, l) {
    const c = el('div', 'card');
    c.appendChild(el('div', 'v num', v));
    c.appendChild(el('div', 'l', l));
    return c;
  }

  /* ============================================================
     PLAN TAB (program + history)
     ============================================================ */
  async function renderPlanTab() {
    const root = $('#view-plan');
    root.innerHTML = '';
    const workouts = (await DB.all('workouts')).sort((a, b) => b.ts - a.ts);
    const sessions = await DB.all('sessions');
    const plan = activePlan();
    let planRailShared = null;   // days + history share one timeline

    const head = el('header', 't-head');
    const hl = el('div');
    hl.appendChild(el('div', 't-date', `${workouts.length} session${workouts.length === 1 ? '' : 's'}${plan ? ' · Block ' + blockNumber(plan) : ''}`));
    hl.appendChild(el('h1', 't-title', 'Plan'));
    head.appendChild(hl);
    root.appendChild(head);

    // installable starter block (until a copy of it exists)
    if (window.STARTER_BLOCK && !plans.some(p => p.name === window.STARTER_BLOCK.name)) {
      const sb = window.STARTER_BLOCK;
      const c = el('div', 'compare-card');
      const h = el('div', 'cmp-head');
      h.appendChild(el('div', 'a', 'Ready-made · by Claude'));
      h.appendChild(el('div', 'b', `${sb.days.length}× / week · ${sb.weeks} weeks`));
      c.appendChild(h);
      c.appendChild(el('div', 'hist-name', sb.name));
      c.appendChild(el('div', 'hist-meta', sb.days.map(d => d.name).join(' · ') + ' — machine-based, low spinal load'));
      const b = el('button', 'btn-lime', 'Install');
      b.style.cssText = 'margin-top:12px;width:100%';
      b.onclick = () => installStarter();
      c.appendChild(b);
      root.appendChild(c);
    }

    // active program — flat v5 section, no card
    if (plan) {
      const weeks = plan.weeks || 4;
      const curWeek = plan.startDate ? weekOf(plan) : 0;
      const c = el('div', 'plan-block');
      const bh = el('div', 'block-head');
      const bhl = el('div');
      bhl.appendChild(el('div', 'micro', plan.name));
      bhl.appendChild(el('div', 'pb-week num',
        plan.pausedAt ? 'Paused' :
        (planFinished(plan) ? 'Complete' : (curWeek ? `Week ${curWeek} of ${weeks}` : 'Not started'))));
      bh.appendChild(bhl);
      const editB = el('button', 'rest-edit', 'Edit');
      editB.onclick = () => openPlanForm(plan);
      bh.appendChild(editB);
      c.appendChild(bh);
      // week track — one bar per week, like the workout's exercise track
      const wt = el('div', 'ex-progress');
      for (let i = 1; i <= weeks; i++) {
        wt.appendChild(el('span', i < (curWeek || 1) ? 'done' : (i === (curWeek || 1) && curWeek ? 'cur' : '')));
      }
      c.appendChild(wt);
      const doneThisWeek = new Set((plan.completed || []).filter(x => x.week === (curWeek || 1)).map(x => x.day));
      const firstPendingDay = (plan.days || []).findIndex((_, i) => !doneThisWeek.has(i));
      const dRail = el('div', 'plan-rail');
      planRailShared = dRail;   // history continues on this same line
      (plan.days || []).forEach((day, i) => {
        const done = doneThisWeek.has(i);
        const r = el('div', 'pday-row' + (done ? ' done' : ''));
        const node = el('i', 'ex-node small' + (done ? ' filled' : (i === firstPendingDay ? ' active' : '')));
        node.appendChild(el('i'));
        r.appendChild(node);
        r.appendChild(el('div', 'pd-name', day.name));
        r.appendChild(el('div', 'pd-meta num', done ? 'done ✓' : day.items.length + ' exercises ▾'));
        const go = el('button', 'pd-go');
        if (done) {
          go.textContent = '✓';
          go.disabled = true;
        } else {
          go.appendChild(svgIcon(PLAY, 10));
          go.onclick = e => { e.stopPropagation(); startWorkout(plan, i); };
        }
        r.appendChild(go);
        dRail.appendChild(r);

        // tap the day to preview the exercises you'll go through
        const pv = el('div', 'day-preview');
        pv.hidden = true;
        r.onclick = () => {
          if (pv.hidden && !pv.dataset.built) {
            day.items.forEach(it => pv.appendChild(planItemRow(it, 'plan')));
            pv.dataset.built = '1';
          }
          pv.hidden = !pv.hidden;
          r.classList.toggle('open', !pv.hidden);
        };
        dRail.appendChild(pv);
      });
      c.appendChild(dRail);
      root.appendChild(c);
    }

    // history — continues on the same timeline as the days, newest first.
    // Only the last few show until you ask for the rest.
    const hRail = planRailShared || el('div', 'plan-rail');
    const HIST_SHOWN = 3;
    const histList = planHistOpen ? workouts : workouts.slice(0, HIST_SHOWN);
    let curMonth = '';
    histList.forEach((w, i) => {
      const m = dateOf(w.date).toLocaleDateString('en-US', { month: 'long' });
      if (m !== curMonth) { curMonth = m; hRail.appendChild(el('div', 'month-label', m)); }
      const r = el('div', 'hrow' + (i > 4 ? ' old' : ''));
      const node = el('i', 'ex-node small');
      node.appendChild(el('i'));
      r.appendChild(node);
      const c = el('div', 'hrow-body');
      c.appendChild(el('div', 'hrow-date', dateOf(w.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ` · ${w.duration} min`));
      const nm = el('div', 'hrow-name', w.name);
      if (w.prs && w.prs.length) nm.appendChild(el('span', 'pr-chip', w.prs.length + ' PR'));
      c.appendChild(nm);
      c.appendChild(el('div', 'hrow-meta num', `${fmtW(w.volume)} · ${w.sets} sets${w.feel ? ' · ' + w.feel : ''} ▾`));
      r.appendChild(c);
      const del = el('button', 'hist-del', '✕');
      del.title = 'Delete this session';
      del.onclick = async e => {
        e.stopPropagation();
        if (!confirm(`Delete the ${w.name} session from ${w.date}? Its logged sets are removed too.`)) return;
        const sess = await DB.all('sessions');
        for (const s of sess) {
          if (s.date === w.date && s.planId === w.planId) await DB.del('sessions', s.id);
        }
        const p = w.planId ? await DB.get('plans', w.planId) : null;
        if (p && p.completed) {
          p.completed = p.completed.filter(cpl => !(cpl.date === w.date && cpl.day === w.dayIndex));
          if (p.finishedAt) p.finishedAt = null;
          await DB.put('plans', p);
        }
        await DB.del('workouts', w.id);
        renderTab();
      };
      r.appendChild(del);

      // tap a past session to see exactly what was logged
      const det2 = el('div', 'hist-detail');
      det2.hidden = true;
      r.onclick = () => {
        if (det2.hidden && !det2.dataset.built) {
          const daySess = sessions.filter(s => s.date === w.date && s.planId === w.planId);
          if (!daySess.length) det2.appendChild(el('div', 'hd-empty', 'No sets were logged.'));
          for (const s of daySess) {
            const ex = exercises.find(e2 => e2.id === s.exerciseId);
            const dr = el('div', 'hd-row');
            dr.appendChild(el('div', 'hd-name', ex ? ex.name : 'Deleted exercise'));
            const txt = s.sets.map(x => (x.weight || 0) > 0
              ? `${fmtWn(x.weight)}×${x.reps}`
              : `${x.reps}${s.timed ? 's' : ''}`).join(' · ');
            const hs = el('div', 'hd-sets num', txt);
            if (s.feel) {
              const tag = el('span', 'hd-feel ' + s.feel);
              tag.title = s.feel;
              tag.appendChild(feelIcon(s.feel, 14));
              hs.appendChild(tag);
            }
            dr.appendChild(hs);
            det2.appendChild(dr);
          }
          det2.dataset.built = '1';
        }
        det2.hidden = !det2.hidden;
        r.classList.toggle('open', !det2.hidden);
      };

      const wrap = el('div', 'hist-wrap');
      wrap.appendChild(r);
      wrap.appendChild(det2);
      hRail.appendChild(wrap);
    });
    if (workouts.length > HIST_SHOWN) {
      const more = el('div', 'text-links inset');
      const b = el('button', null, planHistOpen
        ? 'Show less'
        : `Show all ${workouts.length} sessions`);
      b.onclick = () => { planHistOpen = !planHistOpen; renderTab(); };
      more.appendChild(b);
      hRail.appendChild(more);
    }
    if (!planRailShared && workouts.length) root.appendChild(hRail);

    // pause / delete — buttons at the very bottom of the page
    if (plan) {
      const delRow = el('div', 'block-actions');
      const pauseB = el('button', 'btn-ghost', plan.pausedAt ? 'Resume block' : 'Pause block');
      pauseB.onclick = async () => {
        if (plan.pausedAt) {
          await resumePlan(plan);
        } else {
          if (!await appConfirm({
            title: 'Pause the block?',
            body: 'Going away for a while? The block freezes — missed days and weeks won\'t count against you until you resume.',
            ok: 'Pause', cancel: 'Keep training'
          })) return;
          plan.pausedAt = Date.now();
          await DB.put('plans', plan);
        }
        renderTab();
      };
      delRow.appendChild(pauseB);
      const delB = el('button', 'btn-ghost', 'Delete block');
      delB.onclick = async () => {
        if (!confirm(`Delete "${plan.name}"? History is kept.`)) return;
        await DB.del('plans', plan.id);
        renderTab();
      };
      delRow.appendChild(delB);
      root.appendChild(delRow);

    }

    if (!workouts.length && !plan) {
      const emp = el('div', 'empty-state');
      emp.appendChild(el('p', null, 'No block yet — build one in the Blocks tab to start training.'));
      root.appendChild(emp);
    }
  }
  /* Horizontal option rail — the ruler language applied to a short list of
     choices. Swipe it or tap an option; it snaps to the nearest and ticks. */
  function optionRail(labels, index, onChange, tickW) {
    // short labels (plain numbers) want a tighter tick so more of the range
    // is on screen at once; word labels keep the roomy default
    const TICK = tickW || 96;
    let val = Math.max(0, Math.min(labels.length - 1, index < 0 ? 0 : index));
    const wrap = el('div', 'or-rail');
    wrap.appendChild(el('i', 'or-ind'));
    const strip = el('div', 'or-strip');
    labels.forEach((lb, i) => {
      const t = el('button', 'or-item');
      t.dataset.i = i;
      t.style.width = TICK + 'px';
      t.appendChild(el('i'));
      t.appendChild(el('span', 'or-lbl', lb));
      strip.appendChild(t);
    });
    wrap.appendChild(strip);

    const offFor = i => -(i * TICK + TICK / 2);
    const mark = () => [...strip.children].forEach((t, i) => t.classList.toggle('sel', i === val));
    const put = off => { strip.style.transform = `translateX(${off}px)`; };
    const slide = anim => {
      strip.style.transition = anim ? 'transform .2s ease-out' : 'none';
      put(offFor(val));
    };
    const setVal = (i, anim) => {
      i = Math.max(0, Math.min(labels.length - 1, i));
      if (i !== val) haptic();
      val = i; mark(); slide(anim); onChange(val);
    };

    let sx = null, so = 0, lastN = 0;
    wrap.style.touchAction = 'none';
    wrap.addEventListener('pointerdown', e => {
      sx = e.clientX; so = offFor(val); lastN = 0;
      strip.style.transition = 'none';
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      put(so + dx);
      const n = Math.round(dx / TICK);
      if (n !== lastN) { lastN = n; haptic(); }
    });
    const end = e => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) < 5) {
        slide(false);
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const item = t && t.closest ? t.closest('.or-item') : null;
        if (item) setVal(+item.dataset.i, true);
        return;
      }
      setVal(val - Math.round(dx / TICK), true);
    };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', () => { if (sx !== null) { sx = null; slide(false); } });

    mark(); slide(false);
    return wrap;
  }

  /* ---------------- about you ----------------
     A handful of one-time answers that actually change what a block says.
     Stored on this device like everything else. */
  const GOALS = [
    { key: 'strength', label: 'Strength', reps: '5–8', repIx: 0, note: 'heavy, low reps, long rests' },
    { key: 'muscle', label: 'Muscle', reps: '8–12', repIx: 3, note: 'moderate load, controlled reps' },
    { key: 'fatloss', label: 'Fat loss', reps: '12–15', repIx: 5, note: 'higher reps, short rests, more cardio' },
    { key: 'health', label: 'Health', reps: '10–12', repIx: 4, note: 'steady, sustainable, joint-friendly' }
  ];
  const LEVELS = [
    { key: 'new', label: 'New', note: 'under a year — add weight often' },
    { key: 'mid', label: '1–3 yrs', note: 'add weight when reps are earned' },
    { key: 'exp', label: '3+ yrs', note: 'slower jumps, more volume tolerated' }
  ];
  const SESSION_MINS = [30, 45, 60, 75, 90];

  function getProfile() {
    try { return JSON.parse(localStorage.getItem('profile') || '{}') || {}; } catch { return {}; }
  }
  function setProfile(patch) {
    const next = { ...getProfile(), ...patch };
    localStorage.setItem('profile', JSON.stringify(next));
    return next;
  }
  const goalOf = () => GOALS.find(g => g.key === getProfile().goal) || null;

  /* US Navy body-fat estimate — a tape measure beats most bathroom scales,
     and the trend matters more than the absolute number either way. */
  function navyBodyFat(pr) {
    const h = +pr.heightCm, w = +pr.waistCm, n = +pr.neckCm, hip = +pr.hipCm;
    if (!(h > 0 && w > 0 && n > 0)) return null;
    let bf;
    if (pr.sex === 'female') {
      if (!(hip > 0)) return null;
      bf = 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.22100 * Math.log10(h)) - 450;
    } else {
      if (w - n <= 0) return null;
      bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
    }
    return bf > 2 && bf < 70 ? +bf.toFixed(1) : null;
  }

  /* rough clock for a day's worth of work: a set plus its rest, and a warm-up */
  const dayMinutes = items => items.length
    ? Math.round(8 + items.reduce((a, it) => a + it.sets * 2.5, 0))
    : 0;

  /* Settings — one page with everything on it, no rows that open more rows. */
  function openAbout() { sDraft = null; show('about'); renderAbout(); }

  let sDraft = null;                       // edits live here until you Save

  function renderAbout() {
    const root = $('#view-about');
    root.innerHTML = '';
    if (!sDraft) sDraft = { ...getProfile() };
    const pr = sDraft;
    const saved = getProfile();
    const dirty = () => JSON.stringify(sDraft) !== JSON.stringify(saved);

    /* the screen previews your draft, so units read as you have just set them */
    const dW = () => (pr.units === 'lb' ? 'lb' : 'kg');
    const dH = () => (pr.hUnits === 'ft' ? 'ft' : 'cm');
    const dToW = kg => (dW() === 'lb' ? kg * LB_PER_KG : kg);

    const leave = () => { sDraft = null; show('profile'); renderTab(); };

    const head = el('div', 'w-head pm-head');
    const hl = el('div', 'w-left');
    hl.appendChild(el('div', 't-date', 'Shapes every block you build'));
    hl.appendChild(el('h1', 'pm-name-static', 'About you'));
    head.appendChild(hl);
    const close = el('button', 'w-chip', '✕');
    close.onclick = async () => {
      if (dirty() && !await appConfirm({
        title: 'Discard changes?',
        body: 'Nothing you have changed here has been saved yet.',
        ok: 'Discard', cancel: 'Keep editing', warn: true
      })) return;
      leave();
    };
    head.appendChild(close);
    root.appendChild(head);

    /* One block per answer. Rows with a switch stay locked until you turn
       them on, so scrolling past can never nudge a value — and off simply
       means "not set", which is also how you clear one. */
    const slide = (label, readout, node, hint, lock) => {
      const b = el('div', 'ab-row');
      const h = el('div', 'ab-head');
      h.appendChild(el('div', 'micro', label));
      if (readout) h.appendChild(readout);
      const body = el('div', 'ab-body' + (lock && !lock.on ? ' locked' : ''));
      body.appendChild(node);
      if (lock) {
        const sw = el('button', 'inj-sw sm' + (lock.on ? ' on' : ''));
        sw.appendChild(el('i', 'inj-knob'));
        sw.onclick = () => { lock.toggle(); haptic(); renderAbout(); };
        h.appendChild(sw);
      }
      b.appendChild(h);
      b.appendChild(body);
      if (hint) b.appendChild(el('div', 'ab-hint', hint));
      root.appendChild(b);
      return b;
    };
    const lockFor = (key, dflt) => ({
      on: pr[key] != null,
      toggle: () => { if (pr[key] != null) delete sDraft[key]; else sDraft[key] = dflt; }
    });

    // ---- choices ----
    const goalOut = el('div', 'ab-val' + (pr.goal ? '' : ' unset'),
      (GOALS.find(g => g.key === pr.goal) || {}).reps || 'not set');
    slide('Goal', goalOut,
      optionRail(GOALS.map(g => g.label), GOALS.findIndex(g => g.key === pr.goal), i => {
        sDraft.goal = GOALS[i].key;
        goalOut.textContent = GOALS[i].reps; goalOut.classList.remove('unset');
        goalHint.textContent = GOALS[i].note;
      }), null, lockFor('goal', GOALS[0].key));
    const goalHint = el('div', 'ab-hint', (GOALS.find(g => g.key === pr.goal) || {}).note
      || 'Sets the rep range a new block starts on');
    root.appendChild(goalHint);

    const lvOut = el('div', 'ab-val' + (pr.level ? '' : ' unset'),
      (LEVELS.find(l => l.key === pr.level) || {}).label || 'not set');
    slide('Experience', lvOut,
      optionRail(LEVELS.map(l => l.label), LEVELS.findIndex(l => l.key === pr.level), i => {
        sDraft.level = LEVELS[i].key;
        lvOut.textContent = LEVELS[i].label; lvOut.classList.remove('unset');
        lvHint.textContent = LEVELS[i].note;
      }), null, lockFor('level', LEVELS[0].key));
    const lvHint = el('div', 'ab-hint', (LEVELS.find(l => l.key === pr.level) || {}).note
      || 'How fast the weight should climb');
    root.appendChild(lvHint);

    slide('Sex', null,
      segToggle([['male', 'Male'], ['female', 'Female']], pr.sex || '',
        k => { sDraft.sex = k; renderAbout(); }, 'you-seg'),
      'Used for the body-fat estimate', lockFor('sex', 'male'));

    // ---- numbers, all on rulers ----
    const num = (key, label, unit, def, step, min, decimals, hint, every) => {
      const out = el('div', 'ab-val');
      let set = pr[key] != null;
      const paint = v => {
        out.textContent = (decimals ? v.toFixed(decimals) : String(v)) + ' ' + unit + (set ? '' : ' · not set');
        out.classList.toggle('unset', !set);
      };
      const start = set ? +pr[key] : def;
      paint(start);
      const r = rulerScale({
        value: start, step, tickW: every === 1 ? 34 : 30, span: 14, min,
        labelEvery: every || (decimals ? 2 : 5), majorEvery: decimals ? 2 : 5, decimals,
        dragOnly: true, cls: (decimals ? 'fine' : '') + (every === 1 ? ' dense' : ''),
        onChange: v => { set = true; paint(v); sDraft[key] = v; bfPaint(); }
      });
      slide(label, out, r.el, hint, lockFor(key, def));
    };
    num('sessionMins', 'Time per session', 'min', 60, 5, 15, 0, 'Each day gets a clock in the builder');
    num('age', 'Age', 'yrs', 30, 1, 12, 0, null, 1);

    if (dH() === 'ft') {
      const out = el('div', 'ab-val' + (pr.heightCm != null ? '' : ' unset'));
      let set = pr.heightCm != null;
      const paint = inch => {
        out.textContent = `${Math.floor(inch / 12)}'${Math.round(inch % 12)}"` + (set ? '' : ' · not set');
        out.classList.toggle('unset', !set);
      };
      const startIn = Math.round((set ? pr.heightCm : 175) / 2.54);
      paint(startIn);
      const r = rulerScale({
        value: startIn, step: 1, tickW: 34, span: 14, min: 40,
        labelEvery: 1, majorEvery: 6, cls: 'dense',
        fmt: v => `${Math.floor(v / 12)}'${v % 12}`,
        dragOnly: true,
        onChange: v => { set = true; paint(v); sDraft.heightCm = +(v * 2.54).toFixed(1); bfPaint(); }
      });
      slide('Height', out, r.el, null, lockFor('heightCm', 177.8));
    } else {
      num('heightCm', 'Height', 'cm', 175, 1, 100, 0, null, 1);
    }

    const tape = (key, label, defCm, hint) => {
      if (dH() !== 'ft') return num(key, label, 'cm', defCm, 0.5, 20, 1, hint);
      const out = el('div', 'ab-val' + (pr[key] != null ? '' : ' unset'));
      let set = pr[key] != null;
      const paint = inch => {
        out.textContent = inch.toFixed(1) + ' in' + (set ? '' : ' · not set');
        out.classList.toggle('unset', !set);
      };
      const start = +((set ? pr[key] : defCm) / 2.54).toFixed(1);
      paint(start);
      const r = rulerScale({
        value: start, step: 0.5, tickW: 30, span: 14, min: 8,
        labelEvery: 2, majorEvery: 2, decimals: 1, cls: 'fine', dragOnly: true,
        onChange: v => { set = true; paint(v); sDraft[key] = +(v * 2.54).toFixed(1); bfPaint(); }
      });
      slide(label, out, r.el, hint, lockFor(key, defCm));
    };
    tape('waistCm', 'Waist', 85, 'At the navel, tape level, breathe out');
    tape('neckCm', 'Neck', 38, 'Just below the Adam\'s apple');
    if (pr.sex === 'female') tape('hipCm', 'Hips', 95, 'Widest point');

    const bfEl = el('div', 'ab-bf');
    const bfPaint = () => {
      const bf = navyBodyFat(sDraft);
      if (bf) {
        bfEl.textContent = `Body fat ≈ ${bf}%  ·  tape beats the bathroom scale — watch the trend`;
      } else {
        const need = [['heightCm', 'height'], ['waistCm', 'waist'], ['neckCm', 'neck']]
          .concat(sDraft.sex === 'female' ? [['hipCm', 'hips']] : [])
          .filter(([k]) => sDraft[k] == null).map(([, n]) => n);
        bfEl.textContent = need.length ? 'Body fat needs ' + need.join(', ') : 'Body fat needs your sex set';
      }
      bfEl.classList.toggle('on', !!bf);
    };
    bfPaint();
    root.appendChild(bfEl);

    const acts = el('div', 'ab-acts');
    const discard = el('button', 'btn-ghost', 'Discard');
    discard.onclick = async () => {
      if (dirty() && !await appConfirm({
        title: 'Discard changes?',
        body: 'Nothing you have changed here has been saved yet.',
        ok: 'Discard', cancel: 'Keep editing', warn: true
      })) return;
      leave();
    };
    const save = el('button', 'btn-cta big', 'Save');
    save.onclick = () => {
      localStorage.setItem('profile', JSON.stringify(sDraft));
      haptic();
      leave();
    };
    acts.append(discard, save);
    root.appendChild(acts);
  }

  /* Settings — the app's own preferences. Placeholders for now: the rows are
     here so the shape is right, but none of them are wired to anything. */
  const PREF_ICON = {
    theme: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/>',
    units: '<path d="M3 9h18v6H3z"/><path d="M7 9v3M11 9v4M15 9v3M19 9v4"/>',
    bell: '<path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
    health: '<path d="M20.8 8.6a4.6 4.6 0 0 0-8.8-1.8 4.6 4.6 0 0 0-8.8 1.8c0 5 8.8 10.4 8.8 10.4s8.8-5.4 8.8-10.4z"/>',
    watch: '<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9.5 6V3.5h5V6M9.5 18v2.5h5V18"/>',
    link: '<path d="M10 13a4 4 0 0 0 5.7.4l2.6-2.6A4 4 0 1 0 12.6 5l-1.5 1.5"/><path d="M14 11a4 4 0 0 0-5.7-.4l-2.6 2.6A4 4 0 1 0 11.4 19l1.5-1.5"/>',
    export: '<path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M4 15v4h16v-4"/>',
    guide: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M8 8h7M8 12h5"/>',
    faq: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4"/><path d="M12 17.2h.01"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7.5 12 13l8.5-5.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.8v3.7l2.4 1.6M9.4 2.8h5.2"/>'
  };

  const PREF_GROUPS = [
    { title: 'Preferences', rows: [
      ['timer', 'Rest between sets', 'rest'],
      ['bell', 'Alert sound', 'sound'],
      ['theme', 'Theme'], ['units', 'Units', 'units']
    ] },
    { title: 'Apple', rows: [
      ['health', 'Apple Health'], ['watch', 'Apple Watch'], ['link', 'Integrations']
    ] },
    { title: 'Data', rows: [
      ['export', 'Export & import data']
    ] },
    { title: 'Guides', rows: [
      ['guide', 'Getting started'], ['guide', 'Routine help']
    ] },
    { title: 'Help', rows: [
      ['star', 'Rate in the App Store'], ['faq', 'Frequently asked questions'],
      ['mail', 'Contact'], ['info', 'About Rackside']
    ] }
  ];

  let prefOpen = null;
  function openPrefs() { prefOpen = null; show('prefs'); renderPrefs(); }

  function renderPrefs() {
    const root = $('#view-prefs');
    root.innerHTML = '';
    const head = el('div', 'w-head pm-head');
    const hl = el('div', 'w-left');
    hl.appendChild(el('div', 't-date', 'Rackside ' + APP_VERSION));
    hl.appendChild(el('h1', 'pm-name-static', 'Settings'));
    head.appendChild(hl);
    const close = el('button', 'w-chip', '✕');
    close.onclick = () => { show('profile'); renderTab(); };
    head.appendChild(close);
    root.appendChild(head);

    root.appendChild(el('div', 'coach-note',
      'Rest, alert sound and units work. The rest are placeholders for now — your other '
      + 'controls are the heart on Profile for About you, and the buttons under Body weight for backup.'));

    PREF_GROUPS.forEach(g => {
      root.appendChild(el('div', 'month-label', g.title));
      const list = el('div', 'pref-list');
      g.rows.forEach(([icon, label, live]) => {
        const r = el('div', 'pref-row' + (live ? ' on' : ''));
        const ic = el('span', 'pref-ic');
        ic.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" '
          + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + PREF_ICON[icon] + '</svg>';
        r.appendChild(ic);
        r.appendChild(el('span', 'pref-lbl', label));
        if (live === 'units') {
          r.appendChild(el('span', 'pref-val', wUnit() === 'lb' ? 'lb · ft' : 'kg · cm'));
          r.appendChild(el('span', 'pref-go' + (prefOpen === 'units' ? ' open' : ''), '›'));
          r.onclick = () => { prefOpen = prefOpen === 'units' ? null : 'units'; renderPrefs(); };
        } else if (live === 'rest') {
          r.appendChild(el('span', 'pref-val num', fmtClock(restDefault())));
          r.appendChild(el('span', 'pref-go' + (prefOpen === 'rest' ? ' open' : ''), '›'));
          r.onclick = () => { prefOpen = prefOpen === 'rest' ? null : 'rest'; renderPrefs(); };
        } else if (live === 'sound') {
          r.appendChild(el('span', 'pref-val', alertOf(alertKey()).label));
          r.appendChild(el('span', 'pref-go' + (prefOpen === 'sound' ? ' open' : ''), '›'));
          r.onclick = () => { prefOpen = prefOpen === 'sound' ? null : 'sound'; renderPrefs(); };
        } else {
          r.appendChild(el('span', 'pref-go', '›'));
        }
        list.appendChild(r);
        if (live === 'units' && prefOpen === 'units') {
          const panel = el('div', 'pref-panel');
          panel.appendChild(segToggle(
            [['metric', 'kg · cm'], ['imperial', 'lb · ft']],
            wUnit() === 'lb' ? 'imperial' : 'metric',
            k => {
              setProfile(k === 'imperial'
                ? { units: 'lb', hUnits: 'ft' }
                : { units: 'kg', hUnits: 'cm' });
              renderPrefs();
            }, 'you-seg'));
          panel.appendChild(el('div', 'ab-hint',
            'Weights, heights and the tape all follow this — nothing stored is rewritten.'));
          list.appendChild(panel);
        }
        if (live === 'sound' && prefOpen === 'sound') {
          const panel = el('div', 'pref-panel');
          const snd = el('div', 'snd-list');
          ALERTS.forEach(a => {
            const btn = el('button', 'snd-btn' + (a.key === alertKey() ? ' on' : ''));
            btn.appendChild(el('span', 'snd-name', a.label));
            btn.appendChild(svgIcon(PLAY, 10));
            /* tapping picks it and plays it — you cannot choose a sound you
               have not heard */
            btn.onclick = () => {
              setProfile({ alertSound: a.key });
              playAlert(a.key);
              haptic();
              snd.querySelectorAll('.snd-btn').forEach(x => x.classList.remove('on'));
              btn.classList.add('on');
              const val = r.querySelector('.pref-val');
              if (val) val.textContent = a.label;
            };
            snd.appendChild(btn);
          });
          panel.appendChild(snd);
          panel.appendChild(el('div', 'ab-hint',
            'Plays when a rest finishes and when a hold is done. Tap one to hear it.'));
          list.appendChild(panel);
        }
        if (live === 'rest' && prefOpen === 'rest') {
          const panel = el('div', 'pref-panel');
          const out = el('div', 'ab-val num', fmtClock(restDefault()));
          panel.appendChild(out);
          panel.appendChild(optionRail(REST_LENS.map(fmtClock),
            Math.max(0, REST_LENS.indexOf(restDefault())),
            i => {
              setProfile({ restSec: REST_LENS[i] });
              out.textContent = fmtClock(REST_LENS[i]);
              const val = r.querySelector('.pref-val');
              if (val) val.textContent = fmtClock(REST_LENS[i]);
            }, 74));
          panel.appendChild(el('div', 'ab-hint',
            'Every set in a new session starts its rest here. During training you '
            + 'can only nudge it by 15 seconds, so the clock cannot be reset by accident.'));
          list.appendChild(panel);
        }
      });
      root.appendChild(list);
    });
  }

  /* ============================================================
     PROFILE (overview + data controls)
     ============================================================ */
  async function renderProfile() {
    const root = $('#view-profile');
    root.innerHTML = '';
    const workouts = (await DB.all('workouts')).sort((a, b) => a.ts - b.ts);

    const head = el('header', 't-head');
    const hl = el('div');
    hl.appendChild(el('div', 't-date', (workouts.length
      ? 'Training since ' + dateOf(workouts[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Rackside') + ' · ' + APP_VERSION));
    hl.appendChild(el('h1', 't-title', 'Profile'));
    head.appendChild(hl);
    const acts = el('div', 'head-acts');
    const heart = el('button', 'gear-btn');
    heart.title = 'About you';
    heart.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" '
      + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M20.8 8.6a4.6 4.6 0 0 0-8.8-1.8 4.6 4.6 0 0 0-8.8 1.8c0 5 8.8 10.4 8.8 10.4s8.8-5.4 8.8-10.4z"/></svg>';
    heart.onclick = () => openAbout();
    acts.appendChild(heart);
    const gear = el('button', 'gear-btn');
    gear.title = 'Settings';
    gear.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" '
      + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
      + '<circle cx="12" cy="12" r="3.2"/>'
      + '<path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>';
    gear.onclick = () => openPrefs();
    acts.appendChild(gear);
    head.appendChild(acts);
    root.appendChild(head);

    // lifetime stats
    const totVol = workouts.reduce((a, w) => a + (w.volume || 0), 0);
    const totPRs = workouts.reduce((a, w) => a + ((w.prs || []).length), 0);
    const totMin = workouts.reduce((a, w) => a + (w.duration || 0), 0);
    const grid = el('div', 'sum-grid');
    grid.appendChild(sumCard(String(workouts.length), 'Sessions'));
    grid.appendChild(sumCard(fmtW(totVol), 'Lifetime volume'));
    grid.appendChild(sumCard(totMin + ' min', 'Time trained'));
    const prC = sumCard(String(totPRs), 'Records');
    prC.classList.add('hl');
    grid.appendChild(prC);
    root.appendChild(grid);

    // preferred training days
    const plan = activePlan();
    if (plan) {
      root.appendChild(el('div', 'month-label', 'Preferred training days'));
      const pc = el('div', 'card');
      const strip = el('div', 'day-strip');
      plan.prefDays = plan.prefDays || [];
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((ch, i) => {
        const cell = el('button', 'cell' + (plan.prefDays.includes(i) ? ' today pref' : ''));
        cell.type = 'button';
        cell.appendChild(el('span', null, ch));
        cell.appendChild(el('i'));
        cell.onclick = async () => {
          plan.prefDays = plan.prefDays.includes(i)
            ? plan.prefDays.filter(x => x !== i)
            : [...plan.prefDays, i].sort((a, b) => a - b);
          await DB.put('plans', plan);
          renderProfile();
        };
        strip.appendChild(cell);
      });
      pc.appendChild(strip);
      const ph = el('div', 'hist-meta');
      ph.style.marginTop = '10px';
      ph.textContent = `${plan.prefDays.length} of ${(plan.days || []).length} training days picked — they show as rings on the Today week strip.`;
      pc.appendChild(ph);
      root.appendChild(pc);
    }

    // body weight — v5: big reading, fine sliding scale, trend, log button
    root.appendChild(el('div', 'month-label', 'Body weight'));
    const bw = (await DB.all('bodyweight')).sort((a, b) => a.ts - b.ts);
    const lastBw = bw[bw.length - 1];
    const loggedToday = !!bw.find(x => x.date === todayStr());
    const bwCard = el('div', 'card bwv-card');

    const bwHead = el('div', 'bwv-head');
    bwHead.appendChild(el('div', 'micro', "Today's reading"));
    bwCard.appendChild(bwHead);

    let bwv = lastBw ? lastBw.kg : 80;          // always kilos underneath
    const read = el('div', 'bwv-read');
    const rv = el('div', 'bwv-val num', toW(bwv).toFixed(1));
    rv.appendChild(el('small', null, ' ' + wUnit()));
    read.appendChild(rv);
    const dEl = el('div', 'bwv-delta num');
    read.appendChild(dEl);
    bwCard.appendChild(read);

    let logBtn;
    const updDelta = () => {
      if (!lastBw) { dEl.textContent = ''; return; }
      const d = +(bwv - lastBw.kg).toFixed(3);
      dEl.className = 'bwv-delta num ' + (d < 0 ? 'down' : d > 0 ? 'up' : 'same');
      dEl.textContent = d === 0 ? 'Same as last'
        : `${d > 0 ? '+' : '−'}${Math.abs(toW(d)).toFixed(1)} ${wUnit()}`;
    };
    const commitBw = shown => {
      bwv = fromW(shown);
      rv.firstChild.nodeValue = shown.toFixed(1);
      updDelta();
    };
    updDelta();

    // the scale runs in your unit; a notch is 0.5 kg or 1 lb
    const bwRuler = rulerScale({
      value: +toW(bwv).toFixed(1), step: wStep(), tickW: 30, span: 14, min: toW(20),
      labelEvery: 2, majorEvery: 2, decimals: 1, cls: 'fine',
      dragOnly: true, onChange: commitBw
    });
    /* no tap-to-set here: the reading only moves if you actually swipe it,
       so brushing the card on the way past leaves it alone — and the hint
       says so, or a tap that does nothing just reads as broken */
    bwCard.appendChild(bwRuler.el);
    bwCard.appendChild(el('div', 'bwv-hint', 'Swipe the scale to adjust'));

    // 30-day trend
    {
      let pts = bw.filter(e => Date.now() - e.ts < 30 * 86400000);
      if (pts.length < 2) pts = bw;
      if (pts.length >= 2) {
        const tHead = el('div', 'bwv-head');
        tHead.appendChild(el('div', 'micro', 'Trend · 30 days'));
        const td = +(pts[pts.length - 1].kg - pts[0].kg).toFixed(1);
        tHead.appendChild(el('div', 'micro trend-d', `${td > 0 ? '+' : td < 0 ? '−' : ''}${Math.abs(td).toFixed(1)} kg`));
        tHead.style.marginTop = '6px';
        bwCard.appendChild(tHead);
        const wrap = el('div', 'bw-graph');
        wrap.innerHTML = bwGraphSVG(pts);
        bwCard.appendChild(wrap);
      }
    }

    logBtn = el('button', 'bwv-log' + (loggedToday ? ' logged' : ''));
    logBtn.appendChild(el('span', null, loggedToday ? 'Update today' : 'Log weight'));
    logBtn.onclick = async () => {
      if (!(bwv > 20)) return;
      const today = bw.find(x => x.date === todayStr());
      await DB.put('bodyweight', today
        ? { ...today, kg: bwv, ts: Date.now() }
        : { id: DB.uid(), date: todayStr(), kg: bwv, ts: Date.now() });
      renderProfile();
    };
    bwCard.appendChild(logBtn);
    root.appendChild(bwCard);

    // data controls
    root.appendChild(el('div', 'month-label', 'Data & backup'));
    const dc = el('div', 'card');
    const bk = el('button', 'btn-lime', 'Back up now');
    bk.style.cssText = 'width:100%';
    bk.onclick = backupData;
    dc.appendChild(bk);
    const lbTs = Number(localStorage.getItem('lastBackup')) || 0;
    const hint = el('div', 'hist-meta');
    hint.style.margin = '8px 0 12px';
    hint.textContent = (lbTs ? `Last backup ${new Date(lbTs).toLocaleDateString('en-GB')} · ` : 'Never backed up · ')
      + 'in the share sheet choose "Save to Files" → iCloud Drive. Do it monthly — a reminder appears on Today. Photos/videos you attached are not included.';
    dc.appendChild(hint);
    const report = el('button', 'btn-ghost', 'Report for Claude');
    report.style.cssText = 'width:100%;margin-bottom:10px;color:var(--lime);border-color:var(--lime-border)';
    report.onclick = shareReport;
    dc.appendChild(report);
    const rHint = el('div', 'hist-meta');
    rHint.style.margin = '0 0 12px';
    rHint.textContent = 'Builds a text summary of your program, sessions, times, how they felt, and current numbers — share it into a Claude chat to plan your next block.';
    dc.appendChild(rHint);
    const restoreBtn = el('button', 'btn-ghost', 'Restore from backup');
    restoreBtn.style.cssText = 'width:100%;margin-bottom:10px';
    const fileIn = document.createElement('input');
    fileIn.type = 'file';
    fileIn.accept = 'application/json,.json';
    fileIn.style.display = 'none';
    fileIn.onchange = () => { if (fileIn.files[0]) restoreData(fileIn.files[0]); fileIn.value = ''; };
    restoreBtn.onclick = () => fileIn.click();
    dc.appendChild(restoreBtn);
    dc.appendChild(fileIn);
    const reset = el('button', 'btn-ghost', 'Reset training history');
    reset.style.cssText = 'width:100%;color:var(--amber);border-color:var(--amber-border)';
    reset.onclick = resetHistory;
    dc.appendChild(reset);
    root.appendChild(dc);

    // about
    const about = el('div', 'coach-note');
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    about.innerHTML = '<b>Rackside ' + APP_VERSION + ' ·</b> Local-first training app. Everything is stored on this iPhone — no account, no cloud, works offline in the gym. '
      + (standalone ? 'Running as an installed app.' : 'Running in the browser — install via Share → Add to Home Screen.');
    root.appendChild(about);
  }

  /* ---------------- body weight line graph (inline SVG) ---------------- */
  /* Smooth line through the points — a monotone cubic (Fritsch–Carlson).
     Tangents are scaled by each gap's own width, so unevenly spaced dates
     cannot throw a control point past the next reading, and a tangent is
     flattened wherever the direction changes, so the curve never rises
     above a peak or dips below a trough that never happened. */
  function smoothPath(P) {
    const f = n => n.toFixed(1);
    const n = P.length;
    if (n < 3) return P.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join(' ');
    const dx = [], slope = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = P[i + 1][0] - P[i][0];
      slope[i] = dx[i] ? (P[i + 1][1] - P[i][1]) / dx[i] : 0;
    }
    const m = [slope[0]];
    for (let i = 1; i < n - 1; i++) {
      if (slope[i - 1] * slope[i] <= 0) m[i] = 0;          // a turn: level it off
      else {
        const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
        m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
      }
    }
    m[n - 1] = slope[n - 2];
    let d = 'M' + f(P[0][0]) + ' ' + f(P[0][1]);
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += ' C' + f(P[i][0] + h) + ' ' + f(P[i][1] + m[i] * h)
         + ' ' + f(P[i + 1][0] - h) + ' ' + f(P[i + 1][1] - m[i + 1] * h)
         + ' ' + f(P[i + 1][0]) + ' ' + f(P[i + 1][1]);
    }
    return d;
  }

  function bwGraphSVG(entries) {
    const W = 320, H = 116, padL = 34, padR = 12, padT = 10, padB = 20;
    const x0 = entries[0].ts, x1 = entries[entries.length - 1].ts;
    let lo = Math.min(...entries.map(e => e.kg));
    let hi = Math.max(...entries.map(e => e.kg));
    if (hi - lo < 1) { const m = (hi + lo) / 2; lo = m - 0.6; hi = m + 0.6; }
    const X = t => padL + (t - x0) / Math.max(x1 - x0, 1) * (W - padL - padR);
    const Y = v => padT + (hi - v) / (hi - lo) * (H - padT - padB);
    const P = entries.map(e => [X(e.ts), Y(e.kg)]);
    const line = smoothPath(P);
    const area = line + ` L${P[P.length - 1][0].toFixed(1)} ${(H - padB).toFixed(1)} L${P[0][0].toFixed(1)} ${(H - padB).toFixed(1)} Z`;
    const fmtD = ts => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const grid = [hi, (hi + lo) / 2, lo].map(v =>
      `<line x1="${padL}" y1="${Y(v).toFixed(1)}" x2="${W - padR}" y2="${Y(v).toFixed(1)}" stroke="rgba(255,255,255,.06)" stroke-width="1"/>` +
      `<text x="${padL - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end" fill="#6A625A" font-size="9" font-family="Archivo, sans-serif">${(Math.round(v * 10) / 10)}</text>`
    ).join('');
    const dots = P.map((p, i) =>
      `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === P.length - 1 ? 4 : 3}" fill="#CE6B3D" stroke="#151110" stroke-width="2"/>`
    ).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;margin-top:12px" role="img" aria-label="Body weight over time">
      ${grid}
      <path d="${area}" fill="rgba(206,107,61,.12)"/>
      <path d="${line}" fill="none" stroke="#CE6B3D" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      <text x="${padL}" y="${H - 6}" fill="#6A625A" font-size="9" font-family="Archivo, sans-serif">${fmtD(x0)}</text>
      <text x="${W - padR}" y="${H - 6}" text-anchor="end" fill="#6A625A" font-size="9" font-family="Archivo, sans-serif">${fmtD(x1)}</text>
    </svg>`;
  }

  /* ---------------- training report (to hand to Claude) ---------------- */
  async function shareReport() {
    const [workouts, sessions, allExs] = await Promise.all([
      DB.all('workouts'), DB.all('sessions'), DB.all('exercises')
    ]);
    const exName = id => (allExs.find(e => e.id === id) || {}).name || 'Unknown';
    const plan = activePlan();
    const L = [];
    L.push(`RACKSIDE TRAINING REPORT — ${todayStr()}`);
    if (plan) {
      const w = plan.startDate ? weekOf(plan) : 0;
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      L.push(`Program: ${plan.name} · ${plan.weeks || 4} weeks · week ${w || '-'} · ` +
        `${(plan.days || []).length} days/week (${(plan.prefDays || []).map(i => days[i]).join('/') || 'no set days'})`);
      for (const d of (plan.days || [])) {
        L.push(`  ${d.name}: ` + d.items.map(it =>
          `${exName(it.exerciseId)} ${it.sets}×${it.repLo}-${it.repHi}`).join(', '));
      }
    }
    const ws = workouts.sort((a, b) => b.ts - a.ts).slice(0, 15);
    L.push('');
    L.push(`SESSIONS (${workouts.length} total, latest ${ws.length}):`);
    for (const w of ws) {
      L.push(`${w.date} · ${w.name} · ${w.duration} min · ${fmtW(w.volume)} volume` +
        (w.feel ? ` · felt: ${w.feel}` : '') +
        (w.prs && w.prs.length ? ` · ${w.prs.length} PR` : ''));
      const sess = sessions.filter(s => s.date === w.date && s.planId === w.planId);
      for (const s of sess) {
        L.push(`  - ${exName(s.exerciseId)}: ` +
          s.sets.map(x => x.weight ? `${fmtWn(x.weight)}×${x.reps}` : `${x.reps} reps`).join(', ') +
          (s.feel ? ` · felt ${s.feel}` : ''));
      }
    }
    // current strength numbers
    const byEx = new Map();
    for (const s of sessions) {
      const arr = byEx.get(s.exerciseId) || [];
      arr.push(s);
      byEx.set(s.exerciseId, arr);
    }
    L.push('');
    L.push('CURRENT NUMBERS (last working weight · best est. 1RM):');
    for (const [id, arr] of byEx) {
      arr.sort((a, b) => b.ts - a.ts);
      const lastKg = Math.max(...arr[0].sets.map(x => x.weight || 0));
      const best = Math.round(Math.max(...arr.flatMap(s2 => s2.sets.map(x => est1RM(x.weight || 0, x.reps)))));
      if (lastKg > 0) L.push(`- ${exName(id)}: ${fmtW(lastKg)} · est 1RM ${fmtW(best)}`);
    }
    const bws = (await DB.all('bodyweight')).sort((a, b) => a.ts - b.ts);
    if (bws.length) {
      const lastB = bws[bws.length - 1];
      const pastB = [...bws].reverse().find(x => lastB.ts - x.ts >= 25 * 86400000);
      L.push('');
      L.push(`BODY WEIGHT: ${fmtW(lastB.kg)} (${lastB.date})` +
        (pastB ? ` · ${(lastB.kg - pastB.kg >= 0 ? '+' : '')}${(lastB.kg - pastB.kg).toFixed(1)} kg over ~30 days` : ''));
    }
    const cds = (await DB.all('cardio')).sort((a, b) => b.ts - a.ts).slice(0, 12);
    if (cds.length) {
      L.push('');
      L.push('CARDIO (latest):');
      for (const c of cds) L.push(`- ${c.date} · ${c.activity}${c.env ? ' (' + c.env + ')' : ''} · ${c.minutes} min · ${c.calories} kcal`);
    }
    {
      const pr = getProfile();
      const g = GOALS.find(x => x.key === pr.goal), lv = LEVELS.find(x => x.key === pr.level);
      const bits = [];
      if (g) bits.push('goal: ' + g.label.toLowerCase());
      if (lv) bits.push('training ' + lv.label.toLowerCase());
      if (pr.sessionMins) bits.push(pr.sessionMins + ' min per session');
      if (pr.age) bits.push(pr.age + ' yrs');
      if (pr.sex) bits.push(pr.sex);
      if (pr.heightCm) bits.push(pr.heightCm + ' cm');
      const bf = navyBodyFat(pr);
      if (bf) bits.push('~' + bf + '% body fat (tape estimate)');
      if (bits.length) { L.push(''); L.push('ABOUT ME: ' + bits.join(' · ')); }
    }
    const injOnNow = injEnabled() ? INJURIES.filter(i => getInjuries().has(i.key)) : [];
    if (injOnNow.length) {
      const avoiding = [...new Set(injOnNow.flatMap(i => i.avoid))];
      L.push('');
      L.push('INJURIES: ' + injOnNow.map(i => i.label).join(', '));
      L.push('MOVEMENTS TO AVOID: ' + avoiding.join(', '));
      L.push('(Please substitute rather than remove — keep every movement pattern covered.)');
    }
    {
      const own = getEquip();
      const missing = (window.EQUIPMENT || []).filter(q => !q.always && !own.has(q.key)).map(q => q.label);
      if (missing.length) { L.push(''); L.push('NO ACCESS TO: ' + missing.join(', ')); }
    }
    L.push('');
    L.push('Please review this training history and plan my next block accordingly (same weekly frequency unless you advise otherwise).');
    const text = L.join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Rackside training report', text });
      else { await navigator.clipboard.writeText(text); alert('Report copied to clipboard — paste it to Claude.'); }
    } catch { /* share sheet dismissed */ }
  }

  /* ---------------- backup / restore / reset ---------------- */
  async function backupData() {
    const [exs, pls, sess, wks, bws, cds] = await Promise.all([
      DB.all('exercises'), DB.all('plans'), DB.all('sessions'), DB.all('workouts'),
      DB.all('bodyweight'), DB.all('cardio')
    ]);
    const payload = {
      app: 'rackside', version: 5, exportedAt: new Date().toISOString(),
      exercises: exs, plans: pls, sessions: sess, workouts: wks, bodyweight: bws, cardio: cds,
      injuries: [...getInjuries()], injuriesOn: injEnabled(), equip: [...getEquip()],
      profile: getProfile()
    };
    const file = new File([JSON.stringify(payload)], `rackside-backup-${todayStr()}.json`, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Rackside backup' });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
      }
      localStorage.setItem('lastBackup', String(Date.now()));
      renderTab();
    } catch (e) { /* user cancelled the share sheet */ }
  }

  async function restoreData(fileBlob) {
    let data;
    try { data = JSON.parse(await fileBlob.text()); } catch { alert('That file is not a Rackside backup.'); return; }
    if (!data || data.app !== 'rackside') { alert('That file is not a Rackside backup.'); return; }
    if (!confirm('Restore this backup? Records with the same id are overwritten; nothing else is deleted.')) return;
    let n = 0;
    for (const [store, key] of [['exercises', 'exercises'], ['plans', 'plans'], ['sessions', 'sessions'], ['workouts', 'workouts'], ['bodyweight', 'bodyweight'], ['cardio', 'cardio']]) {
      for (const rec of (data[key] || [])) {
        if (rec && rec.id) { await DB.put(store, rec); n++; }
      }
    }
    if (Array.isArray(data.injuries)) setInjuries(new Set(data.injuries));
    if (typeof data.injuriesOn === 'boolean') localStorage.setItem('injuriesOn', data.injuriesOn ? '1' : '0');
    if (Array.isArray(data.equip)) setEquip(new Set(data.equip));
    if (data.profile && typeof data.profile === 'object') localStorage.setItem('profile', JSON.stringify(data.profile));
    alert(`Restored ${n} records from ${data.exportedAt ? data.exportedAt.slice(0, 10) : 'backup'}.`);
    renderTab();
  }

  async function resetHistory() {
    if (!confirm('Delete ALL logged workouts and sets?\n\nYour exercises and your block stay — only the training history and week progress are wiped.')) return;
    for (const s of await DB.all('sessions')) await DB.del('sessions', s.id);
    for (const w of await DB.all('workouts')) await DB.del('workouts', w.id);
    for (const p of await DB.all('plans')) {
      p.startDate = null; p.completed = []; p.finishedAt = null;
      for (const d of (p.days || [])) for (const it of d.items) it.kg = 0;
      await DB.put('plans', p);
    }
    live.set(null);
    stopRest();
    renderTab();
  }

  function agoDays(ds) {
    if (ds === todayStr()) return 'today';
    const n = Math.floor((dateOf(todayStr()).getTime() - dateOf(ds).getTime()) / 86400000);
    return n <= 1 ? 'yesterday' : n + ' days ago';
  }

  /* ============================================================
     STATS
     ============================================================ */
  async function renderStats() {
    const root = $('#view-stats');
    root.innerHTML = '';
    const [sessions, workoutsRaw, bw] = await Promise.all([
      DB.all('sessions'), DB.all('workouts'), DB.all('bodyweight')
    ]);
    const workouts = workoutsRaw.sort((a, b) => b.ts - a.ts);   // newest first
    const plan = activePlan();

    const head = el('header', 't-head');
    const hl = el('div');
    hl.appendChild(el('div', 't-date', `${workouts.length} session${workouts.length === 1 ? '' : 's'} logged`));
    hl.appendChild(el('h1', 't-title', 'Progress'));
    head.appendChild(hl);
    root.appendChild(head);

    if (!sessions.length) {
      const emp = el('div', 'empty-state');
      emp.appendChild(el('p', null, 'Log workouts and your progress appears here.'));
      root.appendChild(emp);
      return;
    }

    // baseline numbers
    const totVol = workouts.reduce((a, w) => a + (w.volume || 0), 0);
    const totPRs = workouts.reduce((a, w) => a + ((w.prs && w.prs.length) || 0), 0);
    const base = el('div', 'base-row');
    const bs = (v, l, cls) => {
      const d = el('div', 'base-stat' + (cls ? ' ' + cls : ''));
      d.appendChild(el('div', 'v num', v));
      d.appendChild(el('div', 'l', l));
      return d;
    };
    base.appendChild(bs(String(workouts.length), 'Sessions'));
    base.appendChild(bs(fmtWn(totVol), wUnit() + ' lifted'));
    base.appendChild(bs(weekStreak(workouts) + 'w', 'Streak'));
    base.appendChild(bs(String(totPRs), 'Records', 'earn'));
    root.appendChild(base);

    // ---- four summary graphs: volume, time, sets, body weight ----
    {
      const weeksN = 8;
      const nowD = new Date();
      const dow0 = (nowD.getDay() + 6) % 7;
      const mon = new Date(nowD); mon.setDate(nowD.getDate() - dow0); mon.setHours(0, 0, 0, 0);
      const wk = Array.from({ length: weeksN }, (_, i) => {
        const ws = new Date(mon.getTime() - (weeksN - 1 - i) * 7 * 86400000);
        const we = new Date(ws.getTime() + 7 * 86400000);
        const inWk = workouts.filter(w => { const d = dateOf(w.date); return d >= ws && d < we; });
        return {
          vol: inWk.reduce((a, w) => a + (w.volume || 0), 0),
          min: inWk.reduce((a, w) => a + (w.duration || 0), 0),
          sets: inWk.reduce((a, w) => a + (w.sets || 0), 0)
        };
      });
      const tile = (label, series, val, delta) => {
        const cell = el('div', 'sg-cell');
        cell.appendChild(el('div', 'sg-name', label));
        const row = el('div', 'sg-valrow');
        row.appendChild(el('span', 'sg-val num', val));
        if (delta) row.appendChild(el('span', 'sg-d num' + (delta.startsWith('+') ? ' up' : ' down'), delta));
        cell.appendChild(row);
        const g = el('div', 'sg-graph');
        g.innerHTML = sparkSVG(series, 150, 54);
        cell.appendChild(g);
        return cell;
      };
      const dTxt = (cur, prev, unit) => {
        const d = Math.round((cur - prev) * 10) / 10;
        return prev > 0 && d !== 0 ? `${d > 0 ? '+' : '−'}${Math.abs(d)}${unit}` : '';
      };
      const grid = el('div', 'stat-graphs');
      const cur = wk[weeksN - 1], prev = wk[weeksN - 2];
      grid.appendChild(tile('Volume · ' + wUnit() + ' / week', wk.map(x => toW(x.vol)), fmtWn(cur.vol), dTxt(cur.vol, prev.vol, '')));
      const hoursTot = Math.round(workouts.reduce((a, w) => a + (w.duration || 0), 0) / 6) / 10;
      grid.appendChild(tile(`Time · ${hoursTot} h total`, wk.map(x => x.min), cur.min + ' min', dTxt(cur.min, prev.min, 'm')));
      grid.appendChild(tile('Sets · per week', wk.map(x => x.sets), String(cur.sets), dTxt(cur.sets, prev.sets, '')));
      if (bw.length >= 2) {
        const sorted = [...bw].sort((a, b) => a.ts - b.ts);
        const last = sorted[sorted.length - 1];
        const past = sorted.filter(x => last.ts - x.ts >= 25 * 86400000).pop() || sorted[0];
        grid.appendChild(tile('Body weight · ' + wUnit(), sorted.slice(-12).map(x => x.kg),
          last.kg.toFixed(1), dTxt(last.kg, past.kg, '')));
      }
      root.appendChild(el('div', 'micro', 'Last 8 weeks'));
      root.appendChild(grid);
    }

    // ---- consistency: last 8 weeks vs the plan ----
    const target = plan && plan.days ? plan.days.length : 3;
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now); monday.setDate(now.getDate() - dow); monday.setHours(0, 0, 0, 0);
    const weeksN = 8;
    const counts = Array.from({ length: weeksN }, (_, i) => {
      const ws = new Date(monday.getTime() - (weeksN - 1 - i) * 7 * 86400000);
      const we = new Date(ws.getTime() + 7 * 86400000);
      return workouts.filter(w => { const d = dateOf(w.date); return d >= ws && d < we; }).length;
    });
    root.appendChild(el('div', 'micro', `Consistency · target ${target}× / week`));
    const cg = el('div', 'cons-grid');
    counts.forEach((n, i) => {
      const col = el('div', 'cons-col' + (i === weeksN - 1 ? ' cur' : ''));
      const dots = el('div', 'cons-dots');
      for (let k = Math.max(target, n) - 1; k >= 0; k--) {
        dots.appendChild(el('i', k < n ? 'on' : ''));
      }
      col.appendChild(dots);
      col.appendChild(el('span', 'num', i === weeksN - 1 ? 'now' : `-${weeksN - 1 - i}w`));
      cg.appendChild(col);
    });
    root.appendChild(cg);

    // ---- last session vs the one before ----
    if (workouts.length >= 2) {
      const last = workouts[0];
      const prev = workouts.find(x => x.name === last.name && x.id !== last.id);
      if (prev) {
        root.appendChild(el('div', 'micro', `Last ${last.name} vs previous`));
        const c2 = el('div', 'cmp-flat');
        const g = el('div', 'cmp-grid');
        ['Exercise', 'Best set', 'Volume', 'Δ'].forEach(t => g.appendChild(el('div', 'h', t)));
        const lastSess = sessions.filter(s2 => s2.date === last.date && s2.planId === last.planId);
        const prevSess = sessions.filter(s2 => s2.date === prev.date && s2.planId === prev.planId);
        for (const s2 of lastSess.slice(0, 6)) {
          const ex = exercises.find(e => e.id === s2.exerciseId);
          const best = s2.sets.reduce((a, x) => (x.weight || 0) > (a.weight || 0) ? x : a, s2.sets[0]);
          const vol = s2.sets.reduce((a, x) => a + (x.weight || 0) * x.reps, 0);
          const pv = prevSess.find(x => x.exerciseId === s2.exerciseId);
          const pvol = pv ? pv.sets.reduce((a, x) => a + (x.weight || 0) * x.reps, 0) : null;
          g.appendChild(el('div', 'c name', ex ? ex.name : '—'));
          g.appendChild(el('div', 'c best num', best.weight ? `${fmtWn(best.weight)} × ${best.reps}` : `${best.reps} reps`));
          g.appendChild(el('div', 'c vol num', fmtWn(vol)));
          const d = pvol !== null && pvol > 0 ? Math.round((vol - pvol) / pvol * 100) : null;
          g.appendChild(el('div', 'c delta num' + (d === null || d === 0 ? ' none' : ''), d === null ? '—' : (d > 0 ? '+' + d + '%' : d + '%')));
        }
        c2.appendChild(g);
        root.appendChild(c2);
      }
    }

    // ---- recent records ----
    const prList = [];
    for (const w of [...workouts].sort((a, b) => b.ts - a.ts)) {
      for (const p of (w.prs || [])) prList.push({ date: w.date, ...p });
      if (prList.length >= 6) break;
    }
    if (prList.length) {
      root.appendChild(el('div', 'micro', 'Recent records'));
      const pl = el('div', 'pr-list');
      for (const p of prList.slice(0, 6)) {
        const r = el('div', 'pr-row');
        r.appendChild(el('div', 'pr-date', dateOf(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })));
        r.appendChild(el('div', 'pr-name', p.name));
        r.appendChild(el('div', 'pr-jump num', `${p.before} → ${p.after} kg`));
        pl.appendChild(r);
      }
      root.appendChild(pl);
    }

  }

  /* compact trend graph for the stat tiles */
  function sparkSVG(vals, w = 68, h = 24) {
    if (vals.length < 2) {
      return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block">` +
        `<circle cx="${w - 6}" cy="${h / 2}" r="3" fill="#CE6B3D"/></svg>`;
    }
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const X = i => 3 + i / (vals.length - 1) * (w - 10);
    const Y = v => hi === lo ? h / 2 : 4 + (hi - v) / (hi - lo) * (h - 10);
    const d = smoothPath(vals.map((v, i) => [X(i), Y(v)]));
    const area = d + ` L${X(vals.length - 1).toFixed(1)} ${h - 2} L${X(0).toFixed(1)} ${h - 2} Z`;
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block">` +
      `<path d="${area}" fill="rgba(206,107,61,.12)"/>` +
      `<path d="${d}" fill="none" stroke="#CE6B3D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${X(vals.length - 1).toFixed(1)}" cy="${Y(vals[vals.length - 1]).toFixed(1)}" r="3" fill="#CE6B3D" stroke="#151110" stroke-width="1.5"/></svg>`;
  }

  /* ============================================================
     PLAN MAKER — three wheels: sets, exercise, reps
     ============================================================ */
  const PM_SETS = Array.from({ length: 20 }, (_, i) => i + 1);
  /* how long the block runs before it is done with you — the deload, if you
     want one, is a week on top of these */
  const PM_WEEKS = [3, 4, 5, 6, 8, 10, 12];
  const PM_REPS = [
    { label: '5–8', lo: 5, hi: 8 },
    { label: '6–10', lo: 6, hi: 10 },
    { label: '8–10', lo: 8, hi: 10 },
    { label: '8–12', lo: 8, hi: 12 },
    { label: '10–12', lo: 10, hi: 12 },
    { label: '12–15', lo: 12, hi: 15 },
    { label: '15–20', lo: 15, hi: 20 },
    { label: '20–30', lo: 20, hi: 30 }
  ];
  let pmDays = null, pmDay = 0, pmSets = 2, pmEx = 0, pmReps = 2, pmName = '';
  let pmInj = 0, pmGroup = 'All', pmQuery = '', pmKitOpen = false;
  /* a fifth, lighter week on the end of the block — on by default, because a
     four-week block run flat out is where people stall */
  let pmDeload = true, pmWeeks = 4;

  /* Injury log — each area rules out the movements that load it, never a list
     of exercise names. Anything tagged in js/library.js is covered the moment
     it exists, including exercises added later. */
  const INJURIES = [
    { key: 'back', label: 'Lower back', avoid: ['spineload', 'hinge', 'spineflex', 'spinerot'] },
    { key: 'shoulder', label: 'Shoulder', avoid: ['overhead', 'shoulder'] },
    { key: 'knee', label: 'Knee', avoid: ['knee', 'impact'] },
    { key: 'elbow', label: 'Elbow', avoid: ['elbow'] },
    { key: 'wrist', label: 'Wrist', avoid: ['wrist'] },
    { key: 'neck', label: 'Neck', avoid: ['neck', 'spineflex'] },
    { key: 'hip', label: 'Hip', avoid: ['hip', 'hinge'] },
    { key: 'ankle', label: 'Ankle', avoid: ['ankle', 'impact'] }
  ];
  const getInjuries = () => {
    try { return new Set(JSON.parse(localStorage.getItem('injuries') || '[]')); } catch { return new Set(); }
  };
  const setInjuries = set => localStorage.setItem('injuries', JSON.stringify([...set]));
  /* master switch — with the log off nothing is hidden and the dial sits frozen */
  const injEnabled = () => localStorage.getItem('injuriesOn') === '1';

  /* Equipment — the kit you own. Everything is on until you say otherwise,
     and bodyweight can never be switched off. */
  const equipKeys = () => (window.EQUIPMENT || []).map(q => q.key);
  function getEquip() {
    const raw = localStorage.getItem('equip');
    if (raw === null) return new Set(equipKeys());
    try {
      const s = new Set(JSON.parse(raw));
      (window.EQUIPMENT || []).forEach(q => { if (q.always) s.add(q.key); });
      return s;
    } catch { return new Set(equipKeys()); }
  }
  const setEquip = set => localStorage.setItem('equip', JSON.stringify([...set]));
  function equipOf(ex) {
    const name = typeof ex === 'string' ? ex : ex.name;
    const m = (window.EXERCISE_EQUIP || {})[name];
    if (m) return m;
    for (const [re, kit] of (window.EQUIP_INFER || [])) if (re.test(name)) return kit;
    return ['bodyweight'];
  }
  const equipOK = ex => {
    const own = getEquip();
    return equipOf(ex).every(k => own.has(k));
  };

  /* What an exercise is: [pattern, ...stress tags]. Mapped first, then read
     from the name, then from the muscle group — so nothing slips through
     untagged just because it was typed in by hand. */
  function moveOf(ex) {
    const name = typeof ex === 'string' ? ex : ex.name;
    const group = typeof ex === 'string' ? null : ex.group;
    const m = (window.MOVEMENTS || {})[name];
    if (m) return m;
    for (const [re, tags] of (window.MOVE_INFER || [])) if (re.test(name)) return tags;
    return (window.MOVE_BY_GROUP || {})[group] || ['other'];
  }
  const patternOf = ex => moveOf(ex)[0];
  const stressOf = ex => moveOf(ex).slice(1);

  function injuryTags() {
    const t = new Set();
    if (!injEnabled()) return t;
    const on = getInjuries();
    INJURIES.forEach(i => { if (on.has(i.key)) i.avoid.forEach(x => t.add(x)); });
    return t;
  }
  const isRisky = (ex, tags) => stressOf(ex).some(t => tags.has(t));

  /* Substitution — the point of tagging patterns. A ruled-out lift is replaced
     by one doing the same job; failing that, one from the same family, so a
     sore shoulder never leaves a plan with no pressing in it at all. */
  function substituteFor(ex, allowed) {
    const fam = window.MOVE_FAMILY || {};
    const pat = patternOf(ex);
    const group = typeof ex === 'string' ? null : ex.group;
    const score = c => (patternOf(c) === pat ? 0 : 1) + (c.group && c.group === group ? 0 : 0.5);
    const pool = allowed.filter(c => c.name !== (ex.name || ex)
      && (patternOf(c) === pat || fam[patternOf(c)] === fam[pat]));
    if (!pool.length) return null;
    return pool.sort((a, b) => score(a) - score(b))[0];
  }

  /* "What does this move look like?" — for when the English name means
     nothing. Your own clip first, then the library's demo animation, and
     only if neither exists does it fall back to a video search. */
  const demoSlug = ex => (ex && ((window.EXERCISE_DEMOS || {})[ex.name] || ex.demo)) || null;

  async function showMove(ex) {
    if (!ex) return;
    haptic();
    const body = $('#media-viewer-body');
    const slug = demoSlug(ex) || demoSlug(exercises.find(e => e.name === ex.name));
    const mine = exercises.find(e => e.name === ex.name);
    const mid = mine && mine.mediaIds && mine.mediaIds[0];
    if (!mid && slug) {
      body.innerHTML = '';
      const wrap = el('div', 'move-demo');
      wrap.appendChild(demoEl(slug, null, false));
      wrap.appendChild(el('div', 'move-name', ex.name));
      // close sits right under the clip, not away up in the corner
      const done = el('button', 'move-close', '✕');
      done.onclick = () => { body.innerHTML = ''; $('#media-viewer').hidden = true; };
      wrap.appendChild(done);
      body.appendChild(wrap);
      $('#media-viewer').hidden = false;
      return;
    }
    if (mid) {
      const rec = await DB.get('media', mid);
      const url = rec && await mediaURL(mid);
      if (url) {
        body.innerHTML = '';
        let big;
        if (rec.type.startsWith('video')) {
          big = document.createElement('video');
          big.src = url; big.controls = true; big.playsInline = true;
          big.autoplay = true; big.loop = true; big.muted = true;
        } else {
          big = document.createElement('img');
          big.src = url;
        }
        body.appendChild(big);
        $('#media-viewer').hidden = false;
        return;
      }
    }
    window.open('https://www.youtube.com/results?search_query='
      + encodeURIComponent('how to ' + ex.name + ' exercise form'), '_blank');
  }

  function pmExerciseList() {
    const names = new Map();
    (window.EXERCISE_LIBRARY || []).forEach(i => names.set(i.name, i));
    exercises.forEach(e => { if (!names.has(e.name)) names.set(e.name, e); });
    return [...names.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /* remember which tab sent us here, so leaving lands back where you were */
  let pmReturn = 'plan';
  function openPlanMaker(from) {
    pmReturn = from || 'plan';
    pmDays = [{ name: 'Day A', items: [] }];
    pmDay = 0;
    const si = INJURIES.findIndex(i => i.key === localStorage.getItem('injDial'));
    pmInj = si < 0 ? 0 : si;
    const g = goalOf();
    if (g) pmReps = g.repIx;              // your goal picks the starting rep range
    pmName = 'Block ' + (plans.length + 1);
    pmDeload = true; pmWeeks = 4;
    show('planmaker');
    renderPlanMaker();
  }

  function renderPlanMaker() {
    const root = $('#view-planmaker');
    root.innerHTML = '';
    const all = pmExerciseList();
    const tags = injuryTags();
    const kitOK = all.filter(equipOK);
    const noKitN = all.length - kitOK.length;
    const lib = kitOK.filter(x => !isRisky(x, tags));
    const hiddenN = kitOK.length - lib.length;
    if (pmEx >= lib.length) pmEx = 0;

    /* anything already in the plan that a new injury rules out is swapped for
       the nearest safe equivalent rather than silently left in */
    const swaps = [];
    const stuck = [];
    pmDays.forEach(d => d.items.forEach(it => {
      const known = all.find(x => x.name === it.name) || it.name;
      if (!isRisky(known, tags) && equipOK(known)) return;
      const taken = new Set(d.items.map(x => x.name));
      const sub = substituteFor(known, lib.filter(c => !taken.has(c.name)));
      if (sub) {
        swaps.push(`${it.name} → ${sub.name}`);
        it.swappedFrom = it.name;
        it.name = sub.name;
      } else {
        it.stuck = true;
        stuck.push(it.name);
      }
    }));

    const head = el('div', 'w-head pm-head');
    const hl = el('div', 'w-left');
    hl.appendChild(el('div', 't-date', `${pmDays.reduce((a, d) => a + d.items.length, 0)} exercises`));
    const nameIn = document.createElement('input');
    nameIn.className = 'pm-name';
    nameIn.value = pmName;
    nameIn.placeholder = 'Block name';
    nameIn.maxLength = 28;
    nameIn.oninput = () => { pmName = nameIn.value; };
    hl.appendChild(nameIn);
    head.appendChild(hl);
    const close = el('button', 'w-chip', '✕');
    close.onclick = async () => {
      const n = pmDays.reduce((a, d) => a + d.items.length, 0);
      if (!await appConfirm({
        title: 'Discard this block?',
        body: n
          ? `${n} exercise${n === 1 ? '' : 's'} added. Nothing is saved.`
          : 'Nothing has been added yet — the block will not be saved.',
        ok: 'Discard', cancel: 'Keep building', warn: true
      })) return;
      pmDays = null;
      show(pmReturn); renderTab();
    };
    head.appendChild(close);
    root.appendChild(head);

    // days — tap the open one again to rename it
    const days = el('div', 'pm-days');
    pmDays.forEach((d, i) => {
      const b = el('button', 'pm-day' + (i === pmDay ? ' sel' : ''), d.name);
      b.onclick = () => {
        if (i !== pmDay) { pmDay = i; renderPlanMaker(); return; }
        const inp = document.createElement('input');
        inp.className = 'pm-day sel pm-day-edit';
        inp.value = d.name;
        inp.maxLength = 18;
        const commit = () => {
          d.name = (inp.value || '').trim() || d.name;
          renderPlanMaker();
        };
        inp.onblur = commit;
        inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
        b.replaceWith(inp);
        inp.focus();
        inp.select();
      };
      days.appendChild(b);
    });
    if (pmDays.length < 6) {
      const add = el('button', 'pm-day add', '+');
      add.onclick = () => {
        pmDays.push({ name: 'Day ' + String.fromCharCode(65 + pmDays.length), items: [] });
        pmDay = pmDays.length - 1;
        renderPlanMaker();
      };
      days.appendChild(add);
    }
    root.appendChild(days);

    /* injury log — the switch says whether anything hurts; if it does, spin
       the dial and tap an area to add it. Tap it again to drop it. */
    const injLive = injEnabled();
    const injOn = getInjuries();
    if (pmInj >= INJURIES.length) pmInj = 0;
    const injHead = el('div', 'inj-head');
    injHead.appendChild(el('div', 'micro', 'Injuries'));
    const master = el('button', 'inj-sw sm' + (injLive ? ' on' : ''));
    master.appendChild(el('i', 'inj-knob'));
    master.onclick = () => {
      localStorage.setItem('injuriesOn', injLive ? '0' : '1');
      if (injLive) setInjuries(new Set());     // switching off clears the marks
      haptic();
      renderPlanMaker();
    };
    injHead.appendChild(master);
    root.appendChild(injHead);
    /* with the switch off there is nothing to choose, so the dial is not
       there at all — turning it on brings the wheel out */
    if (injLive) {
      const injRow = el('div', 'inj-row');
      const toggleInj = i => {
        const s = getInjuries();
        const k = INJURIES[i].key;
        s.has(k) ? s.delete(k) : s.add(k);
        setInjuries(s);
        haptic();
        renderPlanMaker();
      };
      /* a stopwatch button: one round key that acts on whatever the arrow
         points at, reading Add or Remove depending on where the dial sits */
      const btn = el('button', 'inj-btn' + (injOn.has(INJURIES[pmInj].key) ? ' rm' : ''),
        injOn.has(INJURIES[pmInj].key) ? 'Remove' : 'Add');
      btn.onclick = () => toggleInj(pmInj);
      const dial = el('div', 'inj-dial');
      dial.appendChild(pickerWheel(INJURIES.map(i => i.label), pmInj,
        i => {
          pmInj = i;
          localStorage.setItem('injDial', INJURIES[i].key);
          const on = injOn.has(INJURIES[i].key);
          btn.textContent = on ? 'Remove' : 'Add';
          btn.classList.toggle('rm', on);
        },
        'wide short',
        i => (injOn.has(INJURIES[i].key) ? 'flag' : (i % 2 ? 'w11' : 'w15')),
        toggleInj));
      dial.appendChild(el('i', 'inj-arrow'));
      injRow.appendChild(dial);
      injRow.appendChild(btn);
      root.appendChild(injRow);
      const flagged = INJURIES.filter(i => injOn.has(i.key)).map(i => i.label);
      root.appendChild(el('div', 'inj-note', flagged.length
        ? `${hiddenN} hidden — ${flagged.join(', ')}`
        : 'Spin to the sore area, then tap Add'));
    }
    /* the kit list, right here — you find out what the gym is missing while
       you are building, not afterwards */
    const kitHead = el('div', 'inj-head');
    kitHead.appendChild(el('div', 'micro', 'Equipment'));
    const kitBtn = el('button', 'kit-btn', pmKitOpen ? 'Done' : (noKitN ? `${noKitN} off` : 'All on'));
    kitBtn.onclick = () => { pmKitOpen = !pmKitOpen; renderPlanMaker(); };
    kitHead.appendChild(kitBtn);
    root.appendChild(kitHead);
    if (pmKitOpen) root.appendChild(equipPicker(renderPlanMaker));
    else root.appendChild(el('div', 'inj-note', noKitN
      ? `${noKitN} exercises need kit you have switched off`
      : 'Every exercise available'));
    /* how long the block runs — swiped sideways, the same rail the goal and
       level questions use, so the screen keeps one direction of travel */
    const wkHead = el('div', 'inj-head');
    wkHead.appendChild(el('div', 'micro', 'Weeks'));
    root.appendChild(wkHead);
    root.appendChild(optionRail(PM_WEEKS.map(String), PM_WEEKS.indexOf(pmWeeks),
      i => { pmWeeks = PM_WEEKS[i]; paintWeeks(); }, 62));

    /* deload — the block runs its weeks hard, then optionally one more at
       reduced sets and load so the next block starts fresh */
    const dlHead = el('div', 'inj-head');
    dlHead.appendChild(el('div', 'micro', 'Deload week'));
    root.appendChild(dlHead);
    root.appendChild(segToggle(
      [['on', 'Yes'], ['off', 'No']],
      pmDeload ? 'on' : 'off',
      k => { pmDeload = k === 'on'; paintWeeks(); },
      'defer'
    ));
    const wkNote = el('div', 'inj-note');
    root.appendChild(wkNote);
    /* the wheel moves without a re-render, so the line under it is repainted
       on its own rather than rebuilding the whole screen mid-spin */
    function paintWeeks() {
      wkNote.textContent = pmDeload
        ? `${pmWeeks + 1} weeks — ${pmWeeks} at full effort, then one at two thirds of the sets and lighter`
        : `${pmWeeks} weeks, all at full effort`;
    }
    paintWeeks();

    if (swaps.length) root.appendChild(el('div', 'inj-swap', 'Swapped: ' + swaps.join(' · ')));
    if (stuck.length) root.appendChild(el('div', 'inj-swap warn',
      'No safe stand-in for ' + stuck.join(', ') + ' — remove it or drop that injury.'));

    /* narrowing the wheel — the whole catalog is far too much to spin past,
       so pick a body part or type a couple of letters and the dial shrinks */
    let shown = lib;
    const facets = el('div', 'pm-find');
    const groups = ['All', ...[...new Set(lib.map(x => x.group))].sort()];
    if (!groups.includes(pmGroup)) pmGroup = 'All';
    const chips = el('div', 'gchip-row');
    groups.forEach(g => {
      const b = el('button', 'gchip' + (g === pmGroup ? ' on' : ''), g);
      b.onclick = () => { pmGroup = g; refilter(); paintChips(); };
      chips.appendChild(b);
    });
    const paintChips = () => [...chips.children].forEach(b =>
      b.classList.toggle('on', b.textContent === pmGroup));
    facets.appendChild(chips);
    const find = document.createElement('input');
    find.className = 'pm-search';
    find.type = 'search';
    find.placeholder = 'Search exercises';
    find.value = pmQuery;
    find.autocomplete = 'off';
    facets.appendChild(find);
    root.appendChild(facets);

    // the three wheels
    const wheels = el('div', 'cd-wheels pm-wheels');
    const c1 = el('div', 'cd-col pm-sets');
    c1.appendChild(el('div', 'micro', 'Sets'));
    c1.appendChild(pickerWheel(PM_SETS.map(String), PM_SETS.indexOf(pmSets),
      i => { pmSets = PM_SETS[i]; }, null,
      i => (PM_SETS[i] % 5 === 0 ? 'w20' : (PM_SETS[i] % 2 ? 'w11' : 'w15'))));
    wheels.appendChild(c1);
    const c2 = el('div', 'cd-col pm-exx');
    const exLbl = el('div', 'micro', 'Exercise');
    c2.appendChild(exLbl);
    /* the indicator on this dial is a play arrow: it marks the row and, when
       tapped, shows the move — the name alone is no use if you cannot read it.
       It sits alongside the dial, not inside it, or the wheel's pointer
       capture would swallow the tap. */
    const exBox = el('div', 'pm-exbox');
    const play = el('button', 'pm-play');
    play.title = 'Show this move';
    play.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16"><path d="M5 3.4 16 10 5 16.6Z" '
      + 'fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';
    play.onclick = () => showMove(shown[pmEx]);
    const exWheel = () => pickerWheel(shown.map(x => x.name), pmEx, i => { pmEx = i; paintHard(); }, 'wide',
      i => (i % 5 === 0 ? 'w20' : (i % 2 ? 'w11' : 'w15')),
      () => showMove(shown[pmEx]));
    exBox.appendChild(exWheel());
    exBox.appendChild(play);
    c2.appendChild(exBox);
    /* refilter swaps just the dial, so typing never costs you the keyboard */
    function refilter() {
      const q = pmQuery.trim().toLowerCase();
      const keep = lib.filter(x =>
        (pmGroup === 'All' || x.group === pmGroup) &&
        (!q || x.name.toLowerCase().includes(q)));
      const wasName = shown[pmEx] && shown[pmEx].name;
      shown = keep.length ? keep : lib;
      const again = shown.findIndex(x => x.name === wasName);
      pmEx = again < 0 ? 0 : again;
      exBox.replaceChild(exWheel(), exBox.firstChild);
      paintHard();
      exLbl.textContent = shown.length === lib.length
        ? 'Exercise' : `Exercise · ${shown.length}`;
      exLbl.classList.toggle('none', !keep.length);
      if (!keep.length) exLbl.textContent = 'Exercise · no match';
      addBtn.textContent = `Add to ${pmDays[pmDay].name}`;
    }
    find.oninput = () => { pmQuery = find.value; refilter(); };
    wheels.appendChild(c2);
    const c3 = el('div', 'cd-col pm-reps');
    c3.appendChild(el('div', 'micro', 'Reps'));
    c3.appendChild(pickerWheel(PM_REPS.map(r => r.label), pmReps, i => { pmReps = i; }, null,
      i => (i % 2 ? 'w11' : 'w15')));
    wheels.appendChild(c3);
    root.appendChild(wheels);

    /* how hard the movement on the dial is. The dial spins without a
       re-render, so this line repaints on its own — you find out what the
       exercise asks of you before you add it, not after. */
    const pickHard = el('div', 'pm-hard');
    const paintHard = () => {
      pickHard.innerHTML = '';
      const item = shown[pmEx];
      const h = item && hardshipOf(item);
      if (!h) { pickHard.hidden = true; return; }
      pickHard.hidden = false;
      pickHard.appendChild(hardChip(item));
      pickHard.appendChild(el('span', 'pm-hard-note', h.note));
    };
    paintHard();
    root.appendChild(pickHard);

    const addBtn = el('button', 'btn-cta big');
    addBtn.style.width = '100%';
    addBtn.textContent = `Add to ${pmDays[pmDay].name}`;
    addBtn.onclick = () => {
      const item = shown[pmEx];
      if (!item) return;
      pmDays[pmDay].items.push({
        name: item.name, sets: pmSets,
        repLo: PM_REPS[pmReps].lo, repHi: PM_REPS[pmReps].hi
      });
      haptic();
      renderPlanMaker();
    };
    root.appendChild(addBtn);
    if (pmGroup !== 'All' || pmQuery) refilter();   // carry the last filter over

    // what's in this day
    const day = pmDays[pmDay];
    if (day.items.length) {
      const mins = dayMinutes(day.items);
      const budget = getProfile().sessionMins || 0;
      const dayHead = el('div', 'inj-head');
      dayHead.appendChild(el('div', 'micro', day.name));
      dayHead.appendChild(el('div', 'day-mins' + (budget && mins > budget ? ' over' : ''),
        budget ? `~${mins} of ${budget} min` : `~${mins} min`));
      root.appendChild(dayHead);
      const idx = el('div', 'ex-index');
      day.items.forEach((it, i) => {
        const r = el('div', 'exi-row' + (it.stuck ? ' stuck' : ''));
        r.appendChild(el('div', 'exi-num', String(i + 1).padStart(2, '0')));
        const nm = el('div', 'exi-name', it.name);
        if (it.swappedFrom) nm.appendChild(el('span', 'exi-sub', `was ${it.swappedFrom}`));
        const hb = el('div', 'exi-hard');
        if (addHardship(hb, it)) nm.appendChild(hb);
        r.appendChild(nm);
        r.appendChild(el('div', 'exi-scheme', `${it.sets} × ${it.repLo}–${it.repHi}`));
        const x = el('button', 'hist-del', '✕');
        x.onclick = () => { day.items.splice(i, 1); renderPlanMaker(); };
        r.appendChild(x);
        r.appendChild(gripEl('Drag to move it up or down the day'));
        idx.appendChild(r);
      });
      /* the order you put them in is the order you train them, so it has to
         be changeable without deleting and re-adding */
      dragReorder(idx, '.exi-row', (from, to) => {
        day.items.splice(to, 0, day.items.splice(from, 1)[0]);
        renderPlanMaker();
      });
      root.appendChild(idx);
    } else {
      root.appendChild(el('div', 'coach-note', 'Pick sets, an exercise and a rep range, then add it to the day.'));
    }

    const filled = pmDays.filter(d => d.items.length);
    const create = el('button', 'btn-cta big');
    create.style.width = '100%';
    create.textContent = 'Create block';
    create.disabled = !filled.length || !!stuck.length;
    create.style.opacity = create.disabled ? '.4' : '1';
    create.onclick = () => createPlanFromMaker();
    root.appendChild(create);
  }

  async function createPlanFromMaker() {
    const filled = pmDays.filter(d => d.items.length);
    if (!filled.length) return;
    const current = activePlan();
    const busy = current && !planFinished(current);
    let mode = 'now';
    if (busy) {
      mode = await appChoose({
        title: 'You have a block running',
        body: `"${current.name}" is still going. Start this one after it, or replace it now?`,
        options: [
          { label: 'Queue for later', value: 'queue', primary: true },
          { label: 'Replace now', value: 'replace' },
          { label: 'Cancel', value: null }
        ]
      });
      if (!mode) return;
    }

    const days = [];
    for (const d of filled) {
      const items = [];
      for (const it of d.items) {
        const libItem = (window.EXERCISE_LIBRARY || []).find(l => l.name === it.name)
          || exercises.find(e => e.name === it.name)
          || { name: it.name, group: 'Other', notes: '' };
        const ex = await ensureExercise(libItem);
        items.push({ exerciseId: ex.id, sets: it.sets, repLo: it.repLo, repHi: it.repHi, kg: 0 });
      }
      days.push({ name: d.name, items });
    }
    const plan = {
      id: DB.uid(), createdAt: Date.now(),
      name: (pmName || '').trim() || 'Block ' + (plans.length + 1),
      weeks: pmWeeks + (pmDeload ? 1 : 0), deload: pmDeload,
      days, prefDays: (current && current.prefDays) || [0, 2, 4],
      startDate: null, completed: [], finishedAt: null,
      queued: mode === 'queue'
    };
    if (mode === 'replace') {
      current.finishedAt = Date.now();
      await DB.put('plans', current);
    }
    await DB.put('plans', plan);
    pmDays = null;
    show(pmReturn);
    renderTab();
  }

  /* ============================================================
     CARDIO
     ============================================================ */
  /* Most activities happen both indoors and out, and the burn differs —
     a street run costs more than the same minutes on a treadmill.
     null = that activity doesn't exist in that setting.
     calories = MET x 3.5 x kg / 200 per minute, the rates assume a normal steady session. */
  const CARDIO_ACTS = [
    { name: 'Walk', indoor: 3.8, outdoor: 3.5 },
    { name: 'Run', indoor: 9.8, outdoor: 10.0 },
    { name: 'Trail Run', indoor: null, outdoor: 10.5 },
    { name: 'Cycling', indoor: 7.0, outdoor: 8.0 },
    { name: 'Rowing', indoor: 7.0, outdoor: 8.5 },
    { name: 'Swimming', indoor: 8.3, outdoor: 9.5 },
    { name: 'Elliptical', indoor: 5.5, outdoor: null },
    { name: 'Stair Climber', indoor: 9.0, outdoor: null },
    { name: 'Stairs', indoor: 8.8, outdoor: 8.8 },
    { name: 'Jump Rope', indoor: 12.3, outdoor: 12.3 },
    { name: 'Sprints', indoor: 12.0, outdoor: 12.5 },
    { name: 'Boxing', indoor: 9.0, outdoor: 9.0 },
    { name: 'Hiking', indoor: null, outdoor: 6.0 },
    { name: 'Football', indoor: 7.0, outdoor: 7.0 },
    { name: 'Tennis', indoor: 7.3, outdoor: 7.3 },
    { name: 'Skipping Drills', indoor: 10.0, outdoor: 10.0 }
  ];
  /* effort isn't asked for — the MET rates already assume a normal,
     steady session. Old records may carry a scale; honour it. */
  const CARDIO_EFFORT = [
    { key: 'easy', mul: 0.8 },
    { key: 'steady', mul: 1 },
    { key: 'hard', mul: 1.3 }
  ];
  const actsFor = env => CARDIO_ACTS.filter(a => a[env] != null);
  const metOf = (name, env) => {
    const a = CARDIO_ACTS.find(x => x.name === name);
    if (!a) return 7;                       // anything logged before this list
    return a[env] ?? a.indoor ?? a.outdoor ?? 7;
  };
  const mulOf = key => (CARDIO_EFFORT.find(e => e.key === key) || CARDIO_EFFORT[1]).mul;
  const liveCardio = {
    get() { try { return JSON.parse(localStorage.getItem('liveCardio') || 'null'); } catch { return null; } },
    set(v) { v ? localStorage.setItem('liveCardio', JSON.stringify(v)) : localStorage.removeItem('liveCardio'); }
  };
  let cardioEnv = localStorage.getItem('cardioEnv') || 'indoor';
  let cardioActName = localStorage.getItem('cardioAct') || 'Run';
  let cardioMins = 20, cardioInt = null, cardioAlerted = false;

  function cardioKcal(met, mins, kg, effort) {
    return Math.round(met * mulOf(effort) * 3.5 * (kg || 80) / 200 * mins);
  }

  /* Picker wheel — the same ruler language as the weight and rep scales:
     tick lines running down a dial with a fixed clay indicator.
     tickFor(i) returns 'w20' | 'w15' | 'w11' for the mark's length.
     onTap(i), if given, fires when the centred row is tapped. */
  function pickerWheel(labels, index, onChange, cls, tickFor, onTap) {
    const TICK = 40;
    let val = Math.max(0, Math.min(labels.length - 1, index));
    const wrap = el('div', 'pw' + (cls ? ' ' + cls : ''));
    wrap.appendChild(el('i', 'pw-ind'));
    const strip = el('div', 'pw-strip');
    labels.forEach((lb, i) => {
      const t = el('button', 'pw-item');
      t.dataset.i = i;
      const slot = el('span', 'pw-slot');
      slot.appendChild(el('i', tickFor ? tickFor(i) : 'w11'));
      t.appendChild(slot);
      t.appendChild(el('span', 'pw-lbl', lb));
      strip.appendChild(t);
    });
    wrap.appendChild(strip);

    /* 'picking' marks the wheel as being turned right now — the page uses it
       to fade what is around it and give the row under the indicator room */
    const pick = on => wrap.classList.toggle('picking', on);
    const offFor = i => -(i * TICK + TICK / 2);
    const idxAt = off => Math.round(-(off + TICK / 2) / TICK);
    const clampI = i => Math.max(0, Math.min(labels.length - 1, i));
    const mark = () => [...strip.children].forEach((t, i) => t.classList.toggle('sel', i === val));
    const put = off => { strip.style.transform = `translateY(${off}px)`; };
    let raf = null;

    const slide = anim => {
      cancelAnimationFrame(raf);
      strip.style.transition = anim ? 'transform .18s ease-out' : 'none';
      put(offFor(val));
    };
    const setVal = (i, anim) => {
      i = clampI(i);
      if (i !== val) haptic();
      val = i;
      mark(); slide(anim);
      onChange(val);
    };

    /* spin on: coast to a stop like a wheel, ticking past each notch */
    const coastTo = (target, fromOff) => {
      cancelAnimationFrame(raf);
      strip.style.transition = 'none';
      target = clampI(target);
      const to = offFor(target);
      const dist = Math.abs(to - fromOff);
      const dur = Math.max(220, Math.min(1100, dist * 2.2));
      const t0 = performance.now();
      let lastDetent = idxAt(fromOff);
      const step = now => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);           // ease out, like friction
        const off = fromOff + (to - fromOff) * e;
        put(off);
        const d = idxAt(off);
        if (d !== lastDetent) {                      // a click for every notch passed
          lastDetent = d;
          haptic();
          const c = clampI(d);
          [...strip.children].forEach((t, i) => t.classList.toggle('sel', i === c));
        }
        if (p < 1) { raf = requestAnimationFrame(step); return; }
        val = target;
        mark();
        pick(false);
        onChange(val);
      };
      raf = requestAnimationFrame(step);
    };

    let sy = null, so = 0, lastN = 0, vy = 0, lastY = 0, lastT = 0;
    wrap.style.touchAction = 'none';
    wrap.addEventListener('pointerdown', e => {
      cancelAnimationFrame(raf);
      sy = e.clientY; so = offFor(val); lastN = 0;
      vy = 0; lastY = e.clientY; lastT = performance.now();
      strip.style.transition = 'none';
      pick(true);
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e => {
      if (sy === null) return;
      const dy = e.clientY - sy;
      put(so + dy);
      const n = Math.round(dy / TICK);
      if (n !== lastN) { lastN = n; haptic(); }
      const now = performance.now(), dt = now - lastT;
      if (dt > 0) { vy = (e.clientY - lastY) / dt; lastY = e.clientY; lastT = now; }
    });
    const end = e => {
      if (sy === null) return;
      const dy = e.clientY - sy;
      sy = null;
      if (Math.abs(dy) < 5) {
        slide(false);
        pick(false);
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const item = t && t.closest ? t.closest('.pw-item') : null;
        if (!item) return;
        const i = +item.dataset.i;
        // a tap on the one already under the indicator is a tap, not a move
        if (onTap && i === val) onTap(i); else setVal(i, true);
        return;
      }
      // carry the flick forward: how far it would drift before friction wins
      const stale = performance.now() - lastT > 90;
      const throwPx = stale ? 0 : vy * 170;
      const fromOff = so + dy;
      coastTo(Math.round(-(fromOff + throwPx + TICK / 2) / TICK), fromOff);
    };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', () => {
      if (sy !== null) { sy = null; slide(false); pick(false); }
    });

    mark(); slide(false);
    return wrap;
  }

  async function renderCardio() {
    const root = $('#view-cardio');
    root.innerHTML = '';
    clearInterval(cardioInt);
    const [logs, bw] = await Promise.all([DB.all('cardio'), DB.all('bodyweight')]);
    logs.sort((a, b) => b.ts - a.ts);
    const kg = bw.length ? [...bw].sort((a, b) => a.ts - b.ts).pop().kg : 80;
    const lc = liveCardio.get();
    const running = !!lc;

    const head = el('header', 't-head');
    const hl = el('div');
    const wkLogs = logs.filter(x => sameWeek(x.date));
    hl.appendChild(el('div', 't-date',
      wkLogs.length
        ? `This week · ${wkLogs.reduce((a, x) => a + x.minutes, 0)} min · ${wkLogs.reduce((a, x) => a + x.calories, 0)} kcal`
        : 'No cardio yet'));
    hl.appendChild(el('h1', 't-title', 'Cardio'));
    head.appendChild(hl);
    root.appendChild(head);

    // ---- the pickers stay on screen the whole time ----
    cardioAlerted = running ? cardioAlerted : false;
    const minsList = Array.from({ length: 24 }, (_, i) => (i + 1) * 5);
    if (!minsList.includes(cardioMins)) cardioMins = 20;
    const env = running ? (lc.env || 'indoor') : cardioEnv;
    let list = actsFor(env);
    const actName = running ? lc.act : cardioActName;
    let ai = list.findIndex(a => a.name === actName);
    if (ai < 0) ai = 0;
    if (!running) cardioActName = list[ai].name;
    const shownMins = running ? lc.mins : cardioMins;

    root.appendChild(segToggle(
      [['indoor', 'Indoor', running], ['outdoor', 'Outdoor', running]],
      env,
      e2 => {
        if (running || cardioEnv === e2) return;
        cardioEnv = e2;
        localStorage.setItem('cardioEnv', e2);
        renderCardio();
      },
      'defer'));

    const kcalEl = el('div', 'cd-kcal num');
    const upd = () => {
      kcalEl.textContent = `~${cardioKcal(metOf(cardioActName, cardioEnv), cardioMins, kg)} kcal`;
    };

    const wheels = el('div', 'cd-wheels' + (running ? ' locked' : ''));
    const c1 = el('div', 'cd-col');
    c1.appendChild(el('div', 'micro', 'Activity'));
    c1.appendChild(pickerWheel(list.map(t => t.name), ai, i => {
      cardioActName = list[i].name;
      localStorage.setItem('cardioAct', cardioActName);
      upd();
    }, 'wide', i => (i % 5 === 0 ? 'w20' : (i % 2 ? 'w11' : 'w15'))));
    wheels.appendChild(c1);
    const c2 = el('div', 'cd-col');
    c2.appendChild(el('div', 'micro', 'Minutes'));
    // minute marks like a watch bezel: long at the quarter hours
    c2.appendChild(pickerWheel(minsList.map(String), minsList.indexOf(shownMins),
      i => { cardioMins = minsList[i]; upd(); }, null,
      i => (minsList[i] % 15 === 0 ? 'w20' : (minsList[i] % 10 === 0 ? 'w15' : 'w11'))));
    wheels.appendChild(c2);
    root.appendChild(wheels);

    if (!running) {
      upd();
      root.appendChild(kcalEl);

      const start = el('button', 'btn-cta big');
      start.style.width = '100%';
      start.appendChild(svgIcon(PLAY, 13));
      start.appendChild(document.createTextNode(' Start'));
      start.onclick = () => {
        liveCardio.set({
          act: cardioActName, env: cardioEnv, mins: cardioMins,
          startedAt: Date.now(), acc: 0
        });
        cardioAlerted = false;
        renderCardio();
      };
      root.appendChild(start);
    } else {
      // ---- the timer lives right below the wheels ----
      const total = lc.mins * 60;
      const met = metOf(lc.act, env);
      const doneSec = () => Math.min(total, Math.round((lc.acc || 0) + (lc.startedAt ? (Date.now() - lc.startedAt) / 1000 : 0)));

      // the whole frame is the bar: a soft fill that drains behind the numbers
      const live = el('div', 'cd-live' + (lc.startedAt ? '' : ' paused'));
      const gauge = el('i', 'cd-gauge');
      live.appendChild(gauge);
      const clock = el('div', 'cd-clock num', '0:00');
      live.appendChild(clock);
      const sub = el('div', 'cd-sub num', '');
      live.appendChild(sub);
      root.appendChild(live);

      const acts = el('div', 'block-actions');
      const pause = el('button', 'btn-ghost', lc.startedAt ? 'Pause' : 'Resume');
      pause.onclick = () => {
        const cur = liveCardio.get();
        if (!cur) return;
        if (cur.startedAt) {
          cur.acc = (cur.acc || 0) + (Date.now() - cur.startedAt) / 1000;
          cur.startedAt = null;
        } else {
          cur.startedAt = Date.now();
        }
        liveCardio.set(cur);
        renderCardio();
      };
      const fin = el('button', 'btn-cta big', 'Finish & save');
      fin.style.cssText = 'flex:1.4;width:auto;align-self:stretch;margin-top:0';
      fin.onclick = () => finishCardio(false);
      acts.append(pause, fin);
      root.appendChild(acts);

      const disc = el('div', 'text-links');
      const d = el('button', null, 'Discard');
      d.onclick = async () => {
        if (!await appConfirm({ title: 'Discard?', body: 'Not saved.', ok: 'Discard', cancel: 'Keep going', warn: true })) return;
        liveCardio.set(null);
        renderCardio();
      };
      disc.appendChild(d);
      root.appendChild(disc);

      const tick = () => {
        const d2 = doneSec(), l = Math.max(0, total - d2);
        clock.textContent = fmtClock(l);
        sub.textContent = `${Math.round(d2 / 60)} of ${lc.mins} min · ~${cardioKcal(met, d2 / 60, kg)} kcal`;
        const rem = Math.max(0, 100 - Math.min(100, d2 / total * 100));
        gauge.style.width = rem + '%';
        if (l <= 0 && !cardioAlerted) {
          cardioAlerted = true;
          beep();
          if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
          clearInterval(cardioInt);
          finishCardio(true);
        }
      };
      tick();
      if (lc.startedAt) cardioInt = setInterval(tick, 500);
    }

    // ---- history ----
    if (logs.length) {
      root.appendChild(el('div', 'micro', 'History'));
      const rail = el('div', 'plan-rail');
      const CD_SHOWN = 3;
      (cardioHistOpen ? logs : logs.slice(0, CD_SHOWN)).forEach(x => {
        const r = el('div', 'hrow');
        const node = el('i', 'ex-node small');
        node.appendChild(el('i'));
        r.appendChild(node);
        const c = el('div', 'hrow-body');
        c.appendChild(el('div', 'hrow-date', dateOf(x.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })));
        c.appendChild(el('div', 'hrow-name', x.activity));
        c.appendChild(el('div', 'hrow-meta num',
          `${x.minutes} min · ${x.calories} kcal${x.env ? ' · ' + x.env : ''}`));
        r.appendChild(c);
        const del = el('button', 'hist-del', '✕');
        del.onclick = async e => {
          e.stopPropagation();
          if (!confirm(`Delete ${x.activity} from ${x.date}?`)) return;
          await DB.del('cardio', x.id);
          renderCardio();
        };
        r.appendChild(del);
        rail.appendChild(r);
      });
      if (logs.length > CD_SHOWN) {
        const more = el('div', 'text-links inset');
        const b = el('button', null, cardioHistOpen ? 'Show less' : `Show all ${logs.length}`);
        b.onclick = () => { cardioHistOpen = !cardioHistOpen; renderCardio(); };
        more.appendChild(b);
        rail.appendChild(more);
      }
      root.appendChild(rail);

      // ---- totals + 8-week trend, closing the page ----
      const base = el('div', 'base-row');
      const bs = (v, l, cls) => {
        const d = el('div', 'base-stat' + (cls ? ' ' + cls : ''));
        d.appendChild(el('div', 'v num', v));
        d.appendChild(el('div', 'l', l));
        return d;
      };
      const totMin = logs.reduce((a, x) => a + x.minutes, 0);
      base.appendChild(bs(String(logs.length), 'Sessions'));
      base.appendChild(bs(Math.round(totMin / 6) / 10 + ' h', 'Time'));
      base.appendChild(bs(fmtKg(logs.reduce((a, x) => a + x.calories, 0)), 'Kcal', 'earn'));
      root.appendChild(base);

      const nowD = new Date();
      const dow0 = (nowD.getDay() + 6) % 7;
      const mon = new Date(nowD); mon.setDate(nowD.getDate() - dow0); mon.setHours(0, 0, 0, 0);
      const weekly = Array.from({ length: 8 }, (_, i) => {
        const ws = new Date(mon.getTime() - (7 - i) * 7 * 86400000);
        const we = new Date(ws.getTime() + 7 * 86400000);
        return logs.filter(x => { const d = dateOf(x.date); return d >= ws && d < we; })
          .reduce((a, x) => a + x.minutes, 0);
      });
      if (weekly.some(v => v > 0)) {
        const cell = el('div', 'sg-cell');
        cell.appendChild(el('div', 'sg-name', 'Minutes · per week'));
        const row = el('div', 'sg-valrow');
        row.appendChild(el('span', 'sg-val num', weekly[7] + ' min'));
        const d = weekly[7] - weekly[6];
        if (d !== 0) row.appendChild(el('span', 'sg-d num' + (d > 0 ? ' up' : ' down'), (d > 0 ? '+' : '−') + Math.abs(d)));
        cell.appendChild(row);
        const g = el('div', 'sg-graph');
        g.innerHTML = sparkSVG(weekly, 320, 60);
        cell.appendChild(g);
        root.appendChild(cell);
      }
    } else {
      const emp = el('div', 'empty-state');
      emp.appendChild(el('p', null, 'Pick an activity and press Start.'));
      root.appendChild(emp);
    }
  }

  async function finishCardio(auto) {
    const lc = liveCardio.get();
    if (!lc) return;
    clearInterval(cardioInt);
    const total = lc.mins * 60;
    const elapsed = (lc.acc || 0) + (lc.startedAt ? (Date.now() - lc.startedAt) / 1000 : 0);
    const secs = Math.min(total, Math.max(1, Math.round(elapsed)));
    const mins = Math.max(1, Math.round(secs / 60));
    const bw = await DB.all('bodyweight');
    const kg = bw.length ? [...bw].sort((a, b) => a.ts - b.ts).pop().kg : 80;
    const env = lc.env || 'indoor';
    const kcal = cardioKcal(metOf(lc.act, env), mins, kg, lc.effort);
    const ok = await appConfirm({
      title: auto ? 'Time!' : 'Finish?',
      body: `${lc.act} · ${env} · ${mins} min · ${kcal} kcal`,
      ok: 'Save', cancel: auto ? 'Discard' : 'Keep going'
    });
    if (!ok) {
      if (auto) liveCardio.set(null);
      renderCardio();
      return;
    }
    await DB.put('cardio', {
      id: DB.uid(), date: todayStr(), ts: Date.now(),
      activity: lc.act, env, minutes: mins, calories: kcal
    });
    liveCardio.set(null);
    renderCardio();
  }

  /* ============================================================
     LIBRARY
     ============================================================ */
  let libFilter = 'All', libQuery = '';
  const LIB_GROUPS = ['All', ...new Set((window.EXERCISE_LIBRARY || []).map(i => i.group))];

  /* The written content for each movement lives in its own file rather than in
     the bundle — it is far larger than the app itself and most sessions never
     need it. Fetched once, on the first visit to the library, then kept in
     memory. The service worker keeps a copy after that, so it works offline. */
  let CONTENT = null, contentPending = null;
  const MUSCLE_NAME = {};   // taxonomy id → the name a person would use
  const LIB_BY_ID = {};     // content id → library record, for the primary muscles

  function loadContent() {
    if (CONTENT) return Promise.resolve(CONTENT);
    if (contentPending) return contentPending;
    const grab = (url, fail) => fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .catch(() => fail);
    contentPending = Promise.all([
      grab('data/exercise-content.json', { content: [] }),
      /* small enough to come along for the ride; it carries which muscles are
         primary, which the content layer does not record */
      grab('data/exercise-library.json', { exercises: [] })
    ]).then(([c, l]) => {
      CONTENT = new Map((c.content || []).map(x => [x.id, x]));
      ((c.muscle_taxonomy && c.muscle_taxonomy.muscles) || [])
        .forEach(m => { MUSCLE_NAME[m.id] = m.display || m.id; });
      (l.exercises || []).forEach(e => { LIB_BY_ID[e.id] = e; });
      return CONTENT;
    });
    return contentPending;
  }

  /* A catalog item's demo slug is usually the content id; a handful differ,
     and three items carry no slug at all and match by name. */
  function contentIdFor(item) {
    if (!item) return null;
    const byEx = window.CONTENT_BY_EXNAME || {};
    /* the name is the reliable key; the demo slug is only a fallback for the
       older entries, and stopped matching once clips were filed under their
       own names. Apostrophes differ between the two files, so normalise. */
    const key = s => String(s || '').replace(/[’ʼ]/g, "'");
    if (!contentIdFor._byKey) {
      contentIdFor._byKey = {};
      for (const n in byEx) contentIdFor._byKey[key(n)] = byEx[n];
    }
    const hit = contentIdFor._byKey[key(item.name)];
    if (hit) return hit;
    const alias = window.CONTENT_ALIAS || {}, byName = window.CONTENT_BY_NAME || {};
    /* a plan item is only a name and a rep scheme — it carries no demo slug
       of its own, so borrow the catalog's for the same name */
    if (!contentIdFor._slugByName) {
      contentIdFor._slugByName = {};
      (window.EXERCISE_LIBRARY || []).forEach(i => {
        if (i.demo) contentIdFor._slugByName[key(String(i.name).toLowerCase())] = i.demo;
      });
    }
    const low = key(String(item.name || '').toLowerCase());
    const slug = item.demo || byName[low] || contentIdFor._slugByName[low];
    return slug ? (alias[slug] || slug) : null;
  }
  function contentFor(item) {
    if (!CONTENT || !item) return null;
    const id = contentIdFor(item);
    return (id && CONTENT.get(id)) || null;
  }

  /* ---------------- how hard it is ----------------
     Not how heavy — how much technique the movement asks for before it is
     safe to load. It rides under the name everywhere an exercise is shown,
     because that is the thing you want to know before you pick it, not
     after you have already put the bar on your back.
     The written entry carries `difficulty`; the library record's `skill`
     (1–3) is the same three-step scale and covers anything the content
     layer has not been written for yet. */
  const HARDSHIP = [
    null,
    { n: 1, label: 'Beginner', note: 'easy to do right — learn it under load' },
    { n: 2, label: 'Intermediate', note: 'needs practice before it gets heavy' },
    { n: 3, label: 'Advanced', note: 'technique-heavy — earn it before loading' }
  ];
  const HARD_BY_WORD = { beginner: 1, intermediate: 2, advanced: 3 };

  /* the handful of catalog movements the written library has not been given
     an entry for yet — rated here so the line is never blank */
  const HARD_EXTRA = { 'bicycle crunch': 1, 'swimming': 2 };

  function hardshipOf(item) {
    if (!item) return null;
    /* what the user said, if this is their own exercise */
    if (item.hardship >= 1 && item.hardship <= 3) return HARDSHIP[item.hardship];
    const con = contentFor(item);
    const byWord = con && HARD_BY_WORD[String(con.difficulty || '').toLowerCase()];
    if (byWord) return HARDSHIP[byWord];
    const lib = LIB_BY_ID[contentIdFor(item)];
    const n = lib && lib.skill;
    if (n >= 1 && n <= 3) return HARDSHIP[n];
    const extra = HARD_EXTRA[String(item.name || '').toLowerCase()];
    return extra ? HARDSHIP[extra] : null;
  }

  /* three bars and the word — small enough to sit on a meta line, legible
     enough to read without tapping through */
  function hardChip(item, extra) {
    const h = hardshipOf(item);
    if (!h) return null;
    const chip = el('span', 'hardness h' + h.n + (extra ? ' ' + extra : ''));
    chip.title = h.note;
    const bars = el('i', 'hard-bars');
    for (let i = 1; i <= 3; i++) bars.appendChild(el('i', i <= h.n ? 'on' : ''));
    chip.appendChild(bars);
    chip.appendChild(el('span', 'hard-lbl', h.label));
    return chip;
  }
  /* append to an existing meta line, with a separator if it already says
     something */
  function addHardship(node, item, extra) {
    const chip = hardChip(item, extra);
    if (!chip) return null;
    if (node.childNodes.length) node.appendChild(el('span', 'hard-sep', '·'));
    node.appendChild(chip);
    return chip;
  }

  /* Block Master — building a block, the exercises it can draw on, and the
     kit you actually have, all in one place because they decide each other. */
  let masterTab = 'new';

  function renderLibrary() {
    const root = $('#view-library');
    root.innerHTML = '';
    const owned = getEquip();
    const usable = (window.EXERCISE_LIBRARY || []).filter(equipOK);
    const head = el('header', 't-head');
    const hl = el('div');
    const sub = el('div', 't-date',
      `${usable.length} of ${(window.EXERCISE_LIBRARY || []).length} exercises · ${owned.size} kit`);
    hl.appendChild(sub);
    hl.appendChild(el('h1', 't-title', 'Block Master'));
    head.appendChild(hl);
    root.appendChild(head);

    /* only the panel below is rebuilt on a tab change — the toggle itself
       stays put so its pill can slide instead of jumping */
    const panel = el('div', 'master-panel');
    const fill = () => {
      const own = getEquip();
      const ok = (window.EXERCISE_LIBRARY || []).filter(equipOK);
      sub.textContent = `${ok.length} of ${(window.EXERCISE_LIBRARY || []).length} exercises · ${own.size} kit`;
      panel.innerHTML = '';
      if (masterTab === 'new') renderMasterNew(panel);
      else if (masterTab === 'equipment') renderMasterEquip(panel, fill);
      else renderMasterLib(panel);
    };
    root.appendChild(segToggle(
      [['new', 'New block'], ['exercises', 'Library'], ['equipment', 'Equipment']],
      masterTab,
      k => { masterTab = k; fill(); },
      'master-seg'));
    root.appendChild(panel);
    fill();
  }

  /* One line of a block's day: the movement, its sets and reps, and a way
     through to the exercise. Shared by the plan's day previews and the block
     previews in Block Master so the two always read the same. */
  function planItemRow(it, from) {
    const ex = exercises.find(x => x.id === it.exerciseId);
    const row = el('div', 'pv-row');
    const th = el('div', 'pv-thumb');
    th.appendChild(thumbFor(ex));
    row.appendChild(th);
    const c = el('div');
    c.appendChild(el('div', 'pv-name', ex ? ex.name : '(deleted)'));
    const timed = /second/i.test((ex && ex.notes) || '');
    const pvMeta = el('div', 'pv-meta num',
      `${it.sets} × ${it.repLo}-${it.repHi}${timed ? ' s' : ' reps'}`
      + (it.kg ? ` · ${fmtW(it.kg)}` : ''));
    if (ex) addHardship(pvMeta, ex);
    c.appendChild(pvMeta);
    row.appendChild(c);
    if (ex) {
      row.appendChild(el('div', 'pv-go', '›'));
      row.onclick = e => { e.stopPropagation(); openDetail(ex.id, from); };
    }
    return row;
  }

  function renderMasterNew(root) {
    const start = el('button', 'btn-cta big');
    start.style.width = '100%';
    start.textContent = '＋ Build a new block';
    start.onclick = () => openPlanMaker('library');
    root.appendChild(start);
    const live = activePlan();
    const q = queuedPlans();
    if (!plans.length) {
      root.appendChild(el('div', 'coach-note',
        'Three dials — sets, exercise, reps — and the block builds itself. Injuries and the kit you own decide what it can pick from.'));
      return;
    }
    root.appendChild(el('div', 'micro', 'Your blocks'));
    const list = el('div', 'ex-index');
    [...plans].sort((a, b) => b.createdAt - a.createdAt).forEach(p => {
      const r = el('div', 'exi-row');
      const state = p === live ? 'Running' : (p.queued ? 'Queued' : (planFinished(p) ? 'Done' : 'Idle'));
      r.appendChild(el('div', 'exi-num', state === 'Running' ? '▶' : (state === 'Queued' ? '⋯' : '·')));
      const nm = el('div', 'exi-name', p.name);
      const total = (p.days || []).reduce((n, d) => n + (d.items || []).length, 0);
      nm.appendChild(el('span', 'exi-sub',
        `${p.days.length} day${p.days.length === 1 ? '' : 's'} · ${total} exercise${total === 1 ? '' : 's'}`
        + ` · ${p.weeks || 4}w${p.deload ? ' +deload' : ''} · ${state}`));
      r.appendChild(nm);
      r.appendChild(el('div', 'exi-go', '▾'));
      list.appendChild(r);

      /* tap a block to see what is actually in it — otherwise the only way to
         find out is to install it and look at the Plan tab */
      const pv = el('div', 'blk-preview');
      pv.hidden = true;
      r.onclick = () => {
        if (pv.hidden && !pv.dataset.built) {
          (p.days || []).forEach(day => {
            const head = el('div', 'blk-day');
            head.appendChild(el('div', 'blk-day-name', day.name));
            head.appendChild(el('div', 'blk-day-meta num', (day.items || []).length + ''));
            pv.appendChild(head);
            (day.items || []).forEach(it => pv.appendChild(planItemRow(it, 'library')));
          });
          if (!(p.days || []).length) pv.appendChild(el('div', 'pv-meta', 'This block has no days yet.'));
          pv.dataset.built = '1';
        }
        pv.hidden = !pv.hidden;
        r.classList.toggle('open', !pv.hidden);
      };
      list.appendChild(pv);
    });
    root.appendChild(list);
  }

  /* Segmented toggle whose clay pill slides across to the option you pick,
     so the switch reads as one control rather than three separate buttons. */
  function segToggle(items, activeKey, onPick, extra) {
    const seg = el('div', 'seg-toggle slide' + (extra ? ' ' + extra : ''));
    seg.style.setProperty('--seg-n', items.length);
    const ind = el('i', 'seg-ind');
    seg.appendChild(ind);
    const paint = k => {
      const at = items.findIndex(x => x[0] === k);
      seg.style.setProperty('--seg-i', Math.max(0, at));
      seg.classList.toggle('unset', at < 0);     // nothing chosen: no pill at all
      [...seg.querySelectorAll('button')].forEach((b, i) => b.classList.toggle('sel', items[i][0] === k));
    };
    items.forEach(([key, label, disabled]) => {
      const b = el('button', '', label);
      b.disabled = !!disabled;
      b.onclick = () => {
        if (b.disabled) return;
        paint(key);              // slide first, then do the work
        haptic();
        // callers that rebuild their whole screen get a beat so the slide shows
        if (extra && extra.includes('defer')) setTimeout(() => onPick(key), 210);
        else onPick(key);
      };
      seg.appendChild(b);
    });
    paint(activeKey);
    return seg;
  }

  /* One equipment picker, used by Block Master and by the builder itself —
     the gym you are standing in is the thing that decides the block. */
  function equipPicker(after) {
    const wrap = el('div', 'equip-wrap');
    const owned = getEquip();
    const all = (window.EXERCISE_LIBRARY || []);
    const secs = [...new Set((window.EQUIPMENT || []).map(q => q.sec || 'Other'))];
    secs.forEach(sec => {
      wrap.appendChild(el('div', 'micro', sec));
      const grid = el('div', 'equip-grid');
      (window.EQUIPMENT || []).filter(q => (q.sec || 'Other') === sec).forEach(q => {
        const on = q.always || owned.has(q.key);
        const b = el('button', 'equip-tile' + (on ? ' on' : '') + (q.always ? ' fixed' : ''));
        b.appendChild(el('span', 'equip-lbl', q.label));
        const n = all.filter(x => equipOf(x).includes(q.key)).length;
        b.appendChild(el('span', 'equip-n', q.always ? 'always' : `${n} move${n === 1 ? '' : 's'}`));
        if (!q.always) b.onclick = () => {
          const s = getEquip();
          s.has(q.key) ? s.delete(q.key) : s.add(q.key);
          setEquip(s);
          haptic();
          after();
        };
        grid.appendChild(b);
      });
      wrap.appendChild(grid);
    });
    const acts = el('div', 'equip-acts');
    const allBtn = el('button', 'btn-ghost', 'Select all');
    allBtn.onclick = () => { setEquip(new Set((window.EQUIPMENT || []).map(q => q.key))); after(); };
    const homeBtn = el('button', 'btn-ghost', 'Home only');
    homeBtn.onclick = () => { setEquip(new Set(['bodyweight', 'mat'])); after(); };
    acts.appendChild(allBtn);
    acts.appendChild(homeBtn);
    wrap.appendChild(acts);
    return wrap;
  }

  function renderMasterEquip(root, after) {
    root.appendChild(el('div', 'coach-note',
      'Switch off anything your gym has not got. The block builder will not pick an exercise that needs it.'));
    root.appendChild(equipPicker(after || renderLibrary));
    const all = (window.EXERCISE_LIBRARY || []);
    const off = all.length - all.filter(equipOK).length;
    root.appendChild(el('div', 'inj-note', off
      ? `${off} exercises need kit you have switched off`
      : 'Everything in the catalog is available'));
  }

  function renderMasterLib(root) {
    const add = el('button', 'chip-btn wide', '＋ Add your own exercise');
    add.onclick = () => openExerciseForm(null);
    root.appendChild(add);
    const search = el('input', 'search-input');
    search.type = 'search';
    search.placeholder = 'Search exercises…';
    search.value = libQuery;
    search.oninput = () => { libQuery = search.value; renderLibList($('#lib-list-root')); };
    root.appendChild(search);

    const chips = el('div', 'chip-row');
    for (const g of LIB_GROUPS) {
      const b = el('button', g === libFilter ? 'sel' : '', g);
      b.onclick = () => { libFilter = g; renderLibrary(); };
      chips.appendChild(b);
    }
    root.appendChild(chips);

    const list = el('div', 'lib-list');
    list.id = 'lib-list-root';
    root.appendChild(list);
    renderLibList(list);

    /* Draw immediately with the short notes, then fill the descriptions in
       when the content arrives. Nothing waits on the network. */
    if (!CONTENT) loadContent().then(() => {
      const live = $('#lib-list-root');
      if (live) renderLibList(live);
    });
  }

  function renderLibList(list) {
    list.innerHTML = '';
    const q = libQuery.trim().toLowerCase();
    // merge: my exercises + catalog items not yet added
    const mineNames = new Set(exercises.map(e => e.name.toLowerCase()));
    const rows = [];
    for (const ex of exercises) rows.push({ mine: true, ex });
    for (const item of (window.EXERCISE_LIBRARY || [])) {
      if (!mineNames.has(item.name.toLowerCase())) rows.push({ mine: false, item });
    }
    for (const r of rows) {
      const name = r.mine ? r.ex.name : r.item.name;
      const group = r.mine ? (r.ex.group || '') : r.item.group;
      if (libFilter !== 'All' && group !== libFilter) continue;
      if (q && !name.toLowerCase().includes(q) && !group.toLowerCase().includes(q)) continue;
      const row = el('div', 'lib-row');
      const th = el('div', 'lr-thumb');
      th.appendChild(thumbFor(r.mine ? r.ex : r.item));
      row.appendChild(th);
      const c = el('div', 'lr-text');
      const nm = el('div', 'lr-name', name);
      if (r.mine) nm.appendChild(el('span', 'mine-tag', 'MINE'));
      c.appendChild(nm);
      const meta = el('div', 'lr-meta', group);
      addHardship(meta, r.mine ? r.ex : r.item);
      c.appendChild(meta);
      /* The written summary if this movement has one, otherwise its own
         coaching note — every row says something either way. */
      const con = contentFor(r.mine ? r.ex : r.item);
      const desc = (con && con.summary) || (r.mine ? r.ex.notes : r.item.notes) || '';
      if (desc) c.appendChild(el('div', 'lr-desc', desc));
      row.appendChild(c);
      if (r.mine) {
        row.onclick = () => openDetail(r.ex.id, 'library');
      } else {
        const addB = el('button', 'lr-add', '＋ Add');
        addB.onclick = async e => {
          e.stopPropagation();
          await ensureExercise(r.item);
          renderTab();
        };
        row.appendChild(addB);
        row.onclick = async () => {
          const ex = await ensureExercise(r.item, true);
          openDetail(ex.id, 'library', !true);
        };
      }
      list.appendChild(row);
    }
    if (!list.children.length) list.appendChild(el('div', 'empty-state', 'Nothing matches.'));
  }

  async function installStarter() {
    const sb = window.STARTER_BLOCK;
    if (!sb) return;
    const days = [];
    for (const day of sb.days) {
      const items = [];
      for (const it of day.items) {
        const libItem = (window.EXERCISE_LIBRARY || []).find(l => l.name === it.ex);
        const ex = await ensureExercise(libItem || { name: it.ex, group: 'Other', notes: '' });
        items.push({ exerciseId: ex.id, sets: it.sets, repLo: it.repLo, repHi: it.repHi, kg: 0 });
      }
      days.push({ name: day.name, items });
    }
    await DB.put('plans', {
      id: DB.uid(), createdAt: Date.now(), name: sb.name, weeks: sb.weeks,
      days, startDate: null, completed: [], finishedAt: null,
      prefDays: [0, 2, 4]
    });
    renderTab();
  }

  /* The catalog belongs to the app, not to the user: deleting one of its
     exercises would take the logged history with it, and the row would come
     straight back as an unadded library item anyway. Only exercises somebody
     wrote themselves can be removed. Records saved before this flag existed
     are judged by whether the catalog recognises the name. */
  const CATALOG_NAMES = new Set((window.EXERCISE_LIBRARY || []).map(i => i.name.toLowerCase()));
  const isCatalogName = n => CATALOG_NAMES.has(String(n || '').toLowerCase());
  const isCustomEx = ex => !!ex && (ex.custom === true
    || (ex.custom === undefined && !isCatalogName(ex.name)));

  async function ensureExercise(item) {
    let ex = exercises.find(e => e.name.toLowerCase() === item.name.toLowerCase());
    if (ex) return ex;
    ex = {
      id: DB.uid(), createdAt: Date.now(), mediaIds: [], custom: false,
      name: item.name, group: item.group, notes: item.notes, demo: item.demo || null
    };
    await DB.put('exercises', ex);
    exercises.push(ex);
    exercises.sort((a, b) => a.name.localeCompare(b.name));
    return ex;
  }

  /* ============================================================
     EXERCISE DETAIL
     ============================================================ */
  /* The detail page can be reached without ever opening the library, so it
     asks for the content itself rather than assuming it is already loaded. */
  async function contentForDetail(ex) {
    await loadContent();
    return contentFor(ex);
  }

  /* Which muscles the taxonomy says this movement works, split into the ones
     doing the job and the ones helping. The content layer lists what to draw;
     the library record says which of those are primary. */
  function muscleSets(ex, con) {
    if (!con) return null;
    const m = con.media || {};
    const drawn = [...(m.muscle_map_front || []), ...(m.muscle_map_back || [])];
    if (!drawn.length) return null;
    const lib = LIB_BY_ID[contentIdFor(ex)];
    const alias = window.MUSCLE_ALIAS || {};
    const expand = list => new Set((list || []).flatMap(t => alias[t] || []));
    const pri = expand(lib && lib.primary);
    /* nothing to go on — treat everything drawn as primary rather than
       greying out the whole figure */
    const primary = drawn.filter(id => pri.has(id));
    return primary.length
      ? { primary: new Set(primary), secondary: new Set(drawn.filter(id => !pri.has(id))) }
      : { primary: new Set(drawn), secondary: new Set() };
  }

  function musclePanel(ex, con) {
    const sets = muscleSets(ex, con);
    if (!sets || !window.BODY_SVG) return null;
    const wrap = el('div', 'det-sec');
    wrap.appendChild(el('div', 'micro', 'Muscles worked'));

    const figs = el('div', 'an-row');
    for (const [view, label] of [['front', 'Front'], ['back', 'Back']]) {
      const col = el('div', 'an-col');
      const holder = el('div', 'an-holder');
      holder.innerHTML = window.BODY_SVG[view];
      /* the drawing is coarser than the taxonomy, so fold the muscles onto
         the regions it has; a region lights at the strongest level any of the
         muscles landing on it reaches */
      const T = window.TAXON_REGION || {};
      const regions = level => {
        const out = new Set();
        level.forEach(id => [].concat(T[id] || []).forEach(r => out.add(r)));
        return out;
      };
      const pri = regions(sets.primary), sec = regions(sets.secondary);
      holder.querySelectorAll('[data-m]').forEach(node => {
        const r = node.getAttribute('data-m');
        if (pri.has(r)) node.classList.add('pri');
        else if (sec.has(r)) node.classList.add('sec');
      });
      col.appendChild(holder);
      col.appendChild(el('div', 'an-cap', label));
      figs.appendChild(col);
    }
    wrap.appendChild(figs);

    /* named, so it reads without having to decode the picture */
    const names = el('div', 'an-chips');
    const show = (ids, cls) => [...ids]
      .map(id => MUSCLE_NAME[id] || id)
      .filter((v, i, a) => a.indexOf(v) === i)
      .forEach(n => names.appendChild(el('span', cls, n)));
    show(sets.primary, 'pri');
    show(sets.secondary, 'sec');
    wrap.appendChild(names);
    return wrap;
  }

  /* ---------------- this exercise's place in your block ----------------
     Where you add it to a day, take it out, or open the day to change its
     sets and reps. Everything here is the block itself, so it holds for
     every week from the next session on — unlike the pass and remove
     buttons in a live session, which are about today only. */
  function blockMembership(ex) {
    const wrap = el('div', 'det-sec');
    const plan = activePlan();
    wrap.appendChild(el('div', 'micro', 'In your block'));
    if (!plan || !(plan.days || []).length) {
      wrap.appendChild(el('div', 'det-hard-note',
        'No block is running yet — build one in Blocks and this exercise can go in it.'));
      return wrap;
    }
    const save = async () => {
      await DB.put('plans', plan);
      plans = await DB.all('plans');
      openDetail(ex.id, detailReturn);
    };
    const list = el('div', 'blk-mem');
    let inAny = false;
    plan.days.forEach((day, di) => {
      const item = (day.items || []).find(it => it.exerciseId === ex.id);
      if (!item) return;
      inAny = true;
      const r = el('div', 'bm-row');
      const c = el('div');
      c.appendChild(el('div', 'bm-day', `${plan.name} · ${day.name}`));
      c.appendChild(el('div', 'bm-scheme num', `${item.sets} × ${item.repLo}–${item.repHi}`));
      r.appendChild(c);
      const drop = el('button', 'bm-btn warn', 'Remove');
      drop.title = 'Take it out of the block for good';
      drop.onclick = async () => {
        if (!await appConfirm({
          title: `Remove from ${day.name}?`,
          body: `It comes out of "${plan.name}" from the next session on — this week and every week after. `
            + 'Your logged history is kept.',
          ok: 'Remove', cancel: 'Keep it', warn: true
        })) return;
        day.items = day.items.filter(it => it.exerciseId !== ex.id);
        await save();
      };
      r.appendChild(drop);
      list.appendChild(r);
    });
    if (inAny) wrap.appendChild(list);
    else wrap.appendChild(el('div', 'det-hard-note',
      `Not in "${plan.name}" yet. Add it to a day and it is there every week.`));

    const free = plan.days.map((d, i) => [d, i]).filter(([d]) => !(d.items || []).some(it => it.exerciseId === ex.id));
    if (free.length) {
      const add = el('div', 'bm-add');
      add.appendChild(el('span', 'bm-add-lbl', inAny ? 'Also add to' : 'Add to'));
      free.forEach(([day, di]) => {
        const b = el('button', 'bm-btn add', '＋ ' + day.name);
        b.onclick = async () => {
          plan.days[di].items = plan.days[di].items || [];
          plan.days[di].items.push({ exerciseId: ex.id, sets: 3, repLo: 8, repHi: 12, kg: 0 });
          haptic();
          await save();
        };
        add.appendChild(b);
      });
      wrap.appendChild(add);
    }
    wrap.appendChild(el('div', 'det-hard-note',
      'Changes here are permanent. To skip it just for today, use Pass on its card during a session.'));
    return wrap;
  }

  async function openDetail(exId, from) {
    detailReturn = from || 'library';
    const ex = await DB.get('exercises', exId);
    if (!ex) return;
    const sessions = (await DB.all('sessions')).filter(s => s.exerciseId === exId).sort((a, b) => b.ts - a.ts);
    const root = $('#view-detail');
    root.innerHTML = '';

    const hero = el('div', 'det-hero');
    hero.appendChild(animFor(ex));   // the movement plays here, on the open page
    const back = el('button', 'det-back', '‹');
    back.onclick = goBackFromDetail;
    hero.appendChild(back);
    root.appendChild(hero);

    const body = el('div', 'det-body');
    body.appendChild(el('div', 'det-title', ex.name));
    /* how hard it is sits directly under the name, above everything else the
       page has to say — it decides whether the rest is even relevant to you */
    await loadContent();
    const hardLine = el('div', 'det-hard');
    const hchip = hardChip(ex, 'big');
    if (hchip) {
      hardLine.appendChild(hchip);
      hardLine.appendChild(el('span', 'det-hard-note', hardshipOf(ex).note));
      body.appendChild(hardLine);
    }
    const tags = el('div', 'tag-row');
    if (ex.group) tags.appendChild(el('span', 'hl', ex.group));
    if (isBarbell(ex)) tags.appendChild(el('span', null, 'Barbell'));
    if (ex.rest) tags.appendChild(el('span', null, 'Rest ' + fmtClock(ex.rest)));
    body.appendChild(tags);

    /* the written entry, if this movement has one — what it is for, and which
       muscles it actually works */
    const con = await contentForDetail(ex);
    if (con && con.description) {
      const d = el('div', 'det-sec');
      d.appendChild(el('div', 'micro', 'What it is for'));
      d.appendChild(el('div', 'det-desc', con.description));
      body.appendChild(d);
    }
    const muscles = musclePanel(ex, con);
    if (muscles) body.appendChild(muscles);

    body.appendChild(blockMembership(ex));

    if (ex.notes) {
      const cuesWrap = el('div');
      cuesWrap.appendChild(el('div', 'micro', 'Form cues'));
      cuesWrap.lastChild.style.marginBottom = '10px';
      const cues = ex.notes.split(/(?<=[.!])\s+/).filter(Boolean).slice(0, 3);
      cues.forEach((cue, i) => {
        const r = el('div', 'cue-row');
        r.appendChild(el('div', 'cue-num', String(i + 1)));
        r.appendChild(el('div', 'cue-txt', cue));
        cuesWrap.appendChild(r);
      });
      body.appendChild(cuesWrap);
    }

    // stat cards
    const stats = el('div', 'det-stats');
    const lastKg = sessions.length ? Math.max(...sessions[0].sets.map(s => s.weight || 0)) : 0;
    const bestRM = sessions.length ? Math.round(Math.max(...sessions.flatMap(s => s.sets.map(x => est1RM(x.weight || 0, x.reps))))) : 0;
    stats.appendChild(detStat(lastKg ? fmtWn(lastKg) : '—', wUnit(), 'Working weight'));
    stats.appendChild(detStat(bestRM ? fmtWn(bestRM) : '—', wUnit(), 'Est. 1RM'));
    stats.appendChild(detStat(String(sessions.length), '', 'Sessions'));
    body.appendChild(stats);

    // weight (or best set) history graph — one point per session
    {
      const asc = [...sessions].sort((a, b) => a.ts - b.ts);
      const hasWeight = asc.some(s => s.sets.some(x => (x.weight || 0) > 0));
      const pts = asc.map(s => ({
        ts: s.ts,
        kg: hasWeight
          ? Math.max(...s.sets.map(x => x.weight || 0))
          : Math.max(...s.sets.map(x => x.reps || 0))
      })).filter(p => p.kg > 0);
      if (pts.length >= 2) {
        const gWrap = el('div');
        const lbl = el('div', 'micro', hasWeight ? 'Weight over time' : 'Best set over time');
        gWrap.appendChild(lbl);
        const g = el('div', 'bw-graph');
        g.innerHTML = bwGraphSVG(pts);
        gWrap.appendChild(g);
        body.appendChild(gWrap);
      }
    }

    // user media
    if (ex.mediaIds && ex.mediaIds.length) {
      const strip = el('div', 'media-strip');
      for (const mid of ex.mediaIds) {
        const rec = await DB.get('media', mid);
        if (!rec) continue;
        const url = await mediaURL(mid);
        let m;
        if (rec.type.startsWith('video')) {
          m = document.createElement('video');
          m.src = url; m.muted = true; m.playsInline = true; m.preload = 'metadata';
        } else {
          m = document.createElement('img');
          m.src = url;
        }
        m.onclick = () => {
          const bodyV = $('#media-viewer-body');
          bodyV.innerHTML = '';
          let big;
          if (rec.type.startsWith('video')) {
            big = document.createElement('video'); big.src = url; big.controls = true; big.playsInline = true;
          } else { big = document.createElement('img'); big.src = url; }
          bodyV.appendChild(big);
          $('#media-viewer').hidden = false;
        };
        strip.appendChild(m);
      }
      body.appendChild(strip);
    }

    const acts = el('div', 'det-actions');
    const backBtn = el('button', 'btn-cta back-sign');
    backBtn.innerHTML = '<svg viewBox="0 0 16 14" width="18" height="16"><path d="M7 1.5 L1.5 7 L7 12.5 M2 7 H14.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    backBtn.title = detailReturn === 'workout' ? 'Back to workout' : 'Back';
    backBtn.onclick = goBackFromDetail;
    acts.appendChild(backBtn);
    const mine = isCustomEx(ex);
    /* Taking it off your list is yours to do either way. Rewriting a premade
       one is not: its name is the key its injury and equipment tags hang off,
       so renaming it would quietly strip them. */
    const removeBtn = el('button', 'btn-ghost', mine ? 'Delete' : 'Remove');
    removeBtn.onclick = async () => {
      const plansAll = await DB.all('plans');
      const usedIn = plansAll.filter(p => (p.days || []).some(d => d.items.some(it => it.exerciseId === ex.id)));
      const bits = [];
      if (sessions.length) bits.push(`${sessions.length} logged session${sessions.length > 1 ? 's' : ''}`);
      if (usedIn.length) bits.push(`its place in ${usedIn.map(p => `"${p.name}"`).join(', ')}`);
      if (!await appConfirm({
        title: mine ? `Delete ${ex.name}?` : `Remove ${ex.name}?`,
        body: (bits.length ? `This also drops ${bits.join(' and ')}. ` : '')
          + (mine ? 'It is yours, so it goes for good.'
                  : 'It stays in the library — add it again any time.'),
        ok: mine ? 'Delete' : 'Remove', cancel: 'Keep it', warn: true
      })) return;
      for (const mid of (ex.mediaIds || [])) await DB.del('media', mid);
      for (const s of sessions) await DB.del('sessions', s.id);
      for (const p of usedIn) {
        for (const d of p.days) d.items = d.items.filter(it => it.exerciseId !== ex.id);
        await DB.put('plans', p);
      }
      await DB.del('exercises', ex.id);
      goBackFromDetail();
    };
    if (mine) {
      const editBtn = el('button', 'btn-ghost', 'Edit');
      editBtn.onclick = () => openExerciseForm(ex);
      acts.appendChild(editBtn);
    }
    acts.appendChild(removeBtn);
    body.appendChild(acts);
    if (!mine) {
      body.appendChild(el('div', 'det-locked',
        'The name, cues and photos come from the library and stay as they are. '
        + 'Remove takes it off your list; add your own exercise if you want one you can rewrite.'));
    }
    root.appendChild(body);
    show('detail');
  }
  function detStat(v, unit, l) {
    const c = el('div', 'card');
    const val = el('div', 'v num', v + (unit ? ' ' : ''));
    if (unit) val.appendChild(el('small', null, unit));
    c.appendChild(val);
    c.appendChild(el('div', 'l', l));
    return c;
  }
  function goBackFromDetail() {
    if (detailReturn === 'workout' && live.get()) { show('workout'); renderWorkout(); }
    else if (detailReturn === 'plan') { show('plan'); renderTab(); }
    else if (detailReturn === 'stats') { show('stats'); renderTab(); }
    else { show('library'); renderTab(); }
  }

  /* ============================================================
     EXERCISE FORM (own exercises)
     ============================================================ */
  function openExerciseForm(ex) {
    /* the form only ever edits the user's own; premade exercises are read-only
       and there is no route here for them, but refuse anyway */
    if (ex && !isCustomEx(ex)) return;
    editingExerciseId = ex ? ex.id : null;
    pendingMedia = [];
    const form = $('#form-exercise');
    form.reset();
    $('#sheet-exercise-title').textContent = ex ? 'Edit exercise' : 'New exercise';
    if (ex) {
      form.name.value = ex.name;
      form.group.value = ex.group || 'Other';
      form.hardship.value = String((hardshipOf(ex) || { n: 1 }).n);
      form.notes.value = ex.notes || '';
      (ex.mediaIds || []).forEach(id => pendingMedia.push({ existingId: id }));
    }
    renderMediaPreview();
    openSheet('#sheet-exercise');
  }
  $('#exercise-media-input').onchange = e => {
    for (const f of e.target.files) pendingMedia.push({ file: f });
    e.target.value = '';
    renderMediaPreview();
  };
  async function renderMediaPreview() {
    const strip = $('#media-preview');
    strip.innerHTML = '';
    for (let i = 0; i < pendingMedia.length; i++) {
      const item = pendingMedia[i];
      let type, url;
      if (item.file) {
        type = item.file.type;
        if (!item.url) item.url = URL.createObjectURL(item.file);
        url = item.url;
      } else {
        const rec = await DB.get('media', item.existingId);
        if (!rec) continue;
        type = rec.type;
        url = await mediaURL(rec.id);
      }
      const wrap = el('div', 'media-item');
      let m;
      if (type.startsWith('video')) {
        m = document.createElement('video');
        m.src = url; m.muted = true; m.playsInline = true; m.preload = 'metadata';
      } else { m = document.createElement('img'); m.src = url; }
      wrap.appendChild(m);
      const rm = el('button', 'remove-media', '✕');
      rm.type = 'button';
      rm.onclick = () => { pendingMedia.splice(i, 1); renderMediaPreview(); };
      wrap.appendChild(rm);
      strip.appendChild(wrap);
    }
  }
  $('#form-exercise').onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    const ex = editingExerciseId
      ? await DB.get('exercises', editingExerciseId)
      : { id: DB.uid(), createdAt: Date.now(), mediaIds: [] };
    /* settle what this exercise is before the name changes — otherwise
       renaming a library exercise would make it look like the user's own and
       hand them a Delete button for it */
    const wasCustom = editingExerciseId ? isCustomEx(ex) : null;
    ex.name = f.name.value.trim();
    ex.group = f.group.value;
    /* your own rating, so a movement you invented still says how hard it is
       under its name like every other one */
    ex.hardship = Math.min(3, Math.max(1, +f.hardship.value || 1));
    ex.notes = f.notes.value.trim();
    /* Anything written here is the user's own and stays deletable — unless
       they have typed the name of something already in the catalog, in which
       case it is that exercise and the catalog's rules apply. */
    ex.custom = editingExerciseId ? wasCustom : !isCatalogName(ex.name);
    if (!ex.demo) {
      const item = (window.EXERCISE_LIBRARY || []).find(i => i.demo && i.name.toLowerCase() === ex.name.toLowerCase());
      if (item) ex.demo = item.demo;
    }
    const kept = pendingMedia.filter(m => m.existingId).map(m => m.existingId);
    for (const oldId of (ex.mediaIds || [])) {
      if (!kept.includes(oldId)) await DB.del('media', oldId);
    }
    const ids = [];
    for (const m of pendingMedia) {
      if (m.existingId) { ids.push(m.existingId); continue; }
      const id = DB.uid();
      await DB.put('media', { id, exerciseId: ex.id, type: m.file.type, blob: m.file });
      ids.push(id);
    }
    ex.mediaIds = ids;
    await DB.put('exercises', ex);
    if (!exercises.some(e => e.id === ex.id)) {
      exercises.push(ex);
      exercises.sort((a, b) => a.name.localeCompare(b.name));
    }
    /* written from the dial sheet: put it where they were adding it rather
       than making them go find it again */
    if (pickerAfterSave) {
      const spec = pickerAfterSave;
      pickerAfterSave = null;
      sheetBack = null;
      addTarget = null;
      await spec.onPick(ex, spec.sets, spec.reps);
      return;
    }
    closeSheets();
    renderTab();
  };

  /* ============================================================
     PLAN FORM
     ============================================================ */
  /* every length a block can be, including the odd numbers a deload week
     produces — the dropdown only offered 2 to 6 */
  const EDIT_WEEKS = Array.from({ length: 15 }, (_, i) => i + 2);

  function openPlanForm(plan, template) {
    editingPlanId = plan ? plan.id : null;
    const src = plan || template;
    planDraft = src
      ? {
          weeks: src.weeks || 4,
          days: (src.days || []).map(d => ({
            name: d.name,
            items: d.items.map(i => ({
              exerciseId: i.exerciseId, sets: i.sets || 3,
              repLo: i.repLo || i.reps || 8, repHi: i.repHi || i.reps || 12, kg: i.kg || 0
            }))
          }))
        }
      : { weeks: 4, days: [{ name: 'Day 1', items: [] }] };
    const form = $('#form-plan');
    form.reset();
    form.name.value = plan ? plan.name : (template ? `Block ${blockNumber(template) + 1}` : '');
    $('#sheet-plan-title').textContent = plan ? 'Edit block' : 'New block';
    /* length on the same rail the builder uses, rather than a dropdown —
       and it runs the full range, because a block built with a deload week
       is an odd number of weeks that the old five options could not hold */
    planDraft.deload = plan ? !!plan.deload : false;
    const wRoot = $('#plan-weeks');
    wRoot.innerHTML = '';
    const note = $('#plan-weeks-note');
    const sayLen = () => {
      note.textContent = `${planDraft.weeks} week${planDraft.weeks === 1 ? '' : 's'}`
        + (planDraft.deload ? ' — the last one is a deload' : '');
    };
    const ix = EDIT_WEEKS.indexOf(planDraft.weeks);
    wRoot.appendChild(optionRail(EDIT_WEEKS.map(String), ix < 0 ? EDIT_WEEKS.indexOf(4) : ix,
      i => { planDraft.weeks = EDIT_WEEKS[i]; sayLen(); }, 62));
    if (ix < 0) planDraft.weeks = 4;
    sayLen();
    renderPlanDays();
    openSheet('#sheet-plan');
  }

  function renderPlanDays() {
    const wrap = $('#plan-days');
    wrap.innerHTML = '';
    planDraft.days.forEach((day, di) => {
      const card = el('div', 'pf-day');
      const head = el('div', 'pf-day-head');
      const nameIn = document.createElement('input');
      nameIn.type = 'text';
      nameIn.value = day.name;
      nameIn.placeholder = 'Day name (Push, Legs…)';
      nameIn.oninput = () => day.name = nameIn.value;
      head.appendChild(nameIn);
      if (planDraft.days.length > 1) {
        const del = el('button', 'del', '✕');
        del.type = 'button';
        del.onclick = () => { planDraft.days.splice(di, 1); renderPlanDays(); };
        head.appendChild(del);
      }
      card.appendChild(head);

      day.items.forEach((item, ii) => {
        const ex = exercises.find(e => e.id === item.exerciseId);
        /* the name gets the whole width — squeezing it beside four number
           boxes turned "Machine Chest Press" into "Machine Chest …" */
        const r = el('div', 'pf-item');
        const top = el('div', 'pf-item-top');
        top.appendChild(el('span', 'n', ex ? ex.name : '(deleted)'));
        const del = el('button', 'del', '✕');
        del.type = 'button';
        del.title = 'Take it out of this day';
        del.onclick = () => { day.items.splice(ii, 1); renderPlanDays(); };
        top.appendChild(del);
        r.appendChild(top);
        const nums = el('div', 'pf-item-nums');
        nums.appendChild(el('span', 'lbl', 'sets'));
        nums.appendChild(numIn(item.sets, v => item.sets = v));
        nums.appendChild(el('span', 'x', '×'));
        nums.appendChild(el('span', 'lbl', 'reps'));
        nums.appendChild(numIn(item.repLo, v => item.repLo = v));
        nums.appendChild(el('span', 'x', '–'));
        nums.appendChild(numIn(item.repHi, v => item.repHi = v));
        r.appendChild(nums);
        card.appendChild(r);
      });

      const add = el('button', 'pf-add', '＋ Add exercise');
      add.type = 'button';
      /* the same three dials the live session uses — one way of picking an
         exercise, wherever you are picking one */
      add.onclick = () => openDialPicker({
        title: 'Add to ' + (day.name || 'this day'),
        cta: 'Add to ' + (day.name || 'this day'),
        back: () => openSheet('#sheet-plan'),
        onPick: async (item, sets, reps) => {
          const rec = await ensureExercise(item);
          day.items.push({ exerciseId: rec.id, sets, repLo: reps.lo, repHi: reps.hi, kg: 0 });
          haptic();
          renderPlanDays();
          openSheet('#sheet-plan');
        }
      });
      card.appendChild(add);
      wrap.appendChild(card);
    });
  }
  function numIn(val, set) {
    const i = document.createElement('input');
    i.type = 'number'; i.min = '1'; i.inputMode = 'numeric';
    i.value = val;
    i.oninput = () => set(Number(i.value) || 1);
    return i;
  }
  $('#plan-add-day').onclick = () => {
    planDraft.days.push({ name: `Day ${planDraft.days.length + 1}`, items: [] });
    renderPlanDays();
  };
  $('#form-plan').onsubmit = async e => {
    e.preventDefault();
    const days = planDraft.days.filter(d => d.items.length);
    if (!days.length) { alert('Add at least one exercise to a training day.'); return; }
    const plan = editingPlanId
      ? await DB.get('plans', editingPlanId)
      : { id: DB.uid(), createdAt: Date.now(), startDate: null, completed: [], finishedAt: null };
    plan.name = e.target.name.value.trim();
    plan.weeks = planDraft.weeks || 4;
    plan.days = days.map(d => ({ name: d.name.trim() || 'Day', items: d.items }));
    delete plan.items;
    await DB.put('plans', plan);
    closeSheets();
    show('today');
    renderTab();
  };

  /* ============================================================
     BOOT
     ============================================================ */
  DB.persist();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  async function migrate() {
    // plans: items -> days; reps -> repLo/repHi
    const allPlans = await DB.all('plans');
    for (const p of allPlans) {
      let dirty = false;
      if (p.items && !p.days) {
        p.days = [{ name: 'Day 1', items: p.items }];
        delete p.items;
        p.weeks = p.weeks || 4;
        dirty = true;
      }
      for (const d of (p.days || [])) {
        for (const it of d.items) {
          if (!it.repLo) { it.repLo = it.reps || 8; it.repHi = it.repHi || it.reps || 12; dirty = true; }
        }
      }
      if (!p.prefDays) {
        const presets = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
        p.prefDays = presets[(p.days || []).length] || [0, 2, 4];
        dirty = true;
      }
      if (dirty) await DB.put('plans', p);
    }
    // exercises: attach demos by name
    const allEx = await DB.all('exercises');
    for (const ex of allEx) {
      if (ex.demo) continue;
      const item = (window.EXERCISE_LIBRARY || []).find(
        i => i.demo && i.name.toLowerCase() === ex.name.toLowerCase());
      if (item) { ex.demo = item.demo; await DB.put('exercises', ex); }
    }

    // heal orphaned "(deleted)" slots in the starter block: re-create the
    // template exercise that's missing from that day and re-link the slot
    const sb = window.STARTER_BLOCK;
    if (sb) {
      const exs = await DB.all('exercises');
      const exists = id => exs.some(e => e.id === id);
      for (const p of allPlans) {
        if (p.name !== sb.name) continue;
        let dirty = false;
        for (const d of (p.days || [])) {
          const tmplDay = sb.days.find(td => td.name === d.name);
          if (!tmplDay || !d.items.some(it => !exists(it.exerciseId))) continue;
          const presentNames = new Set(d.items.filter(it => exists(it.exerciseId))
            .map(it => exs.find(e => e.id === it.exerciseId).name.toLowerCase()));
          const missing = tmplDay.items.filter(ti => !presentNames.has(ti.ex.toLowerCase()));
          const healed = [];
          for (const it of d.items) {
            if (exists(it.exerciseId)) { healed.push(it); continue; }
            const ti = missing.shift();
            dirty = true;
            if (!ti) continue;   // nothing sensible to re-link — drop the dead slot
            let ex = exs.find(e => e.name.toLowerCase() === ti.ex.toLowerCase());
            if (!ex) {
              const libItem = (window.EXERCISE_LIBRARY || []).find(l => l.name === ti.ex);
              ex = {
                id: DB.uid(), createdAt: Date.now(), mediaIds: [],
                name: ti.ex, group: (libItem || {}).group || 'Other',
                notes: (libItem || {}).notes || '', demo: (libItem || {}).demo || null
              };
              await DB.put('exercises', ex);
              exs.push(ex);
            }
            healed.push({ exerciseId: ex.id, sets: ti.sets, repLo: ti.repLo, repHi: ti.repHi, kg: it.kg || 0 });
          }
          d.items = healed;
        }
        if (dirty) await DB.put('plans', p);
      }
    }
  }

  /* iOS standalone cold-start reports a stale viewport height to CSS, so the
     tab bar and sheets are anchored to --winH: the window height measured by
     JS, re-checked every second and on every resize. Self-corrects always. */
  function setWinH() {
    let h = window.innerHeight;
    // Installed app is fullscreen by definition — trust the physical screen
    // height (which iOS reports correctly even when innerHeight is stale).
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (standalone && screen && screen.height && window.matchMedia('(orientation: portrait)').matches) {
      h = Math.max(h, screen.height);
    }
    if (setWinH.last !== h) {
      setWinH.last = h;
      document.documentElement.style.setProperty('--winH', h + 'px');
    }
  }
  setWinH();
  setInterval(setWinH, 1000);

  window.addEventListener('resize', setWinH);
  window.addEventListener('orientationchange', () => setTimeout(setWinH, 100));
  window.addEventListener('pageshow', setWinH);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', setWinH);

  /* self-update: when the server has a newer build, reload once to pick it
     up — on launch and whenever the app returns to the foreground. Never
     mid-workout. */
  async function checkUpdate() {
    try {
      /* never reload mid-set, but a paused session is not mid-set — and it
         survives a reload intact, so holding back only strands you on an old
         build for as long as the pause lasts */
      const lwU = live.get();
      if (lwU && !lwU.pausedAt) return;
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      const j = await r.json();
      if (j.v && j.v !== APP_VERSION && sessionStorage.getItem('reloadedFor') !== j.v) {
        sessionStorage.setItem('reloadedFor', j.v);
        location.reload();
      }
    } catch { /* offline — try again next time */ }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });

  migrate().then(() => {
    const lw = live.get();
    if (lw) { show('workout'); renderTab().then(renderWorkout); }
    else renderTab();
    /* the written entries carry how hard each movement is, and that now sits
       under the name on every screen — so fetch them at launch rather than
       waiting for someone to open the library */
    loadContent().then(() => {
      renderTab();
      if (!$('#view-workout').hidden) renderWorkout();
    }).catch(() => {});
    if (lw && lw.restEndsAt) armRestTick();
    [100, 600, 1500].forEach(t => setTimeout(setWinH, t));
    checkUpdate();
  });
})();
