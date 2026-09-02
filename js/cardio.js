/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
  /* ============================================================
     CARDIO
     ============================================================ */
  /* Most activities happen both indoors and out, and the burn differs —
     a street run costs more than the same minutes on a treadmill.
     null = that activity doesn't exist in that setting.
     calories = MET x 3.5 x kg / 200 per minute, the rates assume a normal steady session. */
  const CARDIO_ACTS = [
    { name: 'Walk', indoor: 3.8, outdoor: 3.5 },
    { name: 'Run', indoor: 9.8, outdoor: 10.0 },
    { name: 'Trail Run', indoor: null, outdoor: 10.5 },
    { name: 'Cycling', indoor: 7.0, outdoor: 8.0 },
    { name: 'Rowing', indoor: 7.0, outdoor: 8.5 },
    { name: 'Swimming', indoor: 8.3, outdoor: 9.5 },
    { name: 'Elliptical', indoor: 5.5, outdoor: null },
    { name: 'Stair Climber', indoor: 9.0, outdoor: null },
    { name: 'Stairs', indoor: 8.8, outdoor: 8.8 },
    { name: 'Jump Rope', indoor: 12.3, outdoor: 12.3 },
    { name: 'Sprints', indoor: 12.0, outdoor: 12.5 },
    { name: 'Boxing', indoor: 9.0, outdoor: 9.0 },
    { name: 'Hiking', indoor: null, outdoor: 6.0 },
    { name: 'Football', indoor: 7.0, outdoor: 7.0 },
    { name: 'Tennis', indoor: 7.3, outdoor: 7.3 },
    { name: 'Padel', indoor: 7.0, outdoor: 7.0 },
    { name: 'Skipping Drills', indoor: 10.0, outdoor: 10.0 }
  ];
  /* effort isn't asked for — the MET rates already assume a normal,
     steady session. Old records may carry a scale; honour it. */
  const CARDIO_EFFORT = [
    { key: 'easy', mul: 0.8 },
    { key: 'steady', mul: 1 },
    { key: 'hard', mul: 1.3 }
  ];
  const actsFor = env => CARDIO_ACTS.filter(a => a[env] != null);
  const metOf = (name, env) => {
    const a = CARDIO_ACTS.find(x => x.name === name);
    if (!a) return 7;                       // anything logged before this list
    return a[env] ?? a.indoor ?? a.outdoor ?? 7;
  };
  const mulOf = key => (CARDIO_EFFORT.find(e => e.key === key) || CARDIO_EFFORT[1]).mul;
  const liveCardio = {
    get() { try { return JSON.parse(localStorage.getItem('liveCardio') || 'null'); } catch { return null; } },
    set(v) { v ? localStorage.setItem('liveCardio', JSON.stringify(v)) : localStorage.removeItem('liveCardio'); }
  };
  let cardioEnv = localStorage.getItem('cardioEnv') || 'indoor';
  let cardioActName = localStorage.getItem('cardioAct') || 'Run';
  let cardioMins = 0, cardioInt = null, cardioAlerted = false;   // 0 = nothing set yet
  /* The programs a machine's panel offers, minus the machine — and each
     activity carries its own set, because a pool has no incline button and a
     rope has no pace. Manual is always first: pick a time and go. */
  const P_QUICK = { label: 'Quick', mins: 10, note: 'Easy pace — just move.' };
  const P_FAT = { label: 'Fat burn', mins: 25, note: 'Steady, you can still talk.' };
  const P_STEADY = { label: 'Steady', mins: 30, note: 'Moderate — slightly breathless.' };
  const P_INT = { label: 'Intervals', mins: 20, note: '1 min hard, 2 min easy, repeat.' };
  const P_LONG = { label: 'Long', mins: 45, note: 'Long and even — settle in.' };
  /* One programme list per activity — a spin bike, a flight of stairs and a
     padel court do not keep the same clock. Times are what each session
     honestly takes, in the 5-minute steps the wheel offers. */
  const CARDIO_PROGS = {
    'Walk': [
      { label: 'Quick', mins: 10, note: 'Round the block — just move.' },
      { label: 'Brisk', mins: 25, note: 'On the edge of breathless.' },
      { label: 'Hills', mins: 30, note: 'Do not speed up — climb.' },
      { label: 'Long', mins: 60, note: 'An hour at one even pace.' }],
    'Run': [
      { label: 'Easy', mins: 20, note: 'You could hold a conversation.' },
      { label: 'Tempo', mins: 25, note: 'Comfortably hard the whole way.' },
      { label: 'Intervals', mins: 20, note: '1 min hard, 2 min easy, repeat.' },
      { label: 'Hill', mins: 25, note: 'Find a hill or raise the incline.' },
      { label: 'Long', mins: 60, note: 'Slow and far — settle in.' }],
    'Trail Run': [
      { label: 'Easy', mins: 30, note: 'Walk the climbs, run the rest.' },
      { label: 'Hilly', mins: 45, note: 'Let the trail set the pace.' },
      { label: 'Long', mins: 75, note: 'Far out and back — carry water.' }],
    'Cycling': [
      { label: 'Spin', mins: 20, note: 'Light gear, quick legs.' },
      { label: 'Steady', mins: 40, note: 'One honest pace.' },
      { label: 'Intervals', mins: 20, note: '1 min hard, 2 min easy, repeat.' },
      { label: 'Hills', mins: 30, note: 'Climb seated, recover rolling.' },
      { label: 'Long', mins: 90, note: 'Settle in and roll.' }],
    'Rowing': [
      { label: 'Quick', mins: 10, note: 'Easy pace — just move.' },
      { label: 'Steady', mins: 20, note: 'Hold one honest split.' },
      { label: 'Intervals', mins: 15, note: '1 min hard, 1 min light, repeat.' },
      { label: 'Long', mins: 30, note: 'Long and even — settle in.' }],
    'Swimming': [
      { label: 'Easy', mins: 20, note: 'Lengths at a talking pace, rest as needed.' },
      { label: 'Intervals', mins: 20, note: 'One length hard, one easy, repeat.' },
      { label: 'Long', mins: 30, note: 'Continuous, steady, count the lengths.' }],
    'Elliptical': [
      { label: 'Quick', mins: 10, note: 'Easy pace — just move.' },
      { label: 'Fat burn', mins: 25, note: 'Steady — you can still talk.' },
      { label: 'Intervals', mins: 20, note: '1 min hard, 2 min easy, repeat.' },
      { label: 'Climb', mins: 25, note: 'Raise the resistance every 5 min.' },
      { label: 'Long', mins: 40, note: 'Long and even — settle in.' }],
    'Stair Climber': [
      { label: 'Quick', mins: 10, note: 'Steady steps, hands off the rails.' },
      { label: 'Steady', mins: 20, note: 'One pace, stand tall.' },
      { label: 'Intervals', mins: 15, note: '1 min quick, 2 min easy, repeat.' },
      { label: 'Long', mins: 30, note: 'Slow, tall, relentless.' }],
    'Stairs': [
      { label: 'Rounds', mins: 15, note: 'Up hard, walk down to recover.' },
      { label: 'Steady', mins: 20, note: 'Even climbs, easy descents.' },
      { label: 'Long', mins: 30, note: 'Keep every climb honest.' }],
    'Jump Rope': [
      { label: 'Short', mins: 10, note: '30 s on, 30 s off, repeat.' },
      { label: 'Rounds', mins: 15, note: '3 min on, 1 min off, repeat.' },
      { label: 'Endurance', mins: 20, note: 'Steady skipping — break only when you must.' }],
    'Sprints': [
      { label: 'Intervals', mins: 15, note: '30 s all-out, 90 s walk, repeat.' },
      { label: 'Pyramid', mins: 20, note: 'Sprints of 20, 30, 40, 30, 20 s — walk between.' }],
    'Boxing': [
      { label: 'Short', mins: 10, note: '30 s on, 30 s off, repeat.' },
      { label: 'Rounds', mins: 15, note: '3 min on, 1 min off — ring time.' },
      { label: 'Bag work', mins: 20, note: 'Steady rounds on the bag.' }],
    'Hiking': [
      { label: 'Short', mins: 45, note: 'Out and back before lunch.' },
      { label: 'Hills', mins: 60, note: 'Pick the climbing route.' },
      { label: 'Long', mins: 120, note: 'Half a day — pack water.' }],
    'Football': [
      { label: 'Kickabout', mins: 30, note: 'Small sides, rolling subs.' },
      { label: '5-a-side', mins: 50, note: 'Two halves, short break.' },
      { label: 'Match', mins: 90, note: 'The full ninety.' }],
    'Tennis': [
      { label: 'Rally', mins: 20, note: 'Feeding and rallying, no score.' },
      { label: 'One set', mins: 30, note: 'Play a set, then stop.' },
      { label: 'Match', mins: 90, note: 'Best of three — pace yourself.' }],
    'Padel': [
      { label: 'Drills', mins: 20, note: 'Rallying and feeding, nobody keeping score.' },
      { label: 'One set', mins: 30, note: 'Play a set, then stop.' },
      { label: 'Match', mins: 60, note: 'A full match, changeovers and all.' },
      { label: 'Long', mins: 90, note: 'Two or three sets — pace yourself.' }],
    'Skipping Drills': [
      { label: 'Short', mins: 10, note: 'Fast feet, short bursts.' },
      { label: 'Rounds', mins: 15, note: '3 min of patterns, 1 min off.' }]
  };
  const progsFor = act => CARDIO_PROGS[act] || [P_QUICK, P_FAT, P_STEADY, P_INT, P_LONG];
  /* always opens on None — the time is the user's to set, and a program is
     something you reach for, not something that follows you around */
  let cardioProg = 'None';

  function cardioKcal(met, mins, kg, effort) {
    return Math.round(met * mulOf(effort) * 3.5 * (kg || 80) / 200 * mins);
  }

  /* What a lifting session costs, from time on the clock. The compendium puts
     resistance training with multiple exercises at 6 METs for vigorous effort
     and 3.5 for general; 5.0 sits between them and is what a real session of
     working sets and rests averages out at. Paused time is already out of the
     minutes we pass in. It is an estimate and the app says so. */
  const LIFT_MET = 5.0;
  const liftKcal = (mins, kg) => Math.round(LIFT_MET * 3.5 * (kg || 80) / 200 * mins);

  /* the body weight to reckon with — the last one logged, or 80kg */
  let lastBodyKg = 80;
  DB.all('bodyweight').then(rows => {
    const sorted = (rows || []).sort((a, b) => a.ts - b.ts);
    if (sorted.length) lastBodyKg = sorted[sorted.length - 1].kg;
  }).catch(() => {});

  /* Picker wheel — the same ruler language as the weight and rep scales:
     tick lines running down a dial with a fixed clay indicator.
     tickFor(i) returns 'w20' | 'w15' | 'w11' for the mark's length.
     onTap(i), if given, fires when the centred row is tapped. */
  function pickerWheel(labels, index, onChange, cls, tickFor, onTap, onDetent, ariaLabel) {
    const TICK = 40;
    let val = Math.max(0, Math.min(labels.length - 1, index));
    const wrap = el('div', 'pw' + (cls ? ' ' + cls : ''));
    wrap.appendChild(el('i', 'pw-ind'));
    const strip = el('div', 'pw-strip');
    labels.forEach((lb, i) => {
      const t = el('button', 'pw-item');
      t.dataset.i = i;
      const slot = el('span', 'pw-slot');
      slot.appendChild(el('i', tickFor ? tickFor(i) : 'w11'));
      t.appendChild(slot);
      t.appendChild(el('span', 'pw-lbl', lb));
      strip.appendChild(t);
    });
    wrap.appendChild(strip);

    /* 'picking' marks the wheel as being turned right now — the page uses it
       to fade what is around it and give the row under the indicator room */
    const pick = on => wrap.classList.toggle('picking', on);
    const offFor = i => -(i * TICK + TICK / 2);
    const idxAt = off => Math.round(-(off + TICK / 2) / TICK);
    const clampI = i => Math.max(0, Math.min(labels.length - 1, i));
    const mark = () => [...strip.children].forEach((t, i) => t.classList.toggle('sel', i === val));
    const put = off => { strip.style.transform = `translateY(${off}px)`; };
    let raf = null;

    const slide = anim => {
      cancelAnimationFrame(raf);
      strip.style.transition = anim ? 'transform .18s ease-out' : 'none';
      put(offFor(val));
    };
    const setVal = (i, anim) => {
      i = clampI(i);
      if (i !== val) haptic();
      val = i;
      mark(); slide(anim);
      onChange(val);
    };

    /* spin on: coast to a stop like a wheel, ticking past each notch */
    const coastTo = (target, fromOff) => {
      cancelAnimationFrame(raf);
      strip.style.transition = 'none';
      target = clampI(target);
      const to = offFor(target);
      const dist = Math.abs(to - fromOff);
      const dur = Math.max(220, Math.min(1100, dist * 2.2));
      const t0 = performance.now();
      let lastDetent = idxAt(fromOff);
      const step = now => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);           // ease out, like friction
        const off = fromOff + (to - fromOff) * e;
        put(off);
        const d = idxAt(off);
        if (d !== lastDetent) {                      // a click for every notch passed
          lastDetent = d;
          haptic();
          const c = clampI(d);
          [...strip.children].forEach((t, i) => t.classList.toggle('sel', i === c));
          if (onDetent) onDetent(c);
        }
        if (p < 1) { raf = requestAnimationFrame(step); return; }
        val = target;
        mark();
        pick(false);
        onChange(val);
      };
      raf = requestAnimationFrame(step);
    };

    let sy = null, so = 0, lastN = 0, vy = 0, lastY = 0, lastT = 0;
    wrap.style.touchAction = 'none';
    wrap.addEventListener('pointerdown', e => {
      cancelAnimationFrame(raf);
      sy = e.clientY; so = offFor(val); lastN = 0;
      vy = 0; lastY = e.clientY; lastT = performance.now();
      strip.style.transition = 'none';
      pick(true);
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e => {
      if (sy === null) return;
      const dy = e.clientY - sy;
      put(so + dy);
      const n = Math.round(dy / TICK);
      if (n !== lastN) {
        lastN = n;
        haptic();
        /* the row under the needle lights and reports mid-drag, so anything
           reading the wheel (the difficulty line) tracks the spin live */
        const c = clampI(idxAt(so + dy));
        [...strip.children].forEach((t, i) => t.classList.toggle('sel', i === c));
        if (onDetent) onDetent(c);
      }
      const now = performance.now(), dt = now - lastT;
      if (dt > 0) { vy = (e.clientY - lastY) / dt; lastY = e.clientY; lastT = now; }
    });
    const end = e => {
      if (sy === null) return;
      const dy = e.clientY - sy;
      sy = null;
      if (Math.abs(dy) < 5) {
        slide(false);
        pick(false);
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const item = t && t.closest ? t.closest('.pw-item') : null;
        if (!item) return;
        const i = +item.dataset.i;
        // a tap on the one already under the indicator is a tap, not a move
        if (onTap && i === val) onTap(i); else setVal(i, true);
        return;
      }
      // carry the flick forward: how far it would drift before friction wins
      const stale = performance.now() - lastT > 90;
      const throwPx = stale ? 0 : vy * 170;
      const fromOff = so + dy;
      coastTo(Math.round(-(fromOff + throwPx + TICK / 2) / TICK), fromOff);
    };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', () => {
      if (sy !== null) { sy = null; slide(false); pick(false); }
    });

    mark(); slide(false);
    /* turned by code, not a thumb: animate to the index without firing
       onChange, so the manual-override logic upstream stays quiet */
    wrap.spinTo = i => {
      i = clampI(i);
      if (i === val) return;
      val = i;
      mark();
      slide(true);
    };
    {
      const a11yPW = a11ySlider(wrap, {
        label: ariaLabel || 'picker',
        min: 0, max: labels.length - 1,
        orient: 'vertical',
        now: () => val,
        text: () => String(labels[val]),
        step: d => setVal(val + d, true)
      });
      wrap.addEventListener('pointerup', () => setTimeout(a11yPW, 0));
    }
    return wrap;
  }

  /* A bezel you set by turning — the Submariner idea pointed backwards:
     one revolution is two hours, every 15 degrees a five-minute click. The
     ring rotates under a fixed lume triangle, the chosen time reads in the
     middle, and each detent clicks like the real thing. */
  function bezelDial(opts) {
    const MINV = opts.min, MAXV = opts.max, STEP = opts.step;
    const perDeg = (MAXV) / 360;                     // one turn = the full range
    let val = Math.max(MINV, Math.min(MAXV, opts.value));
    const wrap = el('div', 'bz-dial');
    const tickLine = (deg, r1, r2, w, col) => {
      const a = deg * Math.PI / 180;
      return `<line x1="${(100 + r1 * Math.sin(a)).toFixed(2)}" y1="${(100 - r1 * Math.cos(a)).toFixed(2)}"`
        + ` x2="${(100 + r2 * Math.sin(a)).toFixed(2)}" y2="${(100 - r2 * Math.cos(a)).toFixed(2)}"`
        + ` stroke="${col}" stroke-width="${w}" stroke-linecap="butt"/>`;
    };
    let ticks = '';
    for (let i = 1; i < 24; i++) {                     // zero belongs to the pip
      if (i === 6 || i === 12 || i === 18) continue;   // the numerals live there
      ticks += i % 2 === 0
        ? tickLine(i * 15, 80.5, 89, 4.4, '#E8E4DC')   // broad bars at the tens
        : tickLine(i * 15, 83.5, 89, 1.8, '#CFC9BF');  // slim marks between
    }
    /* the dense count-up hashes of the first quarter */
    for (let h = 1; h < 12; h++) {
      if (h % 2 === 0) continue;
      ticks += tickLine(h * 7.5, 85.5, 89, 1.1, '#9B958A');
    }
    /* the grip: a dark knurled edge — machined, not polished */
    let teeth = '';
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * 2 * Math.PI;
      teeth += `<circle cx="${(100 + 99 * Math.sin(a)).toFixed(2)}" cy="${(100 - 99 * Math.cos(a)).toFixed(2)}"`
        + ` r="2.6" fill="#0B0908"/>`;
    }
    let nums = '';
    /* printed ON the insert like a real bezel: each numeral sits on the
       band's centreline, rotated radially so its top faces the glass edge */
    for (const m of [30, 60, 90]) {
      const deg = m / MAXV * 360;
      const a = deg * Math.PI / 180;
      const x = (100 + 84.5 * Math.sin(a)).toFixed(1);
      const y = (100 - 84.5 * Math.cos(a)).toFixed(1);
      nums += `<text x="${x}" y="${y}" dy="4.2" text-anchor="middle" fill="#F0ECE4"`
        + ` font-size="12.5" font-weight="800" font-family="Archivo, sans-serif"`
        + ` transform="rotate(${deg} ${x} ${y})">${m}</text>`;
    }
    /* two dials in one case: the outer ring sets the time, the inner one
       runs it — a sweep arc and an orbiting second under the same glass */
    const RA = 56, CA = (2 * Math.PI * RA).toFixed(2);
    wrap.innerHTML = `<svg viewBox="0 0 200 200" class="wz">
      <defs>
        <linearGradient id="bzMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4E463D"/>
          <stop offset=".55" stop-color="#332D26"/>
          <stop offset="1" stop-color="#1E1A15"/>
        </linearGradient>
        <radialGradient id="bzIns" cx="50%" cy="30%" r="82%">
          <stop offset="0" stop-color="#31333A"/>
          <stop offset=".55" stop-color="#17181C"/>
          <stop offset="1" stop-color="#0A0A0C"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="95" fill="none" stroke="url(#bzMetal)" stroke-width="8.5"/>
      ${teeth}
      <circle cx="100" cy="100" r="90.6" fill="none" stroke="#1B1713" stroke-width="1.2"/>
      <g class="bz-ring">
        <circle cx="100" cy="100" r="84" fill="none" stroke="url(#bzIns)" stroke-width="13.2"/>
        ${ticks}${nums}
        <circle cx="100" cy="15.5" r="5" fill="#101013" stroke="#8B8378" stroke-width="1.5"/>
        <circle cx="100" cy="15.5" r="2.9" fill="#EDE9E0"/>
      </g>
      <path d="M100 10.5 L104.8 2.5 L95.2 2.5 Z" fill="#CE6B3D"/>
      <circle cx="100" cy="100" r="77.2" fill="none" stroke="#3A332C" stroke-width="1.3"/>
      <circle cx="100" cy="100" r="62" fill="#0E0B0A" stroke="#241E1A" stroke-width="1"/>
      <circle class="bz-track" cx="100" cy="100" r="${RA}" fill="none" stroke="#241E1A" stroke-width="3"/>
      <circle class="bz-arc" cx="100" cy="100" r="${RA}" fill="none" stroke="#CE6B3D" stroke-width="3"
        stroke-linecap="round" stroke-dasharray="0 ${CA}" transform="rotate(-90 100 100)" display="none"/>
      <g class="bz-sec" display="none"><circle cx="100" cy="${100 - RA}" r="3.4" fill="#CE6B3D"/></g>
    </svg>`;
    const mid = el('div', 'wz-mid');
    const big = el('div', 'bz-min num', String(val));
    const unit = el('div', 'bz-unit', 'min');
    mid.append(big, unit);
    wrap.appendChild(mid);
    wrap.bigEl = big;
    wrap.unitEl = unit;
    const arcEl = wrap.querySelector('.bz-arc');
    const secEl = wrap.querySelector('.bz-sec');
    wrap.setRun = (frac, sec) => {
      wrap.classList.add('run');
      secEl.removeAttribute('display');
      arcEl.removeAttribute('display');
      arcEl.setAttribute('stroke-dasharray', `${(frac * 2 * Math.PI * RA).toFixed(2)} ${CA}`);
      secEl.setAttribute('transform', `rotate(${(sec % 60) * 6} 100 100)`);
    };
    const ring = wrap.querySelector('.bz-ring');
    const paint = anim => {
      ring.style.transition = anim ? 'transform .3s ease-out' : 'none';
      ring.style.transform = `rotate(${-(val / MAXV) * 360}deg)`;
      big.textContent = String(val);
    };
    paint(false);

    const polar = e => {
      const r = wrap.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      return { a: Math.atan2(dx, -dy) * 180 / Math.PI, rad: Math.hypot(dx, dy) / (r.width / 2) };
    };
    let dragging = false, lastA = 0, acc = 0, startVal = 0, pid = null;
    wrap.style.touchAction = 'none';
    wrap.addEventListener('pointerdown', e => {
      if (opts.locked) return;               // a running watch is not for turning
      /* only the bezel band turns. Near the centre, a few pixels of finger
         wobble reads as half a revolution — a tap on the big number must
         never spin the time. */
      const p0 = polar(e);
      if (p0.rad < 0.55) return;
      dragging = true; pid = e.pointerId; lastA = p0.a; acc = 0; startVal = val;
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e => {
      if (!dragging || e.pointerId !== pid) return;
      const pt = polar(e);
      if (pt.rad < 0.4) return;              // drifting across the centre says nothing
      const a = pt.a;
      let d = a - lastA;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lastA = a; acc += d;
      /* turning clockwise raises the time — the ring itself turns the other
         way under the marker, like a bezel does */
      const raw = startVal + acc * perDeg;
      const snapped = Math.max(MINV, Math.min(MAXV, Math.round(raw / STEP) * STEP));
      if (snapped !== val) {
        val = snapped;
        haptic();
        bezelClick();
        paint(false);
        opts.onChange(val);
      }
    });
    const end = e => { if (!e || e.pointerId === pid) { dragging = false; pid = null; } };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);

    wrap.set = v => {
      v = Math.max(MINV, Math.min(MAXV, Math.round(v / STEP) * STEP));
      if (v === val) return;
      val = v;
      paint(true);
      a11yDial();
    };
    wrap.get = () => val;
    const a11yDial = a11ySlider(wrap, {
      label: 'Minutes',
      min: MINV, max: MAXV,
      now: () => val,
      text: () => val + ' minutes',
      step: d => {
        if (opts.locked) return;
        const v = Math.max(MINV, Math.min(MAXV, val + d * STEP));
        if (v === val) return;
        val = v; haptic(); paint(true); opts.onChange(val);
      }
    });
    wrap.addEventListener('pointerup', () => setTimeout(a11yDial, 0));
    /* the dead middle is the typing door: tap the number, get the pad —
       the same pencil idea the weight scale uses */
    wrap.addEventListener('click', e => {
      if (opts.locked) return;
      if (polar(e).rad >= 0.55) return;
      openNumPad({
        title: 'Minutes', value: val, decimals: false, min: MINV, max: MAXV,
        apply: v => {
          v = Math.max(MINV, Math.min(MAXV, Math.round(v / STEP) * STEP));
          if (v === val) return;
          val = v; paint(true); a11yDial(); opts.onChange(val);
        }
      });
    });
    return wrap;
  }

  async function renderCardio() {
    const root = $('#view-cardio');
    root.innerHTML = '';
    clearInterval(cardioInt);
    const [logs, bw] = await Promise.all([DB.all('cardio'), DB.all('bodyweight')]);
    logs.sort((a, b) => b.ts - a.ts);
    const kg = bw.length ? [...bw].sort((a, b) => a.ts - b.ts).pop().kg : 80;
    const lc = liveCardio.get();
    const running = !!lc;

    const head = el('header', 't-head');
    const hl = el('div');
    const wkLogs = logs.filter(x => sameWeek(x.date));
    hl.appendChild(el('div', 't-date',
      wkLogs.length
        ? `This week · ${wkLogs.reduce((a, x) => a + x.minutes, 0)} min · ${wkLogs.reduce((a, x) => a + x.calories, 0)} kcal`
        : 'No cardio yet'));
    hl.appendChild(el('h1', 't-title', 'Cardio'));
    head.appendChild(hl);
    root.appendChild(head);

    // ---- the pickers stay on screen the whole time ----
    cardioAlerted = running ? cardioAlerted : false;
    const minsList = Array.from({ length: 24 }, (_, i) => (i + 1) * 5);
    if (cardioMins && !minsList.includes(cardioMins)) cardioMins = 0;
    const env = running ? (lc.env || 'indoor') : cardioEnv;
    let list = actsFor(env);
    const actName = running ? lc.act : cardioActName;
    let ai = list.findIndex(a => a.name === actName);
    if (ai < 0) ai = 0;
    if (!running) cardioActName = list[ai].name;
    const shownMins = running ? lc.mins : cardioMins;

    root.appendChild(segToggle(
      [['indoor', 'Indoor', running], ['outdoor', 'Outdoor', running]],
      env,
      e2 => {
        if (running || cardioEnv === e2) return;
        cardioEnv = e2;
        localStorage.setItem('cardioEnv', e2);
        renderCardio();
      },
      'defer'));

    const kcalEl = el('div', 'cd-kcal num');
    let startBtn = null;
    const upd = () => {
      kcalEl.textContent = cardioMins
        ? `~${cardioKcal(metOf(cardioActName, cardioEnv), cardioMins, kg)} kcal`
        : 'Turn the bezel or pick a program';
      kcalEl.classList.toggle('idle', !cardioMins);
      if (startBtn) startBtn.disabled = !cardioMins;
    };

    /* Three rails stacked, not three wheels side by side: at this width a
       column is barely wide enough for "Cycling", and the minutes were being
       clipped to "1." Each control gets the full width and its own line. */
    const stack = el('div', 'cd-stack' + (running ? ' locked' : ''));
    const progs = progsFor(actName);
    const progLabels = ['None', ...progs.map(x => x.label)];
    const shownProg = running ? (lc.prog || 'None') : cardioProg;
    let pi = progLabels.indexOf(shownProg);
    if (pi < 0) { pi = 0; if (!running) cardioProg = 'None'; }
    const progNote = el('div', 'ab-hint cd-prognote');
    const paintNote = () => {
      const pr3 = progs.find(x => x.label === (running ? lc.prog : cardioProg));
      progNote.textContent = pr3 ? pr3.note : '';
      progNote.hidden = !pr3;
    };

    const row = (label, valueEl, rail) => {
      const r = el('div', 'cd-row');
      const h = el('div', 'cd-row-head');
      h.appendChild(el('div', 'micro', label));
      h.appendChild(valueEl);
      r.appendChild(h);
      r.appendChild(rail);
      stack.appendChild(r);
      return r;
    };

    const actVal = el('div', 'cd-row-val', actName);
    row('Activity', actVal, optionRail(list.map(t => t.name), ai, i => {
      cardioActName = list[i].name;
      actVal.textContent = cardioActName;
      localStorage.setItem('cardioAct', cardioActName);
      cardioProg = 'None';           // a new activity brings its own panel
      upd();
      clearTimeout(renderCardio._t);
      renderCardio._t = setTimeout(renderCardio, 380);
    }, 118, true, 'Activity'));

    const progVal = el('div', 'cd-row-val', shownProg);
    const progRail = optionRail(progLabels, pi, i => {
      cardioProg = progLabels[i];
      progVal.textContent = cardioProg;
      const pr3 = progs.find(x => x.label === cardioProg);
      if (pr3) {
        cardioMins = pr3.mins;
        dial.set(pr3.mins);            // the ring turns in front of you
        progRow.classList.remove('off');
      }
      paintNote();
      upd();
    }, 104, true, 'Program');
    const progRow = row('Program', progVal, progRail);

    const dial = bezelDial({
      min: 0, max: 120, step: 5, value: shownMins, locked: running,
      onChange: v => {
        cardioMins = v;
        const pr4 = progs.find(x => x.label === cardioProg);
        if (pr4 && pr4.mins !== cardioMins) {
          cardioProg = 'None';         // the time is yours now
          progVal.textContent = 'None';
          progRail.spinTo(0);          // and the rail says so too
          progRow.classList.add('off');
          paintNote();
        }
        upd();
      }
    });

    root.appendChild(stack);
    root.appendChild(dial);
    paintNote();
    root.appendChild(progNote);

    if (!running) {
      root.appendChild(kcalEl);

      const start = el('button', 'btn-cta big');
      startBtn = start;
      start.style.width = '100%';
      start.appendChild(svgIcon(PLAY, 13));
      start.appendChild(document.createTextNode(' Start'));
      upd();
      start.onclick = () => {
        if (!cardioMins) return;
        liveCardio.set({
          act: cardioActName, env: cardioEnv, mins: cardioMins,
          prog: cardioProg !== 'None' ? cardioProg : null,
          startedAt: Date.now(), acc: 0
        });
        cardioAlerted = false;
        renderCardio();
      };
      root.appendChild(start);
    } else {
      // ---- the timer lives right below the wheels ----
      const total = lc.mins * 60;
      const met = metOf(lc.act, env);
      const doneSec = () => Math.min(total, Math.round((lc.acc || 0) + (lc.startedAt ? (Date.now() - lc.startedAt) / 1000 : 0)));

      /* the same watch, now running: the outer bezel stays where it was
         set, the inner dial does the work */
      dial.classList.toggle('paused', !lc.startedAt);
      const clock = dial.bigEl;
      const sub = dial.unitEl;

      const acts = el('div', 'block-actions');
      const pause = el('button', 'btn-ghost', lc.startedAt ? 'Pause' : 'Resume');
      pause.onclick = () => {
        const cur = liveCardio.get();
        if (!cur) return;
        if (cur.startedAt) {
          cur.acc = (cur.acc || 0) + (Date.now() - cur.startedAt) / 1000;
          cur.startedAt = null;
        } else {
          cur.startedAt = Date.now();
        }
        liveCardio.set(cur);
        renderCardio();
      };
      const fin = el('button', 'btn-cta big', 'Finish & save');
      fin.style.cssText = 'flex:1.4;width:auto;align-self:stretch;margin-top:0';
      fin.onclick = () => finishCardio(false);
      acts.append(pause, fin);
      root.appendChild(acts);

      const disc = el('div', 'text-links');
      const d = el('button', null, 'Discard');
      d.onclick = async () => {
        if (!await appConfirm({ title: 'Discard?', body: 'Not saved.', ok: 'Discard', cancel: 'Keep going', warn: true })) return;
        liveCardio.set(null);
        renderCardio();
      };
      disc.appendChild(d);
      root.appendChild(disc);

      const tick = () => {
        const d2 = doneSec(), l = Math.max(0, total - d2);
        clock.textContent = fmtClock(l);
        sub.textContent = `${Math.round(d2 / 60)} of ${lc.mins} min · ~${cardioKcal(met, d2 / 60, kg)} kcal`;
        dial.setRun(Math.min(1, d2 / total), d2);
        if (l <= 0 && !cardioAlerted) {
          cardioAlerted = true;
          beep();
          if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
          clearInterval(cardioInt);
          finishCardio(true);
        }
      };
      tick();
      if (lc.startedAt) cardioInt = setInterval(tick, 500);
    }

    // ---- history ----
    if (logs.length) {
      root.appendChild(el('div', 'micro', 'History'));
      const rail = el('div', 'plan-rail');
      const CD_SHOWN = 3;
      (cardioHistOpen ? logs : logs.slice(0, CD_SHOWN)).forEach(x => {
        const r = el('div', 'hrow');
        const node = el('i', 'ex-node small');
        node.appendChild(el('i'));
        r.appendChild(node);
        const c = el('div', 'hrow-body');
        c.appendChild(el('div', 'hrow-date', dateOf(x.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })));
        c.appendChild(el('div', 'hrow-name', x.activity));
        c.appendChild(el('div', 'hrow-meta num',
          `${x.minutes} min · ${x.calories} kcal${x.env ? ' · ' + x.env : ''}`));
        r.appendChild(c);
        const del = el('button', 'hist-del', '✕');
        del.onclick = async e => {
          e.stopPropagation();
          if (!confirm(`Delete ${x.activity} from ${x.date}?`)) return;
          await DB.del('cardio', x.id);
          renderCardio();
        };
        r.appendChild(del);
        rail.appendChild(r);
      });
      if (logs.length > CD_SHOWN) {
        const more = el('div', 'text-links inset');
        const b = el('button', null, cardioHistOpen ? 'Show less' : `Show all ${logs.length}`);
        b.onclick = () => { cardioHistOpen = !cardioHistOpen; renderCardio(); };
        more.appendChild(b);
        rail.appendChild(more);
      }
      root.appendChild(rail);

      // ---- totals + 8-week trend, closing the page ----
      const base = el('div', 'base-row');
      const bs = (v, l, cls) => {
        const d = el('div', 'base-stat' + (cls ? ' ' + cls : ''));
        d.appendChild(el('div', 'v num', v));
        d.appendChild(el('div', 'l', l));
        return d;
      };
      const totMin = logs.reduce((a, x) => a + x.minutes, 0);
      base.appendChild(bs(String(logs.length), 'Sessions'));
      base.appendChild(bs(Math.round(totMin / 6) / 10 + ' h', 'Time'));
      base.appendChild(bs(fmtKg(logs.reduce((a, x) => a + x.calories, 0)), 'Kcal', 'earn'));
      root.appendChild(base);

      const nowD = new Date();
      const dow0 = dowFrom(nowD);
      const mon = new Date(nowD); mon.setDate(nowD.getDate() - dow0); mon.setHours(0, 0, 0, 0);
      const weekly = Array.from({ length: 8 }, (_, i) => {
        const ws = new Date(mon.getTime() - (7 - i) * 7 * 86400000);
        const we = new Date(ws.getTime() + 7 * 86400000);
        return logs.filter(x => { const d = dateOf(x.date); return d >= ws && d < we; })
          .reduce((a, x) => a + x.minutes, 0);
      });
      if (weekly.some(v => v > 0)) {
        const cell = el('div', 'sg-cell');
        cell.appendChild(el('div', 'sg-name', 'Minutes · per week'));
        const row = el('div', 'sg-valrow');
        row.appendChild(el('span', 'sg-val num', weekly[7] + ' min'));
        const d = weekly[7] - weekly[6];
        if (d !== 0) row.appendChild(el('span', 'sg-d num' + (d > 0 ? ' up' : ' down'), (d > 0 ? '+' : '−') + Math.abs(d)));
        cell.appendChild(row);
        const g = el('div', 'sg-graph');
        g.innerHTML = sparkSVG(weekly, 320, 60);
        cell.appendChild(g);
        root.appendChild(cell);
      }
    } else {
      const emp = el('div', 'empty-state');
      emp.appendChild(el('p', null, 'Pick an activity and press Start.'));
      root.appendChild(emp);
    }
  }

  async function finishCardio(auto) {
    const lc = liveCardio.get();
    if (!lc) return;
    clearInterval(cardioInt);
    const total = lc.mins * 60;
    const elapsed = (lc.acc || 0) + (lc.startedAt ? (Date.now() - lc.startedAt) / 1000 : 0);
    const secs = Math.min(total, Math.max(1, Math.round(elapsed)));
    const mins = Math.max(1, Math.round(secs / 60));
    const bw = await DB.all('bodyweight');
    const kg = bw.length ? [...bw].sort((a, b) => a.ts - b.ts).pop().kg : 80;
    const env = lc.env || 'indoor';
    const kcal = cardioKcal(metOf(lc.act, env), mins, kg, lc.effort);
    const ok = await appConfirm({
      title: auto ? 'Time!' : 'Finish?',
      body: `${lc.act} · ${env} · ${mins} min · ${kcal} kcal`,
      ok: 'Save', cancel: auto ? 'Discard' : 'Keep going'
    });
    if (!ok) {
      if (auto) liveCardio.set(null);
      renderCardio();
      return;
    }
    await DB.put('cardio', {
      id: DB.uid(), date: todayStr(), ts: Date.now(),
      activity: lc.act, env, minutes: mins, calories: kcal
    });
    liveCardio.set(null);
    renderCardio();
  }

