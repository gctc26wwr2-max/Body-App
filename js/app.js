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
  let planDraftItems = [];            // [{exerciseId, sets, reps}]
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
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del-set';
    del.textContent = '✕';
    del.onclick = () => { row.remove(); renumberSets(); };
    row.append(num, r, w, del);
    return row;
  }

  function renumberSets() {
    $$('#set-rows .set-row .set-num').forEach((el, i) => el.textContent = i + 1);
  }

  function openLogSheet(ex, session) {
    $('#sheet-log-title').textContent = ex ? ex.name : 'Log sets';
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
    labels.innerHTML = '<span>#</span><span>Reps</span><span>Weight (kg)</span><span></span>';
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
      if (!plan) { activeRun.set(null); banner.hidden = true; }
      else {
        banner.hidden = false;
        const title = document.createElement('div');
        title.className = 'pb-title';
        title.textContent = '▶ ' + plan.name;
        banner.appendChild(title);
        const doneIds = new Set(sessions.filter(s => s.planId === plan.id).map(s => s.exerciseId));
        for (const item of plan.items) {
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
        finish.textContent = 'Finish plan';
        finish.onclick = () => { activeRun.set(null); renderWorkout(); };
        banner.appendChild(finish);
      }
    } else banner.hidden = true;

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
      const card = document.createElement('div');
      card.className = 'plan-card';
      const nm = document.createElement('div');
      nm.className = 'plan-name';
      nm.textContent = plan.name;
      const meta = document.createElement('div');
      meta.className = 'plan-meta';
      meta.textContent = plan.items.length + ' exercise' + (plan.items.length === 1 ? '' : 's');
      const exList = document.createElement('div');
      exList.className = 'plan-ex-list';
      exList.textContent = plan.items.map(it => {
        const ex = exercises.find(e => e.id === it.exerciseId);
        return ex ? `${ex.name} ${it.sets}×${it.reps}` : null;
      }).filter(Boolean).join('  ·  ');
      const actions = document.createElement('div');
      actions.className = 'plan-actions';
      const start = document.createElement('button');
      start.className = 'btn primary small';
      start.textContent = '▶ Start';
      start.onclick = () => {
        activeRun.set({ planId: plan.id, date: todayStr() });
        switchView('workout');
      };
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
      actions.append(start, edit, del);
      card.append(nm, meta, exList, actions);
      list.appendChild(card);
    }
  }

  /* ----- plan form ----- */
  function openPlanForm(plan) {
    editingPlanId = plan ? plan.id : null;
    planDraftItems = plan ? plan.items.map(i => ({ ...i })) : [];
    const form = $('#form-plan');
    form.reset();
    if (plan) form.name.value = plan.name;
    $('#sheet-plan-title').textContent = plan ? 'Edit plan' : 'New plan';
    renderPlanItems();
    openSheet('#sheet-plan');
  }

  function renderPlanItems() {
    const wrap = $('#plan-items');
    wrap.innerHTML = '';
    planDraftItems.forEach((item, i) => {
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
      del.onclick = () => { planDraftItems.splice(i, 1); renderPlanItems(); };
      row.append(nm, sets, x, reps, del);
      wrap.appendChild(row);
    });
  }

  $('#plan-add-item').onclick = () => {
    openPicker(ex => {
      planDraftItems.push({ exerciseId: ex.id, sets: 3, reps: 10 });
      renderPlanItems();
      openSheet('#sheet-plan');
    });
  };

  $('#form-plan').onsubmit = async e => {
    e.preventDefault();
    if (!planDraftItems.length) { alert('Add at least one exercise to the plan.'); return; }
    const plan = editingPlanId
      ? await DB.get('plans', editingPlanId)
      : { id: DB.uid(), createdAt: Date.now() };
    plan.name = e.target.name.value.trim();
    plan.items = planDraftItems;
    await DB.put('plans', plan);
    closeSheets();
    render();
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
  migrateDemos().then(render);
})();
