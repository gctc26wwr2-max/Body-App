/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
  /* ============================================================
     LIBRARY
     ============================================================ */
  let libFilter = 'All', libQuery = '';
  const LIB_GROUPS = ['All', ...new Set((window.EXERCISE_LIBRARY || []).map(i => i.group))];

  /* The written content for each movement lives in its own file rather than in
     the bundle — it is far larger than the app itself and most sessions never
     need it. Fetched once, on the first visit to the library, then kept in
     memory. The service worker keeps a copy after that, so it works offline. */
  let CONTENT = null, contentPending = null;
  const MUSCLE_NAME = {};   // taxonomy id → the name a person would use
  const LIB_BY_ID = {};     // content id → library record, for the primary muscles

  function loadContent() {
    if (CONTENT) return Promise.resolve(CONTENT);
    if (contentPending) return contentPending;
    const grab = (url, fail) => fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .catch(() => fail);
    contentPending = Promise.all([
      grab('data/exercise-content.json', { content: [] }),
      /* small enough to come along for the ride; it carries which muscles are
         primary, which the content layer does not record */
      grab('data/exercise-library.json', { exercises: [] })
    ]).then(([c, l]) => {
      CONTENT = new Map((c.content || []).map(x => [x.id, x]));
      ((c.muscle_taxonomy && c.muscle_taxonomy.muscles) || [])
        .forEach(m => { MUSCLE_NAME[m.id] = m.display || m.id; });
      (l.exercises || []).forEach(e => { LIB_BY_ID[e.id] = e; });
      return CONTENT;
    });
    return contentPending;
  }

  /* A catalog item's demo slug is usually the content id; a handful differ,
     and three items carry no slug at all and match by name. */
  function contentIdFor(item) {
    if (!item) return null;
    const byEx = window.CONTENT_BY_EXNAME || {};
    /* the name is the reliable key; the demo slug is only a fallback for the
       older entries, and stopped matching once clips were filed under their
       own names. Apostrophes differ between the two files, so normalise. */
    const key = s => String(s || '').replace(/[’ʼ]/g, "'");
    if (!contentIdFor._byKey) {
      contentIdFor._byKey = {};
      for (const n in byEx) contentIdFor._byKey[key(n)] = byEx[n];
    }
    const hit = contentIdFor._byKey[key(item.name)];
    if (hit) return hit;
    const alias = window.CONTENT_ALIAS || {}, byName = window.CONTENT_BY_NAME || {};
    /* a plan item is only a name and a rep scheme — it carries no demo slug
       of its own, so borrow the catalog's for the same name */
    if (!contentIdFor._slugByName) {
      contentIdFor._slugByName = {};
      (window.EXERCISE_LIBRARY || []).forEach(i => {
        if (i.demo) contentIdFor._slugByName[key(String(i.name).toLowerCase())] = i.demo;
      });
    }
    const low = key(String(item.name || '').toLowerCase());
    const slug = item.demo || byName[low] || contentIdFor._slugByName[low];
    return slug ? (alias[slug] || slug) : null;
  }
  function contentFor(item) {
    if (!CONTENT || !item) return null;
    const id = contentIdFor(item);
    return (id && CONTENT.get(id)) || null;
  }

  /* ---------------- how hard it is ----------------
     Not how heavy — how much technique the movement asks for before it is
     safe to load. It rides under the name everywhere an exercise is shown,
     because that is the thing you want to know before you pick it, not
     after you have already put the bar on your back.
     The written entry carries `difficulty`; the library record's `skill`
     (1–3) is the same three-step scale and covers anything the content
     layer has not been written for yet. */
  const HARDSHIP = [
    null,
    { n: 1, label: 'Beginner', note: 'simple — hard to get wrong' },
    { n: 2, label: 'Intermediate', note: 'takes some practice — start light' },
    { n: 3, label: 'Advanced', note: 'learn the movement first, then add weight' }
  ];
  const HARD_BY_WORD = { beginner: 1, intermediate: 2, advanced: 3 };

  /* the handful of catalog movements the written library has not been given
     an entry for yet — rated here so the line is never blank */
  const HARD_EXTRA = { 'bicycle crunch': 1, 'swimming': 2 };

  function hardshipOf(item) {
    if (!item) return null;
    /* what the user said, if this is their own exercise */
    if (item.hardship >= 1 && item.hardship <= 3) return HARDSHIP[item.hardship];
    const con = contentFor(item);
    const byWord = con && HARD_BY_WORD[String(con.difficulty || '').toLowerCase()];
    if (byWord) return HARDSHIP[byWord];
    const lib = LIB_BY_ID[contentIdFor(item)];
    const n = lib && lib.skill;
    if (n >= 1 && n <= 3) return HARDSHIP[n];
    const extra = HARD_EXTRA[String(item.name || '').toLowerCase()];
    return extra ? HARDSHIP[extra] : null;
  }

  /* three bars and the word — small enough to sit on a meta line, legible
     enough to read without tapping through */
  function hardChip(item, extra) {
    const h = hardshipOf(item);
    if (!h) return null;
    const chip = el('span', 'hardness h' + h.n + (extra ? ' ' + extra : ''));
    chip.title = h.note;
    const bars = el('i', 'hard-bars');
    for (let i = 1; i <= 3; i++) bars.appendChild(el('i', i <= h.n ? 'on' : ''));
    chip.appendChild(bars);
    chip.appendChild(el('span', 'hard-lbl', h.label));
    return chip;
  }
  /* append to an existing meta line, with a separator if it already says
     something */
  function addHardship(node, item, extra) {
    const chip = hardChip(item, extra);
    if (!chip) return null;
    if (node.childNodes.length) node.appendChild(el('span', 'hard-sep', '·'));
    node.appendChild(chip);
    return chip;
  }

  /* Block Master — building a block, the exercises it can draw on, and the
     kit you actually have, all in one place because they decide each other. */
  let masterTab = 'block';   // Plan tab segment: block · ready · new · ai · exercises

  function renderLibrary() {
    const root = $('#view-library');
    root.innerHTML = '';
    const owned = getEquip();
    const usable = (window.EXERCISE_LIBRARY || []).filter(equipOK);
    const head = el('header', 't-head');
    const hl = el('div');
    const sub = el('div', 't-date',
      `${usable.length} of ${(window.EXERCISE_LIBRARY || []).length} exercises · ${owned.size} kit`);
    hl.appendChild(sub);
    hl.appendChild(el('h1', 't-title', 'Block Master'));
    head.appendChild(hl);
    root.appendChild(head);

    /* only the panel below is rebuilt on a tab change — the toggle itself
       stays put so its pill can slide instead of jumping */
    const panel = el('div', 'master-panel');
    const fill = () => {
      const own = getEquip();
      const ok = (window.EXERCISE_LIBRARY || []).filter(equipOK);
      sub.textContent = `${ok.length} of ${(window.EXERCISE_LIBRARY || []).length} exercises · ${own.size} kit`;
      panel.innerHTML = '';
      if (masterTab === 'new') renderMasterNew(panel);
      else if (masterTab === 'ready') renderMasterReady(panel);
      else if (masterTab === 'ai') renderMasterAI(panel);
      else renderMasterLib(panel);
    };
    /* kit lives in Settings now — it is a handful of switches you set once,
       not something to pick through while building a block */
    root.appendChild(segToggle(
      [['new', 'Build'], ['ready', 'Ready'], ['ai', 'Ask AI'], ['exercises', 'Library']],
      masterTab === 'equipment' ? 'new' : masterTab,
      k => { masterTab = k; fill(); },
      'master-seg'));
    root.appendChild(panel);
    fill();
  }

  /* One line of a block's day: the movement, its sets and reps, and a way
     through to the exercise. Shared by the plan's day previews and the block
     previews in Block Master so the two always read the same. */
  function planItemRow(it, from) {
    const ex = exercises.find(x => x.id === it.exerciseId);
    const row = el('div', 'pv-row');
    const th = el('div', 'pv-thumb');
    th.appendChild(thumbFor(ex));
    row.appendChild(th);
    const c = el('div');
    c.appendChild(el('div', 'pv-name', ex ? ex.name : '(deleted)'));
    const timed = isTimedEx(ex);
    const pvMeta = el('div', 'pv-meta num',
      `${it.sets} × ${it.repLo}-${it.repHi}${timed ? ' s' : ' reps'}`
      + (it.kg ? ` · ${fmtW(it.kg)}` : ''));
    if (ex) addHardship(pvMeta, ex);
    c.appendChild(pvMeta);
    row.appendChild(c);
    if (ex) {
      row.appendChild(el('div', 'pv-go', '›'));
      row.onclick = e => { e.stopPropagation(); openDetail(ex.id, from); };
    }
    return row;
  }

  function renderMasterNew(root) {
    const start = el('button', 'btn-cta big');
    start.style.width = '100%';
    start.textContent = '＋ Build a new block';
    start.onclick = () => openPlanMaker('library');
    root.appendChild(start);
    const live = activePlan();
    const q = queuedPlans();
    if (!plans.length) {
      root.appendChild(el('div', 'coach-note',
        'Three dials — sets, exercise, reps. Your kit and injuries filter the list.'));
      return;
    }
    root.appendChild(el('div', 'micro', 'Your blocks'));
    const list = el('div', 'ex-index');
    [...plans].sort((a, b) => b.createdAt - a.createdAt).forEach(p => {
      const r = el('div', 'exi-row');
      const state = p === live ? 'Running' : (p.queued ? 'Queued' : (planFinished(p) ? 'Done' : 'Idle'));
      r.appendChild(el('div', 'exi-num', state === 'Running' ? '▶' : (state === 'Queued' ? '⋯' : '·')));
      const nm = el('div', 'exi-name', p.name);
      const total = (p.days || []).reduce((n, d) => n + (d.items || []).length, 0);
      nm.appendChild(el('span', 'exi-sub',
        `${p.days.length} day${p.days.length === 1 ? '' : 's'} · ${total} exercise${total === 1 ? '' : 's'}`
        + ` · ${p.weeks || 4}w${p.deload ? ' +deload' : ''} · ${state}`));
      r.appendChild(nm);
      r.appendChild(el('div', 'exi-go', '▾'));
      list.appendChild(r);

      /* tap a block to see what is actually in it — otherwise the only way to
         find out is to install it and look at the Plan tab */
      const pv = el('div', 'blk-preview');
      pv.hidden = true;
      r.onclick = () => {
        if (pv.hidden && !pv.dataset.built) {
          (p.days || []).forEach(day => {
            const head = el('div', 'blk-day');
            head.appendChild(el('div', 'blk-day-name', day.name));
            head.appendChild(el('div', 'blk-day-meta num', (day.items || []).length + ''));
            pv.appendChild(head);
            (day.items || []).forEach(it => pv.appendChild(planItemRow(it, 'library')));
          });
          if (!(p.days || []).length) pv.appendChild(el('div', 'pv-meta', 'This block has no days yet.'));
          pv.dataset.built = '1';
        }
        pv.hidden = !pv.hidden;
        r.classList.toggle('open', !pv.hidden);
      };
      list.appendChild(pv);
    });
    root.appendChild(list);
  }

  /* ============================================================
     READY-MADE BLOCKS
     Thirty blocks already written, filtered down by who they were built
     for, how they split the week and how hard they are. Installing one is
     the same act as finishing your own — queue it behind what is running,
     or replace it.
     ============================================================ */
  const READY_LVL = ['', 'Easy', 'Moderate', 'Hard'];
  /* the splits in words a first-timer has — jargon explains itself once */
  const SPLIT_PLAIN = {
    'Full body': 'Everything, every visit',
    'Upper / Lower': 'Top half one day, legs the next',
    'Push / Pull / Legs': 'A pushing day, a pulling day, a leg day',
    'Push / Pull': 'A pushing day, then a pulling day',
    'Body part': 'One area per day',
    'Muscle focus': 'The whole week bends toward one muscle',
    'Home': 'No gym needed'
  };
  let readyWho = null, readySplit = 'All';

  function readyKitGap(plan) {
    const lib = window.EXERCISE_LIBRARY || [];
    const miss = new Set();
    plan.days.forEach(d => d.items.forEach(it => {
      const rec = lib.find(x => x.name === it[0]);
      if (rec && !equipOK(rec)) equipOf(rec).forEach(k => {
        const own = getEquip();
        if (!own.has(k)) miss.add(k);
      });
    }));
    return [...miss];
  }

  async function installReady(plan) {
    const block = {
      name: plan.name, weeks: plan.weeks, deload: !!plan.deload,
      days: plan.days.map(d => ({
        name: d.name,
        items: d.items.map(([name, sets, lo, hi, thumb]) => {
          const rec = (window.EXERCISE_LIBRARY || []).find(x => x.name === name)
            || { name, group: 'Other', notes: '' };
          /* the checked photo rides along, so the installed block has
             pictures everywhere the app shows one */
          return { name, rec: { ...rec, demo: thumb }, sets, repLo: lo, repHi: hi };
        })
      }))
    };
    return createPlanFromImport(block);
  }

  function openReadySheet(p) {
    $('#sheet-ready-title').textContent = p.name;
    const body = $('#sheet-ready-body');
    body.innerHTML = '';
    const total = p.days.reduce((n, d) => n + d.items.length, 0);
    body.appendChild(el('div', 'rdy-sheet-sub',
      `${READY_LVL[p.level]} · ${p.days.length} days a week · ${p.weeks} weeks · ${total} exercises`));
    body.appendChild(el('div', 'rdy-note', p.note));
    const gap = readyKitGap(p);
    if (gap.length) body.appendChild(el('div', 'rdy-gap',
      `Needs kit you have switched off: ${gap.join(', ')}`));
    p.days.forEach(d => {
      const h = el('div', 'blk-day');
      h.appendChild(el('div', 'blk-day-name', d.name));
      h.appendChild(el('div', 'blk-day-meta num', d.items.length + ''));
      body.appendChild(h);
      d.items.forEach(([name, sets, lo, hi, thumb]) => {
        const rec = (window.EXERCISE_LIBRARY || []).find(x => x.name === name)
          || { name, group: 'Other', notes: '' };
        const row = el('div', 'pv-row');
        const th = el('div', 'pv-thumb');
        th.appendChild(thumbFor({ demo: thumb }));
        row.appendChild(th);
        const c = el('div');
        c.appendChild(el('div', 'pv-name', name));
        /* written out — "3 × 8–12" means nothing until someone has trained */
        const timed = isTimedEx(rec);
        const meta = el('div', 'pv-meta num',
          `${sets} set${sets === 1 ? '' : 's'} · ${fmtRange(lo, hi)} ${timed ? 's' : 'reps'}`);
        if (rec) addHardship(meta, rec);
        c.appendChild(meta);
        row.appendChild(c);
        row.appendChild(el('div', 'pv-go', '›'));
        /* the movement's page is a whole view, so the sheet steps aside and
           comes back when you do */
        row.onclick = async () => {
          const ex2 = await ensureExercise({ ...rec, demo: thumb });
          closeSheets();
          readyReopen = p.id;
          openDetail(ex2.id, 'library');
        };
        body.appendChild(row);
      });
    });
    const go = el('button', 'btn-cta big');
    go.style.cssText = 'width:100%;margin-top:14px';
    go.textContent = 'Use this block';
    go.onclick = async () => {
      go.disabled = true;
      const made = await installReady(p);
      if (!made) { go.disabled = false; return; }
      plans = await DB.all('plans');
      haptic();
      dismissSheet();
      masterTab = 'new';
      renderLibrary();
    };
    body.appendChild(go);
    openSheet('#sheet-ready');
    $('#sheet-ready').scrollTop = 0;
  }
  let readyReopen = null;

  /* Four of the block's own movements, dealt into a square. The cover is
     made of the exercises it actually contains, so no two blocks look the
     same and a picture does the work a line of grey type was doing. */
  function readyCover(p, n) {
    const seen = [];
    p.days.forEach(d => d.items.forEach(it => {
      if (it[4] && !seen.includes(it[4])) seen.push(it[4]);
    }));
    const take = Math.min(n, seen.length);
    const cover = el('div', 'rdy-cover n' + (take || 1));
    for (let i = 0; i < take; i++) {
      // spread the pick across the whole block, not the first four rows
      cover.appendChild(demoEl(seen[Math.floor(i * seen.length / take)], 'rdy-tile', true));
    }
    if (!take) cover.appendChild(el('div', 'demo-anim ph'));
    cover.appendChild(el('i', 'rdy-veil'));
    return cover;
  }

  /* a block's name carries its own subtitle after the dash — the card puts
     the two on separate lines rather than truncating a long single one */
  const readyName = p => p.name.split(' — ');

  function renderMasterReady(root) {
    const all = window.READY_PLANS || [];
    if (readyReopen) {
      const back = all.find(x => x.id === readyReopen);
      readyReopen = null;
      if (back) setTimeout(() => openReadySheet(back), 60);
    }
    if (!all.length) { root.appendChild(el('div', 'coach-note', 'No ready blocks in this build.')); return; }
    if (readyWho == null) readyWho = getProfile().sex || 'all';

    /* who they were written for, then how the week is split */
    root.appendChild(segToggle(
      [['all', 'Anyone'], ['female', 'Women'], ['male', 'Men']], readyWho,
      k => { readyWho = k; renderLibrary(); }, 'you-seg'));

    const forMe = all.filter(p => readyWho === 'all' ? true : (p.who === 'all' || p.who === readyWho));
    const splits = ['All', ...new Set(forMe.map(p => p.split))];
    if (!splits.includes(readySplit)) readySplit = 'All';
    const chips = el('div', 'fp-chips rdy-chips');
    splits.forEach(sp => {
      const b = el('button', sp === readySplit ? 'on' : '', sp);
      b.onclick = () => { readySplit = sp; renderLibrary(); };
      chips.appendChild(b);
    });
    root.appendChild(chips);
    if (SPLIT_PLAIN[readySplit]) root.appendChild(el('div', 'ab-hint', SPLIT_PLAIN[readySplit]));

    const totalOf = p => p.days.reduce((n, d) => n + d.items.length, 0);

    /* one block, as a card you can see: cover, name, and the two numbers
       that decide whether it fits — how long it runs and how much is in it */
    const mkCard = p => {
      const c = el('button', 'rdy-card');
      c.appendChild(readyCover(p, 4));
      c.appendChild(el('span', 'rdy-lvl l' + p.level, READY_LVL[p.level]));
      const b = el('div', 'rdy-card-b');
      const nm = readyName(p);
      const t = el('div', 'rdy-card-t', nm[0]);
      if (nm[1]) t.appendChild(el('small', '', nm[1]));
      b.appendChild(t);
      b.appendChild(el('div', 'rdy-card-m', `${p.weeks} wk · ${totalOf(p)} moves`));
      c.appendChild(b);
      c.onclick = () => { haptic(); openReadySheet(p); };
      return c;
    };

    /* Most people do not want to weigh thirty blocks — they want one picked
       for them. Choose from what they told About you: experience sets the
       effort, sex the audience, and three days a week is the honest default
       for anyone who has not said otherwise. */
    if (readySplit === 'All') {
      const pr2 = getProfile();
      const wantLvl = { new: 1, mid: 2, exp: 3 }[pr2.level] || 1;
      /* a muscle focus set in Settings outranks everything — that block was
         written for exactly this */
      const focus = (pr2.focus || [])[0];
      const focusPlan = focus && forMe.find(x => x.id === 'mf-' + focus);
      const best = focusPlan || [...forMe].sort((a, b) =>
        (Math.abs(a.level - wantLvl) * 2 + Math.abs(a.days.length - 3))
        - (Math.abs(b.level - wantLvl) * 2 + Math.abs(b.days.length - 3))
        || (b.who !== 'all') - (a.who !== 'all'))[0];
      if (best) {
        root.appendChild(el('div', 'month-label rdy-days', 'Start here'));
        const h = el('button', 'rdy-hero');
        h.appendChild(readyCover(best, 3));
        h.appendChild(el('span', 'rdy-lvl l' + best.level, READY_LVL[best.level]));
        const hb = el('div', 'rdy-hero-b');
        const hn = readyName(best);
        const ht = el('div', 'rdy-hero-t', hn[0]);
        if (hn[1]) ht.appendChild(el('small', '', hn[1]));
        hb.appendChild(ht);
        hb.appendChild(el('div', 'rdy-card-m',
          `${best.days.length} days · ${best.weeks} wk · ${totalOf(best)} moves`));
        hb.appendChild(el('div', 'rdy-why', focusPlan
          ? `Trains your ${focusLabels([focus])[0].toLowerCase()} twice a week.`
          : pr2.level
            ? 'Picked from your answers in About you.'
            : 'Answer About you and this pick gets smarter.'));
        h.appendChild(hb);
        h.onclick = () => { haptic(); openReadySheet(best); };
        root.appendChild(h);
      }
    }

    const list = forMe.filter(p => readySplit === 'All' || p.split === readySplit);

    /* The first thing that decides whether a block fits a life is how many
       days it asks for, so that is the first division. Each group is a shelf
       you push sideways: thirty-eight blocks stacked vertically was a
       scroll with no end to it. */
    const byDays = new Map();
    list.forEach(p => {
      const k = p.days.length;
      if (!byDays.has(k)) byDays.set(k, []);
      byDays.get(k).push(p);
    });
    [...byDays.keys()].sort((a, b) => a - b).forEach(dk => {
      const group = byDays.get(dk).sort((a, b) => a.level - b.level);
      const hd = el('div', 'rdy-shelf-h');
      hd.appendChild(el('div', 'month-label', `${dk} days a week`));
      hd.appendChild(el('div', 'rdy-count', String(group.length)));
      root.appendChild(hd);
      const shelf = el('div', 'rdy-shelf');
      group.forEach(p => shelf.appendChild(mkCard(p)));
      root.appendChild(shelf);
    });
  }

