/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
  /* ============================================================
     PLAN FORM
     ============================================================ */
  /* every length a block can be, including the odd numbers a deload week
     produces — the dropdown only offered 2 to 6 */
  const EDIT_WEEKS = Array.from({ length: 15 }, (_, i) => i + 2);

  /* the block editor's draft, compared against what is stored so its X can
     ask the same question the other editors ask */
  let planSaved = null;
  const planDirty = () => JSON.stringify({ n: $('#form-plan').name.value, d: planDraft })
    !== planSaved;

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
    planSaved = JSON.stringify({ n: form.name.value, d: planDraft });
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
        swipeToRemove(r, () => { day.items.splice(ii, 1); renderPlanDays(); });
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
  /* the editor's X is the only way out, so it carries the question */
  $('#plan-x').onclick = () => {
    const form = $('#form-plan');
    const leave = () => { planSaved = null; closeSheets(); renderTab(); };
    if (!planDirty()) { leave(); return; }
    askOnClose({
      what: 'block',
      save: () => form.requestSubmit(),
      leave
    });
  };
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
    planSaved = null;
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
    /* WRAP DAY (Capacitor), first native launch, before anything renders:
       move media out of IndexedDB — the one WKWebView storage resident that
       historically misbehaves. For each DB.all('media') record carrying a
       .blob: write the bytes to the native filesystem (Directory.Data,
       media/<id>), then DB.put the record back as {id, exerciseId, type,
       path} with the blob dropped; stamp 'mediaNative1' when done. The read
       side (mediaURL) already understands path records, and mediaStore.save/
       remove grow native branches the same day. checkUpdate is already
       IS_NATIVE-gated. */
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
    /* native builds update through the App Store, days not minutes —
       polling version.json there would prompt reloads that change nothing */
    if (IS_NATIVE) return;
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

  applyAccent();
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
