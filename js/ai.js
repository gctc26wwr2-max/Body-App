/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
  /* ============================================================
     ASK AN AI
     Two halves of one round trip. The app writes the prompt, because it is
     the thing that knows your history, your kit and your numbers; the AI
     writes the block; the app reads it back. The format is fixed at both
     ends so pasting is the only manual step.
     ============================================================ */

  /* what the answer has to look like — quoted into the prompt and parsed
     back out of it, so there is one definition of the shape */
  const AI_SHAPE = `{
  "name": "Block 2 — Upper Strength",
  "weeks": 4,
  "deload": true,
  "days": [
    {
      "name": "Day A",
      "items": [
        { "exercise": "Bench Press", "sets": 4, "reps": "5-8" },
        { "exercise": "Seated Cable Row", "sets": 3, "reps": "8-12" }
      ]
    }
  ]
}`;

  function aiPool() {
    const tags = injuryTags();
    return pmExerciseList().filter(equipOK).filter(x => !isRisky(x, tags));
  }

  /* ---- muscle focus ----
     Which parts of you the next block should lean on. Lives in the profile,
     set from Settings on the body diagram or from the Ask AI chips — one
     setting, two doors. Capped at three: focus on everything is focus on
     nothing. */
  const FOCUS_GROUPS = [
    { key: 'chest', label: 'Chest', regions: ['chest'] },
    { key: 'back', label: 'Back', regions: ['upper-back', 'lower-back', 'trapezius'] },
    { key: 'shoulders', label: 'Shoulders', regions: ['front-deltoids', 'back-deltoids'] },
    { key: 'arms', label: 'Arms', regions: ['biceps', 'triceps', 'forearm'] },
    { key: 'core', label: 'Core', regions: ['abs', 'obliques'] },
    { key: 'glutes', label: 'Glutes', regions: ['gluteal', 'abductors'] },
    { key: 'quads', label: 'Quads', regions: ['quadriceps'] },
    { key: 'hams', label: 'Hamstrings', regions: ['hamstring', 'adductor'] },
    { key: 'calves', label: 'Calves', regions: ['calves', 'left-soleus', 'right-soleus'] }
  ];
  const REGION_GROUP = {};
  FOCUS_GROUPS.forEach(g => g.regions.forEach(r => { REGION_GROUP[r] = g.key; }));

  const focusToggle = (list, key) => {
    const has = list.includes(key);
    let next = has ? list.filter(k => k !== key) : [...list, key];
    if (next.length > 3) next = next.slice(next.length - 3);   // oldest drops off
    return next;
  };
  const focusLabels = list =>
    list.map(k => (FOCUS_GROUPS.find(g => g.key === k) || {}).label).filter(Boolean);

  /* The body diagram as a control: tap a muscle to focus it. Chips underneath
     say the same thing in words and toggle too. */
  function focusPicker(getSel, setSel) {
    const wrap = el('div', 'focus-pick');
    const figs = el('div', 'an-row');
    const holders = [];
    for (const [view, label] of [['front', 'Front'], ['back', 'Back']]) {
      const col = el('div', 'an-col');
      const holder = el('div', 'an-holder');
      holder.innerHTML = window.BODY_SVG ? window.BODY_SVG[view] : '';
      holders.push(holder);
      col.appendChild(holder);
      col.appendChild(el('div', 'an-cap', label));
      figs.appendChild(col);
    }
    wrap.appendChild(figs);
    const chips = el('div', 'fp-chips');
    wrap.appendChild(chips);

    const paint = () => {
      const sel = new Set(getSel());
      holders.forEach(h => h.querySelectorAll('[data-m]').forEach(n => {
        const g = REGION_GROUP[n.getAttribute('data-m')];
        n.classList.toggle('pri', !!g && sel.has(g));
      }));
      chips.querySelectorAll('button').forEach(b =>
        b.classList.toggle('on', sel.has(b.dataset.k)));
    };
    const flip = key => { setSel(focusToggle(getSel(), key)); haptic(); paint(); };

    holders.forEach(h => h.addEventListener('click', e => {
      const n = e.target.closest && e.target.closest('[data-m]');
      const g = n && REGION_GROUP[n.getAttribute('data-m')];
      if (g) flip(g);
    }));
    FOCUS_GROUPS.forEach(g => {
      const b = el('button', '', g.label);
      b.dataset.k = g.key;
      b.onclick = () => flip(g.key);
      chips.appendChild(b);
    });
    paint();
    wrap.repaint = paint;
    return wrap;
  }

  /* the default day count: what you are running now, else three */
  function aiDaysDefault() {
    const saved = +localStorage.getItem('aiDays');
    if (saved >= 2 && saved <= 6) return saved;
    const plan = activePlan();
    const n = plan && (plan.days || []).length;
    return n >= 2 && n <= 6 ? n : 3;
  }

  async function buildPlanPrompt() {
    const report = await trainingReport();
    const names = aiPool().map(x => x.name);
    const dayN = aiDaysDefault();
    const pr = getProfile();
    const focus = focusLabels(pr.focus || []);
    const L = [];
    L.push('You are writing my next training block. I will paste your answer straight '
      + 'into my training app, so the format at the bottom matters as much as the plan.');
    L.push('');
    L.push(report);
    L.push('');
    L.push('WHAT I WANT');
    L.push(`- One block, ${dayN} training day${dayN === 1 ? '' : 's'} a week unless you think that is wrong — say so if you do.`);
    if (focus.length) L.push(`- Extra attention on: ${focus.join(', ').toLowerCase()} — bias volume there without dropping the rest.`);
    if (pr.sessionMins) L.push(`- Each session has to fit ${pr.sessionMins} minutes including rest.`);
    L.push(/SESSIONS \(0 total/.test(report)
      ? '- I have not logged anything in this app yet, so pick sensible starting weights for my experience and let me correct them.'
      : '- Progress from where the numbers above actually are, not from scratch.');
    L.push('- Cover every movement pattern across the week and say in a line or two why the block is shaped the way it is.');
    L.push('');
    L.push('HOW TO ANSWER');
    L.push('Write your reasoning first in a few short lines. Then put the block itself in ONE fenced code block, '
      + 'exactly like this, with nothing but JSON inside the fence:');
    L.push('');
    L.push('```rackside');
    L.push(AI_SHAPE);
    L.push('```');
    L.push('');
    L.push('RULES FOR THE FENCE');
    L.push('- "exercise" must be copied exactly from the list below. If you want something that is not on it, use the nearest thing that is.');
    L.push('- "reps" is a range in quotes, like "8-12". A single number is fine too. For a timed hold, give the range in seconds.');
    L.push('- "sets" is a whole number, 1 to 8. Each day gets 3 to 8 exercises. The block gets 2 to 6 days.');
    L.push('- "weeks" 2 to 12. "deload": true adds one easier week at the end.');
    L.push('- Day names stay short — they become buttons.');
    L.push('- It has to parse as JSON: no comments, no trailing commas, straight quotes.');
    L.push('');
    L.push(`EXERCISES I CAN PICK FROM (${names.length} — this is my kit and my injuries already filtered):`);
    L.push(names.join(', '));
    return L.join('\n');
  }

  /* ---- reading the answer back ---- */
  const aiNorm = s => String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').replace(/\b(\w+?)s\b/g, '$1').trim();

  /* The name the AI wrote against the name the app knows. Exact first, then
     the same words in another order or a plural apart, then the closest
     overlap — and if nothing is close, it becomes one of your own. */
  function matchExercise(name) {
    const pool = pmExerciseList();
    const want = aiNorm(name);
    if (!want) return null;
    let hit = pool.find(x => aiNorm(x.name) === want);
    if (hit) return { rec: hit, how: 'exact' };
    /* A word the app has and the AI did not ask for is a qualifier — decline,
       smith, single-leg — and picking one of those for a plain name gives you
       the wrong movement. So an extra word on the app's side costs double a
       missing one, and "Barbell Bench Press" lands on "Bench Press" rather
       than on "Decline Barbell Bench Press". */
    const wt = new Set(want.split(' '));
    let best = null, bestScore = 0;
    pool.forEach(x => {
      const ct = new Set(aiNorm(x.name).split(' '));
      let shared = 0;
      ct.forEach(t => { if (wt.has(t)) shared++; });
      const score = shared / (shared + (wt.size - shared) + (ct.size - shared) * 2);
      if (score > bestScore) { bestScore = score; best = x; }
    });
    if (best && bestScore >= 0.55) return { rec: best, how: 'closest' };
    return { rec: { name: String(name).trim().slice(0, 60), group: 'Other', notes: '', custom: true }, how: 'new' };
  }

  function aiReps(v, fallback) {
    const f = fallback || [8, 12];
    if (v == null || v === '') return f;
    if (typeof v === 'number') return [Math.round(v), Math.round(v)];
    const m = String(v).match(/(\d+)\s*(?:[-–—]|to)\s*(\d+)/);
    if (m) return [+m[1], +m[2]];
    const one = String(v).match(/\d+/);
    return one ? [+one[0], +one[0]] : f;
  }

  /* Models wrap the JSON in a fence, or in prose, or in both. Take the fence
     if there is one, otherwise the first balanced object in the text. */
  function aiCarveJSON(text) {
    const fence = text.match(/```[a-z]*\s*([\s\S]*?)```/i);
    if (fence && fence[1].includes('{')) return fence[1];
    const start = text.indexOf('{');
    if (start < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
    }
    return null;
  }

  function parseBlockReply(raw) {
    const text = String(raw || '').trim();
    if (!text) return { error: 'Paste the reply in first.' };
    const carved = aiCarveJSON(text);
    if (!carved) return { error: 'No block found in that. Copy the whole reply, fence and all.' };
    const cleaned = carved
      .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, '$1');
    let obj;
    try { obj = JSON.parse(cleaned); }
    catch (e) { return { error: 'That block is not valid JSON — ask for it again, unchanged. (' + e.message + ')' }; }

    const rawDays = Array.isArray(obj) ? obj : (obj.days || obj.Days || obj.week || []);
    if (!Array.isArray(rawDays) || !rawDays.length) return { error: 'That block has no training days in it.' };
    const g = goalOf();
    const gr = g && PM_REPS[g.repIx];
    const fallback = gr ? [gr.lo, gr.hi] : [8, 12];
    const days = [];
    rawDays.slice(0, 6).forEach((d, di) => {
      const items = [];
      const list = Array.isArray(d) ? d : (d.items || d.exercises || d.movements || []);
      (Array.isArray(list) ? list : []).slice(0, 12).forEach(it => {
        const nm = typeof it === 'string' ? it : (it.exercise || it.name || it.movement);
        const m = matchExercise(nm);
        if (!m) return;
        let [lo, hi] = aiReps(typeof it === 'object' ? (it.reps != null ? it.reps : it.repRange) : null, fallback);
        if (typeof it === 'object' && it.repLo != null) { lo = +it.repLo; hi = +(it.repHi != null ? it.repHi : it.repLo); }
        /* a rep count is a rep count — 400 is a typo, and a range written
           backwards is still a range */
        lo = Math.max(1, Math.min(100, Math.round(lo) || fallback[0]));
        hi = Math.max(1, Math.min(100, Math.round(hi) || lo));
        if (hi < lo) { const t = lo; lo = hi; hi = t; }
        const sets = Math.max(1, Math.min(10, Math.round(+(typeof it === 'object' ? it.sets : 0)) || 3));
        items.push({ name: m.rec.name, rec: m.rec, how: m.how, asked: String(nm || '').trim(), sets, repLo: lo, repHi: hi });
      });
      if (items.length) days.push({ name: String((d && d.name) || '').trim() || 'Day ' + 'ABCDEF'[di], items });
    });
    if (!days.length) return { error: 'That block has days but no exercises in them.' };
    const weeks = Math.max(2, Math.min(12, Math.round(+obj.weeks) || 4));
    return {
      block: {
        name: String(obj.name || '').trim().slice(0, 60) || 'Block ' + (plans.length + 1),
        weeks, deload: obj.deload !== false, days
      }
    };
  }

  async function createPlanFromImport(block) {
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
      if (!mode) return false;
    }
    const days = [];
    for (const d of block.days) {
      const items = [];
      for (const it of d.items) {
        const ex = await ensureExercise(it.rec);
        items.push({ exerciseId: ex.id, sets: it.sets, repLo: it.repLo, repHi: it.repHi, kg: 0 });
      }
      days.push({ name: d.name, items });
    }
    const plan = {
      id: DB.uid(), createdAt: Date.now(), name: block.name,
      weeks: block.weeks + (block.deload ? 1 : 0), deload: !!block.deload,
      days, prefDays: (current && current.prefDays) || [0, 2, 4],
      startDate: null, completed: [], finishedAt: null, queued: mode === 'queue'
    };
    if (mode === 'replace') { current.finishedAt = Date.now(); await DB.put('plans', current); }
    await DB.put('plans', plan);
    return true;
  }

  /* ---- the tab ---- */
  let aiPasted = '';
  function renderMasterAI(root) {
    root.appendChild(el('div', 'coach-note',
      'Copy the prompt, paste it to any AI, paste the answer back — done.'));

    /* step one — check the dials before the prompt is written */
    const c1 = el('div', 'card ai-step');
    const h1 = el('div', 'ai-step-head');
    h1.appendChild(el('div', 'ai-num', '1'));
    h1.appendChild(el('div', 'ai-step-t', 'Copy the prompt'));
    c1.appendChild(h1);

    let promptText = '';
    const what = el('div', 'hist-meta', 'Reading your training…');
    const seeBox = el('textarea', 'ai-box');
    seeBox.readOnly = true;
    seeBox.rows = 8;
    const refresh = () => buildPlanPrompt().then(t => {
      promptText = t;
      seeBox.value = t;
      const exN = (t.match(/EXERCISES I CAN PICK FROM \((\d+)/) || [])[1] || '0';
      const sess = (t.match(/SESSIONS \((\d+) total/) || [])[1] || '0';
      what.textContent = `${sess} session${sess === '1' ? '' : 's'} · trends, attendance, numbers, kit · ${exN} exercises`;
    });

    const DAYS = [2, 3, 4, 5, 6];
    c1.appendChild(el('div', 'micro', 'Days a week'));
    c1.appendChild(optionRail(DAYS.map(String), DAYS.indexOf(aiDaysDefault()), i => {
      localStorage.setItem('aiDays', DAYS[i]);
      refresh();
    }, 64));

    /* focus is the profile's — the same setting the Settings diagram edits */
    c1.appendChild(el('div', 'micro', 'Focus'));
    const fc = el('div', 'fp-chips');
    const paintFc = () => {
      const sel = new Set(getProfile().focus || []);
      fc.querySelectorAll('button').forEach(b => b.classList.toggle('on', sel.has(b.dataset.k)));
    };
    FOCUS_GROUPS.forEach(g => {
      const b = el('button', '', g.label);
      b.dataset.k = g.key;
      b.onclick = () => {
        const pr2 = getProfile();
        pr2.focus = focusToggle(pr2.focus || [], g.key);
        localStorage.setItem('profile', JSON.stringify(pr2));
        haptic(); paintFc(); refresh();
      };
      fc.appendChild(b);
    });
    paintFc();
    c1.appendChild(fc);

    c1.appendChild(what);
    const copy = el('button', 'btn-lime', 'Copy the prompt');
    copy.style.width = '100%';
    const seeWrap = el('div');
    seeWrap.hidden = true;
    seeWrap.appendChild(seeBox);
    refresh();
    copy.onclick = async () => {
      if (!promptText) return;
      try {
        if (navigator.share) await navigator.share({ title: 'Plan my next block', text: promptText });
        else await navigator.clipboard.writeText(promptText);
        copy.textContent = 'Copied ✓';
        haptic();
        setTimeout(() => { copy.textContent = 'Copy the prompt'; }, 2600);
      } catch { /* dismissed */ }
    };
    c1.appendChild(copy);
    const see = el('button', 'btn-ghost ai-see', 'Read it first');
    see.onclick = () => {
      seeWrap.hidden = !seeWrap.hidden;
      see.textContent = seeWrap.hidden ? 'Read it first' : 'Hide it';
    };
    c1.appendChild(see);
    c1.appendChild(seeWrap);
    root.appendChild(c1);

    /* step two */
    const c2 = el('div', 'card ai-step');
    const h2 = el('div', 'ai-step-head');
    h2.appendChild(el('div', 'ai-num', '2'));
    h2.appendChild(el('div', 'ai-step-t', 'Paste the answer'));
    c2.appendChild(h2);
    const box = el('textarea', 'ai-box');
    box.rows = 5;
    box.placeholder = 'Paste the whole reply here.';
    box.value = aiPasted;
    box.oninput = () => { aiPasted = box.value; };
    c2.appendChild(box);
    const out = el('div', 'ai-out');
    const read = el('button', 'btn-lime', 'Read it');
    read.style.width = '100%';
    read.onclick = () => {
      out.innerHTML = '';
      const res = parseBlockReply(box.value);
      if (res.error) {
        out.appendChild(el('div', 'ai-bad', res.error));
        return;
      }
      const b = res.block;
      const total = b.days.reduce((n, d) => n + d.items.length, 0);
      out.appendChild(el('div', 'ai-good',
        `${b.name} · ${b.days.length} day${b.days.length === 1 ? '' : 's'} · `
        + `${total} exercise${total === 1 ? '' : 's'} · `
        + `${b.weeks} week${b.weeks === 1 ? '' : 's'}${b.deload ? ' + deload' : ''}`));
      let kitGaps = 0;
      b.days.forEach(d => {
        const dh = el('div', 'blk-day');
        dh.appendChild(el('div', 'blk-day-name', d.name));
        dh.appendChild(el('div', 'blk-day-meta num', d.items.length + ''));
        out.appendChild(dh);
        d.items.forEach(it => {
          const r = el('div', 'ai-row');
          const left = el('div', 'ai-row-l');
          left.appendChild(el('div', 'ai-row-n', it.name));
          if (it.how === 'closest') left.appendChild(el('div', 'ai-tag', 'nearest to “' + it.asked + '”'));
          if (it.how === 'new') left.appendChild(el('div', 'ai-tag new', 'new — added to your library'));
          /* the prompt's catalogue is kit-filtered, but nothing forces the
             reply to stay inside it — the same check the Ready blocks run
             happens here, before the block is yours */
          if (it.how !== 'new' && it.rec && !equipOK(it.rec)) {
            const own2 = getEquip();
            const need = equipOf(it.rec).filter(k => !own2.has(k))
              .map(k => ((window.EQUIPMENT || []).find(q => q.key === k) || { label: k }).label);
            if (need.length) {
              left.appendChild(el('div', 'ai-tag kit', 'needs ' + need.join(', ') + ' — not in your kit'));
              kitGaps++;
            }
          }
          r.appendChild(left);
          r.appendChild(el('div', 'ai-row-m num', `${it.sets} × ${it.repLo}-${it.repHi}`));
          out.appendChild(r);
        });
      });
      if (kitGaps) {
        out.appendChild(el('div', 'ai-kitnote',
          `${kitGaps} movement${kitGaps === 1 ? ' needs' : 's need'} kit you don't own. `
          + 'Install anyway, tick the kit in Settings, or paste this back to the AI and ask for substitutes.'));
      }
      const go = el('button', 'btn-cta big');
      go.style.cssText = 'width:100%;margin-top:14px';
      go.textContent = 'Create this block';
      go.onclick = async () => {
        go.disabled = true;
        const made = await createPlanFromImport(b);
        if (!made) { go.disabled = false; return; }
        aiPasted = '';
        plans = await DB.all('plans');
        haptic();
        masterTab = 'new';
        renderLibrary();
      };
      out.appendChild(go);
    };
    c2.appendChild(read);
    c2.appendChild(out);
    root.appendChild(c2);
  }

  /* Segmented toggle whose clay pill slides across to the option you pick,
     so the switch reads as one control rather than three separate buttons. */
  function segToggle(items, activeKey, onPick, extra) {
    const seg = el('div', 'seg-toggle slide' + (extra ? ' ' + extra : ''));
    seg.style.setProperty('--seg-n', items.length);
    const ind = el('i', 'seg-ind');
    seg.appendChild(ind);
    const paint = k => {
      const at = items.findIndex(x => x[0] === k);
      seg.style.setProperty('--seg-i', Math.max(0, at));
      seg.classList.toggle('unset', at < 0);     // nothing chosen: no pill at all
      [...seg.querySelectorAll('button')].forEach((b, i) => b.classList.toggle('sel', items[i][0] === k));
    };
    items.forEach(([key, label, disabled]) => {
      const b = el('button', '', label);
      b.disabled = !!disabled;
      b.onclick = () => {
        if (b.disabled) return;
        paint(key);              // slide first, then do the work
        haptic();
        // callers that rebuild their whole screen get a beat so the slide shows
        if (extra && extra.includes('defer')) setTimeout(() => onPick(key), 210);
        else onPick(key);
      };
      seg.appendChild(b);
    });
    paint(activeKey);
    return seg;
  }

  /* One equipment picker, used by Block Master and by the builder itself —
     the gym you are standing in is the thing that decides the block. */
  /* The kit list, as chips under counted headers. The old version was a
     wall of twenty-five identical boxes — with everything owned it read as
     one orange slab. A chip row is a third of the height, the section line
     says how much of it you own, and the icon still tells the machines
     apart at a glance. */
  /* The kit list as two spinnable photo rails — flick through a gym, tick
     what it has. Every tile is a photograph of the equipment in use with a
     tick badge; a tap toggles it on the spot, and each section carries its
     own All / None. Scroll positions survive the re-render, so ticking the
     tenth machine does not throw you back to the first. */
  function equipPicker(after) {
    const wrap = el('div', 'equip-wrap');
    const owned = getEquip();
    const all = (window.EXERCISE_LIBRARY || []);
    const HAND_PHOTO = { barbell: 'deadlift', bar: 'pull-up', 'm-hip': 'hip-thrust', 'm-latr': 'lateral-raise' };
    const photoFor = key => HAND_PHOTO[key]
      || ((all.find(x => x.demo && equipOf(x).includes(key)) || {}).demo || null);
    const mem = equipPicker._scroll = equipPicker._scroll || {};
    const secs = [...new Set((window.EQUIPMENT || []).map(q => q.sec || 'Other'))];
    secs.forEach(sec => {
      const items = (window.EQUIPMENT || []).filter(q => (q.sec || 'Other') === sec);
      const have = items.filter(q => q.always || owned.has(q.key)).length;
      const hd = el('div', 'eqs-head');
      hd.appendChild(el('div', 'micro', sec));
      const tools = el('div', 'eqs-tools');
      tools.appendChild(el('div', 'eqs-n num', have === items.length ? 'all' : have + ' of ' + items.length));
      const mini = (label, fn) => {
        const b = el('button', 'eqs-mini', label);
        b.onclick = () => { fn(); haptic(); after(); };
        tools.appendChild(b);
      };
      mini('All', () => { const s2 = getEquip(); items.forEach(q => s2.add(q.key)); setEquip(s2); });
      mini('None', () => { const s2 = getEquip(); items.forEach(q => { if (!q.always) s2.delete(q.key); }); setEquip(s2); });
      hd.appendChild(tools);
      wrap.appendChild(hd);

      const rail = el('div', 'eqw-rail');
      items.forEach(q => {
        const on = q.always || owned.has(q.key);
        const t = el('button', 'eqw-tile' + (on ? ' on' : '') + (q.always ? ' fixed' : ''));
        const ph = el('div', 'eqw-ph');
        const slug = photoFor(q.key);
        if (slug) {
          const im = document.createElement('img');
          im.src = `demos/${slug}/0.jpg`;
          im.loading = 'lazy';
          im.alt = '';
          ph.appendChild(im);
        } else {
          const ico = el('span', 'equip-ic');
          ico.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" '
            + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
            + ((window.EQUIP_ICON || {})[q.key] || (window.EQUIP_ICON || {}).machine || '') + '</svg>';
          ph.appendChild(ico);
        }
        ph.appendChild(el('i', 'eqw-tick'));
        t.appendChild(ph);
        t.appendChild(el('span', 'eqw-lbl', q.label));
        const n = all.filter(x => equipOf(x).includes(q.key)).length;
        t.title = q.always ? q.label : `${q.label} · ${n} move${n === 1 ? '' : 's'}`;
        if (!q.always) t.onclick = () => {
          const s2 = getEquip();
          s2.has(q.key) ? s2.delete(q.key) : s2.add(q.key);
          setEquip(s2);
          mem[sec] = rail.scrollLeft;
          haptic();
          after();
        };
        rail.appendChild(t);
      });
      /* the wheel look: whatever sits under the middle stands full size,
         neighbours fall away in scale and light with distance — the same
         physics language as every other wheel in the app */
      const focus = () => {
        const r = rail.getBoundingClientRect();
        if (!r.width) return;
        const cx = r.left + r.width / 2;
        rail.querySelectorAll('.eqw-tile').forEach(t2 => {
          const b2 = t2.getBoundingClientRect();
          const d = Math.min(1, Math.abs(b2.left + b2.width / 2 - cx) / (r.width * 0.6));
          t2.style.transform = `scale(${(1 - d * 0.18).toFixed(3)})`;
          t2.style.opacity = (1 - d * 0.45).toFixed(3);
        });
      };
      let raf2 = false;
      rail.addEventListener('scroll', () => {
        mem[sec] = rail.scrollLeft;
        if (!raf2) { raf2 = true; requestAnimationFrame(() => { raf2 = false; focus(); }); }
      }, { passive: true });
      if (mem[sec]) {
        /* restore after layout has given the rail its width — a single rAF
           can land before that and the position clamps to nothing */
        const v = mem[sec];
        requestAnimationFrame(() => requestAnimationFrame(() => {
          rail.scrollLeft = v;
          focus();
          setTimeout(() => { rail.scrollLeft = v; focus(); }, 90);
        }));
      } else {
        requestAnimationFrame(() => requestAnimationFrame(focus));
      }
      wrap.appendChild(rail);
    });

    const acts = el('div', 'equip-acts');
    const preset = (label, fn) => {
      const b = el('button', 'btn-ghost', label);
      b.onclick = () => { fn(); haptic(); after(); };
      acts.appendChild(b);
    };
    preset('Full gym', () => setEquip(new Set((window.EQUIPMENT || []).map(q => q.key))));
    preset('No machines', () => setEquip(new Set((window.EQUIPMENT || [])
      .filter(q => (q.sec || '') !== 'Machines').map(q => q.key))));
    preset('Home', () => setEquip(new Set(['bodyweight', 'mat', 'band'])));
    wrap.appendChild(acts);
    return wrap;
  }

  function renderMasterLib(root) {
    const add = el('button', 'chip-btn wide', '＋ Add your own exercise');
    add.onclick = () => openExerciseForm(null);
    root.appendChild(add);
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

    /* Draw immediately with the short notes, then fill the descriptions in
       when the content arrives. Nothing waits on the network. */
    if (!CONTENT) loadContent().then(() => {
      const live = $('#lib-list-root');
      if (live) renderLibList(live);
    });
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
      const c = el('div', 'lr-text');
      const nm = el('div', 'lr-name', name);
      if (r.mine) nm.appendChild(el('span', 'mine-tag', 'MINE'));
      c.appendChild(nm);
      const meta = el('div', 'lr-meta', group);
      addHardship(meta, r.mine ? r.ex : r.item);
      c.appendChild(meta);
      /* The written summary if this movement has one, otherwise its own
         coaching note — every row says something either way. */
      const con = contentFor(r.mine ? r.ex : r.item);
      const desc = (con && con.summary) || (r.mine ? r.ex.notes : r.item.notes) || '';
      if (desc) c.appendChild(el('div', 'lr-desc', desc));
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

  /* The catalog belongs to the app, not to the user: deleting one of its
     exercises would take the logged history with it, and the row would come
     straight back as an unadded library item anyway. Only exercises somebody
     wrote themselves can be removed. Records saved before this flag existed
     are judged by whether the catalog recognises the name. */
  const CATALOG_NAMES = new Set((window.EXERCISE_LIBRARY || []).map(i => i.name.toLowerCase()));
  const isCatalogName = n => CATALOG_NAMES.has(String(n || '').toLowerCase());
  const isCustomEx = ex => !!ex && (ex.custom === true
    || (ex.custom === undefined && !isCatalogName(ex.name)));

  async function ensureExercise(item) {
    let ex = exercises.find(e => e.name.toLowerCase() === item.name.toLowerCase());
    if (ex) return ex;
    ex = {
      id: DB.uid(), createdAt: Date.now(), mediaIds: [], custom: !!item.custom,
      name: item.name, group: item.group, notes: item.notes || '', demo: item.demo || null
    };
    await DB.put('exercises', ex);
    exercises.push(ex);
    exercises.sort((a, b) => a.name.localeCompare(b.name));
    return ex;
  }

