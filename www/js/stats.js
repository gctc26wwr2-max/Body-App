/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
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
      emp.appendChild(el('p', null, 'Nothing to chart yet.'));
      emp.appendChild(el('p', 'es-sub', 'Finish one session and this page fills itself: '
        + 'volume, time and sets by week, personal records, and your body-weight trend.'));
      const go = el('button', 'btn-ghost', 'Go to Today');
      go.onclick = () => { show('today'); renderTab(); };
      emp.appendChild(go);
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
      const dow0 = dowFrom(nowD);
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
          toW(last.kg).toFixed(1), dTxt(toW(last.kg), toW(past.kg), '')));
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
        `<circle cx="${w - 6}" cy="${h / 2}" r="3" fill="${ACC}"/></svg>`;
    }
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const X = i => 3 + i / (vals.length - 1) * (w - 10);
    const Y = v => hi === lo ? h / 2 : 4 + (hi - v) / (hi - lo) * (h - 10);
    const d = smoothPath(vals.map((v, i) => [X(i), Y(v)]));
    const area = d + ` L${X(vals.length - 1).toFixed(1)} ${h - 2} L${X(0).toFixed(1)} ${h - 2} Z`;
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block">` +
      `<path d="${area}" fill="rgba(${accRGB()},.12)"/>` +
      `<path d="${d}" fill="none" stroke="${ACC}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${X(vals.length - 1).toFixed(1)}" cy="${Y(vals[vals.length - 1]).toFixed(1)}" r="3" fill="${ACC}" stroke="#151110" stroke-width="1.5"/></svg>`;
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
  /* the third dial for a movement measured by the clock */
  const PM_SECS = [
    { label: '15–20 s', lo: 15, hi: 20 },
    { label: '20–30 s', lo: 20, hi: 30 },
    { label: '30–45 s', lo: 30, hi: 45 },
    { label: '45–60 s', lo: 45, hi: 60 },
    { label: '60–90 s', lo: 60, hi: 90 },
    { label: '2–3 min', lo: 120, hi: 180 },
    { label: '3–5 min', lo: 180, hi: 300 }
  ];
  let pmDays = null, pmDay = 0, pmSets = 2, pmEx = 0, pmReps = 2, pmSecs = 2, pmName = '';
  let pmInj = 0, pmGroup = 'All', pmQuery = '';
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
    { key: 'elbow', label: 'Elbow', avoid: ['elbow', 'grip'] },   // heavy grip loads the epicondyles
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
    /* a fresh profile is already post-split — without the stamp, the first
       saved kit would be "migrated" and quietly re-add whatever machine
       chip had just been switched off */
    if (raw === null) { localStorage.setItem('equipV2', '1'); return new Set(equipKeys()); }
    try {
      const s = new Set(JSON.parse(raw));
      /* "Other machine" was split into nine named machines. A kit saved
         before the split owns them exactly if it owned the bucket. */
      if (!localStorage.getItem('equipV2')) {
        if (s.has('machine'))
          ['m-smith', 'm-hack', 'm-hip', 'm-fly', 'm-latr', 'm-arms', 'm-calf', 'm-abd', 'm-ghd']
            .forEach(k => s.add(k));
        localStorage.setItem('equipV2', '1');
        localStorage.setItem('equip', JSON.stringify([...s]));
      }
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
  /* Your own exercises are never hidden by the kit list: the app has no idea
     what a movement you invented needs, and guessing it away would lose it. */
  const equipOK = ex => {
    if (ex && ex.custom) return true;
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
      const rec = await mediaStore.meta(mid);
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

