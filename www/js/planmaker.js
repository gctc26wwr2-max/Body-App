/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
  /* ---- ordering a day ----
     Form is the first thing fatigue takes, so the movements that ask most of
     it go first: the big compound patterns, then the single-joint work, then
     core, then conditioning. Inside a tier the more technical lift leads, and
     if two are level the heavier one does — the taxonomy the library already
     carries does all of it, no extra tagging. */
  const PATTERN_TIER = {
    olympic: 0,
    squat: 1, hinge: 1, lunge: 1,
    horizontal_push: 2, vertical_push: 2, horizontal_pull: 2, vertical_pull: 2,
    carry: 3, rotation: 3,
    isolation_upper: 4, isolation_lower: 4,
    anti_extension: 5, anti_rotation: 5, anti_lateral_flexion: 5,
    conditioning: 6
  };
  function orderRank(it) {
    const lib = LIB_BY_ID[contentIdFor(it)];
    const tier = lib && PATTERN_TIER[lib.pattern];
    const skill = (hardshipOf(it) || {}).n || (lib && lib.skill) || 2;
    return {
      tier: tier == null ? 3 : tier,          // unknown sits with the carries
      skill: -skill,                          // more technical first
      kg: -(it.kg || 0)                       // then the heavier one
    };
  }
  function sortDayHardestFirst(items) {
    return items
      .map((it, i) => ({ it, i, r: orderRank(it) }))
      .sort((a, b) => a.r.tier - b.r.tier || a.r.skill - b.r.skill
        || a.r.kg - b.r.kg || a.i - b.i)     // a tie keeps the order you had
      .map(x => x.it);
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
    if (injLive) root.appendChild(el('div', 'ab-hint',
      'This hides movements that commonly stress the area. It is a filter, '
      + 'not medical advice \u2014 follow your clinician.'));
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
    /* the picker itself lives in Settings now; this only reports what your
       kit is doing to the choice of exercises */
    root.appendChild(el('div', 'inj-note', noKitN
      ? `${noKitN} exercises need kit you switched off in Settings`
      : 'Every exercise available with your kit'));
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
      i => (PM_SETS[i] % 5 === 0 ? 'w20' : (PM_SETS[i] % 2 ? 'w11' : 'w15')),
      null, null, 'Sets'));
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
      () => showMove(shown[pmEx]),
      i => paintHard(i), 'Exercise');
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
    const repLbl = el('div', 'micro', 'Reps');
    c3.appendChild(repLbl);
    /* a plank is not eight of anything: when the movement under the needle
       runs on the clock, this dial turns into seconds — and turns back */
    let c3Timed = null;
    const buildThird = item => {
      const t = isTimedEx(item);
      if (t === c3Timed) return;
      c3Timed = t;
      repLbl.textContent = t ? 'Seconds' : 'Reps';
      const wheel = t
        ? pickerWheel(PM_SECS.map(r => r.label), pmSecs, i => { pmSecs = i; }, null,
          i => (i % 2 ? 'w11' : 'w15'), null, null, 'Seconds')
        : pickerWheel(PM_REPS.map(r => r.label), pmReps, i => { pmReps = i; }, null,
          i => (i % 2 ? 'w11' : 'w15'), null, null, 'Reps');
      if (c3.children.length > 1) c3.replaceChild(wheel, c3.lastChild);
      else c3.appendChild(wheel);
    };
    wheels.appendChild(c3);
    root.appendChild(wheels);

    /* how hard the movement on the dial is. The dial spins without a
       re-render, so this line repaints on its own — you find out what the
       exercise asks of you before you add it, not after. */
    const pickHard = el('div', 'pm-hard');
    const paintHard = ix => {
      pickHard.innerHTML = '';
      const item = shown[ix == null ? pmEx : ix];
      buildThird(item);
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
      const rng = isTimedEx(item) ? PM_SECS[pmSecs] : PM_REPS[pmReps];
      pmDays[pmDay].items.push({
        name: item.name, sets: pmSets,
        repLo: rng.lo, repHi: rng.hi
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
      /* one tap for the order most programs use; the drag handles stay the
         override, and a second tap puts your own order back */
      if (day.items.length > 1) {
        const sorted = sortDayHardestFirst(day.items);
        const same = sorted.every((x, i) => x === day.items[i]);
        const ob = el('button', 'day-order' + (day.wasOrder ? ' on' : ''));
        ob.textContent = day.wasOrder ? 'Undo order' : 'Hardest first';
        ob.disabled = same && !day.wasOrder;
        ob.onclick = () => {
          if (day.wasOrder) { day.items = day.wasOrder; day.wasOrder = null; }
          else { day.wasOrder = day.items.slice(); day.items = sorted; }
          haptic();
          renderPlanMaker();
        };
        root.appendChild(ob);
      }
      const idx = el('div', 'ex-index');
      day.items.forEach((it, i) => {
        const r = el('div', 'exi-row' + (it.stuck ? ' stuck' : ''));
        r.appendChild(el('div', 'exi-num', String(i + 1).padStart(2, '0')));
        const nm = el('div', 'exi-name', it.name);
        if (it.swappedFrom) nm.appendChild(el('span', 'exi-sub', `was ${it.swappedFrom}`));
        const hb = el('div', 'exi-hard');
        if (addHardship(hb, it)) nm.appendChild(hb);
        r.appendChild(nm);
        r.appendChild(el('div', 'exi-scheme', `${it.sets} × ${it.repLo}–${it.repHi}${isTimedEx(it) ? ' s' : ''}`));
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
        day.wasOrder = null;          // you have moved it by hand; that is the order now
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

