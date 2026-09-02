/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
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
    const quitBtn = $('#pause-pop-quit');
    if (quitBtn) quitBtn.onclick = async () => {
      if (!await appConfirm({
        title: 'Discard session?', body: 'Logged sets will not be saved.',
        ok: 'Discard', cancel: 'Keep training', warn: true
      })) return;
      live.set(null);
      stopRest();
      closePausePop();
      show('today'); renderTab();
    };
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

  /* "300-300" is not a range */
  const fmtRange = (lo, hi, dash) => lo === hi ? String(lo) : lo + (dash || '–') + hi;

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
      const assisted = isAssisted(ex);
      const lastMax = lastSets
        ? (assisted
          ? Math.min(...lastSets.map(s2 => s2.weight || 0))     // least help you managed
          : Math.max(...lastSets.map(s2 => s2.weight || 0)))
        : 0;
      exList.push({
        exerciseId: ex.id, name: ex.name, assisted,
        timed: isTimedEx(ex),                    // hold/interval exercises log seconds
        perSide: /side/i.test(ex.notes || ''),   // run the hold once per side
        repLo: lo, repHi: hi, rest: restDefault(), deload,
        sets: Array.from({ length: deload
          ? Math.max(1, Math.round((item.sets || 3) * DELOAD_SETS))
          : (item.sets || 3) }, (_, si) => {
          const prev = lastSets ? lastSets[si] : null;
          // start every set at the heaviest weight you reached last time —
          // weight you earned mid-session carries into the whole next session
          const base = lastMax || item.kg || 0;
          // a deload on an assisted machine means MORE help, not less weight
          const kg = deload ? wRound(base * (assisted ? 2 - DELOAD_LOAD : DELOAD_LOAD)) : base;
          const reps = (prev && prev.reps) || lo;
          return { kg, reps, targetLo: lo, targetHi: hi, done: false };
        })
      });
    }
    /* The switch in Settings. Two halves: five easy timed minutes first,
       and two lighter W sets rolled into the first lift so the working weight
       is not the first thing your joints see. Session-only — the block is
       untouched. */
    if (getProfile().warmup) {
      const first = exList[0];
      let ramp = false;
      if (first && !first.timed) {
        const base = first.sets[0] ? first.sets[0].kg : 0;
        if (base > 0) {
          /* targets are 1—hi so a deliberately light set never reads as a
             miss. On an assisted machine "lighter" means more help. */
          const wUp = isAssisted(first) ? [1.5, 1.25] : [0.5, 0.75];
          first.sets.unshift(
            { kg: wRound(base * wUp[0]), reps: 8, targetLo: 1, targetHi: first.repHi, done: false, warm: true },
            { kg: wRound(base * wUp[1]), reps: 5, targetLo: 1, targetHi: first.repHi, done: false, warm: true }
          );
          ramp = true;
        }
      }
      const g1 = first ? ((exercises.find(e => e.id === first.exerciseId) || {}).group || '') : '';
      const lower = /leg/i.test(g1);
      /* every named practice is one the catalogue can demonstrate, and only
         ones your kit allows are offered — tapping a name opens its page */
      const lib = window.EXERCISE_LIBRARY || [];
      const pick = names => names.find(n => {
        const r = lib.find(x => x.name === n);
        /* a step must be demonstrable — no photograph, no place in the
           warm-up, however good the movement */
        return r && r.demo && equipOK(r);
      });
      const link = async name => {
        const r = lib.find(x => x.name === name);
        const ex2 = await ensureExercise(r);
        return { name, id: ex2.id };
      };
      /* every practice here is one the catalogue has photographs of, so the
         list demonstrates itself and the card can wear the first one's
         picture like any other exercise.

         The same two drills every session get skipped, so the routine is
         dealt from a pool: lower days loosen hips and knees, upper days
         shoulders and trunk, and the deal advances with every day you
         bank — tomorrow warms up differently from today. Each slot is a
         preference chain, so a missing machine falls back to the next
         practice your kit allows rather than to nothing. */
      const PULSE_POOL = [
        ['Jump Rope', 'Elliptical', 'Air Bike'],
        ['Battle Ropes', 'Elliptical', 'Jump Rope'],
        ['Rowing Machine', 'Battle Ropes', 'Jump Rope'],
        ['Incline Treadmill Walk', 'Stair Climber', 'Elliptical', 'Jump Rope']
      ];
      const WARM_LOWER = [
        [['Bodyweight Squat'], ['Glute Bridge', 'Walking Lunge']],
        [['Walking Lunge', 'Lunge', 'Bodyweight Squat'], ['Calf Raise', 'Glute Bridge']],
        [['Step-Up', 'Split Squat', 'Bodyweight Squat'], ['Kettlebell Swing', 'Glute Bridge']],
        [['Lunge', 'Walking Lunge', 'Bodyweight Squat'], ['Dead Bug', 'Plank']]
      ];
      const WARM_UPPER = [
        [['Band Pull-Apart', 'Face Pull'], ['Bodyweight Squat', 'Plank']],
        [['Face Pull', 'Band Pull-Apart'], ['Plank', 'Dead Bug']],
        [['Cable External Rotation', 'Band Pull-Apart'], ['Mountain Climbers', 'Bodyweight Squat']],
        [['Inverted Row', 'Band Pull-Apart'], ['Dead Bug', 'Side Plank']]
      ];
      const seed = ((plan.completed || []).length + dayIndex);
      const pulse = pick(PULSE_POOL[seed % PULSE_POOL.length])
        || pick(['Jump Rope', 'Elliptical', 'Battle Ropes', 'Air Bike']);
      const duo = (lower ? WARM_LOWER : WARM_UPPER)[seed % 4];
      let loosen = duo.map(chain => pick(chain)).filter(Boolean);
      if (!loosen.length) loosen = [pick(['Bodyweight Squat', 'Plank'])].filter(Boolean);
      /* one practice per line: what to do on the left, how much on the right,
         so the column of play buttons and the column of counts both line up */
      /* a hold is counted in seconds, everything else in reps — the day it
         falls on has nothing to do with it */
      const noteFor = n =>
        /Plank|Hang|Hold|Dead Bug|Mountain Climbers|Battle Ropes/i.test(n) ? '30 s' : '15 reps';
      const steps = [
        pulse ? { ...(await link(pulse)), note: '2 min' } : { name: 'Brisk walk', note: '2 min' },
        ...(await Promise.all(loosen.map(async n => ({ ...(await link(n)), note: noteFor(n) })))),
        ramp
          ? { name: 'Then the W sets', note: first.name }
          : { name: 'Then a light first set', note: first ? first.name : '' }
      ];
      const wex = await ensureExercise({
        name: 'Warm-Up', group: 'Cardio',
        notes: 'Easy 300 seconds — raise the pulse, loosen what today trains.'
      });
      /* the thumbnail is the first practice's own photograph — the warm-up
         has no picture of its own and a lone icon looked like a gap */
      const firstShown = steps.map(st => st.id && exercises.find(e => e.id === st.id))
        .find(e => e && e.demo);
      exList.unshift({
        exerciseId: wex.id, name: wex.name, timed: true, perSide: false,
        repLo: 300, repHi: 300, rest: 60, deload: false, warmup: true, steps,
        demo: firstShown ? firstShown.demo : null,
        sets: [{ kg: 0, reps: 300, targetLo: 300, targetHi: 300, done: false }]
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
    /* the burn rides on the status line — visible the whole session without
       being another block in the header */
    const burnEl = el('span', 'w-kcal num');
    liveRow.appendChild(burnEl);
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
    btns.append(fin, pause);
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
    const tickClock = () => {
      clock.textContent = fmtClock(wElapsed(lw));
      const kc = liftKcal(wElapsed(lw) / 60, lastBodyKg);
      burnEl.textContent = kc > 0 ? ` · ${kc} kcal` : '';
    };
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

    /* The rest timer is pinned to the bottom of the screen, not buried in
       whichever exercise happens to be open. The rail scrolls under it and
       dissolves into the floor rather than sliding behind a hard edge.
       This also ends the two-rest-timers problem: there used to be a docked
       strip as well as the card inside the exercise, both counting. */
    const restOn = lw.exercises[lw.exIndex] || lw.exercises[0];
    if (restOn) {                    // a session with nothing in it has nothing to rest from
      const foot = el('div', 'rest-dock' + (paused ? ' held' : ''));
      foot.appendChild(inlineRest(lw, restOn));
      root.appendChild(foot);
      if (lw.restEndsAt) coachMark(foot, 'Rest runs itself. Skip it or take ±15 s.', 'rest');
    }

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
    th.appendChild(cur.warmup ? warmMark() : thumbFor(ex));
    /* the warm-up's own page has nothing on it — its practices are the links */
    if (!cur.warmup) th.onclick = e => { e.stopPropagation(); if (ex) openDetail(ex.id, 'workout'); };
    hd.appendChild(th);
    const col = el('div', 'exx-col');
    col.appendChild(el('div', 'exx-name', cur.name));
    const exMeta = el('div', 'exx-meta',
      `${(ex && ex.group) ? ex.group + ' · ' : ''}${cur.sets.length} × ${fmtRange(cur.repLo, cur.repHi)}${cur.timed ? (cur.perSide ? ' s / side' : ' s') : ''}`);
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
    if (!cur.warmup) {          // the warm-up's steps are its instructions
      const watch = el('div', 'ex-watch');
      watch.appendChild(svgIcon(PLAY, 10));
      watch.appendChild(document.createTextNode(' Watch the movement'));
      watch.onclick = () => { if (ex) openDetail(ex.id, 'workout'); };
      card.appendChild(watch);
    }

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
      const pl = plateLine(firstPendingSet.kg);
      if (pl.list.length) {
        const ps = el('div', 'plate-strip');
        ps.appendChild(el('span', 'bar', 'BAR'));
        const pSpan = el('span', 'plates num', pl.bar + ' + ' + pl.list.join(' + '));
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
        if (kv) kv.textContent = fmtWn(s.kg);
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
        const pl = plateLine(fp.kg);
        ps.textContent = pl.list.length ? pl.bar + ' + ' + pl.list.join(' + ') : 'bar only';
      }
    };

    /* a warm-up is instructions first, a clock second. One practice per line:
       the lead column is a play button where there is something to show and
       the step number where there is not, so both columns stay straight. */
    if (cur.warmup && cur.steps) {
      const ws = el('div', 'warm-list');
      cur.steps.forEach((st, i) => {
        const row = el('div', 'warm-step');
        if (st.id) {
          const b = el('button', 'warm-play');
          b.appendChild(svgIcon(PLAY, 9));
          b.title = 'Show me ' + st.name;
          b.onclick = e => { e.stopPropagation(); openDetail(st.id, 'workout'); };
          row.appendChild(b);
        } else row.appendChild(el('i', 'warm-n', String(i + 1)));
        row.appendChild(el('span', 'warm-name', st.name));
        row.appendChild(el('span', 'warm-note', st.note || ''));
        ws.appendChild(row);
      });
      card.appendChild(ws);
    }

    /* column headers — the rep range lives here, never inline in a row.
       A held exercise has no weight worth a column, so the seconds take the
       weight's place and its own scale, and the play button gets room. */
    const gh = el('div', 'set-grid-head' + (cur.timed ? ' timed' : ''));
    (cur.timed
      ? ['#', `Sec · ${fmtRange(cur.repLo, cur.repHi)}`, 'Hold', 'Log']
      : ['#', 'Kg', `Reps · ${fmtRange(cur.repLo, cur.repHi)}`, 'Log'])
      .forEach(t => gh.appendChild(el('span', null, t)));
    card.appendChild(gh);

    // set rows — weight is a tap target that opens the scale inside the row
    cur.sets.forEach((set, si) => {
      const r = el('div', 'w-set' + (set.done ? ' logged' : ''));
      const inner = el('div', 'w-set-row' + (cur.timed ? ' timed' : ''));
      const wBefore = cur.sets.filter((x, j) => j < si && x.warm).length;
      inner.appendChild(el('div', 'sn num' + (set.warm ? ' warm' : ''),
        set.warm ? 'W' + (si + 1) : String(si + 1 - wBefore)));

      /* the first value cell: seconds on a held exercise, weight on every
         other — same tap target, same scale sliding open underneath */
      const valCell = el('button', 'kg-cell');
      const kvWrap = el('span', 'kv-wrap');
      const kv = el('span', 'kv num', cur.timed ? fmtClock(set.reps) : fmtWn(set.kg));
      kv.id = (cur.timed ? 'val-sec-' : 'val-kg-') + ei + '-' + si;
      kvWrap.appendChild(kv);
      kvWrap.appendChild(el('small', null, cur.timed ? 's' : wUnit()));
      valCell.appendChild(kvWrap);
      // a logged set is locked — untick it first to change anything
      valCell.disabled = set.done;
      valCell.onclick = () => {
        if (set.done) return;
        const key = ei + ':' + si;
        /* open, and closed again by the same tap — typing is the pencil's
           job, so this gesture has only one meaning */
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
    const sug = suggestion(cur.sets, cur);
    if (sug.kind === 'increase') {
      const s = el('div', 'suggest up');
      const t = el('div');
      t.appendChild(el('div', 's-title', `Top of range · ${sug.last.reps}/${cur.repLo}-${cur.repHi}`));
      t.appendChild(el('div', 's-body', cur.timed
        ? 'Full hold banked — add 5 s to your remaining sets.'
        : sug.down
          ? `Drop the help to ${fmtW(sug.nextKg)} — less machine, more you.`
          : `Go up to ${fmtW(sug.nextKg)} on your remaining sets.`));
      s.appendChild(t);
      if (cur.sets.some(x => !x.done)) {
        const act = el('button', 's-act num', cur.timed ? '+5 s' : (sug.down ? '−' : '+') + fmtW(sug.step));
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
        : isAssisted(cur)
          ? `Hit ${cur.repHi} reps on a set to earn ${jumpLabel(jumpKg(cur))} less help.`
          : `Hit ${cur.repHi} reps on a set to earn +${jumpLabel(jumpKg(cur))}.`));
      s.appendChild(t);
      card.appendChild(s);
    }

    /* difficulty feedback, on the card the whole time the exercise is open —
       it used to appear only once every set was banked, by which point you
       are already resting and looking at the next thing */
    if (cur.sets.length && !cur.warmup) {   // a warm-up is not rated
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
  let holdInt = null, holdIdx = -1, holdExIdx = -1, holdEndTs = 0, holdHeldMs = 0;
  let scrollToEx = false;   // scroll the current exercise into view on next render

  function cancelHold() {
    clearInterval(holdInt);
    holdInt = null;
    holdIdx = -1;
    holdExIdx = -1;
    holdHeldMs = 0;
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
    /* five minutes is long enough to forget what the card told you, so the
       list runs under the clock as well */
    const stepBox = $('#hold-pop-steps');
    if (stepBox) {
      stepBox.innerHTML = '';
      const list = exRef.warmup && exRef.steps ? exRef.steps.slice(0, 3) : null;
      stepBox.hidden = !list;
      let demoBox = null;
      if (list) list.forEach((st, i) => {
        const row = el('div', 'hp-step');
        const rec2 = st.id && exercises.find(e => e.id === st.id);
        /* a play button where there is a demonstration — it opens right here
           under the clock, because the clock must not stop for it */
        if (rec2 && rec2.demo) {
          const b = el('button', 'warm-play hp-play');
          b.appendChild(svgIcon(PLAY, 8));
          b.onclick = () => {
            const already = demoBox && demoBox.dataset.slug === rec2.demo;
            if (demoBox) { demoBox.remove(); demoBox = null; }
            if (already) return;
            demoBox = el('div', 'hp-demo');
            demoBox.dataset.slug = rec2.demo;
            demoBox.appendChild(animFor(rec2));
            row.after(demoBox);
            haptic();
          };
          row.appendChild(b);
        } else row.appendChild(el('i', null, String(i + 1)));
        row.appendChild(el('span', null, st.name));
        row.appendChild(el('span', 'hp-note', st.note || ''));
        stepBox.appendChild(row);
      });
    }
    pop.hidden = false;
    /* Pause freezes the clock where it stands — a set can be interrupted by
       anything, and losing the count means starting the hold again. */
    holdHeldMs = 0;
    const hb = $('#hold-pop-hold');
    const paintHeld = () => {
      pop.classList.toggle('held', !!holdHeldMs);
      if (hb) hb.textContent = holdHeldMs ? 'Resume' : 'Pause';
    };
    paintHeld();
    if (hb) hb.onclick = () => {
      if (holdHeldMs) { holdEndTs = Date.now() + holdHeldMs; holdHeldMs = 0; }
      else holdHeldMs = Math.max(200, holdEndTs - Date.now());
      haptic();
      paintHeld();
    };
    /* Stopping halfway is still work done — the seconds you held are written
       into the set and banked, not thrown away. Under five seconds counts as
       a false start and records nothing; the backdrop stays a pure escape. */
    let lastWorked = 0;              // the most recent finished work phase
    $('#hold-pop-stop').onclick = () => {
      const ph = phases[phase];
      const leftS = holdHeldMs ? holdHeldMs / 1000 : Math.max(0, (holdEndTs - Date.now()) / 1000);
      const worked = Math.round(ph.lead ? lastWorked : ph.dur - leftS);
      cancelHold();
      if (worked >= 5) {
        const fresh = live.get();
        if (fresh) {
          const set2 = fresh.exercises[exIdx].sets[si];
          set2.reps = worked;
          set2.done = true;
          set2.doneAt = Date.now();
          fresh.exIndex = exIdx;
          fresh.advanceAfterRest = fresh.exercises[exIdx].sets.every(x => x.done)
            && exIdx < fresh.exercises.length - 1;
          live.set(fresh);
          startRest(fresh.exercises[exIdx].rest);
        }
      }
      renderWorkout();
    };
    pop.onclick = e => { if (e.target === pop && !holdHeldMs) { cancelHold(); renderWorkout(); } };

    const paint = (left, ph) => {
      pop.classList.toggle('lead', !!ph.lead);
      phaseEl.textContent = ph.lead ? ph.label : (exRef.perSide ? ph.label : 'Hold');
      timeEl.textContent = ph.lead ? String(left) : fmtClock(left);
      barEl.style.width = Math.max(0, Math.min(100, (left / ph.dur) * 100)) + '%';
      const btn = $('#hold-' + exIdx + '-' + si);
      if (btn) {
        btn.classList.add('on');
        const lbl = btn.querySelector('.hold-lbl');
        if (lbl) lbl.textContent = holdHeldMs ? 'Paused' : (ph.lead ? ph.label : fmtClock(left));
      }
    };
    paint(phases[0].dur, phases[0]);

    let lastHoldTick = 0;
    holdInt = setInterval(() => {
      const ph = phases[phase];
      if (holdHeldMs) { paint(Math.ceil(holdHeldMs / 1000), ph); return; }
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
        if (!ph.lead) lastWorked = ph.dur;   // a side finished in full
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

  /* the ratchet of a dive-watch bezel: a 15 ms burst of filtered noise,
     one per notch while the cardio dials are being set */
  let bezelBuf = null;
  function bezelClick() {
    ensureAudio();
    try {
      if (!bezelBuf) {
        const n = Math.floor(audioCtx.sampleRate * 0.015);
        bezelBuf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
        const d = bezelBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      }
      const src = audioCtx.createBufferSource();
      src.buffer = bezelBuf;
      const f = audioCtx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2400;
      const g = audioCtx.createGain();
      g.gain.value = 0.55;
      src.connect(f); f.connect(g); g.connect(audioCtx.destination);
      src.start();
      window.__bezeln = (window.__bezeln || 0) + 1;
    } catch { /* best-effort */ }
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
        if (next >= 0) { lw.exIndex = next; scrollToEx = true; }
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
        /* the rest that ends an exercise hands over to the next one you are
           actually going to do — anything passed is stepped over — and the
           card opens on screen rather than waiting to be found */
        const next = lw.exercises.findIndex((e, i) => i > lw.exIndex && !e.passed);
        if (next >= 0) { lw.exIndex = next; scrollToEx = true; }
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

  /* Haptic tick. Android has an API for this; iOS does not, and the trick
     that works there — toggling a hidden switch control — also plays the
     system switch sound, which is a click you did not ask for on every tap.
     A silent app beats a buzzy one, so iOS simply gets no tick. */
  function haptic() {
    if (navigator.vibrate) navigator.vibrate(8);
  }

