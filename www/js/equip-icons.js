/* ============================================================
   EQUIPMENT ICONS
   One glyph per kit key in a 24-box. Drawn for legibility at 24 pixels:
   few strokes, big shapes, and solid fills where an outline would turn to
   mush. Machines share a seat-and-frame base and are told apart by which
   way the thing moves — arrows out for a press, up for a shoulder press,
   in for a row — because at this size the frames all look alike.
   The picker supplies the <svg>, the colour and the size.
   ============================================================ */
window.EQUIP_ICON = {
  /* ---- free weights & basics ---- */
  // a figure, arms out
  bodyweight: '<circle cx="12" cy="4.4" r="2.4" fill="currentColor" stroke="none"/>'
    + '<path d="M12 7v6.4M4.5 10h15M12 13.4 8 20.5M12 13.4 16 20.5"/>',
  // long bar, fat plates
  barbell: '<path d="M2 12h20"/>'
    + '<rect x="5.4" y="6.6" width="2.6" height="10.8" rx="1" fill="currentColor" stroke="none"/>'
    + '<rect x="16" y="6.6" width="2.6" height="10.8" rx="1" fill="currentColor" stroke="none"/>'
    + '<rect x="8.8" y="8.8" width="1.8" height="6.4" rx=".9" fill="currentColor" stroke="none"/>'
    + '<rect x="13.4" y="8.8" width="1.8" height="6.4" rx=".9" fill="currentColor" stroke="none"/>',
  // short bar, two blocks
  dumbbell: '<path d="M7 12h10"/>'
    + '<rect x="3.2" y="7" width="3.4" height="10" rx="1.4" fill="currentColor" stroke="none"/>'
    + '<rect x="17.4" y="7" width="3.4" height="10" rx="1.4" fill="currentColor" stroke="none"/>',
  // a solid bell under a handle
  kettlebell: '<path d="M9 8.6a3 3 0 0 1 6 0"/>'
    + '<path d="M9.4 9.4c-2.8 1.5-4.4 3.9-4.4 6.5 0 3 2.4 4.7 7 4.7s7-1.7 7-4.7c0-2.6-1.6-5-4.4-6.5z"'
    + ' fill="currentColor" stroke="none"/>',
  // side view: seat slab, backrest, legs
  bench: '<rect x="3" y="10" width="18" height="3" rx="1.2" fill="currentColor" stroke="none"/>'
    + '<path d="M5.6 13.2 4.2 20M18.4 13.2 19.8 20"/><path d="M18 10V5.5"/>',
  // uprights, hooks, a loaded bar sitting on them
  rack: '<path d="M4.6 3.5v17M19.4 3.5v17M2.6 20.5h4M17.4 20.5h4"/>'
    + '<path d="M4.6 9h14.8"/>'
    + '<rect x="7.2" y="6.4" width="2" height="5.2" rx="1" fill="currentColor" stroke="none"/>'
    + '<rect x="14.8" y="6.4" width="2" height="5.2" rx="1" fill="currentColor" stroke="none"/>',
  // a column, a pulley at the top, a handle on the cable
  cable: '<path d="M4.5 3.5v17M2.5 20.5h4"/>'
    + '<circle cx="17" cy="5.5" r="1.9"/><path d="M4.5 5.5h10.6M17 7.4v6.8"/>'
    + '<rect x="13.4" y="14.2" width="7.2" height="2.4" rx="1.2" fill="currentColor" stroke="none"/>',
  // someone hanging off a bar — a bar on its own read as a barbell
  bar: '<path d="M2.5 4.5h19"/>'
    + '<path d="M8.6 4.5v3.4M15.4 4.5v3.4"/>'
    + '<circle cx="12" cy="10" r="2.1"/>'
    + '<path d="M8.6 7.9 12 10.2l3.4-2.3"/>'
    + '<path d="M12 12.1v4.6M12 16.7l-2.6 4.2M12 16.7l2.6 4.2"/>',
  // a band stretched between two handles
  band: '<path d="M7.6 12h8.8" stroke-width="2.2"/>'
    + '<ellipse cx="4.8" cy="12" rx="2.8" ry="3.8"/><ellipse cx="19.2" cy="12" rx="2.8" ry="3.8"/>',
  // a rolled mat, end-on: the cylinder is what people picture
  mat: '<path d="M6.6 6.8h11a5.2 5.2 0 0 1 0 10.4h-11"/>'
    + '<ellipse cx="6.6" cy="12" rx="2.7" ry="5.2"/>'
    + '<ellipse cx="6.6" cy="12" rx=".9" ry="1.7" fill="currentColor" stroke="none"/>',
  ball: '<circle cx="12" cy="12" r="8.4"/>'
    + '<path d="M3.8 9.4c5.2 2.4 11.2 2.4 16.4 0M12 3.6c-2.8 5.2-2.8 11.6 0 16.8"/>',
  // a thick battle rope
  rope: '<path d="M2.5 15.5c2.6 0 2.6-7 5.2-7s2.6 7 5.2 7 2.6-7 5.2-7 2.6 3.5 3.4 5.2" stroke-width="2.4"/>',
  // a wheel on a handle
  wheel: '<circle cx="12" cy="12" r="5.4"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'
    + '<path d="M2.6 12h4M17.4 12h4" stroke-width="2.2"/>',

  /* ---- machines ---- */
  // a treadmill: a deck on wheels with a console arm
  cardio: '<rect x="2.5" y="14.6" width="19" height="2.8" rx="1.4" fill="currentColor" stroke="none"/>'
    + '<circle cx="6.4" cy="19.8" r="1.6"/><circle cx="17.6" cy="19.8" r="1.6"/>'
    + '<path d="M17.4 14.6V5.4h3.2"/>',
  // seat, back, and handles going out: a press
  'm-press': '<path d="M4 20v-6h5v6"/><path d="M4 14h6"/><path d="M10 14V6"/>'
    + '<path d="M12 9h7M12 13h7"/><path d="M16.6 6.6 19.4 9l-2.8 2.4M16.6 10.6 19.4 13l-2.8 2.4"/>',
  // the same seat, handles going up
  'm-shoulder': '<path d="M5 20v-6h6v6"/><path d="M5 14h7"/>'
    + '<path d="M8 12V5M15 12V5"/><path d="M5.6 5 8 2.4 10.4 5M12.6 5 15 2.4 17.4 5"/>',
  // a high bar on a cable, pulled down
  'm-pulldown': '<path d="M3 4h18"/><path d="M5.6 2.6v3M18.4 2.6v3"/>'
    + '<rect x="6" y="9.6" width="12" height="2.4" rx="1.2" fill="currentColor" stroke="none"/>'
    + '<path d="M12 4v5.4"/><path d="M9.4 16.6 12 19.4l2.6-2.8"/><path d="M12 12.6v6.4"/>',
  // seat and a handle pulled in
  'm-row': '<path d="M3 4.5v15M3 12h7"/>'
    + '<path d="M16 20v-6h5v6"/><path d="M14 14h7"/>'
    + '<rect x="10" y="10.8" width="2.4" height="4.4" rx="1.2" fill="currentColor" stroke="none"/>'
    + '<path d="M15.4 9.4 12.6 12l2.8 2.6"/>',
  // an angled sled with a footplate
  'm-legpress': '<path d="M3 7 20 17.4"/><path d="M3 7v4.4M20 17.4v-4.4"/>'
    + '<rect x="5.4" y="14.6" width="7.2" height="2.6" rx="1.2" fill="currentColor" stroke="none"/>'
    + '<path d="M9 17.2v3.2"/>',
  // seat with a lever swinging up
  'm-legext': '<path d="M4 20v-8h7v8"/><path d="M4 12h8"/>'
    + '<path d="M12 12 19 7"/><circle cx="19.6" cy="6.4" r="1.7" fill="currentColor" stroke="none"/>'
    + '<path d="M16.8 3.6 19.8 4.2 19.2 7.2"/>',
  // the same, swinging down
  'm-legcurl': '<path d="M4 4v8h7V4"/><path d="M4 12h8"/>'
    + '<path d="M12 12 19 17"/><circle cx="19.6" cy="17.6" r="1.7" fill="currentColor" stroke="none"/>'
    + '<path d="M16.8 20.4 19.8 19.8 19.2 16.8"/>',
  // a 45-degree pad with a torso over it
  'm-back': '<path d="M3.5 20.5 8 13"/><path d="M5 20.5h5"/>'
    + '<rect x="7.2" y="11" width="5.6" height="2.4" rx="1.2" fill="currentColor" stroke="none"/>'
    + '<path d="M12.8 12.2 18 6.4"/><circle cx="19.4" cy="5" r="1.9" fill="currentColor" stroke="none"/>',
  // a pull-up bar over a kneeling platform
  'm-assist': '<path d="M3 4h18"/><path d="M5.6 4v5M18.4 4v5"/>'
    + '<rect x="8" y="13.6" width="8" height="2.8" rx="1.2" fill="currentColor" stroke="none"/>'
    + '<path d="M12 4v9.4"/><path d="M9 16.4v4M15 16.4v4"/>',
  // a weight stack — the one shape every machine has
  /* ---- the split-out machines ---- */
  // two rails, the bar caught on hooks
  'm-smith': '<path d="M6 3v18M18 3v18"/><path d="M4.5 10.5h15" stroke-width="2.2"/>'
    + '<path d="M6 8v2.5M18 8v2.5"/>',
  // the 45-degree sled with a back pad under it
  'm-hack': '<path d="M4 20 18 6"/><rect x="13.6" y="7.6" width="7" height="3" rx="1.2" transform="rotate(45 17 9)" fill="currentColor" stroke="none"/>'
    + '<path d="M4 20h16"/>',
  // a bench with the hips bridging off it
  'm-hip': '<rect x="3" y="13.5" width="18" height="3" rx="1.2" fill="currentColor" stroke="none"/>'
    + '<path d="M6 13.5V11a6 6 0 0 1 12 0v2.5"/>',
  // two pads closing an arc
  'm-fly': '<path d="M6.5 4.5c-3.4 4.4-3.4 10.6 0 15M17.5 4.5c3.4 4.4 3.4 10.6 0 15"/>'
    + '<circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  // arms rising out to the sides
  'm-latr': '<circle cx="12" cy="5" r="2.2" fill="currentColor" stroke="none"/>'
    + '<path d="M12 8v6M12 9.5 5 6.5M12 9.5l7-3"/><path d="M8 20l4-6 4 6"/>',
  // a forearm curling over a pad
  'm-arms': '<path d="M4 16h9"/><path d="M13 16a5 5 0 0 0 5-5V7" stroke-width="2"/>'
    + '<circle cx="18" cy="5.6" r="1.8" fill="currentColor" stroke="none"/>',
  // a heel up on a block
  'm-calf': '<path d="M4 20h16"/><rect x="13" y="15.5" width="7" height="4.5" rx="1" fill="currentColor" stroke="none"/>'
    + '<path d="M9 20v-5.5l4-3.5"/>',
  // the legs opening against pads
  'm-abd': '<path d="M12 5v5"/><circle cx="12" cy="3.6" r="1.8" fill="currentColor" stroke="none"/>'
    + '<path d="M12 10 6.5 19M12 10l5.5 9"/><path d="M4.5 16.5 8 18M19.5 16.5 16 18"/>',
  // hips over the pad, body swinging up
  'm-ghd': '<rect x="8.5" y="12" width="7" height="3.2" rx="1.4" fill="currentColor" stroke="none"/>'
    + '<path d="M3.5 18.5 9 13M15.5 13c2.5 0 5-2 5.5-5"/>'
    + '<circle cx="21" cy="5.8" r="1.7" fill="currentColor" stroke="none"/>',
  machine: '<rect x="6" y="3.5" width="12" height="17" rx="2"/>'
    + '<rect x="8.4" y="6.4" width="7.2" height="1.9" rx=".9" fill="currentColor" stroke="none"/>'
    + '<rect x="8.4" y="9.4" width="7.2" height="1.9" rx=".9" fill="currentColor" stroke="none"/>'
    + '<rect x="8.4" y="12.4" width="7.2" height="1.9" rx=".9" fill="currentColor" stroke="none"/>'
    + '<path d="M12 3.5v2.9"/>',
  pool: '<path d="M2.5 8c2-1.8 4-1.8 6 0s4 1.8 6 0 4-1.8 6 0" stroke-width="2"/>'
    + '<path d="M2.5 13c2-1.8 4-1.8 6 0s4 1.8 6 0 4-1.8 6 0" stroke-width="2"/>'
    + '<path d="M2.5 18c2-1.8 4-1.8 6 0s4 1.8 6 0 4-1.8 6 0" stroke-width="2"/>'
};
