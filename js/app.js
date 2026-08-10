/* RACKSIDE — strength training app. All data on-device (IndexedDB). */
(() => {
  'use strict';
  const APP_VERSION = 'v116';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
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
  let pickCallback = null;
  let pickFilter = 'All';
  let statsLift = null;
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

  /* ---------------- pure logic (design spec) ---------------- */
  const est1RM = (kg, reps) => reps > 0 ? kg * (1 + reps / 30) : 0;   // Epley

  function suggestion(sets) {
    const logged = sets.filter(s => s.done);
    if (!logged.length) return { kind: 'idle' };
    const last = logged[logged.length - 1];
    if (last.reps >= last.targetHi) return { kind: 'increase', step: 2.5, nextKg: last.kg + 2.5, last };
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
  function weekOf(plan) {
    if (!plan.startDate) return null;
    return Math.min(planWeek(plan) || 1, progressWeek(plan), plan.weeks || 4);
  }
  const planFinished = p => !!p.finishedAt;

  function activePlan() {
    const open = plans.filter(p => !planFinished(p));
    if (open.length) return open.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    return plans.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
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
    const ph = el('div', 'demo-anim ph' + (extra ? ' ' + extra : ''), '🏋️');
    return ph;
  }
  function animFor(ex, extra) {
    if (ex && ex.demo) return demoEl(ex.demo, extra, false);
    const ph = el('div', 'demo-anim ph' + (extra ? ' ' + extra : ''), '🏋️');
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

  /* ---------------- sheets ---------------- */
  function openSheet(id) { closeSheets(); $('#sheet-backdrop').hidden = false; $(id).hidden = false; }
  function closeSheets() { $('#sheet-backdrop').hidden = true; $$('.sheet').forEach(s => s.hidden = true); }
  $('#sheet-backdrop').onclick = () => { closeSheets(); renderTab(); };
  $$('[data-close]').forEach(b => b.onclick = closeSheets);
  $('#media-viewer-close').onclick = () => { $('#media-viewer-body').innerHTML = ''; $('#media-viewer').hidden = true; };

  /* ---------------- navigation ---------------- */
  const VIEWS = ['today', 'plan', 'cardio', 'stats', 'library', 'profile', 'workout', 'summary', 'detail'];
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
      const b = el('button', i < curWeek ? 'past' : (i === curWeek ? 'current' : ''), 'W' + i);
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
        `You moved ${fmtKg(vol)} kg across ${workouts.filter(x => x.planId === plan.id).length} sessions this block. ` +
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
        meta = `In progress · ${fmtClock(Math.floor((Date.now() - lwNow.startedAt) / 1000))} elapsed`;
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
          r.appendChild(el('div', 'exi-name', ex ? ex.name : '(deleted)'));
          r.appendChild(el('div', 'exi-scheme', `${it.sets || 3} × ${it.repLo || 8}–${it.repHi || 12}${it.kg ? ' · ' + fmtKg(it.kg) + ' kg' : ''}`));
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
      base.appendChild(bs(fmtKg(wkVol0), 'Kg this week', 'earn'));
      root.appendChild(base);

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
        cta.appendChild(document.createTextNode(' Resume ' + day.name));
        cta.onclick = () => { show('workout'); renderWorkout(); };
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
        repLo: lo, repHi: hi, rest: ex.rest || 120,
        sets: Array.from({ length: item.sets || 3 }, (_, si) => {
          const prev = lastSets ? lastSets[si] : null;
          // start every set at the heaviest weight you reached last time —
          // weight you earned mid-session carries into the whole next session
          const kg = lastMax || item.kg || 0;
          const reps = (prev && prev.reps) || lo;
          return { kg, reps, targetLo: lo, targetHi: hi, done: false };
        })
      });
    }
    live.set({
      planId: plan.id, dayIndex, dayName: day.name,
      startedAt: Date.now(), exIndex: 0,
      restEndsAt: null, restLen: exList[0] ? exList[0].rest : 120, pickerOpen: false,
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
    const head = el('div', 'w-head');
    const hl = el('div', 'w-left');
    const liveRow = el('div', 'w-live');
    liveRow.appendChild(el('i', 'live-dot'));
    liveRow.appendChild(document.createTextNode(` Live · ${lw.dayName}`));
    hl.appendChild(liveRow);
    const clock = el('div', 'w-clock num', '0:00');
    hl.appendChild(clock);
    head.appendChild(hl);

    const banked = lw.exercises.reduce((a, e2) => a + e2.sets.filter(x => x.done).length, 0);
    const totSets = lw.exercises.reduce((a, e2) => a + e2.sets.length, 0);
    const bank = el('div', 'w-banked');
    bank.appendChild(el('div', 'v num', `${banked}/${totSets}`));
    bank.appendChild(el('div', 'l', 'Sets banked'));
    head.appendChild(bank);

    const btns = el('div', 'w-btns');
    const fin = el('button', 'w-chip fin');
    fin.innerHTML = '<svg viewBox="0 0 14 14" width="15" height="15"><path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    fin.title = 'Finish workout';
    fin.onclick = () => finishWorkout();
    const pause = el('button', 'w-chip');
    pause.appendChild(svgIcon(PAUSE, 11));
    pause.title = 'Pause — resume from Today';
    pause.onclick = () => { show('today'); renderTab(); };
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
      const s = el('span', (allDone ? 'done' : (someDone ? 'part' : '')) + (i === lw.exIndex ? ' cur' : ''));
      s.onclick = () => { lw.exIndex = i; lw.advanceAfterRest = false; live.set(lw); scrollToEx = true; renderWorkout(); };
      prog.appendChild(s);
    });
    head.appendChild(prog);
    root.appendChild(head);
    clearInterval(elapsedInt);
    const tickClock = () => clock.textContent = fmtClock(Math.floor((Date.now() - lw.startedAt) / 1000));
    tickClock();
    elapsedInt = setInterval(tickClock, 1000);

    // ---- the rail: every exercise threaded on one line ----
    const rail = el('div', 'rail');
    lw.exercises.forEach((cur2, ei) => {
      rail.appendChild(exerciseCard(lw, cur2, ei, sessions));
    });
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
    const active = ei === lw.exIndex;
    const card = el('div', 'exx' + (active ? ' active' : '') + (allDone ? ' is-done' : ''));

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
    col.appendChild(el('div', 'exx-meta',
      `${(ex && ex.group) ? ex.group + ' · ' : ''}${cur.sets.length} × ${cur.repLo}–${cur.repHi}${cur.timed ? (cur.perSide ? ' s / side' : ' s') : ''}`));
    hd.appendChild(col);
    const doneN = cur.sets.filter(s => s.done).length;
    hd.appendChild(el('div', 'exx-count num', `${doneN}/${cur.sets.length}`));
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
      if (allDone) {
        const sum = el('div', 'exx-sum num',
          cur.sets.map(s => cur.timed ? `${s.reps}s` : `${fmtKg(s.kg)} × ${s.reps}`).join('  ·  '));
        if (cur.feel) sum.appendChild(el('span', 'hd-feel ' + cur.feel, cur.feel));
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
        const rv = $('#val-reps-' + ei + '-' + i);
        if (rv) {
          rv.textContent = String(s.reps);
          rv.classList.remove('pending', 'inrange', 'below', 'above');
          rv.classList.add(repTone(s));
        }
        const hb = $('#hold-' + ei + '-' + i);
        if (hb && !(holdInt && holdExIdx === ei && holdIdx === i)) {
          hb.textContent = '';
          hb.appendChild(svgIcon(PLAY, 9));
          hb.appendChild(document.createTextNode(' ' + fmtClock(s.reps)));
        }
      });
      const ps = $('#plate-live-' + ei);
      if (ps) {
        const fp = cur.sets.find(s => !s.done) || cur.sets[cur.sets.length - 1];
        const plates = plateMath(fp.kg);
        ps.textContent = plates.length ? '20 + ' + plates.join(' + ') : 'bar only';
      }
    };

    // column headers — the rep range lives here, never inline in a row
    const gh = el('div', 'set-grid-head');
    ['#', 'Kg', `${cur.timed ? 'Sec' : 'Reps'} · ${cur.repLo}–${cur.repHi}`, 'Log'].forEach(t => gh.appendChild(el('span', null, t)));
    card.appendChild(gh);

    // set rows — weight is a tap target that opens the scale inside the row
    cur.sets.forEach((set, si) => {
      const r = el('div', 'w-set' + (set.done ? ' logged' : ''));
      const inner = el('div', 'w-set-row');
      inner.appendChild(el('div', 'sn num', String(si + 1)));

      const kgCell = el('button', 'kg-cell');
      const kvWrap = el('span', 'kv-wrap');
      const kv = el('span', 'kv num', String(set.kg));
      kv.id = 'val-kg-' + ei + '-' + si;
      kvWrap.appendChild(kv);
      kvWrap.appendChild(el('small', null, 'kg'));
      kgCell.appendChild(kvWrap);
      // a logged set is locked — untick it first to change anything
      kgCell.disabled = set.done;
      kgCell.onclick = () => {
        if (set.done) return;
        const key = ei + ':' + si;
        lw.scaleOpenAt = lw.scaleOpenAt === key ? null : key;
        lw.repScaleAt = null;
        live.set(lw);
        renderWorkout();
      };
      inner.appendChild(kgCell);

      if (cur.timed) {
        const wrap = el('div', 'stepper');
        const minus = el('button', null, '−');
        minus.disabled = set.done;
        minus.onclick = () => { if (set.done) return; set.reps = Math.max(5, set.reps - 5); live.set(lw); updateVals(); };
        const mid = el('button', 'hold-btn num' + (holdInt && holdExIdx === ei && holdIdx === si ? ' on' : ''));
        mid.id = 'hold-' + ei + '-' + si;
        mid.appendChild(svgIcon(PLAY, 9));
        mid.appendChild(document.createTextNode(' ' + fmtClock(set.reps)));
        mid.disabled = set.done;
        mid.onclick = () => { if (!set.done) toggleHold(ei, si); };
        const plus = el('button', null, '+');
        plus.disabled = set.done;
        plus.onclick = () => { if (set.done) return; set.reps += 5; live.set(lw); updateVals(); };
        wrap.append(minus, mid, plus);
        inner.appendChild(wrap);
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
        lw.advanceAfterRest = set.done && cur.sets.every(s => s.done) && ei < lw.exercises.length - 1;
        live.set(lw);
        if (set.done) startRest(cur.rest);   // after save — startRest re-reads state
        renderWorkout();
      };
      inner.appendChild(log);
      r.appendChild(inner);

      // the weight / rep scale expands inside this row
      if (lw.scaleOpenAt === ei + ':' + si) {
        r.appendChild(weightScale(lw, cur, ei, si, updateVals));
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
        : `Go up to ${fmtKg(sug.nextKg)} kg on your remaining sets.`));
      s.appendChild(t);
      if (cur.sets.some(x => !x.done)) {
        const act = el('button', 's-act num', cur.timed ? '+5 s' : '+2.5 kg');
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
        : `Stay at ${fmtKg(sug.kg)} kg until you reach ${cur.repHi} reps.`));
      s.appendChild(t);
      card.appendChild(s);
    } else {
      const s = el('div', 'suggest idle');
      const t = el('div');
      t.appendChild(el('div', 's-title', 'Progression'));
      t.appendChild(el('div', 's-body', cur.timed
        ? `Tap ▸ on a set to run the hold timer — reach ${cur.repHi} s to progress.`
        : `Hit ${cur.repHi} reps on a set to earn +2.5 kg.`));
      s.appendChild(t);
      card.appendChild(s);
    }

    // difficulty feedback once every set is banked — stored for the next program
    if (cur.sets.length && cur.sets.every(s => s.done)) {
      const fw = el('div', 'feel-wrap');
      fw.appendChild(el('div', 'micro', 'How was it?'));
      const strip = el('div', 'feel-strip');
      [['easy', 'Easy'], ['moderate', 'Moderate'], ['hard', 'Hard']].forEach(([k, label]) => {
        const b = el('button', 'feel-btn ' + k + (cur.feel === k ? ' sel' : ''), label);
        b.onclick = () => {
          cur.feel = cur.feel === k ? null : k;
          live.set(lw);
          strip.querySelectorAll('.feel-btn').forEach(x => x.classList.remove('sel'));
          if (cur.feel) b.classList.add('sel');
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
      line.appendChild(el('span', 'num', `Last time · ${fmtKg(kg)} kg × ${h.sets.map(s => s.reps).join(', ')}`));
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
  }
  function toggleHold(exIdx, si) {
    if (holdInt && holdExIdx === exIdx && holdIdx === si) { cancelHold(); renderWorkout(); return; }
    cancelHold();
    const lw0 = live.get();
    if (!lw0) return;
    const exRef = lw0.exercises[exIdx];
    const secs = exRef.sets[si].reps;
    // two-sided holds run the timer once per side with a short switch break
    const phases = exRef.perSide
      ? [{ label: 'L', dur: secs }, { label: '⇆', dur: 10 }, { label: 'R', dur: secs }]
      : [{ label: '', dur: secs }];
    let phase = 0;
    holdIdx = si;
    holdExIdx = exIdx;
    holdEndTs = Date.now() + phases[0].dur * 1000;
    ensureAudio();
    let lastHoldTick = 0;
    holdInt = setInterval(() => {
      const left = Math.ceil((holdEndTs - Date.now()) / 1000);
      const btn = $('#hold-' + exIdx + '-' + si);
      if (left > 0) {
        if (left <= 5 && lastHoldTick !== phase * 1000 + left) {
          lastHoldTick = phase * 1000 + left;
          tickBeep();
        }
        if (btn) {
          btn.classList.add('on');
          btn.textContent = (phases[phase].label ? phases[phase].label + ' ' : '') + fmtClock(left);
        }
        return;
      }
      beep();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if (phase < phases.length - 1) {
        phase++;
        holdEndTs = Date.now() + phases[phase].dur * 1000;
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
  /* pre-rendered beep clip — second audio path for when WebAudio is blocked.
     Built LAZILY on first use: creating a media element at boot grabs the
     audio session on iOS and stops the Music app. */
  let beepAudio = null, beepBuilt = false;
  function buildBeepAudio() {
    if (beepBuilt) return;
    beepBuilt = true;
    try {
      const sr = 22050, n = Math.floor(sr * 1.2);
      const bytes = new Uint8Array(44 + n * 2);
      const dv = new DataView(bytes.buffer);
      const ws = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
      ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVEfmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
      dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
      ws(36, 'data'); dv.setUint32(40, n * 2, true);
      const pcm = new Int16Array(bytes.buffer, 44);
      [[880, 0, .26], [1175, .3, .26], [880, .6, .26], [1175, .9, .26]].forEach(([f, t0, d]) => {
        const s0 = Math.floor(t0 * sr), s1 = Math.min(n, Math.floor((t0 + d) * sr));
        for (let i = s0; i < s1; i++) {
          const env = Math.max(0, Math.min(1, (i - s0) / 200, (s1 - i) / 400));
          pcm[i] = Math.round(Math.sin(2 * Math.PI * f * (i / sr)) * 32767 * 0.85 * env);
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
        [880, 1175, 880, 1175].forEach((f, i) => tone(f, i * 0.3, 0.26, 0.85));
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
        if (lw.exIndex < lw.exercises.length - 1) lw.exIndex++;
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
      $('#pill-time').textContent = 'GO! 💪';
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

  /* Sliding ruler — ticks glide left/right under a fixed indicator.
     Drag it like a real scale, or tap a tick / the ± buttons. */
  function rulerScale(opts) {
    // opts: value, step, tickW, span, min, labelEvery, decimals, cls, onChange(v)
    const st = { base: opts.value, val: opts.value };
    const lblEvery = opts.labelEvery || 1;
    const fmt = v => opts.decimals ? v.toFixed(opts.decimals) : String(+v.toFixed(2));
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
      if (Math.abs(dx) < 5) {
        // a tap — pointer capture eats the click, so hit-test the tick ourselves
        slide(false);
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

  /* The weight scale — expands inside the set row.
     0.5 kg per notch, long labelled lines at whole kilos. */
  function weightScale(lw, cur, ei, si, updateVals) {
    const set = cur.sets[si];
    const stepK = 0.5;
    const box = el('div', 'kg-scale');

    const top = el('div', 'ks-top');
    const big = el('div', 'ks-val num', String(set.kg));
    big.appendChild(el('small', null, ' kg'));
    top.appendChild(big);
    const deltaEl = el('div', 'ks-delta', setDelta(cur, si));
    top.appendChild(deltaEl);
    box.appendChild(top);

    const commit = v => {
      set.kg = v;
      // the new weight carries forward to the remaining unlogged sets
      for (let j = si + 1; j < cur.sets.length; j++) {
        if (!cur.sets[j].done) cur.sets[j].kg = v;
      }
      live.set(lw);
      updateVals();
      big.firstChild.nodeValue = String(v);
      deltaEl.textContent = setDelta(cur, si);
    };
    const ruler = rulerScale({ value: set.kg, step: stepK, tickW: 30, span: 14, min: 0, labelEvery: 2, majorEvery: 2, onChange: commit });
    box.appendChild(ruler.el);

    const ctr = el('div', 'ks-controls');
    const openedWith = set.kg;   // for reverting a mistaken change
    const undo = el('button', 'ks-adj ks-reset num', '↺ ' + fmtKg(openedWith));
    undo.title = 'Back to ' + fmtKg(openedWith) + ' kg';
    undo.onclick = () => ruler.setVal(openedWith);
    const reset = el('button', 'ks-adj ks-reset num', '0');
    reset.title = 'Reset to 0';
    reset.onclick = () => ruler.setVal(0);
    ctr.append(undo, reset);
    const plates = el('div', 'ks-plates');
    [2.5, 5, 10].forEach(p => {
      const b = el('button', 'num', '+' + p);
      b.onclick = () => ruler.setVal(ruler.get() + p);
      plates.appendChild(b);
    });
    ctr.appendChild(plates);
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
    const c = el('div', 'rest-inline' + (resting ? ' on' : ''));
    const top = el('div', 'ri-state' + (resting ? ' on' : ''));
    top.appendChild(el('i', 'live-dot' + (resting ? '' : ' idle')));
    const nextEx = lw.advanceAfterRest && lw.exercises[lw.exIndex + 1];
    top.appendChild(document.createTextNode(resting
      ? (nextEx ? ' Resting · next: ' + nextEx.name : ' Resting')
      : ' Rest timer · ready'));
    c.appendChild(top);

    const mid = el('div', 'rest-mid');
    const t = el('div', 'rest-time num', resting
      ? fmtClock(Math.max(0, Math.ceil((lw.restEndsAt - Date.now()) / 1000)))
      : fmtClock(cur.rest));
    t.id = 'rest-time-live';
    mid.appendChild(t);
    const m15 = el('button', 'adj num', '−15');
    m15.onclick = () => {
      if (!lw.restEndsAt) return;
      lw.restEndsAt = Math.max(Date.now(), lw.restEndsAt - 15000);
      live.set(lw); restTick();
    };
    const p15 = el('button', 'adj num', '+15');
    p15.onclick = () => {
      if (!lw.restEndsAt) return;
      lw.restEndsAt += 15000;
      live.set(lw); restTick();
    };
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

    // six length presets, always visible; rest length is per exercise
    const pick = el('div', 'rest-picker');
    [60, 90, 120, 150, 180, 240].forEach(sec => {
      const b = el('button', 'num' + (cur.rest === sec ? ' sel' : ''), fmtClock(sec));
      b.onclick = async () => {
        cur.rest = sec;
        const exRec = await DB.get('exercises', cur.exerciseId);
        if (exRec) { exRec.rest = sec; await DB.put('exercises', exRec); }
        if (lw.restEndsAt) { lw.restLen = sec; lw.restEndsAt = Date.now() + sec * 1000; }
        live.set(lw);
        renderWorkout();
      };
      pick.appendChild(b);
    });
    c.appendChild(pick);

    if (resting) armRestTick();
    return c;
  }

  /* Docked rest bar — a slim glass strip over the page while resting */
  function dockedRestBar(lw) {
    const outer = el('div', 'dock-rest');
    const bar = el('div', 'dock-inner');
    bar.appendChild(el('i', 'live-dot'));
    const t = el('span', 'dock-time num', fmtClock(Math.max(0, Math.ceil((lw.restEndsAt - Date.now()) / 1000))));
    t.id = 'dock-time';
    bar.appendChild(t);
    const nextEx = lw.advanceAfterRest && lw.exercises[lw.exIndex + 1];
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
      const missed = lw.exercises.filter(e => !e.sets.some(s => s.done));
      const partial = lw.exercises.filter(e => e.sets.some(s => s.done) && !e.sets.every(s => s.done));
      let opts = { title: 'Finished?', body: 'The session will be saved.', ok: 'Save session', cancel: 'Keep training' };
      if (missed.length || partial.length) {
        const parts = [];
        if (missed.length) parts.push('Not logged: ' + missed.map(e => e.name).join(', '));
        if (partial.length) parts.push('Sets left open: ' + partial.map(e => e.name).join(', '));
        opts = {
          title: 'Finish anyway?', body: parts.join('\n') + '\n\nUnlogged sets will not be saved.',
          ok: 'Finish anyway', cancel: 'Keep training', warn: true
        };
      }
      if (!await appConfirm(opts)) return;
    }

    const sessionsAll = await DB.all('sessions');
    const mins = Math.max(1, Math.round((Date.now() - lw.startedAt) / 60000));
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
      head.appendChild(el('div', 'sum-body', `🎉 That was the last session of the block — all ${plan.weeks || 4} weeks done. Renew your plan from Today.`));
    } else {
      head.appendChild(el('div', 'sum-body', 'Progress is saved. Weights you hit today are pre-loaded for next time.'));
    }
    root.appendChild(head);

    const grid = el('div', 'sum-grid');
    grid.appendChild(sumCard(w.duration + ' min', 'Duration'));
    grid.appendChild(sumCard(fmtKg(w.volume) + ' kg', 'Volume'));
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
      r.appendChild(el('div', 'pr-delta num', '+' + (pr.after - pr.before) + ' kg'));
      root.appendChild(r);
    }

    root.appendChild(el('div', 'micro', 'How did it feel?'));
    const feel = el('div', 'feel-row');
    ['Easy', 'Solid', 'Brutal'].forEach(f => {
      const b = el('button', null, f);
      b.onclick = async () => {
        w.feel = f;
        await DB.put('workouts', w);
        $$('.feel-row button').forEach(x => x.classList.toggle('sel', x === b));
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
    if (!plan) {
      const nb = el('button', 'chip-btn', '＋ New block');
      nb.onclick = () => openPlanForm(null);
      head.appendChild(nb);
    }
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
        plan.pausedAt ? 'Paused ⏸' :
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
            day.items.forEach(it => {
              const ex2 = exercises.find(x => x.id === it.exerciseId);
              const row = el('div', 'pv-row');
              const th = el('div', 'pv-thumb');
              th.appendChild(thumbFor(ex2));
              row.appendChild(th);
              const cc = el('div');
              cc.appendChild(el('div', 'pv-name', ex2 ? ex2.name : '(deleted)'));
              const timed = /second/i.test((ex2 && ex2.notes) || '');
              cc.appendChild(el('div', 'pv-meta num',
                `${it.sets} × ${it.repLo}-${it.repHi}${timed ? ' s' : ' reps'}`
                + (it.kg ? ` · ${fmtKg(it.kg)} kg` : '')));
              row.appendChild(cc);
              if (ex2) {
                row.appendChild(el('div', 'pv-go', '›'));
                row.onclick = () => openDetail(ex2.id, 'plan');
              }
              pv.appendChild(row);
            });
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

    // history — continues on the same timeline as the days, newest first
    const hRail = planRailShared || el('div', 'plan-rail');
    let curMonth = '';
    workouts.forEach((w, i) => {
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
      c.appendChild(el('div', 'hrow-meta num', `${fmtKg(w.volume)} kg · ${w.sets} sets${w.feel ? ' · ' + w.feel : ''} ▾`));
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
              ? `${fmtKg(x.weight)}×${x.reps}`
              : `${x.reps}${s.timed ? 's' : ''}`).join(' · ');
            const hs = el('div', 'hd-sets num', txt);
            if (s.feel) hs.appendChild(el('span', 'hd-feel ' + s.feel, s.feel));
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
    if (!planRailShared && workouts.length) root.appendChild(hRail);

    // last session comparison — closes the page
    if (workouts.length >= 2) {
      const last = workouts[0];
      const prev = workouts.find(x => x.name === last.name && x.id !== last.id);
      if (prev) {
        const c2 = el('div', 'cmp-flat');
        const h = el('div', 'cmp-head');
        h.appendChild(el('div', 'a', `Last ${last.name} vs previous`));
        h.appendChild(el('div', 'b', last.duration + ' min'));
        c2.appendChild(h);
        const g = el('div', 'cmp-grid');
        ['Exercise', 'Best set', 'Volume', 'Δ'].forEach(t => g.appendChild(el('div', 'h', t)));
        const lastSess = sessions.filter(s => s.date === last.date && s.planId === last.planId);
        const prevSess = sessions.filter(s => s.date === prev.date && s.planId === prev.planId);
        for (const s of lastSess.slice(0, 6)) {
          const ex = exercises.find(e => e.id === s.exerciseId);
          const best = s.sets.reduce((a, x) => (x.weight || 0) > (a.weight || 0) ? x : a, s.sets[0]);
          const vol = s.sets.reduce((a, x) => a + (x.weight || 0) * x.reps, 0);
          const pv = prevSess.find(x => x.exerciseId === s.exerciseId);
          const pvol = pv ? pv.sets.reduce((a, x) => a + (x.weight || 0) * x.reps, 0) : null;
          g.appendChild(el('div', 'c name', ex ? ex.name : '—'));
          g.appendChild(el('div', 'c best num', best.weight ? `${fmtKg(best.weight)} × ${best.reps}` : `${best.reps} reps`));
          g.appendChild(el('div', 'c vol num', fmtKg(vol)));
          const d = pvol !== null && pvol > 0 ? Math.round((vol - pvol) / pvol * 100) : null;
          g.appendChild(el('div', 'c delta num' + (d === null || d === 0 ? ' none' : ''), d === null ? '—' : (d > 0 ? '+' + d + '%' : d + '%')));
        }
        c2.appendChild(g);
        root.appendChild(c2);
      }
    }

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

      // start a fresh block — centred, below the block actions
      const nbRow = el('div', 'new-block-row');
      const nb = el('button', 'btn-cta big new-block-btn', '＋ New block');
      nb.onclick = () => openPlanForm(null);
      nbRow.appendChild(nb);
      root.appendChild(nbRow);
    }

    if (!workouts.length && !plan) {
      const emp = el('div', 'empty-state');
      emp.appendChild(el('div', 'e-icon', '🗓️'));
      emp.appendChild(el('p', null, 'No block yet — build one to start training.'));
      root.appendChild(emp);
    }
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
    root.appendChild(head);

    // lifetime stats
    const totVol = workouts.reduce((a, w) => a + (w.volume || 0), 0);
    const totPRs = workouts.reduce((a, w) => a + ((w.prs || []).length), 0);
    const totMin = workouts.reduce((a, w) => a + (w.duration || 0), 0);
    const grid = el('div', 'sum-grid');
    grid.appendChild(sumCard(String(workouts.length), 'Sessions'));
    grid.appendChild(sumCard(fmtKg(totVol) + ' kg', 'Lifetime volume'));
    grid.appendChild(sumCard(totMin + ' min', 'Time trained'));
    const prC = sumCard(String(totPRs), 'Records');
    prC.classList.add('hl');
    grid.appendChild(prC);
    root.appendChild(grid);

    // body weight — v5: big reading, fine sliding scale, trend, log button
    root.appendChild(el('div', 'month-label', 'Body weight'));
    const bw = (await DB.all('bodyweight')).sort((a, b) => a.ts - b.ts);
    const lastBw = bw[bw.length - 1];
    const loggedToday = !!bw.find(x => x.date === todayStr());
    const bwCard = el('div', 'card bwv-card');

    const bwHead = el('div', 'bwv-head');
    bwHead.appendChild(el('div', 'micro', "Today's reading"));
    bwCard.appendChild(bwHead);

    let bwv = lastBw ? lastBw.kg : 80;
    const bwStep = 0.5;   // fixed — main lines every 1 kg
    const read = el('div', 'bwv-read');
    const rv = el('div', 'bwv-val num', bwv.toFixed(1));
    rv.appendChild(el('small', null, ' kg'));
    read.appendChild(rv);
    const dEl = el('div', 'bwv-delta num');
    read.appendChild(dEl);
    bwCard.appendChild(read);

    let logBtn, logVal;
    const updDelta = () => {
      if (!lastBw) { dEl.textContent = ''; return; }
      const d = +(bwv - lastBw.kg).toFixed(1);
      dEl.className = 'bwv-delta num ' + (d < 0 ? 'down' : d > 0 ? 'up' : 'same');
      dEl.textContent = d === 0 ? 'Same as last' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} kg`;
    };
    const commitBw = v => {
      bwv = v;
      rv.firstChild.nodeValue = v.toFixed(1);
      updDelta();
      if (logVal) logVal.textContent = v.toFixed(1) + ' kg';
    };
    updDelta();

    // fixed scale — 0.5 steps, main labelled lines at every 1 kg
    const bwRuler = rulerScale({
      value: bwv, step: bwStep, tickW: 30, span: 14, min: 20,
      labelEvery: 2, majorEvery: 2, decimals: 1, cls: 'fine', onChange: commitBw
    });
    bwCard.appendChild(bwRuler.el);

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
    logVal = el('small', null, bwv.toFixed(1) + ' kg');
    logBtn.appendChild(logVal);
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
    const report = el('button', 'btn-ghost', '📝 Report for Claude');
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
  function bwGraphSVG(entries) {
    const W = 320, H = 116, padL = 34, padR = 12, padT = 10, padB = 20;
    const x0 = entries[0].ts, x1 = entries[entries.length - 1].ts;
    let lo = Math.min(...entries.map(e => e.kg));
    let hi = Math.max(...entries.map(e => e.kg));
    if (hi - lo < 1) { const m = (hi + lo) / 2; lo = m - 0.6; hi = m + 0.6; }
    const X = t => padL + (t - x0) / Math.max(x1 - x0, 1) * (W - padL - padR);
    const Y = v => padT + (hi - v) / (hi - lo) * (H - padT - padB);
    const P = entries.map(e => [X(e.ts), Y(e.kg)]);
    const line = P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
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
      L.push(`${w.date} · ${w.name} · ${w.duration} min · ${fmtKg(w.volume)} kg volume` +
        (w.feel ? ` · felt: ${w.feel}` : '') +
        (w.prs && w.prs.length ? ` · ${w.prs.length} PR` : ''));
      const sess = sessions.filter(s => s.date === w.date && s.planId === w.planId);
      for (const s of sess) {
        L.push(`  - ${exName(s.exerciseId)}: ` +
          s.sets.map(x => x.weight ? `${fmtKg(x.weight)}×${x.reps}` : `${x.reps} reps`).join(', ') +
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
      if (lastKg > 0) L.push(`- ${exName(id)}: ${fmtKg(lastKg)} kg · est 1RM ${best} kg`);
    }
    const bws = (await DB.all('bodyweight')).sort((a, b) => a.ts - b.ts);
    if (bws.length) {
      const lastB = bws[bws.length - 1];
      const pastB = [...bws].reverse().find(x => lastB.ts - x.ts >= 25 * 86400000);
      L.push('');
      L.push(`BODY WEIGHT: ${fmtKg(lastB.kg)} kg (${lastB.date})` +
        (pastB ? ` · ${(lastB.kg - pastB.kg >= 0 ? '+' : '')}${(lastB.kg - pastB.kg).toFixed(1)} kg over ~30 days` : ''));
    }
    const cds = (await DB.all('cardio')).sort((a, b) => b.ts - a.ts).slice(0, 12);
    if (cds.length) {
      L.push('');
      L.push('CARDIO (latest):');
      for (const c of cds) L.push(`- ${c.date} · ${c.activity} · ${c.minutes} min · ${c.calories} kcal`);
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
      app: 'rackside', version: 4, exportedAt: new Date().toISOString(),
      exercises: exs, plans: pls, sessions: sess, workouts: wks, bodyweight: bws, cardio: cds
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
    const [sessions, workouts, bw] = await Promise.all([
      DB.all('sessions'), DB.all('workouts'), DB.all('bodyweight')
    ]);
    const plan = activePlan();

    const head = el('header', 't-head');
    const hl = el('div');
    hl.appendChild(el('div', 't-date', `${workouts.length} session${workouts.length === 1 ? '' : 's'} logged`));
    hl.appendChild(el('h1', 't-title', 'Progress'));
    head.appendChild(hl);
    root.appendChild(head);

    if (!sessions.length) {
      const emp = el('div', 'empty-state');
      emp.appendChild(el('div', 'e-icon', '📈'));
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
    base.appendChild(bs(fmtKg(totVol), 'Kg lifted'));
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
      grid.appendChild(tile('Volume · kg / week', wk.map(x => x.vol), fmtKg(cur.vol), dTxt(cur.vol, prev.vol, '')));
      const hoursTot = Math.round(workouts.reduce((a, w) => a + (w.duration || 0), 0) / 6) / 10;
      grid.appendChild(tile(`Time · ${hoursTot} h total`, wk.map(x => x.min), cur.min + ' min', dTxt(cur.min, prev.min, 'm')));
      grid.appendChild(tile('Sets · per week', wk.map(x => x.sets), String(cur.sets), dTxt(cur.sets, prev.sets, '')));
      if (bw.length >= 2) {
        const sorted = [...bw].sort((a, b) => a.ts - b.ts);
        const last = sorted[sorted.length - 1];
        const past = sorted.filter(x => last.ts - x.ts >= 25 * 86400000).pop() || sorted[0];
        grid.appendChild(tile('Body weight · kg', sorted.slice(-12).map(x => x.kg),
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
    const d = vals.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
    const area = d + ` L${X(vals.length - 1).toFixed(1)} ${h - 2} L${X(0).toFixed(1)} ${h - 2} Z`;
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block">` +
      `<path d="${area}" fill="rgba(206,107,61,.12)"/>` +
      `<path d="${d}" fill="none" stroke="#CE6B3D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${X(vals.length - 1).toFixed(1)}" cy="${Y(vals[vals.length - 1]).toFixed(1)}" r="3" fill="#CE6B3D" stroke="#151110" stroke-width="1.5"/></svg>`;
  }

  /* ============================================================
     CARDIO
     ============================================================ */
  /* MET values — calories = MET x 3.5 x kg / 200 per minute */
  const CARDIO_TYPES = [
    { name: 'Walk', met: 3.8 },
    { name: 'Treadmill Run', met: 9.8 },
    { name: 'Outdoor Run', met: 10.0 },
    { name: 'Cycling', met: 7.5 },
    { name: 'Rowing Machine', met: 7.0 },
    { name: 'Elliptical', met: 5.5 },
    { name: 'Stair Climber', met: 9.0 },
    { name: 'Swimming', met: 8.3 },
    { name: 'Jump Rope', met: 12.3 },
    { name: 'HIIT Sprints', met: 12.0 },
    { name: 'Boxing', met: 9.0 },
    { name: 'Hiking', met: 6.0 }
  ];
  const liveCardio = {
    get() { try { return JSON.parse(localStorage.getItem('liveCardio') || 'null'); } catch { return null; } },
    set(v) { v ? localStorage.setItem('liveCardio', JSON.stringify(v)) : localStorage.removeItem('liveCardio'); }
  };
  let cardioAct = 1, cardioMins = 20, cardioInt = null, cardioAlerted = false;

  function cardioKcal(met, mins, kg) {
    return Math.round(met * 3.5 * (kg || 80) / 200 * mins);
  }

  /* generic picker wheel — a finite list, dragged up/down like iOS */
  function pickerWheel(labels, index, onChange, cls) {
    const TICK = 40;
    let val = Math.max(0, Math.min(labels.length - 1, index));
    const wrap = el('div', 'pw' + (cls ? ' ' + cls : ''));
    wrap.appendChild(el('i', 'pw-band'));
    const strip = el('div', 'pw-strip');
    labels.forEach((lb, i) => {
      const t = el('button', 'pw-item', lb);
      t.dataset.i = i;
      strip.appendChild(t);
    });
    wrap.appendChild(strip);

    const offFor = i => -(i * TICK + TICK / 2);
    const mark = () => [...strip.children].forEach((t, i) => t.classList.toggle('sel', i === val));
    const slide = anim => {
      strip.style.transition = anim ? 'transform .18s ease-out' : 'none';
      strip.style.transform = `translateY(${offFor(val)}px)`;
    };
    const setVal = (i, anim) => {
      i = Math.max(0, Math.min(labels.length - 1, i));
      if (i !== val) haptic();
      val = i;
      mark(); slide(anim);
      onChange(val);
    };

    let sy = null, so = 0, lastN = 0;
    wrap.style.touchAction = 'none';
    wrap.addEventListener('pointerdown', e => {
      sy = e.clientY; so = offFor(val); lastN = 0;
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
    const end = e => {
      if (sy === null) return;
      const dy = e.clientY - sy;
      sy = null;
      if (Math.abs(dy) < 5) {
        slide(false);
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const item = t && t.closest ? t.closest('.pw-item') : null;
        if (item) setVal(+item.dataset.i, true);
        return;
      }
      setVal(val - Math.round(dy / TICK), true);
    };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', () => { if (sy !== null) { sy = null; slide(false); } });

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

    const head = el('header', 't-head');
    const hl = el('div');
    const wkLogs = logs.filter(x => sameWeek(x.date));
    hl.appendChild(el('div', 't-date',
      wkLogs.length
        ? `${wkLogs.reduce((a, x) => a + x.minutes, 0)} min · ${wkLogs.reduce((a, x) => a + x.calories, 0)} kcal this week`
        : 'Nothing logged this week'));
    hl.appendChild(el('h1', 't-title', 'Cardio'));
    head.appendChild(hl);
    root.appendChild(head);

    if (lc) {
      // ---- live session ----
      const total = lc.mins * 60;
      const left = () => Math.max(0, Math.ceil((lc.startedAt + total * 1000 - Date.now()) / 1000));
      const done = () => Math.min(total, Math.round((Date.now() - lc.startedAt) / 1000));
      const type = CARDIO_TYPES.find(t => t.name === lc.act) || CARDIO_TYPES[0];

      const live = el('div', 'cd-live');
      live.appendChild(el('div', 'cd-act', lc.act));
      const clock = el('div', 'cd-clock num', fmtClock(left()));
      live.appendChild(clock);
      const sub = el('div', 'cd-sub num', '');
      live.appendChild(sub);
      const bar = el('div', 'rest-bar');
      const fill = el('div');
      bar.appendChild(fill);
      live.appendChild(bar);
      root.appendChild(live);

      const acts = el('div', 'block-actions');
      const fin = el('button', 'btn-cta big', 'Finish & save');
      fin.style.cssText = 'flex:1;width:auto;align-self:stretch;margin-top:0';
      fin.onclick = () => finishCardio(false);
      const stop = el('button', 'btn-ghost', 'Discard');
      stop.onclick = async () => {
        if (!await appConfirm({ title: 'Discard this cardio?', body: 'Nothing will be saved.', ok: 'Discard', cancel: 'Keep going', warn: true })) return;
        liveCardio.set(null);
        renderCardio();
      };
      acts.append(fin, stop);
      root.appendChild(acts);

      const tick = () => {
        const l = left(), d = done();
        clock.textContent = fmtClock(l);
        sub.textContent = `${Math.round(d / 60)} of ${lc.mins} min · ~${cardioKcal(type.met, d / 60, kg)} kcal`;
        fill.style.width = (100 - Math.min(100, d / total * 100)) + '%';
        if (l <= 0 && !cardioAlerted) {
          cardioAlerted = true;
          beep();
          if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
          clearInterval(cardioInt);
          finishCardio(true);
        }
      };
      tick();
      cardioInt = setInterval(tick, 500);
    } else {
      // ---- setup: two wheels ----
      cardioAlerted = false;
      const minsList = Array.from({ length: 24 }, (_, i) => (i + 1) * 5);
      if (!minsList.includes(cardioMins)) cardioMins = 20;

      const kcalEl = el('div', 'cd-kcal num');
      const upd = () => {
        const t = CARDIO_TYPES[cardioAct];
        kcalEl.textContent = `~${cardioKcal(t.met, cardioMins, kg)} kcal`;
      };

      const wheels = el('div', 'cd-wheels');
      const c1 = el('div', 'cd-col');
      c1.appendChild(el('div', 'micro', 'Activity'));
      c1.appendChild(pickerWheel(CARDIO_TYPES.map(t => t.name), cardioAct, i => { cardioAct = i; upd(); }, 'wide'));
      wheels.appendChild(c1);
      const c2 = el('div', 'cd-col');
      c2.appendChild(el('div', 'micro', 'Minutes'));
      c2.appendChild(pickerWheel(minsList.map(String), minsList.indexOf(cardioMins),
        i => { cardioMins = minsList[i]; upd(); }));
      wheels.appendChild(c2);
      root.appendChild(wheels);

      upd();
      root.appendChild(kcalEl);

      const start = el('button', 'btn-cta big');
      start.style.width = '100%';
      start.appendChild(svgIcon(PLAY, 13));
      start.appendChild(document.createTextNode(' Start cardio'));
      start.onclick = () => {
        liveCardio.set({ act: CARDIO_TYPES[cardioAct].name, mins: cardioMins, startedAt: Date.now() });
        cardioAlerted = false;
        renderCardio();
      };
      root.appendChild(start);
    }

    // ---- history ----
    if (logs.length) {
      root.appendChild(el('div', 'micro', 'History'));
      const rail = el('div', 'plan-rail');
      logs.slice(0, 20).forEach(x => {
        const r = el('div', 'hrow');
        const node = el('i', 'ex-node small');
        node.appendChild(el('i'));
        r.appendChild(node);
        const c = el('div', 'hrow-body');
        c.appendChild(el('div', 'hrow-date', dateOf(x.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })));
        c.appendChild(el('div', 'hrow-name', x.activity));
        c.appendChild(el('div', 'hrow-meta num', `${x.minutes} min · ${x.calories} kcal`));
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
      root.appendChild(rail);
    }
  }

  async function finishCardio(auto) {
    const lc = liveCardio.get();
    if (!lc) return;
    clearInterval(cardioInt);
    const total = lc.mins * 60;
    const secs = Math.min(total, Math.max(1, Math.round((Date.now() - lc.startedAt) / 1000)));
    const mins = Math.max(1, Math.round(secs / 60));
    const bw = await DB.all('bodyweight');
    const kg = bw.length ? [...bw].sort((a, b) => a.ts - b.ts).pop().kg : 80;
    const type = CARDIO_TYPES.find(t => t.name === lc.act) || CARDIO_TYPES[0];
    const kcal = cardioKcal(type.met, mins, kg);
    const ok = await appConfirm({
      title: auto ? 'Time!' : 'Finish cardio?',
      body: `${lc.act} · ${mins} min · about ${kcal} kcal burned.`,
      ok: 'Save', cancel: auto ? 'Discard' : 'Keep going'
    });
    if (!ok) {
      if (auto) liveCardio.set(null);
      renderCardio();
      return;
    }
    await DB.put('cardio', {
      id: DB.uid(), date: todayStr(), ts: Date.now(),
      activity: lc.act, minutes: mins, calories: kcal
    });
    liveCardio.set(null);
    renderCardio();
  }

  /* ============================================================
     LIBRARY
     ============================================================ */
  let libFilter = 'All', libQuery = '';
  const LIB_GROUPS = ['All', ...new Set((window.EXERCISE_LIBRARY || []).map(i => i.group))];

  function renderLibrary() {
    const root = $('#view-library');
    root.innerHTML = '';
    const head = el('header', 't-head');
    const hl = el('div');
    hl.appendChild(el('div', 't-date', `${exercises.length} in my list · ${(window.EXERCISE_LIBRARY || []).length} in catalog`));
    hl.appendChild(el('h1', 't-title', 'Library'));
    head.appendChild(hl);
    const add = el('button', 'chip-btn', '＋ Own');
    add.onclick = () => openExerciseForm(null);
    head.appendChild(add);
    root.appendChild(head);

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
      const c = el('div');
      const nm = el('div', 'lr-name', name);
      if (r.mine) nm.appendChild(el('span', 'mine-tag', 'MINE'));
      c.appendChild(nm);
      c.appendChild(el('div', 'lr-meta', group));
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

  async function ensureExercise(item) {
    let ex = exercises.find(e => e.name.toLowerCase() === item.name.toLowerCase());
    if (ex) return ex;
    ex = {
      id: DB.uid(), createdAt: Date.now(), mediaIds: [],
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
    const tags = el('div', 'tag-row');
    if (ex.group) tags.appendChild(el('span', 'hl', ex.group));
    if (isBarbell(ex)) tags.appendChild(el('span', null, 'Barbell'));
    if (ex.rest) tags.appendChild(el('span', null, 'Rest ' + fmtClock(ex.rest)));
    body.appendChild(tags);

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
    stats.appendChild(detStat(lastKg ? fmtKg(lastKg) : '—', 'kg', 'Working weight'));
    stats.appendChild(detStat(bestRM ? String(bestRM) : '—', 'kg', 'Est. 1RM'));
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
    const editBtn = el('button', 'btn-ghost', 'Edit');
    editBtn.onclick = () => openExerciseForm(ex);
    acts.appendChild(editBtn);
    const delBtn = el('button', 'btn-ghost', 'Delete');
    delBtn.onclick = async () => {
      const plansAll = await DB.all('plans');
      const usedIn = plansAll.filter(p => (p.days || []).some(d => d.items.some(it => it.exerciseId === ex.id)));
      const warn = usedIn.length
        ? `\n\n⚠️ It is part of ${usedIn.map(p => `"${p.name}"`).join(', ')} — it will be removed from that plan too.`
        : '';
      if (!confirm(`Delete "${ex.name}" and its history?${warn}`)) return;
      for (const mid of (ex.mediaIds || [])) await DB.del('media', mid);
      for (const s of sessions) await DB.del('sessions', s.id);
      for (const p of usedIn) {
        for (const d of p.days) d.items = d.items.filter(it => it.exerciseId !== ex.id);
        await DB.put('plans', p);
      }
      await DB.del('exercises', ex.id);
      goBackFromDetail();
    };
    acts.appendChild(delBtn);
    body.appendChild(acts);
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
    editingExerciseId = ex ? ex.id : null;
    pendingMedia = [];
    const form = $('#form-exercise');
    form.reset();
    $('#sheet-exercise-title').textContent = ex ? 'Edit exercise' : 'New exercise';
    if (ex) {
      form.name.value = ex.name;
      form.group.value = ex.group || 'Other';
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
    ex.name = f.name.value.trim();
    ex.group = f.group.value;
    ex.notes = f.notes.value.trim();
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
    closeSheets();
    renderTab();
  };

  /* ============================================================
     PLAN FORM
     ============================================================ */
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
    form.weeks.value = String(planDraft.weeks);
    form.name.value = plan ? plan.name : (template ? `Block ${blockNumber(template) + 1}` : '');
    $('#sheet-plan-title').textContent = plan ? 'Edit block' : 'New block';
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
        const r = el('div', 'pf-item');
        r.appendChild(el('span', 'n', ex ? ex.name : '(deleted)'));
        const sets = numIn(item.sets, v => item.sets = v);
        const x1 = el('span', 'x', '×');
        const lo = numIn(item.repLo, v => item.repLo = v);
        const x2 = el('span', 'x', '–');
        const hi = numIn(item.repHi, v => item.repHi = v);
        const del = el('button', 'del', '✕');
        del.type = 'button';
        del.onclick = () => { day.items.splice(ii, 1); renderPlanDays(); };
        r.append(sets, x1, lo, x2, hi, del);
        card.appendChild(r);
      });

      const add = el('button', 'pf-add', '＋ Add exercise');
      add.type = 'button';
      add.onclick = () => openPicker(ex => {
        day.items.push({ exerciseId: ex.id, sets: 3, repLo: 8, repHi: 12, kg: 0 });
        renderPlanDays();
        openSheet('#sheet-plan');
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
    plan.weeks = Number(e.target.weeks.value) || 4;
    plan.days = days.map(d => ({ name: d.name.trim() || 'Day', items: d.items }));
    delete plan.items;
    await DB.put('plans', plan);
    closeSheets();
    show('today');
    renderTab();
  };

  /* ============================================================
     PICKER (my exercises + catalog, auto-add)
     ============================================================ */
  function openPicker(cb) {
    pickCallback = cb;
    pickFilter = 'All';
    $('#pick-search').value = '';
    renderPickChips();
    renderPickList();
    openSheet('#sheet-pick');
  }
  function renderPickChips() {
    const row = $('#pick-chips');
    row.innerHTML = '';
    for (const g of LIB_GROUPS) {
      const b = el('button', g === pickFilter ? 'sel' : '', g);
      b.onclick = () => { pickFilter = g; renderPickChips(); renderPickList(); };
      row.appendChild(b);
    }
  }
  function renderPickList() {
    const list = $('#pick-list');
    list.innerHTML = '';
    const q = $('#pick-search').value.trim().toLowerCase();
    const mineNames = new Set(exercises.map(e => e.name.toLowerCase()));
    const rows = [];
    for (const ex of exercises) rows.push({ mine: true, ex, name: ex.name, group: ex.group || '' });
    for (const item of (window.EXERCISE_LIBRARY || [])) {
      if (!mineNames.has(item.name.toLowerCase())) rows.push({ mine: false, item, name: item.name, group: item.group });
    }
    for (const r of rows) {
      if (pickFilter !== 'All' && r.group !== pickFilter) continue;
      if (q && !r.name.toLowerCase().includes(q) && !r.group.toLowerCase().includes(q)) continue;
      const row = el('div', 'lib-row');
      const th = el('div', 'lr-thumb');
      th.appendChild(thumbFor(r.mine ? r.ex : r.item));
      row.appendChild(th);
      const c = el('div');
      c.appendChild(el('div', 'lr-name', r.name));
      c.appendChild(el('div', 'lr-meta', r.group));
      row.appendChild(c);
      row.onclick = async () => {
        const ex = r.mine ? r.ex : await ensureExercise(r.item);
        closeSheets();
        const cb = pickCallback;
        pickCallback = null;
        cb(ex);
      };
      list.appendChild(row);
    }
  }
  $('#pick-search').oninput = renderPickList;

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
      if (live.get()) return;
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
    if (lw && lw.restEndsAt) armRestTick();
    [100, 600, 1500].forEach(t => setTimeout(setWinH, t));
    checkUpdate();
  });
})();
