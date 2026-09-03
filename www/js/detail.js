/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
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
      'Permanent. To skip one day, use Pass mid-session.'));
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
        const rec = await mediaStore.meta(mid);
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
      for (const mid of (ex.mediaIds || [])) await mediaStore.remove(mid);
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
        'Library exercise — remove it, or add your own to rewrite.'));
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
      form.assisted.value = ex.assisted ? '1' : '0';
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
        const rec = await mediaStore.meta(item.existingId);
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
    ex.assisted = f.assisted.value === '1';
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
      if (!kept.includes(oldId)) await mediaStore.remove(oldId);
    }
    const ids = [];
    for (const m of pendingMedia) {
      if (m.existingId) { ids.push(m.existingId); continue; }
      ids.push(await mediaStore.save(ex.id, m.file));
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

