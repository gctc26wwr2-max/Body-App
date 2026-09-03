/* RACKSIDE — split from the old app.js. Classic scripts share one global
   scope: top-level const/let/function declared here are visible to every
   part loaded after this one. Load order is index.html's script order.
   Map of what lives where: FUNCTIONS.md */
'use strict';
  /* ---------------- how it felt, as a face ----------------
     Three words in three pills is a lot of reading for a question you answer
     between sets with one thumb. The same line-art the rest of the icons use:
     mouth up, mouth flat, mouth down. The heading above says the word, so
     nothing has to be guessed. */
  /* How hard it was, as load on a bar — one plate a side is a warm-up, three
     is a grind. Effort, not mood: a frowning face says you had a bad time,
     which is not the question being asked. */
  const FEEL_PLATES = {
    easy: [[9.7, 3.6]],
    moderate: [[9.7, 4.6], [6.7, 3.4]],
    hard: [[9.7, 5.2], [6.7, 4.1], [3.7, 3]]
  };
  function feelIcon(key, size = 30) {
    const NS = 'http://www.w3.org/2000/svg';
    const plates = FEEL_PLATES[key] || FEEL_PLATES.moderate;
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-linecap', 'round');
    const add = (d, w) => {
      const n = document.createElementNS(NS, 'path');
      n.setAttribute('d', d);
      n.setAttribute('stroke-width', w);
      s.appendChild(n);
    };
    add('M2.2 12 H21.8', 1.5);                       // the bar
    plates.forEach(([x, h]) => {                     // loaded both ends,
      add(`M${x} ${12 - h} V ${12 + h}`, 2.1);       // heaviest plate inside
      add(`M${24 - x} ${12 - h} V ${12 + h}`, 2.1);
    });
    s.style.display = 'block';
    return s;
  }

  /* ---------------- rating a session ----------------
     A finished session gets stars, not an effort word: how hard each exercise
     was is answered on the card while you are doing it, and by then the
     question about the whole session is whether it was any good. */
  const STAR_D = 'M12 3.4l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.9l6.1-.9z';
  function starIcon(filled, size = 30) {
    const NS = 'http://www.w3.org/2000/svg';
    const s2 = document.createElementNS(NS, 'svg');
    s2.setAttribute('viewBox', '0 0 24 24');
    s2.setAttribute('width', size);
    s2.setAttribute('height', size);
    s2.setAttribute('fill', filled ? 'currentColor' : 'none');
    s2.setAttribute('stroke', 'currentColor');
    s2.setAttribute('stroke-width', filled ? '1.2' : '1.6');
    s2.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', STAR_D);
    s2.appendChild(path);
    s2.style.display = 'block';
    return s2;
  }
  const STAR_WORD = ['', 'Poor', 'Off day', 'Solid', 'Strong', 'Best in a while'];

  /* five stars, tap to rate — tapping the one already set clears it */
  function starRow(value, onPick, size) {
    const row = el('div', 'star-row');
    for (let i = 1; i <= 5; i++) {
      const b = el('button', 'star-btn' + (i <= value ? ' on' : ''));
      b.title = i + ' of 5';
      b.setAttribute('aria-label', i + ' out of 5');
      b.appendChild(starIcon(i <= value, size || 30));
      b.onclick = () => { haptic(); onPick(value === i ? 0 : i); };
      row.appendChild(b);
    }
    return row;
  }

  /* ---------------- drag to reorder ----------------
     One grip per row. A touch screen has no HTML5 drag worth having, so this
     is pointer-driven: hold the grip and the row lifts, the rows it passes
     slide out of its way, letting go commits the new order. Nothing moves
     until you let go, so a mis-grab costs nothing.
     `prep` runs before anything is measured — the workout rail uses it to
     fold the open exercise shut so you can see where you are dropping. */
  function dragReorder(container, rowSel, onDrop, prep) {
    container.addEventListener('pointerdown', e => {
      const grip = e.target.closest && e.target.closest('.drag-grip');
      if (!grip || !container.contains(grip)) return;
      const row = grip.closest(rowSel);
      if (!row) return;
      e.preventDefault();

      if (prep) prep(true);
      const rows = [...container.querySelectorAll(rowSel)];
      const from = rows.indexOf(row);
      if (from < 0) { if (prep) prep(false); return; }
      const boxes = rows.map(r => r.getBoundingClientRect());
      const mids = boxes.map(b => b.top + b.height / 2);
      const lift = boxes[from].height + 12;   // how far a displaced row shifts

      let to = from;
      const startY = e.clientY;
      row.classList.add('drag-lift');
      grip.setPointerCapture(e.pointerId);
      haptic();

      const move = ev => {
        const dy = ev.clientY - startY;
        row.style.transform = `translateY(${dy}px)`;
        const centre = mids[from] + dy;
        let next = from;
        for (let i = 0; i < rows.length; i++) {
          if (i === from) continue;
          if (i < from && centre < mids[i]) { next = Math.min(next, i); }
          if (i > from && centre > mids[i]) { next = Math.max(next, i); }
        }
        if (next !== to) { to = next; haptic(); }
        rows.forEach((r, i) => {
          if (i === from) return;
          let shift = 0;
          if (to > from && i > from && i <= to) shift = -lift;
          if (to < from && i >= to && i < from) shift = lift;
          r.style.transform = shift ? `translateY(${shift}px)` : '';
        });
      };
      const end = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', end);
        grip.removeEventListener('pointercancel', end);
        rows.forEach(r => { r.style.transform = ''; r.classList.remove('drag-lift'); });
        if (prep) prep(false);
        if (to !== from) onDrop(from, to);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    });
  }

  /* Swipe a row sideways to take it out. Either direction — you are not
     going to remember which. It drags with your thumb, snaps back if you
     change your mind, and only commits once it is properly out of the way. */
  function swipeToRemove(row, onRemove) {
    const GO = 96;
    let sx = null, sy = null, dx = 0, locked = false;
    row.style.touchAction = 'pan-y';
    row.addEventListener('pointerdown', e => {
      if (e.target.closest('input, button, .drag-grip')) return;
      sx = e.clientX; sy = e.clientY; dx = 0; locked = false;
      row.style.transition = 'none';
    });
    row.addEventListener('pointermove', e => {
      if (sx === null) return;
      dx = e.clientX - sx;
      if (!locked) {
        // let a vertical scroll win; only take over once it is clearly sideways
        if (Math.abs(e.clientY - sy) > Math.abs(dx)) { sx = null; return; }
        if (Math.abs(dx) < 10) return;
        locked = true;
        row.setPointerCapture(e.pointerId);
        row.classList.add('swiping');
      }
      row.style.transform = `translateX(${dx}px)`;
      row.style.opacity = String(Math.max(0.25, 1 - Math.abs(dx) / (GO * 2.2)));
      row.classList.toggle('will-go', Math.abs(dx) >= GO);
    });
    const end = () => {
      if (sx === null) { row.classList.remove('swiping', 'will-go'); return; }
      sx = null;
      row.classList.remove('swiping', 'will-go');
      row.style.transition = 'transform .18s ease-out, opacity .18s ease-out';
      if (Math.abs(dx) >= GO) {
        row.style.transform = `translateX(${dx > 0 ? 400 : -400}px)`;
        row.style.opacity = '0';
        haptic();
        setTimeout(onRemove, 150);
        return;
      }
      row.style.transform = '';
      row.style.opacity = '';
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
  }

  const gripEl = title => {
    const g = el('button', 'drag-grip');
    g.title = title || 'Drag to reorder';
    // the workout card's header switches exercises on tap — the grip is not
    // a tap on the card
    g.onclick = e => { e.preventDefault(); e.stopPropagation(); };
    g.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">'
      + '<circle cx="6" cy="4" r="1.35"/><circle cx="10" cy="4" r="1.35"/>'
      + '<circle cx="6" cy="8" r="1.35"/><circle cx="10" cy="8" r="1.35"/>'
      + '<circle cx="6" cy="12" r="1.35"/><circle cx="10" cy="12" r="1.35"/></svg>';
    return g;
  };

  /* Sliding ruler — ticks glide left/right under a fixed indicator.
     Drag it like a real scale, or tap a tick / the ± buttons. */
  function rulerScale(opts) {
    // opts: value, step, tickW, span, min, labelEvery, decimals, cls, onChange(v)
    const st = { base: opts.value, val: opts.value };
    const lblEvery = opts.labelEvery || 1;
    const fmt = opts.fmt || (v => opts.decimals ? v.toFixed(opts.decimals) : String(+v.toFixed(2)));
    const wrap = el('div', 'ks-ruler' + (opts.cls ? ' ' + opts.cls : ''));
    wrap.appendChild(el('i', 'ks-ind'));
    const strip = el('div', 'ks-strip');
    wrap.appendChild(strip);

    const idxOf = v => Math.round((v - (st.base - opts.span * opts.step)) / opts.step);
    const offFor = v => -(idxOf(v) * opts.tickW + opts.tickW / 2);
    let suppress = false;

    const build = () => {
      strip.innerHTML = '';
      const majorEvery = opts.majorEvery || 5;
      for (let d = -opts.span; d <= opts.span; d++) {
        const v = +(st.base + d * opts.step).toFixed(3);
        const ok = v >= (opts.min ?? 0);
        const stepsFromZero = Math.round(v / opts.step);
        const t = el('button', 'ks-tick' + (ok ? '' : ' void'));
        t.style.width = opts.tickW + 'px';
        t.dataset.v = v;
        /* below the floor there is no weight to show — the strip keeps its
           spacing but draws nothing, rather than a row of dashes */
        if (ok) {
          t.appendChild(el('i', stepsFromZero % majorEvery === 0 ? 'h20' : (stepsFromZero % 2 ? 'h11' : 'h15')));
          t.dataset.lbl = stepsFromZero % lblEvery === 0 ? fmt(v) : '';
          t.appendChild(el('span', 'num', t.dataset.lbl));
          t.onclick = () => { if (suppress) return; setVal(v, true); };
        } else {
          t.dataset.lbl = '';
          t.appendChild(el('span', 'num', ''));
        }
        strip.appendChild(t);
      }
      mark();
    };
    const mark = () => {
      [...strip.children].forEach(t => {
        const sel = Math.abs(+t.dataset.v - st.val) < opts.step / 2;
        t.classList.toggle('sel', sel);
        // the selected tick is always labelled; others follow the every-Nth rule
        t.lastChild.textContent = sel ? fmt(+t.dataset.v) : t.dataset.lbl;
      });
    };
    const slide = anim => {
      strip.style.transition = anim ? 'transform .18s ease-out' : 'none';
      strip.style.transform = `translateX(${offFor(st.val)}px)`;
    };
    const setVal = (v, anim) => {
      v = Math.max(opts.min ?? 0, +v.toFixed(3));
      if (v !== st.val) haptic();
      st.val = v;
      opts.onChange(v);
      /* a typed number can fall between the ticks of the current grid; the
         needle must never park on a neighbour while the readout says
         otherwise, so the strip is rebuilt with the value as a tick of its
         own. Also rebuild when the value drifts near the strip's edge. */
      const k = (v - st.base) / opts.step;
      const offGrid = Math.abs(k - Math.round(k)) > 1e-6;
      if (offGrid || idxOf(v) < 2 || idxOf(v) > 2 * opts.span - 2) {
        st.base = v; build(); slide(false);
      } else { mark(); slide(anim); }
    };

    // drag like a real scale — a haptic tick per detent.
    // touch-action none: the browser must never hesitate between our drag
    // and a page scroll, which is what made horizontal drags laggy.
    let sx = null, so = 0, lastN = 0;
    wrap.style.touchAction = 'none';
    wrap.addEventListener('pointerdown', e => {
      sx = e.clientX; so = offFor(st.val); lastN = 0;
      strip.style.transition = 'none';
      wrap.setPointerCapture(e.pointerId);
    });
    /* the strip is finite but the drag must not be: nearing either end it
       rebases around the value under the needle and rebuilds, shifting its
       own offset by the same amount so the motion never stutters */
    const idxAt = x => (-x - opts.tickW / 2) / opts.tickW;
    wrap.addEventListener('pointermove', e => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      let x = so + dx;
      const idx = idxAt(x);
      if (idx < 3 || idx > 2 * opts.span - 3) {
        const vNow = st.base + (idx - opts.span) * opts.step;
        const bNew = Math.max(opts.min ?? 0, +(Math.round(vNow / opts.step) * opts.step).toFixed(3));
        if (bNew !== st.base) {
          so += (bNew - st.base) / opts.step * opts.tickW;
          st.base = bNew;
          build();
          strip.style.transition = 'none';
          x = so + dx;
        }
      }
      strip.style.transform = `translateX(${x}px)`;
      const n = Math.round(dx / opts.tickW);
      if (n !== lastN) { lastN = n; haptic(); }
    });
    const endDrag = e => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) < (opts.dragOnly ? 14 : 5)) {
        // dragOnly scales ignore taps outright — nothing moves without a swipe
        slide(false);
        if (opts.dragOnly) return;
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const tick = t && t.closest ? t.closest('.ks-tick') : null;
        if (tick && tick.dataset.v !== undefined) {
          const v = +tick.dataset.v;
          if (v >= (opts.min ?? 0)) setVal(v, true);
        }
        return;
      }
      suppress = true;
      setTimeout(() => { suppress = false; }, 350);
      /* read the value off the needle's final position — the start point is
         meaningless once the strip has rebased mid-drag */
      setVal(st.base + (Math.round(idxAt(so + dx)) - opts.span) * opts.step, true);
      wrap.setAttribute('aria-valuenow', st.val);
      wrap.setAttribute('aria-valuetext', fmt(st.val) + (opts.unit ? ' ' + opts.unit : ''));
    };
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', () => { if (sx !== null) { sx = null; slide(false); } });

    build();
    slide(false);
    const a11y = a11ySlider(wrap, {
      label: opts.label || 'scale',
      min: opts.min ?? 0,
      now: () => st.val,
      text: () => fmt(st.val) + (opts.unit ? ' ' + opts.unit : ''),
      step: d => setVal(st.val + d * opts.step, true)
    });
    return { el: wrap, setVal: v => { setVal(v, true); a11y(); }, get: () => st.val };
  }

  /* The weight scale — expands inside the set row. The ruler runs in whatever
     unit you picked (0.5 kg or 1 lb per notch); kilos are what get stored. */
  /* Turn a big readout into a field. The wheel is for nudging; typing is for
     arriving. Shared by the weight scale and the seconds scale so both behave
     the same way. `unit` is the suffix shown, `fmt` renders the value back
     when the field closes, `apply` receives the number. */
  const PENCIL = 'M8.4 1.1 L10.9 3.6 L4.2 10.3 L1.2 10.9 L1.8 7.9 Z';
  /* The readout with its pencil. The pencil sits in a clay chip rather than
     floating as a hairline glyph — at thumb size it is the thing people
     reach for, so it has to look like a button. */
  function paintReadout(big, text) {
    big.textContent = '';
    big.appendChild(document.createTextNode(text));
    const pen = el('span', 'ks-pen');
    pen.appendChild(svgIcon(PENCIL, 13));
    big.appendChild(pen);
  }
  /* A number pad of the app's own. The system keyboard turned the readout
     into a raw input with selection handles over it — cramped, and nothing
     like the rest of the app. This is a popup with big keys: what you are
     typing stays legible, and nothing beneath it moves. */
  function openNumPad(opts) {
    const pop = $('#num-pop');
    if (!pop) return;
    let buf = '';                       // empty means "still showing the old value"
    const valEl = $('#num-pop-val');
    const show = () => {
      valEl.textContent = buf === '' ? String(opts.value) : buf;
      if (opts.unit) valEl.appendChild(el('small', null, ' ' + opts.unit));
    };
    $('#num-pop-tag').textContent = opts.title;
    show();

    const keys = $('#num-pop-keys');
    keys.innerHTML = '';
    const press = k => {
      haptic();
      if (k === '⌫') buf = buf.slice(0, -1);
      else if (k === '.') { if (!buf.includes('.')) buf = (buf || '0') + '.'; }
      else buf = (buf === '0' ? '' : buf) + k;
      if (buf.replace('.', '').length > 5) buf = buf.slice(0, -1);
      show();
    };
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', opts.decimals === false ? '' : '.', '0', '⌫']
      .forEach(k => {
        const b = el('button', 'np-key' + (k === '⌫' ? ' np-back' : ''), k);
        if (!k) { b.disabled = true; b.className = 'np-key np-blank'; }
        else b.onclick = () => press(k);
        keys.appendChild(b);
      });

    const close = () => { pop.hidden = true; };
    $('#num-pop-cancel').onclick = close;
    pop.onclick = e2 => { if (e2.target === pop) close(); };
    $('#num-pop-ok').onclick = () => {
      const v = buf === '' ? +opts.value : parseFloat(buf);
      close();
      if (isFinite(v) && v >= (opts.min ?? 0) && v <= (opts.max ?? 2000)) opts.apply(v);
    };
    pop.hidden = false;
  }

  function weightScale(lw, cur, ei, si, updateVals) {
    const set = cur.sets[si];
    const box = el('div', 'kg-scale');

    const top = el('div', 'ks-top');
    const big = el('div', 'ks-val num', fmtWn(set.kg));
    top.appendChild(big);
    const deltaEl = el('div', 'ks-delta', setDelta(cur, si));
    top.appendChild(deltaEl);
    box.appendChild(top);

    /* the number is a field as well as a readout — but nothing about a
       number says "tap me", so the controls row carries a button too */
    big.classList.add('tappable');
    paintReadout(big, fmtWn(set.kg));
    const openType = () => openNumPad({
      title: 'Weight', value: fmtKg(toW(set.kg)), unit: wUnit(), min: 0, max: 999,
      apply: v => ruler.setVal(+v.toFixed(2))
    });
    big.onclick = openType;

    const commit = shown => {
      const v = fromW(shown);
      set.kg = v;
      /* the new weight carries forward to the remaining unlogged sets —
         but only its own kind. A lighter W set is deliberately light, and
         must never drag the working weight down with it. */
      for (let j = si + 1; j < cur.sets.length; j++) {
        if (!cur.sets[j].done && !cur.sets[j].warm === !set.warm) cur.sets[j].kg = v;
      }
      live.set(lw);
      updateVals();
      big.firstChild.nodeValue = fmtKg(shown);
      deltaEl.textContent = setDelta(cur, si);
      if (!big.querySelector('.ks-pen')) paintReadout(big, fmtKg(shown));
    };
    const ruler = rulerScale({
      value: +toW(set.kg).toFixed(1), step: jumpW(cur), tickW: 30, span: 14, min: 0,
      label: 'Weight', unit: wUnit(),
      labelEvery: 2, majorEvery: 2, onChange: commit
    });
    box.appendChild(ruler.el);

    coachMark(ruler.el, 'Slide to set the weight. The pencil types it.', 'scale');

    const ctr = el('div', 'ks-controls');
    const openedWith = set.kg;   // for reverting a mistaken change
    const undo = el('button', 'ks-adj ks-reset num', '↺ ' + fmtWn(openedWith));
    undo.title = 'Back to ' + fmtW(openedWith);
    undo.onclick = () => ruler.setVal(+toW(openedWith).toFixed(1));
    const reset = el('button', 'ks-adj ks-reset num', '0');
    reset.title = 'Reset to 0';
    reset.onclick = () => ruler.setVal(0);
    ctr.append(undo, reset);
    const plates = el('div', 'ks-plates');
    wPlates().forEach(p => {
      const b = el('button', 'num', '+' + p);
      b.onclick = () => ruler.setVal(ruler.get() + p);
      plates.appendChild(b);
    });
    ctr.appendChild(plates);
    box.appendChild(ctr);
    return box;
  }

  /* The hold length, on the same sliding scale the weight uses — a held set
     has no weight to set, so the seconds inherit its whole treatment rather
     than being squeezed between two tiny steppers. */
  function timeScale(lw, cur, ei, si, updateVals) {
    const set = cur.sets[si];
    const box = el('div', 'kg-scale');

    const top = el('div', 'ks-top');
    const big = el('div', 'ks-val num tappable', fmtClock(set.reps));
    top.appendChild(big);
    top.appendChild(el('div', 'ks-delta', `target ${fmtRange(cur.repLo, cur.repHi)} s`
      + (cur.perSide ? ' / side' : '')));
    box.appendChild(top);
    paintReadout(big, fmtClock(set.reps));
    /* seconds are typed as seconds, however the clock shows them */
    const openType = () => openNumPad({
      title: 'Hold', value: set.reps, unit: 's', min: 5, max: 3600, decimals: false,
      apply: v => ruler.setVal(Math.round(v))
    });
    big.onclick = openType;

    const commit = v => {
      set.reps = Math.max(5, Math.round(v));
      // the new length carries forward to the sets you have not held yet
      for (let j = si + 1; j < cur.sets.length; j++) {
        if (!cur.sets[j].done) cur.sets[j].reps = set.reps;
      }
      live.set(lw);
      updateVals();
      paintReadout(big, fmtClock(set.reps));
    };
    const ruler = rulerScale({
      label: 'Seconds', unit: 's',
      value: set.reps, step: 5, tickW: 30, span: 14, min: 5,
      labelEvery: 2, majorEvery: 2, fmt: v => fmtClock(v), onChange: commit
    });
    box.appendChild(ruler.el);

    const ctr = el('div', 'ks-controls');
    const openedWith = set.reps;

    const undo = el('button', 'ks-adj ks-reset num', '↺ ' + fmtClock(openedWith));
    undo.title = 'Back to ' + fmtClock(openedWith);
    undo.onclick = () => ruler.setVal(openedWith);
    ctr.appendChild(undo);
    /* three suggestions at most, and they come from this exercise's own
       target rather than a fixed list — a 10 s side plank has no use for a
       one-minute button, and six pills in a row was unreadable anyway */
    const quick = el('div', 'ks-plates');
    const round5 = v => Math.max(5, Math.round(v / 5) * 5);
    [...new Set([round5(cur.repLo), round5(cur.repHi), round5(cur.repHi + 15)])]
      .slice(0, 3)
      .forEach(s => {
        const b = el('button', 'num', fmtClock(s));
        b.onclick = () => ruler.setVal(s);
        quick.appendChild(b);
      });
    ctr.appendChild(quick);
    box.appendChild(ctr);
    return box;
  }

  /* The rep scale — a vertical wheel that expands inside the set row.
     Drag up/down like a dial, or tap a number. */
  function repScale(lw, cur, ei, si, updateVals) {
    const set = cur.sets[si];
    const TICK = 34, SPAN = 8;
    let base = set.reps;
    const box = el('div', 'rep-scale');

    const top = el('div', 'ks-top');
    const big = el('div', 'ks-val num tappable', String(set.reps));
    big.appendChild(el('small', null, ' reps'));
    top.appendChild(big);
    top.appendChild(el('div', 'ks-delta', `Target ${fmtRange(cur.repLo, cur.repHi)}`));
    box.appendChild(top);
    paintReadout(big, String(set.reps));
    big.onclick = () => openNumPad({
      title: 'Reps', value: set.reps, decimals: false, min: 0, max: 500,
      apply: v => setVal(Math.round(v), true)
    });

    const wrap = el('div', 'vs-ruler');
    wrap.appendChild(el('i', 'vs-ind'));
    const strip = el('div', 'vs-strip');
    wrap.appendChild(strip);
    box.appendChild(wrap);
    coachMark(wrap, 'Slide to the reps you got, then tick the set.', 'reps');

    const idxOf = v => Math.round(v - (base - SPAN));
    const offFor = v => -(idxOf(v) * TICK + TICK / 2);
    let suppress = false;
    const build = () => {
      strip.innerHTML = '';
      for (let d = -SPAN; d <= SPAN; d++) {
        const v = base + d;
        const ok = v >= 0;
        const t = el('button', 'vs-tick' + (ok ? '' : ' void'));
        t.dataset.v = v;
        const slot = el('span', 'vs-slot');
        // nothing below zero: no mark, no number, just the spacing
        if (ok) slot.appendChild(el('i', v % 5 === 0 ? 'w20' : (v % 2 ? 'w11' : 'w15')));
        t.appendChild(slot);
        t.appendChild(el('span', 'num', ok ? String(v) : ''));
        if (ok) t.onclick = () => { if (!suppress) setVal(v, true); };
        strip.appendChild(t);
      }
      mark();
    };
    const mark = () => {
      [...strip.children].forEach(t => {
        const v = +t.dataset.v;
        t.classList.toggle('sel', v === set.reps);
        t.classList.toggle('inband', v >= cur.repLo && v <= cur.repHi);
      });
    };
    const slide = anim => {
      strip.style.transition = anim ? 'transform .18s ease-out' : 'none';
      strip.style.transform = `translateY(${offFor(set.reps)}px)`;
    };
    const setVal = (v, anim) => {
      v = Math.max(0, Math.round(v));
      if (v !== set.reps) haptic();
      set.reps = v;
      live.set(lw);
      updateVals();
      big.firstChild.nodeValue = String(v);
      if (idxOf(v) < 2 || idxOf(v) > 2 * SPAN - 2) { base = v; build(); slide(false); }
      else { mark(); slide(anim); }
    };

    // vertical drag, snapping one rep per notch — a haptic tick per detent
    let sy = null, so = 0, lastN = 0;
    wrap.style.touchAction = 'none';
    wrap.addEventListener('pointerdown', e => {
      sy = e.clientY; so = offFor(set.reps); lastN = 0;
      strip.style.transition = 'none';
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e => {
      if (sy === null) return;
      const dy = e.clientY - sy;
      strip.style.transform = `translateY(${so + dy}px)`;
      const n = Math.round(dy / TICK);
      if (n !== lastN) { lastN = n; haptic(); }
    });
    const endDrag = e => {
      if (sy === null) return;
      const dy = e.clientY - sy;
      sy = null;
      if (Math.abs(dy) < 5) {
        // a tap — pointer capture eats the click, so hit-test the tick ourselves
        slide(false);
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const tick = t && t.closest ? t.closest('.vs-tick') : null;
        if (tick && tick.dataset.v !== undefined && +tick.dataset.v >= 0) setVal(+tick.dataset.v, true);
        return;
      }
      suppress = true;
      setTimeout(() => { suppress = false; }, 350);
      setVal(set.reps - Math.round(dy / TICK), true);
    };
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', () => { if (sy !== null) { sy = null; slide(false); } });

    build();
    slide(false);
    return box;
  }

  /* Inline rest timer at the bottom of the active exercise — presets always visible */
  function inlineRest(lw, cur) {
    const resting = !!lw.restEndsAt;
    // a paused session holds its rest rather than dropping it — say so, and
    // show the number it is holding, not the length it would start at
    const held = !resting && lw.pausedAt && lw.restLeft;
    const c = el('div', 'rest-inline' + (resting || held ? ' on' : ''));
    const top = el('div', 'ri-state' + (resting ? ' on' : ''));
    top.appendChild(el('i', 'live-dot' + (resting ? '' : ' idle')));
    const nextEx = lw.advanceAfterRest
      && lw.exercises.find((e2, i) => i > lw.exIndex && !e2.passed);
    top.appendChild(document.createTextNode(resting
      ? (nextEx ? ' Resting · next: ' + nextEx.name : ' Resting')
      : (held ? ' Rest held' : ' Rest timer · ready')));
    c.appendChild(top);

    const mid = el('div', 'rest-mid');
    const t = el('div', 'rest-time num', resting
      ? fmtClock(Math.max(0, Math.ceil((lw.restEndsAt - Date.now()) / 1000)))
      : fmtClock(held ? lw.restLeft : cur.rest));
    t.id = 'rest-time-live';
    mid.appendChild(t);
    /* the only rest control in a session: nudge the running clock, or nudge
       the length the next rest will start at */
    const bump = d => {
      if (lw.restEndsAt) {
        lw.restEndsAt = Math.max(Date.now(), lw.restEndsAt + d * 1000);
        live.set(lw); restTick();
      } else {
        cur.rest = Math.max(15, Math.min(900, cur.rest + d));
        live.set(lw);
        t.textContent = fmtClock(cur.rest);
        note.textContent = cur.rest === restDefault()
          ? `Default ${fmtClock(restDefault())} — change it in Settings`
          : `Default is ${fmtClock(restDefault())} · nudged for this exercise`;
      }
      haptic();
    };
    const m15 = el('button', 'adj num', '−15');
    m15.onclick = () => bump(-15);
    const p15 = el('button', 'adj num', '+15');
    p15.onclick = () => bump(15);
    const act = el('button', 'skip', resting ? 'Skip' : 'Start');
    act.onclick = () => {
      if (resting) { stopRest(); renderWorkout(); }
      else { startRest(cur.rest); renderWorkout(); }
    };
    mid.append(m15, p15, act);
    c.appendChild(mid);

    const bar = el('div', 'rest-bar');
    const fill = el('div');
    fill.id = 'rest-bar-fill';
    fill.style.width = resting ? Math.min(100, ((lw.restEndsAt - Date.now()) / 1000 / lw.restLen) * 100) + '%' : '100%';
    bar.appendChild(fill);
    c.appendChild(bar);

    /* where the number came from, and what changing it here costs you —
       the presets used to live on this card and got picked by accident */
    const note = el('div', 'rest-note');
    note.textContent = resting
      ? `Started at ${fmtClock(lw.restLen)}`
      : held ? 'Holding until you start the session again'
      : (cur.rest === restDefault()
        ? `Default ${fmtClock(restDefault())} — change it in Settings`
        : `Default is ${fmtClock(restDefault())} · nudged for this exercise`);
    c.appendChild(note);

    if (resting) armRestTick();
    return c;
  }

  /* ---------------- adding an exercise mid-session ----------------
     Same three dials as the block builder, because a session you are already
     inside is no place to learn a second way of picking something. What you
     add lands at the end of the rail and is logged like everything else — it
     does not touch the block you are running. */
  let addSets = 3, addExIx = 0, addReps = 3, addSecs = 2, addQuery = '', addGroup = 'All';
  /* set when the exercise form was opened from the dial sheet, so what you
     write goes straight where you were adding it instead of only into the
     library */
  let pickerAfterSave = null;

  /* The dial sheet is used from two places now — a live session and the
     block editor — so it takes what to call itself and what to do with the
     pick, and knows nothing else about either. */
  let addTarget = null;

  function openDialPicker(opts) {
    addTarget = opts;
    sheetBack = opts.back || null;
    addSets = opts.sets || 3;
    addReps = opts.repIx != null ? opts.repIx : 3;
    addExIx = 0; addQuery = ''; addGroup = 'All';
    const h2 = $('#sheet-addex h2');
    if (h2) h2.textContent = opts.title;
    renderDialPicker();
    openSheet('#sheet-addex');
  }

  function renderDialPicker() {
    const root = $('#addex-body');
    const opts = addTarget;
    if (!root || !opts) return;
    root.innerHTML = '';

    /* your own list first — anything you have ever added or written — then
       the rest of the catalog */
    const seen = new Set(exercises.map(e => e.name.toLowerCase()));
    const pool = [
      ...exercises.map(e => ({ name: e.name, group: e.group || 'Other', notes: e.notes, demo: e.demo, mine: true })),
      ...(window.EXERCISE_LIBRARY || []).filter(i => equipOK(i) && !seen.has(i.name.toLowerCase()))
    ];

    const groups = ['All', ...[...new Set(pool.map(x => x.group))].sort()];
    if (!groups.includes(addGroup)) addGroup = 'All';
    const chips = el('div', 'gchip-row');
    groups.forEach(g => {
      const b = el('button', 'gchip' + (g === addGroup ? ' on' : ''), g);
      b.onclick = () => { addGroup = g; addExIx = 0; renderDialPicker(); };
      chips.appendChild(b);
    });
    root.appendChild(chips);

    const find = el('input', 'search-input');
    find.placeholder = 'Search exercises';
    find.value = addQuery;
    find.oninput = () => { addQuery = find.value; addExIx = 0; renderDialPicker(); };
    root.appendChild(find);

    const q = addQuery.trim().toLowerCase();
    const shown = pool.filter(x =>
      (addGroup === 'All' || x.group === addGroup) &&
      (!q || x.name.toLowerCase().includes(q)));
    addExIx = Math.max(0, Math.min(shown.length - 1, addExIx));

    if (!shown.length) {
      root.appendChild(el('div', 'coach-note', 'Nothing matches — clear the search, or write your own below.'));
    } else {
      const wheels = el('div', 'cd-wheels pm-wheels');
      const c1 = el('div', 'cd-col pm-sets');
      c1.appendChild(el('div', 'micro', 'Sets'));
      c1.appendChild(pickerWheel(PM_SETS.map(String), PM_SETS.indexOf(addSets),
        i => { addSets = PM_SETS[i]; }, null,
        i => (PM_SETS[i] % 5 === 0 ? 'w20' : (PM_SETS[i] % 2 ? 'w11' : 'w15'))));
      wheels.appendChild(c1);
      const c2 = el('div', 'cd-col pm-exx');
      c2.appendChild(el('div', 'micro', shown.length === pool.length ? 'Exercise' : `Exercise · ${shown.length}`));
      c2.appendChild(pickerWheel(shown.map(x => x.name), addExIx, i => { addExIx = i; paintPick(); }, 'wide',
        i => (i % 5 === 0 ? 'w20' : (i % 2 ? 'w11' : 'w15')), null,
        i => { const it = shown[i]; if (it) buildThird2(it); }));
      wheels.appendChild(c2);
      const c3 = el('div', 'cd-col pm-reps');
      const repLbl2 = el('div', 'micro', 'Reps');
      c3.appendChild(repLbl2);
      let c3Timed2 = null;
      const buildThird2 = item => {
        const t = isTimedEx(item);
        if (t === c3Timed2) return;
        c3Timed2 = t;
        repLbl2.textContent = t ? 'Seconds' : 'Reps';
        const wheel = t
          ? pickerWheel(PM_SECS.map(r => r.label), addSecs, i => { addSecs = i; }, null,
            i => (i % 2 ? 'w11' : 'w15'))
          : pickerWheel(PM_REPS.map(r => r.label), addReps, i => { addReps = i; }, null,
            i => (i % 2 ? 'w11' : 'w15'));
        if (c3.children.length > 1) c3.replaceChild(wheel, c3.lastChild);
        else c3.appendChild(wheel);
      };
      wheels.appendChild(c3);
      root.appendChild(wheels);

      const hardLine = el('div', 'pm-hard');
      const paintPick = () => {
        hardLine.innerHTML = '';
        const item = shown[addExIx];
        buildThird2(item);
        const h = item && hardshipOf(item);
        if (!h) return;
        hardLine.appendChild(hardChip(item));
        hardLine.appendChild(el('span', 'pm-hard-note', h.note));
      };
      paintPick();
      root.appendChild(hardLine);

      const go = el('button', 'btn-cta big');
      go.style.width = '100%';
      go.textContent = opts.cta;
      go.onclick = async () => {
        const item = shown[addExIx];
        if (!item) return;
        // the pick lands where it belongs, so there is nothing to go back to
        sheetBack = null;
        addTarget = null;
        await opts.onPick(item, addSets, isTimedEx(item) ? PM_SECS[addSecs] : PM_REPS[addReps]);
      };
      root.appendChild(go);
    }

    const own = el('button', 'btn-ghost');
    own.style.width = '100%';
    own.textContent = '＋ Write your own';
    own.onclick = () => {
      const spec = { sets: addSets, reps: PM_REPS[addReps], secs: PM_SECS[addSecs], onPick: opts.onPick };
      pickerAfterSave = spec;
      // cancelling the form drops you back on the dials, not out of everything
      sheetBack = () => { openDialPicker(opts); };
      openExerciseForm(null);
    };
    root.appendChild(own);
  }

