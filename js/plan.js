/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
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
      /* a clean finish saves on the first tap — the question only appears
         when finishing would silently drop something */
      if (missed.length || partial.length) {
        const parts = [];
        if (missed.length) parts.push('Not logged: ' + missed.map(e => e.name).join(', '));
        if (partial.length) parts.push('Sets left open: ' + partial.map(e => e.name).join(', '));
        if (passed.length) parts.push('Passed: ' + passed.map(e => e.name).join(', '));
        if (!await appConfirm({
          title: 'Finish anyway?', body: parts.join('\n') + '\n\nUnlogged sets will not be saved.',
          ok: 'Finish anyway', cancel: 'Keep training', warn: true
        })) return;
      }
    }

    const sessionsAll = await DB.all('sessions');
    const mins = Math.max(1, Math.round(wElapsed(lw) / 60));
    const kcal = liftKcal(wElapsed(lw) / 60, lastBodyKg);
    let volume = 0, setCount = 0;
    const prs = [];

    for (const e of loggedEx) {
      const done = e.sets.filter(s => s.done);
      volume += done.reduce((a, s) => a + s.kg * s.reps, 0);
      setCount += done.length;
      // PR detection vs history — inverted for assisted machines, where the
      // record is the LEAST help you needed for an honest set
      if (isAssisted(e)) {
        const honest = s2 => s2.reps >= (e.repLo || 1);
        const todayMin = Math.min(...done.filter(honest).map(s2 => s2.kg), Infinity);
        const priorArr = sessionsAll.filter(s2 => s2.exerciseId === e.exerciseId)
          .flatMap(s2 => s2.sets.filter(x => x.reps >= (e.repLo || 1)).map(x => x.weight || 0));
        const priorMin = priorArr.length ? Math.min(...priorArr) : Infinity;
        if (isFinite(todayMin) && isFinite(priorMin) && todayMin < priorMin) {
          prs.push({ name: e.name, before: Math.round(priorMin), after: Math.round(todayMin) });
        }
      } else {
        const bestToday = Math.max(...done.map(s => est1RM(s.kg, s.reps)));
        const prior = sessionsAll.filter(s => s.exerciseId === e.exerciseId)
          .flatMap(s => s.sets.map(x => est1RM(x.weight || 0, x.reps)));
        const bestPrior = prior.length ? Math.max(...prior) : 0;
        if (bestPrior > 0 && bestToday > bestPrior) {
          prs.push({ name: e.name, before: Math.round(bestPrior), after: Math.round(bestToday) });
        }
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
      duration: mins, volume: Math.round(volume), sets: setCount, kcal,
      prs, stars: null, feel: null
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
    /* energy last and full width — it is an estimate off the clock, not a
       measurement like the four above it */
    if (w.kcal) {
      const kc = sumCard('~' + w.kcal + ' kcal', 'Energy · estimated from time');
      kc.classList.add('wide');
      grid.appendChild(kc);
    }
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
    const feelAsk = el('div', 'micro');
    const holder = el('div');
    const paintStars = () => {
      feelAsk.textContent = w.stars
        ? `${w.stars} of 5 · ${STAR_WORD[w.stars]}`
        : 'Rate the session';
      feelAsk.classList.toggle('on', !!w.stars);
      holder.innerHTML = '';
      holder.appendChild(starRow(w.stars || 0, async n => {
        w.stars = n || null;
        await DB.put('workouts', w);
        paintStars();
      }, 22));
    };
    paintStars();
    root.appendChild(feelAsk);
    root.appendChild(holder);

    /* everything is already banked by the time this screen exists — the
       button only leaves, so it must not claim to save anything */
    const save = el('button', 'btn-cta', 'Done');
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
        r.appendChild(el('div', 'pd-meta num', done ? 'done ✓' : day.items.length + (day.items.length === 1 ? ' exercise ▾' : ' exercises ▾')));
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
      const meta = el('div', 'hrow-meta num', `${fmtW(w.volume)} · ${w.sets} sets`);
      if (w.stars) {
        meta.appendChild(document.createTextNode(' ·'));
        const st = el('span', 'hrow-stars');
        st.appendChild(starIcon(true, 11));
        st.appendChild(el('span', null, String(w.stars)));
        meta.appendChild(st);
      } else if (w.feel) meta.appendChild(document.createTextNode(' · ' + w.feel));
      meta.appendChild(document.createTextNode(' ▾'));
      c.appendChild(meta);
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
  function optionRail(labels, index, onChange, tickW, clicky, ariaLabel) {
    const notch = () => { haptic(); if (clicky) bezelClick(); };
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

    const clampI = i => Math.max(0, Math.min(labels.length - 1, i));
    const offFor = i => -(i * TICK + TICK / 2);
    const idxAt = off => Math.round(-(off + TICK / 2) / TICK);
    const mark = () => [...strip.children].forEach((t, i) => t.classList.toggle('sel', i === val));
    const lit = i => [...strip.children].forEach((t, k) => t.classList.toggle('sel', k === i));
    const put = off => { strip.style.transform = `translateX(${off}px)`; };
    const slide = anim => {
      strip.style.transition = anim ? 'transform .2s ease-out' : 'none';
      put(offFor(val));
    };

    let raf = 0;
    /* let go and it keeps turning, the way a wheel does: the flick carries
       it on past a few options and friction brings it down, ticking at
       every notch it passes */
    const coastTo = (target, fromOff) => {
      cancelAnimationFrame(raf);
      strip.style.transition = 'none';
      target = clampI(target);
      const to = offFor(target);
      const dist = Math.abs(to - fromOff);
      const dur = Math.max(240, Math.min(1500, dist * 2.6));
      const t0 = performance.now();
      let lastDetent = idxAt(fromOff);
      const step = now => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 4);            // friction, long tail
        const off = fromOff + (to - fromOff) * e;
        put(off);
        const d = idxAt(off);
        if (d !== lastDetent) {                      // a click for every notch passed
          lastDetent = d;
          notch();
          lit(clampI(d));
        }
        if (p < 1) { raf = requestAnimationFrame(step); return; }
        val = target;
        mark();
        onChange(val);
      };
      raf = requestAnimationFrame(step);
    };

    const setVal = (i, anim) => {
      i = clampI(i);
      if (i !== val) notch();
      val = i; mark(); slide(anim); onChange(val);
    };

    let sx = null, so = 0, lastN = 0, vx = 0, lastX = 0, lastT = 0;
    wrap.style.touchAction = 'none';
    wrap.addEventListener('pointerdown', e => {
      cancelAnimationFrame(raf);
      sx = e.clientX; so = offFor(val); lastN = 0;
      vx = 0; lastX = e.clientX; lastT = performance.now();
      strip.style.transition = 'none';
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      const off = so + dx;
      put(off);
      const n = Math.round(dx / TICK);
      if (n !== lastN) { lastN = n; notch(); lit(clampI(idxAt(off))); }
      const now = performance.now(), dt = now - lastT;
      if (dt > 0) { vx = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = now; }
    });
    const end = e => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) < 5) {
        slide(false);
        lit(val);
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const item = t && t.closest ? t.closest('.or-item') : null;
        if (item) setVal(+item.dataset.i, true);
        return;
      }
      // carry the flick forward: how far it would drift before friction wins
      const stale = performance.now() - lastT > 90;
      const throwPx = stale ? 0 : vx * 210;
      const fromOff = so + dx;
      coastTo(idxAt(fromOff + throwPx), fromOff);
    };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', () => {
      if (sx !== null) { sx = null; slide(false); lit(val); }
    });

    mark(); slide(false);
    const a11yRail = a11ySlider(wrap, {
      label: ariaLabel || 'options',
      min: 0, max: labels.length - 1,
      now: () => val,
      text: () => labels[val],
      step: d => setVal(val + d, true)
    });
    /* turned by code rather than a thumb — no onChange, so a control that
       drives another does not look like the user touched it */
    wrap.spinTo = i => {
      i = clampI(i);
      if (i === val) return;
      cancelAnimationFrame(raf);
      val = i; mark(); slide(true); a11yRail();
    };
    const upA = () => setTimeout(a11yRail, 0);
    wrap.addEventListener('pointerup', upA);
    return wrap;
  }

