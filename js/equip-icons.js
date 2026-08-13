/* ============================================================
   EQUIPMENT ICONS
   One line-art glyph per kit key, drawn in the same 24-box and the same
   1.7 stroke as the rest of the app's icons. Paths only — the picker
   supplies the <svg> wrapper, the colour and the size.
   ============================================================ */
window.EQUIP_ICON = {
  /* ---- free weights & basics ---- */
  // a standing figure, arms out: nothing but you
  bodyweight: '<circle cx="12" cy="4.6" r="2.2"/><path d="M12 6.8v7M4 10.5h16M12 13.8 8.5 20M12 13.8 15.5 20"/>',
  // long bar, a plate each side
  barbell: '<path d="M2.4 12h19.2"/><path d="M6.6 7.6v8.8M9 9.2v5.6M15 9.2v5.6M17.4 7.6v8.8"/>',
  // two short bars
  dumbbell: '<path d="M7.5 12h9"/><path d="M4.6 8.4v7.2M7.2 9.8v4.4M16.8 9.8v4.4M19.4 8.4v7.2"/>',
  // bell with a handle
  kettlebell: '<path d="M9.2 8.4a2.8 2.8 0 1 1 5.6 0"/><path d="M9 8.4c-2.6 1.4-4 3.7-4 6.4 0 3 2.2 4.6 7 4.6s7-1.6 7-4.6c0-2.7-1.4-5-4-6.4z"/>',
  // a flat pad on legs
  bench: '<path d="M3 10.5h18v2.2H3z"/><path d="M5.6 12.7 4.4 19M18.4 12.7 19.6 19"/>',
  // two uprights with a bar across
  rack: '<path d="M5 3.5v17M19 3.5v17M5 9h14"/><path d="M3.2 20.5h3.6M17.2 20.5h3.6"/>',
  // a tower with a pulley and a hanging handle
  cable: '<path d="M5 3.5v17M3.2 20.5h3.6"/><circle cx="16" cy="6.5" r="2"/><path d="M5 5h11M16 8.5v6M13.6 14.5h4.8"/>',
  // a bar overhead with two hands on it
  bar: '<path d="M3 6h18"/><path d="M5.5 3.4v5.2M18.5 3.4v5.2"/><path d="M9 6v4.5a3 3 0 0 0 6 0V6"/>',
  // a loop band with a grip at each end — a plain ellipse with a bar through
  // it read as a "no entry" sign
  band: '<path d="M3.5 12c0-2.3 2.6-4.2 6-4.2h5c3.4 0 6 1.9 6 4.2s-2.6 4.2-6 4.2h-5c-3.4 0-6-1.9-6-4.2z"/><path d="M9 8.2v7.6M15 8.2v7.6"/>',
  // a rolled mat
  mat: '<path d="M6 5.5h13a2.5 2.5 0 0 1 0 5H6z"/><path d="M6 5.5a2.5 2.5 0 0 0 0 5"/><path d="M6 10.5v8h13v-8"/>',
  ball: '<circle cx="12" cy="12" r="8.4"/><path d="M3.8 9.6c5 2.2 11.4 2.2 16.4 0M12 3.6c-2.6 5-2.6 11.8 0 16.8"/>',
  // a coiled climbing rope
  rope: '<path d="M8 3.5c0 3.5 8 3.5 8 7s-8 3.5-8 7 8 3.5 8 6"/>',
  // a wheel with two grips
  wheel: '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/><path d="M2.8 12h4.2M17 12h4.2"/>',

  /* ---- machines ---- */
  // a treadmill deck
  cardio: '<path d="M3 17.5h18"/><path d="M4.5 17.5 6.5 8h11l2 9.5"/><path d="M7.6 12.5h8.8"/>',
  // a seat and two press arms
  'm-press': '<path d="M6 20v-5.5h5V20"/><path d="M6 14.5h12"/><path d="M18 14.5V5"/><path d="M14 8.5h6M14 11.5h6"/>',
  // a seat with arms going up
  'm-shoulder': '<path d="M6 20v-6h6v6"/><path d="M6 14h10"/><path d="M9 14V7M15 14V7"/><path d="M7.4 7h3.2M13.4 7h3.2"/>',
  // a high pulley and a wide bar
  'm-pulldown': '<path d="M4 4.5h16"/><path d="M6.5 3v3M17.5 3v3"/><path d="M12 6v4"/><path d="M12 10 8 20M12 10l4 10"/>',
  // a seat and a handle pulled in
  'm-row': '<path d="M3 4.5v15"/><path d="M3 12h9"/><path d="M12 9.5v5"/><path d="M15 19.5v-5h6v5"/><path d="M15 14.5V12"/>',
  // a sled on rails
  'm-legpress': '<path d="M3.5 6.5 20.5 17"/><path d="M3.5 6.5v4M20.5 17v-4"/><path d="M6.5 16.5h6.5v4H6.5z"/>',
  // a seat with a pad swinging up
  'm-legext': '<path d="M4 19v-8h7v8"/><path d="M4 11h9"/><path d="M13 11l6-4"/><path d="M17.4 5.4l3 2.4"/>',
  // the same, swinging down
  'm-legcurl': '<path d="M4 6v8h7V6"/><path d="M4 14h9"/><path d="M13 14l6 4"/><path d="M17.4 19.6l3-2.4"/>',
  // a hip pad and a torso hinging over it
  'm-back': '<path d="M4 20.5 9 12"/><path d="M9 12h5"/><path d="M14 12l5-6"/><circle cx="20.4" cy="4.6" r="1.6"/><path d="M6 12h6"/>',
  // a pull-up bar with a kneeling pad
  'm-assist': '<path d="M4 4.5h16"/><path d="M7 4.5v4M17 4.5v4"/><path d="M9 13.5h6v3H9z"/><path d="M12 8.5v5"/>',
  // a generic frame with a weight stack
  machine: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 8h4M8 11h4M8 14h4"/><path d="M16 8v8"/>',
  // water
  pool: '<path d="M3 8.5c1.8-1.6 3.6-1.6 5.4 0s3.6 1.6 5.4 0 3.6-1.6 5.4 0"/><path d="M3 13c1.8-1.6 3.6-1.6 5.4 0s3.6 1.6 5.4 0 3.6-1.6 5.4 0"/><path d="M3 17.5c1.8-1.6 3.6-1.6 5.4 0s3.6 1.6 5.4 0 3.6-1.6 5.4 0"/>'
};
