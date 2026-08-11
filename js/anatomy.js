/* Front and back body diagrams for the "muscles worked" panel.

   Stylised rather than anatomical: each muscle of the taxonomy in
   exercise-content.json gets one addressable shape, placed roughly where it
   belongs, so a glance tells you which half of the body an exercise trains.
   Every shape carries data-m="<muscle id>"; app.js only adds classes.

   The figure is symmetric, so shapes are written once for the left side and
   mirrored about the centre line. */
(() => {
  const CX = 60;                                   // centre line
  const mirror = x => 2 * CX - x;

  /* an ellipse and its mirror image, both tagged with the same muscle */
  const pairE = (m, x, y, rx, ry, rot) => {
    const one = (cx, r) => `<ellipse data-m="${m}" cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}"`
      + (rot ? ` transform="rotate(${r} ${cx} ${y})"` : '') + '/>';
    return one(x, rot || 0) + one(mirror(x), -(rot || 0));
  };
  /* a path and its mirror; d is written for the left side */
  const pairP = (m, d) => `<path data-m="${m}" d="${d}"/>`
    + `<path data-m="${m}" d="${d}" transform="translate(${2 * CX} 0) scale(-1 1)"/>`;
  const solo = (m, d) => `<path data-m="${m}" d="${d}"/>`;

  /* the body outline everything sits on */
  const SILHOUETTE = `
    <ellipse class="an-skin" cx="60" cy="21" rx="13" ry="15"/>
    <path class="an-skin" d="M52 34 h16 v10 h-16 z"/>
    <path class="an-skin" d="M60 43
      C 40 43 26 48 22 58 C 18 70 14 96 10 128 C 8 138 16 141 19 132
      C 23 112 27 94 31 82 L 31 118 C 31 132 34 140 36 150
      C 38 176 39 210 40 244 C 40 252 52 252 52 244
      C 53 214 55 186 57 164 L 60 164 Z"/>
    <path class="an-skin" d="M60 43
      C 80 43 94 48 98 58 C 102 70 106 96 110 128 C 112 138 104 141 101 132
      C 97 112 93 94 89 82 L 89 118 C 89 132 86 140 84 150
      C 82 176 81 210 80 244 C 80 252 68 252 68 244
      C 67 214 65 186 63 164 L 60 164 Z"/>`;

  const FRONT = SILHOUETTE
    + solo('neck_flexors', 'M53 35 h14 v9 h-14 z')
    + pairE('anterior_deltoid', 32, 57, 11, 12.5)
    + pairE('lateral_deltoid', 23.5, 57, 6.5, 11)
    + solo('pectoralis_upper', 'M43 57 q17 -5 34 0 l0 8 q-17 -4 -34 0 z')
    + pairP('pectoralis_major', 'M43 65 q8 -3 16 0 l0 16 q-8 3 -16 0 z')
    + solo('pectoralis_lower', 'M44 81 q16 4 32 0 l0 7 q-16 4 -32 0 z')
    + pairE('biceps_brachii', 23, 88, 7, 15, 8)
    + pairE('brachialis', 30, 98, 4, 9, 8)
    + pairE('brachioradialis', 19, 114, 5, 13, 8)
    + pairE('forearm_flexors', 14, 128, 5, 15, 8)
    + solo('transverse_abdominis', 'M46 110 h28 v24 h-28 z')
    + solo('rectus_abdominis', 'M51 91 q9 -2 18 0 l0 41 q-9 2 -18 0 z')
    + pairP('obliques', 'M42 93 q6 -2 9 1 l0 36 q-4 3 -9 1 z')
    + pairE('hip_flexors', 51, 141, 8, 7.5)
    + pairE('quadriceps', 46, 173, 13.5, 33)
    + pairE('adductors', 55, 168, 5.5, 25)
    + pairE('tibialis_anterior', 47, 224, 5.5, 21);

  const BACK = SILHOUETTE
    + solo('neck_extensors', 'M53 35 h14 v9 h-14 z')
    + solo('trapezius_upper', 'M38 46 q22 -6 44 0 l-8 12 q-14 -3 -28 0 z')
    + solo('trapezius_mid', 'M45 58 q15 -3 30 0 l-5 15 q-10 -2 -20 0 z')
    + solo('trapezius_lower', 'M50 73 q10 -2 20 0 l-7 19 q-3 -1 -6 0 z')
    + pairE('posterior_deltoid', 32, 57, 11, 12.5)
    + pairE('rotator_cuff', 37, 51, 6, 5.5)
    + solo('rhomboids', 'M47 60 q13 -3 26 0 l-3 13 q-10 -2 -20 0 z')
    + pairE('teres_major', 43, 75, 6, 4.5, 20)
    + pairP('latissimus_dorsi', 'M38 72 q10 2 18 6 l0 30 q-12 -4 -20 -12 z')
    + pairE('erector_spinae', 56.5, 102, 3.5, 27)
    + pairE('triceps_brachii', 23, 88, 7, 16, 8)
    + pairE('forearm_extensors', 16, 120, 5.5, 16, 8)
    + pairE('gluteus_medius', 42, 133, 7, 7)
    + pairE('gluteus_maximus', 50, 142, 11.5, 12.5)
    + pairE('hamstrings', 47, 178, 13, 29)
    + pairE('gastrocnemius', 47, 216, 8, 18)
    + pairE('soleus', 47, 237, 5.5, 11);

  const wrap = inner =>
    `<svg class="an-fig" viewBox="0 0 120 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

  window.BODY_SVG = { front: wrap(FRONT), back: wrap(BACK) };
})();

/* The library records muscles loosely — "lats", "glutes", "core" — while the
   content layer and the diagram use the taxonomy from exercise-content.json.
   This bridges the two so a muscle can be shown as primary rather than merely
   involved. Anything unmapped just falls back to secondary. */
window.MUSCLE_ALIAS = {
  pectorals: ['pectoralis_major'], upper_pectorals: ['pectoralis_upper'], upper_chest: ['pectoralis_upper'],
  lower_pectorals: ['pectoralis_lower'],
  deltoids: ['anterior_deltoid', 'lateral_deltoid', 'posterior_deltoid'],
  shoulders: ['anterior_deltoid', 'lateral_deltoid', 'posterior_deltoid'],
  anterior_deltoid: ['anterior_deltoid'], lateral_deltoid: ['lateral_deltoid'],
  rear_deltoid: ['posterior_deltoid'], rotator_cuff: ['rotator_cuff'],
  biceps: ['biceps_brachii'], brachialis: ['brachialis'], brachioradialis: ['brachioradialis'],
  triceps: ['triceps_brachii'], triceps_long_head: ['triceps_brachii'],
  forearms: ['forearm_flexors', 'forearm_extensors'],
  forearm_flexors: ['forearm_flexors'], forearm_extensors: ['forearm_extensors'],
  lats: ['latissimus_dorsi'], traps: ['trapezius_upper', 'trapezius_mid', 'trapezius_lower'],
  rhomboids: ['rhomboids'], upper_back: ['rhomboids', 'trapezius_mid'],
  spinal_erectors: ['erector_spinae'],
  core: ['rectus_abdominis', 'transverse_abdominis', 'obliques'], obliques: ['obliques'],
  hip_flexors: ['hip_flexors'], glutes: ['gluteus_maximus'], gluteus_medius: ['gluteus_medius'],
  quadriceps: ['quadriceps'], hamstrings: ['hamstrings'], adductors: ['adductors'],
  calves: ['gastrocnemius', 'soleus'], gastrocnemius: ['gastrocnemius'], soleus: ['soleus'],
  tibialis_anterior: ['tibialis_anterior'],
  neck_flexors: ['neck_flexors'], neck_extensors: ['neck_extensors'],
  full_body: []
};
