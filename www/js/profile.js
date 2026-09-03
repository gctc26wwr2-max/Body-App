/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
  /* ============================================================
     PROFILE (overview + data controls)
     ============================================================ */
  /* an avatar does not need the camera's twelve megapixels — cap the long
     edge at 512px before it goes anywhere near storage */
  const shrinkImg = file => new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 512 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob(b => res(b || file), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); res(file); };
    img.src = URL.createObjectURL(file);
  });

  async function renderProfile() {
    const root = $('#view-profile');
    root.innerHTML = '';
    const workouts = (await DB.all('workouts')).sort((a, b) => a.ts - b.ts);

    const head = el('header', 't-head');
    const hl = el('div');
    hl.appendChild(el('div', 't-date', 'Rackside · ' + APP_VERSION));
    hl.appendChild(el('h1', 't-title', 'Profile'));
    head.appendChild(hl);
    const acts = el('div', 'head-acts');
    const heart = el('button', 'gear-btn');
    heart.title = 'About you';
    heart.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" '
      + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M20.8 8.6a4.6 4.6 0 0 0-8.8-1.8 4.6 4.6 0 0 0-8.8 1.8c0 5 8.8 10.4 8.8 10.4s8.8-5.4 8.8-10.4z"/></svg>';
    heart.onclick = () => openAbout();
    acts.appendChild(heart);
    const gear = el('button', 'gear-btn');
    gear.title = 'Settings';
    gear.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" '
      + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
      + '<circle cx="12" cy="12" r="3.2"/>'
      + '<path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>';
    gear.onclick = () => openPrefs();
    acts.appendChild(gear);
    head.appendChild(acts);
    root.appendChild(head);

    // ---- identity: the profile itself — a face, a name, the vitals ----
    const pr = getProfile();
    const idCard = el('div', 'card id-card');
    const ava = el('button', 'id-ava');
    ava.title = pr.avatarId ? 'Change photo' : 'Add a photo';
    let avaImg = null;
    if (pr.avatarId) {
      const u = await mediaURL(pr.avatarId);
      if (u) { avaImg = document.createElement('img'); avaImg.src = u; avaImg.alt = ''; ava.appendChild(avaImg); }
    }
    if (!avaImg) {
      ava.classList.add('empty');
      ava.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" '
        + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
        + '<circle cx="12" cy="8.4" r="3.6"/><path d="M4.6 20a7.4 7.4 0 0 1 14.8 0"/></svg>';
    }
    /* the camera badge says "this is changeable" without a word */
    const badge = el('span', 'id-badge');
    badge.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" '
      + 'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>';
    ava.appendChild(badge);
    const avaIn = document.createElement('input');
    avaIn.type = 'file'; avaIn.accept = 'image/*'; avaIn.style.display = 'none';
    ava.onclick = () => avaIn.click();
    avaIn.onchange = async () => {
      const f = avaIn.files[0]; avaIn.value = '';
      if (!f) return;
      const small = await shrinkImg(f);
      if (pr.avatarId) await mediaStore.remove(pr.avatarId).catch(() => {});
      const nid = await mediaStore.save('avatar',
        new File([small], 'avatar.jpg', { type: small.type || 'image/jpeg' }));
      setProfile({ avatarId: nid });
      haptic();
      renderTab();
    };
    const idTxt = el('div', 'id-txt');
    const nameEl = el('button', 'id-name' + (pr.name ? '' : ' unset'));
    nameEl.appendChild(el('span', 'id-name-t', pr.name || 'Create your profile'));
    const pen = el('span', 'id-pen');
    pen.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" '
      + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M17 3.5l3.5 3.5L8 19.5 3.5 20.5 4.5 16z"/></svg>';
    nameEl.appendChild(pen);
    const vitals = [];
    const yrs2 = ageYears(pr);
    if (yrs2 != null) vitals.push(yrs2 + ' yrs');
    if (pr.heightCm) vitals.push(fmtH(pr.heightCm));
    const bwsAll = (await DB.all('bodyweight')).sort((a, b) => b.ts - a.ts);
    if (bwsAll[0]) vitals.push(fmtW(bwsAll[0].kg));
    const bf2 = navyBodyFat(pr);
    if (bf2) vitals.push('~' + bf2 + '% fat');
    const subEl = el('div', 'id-sub', pr.name
      ? (vitals.join(' · ') || 'Fill in About you for the details')
      : 'Your name and photo — tap to add');
    const sinceEl = workouts.length
      ? el('div', 'id-since', 'Training since '
        + dateOf(workouts[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))
      : null;
    const editName = () => {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.maxLength = 30; inp.className = 'id-input';
      inp.value = pr.name || ''; inp.placeholder = 'Your name';
      inp.autocapitalize = 'words'; inp.autocomplete = 'name';
      inp.enterKeyHint = 'done';
      nameEl.replaceWith(inp);
      inp.focus();
      let done = false;
      const commit = () => {
        if (done) return; done = true;
        const v = inp.value.trim().slice(0, 30);
        setProfile({ name: v || undefined });
        renderTab();
      };
      inp.onblur = commit;
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } };
    };
    nameEl.onclick = editName;
    idTxt.appendChild(nameEl);
    idTxt.appendChild(subEl);
    if (sinceEl) idTxt.appendChild(sinceEl);
    idCard.appendChild(ava);
    idCard.appendChild(idTxt);
    idCard.appendChild(avaIn);
    root.appendChild(idCard);

    // lifetime stats
    const totVol = workouts.reduce((a, w) => a + (w.volume || 0), 0);
    const totPRs = workouts.reduce((a, w) => a + ((w.prs || []).length), 0);
    const totMin = workouts.reduce((a, w) => a + (w.duration || 0), 0);
    const grid = el('div', 'sum-grid');
    grid.appendChild(sumCard(String(workouts.length), 'Sessions'));
    grid.appendChild(sumCard(fmtW(totVol), 'Lifetime volume'));
    grid.appendChild(sumCard(totMin + ' min', 'Time trained'));
    const prC = sumCard(String(totPRs), 'Records');
    prC.classList.add('hl');
    grid.appendChild(prC);
    root.appendChild(grid);

    // preferred training days
    const plan = activePlan();
    if (plan) {
      root.appendChild(el('div', 'month-label', 'Preferred training days'));
      const pc = el('div', 'card');
      const strip = el('div', 'day-strip');
      plan.prefDays = plan.prefDays || [];
      const off2 = weekStripOff();
      for (let i = 0; i < 7; i++) {
        const monIdx = (off2 + i) % 7;
        const cell = el('button', 'cell' + (plan.prefDays.includes(monIdx) ? ' today pref' : ''));
        cell.type = 'button';
        cell.appendChild(el('span', null, 'MTWTFSS'[monIdx]));
        cell.appendChild(el('i'));
        cell.onclick = async () => {
          plan.prefDays = plan.prefDays.includes(monIdx)
            ? plan.prefDays.filter(x => x !== monIdx)
            : [...plan.prefDays, monIdx].sort((a, b) => a - b);
          await DB.put('plans', plan);
          renderProfile();
        };
        strip.appendChild(cell);
      }
      pc.appendChild(strip);
      const ph = el('div', 'hist-meta');
      ph.style.marginTop = '10px';
      ph.textContent = `${plan.prefDays.length} of ${(plan.days || []).length} training days picked — they show as rings on the Today week strip.`;
      pc.appendChild(ph);
      root.appendChild(pc);
    }

    // body weight — v5: big reading, fine sliding scale, trend, log button
    root.appendChild(el('div', 'month-label', 'Body weight'));
    const bw = (await DB.all('bodyweight')).sort((a, b) => a.ts - b.ts);
    const lastBw = bw[bw.length - 1];
    const loggedToday = !!bw.find(x => x.date === todayStr());
    const bwCard = el('div', 'card bwv-card');

    const bwHead = el('div', 'bwv-head');
    bwHead.appendChild(el('div', 'micro', "Today's reading"));
    bwCard.appendChild(bwHead);

    let bwv = lastBw ? lastBw.kg : 80;          // always kilos underneath
    const read = el('div', 'bwv-read');
    const rv = el('div', 'bwv-val num tappable', toW(bwv).toFixed(1));
    rv.appendChild(el('small', null, ' ' + wUnit()));
    rv.onclick = () => openNumPad({
      title: 'Body weight', value: +toW(bwv).toFixed(1), unit: wUnit(),
      min: toW(20), max: toW(400),
      apply: v => { commitBw(+(+v).toFixed(1)); bwRuler.setVal(+(+v).toFixed(1)); }
    });
    read.appendChild(rv);
    const dEl = el('div', 'bwv-delta num');
    read.appendChild(dEl);
    bwCard.appendChild(read);

    let logBtn;
    const updDelta = () => {
      if (!lastBw) { dEl.textContent = ''; return; }
      const d = +(bwv - lastBw.kg).toFixed(3);
      dEl.className = 'bwv-delta num ' + (d < 0 ? 'down' : d > 0 ? 'up' : 'same');
      dEl.textContent = d === 0 ? 'Same as last'
        : `${d > 0 ? '+' : '−'}${Math.abs(toW(d)).toFixed(1)} ${wUnit()}`;
    };
    const commitBw = shown => {
      bwv = fromW(shown);
      rv.firstChild.nodeValue = shown.toFixed(1);
      updDelta();
    };
    updDelta();

    // the scale runs in your unit; a notch is 0.5 kg or 1 lb
    const bwRuler = rulerScale({
      value: +toW(bwv).toFixed(1), step: wStep(), tickW: 30, span: 14, min: toW(20),
      label: 'Body weight', unit: wUnit(),
      labelEvery: 2, majorEvery: 2, decimals: 1, cls: 'fine',
      dragOnly: true, onChange: commitBw
    });
    /* no tap-to-set here: the reading only moves if you actually swipe it,
       so brushing the card on the way past leaves it alone — and the hint
       says so, or a tap that does nothing just reads as broken */
    bwCard.appendChild(bwRuler.el);
    bwCard.appendChild(el('div', 'bwv-hint', 'Swipe the scale to adjust'));

    // 30-day trend
    {
      let pts = bw.filter(e => Date.now() - e.ts < 30 * 86400000);
      if (pts.length < 2) pts = bw;
      if (pts.length >= 2) {
        const tHead = el('div', 'bwv-head');
        tHead.appendChild(el('div', 'micro', 'Trend · 30 days'));
        const td = +(pts[pts.length - 1].kg - pts[0].kg).toFixed(1);
        tHead.appendChild(el('div', 'micro trend-d', `${td > 0 ? '+' : td < 0 ? '−' : ''}${Math.abs(td).toFixed(1)} kg`));
        tHead.style.marginTop = '6px';
        bwCard.appendChild(tHead);
        const wrap = el('div', 'bw-graph');
        wrap.innerHTML = bwGraphSVG(pts);
        bwCard.appendChild(wrap);
      }
    }

    logBtn = el('button', 'bwv-log' + (loggedToday ? ' logged' : ''));
    logBtn.appendChild(el('span', null, loggedToday ? 'Update today' : 'Log weight'));
    logBtn.onclick = async () => {
      if (!(bwv > 20)) return;
      const today = bw.find(x => x.date === todayStr());
      await DB.put('bodyweight', today
        ? { ...today, kg: bwv, ts: Date.now() }
        : { id: DB.uid(), date: todayStr(), kg: bwv, ts: Date.now() });
      renderProfile();
    };
    bwCard.appendChild(logBtn);
    root.appendChild(bwCard);

    // data controls
    root.appendChild(el('div', 'month-label', 'Data & backup'));
    const dc = el('div', 'card');
    const bk = el('button', 'btn-lime', 'Back up now');
    bk.style.cssText = 'width:100%';
    bk.onclick = backupData;
    dc.appendChild(bk);
    const lbTs = Number(localStorage.getItem('lastBackup')) || 0;
    const hint = el('div', 'hist-meta');
    hint.style.margin = '8px 0 12px';
    hint.textContent = (lbTs ? `Last backup ${new Date(lbTs).toLocaleDateString('en-GB')} · ` : 'Never backed up · ')
      + 'share sheet → "Save to Files" → iCloud Drive. Photos/videos not included.';
    dc.appendChild(hint);
    const report = el('button', 'btn-ghost', 'Report for Claude');
    report.style.cssText = 'width:100%;margin-bottom:10px;color:var(--lime);border-color:var(--lime-border)';
    report.onclick = shareReport;
    dc.appendChild(report);
    const rHint = el('div', 'hist-meta');
    rHint.style.margin = '0 0 12px';
    rHint.textContent = 'A text summary of your training, for a Claude chat.';
    dc.appendChild(rHint);
    const restoreBtn = el('button', 'btn-ghost', 'Restore from backup');
    restoreBtn.style.cssText = 'width:100%;margin-bottom:10px';
    const fileIn = document.createElement('input');
    fileIn.type = 'file';
    fileIn.accept = 'application/json,.json';
    fileIn.style.display = 'none';
    fileIn.onchange = () => { if (fileIn.files[0]) restoreData(fileIn.files[0]); fileIn.value = ''; };
    restoreBtn.onclick = () => fileIn.click();
    dc.appendChild(restoreBtn);
    dc.appendChild(fileIn);
    const reset = el('button', 'btn-ghost', 'Reset training history');
    reset.style.cssText = 'width:100%;color:var(--amber);border-color:var(--amber-border)';
    reset.onclick = resetHistory;
    dc.appendChild(reset);
    root.appendChild(dc);

    // about
    const about = el('div', 'coach-note');
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    about.innerHTML = '<b>Rackside ' + APP_VERSION + ' ·</b> Local-first training app. Everything is stored on this iPhone — no account, no cloud, works offline in the gym. '
      + (standalone ? 'Running as an installed app.' : 'Running in the browser — install via Share → Add to Home Screen.');
    root.appendChild(about);
  }

  /* ---------------- body weight line graph (inline SVG) ---------------- */
  /* Smooth line through the points — a monotone cubic (Fritsch–Carlson).
     Tangents are scaled by each gap's own width, so unevenly spaced dates
     cannot throw a control point past the next reading, and a tangent is
     flattened wherever the direction changes, so the curve never rises
     above a peak or dips below a trough that never happened. */
  function smoothPath(P) {
    const f = n => n.toFixed(1);
    const n = P.length;
    if (n < 3) return P.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join(' ');
    const dx = [], slope = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = P[i + 1][0] - P[i][0];
      slope[i] = dx[i] ? (P[i + 1][1] - P[i][1]) / dx[i] : 0;
    }
    const m = [slope[0]];
    for (let i = 1; i < n - 1; i++) {
      if (slope[i - 1] * slope[i] <= 0) m[i] = 0;          // a turn: level it off
      else {
        const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
        m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
      }
    }
    m[n - 1] = slope[n - 2];
    let d = 'M' + f(P[0][0]) + ' ' + f(P[0][1]);
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += ' C' + f(P[i][0] + h) + ' ' + f(P[i][1] + m[i] * h)
         + ' ' + f(P[i + 1][0] - h) + ' ' + f(P[i + 1][1] - m[i + 1] * h)
         + ' ' + f(P[i + 1][0]) + ' ' + f(P[i + 1][1]);
    }
    return d;
  }

  function bwGraphSVG(entries) {
    const W = 320, H = 116, padL = 34, padR = 12, padT = 10, padB = 20;
    const x0 = entries[0].ts, x1 = entries[entries.length - 1].ts;
    let lo = Math.min(...entries.map(e => e.kg));
    let hi = Math.max(...entries.map(e => e.kg));
    if (hi - lo < 1) { const m = (hi + lo) / 2; lo = m - 0.6; hi = m + 0.6; }
    const X = t => padL + (t - x0) / Math.max(x1 - x0, 1) * (W - padL - padR);
    const Y = v => padT + (hi - v) / (hi - lo) * (H - padT - padB);
    const P = entries.map(e => [X(e.ts), Y(e.kg)]);
    const line = smoothPath(P);
    const area = line + ` L${P[P.length - 1][0].toFixed(1)} ${(H - padB).toFixed(1)} L${P[0][0].toFixed(1)} ${(H - padB).toFixed(1)} Z`;
    const fmtD = ts => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const grid = [hi, (hi + lo) / 2, lo].map(v =>
      `<line x1="${padL}" y1="${Y(v).toFixed(1)}" x2="${W - padR}" y2="${Y(v).toFixed(1)}" stroke="rgba(255,255,255,.06)" stroke-width="1"/>` +
      `<text x="${padL - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end" fill="#6A625A" font-size="9" font-family="Archivo, sans-serif">${(Math.round(v * 10) / 10)}</text>`
    ).join('');
    const dots = P.map((p, i) =>
      `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === P.length - 1 ? 4 : 3}" fill="${ACC}" stroke="#151110" stroke-width="2"/>`
    ).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;margin-top:12px" role="img" aria-label="Body weight over time">
      ${grid}
      <path d="${area}" fill="rgba(${accRGB()},.12)"/>
      <path d="${line}" fill="none" stroke="${ACC}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      <text x="${padL}" y="${H - 6}" fill="#6A625A" font-size="9" font-family="Archivo, sans-serif">${fmtD(x0)}</text>
      <text x="${W - padR}" y="${H - 6}" text-anchor="end" fill="#6A625A" font-size="9" font-family="Archivo, sans-serif">${fmtD(x1)}</text>
    </svg>`;
  }

  /* ---------------- training report (to hand to Claude) ---------------- */
  async function shareReport() {
    const text = await trainingReport()
      + '\n\nPlease review this training history and plan my next block accordingly '
      + '(same weekly frequency unless you advise otherwise).';
    try {
      if (navigator.share) await navigator.share({ title: 'Rackside training report', text });
      else { await navigator.clipboard.writeText(text); alert('Report copied to clipboard — paste it to Claude.'); }
    } catch { /* share sheet dismissed */ }
  }

  /* Everything the app knows about your training, as plain text. Shared by
     the report button and by the block prompt, so the two never drift. */
  async function trainingReport() {
    const [workouts, sessions, allExs] = await Promise.all([
      DB.all('workouts'), DB.all('sessions'), DB.all('exercises')
    ]);
    const exName = id => (allExs.find(e => e.id === id) || {}).name || 'Unknown';
    const plan = activePlan();
    const L = [];
    L.push(`RACKSIDE TRAINING REPORT — ${todayStr()}`);
    L.push(`All weights in ${wUnit()}.`);
    if (plan) {
      const w = plan.startDate ? weekOf(plan) : 0;
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      L.push(`Program: ${plan.name} · ${plan.weeks || 4} weeks · week ${w || '-'} · ` +
        `${(plan.days || []).length} days/week (${(plan.prefDays || []).map(i => days[i]).join('/') || 'no set days'})`);
      for (const d of (plan.days || [])) {
        L.push(`  ${d.name}: ` + d.items.map(it =>
          `${exName(it.exerciseId)} ${it.sets}×${it.repLo}-${it.repHi}`).join(', '));
      }
    }
    const ws = workouts.sort((a, b) => b.ts - a.ts).slice(0, 15);
    L.push('');
    L.push(`SESSIONS (${workouts.length} total, latest ${ws.length}):`);
    for (const w of ws) {
      L.push(`${w.date} · ${w.name} · ${w.duration} min · ${fmtW(w.volume)} volume` +
        (w.stars ? ` · rated ${w.stars}/5` : (w.feel ? ` · felt: ${w.feel}` : '')) +
        (w.prs && w.prs.length ? ` · ${w.prs.length} PR` : ''));
      const sess = sessions.filter(s => s.date === w.date && s.planId === w.planId);
      for (const s of sess) {
        L.push(`  - ${exName(s.exerciseId)}: ` +
          s.sets.map(x => x.weight ? `${fmtWn(x.weight)}×${x.reps}` : `${x.reps} reps`).join(', ') +
          (s.feel ? ` · felt ${s.feel}` : ''));
      }
    }
    // current strength numbers
    const byEx = new Map();
    for (const s of sessions) {
      const arr = byEx.get(s.exerciseId) || [];
      arr.push(s);
      byEx.set(s.exerciseId, arr);
    }
    L.push('');
    L.push('CURRENT NUMBERS (last working weight · best est. 1RM):');
    for (const [id, arr] of byEx) {
      arr.sort((a, b) => b.ts - a.ts);
      const lastKg = Math.max(...arr[0].sets.map(x => x.weight || 0));
      const best = Math.round(Math.max(...arr.flatMap(s2 => s2.sets.map(x => est1RM(x.weight || 0, x.reps)))));
      if (lastKg > 0) L.push(`- ${exName(id)}: ${fmtW(lastKg)} · est 1RM ${fmtW(best)}`);
    }
    /* Where each lift is HEADED, not just where it stands. A stall, a climb
       or reps falling short is exactly what should shape the next block, so
       the reader does not have to mine the raw logs for it. */
    {
      const cut = Date.now() - 70 * 86400000;
      const tl = [];
      for (const [id, arr] of byEx) {
        const recent = arr.filter(x => x.ts >= cut && !x.timed).sort((a, b) => a.ts - b.ts);
        if (recent.length < 3) continue;
        const tops = recent.map(x => Math.max(0, ...x.sets.map(t => t.weight || 0)));
        const first = tops.find(t => t > 0), last = tops[tops.length - 1];
        if (!first || !last) continue;
        let run = 1;
        for (let i = tops.length - 2; i >= 0 && tops[i] === last; i--) run++;
        const pct = Math.round((last - first) / first * 100);
        const rec2 = allExs.find(x => x.id === id);
        const inv = isAssisted(rec2);
        let v;
        if (run >= 3) v = `stalled at ${fmtW(last)}${inv ? ' of assistance' : ''} for ${run} sessions`;
        else if (inv && pct <= -3) v = `assistance ${fmtWn(first)}→${fmtW(last)} (${pct}%) — progressing`;
        else if (inv && pct >= 3) v = `assistance ${fmtWn(first)}→${fmtW(last)} (+${pct}%) — needing more help`;
        else if (pct >= 3) v = `${fmtWn(first)}→${fmtW(last)} over ${recent.length} sessions (+${pct}%)`;
        else if (pct <= -3) v = `${fmtWn(first)}→${fmtW(last)} (${pct}%) — going backwards`;
        else v = `holding around ${fmtW(last)}`;
        const it = plan && (plan.days || []).flatMap(d => d.items).find(i => i.exerciseId === id);
        if (it) {
          const ls = recent[recent.length - 1].sets;
          const atTop = ls.filter(t => t.reps >= it.repHi).length;
          const under = ls.filter(t => t.reps < it.repLo).length;
          if (atTop >= Math.ceil(ls.length / 2)) v += ' · hitting the top of the range — ready to go up';
          else if (under >= Math.ceil(ls.length / 2)) v += ' · reps coming in under the range';
        }
        tl.push(`- ${exName(id)}: ${v}`);
      }
      if (tl.length) {
        L.push('');
        L.push('TRENDS (last 10 weeks):');
        tl.forEach(x => L.push(x));
      }
    }
    /* the movements that keep getting passed — prescribed on a banked day
       but never logged. The politest possible way of saying "I hate this
       one"; the next block should hear it. */
    if (plan) {
      const doneDays = (plan.completed || []).filter(c => c.date).slice(-10);
      const counts = new Map();
      for (const c of doneDays) {
        const d = (plan.days || [])[c.day];
        if (!d) continue;
        for (const it of d.items) {
          const r = counts.get(it.exerciseId) || { up: 0, did: 0 };
          r.up++;
          if (sessions.some(x => x.exerciseId === it.exerciseId && x.date === c.date)) r.did++;
          counts.set(it.exerciseId, r);
        }
      }
      const sk = [];
      for (const [id, r] of counts) {
        if (r.up >= 2 && r.up - r.did >= 2)
          sk.push(`- ${exName(id)}: skipped ${r.up - r.did} of the last ${r.up} times it came up — give me a substitute`);
      }
      if (sk.length) {
        L.push('');
        L.push('OFTEN SKIPPED:');
        sk.forEach(x => L.push(x));
      }
    }
    const bws = (await DB.all('bodyweight')).sort((a, b) => a.ts - b.ts);
    if (bws.length) {
      const lastB = bws[bws.length - 1];
      const pastB = [...bws].reverse().find(x => lastB.ts - x.ts >= 25 * 86400000);
      L.push('');
      L.push(`BODY WEIGHT: ${fmtW(lastB.kg)} (${lastB.date})` +
        (pastB ? ` · ${(lastB.kg - pastB.kg >= 0 ? '+' : '')}${(lastB.kg - pastB.kg).toFixed(1)} kg over ~30 days` : ''));
    }
    const cds = (await DB.all('cardio')).sort((a, b) => b.ts - a.ts).slice(0, 12);
    if (cds.length) {
      L.push('');
      L.push('CARDIO (latest):');
      for (const c of cds) L.push(`- ${c.date} · ${c.activity}${c.env ? ' (' + c.env + ')' : ''} · ${c.minutes} min · ${c.calories} kcal`);
    }
    {
      const pr = getProfile();
      const g = GOALS.find(x => x.key === pr.goal), lv = LEVELS.find(x => x.key === pr.level);
      const bits = [];
      if (pr.name) bits.push(pr.name);
      if (g) bits.push('goal: ' + g.label.toLowerCase());
      if (lv) bits.push('training ' + lv.label.toLowerCase());
      if (pr.sessionMins) bits.push(pr.sessionMins + ' min per session');
      const yrs = ageYears(pr);
      if (yrs != null) bits.push(yrs + ' yrs');
      if (pr.sex) bits.push(pr.sex);
      if (pr.heightCm) bits.push(pr.heightCm + ' cm');
      const bf = navyBodyFat(pr);
      if (bf) bits.push('~' + bf + '% body fat (tape estimate)');
      if (bits.length) { L.push(''); L.push('ABOUT ME: ' + bits.join(' · ')); }
    }
    /* what actually happens vs what the plan asks — the single most useful
       number for sizing the next block */
    {
      const cut28 = Date.now() - 28 * 86400000;
      const recentW = workouts.filter(w => w.ts >= cut28);
      if (recentW.length) {
        const perWk = +(recentW.length / 4).toFixed(1);
        const avgMin = Math.round(recentW.reduce((a, w) => a + (w.duration || 0), 0) / recentW.length);
        let line = `ATTENDANCE (last 4 weeks): ${recentW.length} sessions ≈ ${perWk}/week · typical session ${avgMin} min`;
        const planned = plan && (plan.days || []).length;
        if (planned && planned > perWk + 0.5)
          line += ` — the plan asks for ${planned}; write for what I actually do, not for good intentions`;
        L.push('');
        L.push(line);
      }
      const lastPR = workouts.filter(w => w.prs && w.prs.length).sort((a, b) => b.ts - a.ts)[0];
      if (workouts.length) {
        L.push(lastPR
          ? `LAST PR: ${lastPR.date} (${Math.round((Date.now() - lastPR.ts) / 86400000)} days ago)`
          : 'LAST PR: none recorded yet');
      }
    }
    /* the blocks already run, so the next one is not the last one again */
    {
      const past = plans.filter(p => p.finishedAt).sort((a, b) => b.finishedAt - a.finishedAt).slice(0, 6);
      if (past.length) {
        L.push('');
        L.push('BLOCKS ALREADY RUN (do not just repeat them):');
        past.forEach(p => L.push(`- ${p.name} · ${p.weeks || 4} wks · finished ${new Date(p.finishedAt).toISOString().slice(0, 10)}`));
      }
    }
    const injOnNow = injEnabled() ? INJURIES.filter(i => getInjuries().has(i.key)) : [];
    if (injOnNow.length) {
      const avoiding = [...new Set(injOnNow.flatMap(i => i.avoid))];
      L.push('');
      L.push('INJURIES: ' + injOnNow.map(i => i.label).join(', '));
      L.push('MOVEMENTS TO AVOID: ' + avoiding.join(', '));
      L.push('(Please substitute rather than remove — keep every movement pattern covered.)');
    }
    {
      const own = getEquip();
      const missing = (window.EQUIPMENT || []).filter(q => !q.always && !own.has(q.key)).map(q => q.label);
      if (missing.length) { L.push(''); L.push('NO ACCESS TO: ' + missing.join(', ')); }
    }
    return L.join('\n');
  }

  /* ---------------- backup / restore / reset ---------------- */
  /* Backup schema. Bump BACKUP_SCHEMA whenever the shape of exported data
     changes, and add a step under the OLD number that rewrites a file of
     that vintage into the next shape. Restore walks the ladder from the
     file's stamped version up to current, so old files keep working.
       1–4  prehistoric exports (same shape as 5 for our purposes)
       5    pre-split kit ('machine' bucket) and timed movements still
            carrying rep targets
       6    machine bucket split into nine named machines; timed movements
            measured in seconds */
  const BACKUP_SCHEMA = 6;
  const BACKUP_MIGRATIONS = {
    5: data => {
      if (Array.isArray(data.equip) && data.equip.includes('machine'))
        data.equip = [...new Set([...data.equip,
          'm-smith', 'm-hack', 'm-hip', 'm-fly', 'm-latr', 'm-arms', 'm-calf', 'm-abd', 'm-ghd'])];
      const exById = new Map(
        [...(exercises || []), ...(Array.isArray(data.exercises) ? data.exercises : [])]
          .filter(e => e && e.id).map(e => [e.id, e]));
      for (const pl of (data.plans || []))
        for (const d of (pl.days || []))
          for (const it of (d.items || [])) {
            const ex2 = exById.get(it.exerciseId);
            if (ex2 && isTimedEx(ex2) && (it.repHi || 0) <= 20) { it.repLo = 30; it.repHi = 45; }
          }
    }
  };

  async function backupData() {
    const [exs, pls, sess, wks, bws, cds] = await Promise.all([
      DB.all('exercises'), DB.all('plans'), DB.all('sessions'), DB.all('workouts'),
      DB.all('bodyweight'), DB.all('cardio')
    ]);
    const payload = {
      app: 'rackside', version: BACKUP_SCHEMA, appVersion: APP_VERSION, exportedAt: new Date().toISOString(),
      exercises: exs, plans: pls, sessions: sess, workouts: wks, bodyweight: bws, cardio: cds,
      injuries: [...getInjuries()], injuriesOn: injEnabled(), equip: [...getEquip()],
      profile: getProfile()
    };
    const file = new File([JSON.stringify(payload)], `rackside-backup-${todayStr()}.json`, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Rackside backup' });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
      }
      localStorage.setItem('lastBackup', String(Date.now()));
      renderTab();
    } catch (e) { /* user cancelled the share sheet */ }
  }

  async function restoreData(fileBlob) {
    let data;
    try { data = JSON.parse(await fileBlob.text()); } catch { alert('That file is not a Rackside backup.'); return; }
    if (!data || data.app !== 'rackside') { alert('That file is not a Rackside backup.'); return; }
    const fileVer = Number(data.version) || 1;
    if (fileVer > BACKUP_SCHEMA) {
      alert('This backup comes from a newer version of Rackside. Update the app (reopen it online), then restore.');
      return;
    }
    if (!confirm('Restore this backup? Records with the same id are overwritten; nothing else is deleted.')) return;
    for (let v = fileVer; v < BACKUP_SCHEMA; v++) {
      const step = BACKUP_MIGRATIONS[v];
      if (step) try { step(data); } catch (e) { console.error('backup migration ' + v, e); }
    }
    /* a backup is untrusted input: fields the UI later renders or computes
       with must come out of here in the right type. Honest values pass
       through unchanged; garbage is coerced, never trusted. */
    const num = (v, d) => { v = Math.round(+v); return Number.isFinite(v) ? v : d; };
    for (const pl of (Array.isArray(data.plans) ? data.plans : [])) {
      if (!pl || typeof pl !== 'object') continue;
      pl.name = String(pl.name || '').slice(0, 60);
      pl.weeks = Math.max(1, Math.min(52, num(pl.weeks, 4)));
      for (const d of (Array.isArray(pl.days) ? pl.days : [])) {
        if (!d || typeof d !== 'object') continue;
        d.name = String(d.name || '').slice(0, 60);
        for (const it of (Array.isArray(d.items) ? d.items : [])) {
          if (!it || typeof it !== 'object') continue;
          it.sets = Math.max(1, Math.min(10, num(it.sets, 3)));
          it.repLo = Math.max(0, Math.min(600, num(it.repLo, 8)));
          it.repHi = Math.max(it.repLo, Math.min(600, num(it.repHi, 12)));
          it.kg = Number.isFinite(+it.kg) ? +it.kg : 0;
        }
      }
    }
    for (const ex of (Array.isArray(data.exercises) ? data.exercises : []))
      if (ex && typeof ex === 'object') ex.name = String(ex.name || '').slice(0, 120);
    let n = 0;
    for (const [store, key] of [['exercises', 'exercises'], ['plans', 'plans'], ['sessions', 'sessions'], ['workouts', 'workouts'], ['bodyweight', 'bodyweight'], ['cardio', 'cardio']]) {
      for (const rec of (data[key] || [])) {
        if (rec && rec.id) { await DB.put(store, rec); n++; }
      }
    }
    if (Array.isArray(data.injuries)) setInjuries(new Set(data.injuries));
    if (typeof data.injuriesOn === 'boolean') localStorage.setItem('injuriesOn', data.injuriesOn ? '1' : '0');
    if (Array.isArray(data.equip)) setEquip(new Set(data.equip));
    if (data.profile && typeof data.profile === 'object') localStorage.setItem('profile', JSON.stringify(data.profile));
    alert(`Restored ${n} records from ${data.exportedAt ? data.exportedAt.slice(0, 10) : 'backup'}.`
      + (fileVer < BACKUP_SCHEMA ? ' Older backup — brought up to the current format on the way in.' : ''));
    renderTab();
  }

  async function resetHistory() {
    if (!confirm('Delete ALL logged workouts and sets?\n\nYour exercises and your block stay — only the training history and week progress are wiped.')) return;
    for (const s of await DB.all('sessions')) await DB.del('sessions', s.id);
    for (const w of await DB.all('workouts')) await DB.del('workouts', w.id);
    for (const p of await DB.all('plans')) {
      p.startDate = null; p.completed = []; p.finishedAt = null;
      for (const d of (p.days || [])) for (const it of d.items) it.kg = 0;
      await DB.put('plans', p);
    }
    live.set(null);
    stopRest();
    renderTab();
  }

  function agoDays(ds) {
    if (ds === todayStr()) return 'today';
    const n = Math.floor((dateOf(todayStr()).getTime() - dateOf(ds).getTime()) / 86400000);
    return n <= 1 ? 'yesterday' : n + ' days ago';
  }

