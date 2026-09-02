/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
  /* ---------------- about you ----------------
     A handful of one-time answers that actually change what a block says.
     Stored on this device like everything else. */
  const GOALS = [
    { key: 'strength', label: 'Strength', reps: '5–8', repIx: 0, note: 'heavy, low reps, long rests' },
    { key: 'muscle', label: 'Muscle', reps: '8–12', repIx: 3, note: 'moderate load, controlled reps' },
    { key: 'fatloss', label: 'Fat loss', reps: '12–15', repIx: 5, note: 'higher reps, short rests, more cardio' },
    { key: 'health', label: 'Health', reps: '10–12', repIx: 4, note: 'steady, sustainable, joint-friendly' }
  ];
  const LEVELS = [
    { key: 'new', label: 'New', note: 'under a year — add weight often' },
    { key: 'mid', label: '1–3 yrs', note: 'add weight when reps are earned' },
    { key: 'exp', label: '3+ yrs', note: 'slower jumps, more volume tolerated' }
  ];
  const SESSION_MINS = [30, 45, 60, 75, 90];

  function getProfile() {
    try {
      const o = JSON.parse(localStorage.getItem('profile') || '{}');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch { return {}; }
  }
  function setProfile(patch) {
    const next = { ...getProfile(), ...patch };
    localStorage.setItem('profile', JSON.stringify(next));
    return next;
  }
  const goalOf = () => GOALS.find(g => g.key === getProfile().goal) || null;

  /* US Navy body-fat estimate — a tape measure beats most bathroom scales,
     and the trend matters more than the absolute number either way. */
  function navyBodyFat(pr) {
    const h = +pr.heightCm, w = +pr.waistCm, n = +pr.neckCm, hip = +pr.hipCm;
    if (!(h > 0 && w > 0 && n > 0)) return null;
    let bf;
    if (pr.sex === 'female') {
      if (!(hip > 0)) return null;
      bf = 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.22100 * Math.log10(h)) - 450;
    } else {
      if (w - n <= 0) return null;
      bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
    }
    return bf > 2 && bf < 70 ? +bf.toFixed(1) : null;
  }

  /* rough clock for a day's worth of work: a set plus its rest, and a warm-up */
  const dayMinutes = items => items.length
    ? Math.round(8 + items.reduce((a, it) => a + it.sets * 2.5, 0))
    : 0;

  const MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* current age from profile.birth ('YYYY-MM'); profiles from before the
     birth-date change fall back to their stored age number */
  function ageYears(pr) {
    if (pr && /^\d{4}-\d{2}$/.test(String(pr.birth || ''))) {
      const [y, m] = pr.birth.split('-').map(Number);
      const now = new Date();
      let a = now.getFullYear() - y;
      if (now.getMonth() + 1 < m) a--;
      return Math.max(0, Math.min(120, a));
    }
    return pr && pr.age != null && Number.isFinite(+pr.age) ? +pr.age : null;
  }

  /* Settings — one page with everything on it, no rows that open more rows. */
  function openAbout() { sDraft = null; abTape = 'heightCm'; show('about'); renderAbout(); }

  let sDraft = null;                       // edits live here until you Save
  let abTape = 'heightCm';                 // which figure the tape card is on

  function renderAbout() {
    const root = $('#view-about');
    root.innerHTML = '';
    if (!sDraft) sDraft = { ...getProfile() };
    const pr = sDraft;
    const saved = getProfile();
    const dirty = () => JSON.stringify(sDraft) !== JSON.stringify(saved);

    /* the screen previews your draft, so units read as you have just set them */
    const dH = () => (pr.hUnits === 'ft' ? 'ft' : 'cm');

    const leave = () => { sDraft = null; show('profile'); renderTab(); };

    const head = el('div', 'w-head pm-head');
    const hl = el('div', 'w-left');
    hl.appendChild(el('div', 't-date', 'Shapes every block you build'));
    hl.appendChild(el('h1', 'pm-name-static', 'About you'));
    head.appendChild(hl);
    const commit = () => {
      localStorage.setItem('profile', JSON.stringify(sDraft));
      haptic();
      leave();
    };
    const close = el('button', 'w-chip', '✕');
    close.onclick = () => {
      if (!dirty()) { leave(); return; }
      askOnClose({ what: 'profile', save: commit, leave });
    };
    head.appendChild(close);
    root.appendChild(head);

    root.appendChild(el('div', 'coach-note',
      'Nothing here is required — off just means not set.'));

    /* Every answer is a card that shows its control, because a screen of
       collapsed rows tells you nothing about what it wants. The controls
       differ on purpose: a choice gets a rail of words, a measurement gets a
       tape, and the four tape figures share one card instead of stacking four
       identical rulers. */
    const card = (key, label, readout, node, hint, lock) => {
      const b = el('div', 'ab-card' + (lock && !lock.on ? ' off' : ''));
      const h = el('div', 'ab-head');
      h.appendChild(el('div', 'micro', label));
      if (readout) h.appendChild(readout);
      if (lock) {
        const sw = el('button', 'inj-sw sm' + (lock.on ? ' on' : ''));
        sw.appendChild(el('i', 'inj-knob'));
        sw.onclick = e => { e.stopPropagation(); lock.toggle(); haptic(); renderAbout(); };
        h.appendChild(sw);
      }
      b.appendChild(h);
      const body = el('div', 'ab-body' + (lock && !lock.on ? ' locked' : ''));
      body.appendChild(node);
      b.appendChild(body);
      /* A dimmed card used to swallow taps, so reaching for the control did
         nothing at all. Now the control still works while it is dim: using it
         is what turns the answer on, and the value you touched is the value
         you get. */
      if (lock && !lock.on) {
        const wake = () => {
          if (sDraft[key] == null) sDraft[key] = lock.dflt;
          b.classList.remove('off');
          body.classList.remove('locked');
          const s = h.querySelector('.inj-sw');
          if (s) s.classList.add('on');
        };
        body.addEventListener('click', wake);
        body.addEventListener('pointerup', wake);
      }
      if (hint) b.appendChild(el('div', 'ab-hint', hint));
      root.appendChild(b);
      return b;
    };
    const lockFor = (key, dflt) => ({
      on: pr[key] != null, dflt,
      toggle: () => { if (pr[key] != null) delete sDraft[key]; else sDraft[key] = dflt; }
    });

    // ---- what you are training for ----
    const goalOut = el('div', 'ab-val' + (pr.goal ? '' : ' unset'),
      (GOALS.find(g => g.key === pr.goal) || {}).reps || 'not set');
    const goalHint = el('div', 'ab-hint', (GOALS.find(g => g.key === pr.goal) || {}).note
      || 'Sets the rep range a new block starts on');
    card('goal', 'Goal', goalOut,
      optionRail(GOALS.map(g => g.label), GOALS.findIndex(g => g.key === pr.goal), i => {
        sDraft.goal = GOALS[i].key;
        goalOut.textContent = GOALS[i].reps; goalOut.classList.remove('unset');
        goalHint.textContent = GOALS[i].note;
      }), null, lockFor('goal', GOALS[0].key)).appendChild(goalHint);

    const lvOut = el('div', 'ab-val' + (pr.level ? '' : ' unset'),
      (LEVELS.find(l => l.key === pr.level) || {}).label || 'not set');
    const lvHint = el('div', 'ab-hint', (LEVELS.find(l => l.key === pr.level) || {}).note
      || 'How fast the weight should climb');
    card('level', 'Experience', lvOut,
      optionRail(LEVELS.map(l => l.label), LEVELS.findIndex(l => l.key === pr.level), i => {
        sDraft.level = LEVELS[i].key;
        lvOut.textContent = LEVELS[i].label; lvOut.classList.remove('unset');
        lvHint.textContent = LEVELS[i].note;
      }), null, lockFor('level', LEVELS[0].key)).appendChild(lvHint);

    // ---- how long you have ---- a handful of lengths, not a ruler
    const minsOut = el('div', 'ab-val' + (pr.sessionMins != null ? '' : ' unset'),
      (pr.sessionMins != null ? pr.sessionMins : 60) + ' min');
    card('sessionMins', 'Time per session', minsOut,
      optionRail(SESSION_MINS.map(m => m + ' min'),
        Math.max(0, SESSION_MINS.indexOf(pr.sessionMins != null ? +pr.sessionMins : 60)),
        i => {
          sDraft.sessionMins = SESSION_MINS[i];
          minsOut.textContent = SESSION_MINS[i] + ' min';
          minsOut.classList.remove('unset');
        }, 78),
      'Each training day gets a clock in the builder', lockFor('sessionMins', 60));

    // ---- who you are ----
    const sexOut = el('div', 'ab-val' + (pr.sex ? '' : ' unset'),
      pr.sex === 'female' ? 'Female' : pr.sex === 'male' ? 'Male' : 'not set');
    card('sex', 'Sex', sexOut,
      segToggle([['male', 'Male'], ['female', 'Female']], pr.sex || '',
        k => { sDraft.sex = k; renderAbout(); }, 'you-seg'),
      'Only used for the body-fat estimate', lockFor('sex', 'male'));

    /* Born, not "age": a birth date never goes stale — the shown years keep
       themselves current. Month + year is precise enough for an age and one
       question less than a full date. A profile from before this change only
       carries age; that seeds the year wheel until the person corrects it. */
    const NOWY = new Date().getFullYear();
    const bYears = []; for (let y = NOWY - 10; y >= NOWY - 90; y--) bYears.push(y);
    const seeded = pr.birth || (pr.age != null ? (NOWY - +pr.age) + '-01' : null);
    let [by, bm] = (seeded || (NOWY - 30) + '-06').split('-').map(Number);
    const bornSet = pr.birth != null || pr.age != null;
    const bornOut = el('div', 'ab-val' + (bornSet ? '' : ' unset'),
      (ageYears({ birth: by + '-' + String(bm).padStart(2, '0') }) ?? 30) + ' yrs');
    const bornHint = el('div', 'ab-hint', bornSet
      ? MONTHS3[bm - 1] + ' ' + by + ' — the age keeps itself current'
      : 'Pick month and year — the age keeps itself current');
    const setBirth = () => {
      sDraft.birth = by + '-' + String(bm).padStart(2, '0');
      sDraft.age = ageYears(sDraft);        // older readers still see a number
      bornOut.textContent = sDraft.age + ' yrs';
      bornOut.classList.remove('unset');
      bornHint.textContent = MONTHS3[bm - 1] + ' ' + by + ' — the age keeps itself current';
    };
    const bornWheels = el('div', 'cd-wheels jump-wheels');
    const bmCol = el('div', 'cd-col');
    bmCol.appendChild(el('div', 'micro', 'Month'));
    bmCol.appendChild(pickerWheel(MONTHS3, bm - 1, i => { bm = i + 1; setBirth(); },
      'short', null, null, null, 'Birth month'));
    const byCol = el('div', 'cd-col');
    byCol.appendChild(el('div', 'micro', 'Year'));
    byCol.appendChild(pickerWheel(bYears.map(String), Math.max(0, bYears.indexOf(by)),
      i => { by = bYears[i]; setBirth(); }, 'short', null, null, null, 'Birth year'));
    bornWheels.appendChild(bmCol); bornWheels.appendChild(byCol);
    card('birth', 'Born', bornOut, bornWheels, null, {
      on: bornSet, dflt: (NOWY - 30) + '-06',
      toggle: () => {
        if (bornSet) { delete sDraft.birth; delete sDraft.age; }
        else { sDraft.birth = (NOWY - 30) + '-06'; sDraft.age = ageYears(sDraft); }
      }
    }).appendChild(bornHint);

    /* ---- the tape ----
       Height, waist and neck are the same action with the tape in three
       places, so they share one card and one ruler. Four identical rulers in
       a column looked like a printing error. */
    const TAPES = [
      { key: 'heightCm', label: 'Height', def: 175, hint: 'Standing, shoes off' },
      { key: 'waistCm', label: 'Waist', def: 85, hint: 'At the navel, tape level, breathe out' },
      { key: 'neckCm', label: 'Neck', def: 38, hint: 'Just below the Adam’s apple' }
    ];
    if (pr.sex === 'female') TAPES.push({ key: 'hipCm', label: 'Hips', def: 95, hint: 'Widest point' });
    if (!TAPES.some(t => t.key === abTape)) abTape = TAPES[0].key;
    const tape = TAPES.find(t => t.key === abTape);
    const imperial = dH() === 'ft';
    const isSet = pr[tape.key] != null;
    const fromCm = cm => (imperial ? +(cm / 2.54).toFixed(1) : +cm);
    const toCm = v => (imperial ? +(v * 2.54).toFixed(1) : v);
    const unit = imperial ? 'in' : 'cm';

    const tapeCard = el('div', 'ab-card tape-card' + (isSet ? '' : ' off'));
    const th = el('div', 'ab-head');
    th.appendChild(el('div', 'micro', 'Tape measure'));
    const tapeOut = el('div', 'ab-val' + (isSet ? '' : ' unset'));
    const paintTape = v => {
      tapeOut.textContent = (imperial ? v.toFixed(1) : Math.round(v * 10) / 10) + ' ' + unit
        + (pr[tape.key] != null ? '' : ' · not set');
      tapeOut.classList.toggle('unset', pr[tape.key] == null);
    };
    th.appendChild(tapeOut);
    const tsw = el('button', 'inj-sw sm' + (isSet ? ' on' : ''));
    tsw.appendChild(el('i', 'inj-knob'));
    tsw.onclick = e => {
      e.stopPropagation();
      if (isSet) delete sDraft[tape.key]; else sDraft[tape.key] = tape.def;
      haptic(); renderAbout();
    };
    th.appendChild(tsw);
    tapeCard.appendChild(th);
    /* which of the three you are setting */
    tapeCard.appendChild(segToggle(TAPES.map(t => [t.key, t.label]), abTape,
      k => { abTape = k; renderAbout(); }, 'you-seg tape-seg'));
    const tbody = el('div', 'ab-body' + (isSet ? '' : ' locked'));
    const start = fromCm(isSet ? +pr[tape.key] : tape.def);
    paintTape(start);
    tbody.appendChild(rulerScale({
      value: start, step: imperial ? 0.5 : (tape.key === 'heightCm' ? 1 : 0.5),
      tickW: 32, span: 14, min: imperial ? 8 : 20,
      labelEvery: 2, majorEvery: 2, decimals: tape.key === 'heightCm' && !imperial ? 0 : 1,
      dragOnly: true, cls: 'fine',
      onChange: v => { sDraft[tape.key] = toCm(v); paintTape(v); bfPaint(); }
    }).el);
    tapeCard.appendChild(tbody);
    tapeCard.appendChild(el('div', 'ab-hint', tape.hint));
    const bfEl = el('div', 'ab-bf');
    tapeCard.appendChild(bfEl);
    // same as the other cards: dragging a dimmed tape turns it on and keeps
    // the figure you dragged to
    if (!isSet) {
      const wake = () => {
        if (sDraft[tape.key] == null) sDraft[tape.key] = tape.def;
        tapeCard.classList.remove('off');
        tbody.classList.remove('locked');
        tsw.classList.add('on');
        paintTape(fromCm(+sDraft[tape.key]));
      };
      tbody.addEventListener('click', wake);
      tbody.addEventListener('pointerup', wake);
    }
    root.appendChild(tapeCard);

    const bfPaint = () => {
      const bf = navyBodyFat(sDraft);
      if (bf) {
        bfEl.textContent = `Body fat ≈ ${bf}% — tape beats the bathroom scale, watch the trend`;
      } else {
        const need = [['sex', 'sex'], ['heightCm', 'height'], ['waistCm', 'waist'], ['neckCm', 'neck']]
          .concat(sDraft.sex === 'female' ? [['hipCm', 'hips']] : [])
          .filter(([k]) => sDraft[k] == null).map(([, n]) => n);
        bfEl.textContent = 'Body fat estimate needs ' + need.join(', ');
      }
      bfEl.classList.toggle('on', !!bf);
    };
    bfPaint();

    /* no Cancel/Save row — the X asks */
  }

  /* Settings — the app's own preferences. Placeholders for now: the rows are
     here so the shape is right, but none of them are wired to anything. */
  const PREF_ICON = {
    theme: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/>',
    units: '<path d="M3 9h18v6H3z"/><path d="M7 9v3M11 9v4M15 9v3M19 9v4"/>',
    bell: '<path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
    health: '<path d="M20.8 8.6a4.6 4.6 0 0 0-8.8-1.8 4.6 4.6 0 0 0-8.8 1.8c0 5 8.8 10.4 8.8 10.4s8.8-5.4 8.8-10.4z"/>',
    watch: '<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9.5 6V3.5h5V6M9.5 18v2.5h5V18"/>',
    link: '<path d="M10 13a4 4 0 0 0 5.7.4l2.6-2.6A4 4 0 1 0 12.6 5l-1.5 1.5"/><path d="M14 11a4 4 0 0 0-5.7-.4l-2.6 2.6A4 4 0 1 0 11.4 19l1.5-1.5"/>',
    export: '<path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M4 15v4h16v-4"/>',
    guide: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M8 8h7M8 12h5"/>',
    faq: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4"/><path d="M12 17.2h.01"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7.5 12 13l8.5-5.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.8v3.7l2.4 1.6M9.4 2.8h5.2"/>',
    kit: '<path d="M2 12h20"/><rect x="5" y="7.5" width="2.4" height="9" rx="1"/>'
      + '<rect x="16.6" y="7.5" width="2.4" height="9" rx="1"/>',
    aim: '<circle cx="12" cy="12" r="7.4"/><circle cx="12" cy="12" r="2.6"/>'
      + '<path d="M12 2.2v2.6M12 19.2v2.6M2.2 12h2.6M19.2 12h2.6"/>',
    plates: '<path d="M3 12h18"/><path d="M6.5 8v8M10 6v12M14 6v12M17.5 8v8"/>',
    flame: '<path d="M12 3c.5 3.4-1.6 5-2.9 6.6C7.8 11.2 7 12.9 7 14.5 7 17.6 9.2 20 12 20s5-2.4 5-5.5C17 10.7 13.7 8.6 12 3z"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="8" cy="14" r="1.4" fill="currentColor" stroke="none"/>'
  };

  const PREF_GROUPS = [
    { title: 'Preferences', rows: [
      ['timer', 'Rest between sets', 'rest'],
      ['flame', 'Warm-up', 'warm'],
      ['bell', 'Alert sound', 'sound'],
      ['kit', 'Equipment', 'kit'],
      ['aim', 'Muscle focus', 'focus'],
      ['plates', 'Weight jumps', 'jumps'],
      ['theme', 'Theme'], ['units', 'Units', 'units'],
      ['cal', 'Week starts', 'wkstart']
    ] },
    { title: 'Apple', rows: [
      ['health', 'Apple Health'], ['watch', 'Apple Watch'], ['link', 'Integrations']
    ] },
    { title: 'Data', rows: [
      ['export', 'Export & import data']
    ] },
    { title: 'Guides', rows: [
      ['guide', 'Getting started'], ['guide', 'Routine help']
    ] },
    { title: 'Help', rows: [
      ['star', 'Rate in the App Store'], ['faq', 'Frequently asked questions'],
      ['mail', 'Contact'], ['info', 'About Rackside']
    ] }
  ];

  let prefOpen = null;
  let pDraft = null;                       // edits live here until you Save
  function openPrefs() { prefOpen = null; pDraft = null; show('prefs'); renderPrefs(); }

  function renderPrefs() {
    const root = $('#view-prefs');
    root.innerHTML = '';
    /* nothing here takes effect until Save, the way About you works — so you
       can audition five alert sounds and still walk away with the one you
       came in with */
    if (!pDraft) pDraft = { ...getProfile() };
    const saved = getProfile();
    const dirty = () => JSON.stringify(pDraft) !== JSON.stringify(saved);
    const leave = () => { pDraft = null; show('profile'); renderTab(); };
    /* the screen previews the draft, not what is stored */
    const dRest = () => { const v = +pDraft.restSec; return v >= 15 && v <= 900 ? v : 120; };
    const dSound = () => alertOf(pDraft.alertSound);
    const dImperial = () => pDraft.units === 'lb';
    const dFocus = () => pDraft.focus || [];

    const head = el('div', 'w-head pm-head');
    const hl = el('div', 'w-left');
    hl.appendChild(el('div', 't-date', 'Rackside ' + APP_VERSION));
    hl.appendChild(el('h1', 'pm-name-static', 'Settings'));
    head.appendChild(hl);
    const commit = () => {
      localStorage.setItem('profile', JSON.stringify(pDraft));
      beepBuiltFor = null;        // the fallback clip follows the new sound
      haptic();
      leave();
    };
    const close = el('button', 'w-chip', '✕');
    close.onclick = () => {
      if (!dirty()) { leave(); return; }
      askOnClose({ what: 'settings', save: commit, leave });
    };
    head.appendChild(close);
    root.appendChild(head);

    root.appendChild(el('div', 'coach-note',
      'The top rows work. The rest are placeholders.'));

    PREF_GROUPS.forEach(g => {
      root.appendChild(el('div', 'month-label', g.title));
      const list = el('div', 'pref-list');
      g.rows.forEach(([icon, label, live]) => {
        const r = el('div', 'pref-row' + (live ? ' on' : ''));
        const ic = el('span', 'pref-ic');
        ic.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" '
          + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + PREF_ICON[icon] + '</svg>';
        r.appendChild(ic);
        r.appendChild(el('span', 'pref-lbl', label));
        if (live === 'units') {
          r.appendChild(el('span', 'pref-val', dImperial() ? 'lb · ft' : 'kg · cm'));
          r.appendChild(el('span', 'pref-go' + (prefOpen === 'units' ? ' open' : ''), '›'));
          r.onclick = () => { prefOpen = prefOpen === 'units' ? null : 'units'; renderPrefs(); };
        } else if (live === 'wkstart') {
          const wl = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
            thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
          r.appendChild(el('span', 'pref-val', wl[pDraft.weekStart] || 'Monday'));
          r.appendChild(el('span', 'pref-go' + (prefOpen === 'wkstart' ? ' open' : ''), '›'));
          r.onclick = () => { prefOpen = prefOpen === 'wkstart' ? null : 'wkstart'; renderPrefs(); };
        } else if (live === 'rest') {
          r.appendChild(el('span', 'pref-val num', fmtClock(dRest())));
          r.appendChild(el('span', 'pref-go' + (prefOpen === 'rest' ? ' open' : ''), '›'));
          r.onclick = () => { prefOpen = prefOpen === 'rest' ? null : 'rest'; renderPrefs(); };
        } else if (live === 'kit') {
          const own = getEquip();
          const total = (window.EQUIPMENT || []).length;
          r.appendChild(el('span', 'pref-val num', `${own.size} of ${total}`));
          r.appendChild(el('span', 'pref-go' + (prefOpen === 'kit' ? ' open' : ''), '›'));
          r.onclick = () => { prefOpen = prefOpen === 'kit' ? null : 'kit'; renderPrefs(); };
        } else if (live === 'jumps') {
          const dj = () => JUMP_KINDS.map(k =>
            jumpLabel((pDraft.jumps || {})[k.key] > 0 ? +pDraft.jumps[k.key] : k.def).replace(' ' + wUnit(), '')).join(' · ');
          r.appendChild(el('span', 'pref-val num', dj()));
          r.appendChild(el('span', 'pref-go' + (prefOpen === 'jumps' ? ' open' : ''), '›'));
          r.onclick = () => { prefOpen = prefOpen === 'jumps' ? null : 'jumps'; renderPrefs(); };
        } else if (live === 'warm') {
          const sw = el('button', 'inj-sw sm' + (pDraft.warmup ? ' on' : ''));
          sw.appendChild(el('i', 'inj-knob'));
          r.appendChild(sw);
          r.onclick = () => { pDraft.warmup = !pDraft.warmup; haptic(); renderPrefs(); };
        } else if (live === 'focus') {
          const lbl2 = focusLabels(dFocus());
          r.appendChild(el('span', 'pref-val',
            !lbl2.length ? 'Balanced' : (lbl2.join(' · ').length <= 18 ? lbl2.join(' · ') : lbl2.length + ' picked')));
          r.appendChild(el('span', 'pref-go' + (prefOpen === 'focus' ? ' open' : ''), '›'));
          r.onclick = () => { prefOpen = prefOpen === 'focus' ? null : 'focus'; renderPrefs(); };
        } else if (live === 'sound') {
          r.appendChild(el('span', 'pref-val', dSound().label));
          r.appendChild(el('span', 'pref-go' + (prefOpen === 'sound' ? ' open' : ''), '›'));
          r.onclick = () => { prefOpen = prefOpen === 'sound' ? null : 'sound'; renderPrefs(); };
        } else {
          r.appendChild(el('span', 'pref-go', '›'));
        }
        list.appendChild(r);
        if (live === 'units' && prefOpen === 'units') {
          const panel = el('div', 'pref-panel');
          panel.appendChild(segToggle(
            [['metric', 'kg · cm'], ['imperial', 'lb · ft']],
            dImperial() ? 'imperial' : 'metric',
            k => {
              if (k === 'imperial') { pDraft.units = 'lb'; pDraft.hUnits = 'ft'; }
              else { pDraft.units = 'kg'; pDraft.hUnits = 'cm'; }
              renderPrefs();
            }, 'you-seg'));
          panel.appendChild(el('div', 'ab-hint',
            'Weights, heights and the tape all follow this — nothing stored is rewritten.'));
          list.appendChild(panel);
        }
        if (live === 'wkstart' && prefOpen === 'wkstart') {
          const panel = el('div', 'pref-panel');
          /* the week itself is the control: seven cells drawn in your week's
             order. Tap any day and the row spins to put it first — you are
             not choosing from a list, you are arranging the week. */
          const KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
          const start = ({ sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 })[pDraft.weekStart] ?? 1;
          const strip2 = el('div', 'day-strip wks-strip');
          for (let i = 0; i < 7; i++) {
            const d = (start + i) % 7;
            const cell = el('button', 'cell' + (i === 0 ? ' today' : ''));
            cell.type = 'button';
            cell.appendChild(el('span', null, 'SMTWTFS'[d]));
            cell.appendChild(el('i'));
            cell.onclick = () => { pDraft.weekStart = KEYS[d]; haptic(); renderPrefs(); };
            strip2.appendChild(cell);
          }
          panel.appendChild(strip2);
          panel.appendChild(el('div', 'ab-hint',
            'Tap the day your week begins. The Today strip, weekly totals and the streak all turn over there.'));
          list.appendChild(panel);
        }
        if (live === 'kit' && prefOpen === 'kit') {
          const panel = el('div', 'pref-panel');
          panel.appendChild(el('div', 'ab-hint',
            'Switch off anything your gym has not got. The block builder will not pick '
            + 'an exercise that needs it.'));
          /* the picker writes straight through — kit is not something you want
             to have to remember to save */
          panel.appendChild(equipPicker(renderPrefs));
          const all = (window.EXERCISE_LIBRARY || []);
          const off = all.length - all.filter(equipOK).length;
          panel.appendChild(el('div', 'ab-hint', off
            ? `${off} exercises need kit you have switched off`
            : 'Everything in the catalogue is available'));
          list.appendChild(panel);
        }
        if (live === 'jumps' && prefOpen === 'jumps') {
          const panel = el('div', 'pref-panel');
          panel.appendChild(el('div', 'ab-hint',
            'How much one notch adds on the weight scale — set it to what your gym racks.'));
          const wheels = el('div', 'cd-wheels jump-wheels');
          const paintVal = () => {
            const val = r.querySelector('.pref-val');
            if (val) val.textContent = JUMP_KINDS.map(x =>
              jumpLabel((pDraft.jumps || {})[x.key] > 0 ? +pDraft.jumps[x.key] : x.def).replace(' ' + wUnit(), '')).join(' · ');
          };
          JUMP_KINDS.forEach(k => {
            const col = el('div', 'cd-col');
            col.appendChild(el('div', 'micro', k.short));
            const opts = wUnit() === 'lb'
              ? JUMP_LB_OPTS[k.key].map(([lb, kgv]) => ({ v: kgv, lbl: fmtKg(lb) }))
              : k.opts.map(o => ({ v: o, lbl: fmtKg(o) }));
            const cur3 = (pDraft.jumps || {})[k.key] > 0 ? +pDraft.jumps[k.key] : k.def;
            /* a stored value the current unit's rack doesn't offer parks on
               the nearest real option instead of nowhere */
            let ix = opts.findIndex(o => o.v === cur3);
            if (ix < 0) {
              let bd = Infinity;
              opts.forEach((o, i) => { const d = Math.abs(o.v - cur3); if (d < bd) { bd = d; ix = i; } });
            }
            col.appendChild(pickerWheel(opts.map(o => o.lbl + ' ' + wUnit()), ix, i => {
              pDraft.jumps = { ...(pDraft.jumps || {}) };
              pDraft.jumps[k.key] = opts[i].v;
              paintVal();
            }, 'short', null, null, null, k.label + ' jump'));
            wheels.appendChild(col);
          });
          panel.appendChild(wheels);
          list.appendChild(panel);
        }
        if (live === 'focus' && prefOpen === 'focus') {
          const panel = el('div', 'pref-panel');
          panel.appendChild(focusPicker(dFocus, next => {
            pDraft.focus = next;
            const lbl3 = focusLabels(next);
            const val = r.querySelector('.pref-val');
            if (val) val.textContent = !lbl3.length ? 'Balanced'
              : (lbl3.join(' · ').length <= 18 ? lbl3.join(' · ') : lbl3.length + ' picked');
          }));
          panel.appendChild(el('div', 'ab-hint', 'Tap a muscle. Up to three; none means balanced.'));
          list.appendChild(panel);
        }
        if (live === 'sound' && prefOpen === 'sound') {
          const panel = el('div', 'pref-panel');
          const snd = el('div', 'snd-list');
          ALERTS.forEach(a => {
            const btn = el('button', 'snd-btn' + (a.key === dSound().key ? ' on' : ''));
            btn.appendChild(el('span', 'snd-name', a.label));
            btn.appendChild(svgIcon(PLAY, 10));
            /* tapping picks it and plays it — you cannot choose a sound you
               have not heard */
            btn.onclick = () => {
              pDraft.alertSound = a.key;
              playAlert(a.key);
              haptic();
              snd.querySelectorAll('.snd-btn').forEach(x => x.classList.remove('on'));
              btn.classList.add('on');
              const val = r.querySelector('.pref-val');
              if (val) val.textContent = a.label;
            };
            snd.appendChild(btn);
          });
          panel.appendChild(snd);
          panel.appendChild(el('div', 'ab-hint',
            'Plays when a rest finishes and when a hold is done. Tap one to hear it.'));
          list.appendChild(panel);
        }
        if (live === 'rest' && prefOpen === 'rest') {
          const panel = el('div', 'pref-panel');
          const out = el('div', 'ab-val num', fmtClock(dRest()));
          panel.appendChild(out);
          panel.appendChild(optionRail(REST_LENS.map(fmtClock),
            Math.max(0, REST_LENS.indexOf(dRest())),
            i => {
              pDraft.restSec = REST_LENS[i];
              out.textContent = fmtClock(REST_LENS[i]);
              const val = r.querySelector('.pref-val');
              if (val) val.textContent = fmtClock(REST_LENS[i]);
            }, 74));
          panel.appendChild(el('div', 'ab-hint',
            'Every set in a new session starts its rest here. During training you '
            + 'can only nudge it by 15 seconds, so the clock cannot be reset by accident.'));
          list.appendChild(panel);
        }
      });
      root.appendChild(list);
    });

    /* no Cancel/Save row — the X asks */
  }

