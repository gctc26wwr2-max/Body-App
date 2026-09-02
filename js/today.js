/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
  /* ============================================================
     TODAY
     ============================================================ */
  let greetPick = null;   // the visit's greeting, chosen once

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
    /* the profile earns its keep: the app greets whoever created it.
       A gap of six hours or more reads as coming back; anything shorter
       gets the time of day. */
    const nm = String(getProfile().name || '').trim().split(/\s+/)[0];
    /* decided once per visit and held — the tab re-renders freely, but the
       comeback reading is taken against the previous visit, not the render
       two seconds ago */
    const seen = +localStorage.getItem('lastSeen') || 0;
    try { localStorage.setItem('lastSeen', String(Date.now())); } catch {}
    if (!greetPick || Date.now() - greetPick.at > 6 * 3600e3)
      greetPick = { at: Date.now(), back: !!seen && Date.now() - seen > 6 * 3600e3 };
    if (nm) {
      const h = now.getHours();
      const greet = greetPick.back ? 'Welcome back'
        : h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
      root.appendChild(el('h1', 't-title greet', greet + ', ' + nm));
    } else if (!plan) root.appendChild(el('h1', 't-title', 'Rackside'));

    // running in the browser tab (not installed) — layout loses the bottom strip to Safari
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || navigator.standalone || IS_NATIVE;   // a wrapped app IS the installed app
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
      /* a stranger's first screen: three honest doors, not a blank page */
      const empty = el('div', 'empty-state');
      empty.appendChild(el('p', null, 'Or start another way:'));
      const nReady = (window.READY_PLANS || []).length;
      const b1 = el('button', 'btn-ghost', nReady ? `Browse ${nReady} ready programs` : 'Browse ready programs');
      b1.onclick = () => { masterTab = 'ready'; show('library'); renderTab(); };
      empty.appendChild(b1);
      const b2 = el('button', 'btn-ghost', 'Build your own block');
      b2.onclick = () => openPlanForm(null);
      empty.appendChild(b2);
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
    const dow = dowFrom(now);                       // 0 = the week's first day
    const wk0 = new Date(now); wk0.setDate(now.getDate() - dow);
    const doneDates = new Set(workouts.map(x => x.date));
    const pref = plan.prefDays || [];
    const off = weekStripOff();
    for (let i = 0; i < 7; i++) {
      const monIdx = (off + i) % 7;                 // prefDays stay Mon-indexed
      const d = new Date(wk0); d.setDate(wk0.getDate() + i);
      const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const cell = el('div', 'cell'
        + (ds === todayStr() ? ' today' : '')
        + (doneDates.has(ds) ? ' done' : '')
        + (pref.includes(monIdx) ? ' pref' : '')
        + (pref.includes(monIdx) && i < dow && !doneDates.has(ds) && !plan.pausedAt ? ' missed' : ''));
      cell.appendChild(el('span', null, 'MTWTFSS'[monIdx]));
      cell.appendChild(el('i'));
      strip.appendChild(cell);
    }
    root.appendChild(strip);

    // ---- the v5 arc layout, in every state ----
    {
      const dayIdx = mode === 'live' ? lwNow.dayIndex : (nextIdxArc >= 0 ? nextIdxArc : 0);
      const day = (plan.days && plan.days[dayIdx]) || { name: plan.name, items: [] };
      const totalSess = weeks * Math.max(1, (plan.days || []).length);
      /* unique (week, day) pairs — ledgers written before the duplicate
         guard may carry repeats, and a repeat is not a second session */
      const doneSess = Math.min(
        new Set((plan.completed || []).map(c => c.week + ':' + c.day)).size, totalSess);
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
        meta = `${day.items.length} exercise${day.items.length === 1 ? '' : 's'} · ~${lastDoneC ? lastDoneC.duration : Math.round(totalSets * 2.5)} min${due ? ' · due today' : ''}`;
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
          r.appendChild(el('div', 'exi-scheme', `${it.sets || 3} × ${it.repLo || 8}–${it.repHi || 12}${ex && isTimedEx(ex) ? ' s' : ''}${it.kg ? ' · ' + fmtW(it.kg) : ''}`));
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
        /* no Start here — every day has its own play button on the Plan tab,
           and this one only ever offered the same first day */
        root.appendChild(el('div', 'coach-note',
          `${day.name} is next — start it from the Plan tab.`));
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

  /* Block arc — N session dots on a semicircle, today at the crest (v5 handoff).
     The baseline sits high enough that the you-are-here ring (r 15) can never
     reach the label line: labels live at y 208, the ring bottoms out at 197.
     So W1 and the last week stay anchored under their endpoints in every
     state, instead of dodging the ring when it lands on an end node. */
  function blockArcSVG(total, doneCount, weeks) {
    /* this string becomes innerHTML — every input must leave here numeric */
    total = Math.max(1, Math.round(+total) || 1);
    doneCount = Math.max(0, Math.round(+doneCount) || 0);
    weeks = Math.max(1, Math.min(52, Math.round(+weeks) || 4));
    const R = 150, CX = 170, CY = 182;
    const pt = i => {
      const a = Math.PI - i * (Math.PI / Math.max(1, total - 1));
      return [CX + R * Math.cos(a), CY - R * Math.sin(a)];
    };
    const ramp = [.31, .22, .15, .07, 0].map(t => mixHex(ACC, '#000000', t));
    let dots = '';
    for (let i = 0; i < total; i++) {
      const [x, y] = pt(i);
      const X = x.toFixed(1), Y = y.toFixed(1);
      if (i < doneCount) {
        const c = ramp[Math.min(ramp.length - 1, Math.floor(i / Math.max(1, total - 1) * ramp.length))];
        dots += `<circle cx="${X}" cy="${Y}" r="4" fill="${c}"/>`;
      } else if (i === doneCount) {
        dots += `<circle cx="${X}" cy="${Y}" r="13" fill="#0B0908" stroke="${ACC}" stroke-width="2"/>`
              + `<circle cx="${X}" cy="${Y}" r="6" fill="${ACC}"/>`;
      } else {
        const op = Math.max(.10, .20 - (i - doneCount) * .015);
        dots += `<circle cx="${X}" cy="${Y}" r="3.5" fill="rgba(255,255,255,${op.toFixed(3)})"/>`;
      }
    }
    const [px, py] = pt(Math.min(doneCount, total - 1));
    const prog = doneCount > 0
      ? `<path d="M20 182 A150 150 0 0 1 ${px.toFixed(1)} ${py.toFixed(1)}" fill="none" stroke="${ACC}" stroke-width="2" stroke-linecap="round"/>`
      : '';
    return `<svg viewBox="0 0 340 212" style="width:100%;height:auto;display:block" role="img" aria-label="Block progress">
      <path d="M20 182 A150 150 0 0 1 320 182" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1.5" stroke-dasharray="3 6"/>
      ${prog}${dots}
      <text x="20" y="208" text-anchor="middle" fill="#4A443E" font-size="9" font-weight="800" font-family="Archivo, sans-serif">W1</text>
      <text x="320" y="208" text-anchor="middle" fill="#4A443E" font-size="9" font-weight="800" font-family="Archivo, sans-serif">W${weeks}</text>
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
    const dow = dowFrom(now);
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
    const dow = dowFrom(now);
    const monday = new Date(now); monday.setDate(now.getDate() - dow); monday.setHours(0, 0, 0, 0);
    const d = dateOf(ds);
    return d >= monday && d < new Date(monday.getTime() + 7 * 86400000);
  }

