/* Body App — training tracker. All data lives on-device in IndexedDB. */
(() => {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  /* ---------------- state ---------------- */
  let exercises = [];
  let plans = [];
  let currentView = 'exercises';
  let mediaURLs = new Map();          // mediaId -> object URL (cached for the session)
  let pendingMedia = [];              // files staged in the exercise form
  let editingExerciseId = null;
  let editingPlanId = null;
  let planDraft = null;               // {weeks, days: [{name, items: [{exerciseId, sets, reps}]}]}
  let logCtx = null;                  // {exerciseId, sessionId?, target?}
  let pickCallback = null;
  let libraryCb = null;               // set when the library is opened as a picker
  let libFilter = 'All';

  const todayStr = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const activeRun = {
    get() { try { return JSON.parse(localStorage.getItem('activeRun')); } catch { return null; } },
    set(v) { v ? localStorage.setItem('activeRun', JSON.stringify(v)) : localStorage.removeItem('activeRun'); }
  };

  /* ---- weekly program helpers ---- */
  function planWeek(plan) {          // 1-based current calendar week, or null if not started
    if (!plan.startDate) return null;
    const start = new Date(plan.startDate + 'T00:00:00');
    const days = Math.floor((Date.now() - start.getTime()) / 86400000);
    return Math.floor(days / 7) + 1;
  }
  function planFinished(plan) {
    if (plan.finishedAt) return true;
    const w = planWeek(plan);
    return w !== null && w > (plan.weeks || 4);
  }

  /* ---------------- media helpers ---------------- */
  async function mediaURL(mediaId) {
    if (mediaURLs.has(mediaId)) return mediaURLs.get(mediaId);
    const rec = await DB.get('media', mediaId);
    if (!rec) return null;
    const url = URL.createObjectURL(rec.blob);
    mediaURLs.set(mediaId, url);
    return url;
  }

  async function firstMedia(ex) {
    if (!ex.mediaIds || !ex.mediaIds.length) return null;
    const rec = await DB.get('media', ex.mediaIds[0]);
    if (!rec) return null;
    return { type: rec.type, url: await mediaURL(rec.id) };
  }

  function demoEl(slug, cls) {
    const wrap = document.createElement('div');
    wrap.className = 'demo-anim ' + cls;
    for (const i of [0, 1]) {
      const img = document.createElement('img');
      img.src = `demos/${slug}/${i}.jpg`;
      img.loading = 'lazy';
      img.alt = '';
      wrap.appendChild(img);
    }
    return wrap;
  }

  function mediaEl(type, url, cls) {
    let el;
    if (type.startsWith('video')) {
      el = document.createElement('video');
      el.src = url;
      el.muted = true;
      el.playsInline = true;
      el.preload = 'metadata';
    } else {
      el = document.createElement('img');
      el.src = url;
      el.loading = 'lazy';
    }
    if (cls) el.className = cls;
    return el;
  }

  function openViewer(type, url) {
    const body = $('#media-viewer-body');
    body.innerHTML = '';
    const el = mediaEl(type, url);
    if (el.tagName === 'VIDEO') { el.controls = true; el.muted = false; }
    body.appendChild(el);
    $('#media-viewer').hidden = false;
  }
  $('#media-viewer-close').onclick = () => {
    $('#media-viewer-body').innerHTML = '';
    $('#media-viewer').hidden = true;
  };

  /* ---------------- sheets ---------------- */
  function openSheet(id) {
    closeSheets();
    $('#sheet-backdrop').hidden = false;
    $(id).hidden = false;
  }
  function closeSheets() {
    $('#sheet-backdrop').hidden = true;
    $$('.sheet').forEach(s => s.hidden = true);
  }
  $('#sheet-backdrop').onclick = () => { closeSheets(); render(); };
  $$('[data-close]').forEach(b => b.onclick = closeSheets);

  /* ---------------- tabs ---------------- */
  const TITLES = { exercises: 'Exercises', workout: 'Workout', plans: 'Plans', history: 'History' };

  function switchView(view) {
    currentView = view;
    $$('.view').forEach(v => v.hidden = true);
    $('#view-' + view).hidden = false;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
    $('#topbar-title').textContent = TITLES[view];
    $('#topbar-action').hidden = (view === 'history');
    $('#topbar-library').hidden = (view !== 'exercises');
    render();
  }
  $$('.tab').forEach(t => t.onclick = () => switchView(t.dataset.view));

  $('#topbar-action').onclick = () => {
    if (currentView === 'exercises') openExerciseForm(null);
    else if (currentView === 'workout') {
      openPicker(ex => { logCtx = { exerciseId: ex.id }; openLogSheet(ex); });
    }
    else if (currentView === 'plans') openPlanForm(null);
  };

  /* ---------------- render dispatch ---------------- */
  async function render() {
    exercises = (await DB.all('exercises')).sort((a, b) => a.name.localeCompare(b.name));
    plans = (await DB.all('plans')).sort((a, b) => a.name.localeCompare(b.name));
    if (currentView === 'exercises') renderExercises();
    else if (currentView === 'workout') renderWorkout();
    else if (currentView === 'plans') renderPlans();
    else renderHistory();
  }

  /* ================= EXERCISES ================= */
  async function renderExercises() {
    const q = $('#exercise-search').value.trim().toLowerCase();
    const list = $('#exercise-list');
    list.innerHTML = '';
    const filtered = exercises.filter(e =>
      !q || e.name.toLowerCase().includes(q) || (e.group || '').toLowerCase().includes(q));
    $('#exercise-empty').hidden = exercises.length > 0;

    for (const ex of filtered) {
      const card = document.createElement('div');
      card.className = 'ex-card';
      const wrap = document.createElement('div');
      wrap.className = 'thumb-wrap';
      const m = await firstMedia(ex);
      if (m) {
        wrap.appendChild(mediaEl(m.type, m.url, 'thumb'));
        if (m.type.startsWith('video')) {
          const b = document.createElement('span');
          b.className = 'badge-video';
          b.textContent = '▶ video';
          wrap.appendChild(b);
        }
      } else if (ex.demo) {
        wrap.appendChild(demoEl(ex.demo, 'card'));
      } else {
        const ph = document.createElement('div');
        ph.className = 'thumb placeholder';
        ph.textContent = '🏋️';
        wrap.appendChild(ph);
      }
      card.appendChild(wrap);
      const name = document.createElement('div');
      name.className = 'ex-name';
      name.textContent = ex.name;
      const group = document.createElement('div');
      group.className = 'ex-group';
      group.textContent = ex.group || '';
      card.appendChild(name);
      card.appendChild(group);
      card.onclick = () => openDetail(ex.id);
      list.appendChild(card);
    }
  }
  $('#exercise-search').oninput = renderExercises;

  /* ----- add / edit exercise form ----- */
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
      const wrap = document.createElement('div');
      wrap.className = 'media-item';
      wrap.appendChild(mediaEl(type, url));
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'remove-media';
      rm.textContent = '✕';
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

    // remove media that was deleted in the form
    const keptExisting = pendingMedia.filter(m => m.existingId).map(m => m.existingId);
    for (const oldId of (ex.mediaIds || [])) {
      if (!keptExisting.includes(oldId)) await DB.del('media', oldId);
    }
    // save new files
    const newIds = [];
    for (const m of pendingMedia) {
      if (m.existingId) { newIds.push(m.existingId); continue; }
      const id = DB.uid();
      await DB.put('media', { id, exerciseId: ex.id, type: m.file.type, blob: m.file });
      newIds.push(id);
    }
    ex.mediaIds = newIds;
    await DB.put('exercises', ex);
    closeSheets();
    render();
  };

  /* ----- exercise detail ----- */
  async function openDetail(exId) {
    const ex = await DB.get('exercises', exId);
    if (!ex) return;
    const c = $('#detail-content');
    c.innerHTML = '';

    const mediaRow = document.createElement('div');
    mediaRow.className = 'detail-media';
    if (ex.demo) mediaRow.appendChild(demoEl(ex.demo, 'big'));
    for (const mid of (ex.mediaIds || [])) {
      const rec = await DB.get('media', mid);
      if (!rec) continue;
      const url = await mediaURL(mid);
      const el = mediaEl(rec.type, url);
      el.onclick = () => openViewer(rec.type, url);
      mediaRow.appendChild(el);
    }
    if (mediaRow.children.length) c.appendChild(mediaRow);

    const title = document.createElement('div');
    title.className = 'detail-title';
    title.textContent = ex.name;
    c.appendChild(title);
    const group = document.createElement('div');
    group.className = 'detail-group';
    group.textContent = ex.group || '';
    c.appendChild(group);
    if (ex.notes) {
      const notes = document.createElement('div');
      notes.className = 'detail-notes';
      notes.textContent = ex.notes;
      c.appendChild(notes);
    }

    const actions = document.createElement('div');
    actions.className = 'detail-actions';
    const logBtn = document.createElement('button');
    logBtn.className = 'btn primary';
    logBtn.textContent = 'Log sets';
    logBtn.onclick = () => { logCtx = { exerciseId: ex.id }; openLogSheet(ex); };
    const editBtn = document.createElement('button');
    editBtn.className = 'btn ghost';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => openExerciseForm(ex);
    const delBtn = document.createElement('button');
    delBtn.className = 'btn danger';
    delBtn.textContent = 'Delete';
    delBtn.onclick = async () => {
      if (!confirm(`Delete "${ex.name}" and its history?`)) return;
      for (const mid of (ex.mediaIds || [])) await DB.del('media', mid);
      const sess = await DB.byIndex('sessions', 'byExercise', ex.id);
      for (const s of sess) await DB.del('sessions', s.id);
      await DB.del('exercises', ex.id);
      closeSheets();
      render();
    };
    actions.append(logBtn, editBtn, delBtn);
    c.appendChild(actions);

    // history for this exercise
    const sessions = (await DB.byIndex('sessions', 'byExercise', ex.id))
      .sort((a, b) => b.ts - a.ts);
    if (sessions.length) {
      const label = document.createElement('h3');
      label.className = 'section-label';
      label.textContent = 'History';
      c.appendChild(label);
      for (const s of sessions.slice(0, 30)) {
        c.appendChild(historyEntry(s, ex, () => openDetail(exId)));
      }
    }
    openSheet('#sheet-detail');
  }

  function historyEntry(session, ex, onChange) {
    const div = document.createElement('div');
    div.className = 'history-entry';
    const d = document.createElement('div');
    d.className = 'h-date';
    d.textContent = session.date + (ex ? '' : '');
    div.appendChild(d);
    const chips = document.createElement('div');
    chips.className = 'set-chips';
    for (const set of session.sets) {
      const chip = document.createElement('span');
      chip.className = 'set-chip';
      chip.textContent = set.weight ? `${set.reps} × ${set.weight} kg` : `${set.reps} reps`;
      chips.appendChild(chip);
    }
    div.appendChild(chips);
    div.onclick = () => {
      logCtx = { exerciseId: session.exerciseId, sessionId: session.id, onChange };
      DB.get('exercises', session.exerciseId).then(e2 => openLogSheet(e2 || ex, session));
    };
    return div;
  }

  /* ================= LOG SETS ================= */
  function setRow(n, reps, weight) {
    const row = document.createElement('div');
    row.className = 'set-row';
    const num = document.createElement('div');
    num.className = 'set-num';
    num.textContent = n;
    const r = document.createElement('input');
    r.type = 'number'; r.min = '0'; r.inputMode = 'numeric';
    r.placeholder = 'reps'; r.className = 'in-reps';
    if (reps != null) r.value = reps;
    const w = document.createElement('input');
    w.type = 'number'; w.min = '0'; w.step = '0.5'; w.inputMode = 'decimal';
    w.placeholder = 'kg'; w.className = 'in-weight';
    if (weight != null && weight !== 0) w.value = weight;
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'done-set';
    done.textContent = '✓';
    done.onclick = () => {
      row.classList.toggle('done');
      if (row.classList.contains('done')) startRest(restDefault());
    };
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del-set';
    del.textContent = '✕';
    del.onclick = () => { row.remove(); renumberSets(); };
    row.append(num, r, w, done, del);
    return row;
  }

  function renumberSets() {
    $$('#set-rows .set-row .set-num').forEach((el, i) => el.textContent = i + 1);
  }

  function openLogSheet(ex, session) {
    $('#sheet-log-title').textContent = ex ? ex.name : 'Log sets';

    // show how the exercise is done while logging
    const demoBox = $('#sheet-log-demo');
    demoBox.innerHTML = '';
    if (ex && ex.demo) demoBox.appendChild(demoEl(ex.demo, 'log'));
    if (ex && ex.notes) {
      const n = document.createElement('div');
      n.className = 'log-demo-notes';
      n.textContent = '💡 ' + ex.notes;
      demoBox.appendChild(n);
    }

    const target = logCtx && logCtx.target;
    const tEl = $('#sheet-log-target');
    if (target) {
      tEl.textContent = `Plan target: ${target.sets} sets × ${target.reps} reps`;
      tEl.hidden = false;
    } else tEl.hidden = true;

    const rows = $('#set-rows');
    rows.innerHTML = '';
    const labels = document.createElement('div');
    labels.className = 'set-col-labels';
    labels.innerHTML = '<span>#</span><span>Reps</span><span>Weight (kg)</span><span>Done</span><span></span>';
    rows.appendChild(labels);

    if (session) {
      session.sets.forEach((s, i) => rows.appendChild(setRow(i + 1, s.reps, s.weight)));
    } else {
      const n = target ? Number(target.sets) || 3 : 3;
      const reps = target ? target.reps : null;
      for (let i = 0; i < n; i++) rows.appendChild(setRow(i + 1, reps, null));
    }

    // delete button when editing an existing session
    let delBtn = $('#delete-session');
    if (delBtn) delBtn.remove();
    if (session) {
      delBtn = document.createElement('button');
      delBtn.id = 'delete-session';
      delBtn.className = 'btn danger block small';
      delBtn.style.marginTop = '10px';
      delBtn.textContent = 'Delete this session';
      delBtn.onclick = async () => {
        if (!confirm('Delete this session?')) return;
        await DB.del('sessions', session.id);
        closeSheets();
        if (logCtx && logCtx.onChange) logCtx.onChange(); else render();
      };
      $('#sheet-log .sheet-actions').before(delBtn);
    }
    openSheet('#sheet-log');
  }

  $('#add-set-row').onclick = () => {
    const rows = $('#set-rows');
    const count = rows.querySelectorAll('.set-row').length;
    // copy reps/weight from the last row for faster entry
    const last = rows.querySelector('.set-row:last-child');
    const reps = last ? last.querySelector('.in-reps').value : null;
    const weight = last ? last.querySelector('.in-weight').value : null;
    rows.appendChild(setRow(count + 1, reps || null, weight || null));
  };

  $('#save-sets').onclick = async () => {
    const sets = [];
    $$('#set-rows .set-row').forEach(row => {
      const reps = Number(row.querySelector('.in-reps').value);
      const weight = Number(row.querySelector('.in-weight').value) || 0;
      if (reps > 0) sets.push({ reps, weight });
    });
    if (!sets.length) { alert('Enter reps for at least one set.'); return; }
    const existing = logCtx.sessionId ? await DB.get('sessions', logCtx.sessionId) : null;
    const session = existing || {
      id: DB.uid(),
      exerciseId: logCtx.exerciseId,
      date: todayStr(),
      ts: Date.now(),
      planId: logCtx.planId || null
    };
    session.sets = sets;
    await DB.put('sessions', session);
    closeSheets();
    if (logCtx.onChange) logCtx.onChange();
    if (logCtx.fromPlan) switchView('workout'); else render();
  };

  /* ================= LIBRARY ================= */
  const LIB_GROUPS = ['All', ...new Set((window.EXERCISE_LIBRARY || []).map(i => i.group))];

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

  function openLibrary(cb) {
    libraryCb = cb || null;
    libFilter = 'All';
    $('#library-search').value = '';
    renderLibraryChips();
    renderLibraryList();
    $('#library-chips').scrollLeft = 0;
    $('#library-list').scrollTop = 0;
    openSheet('#sheet-library');
  }

  function renderLibraryChips() {
    const row = $('#library-chips');
    row.innerHTML = '';
    for (const g of LIB_GROUPS) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (libFilter === g ? ' active' : '');
      chip.textContent = g;
      chip.onclick = () => { libFilter = g; renderLibraryChips(); renderLibraryList(); };
      row.appendChild(chip);
    }
  }

  function renderLibraryList() {
    const q = $('#library-search').value.trim().toLowerCase();
    const list = $('#library-list');
    list.innerHTML = '';
    for (const item of (window.EXERCISE_LIBRARY || [])) {
      if (libFilter !== 'All' && item.group !== libFilter) continue;
      if (q && !item.name.toLowerCase().includes(q) && !item.group.toLowerCase().includes(q)) continue;
      const row = document.createElement('div');
      row.className = 'lib-item';
      if (item.demo) row.appendChild(demoEl(item.demo, 'lib'));
      const info = document.createElement('div');
      info.className = 'lib-info';
      const nm = document.createElement('div');
      nm.className = 'lib-name';
      nm.textContent = item.name;
      const notes = document.createElement('div');
      notes.className = 'lib-notes';
      notes.textContent = item.group + ' · ' + item.notes;
      info.append(nm, notes);
      row.appendChild(info);
      const already = exercises.some(e => e.name.toLowerCase() === item.name.toLowerCase());
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lib-add' + (already && !libraryCb ? ' added' : '');
      btn.textContent = libraryCb ? 'Pick' : (already ? '✓ Added' : '＋ Add');
      btn.onclick = async () => {
        const ex = await ensureExercise(item);
        if (libraryCb) {
          const cb = libraryCb;
          libraryCb = null;
          closeSheets();
          cb(ex);
        } else {
          btn.className = 'lib-add added';
          btn.textContent = '✓ Added';
        }
      };
      row.appendChild(btn);
      list.appendChild(row);
    }
    if (!list.children.length) {
      const hint = document.createElement('div');
      hint.className = 'pick-hint';
      hint.textContent = 'Nothing matches your search.';
      list.appendChild(hint);
    }
  }
  $('#library-search').oninput = renderLibraryList;
  $('#topbar-library').onclick = () => openLibrary();

  /* ================= PICKER ================= */
  function openPicker(cb) {
    pickCallback = cb;
    $('#pick-search').value = '';
    renderPickList();
    openSheet('#sheet-pick');
  }

  $('#pick-from-library').onclick = () => {
    const cb = pickCallback;
    pickCallback = null;
    openLibrary(cb);
  };

  async function renderPickList() {
    const q = $('#pick-search').value.trim().toLowerCase();
    const list = $('#pick-list');
    list.innerHTML = '';
    for (const ex of exercises) {
      if (q && !ex.name.toLowerCase().includes(q) && !(ex.group || '').toLowerCase().includes(q)) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pick-item';
      const m = await firstMedia(ex);
      if (m && !m.type.startsWith('video')) {
        const img = document.createElement('img');
        img.src = m.url;
        btn.appendChild(img);
      } else if (ex.demo) {
        const img = document.createElement('img');
        img.src = `demos/${ex.demo}/0.jpg`;
        img.style.objectFit = 'contain';
        img.style.background = '#fff';
        btn.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'pick-ph';
        ph.textContent = m ? '▶' : '🏋️';
        btn.appendChild(ph);
      }
      const txt = document.createElement('div');
      const nm = document.createElement('div');
      nm.textContent = ex.name;
      const gr = document.createElement('div');
      gr.className = 'pick-group';
      gr.textContent = ex.group || '';
      txt.append(nm, gr);
      btn.appendChild(txt);
      btn.onclick = () => { closeSheets(); const cb = pickCallback; pickCallback = null; cb(ex); };
      list.appendChild(btn);
    }
    if (!list.children.length) {
      const hint = document.createElement('div');
      hint.className = 'pick-hint';
      hint.textContent = exercises.length
        ? 'Nothing matches your search.'
        : 'You have no exercises yet — use the library button above.';
      list.appendChild(hint);
    }
  }
  $('#pick-search').oninput = renderPickList;

  /* ================= WORKOUT (today) ================= */
  let elapsedInt = null;

  async function renderWorkout() {
    $('#workout-date-label').textContent = 'Today · ' + todayStr();
    const sessions = (await DB.byIndex('sessions', 'byDate', todayStr()))
      .sort((a, b) => a.ts - b.ts);
    const log = $('#workout-log');
    log.innerHTML = '';

    // active plan banner
    const run = activeRun.get();
    const banner = $('#active-plan-banner');
    banner.innerHTML = '';
    if (run && run.date !== todayStr()) { activeRun.set(null); }
    const liveRun = activeRun.get();
    if (liveRun) {
      const plan = await DB.get('plans', liveRun.planId);
      const day = plan && plan.days ? plan.days[liveRun.dayIndex || 0] : null;
      if (!plan || !day) { activeRun.set(null); banner.hidden = true; }
      else {
        banner.hidden = false;
        if (!liveRun.startedAt) { liveRun.startedAt = Date.now(); activeRun.set(liveRun); }
        const w = Math.min(planWeek(plan) || 1, plan.weeks || 4);
        const title = document.createElement('div');
        title.className = 'pb-title';
        const tName = document.createElement('span');
        tName.textContent = `▶ ${plan.name} · ${day.name}`;
        const tClock = document.createElement('span');
        tClock.className = 'pb-elapsed';
        title.append(tName, tClock);
        banner.appendChild(title);
        const fmtElapsed = () => {
          const s = Math.max(0, Math.floor((Date.now() - liveRun.startedAt) / 1000));
          const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
          tClock.textContent = '⏱ ' + (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0');
        };
        fmtElapsed();
        clearInterval(elapsedInt);
        elapsedInt = setInterval(fmtElapsed, 1000);
        const sub = document.createElement('div');
        sub.className = 'plan-status' + (w === (plan.weeks || 4) ? ' final' : '');
        sub.textContent = `Week ${w} of ${plan.weeks || 4}` + (w === (plan.weeks || 4) ? ' — final week, finish strong! 🔥' : '');
        banner.appendChild(sub);
        const doneIds = new Set(sessions.filter(s => s.planId === plan.id).map(s => s.exerciseId));
        for (const item of day.items) {
          const ex = exercises.find(e => e.id === item.exerciseId);
          if (!ex) continue;
          const row = document.createElement('div');
          row.className = 'pb-item' + (doneIds.has(ex.id) ? ' done' : '');
          const nm = document.createElement('span');
          nm.textContent = `${doneIds.has(ex.id) ? '✓ ' : ''}${ex.name} · ${item.sets}×${item.reps}`;
          const btn = document.createElement('button');
          btn.textContent = doneIds.has(ex.id) ? 'Edit' : 'Log';
          btn.onclick = () => {
            const existing = sessions.find(s => s.planId === plan.id && s.exerciseId === ex.id);
            logCtx = {
              exerciseId: ex.id,
              planId: plan.id,
              fromPlan: true,
              sessionId: existing ? existing.id : undefined,
              target: { sets: item.sets, reps: item.reps }
            };
            openLogSheet(ex, existing);
          };
          row.append(nm, btn);
          banner.appendChild(row);
        }
        const finish = document.createElement('button');
        finish.className = 'btn ghost small block pb-finish';
        finish.textContent = '✓ Finish ' + day.name;
        finish.onclick = async () => {
          const mins = Math.max(1, Math.round((Date.now() - liveRun.startedAt) / 60000));
          plan.completed = plan.completed || [];
          plan.completed.push({ week: w, day: liveRun.dayIndex || 0, date: todayStr(), duration: mins });
          if (w >= (plan.weeks || 4)) {
            const doneFinalWeek = new Set(
              plan.completed.filter(c => c.week >= (plan.weeks || 4)).map(c => c.day));
            if (doneFinalWeek.size >= plan.days.length) plan.finishedAt = Date.now();
          }
          await DB.put('plans', plan);
          activeRun.set(null);
          clearInterval(elapsedInt);
          if (plan.finishedAt) {
            alert(`🎉 Program complete!\n\n"${plan.name}" — all ${plan.weeks || 4} weeks done (today: ${mins} min). Amazing work!\n\nTime to build a new plan in the Plans tab.`);
          } else {
            alert(`✓ ${day.name} complete — ${mins} min. 💪`);
          }
          renderWorkout();
        };
        banner.appendChild(finish);
      }
    } else { banner.hidden = true; clearInterval(elapsedInt); }

    $('#workout-empty').hidden = sessions.length > 0 || !banner.hidden;

    for (const s of sessions) {
      const ex = exercises.find(e => e.id === s.exerciseId);
      const card = document.createElement('div');
      card.className = 'log-card';
      const head = document.createElement('div');
      head.className = 'log-head';
      const nm = document.createElement('span');
      nm.className = 'log-name';
      nm.textContent = ex ? ex.name : '(deleted exercise)';
      const edit = document.createElement('button');
      edit.className = 'log-edit';
      edit.textContent = 'Edit';
      edit.onclick = () => {
        logCtx = { exerciseId: s.exerciseId, sessionId: s.id };
        openLogSheet(ex, s);
      };
      head.append(nm, edit);
      card.appendChild(head);
      const chips = document.createElement('div');
      chips.className = 'set-chips';
      for (const set of s.sets) {
        const chip = document.createElement('span');
        chip.className = 'set-chip';
        chip.textContent = set.weight ? `${set.reps} × ${set.weight} kg` : `${set.reps} reps`;
        chips.appendChild(chip);
      }
      card.appendChild(chips);
      log.appendChild(card);
    }
  }

  /* ================= PLANS ================= */
  async function renderPlans() {
    const list = $('#plan-list');
    list.innerHTML = '';
    $('#plan-empty').hidden = plans.length > 0;
    for (const plan of plans) {
      const weeks = plan.weeks || 4;
      const days = plan.days || [];
      const w = planWeek(plan);
      const finished = planFinished(plan);

      const card = document.createElement('div');
      card.className = 'plan-card';
      const nm = document.createElement('div');
      nm.className = 'plan-name';
      nm.textContent = plan.name;
      const meta = document.createElement('div');
      meta.className = 'plan-meta';
      meta.textContent = `${weeks}-week program · ${days.length}× per week`;
      card.append(nm, meta);

      const status = document.createElement('div');
      if (finished) {
        status.className = 'plan-complete-box';
        status.textContent = `🎉 Program complete — ${weeks} weeks done! Build a new plan to keep progressing.`;
      } else if (!w) {
        status.className = 'plan-status';
        status.textContent = 'Not started — hit ▶ on a training day to begin week 1';
      } else {
        const cur = Math.min(w, weeks);
        status.className = 'plan-status' + (cur === weeks ? ' final' : '');
        status.textContent = `Week ${cur} of ${weeks}` + (cur === weeks ? ' — final week! 🔥' : '');
      }
      card.appendChild(status);

      if (w && !finished) {
        const bar = document.createElement('div');
        bar.className = 'plan-progress';
        const fill = document.createElement('div');
        fill.style.width = Math.min(100, Math.round((Math.min(w, weeks) - 1) / weeks * 100 + (100 / weeks) * 0.5)) + '%';
        bar.appendChild(fill);
        card.appendChild(bar);
      }

      const curWeek = w ? Math.min(w, weeks) : null;
      const doneThisWeek = new Set(
        (plan.completed || []).filter(c => c.week === curWeek).map(c => c.day));
      days.forEach((day, i) => {
        const row = document.createElement('div');
        row.className = 'plan-day-row' + (doneThisWeek.has(i) ? ' done' : '');
        const dn = document.createElement('span');
        dn.className = 'pd-name';
        dn.textContent = (doneThisWeek.has(i) ? '✓ ' : '') + day.name;
        const cnt = document.createElement('span');
        cnt.className = 'pd-count';
        const lastDone = (plan.completed || []).filter(c => c.day === i && c.duration).pop();
        cnt.textContent = day.items.length + ' exercises' + (lastDone ? ` · last ${lastDone.duration} min` : '');
        const go = document.createElement('button');
        go.textContent = doneThisWeek.has(i) ? 'Done' : '▶ Start';
        go.onclick = async () => {
          if (!plan.startDate) { plan.startDate = todayStr(); await DB.put('plans', plan); }
          activeRun.set({ planId: plan.id, dayIndex: i, date: todayStr(), startedAt: Date.now() });
          switchView('workout');
        };
        row.append(dn, cnt, go);
        card.appendChild(row);
      });

      const actions = document.createElement('div');
      actions.className = 'plan-actions';
      if (finished) {
        const again = document.createElement('button');
        again.className = 'btn primary small';
        again.textContent = 'New plan';
        again.onclick = () => openPlanForm(null);
        actions.appendChild(again);
        const restart = document.createElement('button');
        restart.className = 'btn ghost small';
        restart.textContent = 'Restart';
        restart.onclick = async () => {
          if (!confirm(`Restart "${plan.name}" from week 1?`)) return;
          plan.startDate = null; plan.completed = []; plan.finishedAt = null;
          await DB.put('plans', plan);
          render();
        };
        actions.appendChild(restart);
      }
      const edit = document.createElement('button');
      edit.className = 'btn ghost small';
      edit.textContent = 'Edit';
      edit.onclick = () => openPlanForm(plan);
      const del = document.createElement('button');
      del.className = 'btn danger small';
      del.textContent = 'Delete';
      del.onclick = async () => {
        if (!confirm(`Delete plan "${plan.name}"?`)) return;
        const run = activeRun.get();
        if (run && run.planId === plan.id) activeRun.set(null);
        await DB.del('plans', plan.id);
        render();
      };
      actions.append(edit, del);
      card.appendChild(actions);
      list.appendChild(card);
    }
  }

  /* ----- plan form (weekly days builder) ----- */
  function openPlanForm(plan) {
    editingPlanId = plan ? plan.id : null;
    planDraft = plan
      ? {
          weeks: plan.weeks || 4,
          days: (plan.days || []).map(d => ({ name: d.name, items: d.items.map(i => ({ ...i })) }))
        }
      : { weeks: 4, days: [{ name: 'Day 1', items: [] }] };
    const form = $('#form-plan');
    form.reset();
    form.weeks.value = String(planDraft.weeks);
    if (plan) form.name.value = plan.name;
    $('#sheet-plan-title').textContent = plan ? 'Edit plan' : 'New plan';
    renderPlanDays();
    openSheet('#sheet-plan');
  }

  function renderPlanDays() {
    const wrap = $('#plan-days');
    wrap.innerHTML = '';
    planDraft.days.forEach((day, di) => {
      const card = document.createElement('div');
      card.className = 'day-card';
      const head = document.createElement('div');
      head.className = 'day-head';
      const nameIn = document.createElement('input');
      nameIn.type = 'text';
      nameIn.value = day.name;
      nameIn.placeholder = 'Day name (e.g. Push, Legs…)';
      nameIn.oninput = () => day.name = nameIn.value;
      head.appendChild(nameIn);
      if (planDraft.days.length > 1) {
        const delDay = document.createElement('button');
        delDay.type = 'button';
        delDay.className = 'del-day';
        delDay.textContent = '🗑';
        delDay.onclick = () => { planDraft.days.splice(di, 1); renderPlanDays(); };
        head.appendChild(delDay);
      }
      card.appendChild(head);

      day.items.forEach((item, i) => {
        const ex = exercises.find(e => e.id === item.exerciseId);
        const row = document.createElement('div');
        row.className = 'plan-item-row';
        const nm = document.createElement('span');
        nm.className = 'pi-name';
        nm.textContent = ex ? ex.name : '(deleted)';
        const sets = document.createElement('input');
        sets.type = 'number'; sets.min = '1'; sets.inputMode = 'numeric';
        sets.value = item.sets;
        sets.oninput = () => item.sets = Number(sets.value) || 1;
        const x = document.createElement('span');
        x.className = 'pi-x';
        x.textContent = '×';
        const reps = document.createElement('input');
        reps.type = 'number'; reps.min = '1'; reps.inputMode = 'numeric';
        reps.value = item.reps;
        reps.oninput = () => item.reps = Number(reps.value) || 1;
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'del-item';
        del.textContent = '✕';
        del.onclick = () => { day.items.splice(i, 1); renderPlanDays(); };
        row.append(nm, sets, x, reps, del);
        card.appendChild(row);
      });

      const addEx = document.createElement('button');
      addEx.type = 'button';
      addEx.className = 'btn ghost small';
      addEx.textContent = '＋ Add exercise';
      addEx.onclick = () => {
        openPicker(ex => {
          day.items.push({ exerciseId: ex.id, sets: 3, reps: 10 });
          renderPlanDays();
          openSheet('#sheet-plan');
        });
      };
      card.appendChild(addEx);
      wrap.appendChild(card);
    });
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
    render();
  };

  /* ================= REST TIMER ================= */
  let timerEnd = null, timerInt = null, audioCtx = null;

  function restDefault() {
    return Number(localStorage.getItem('restDefault')) || 90;
  }
  function markRestChip() {
    const d = restDefault();
    $$('#rest-chips button').forEach(b =>
      b.classList.toggle('selected', Number(b.dataset.sec) === d));
  }

  function beep() {
    try {
      if (!audioCtx) return;
      for (let i = 0; i < 3; i++) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = 880;
        o.connect(g); g.connect(audioCtx.destination);
        const t = audioCtx.currentTime + i * 0.35;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.start(t); o.stop(t + 0.3);
      }
    } catch { /* sound is best-effort */ }
  }

  function timerTick() {
    const left = Math.ceil((timerEnd - Date.now()) / 1000);
    if (left <= 0) {
      $('#timer-remaining').textContent = 'GO! 💪';
      $('#timer-pill').classList.add('done');
      clearInterval(timerInt);
      timerInt = null;
      beep();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      setTimeout(() => { if (!timerInt) $('#timer-pill').hidden = true; }, 4000);
      return;
    }
    $('#timer-remaining').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
  }

  function startRest(sec) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch { /* no audio available */ }
    timerEnd = Date.now() + sec * 1000;
    const pill = $('#timer-pill');
    pill.classList.remove('done');
    pill.hidden = false;
    clearInterval(timerInt);
    timerInt = setInterval(timerTick, 250);
    timerTick();
  }

  $$('#rest-chips button').forEach(b => b.onclick = () => {
    localStorage.setItem('restDefault', b.dataset.sec);
    markRestChip();
    startRest(Number(b.dataset.sec));
  });
  markRestChip();
  $('#timer-cancel').onclick = () => {
    clearInterval(timerInt);
    timerInt = null;
    $('#timer-pill').hidden = true;
  };

  /* ================= HISTORY ================= */
  async function renderHistory() {
    const sessions = (await DB.all('sessions')).sort((a, b) => b.ts - a.ts);
    const list = $('#history-list');
    list.innerHTML = '';
    $('#history-empty').hidden = sessions.length > 0;

    const byDate = new Map();
    for (const s of sessions) {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date).push(s);
    }
    for (const [date, group] of byDate) {
      const day = document.createElement('div');
      day.className = 'day-group';
      const label = document.createElement('div');
      label.className = 'day-label';
      label.textContent = date === todayStr() ? 'Today · ' + date : date;
      day.appendChild(label);
      for (const s of group) {
        const ex = exercises.find(e => e.id === s.exerciseId);
        const entry = historyEntry(s, ex, () => render());
        const d = entry.querySelector('.h-date');
        d.textContent = ex ? ex.name : '(deleted exercise)';
        day.appendChild(entry);
      }
      list.appendChild(day);
    }
  }

  /* ================= boot ================= */
  DB.persist();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  /* attach demo animations to exercises added before demos existed */
  async function migrateDemos() {
    const all = await DB.all('exercises');
    for (const ex of all) {
      if (ex.demo) continue;
      const item = (window.EXERCISE_LIBRARY || []).find(
        i => i.demo && i.name.toLowerCase() === ex.name.toLowerCase());
      if (item) { ex.demo = item.demo; await DB.put('exercises', ex); }
    }
  }

  /* convert single-list plans (old format) to weekly programs */
  async function migratePlans() {
    const all = await DB.all('plans');
    for (const p of all) {
      if (p.items && !p.days) {
        p.days = [{ name: 'Day 1', items: p.items }];
        delete p.items;
        p.weeks = p.weeks || 4;
        p.completed = p.completed || [];
        await DB.put('plans', p);
      }
    }
  }

  Promise.all([migrateDemos(), migratePlans()]).then(render);
})();
