/* Front and back body diagrams for the "muscles worked" panel.

   Every muscle in the taxonomy from exercise-content.json gets its own shape,
   cut roughly to the real thing: the pecs fan out from the sternum, the lats
   sweep from armpit to lumbar, the quads are three heads with the teardrop low
   on the inside, the abs are segmented. Enough that a glance reads as anatomy
   rather than a blob chart.

   Each shape carries data-m="<muscle id>". app.js only adds classes; nothing
   here knows anything about exercises.

   Canvas is 200x440 — roughly eight heads tall, centre line at x=100. Shapes
   are written for the left side and mirrored, so the figure stays symmetric. */
(() => {
  const CX = 100;
  const P = (m, d) => `<path data-m="${m}" d="${d}"/>`;
  /* a shape and its mirror image, both tagged with the same muscle */
  const M2 = (m, d) => P(m, d)
    + `<path data-m="${m}" d="${d}" transform="translate(${2 * CX} 0) scale(-1 1)"/>`;
  const skin = d => `<path class="an-skin" d="${d}"/>`;
  const skin2 = d => skin(d)
    + `<path class="an-skin" d="${d}" transform="translate(${2 * CX} 0) scale(-1 1)"/>`;

  /* ---- the body underneath ---- */
  const ARM_L = 'M49 119 C41 126 37 142 36 162 C35 184 34 198 33 210'
    + ' C32 232 31 252 31 266 C31 276 35 282 40 282 C45 282 48 276 48 266'
    + ' C49 248 51 230 53 212 C55 192 57 172 59 154 L59 127 Z';
  const LEG_L = 'M77 226 C71 242 67 264 67 288 C67 308 69 322 71 338'
    + ' C73 362 75 388 76 412 C76 422 81 426 86 426 C91 426 94 422 94 412'
    + ' C95 388 96 362 97 338 L97 226 Z';
  const SKIN = '<ellipse class="an-skin" cx="100" cy="38" rx="18" ry="22"/>'
    + skin('M90 54 h20 v30 h-20 z')
    + skin('M100 78 C86 78 74 84 66 94 C56 101 50 111 49 123'
      + ' L53 152 C59 170 63 183 65 197 C67 211 71 219 77 226 L123 226'
      + ' C129 219 133 211 135 197 C137 183 141 170 147 152 L151 123'
      + ' C150 111 144 101 134 94 C126 84 114 78 100 78 Z')
    + skin2(ARM_L) + skin2(LEG_L);

  /* ---- front ---- */
  const FRONT = SKIN
    + M2('neck_flexors', 'M92 60 C96 58 99 58 99 58 L99 82 C95 82 92 78 92 72 Z')
    + M2('anterior_deltoid', 'M53 101 C45 107 41 119 42 131 C49 136 57 133 61 127 C61 115 59 105 53 101 Z')
    + M2('lateral_deltoid', 'M42 131 C37 136 35 148 37 158 C43 161 49 156 51 149 C51 141 47 134 42 131 Z')
    + M2('pectoralis_upper', 'M99 96 C90 96 81 99 73 104 C71 107 70 110 70 113 C79 109 89 107 99 107 Z')
    + M2('pectoralis_major', 'M99 107 C88 107 78 111 70 118 C74 127 82 135 92 139 C95 140 98 140 99 139 Z')
    + M2('pectoralis_lower', 'M99 140 C93 141 87 139 82 136 C86 145 92 150 99 150 Z')
    + M2('biceps_brachii', 'M53 153 C46 157 42 171 42 185 C42 195 45 203 50 206 C55 204 58 195 58 183 C58 169 57 158 53 153 Z')
    + M2('brachialis', 'M42 185 C39 190 38 198 39 206 C42 208 45 207 46 203 C45 195 44 189 42 185 Z')
    + M2('brachioradialis', 'M39 208 C35 214 33 226 33 238 C36 242 41 240 43 234 C43 222 42 213 39 208 Z')
    + M2('forearm_flexors', 'M43 234 C41 246 39 260 39 270 C42 274 47 272 48 266 C49 254 48 242 46 235 Z')
    /* deep, so it goes down before the segmented rectus covers it */
    + P('transverse_abdominis', 'M79 197 C87 193 113 193 121 197 L121 221 C113 225 87 225 79 221 Z')
    + M2('rectus_abdominis', 'M89 151 C93 149 97 149 99 150 L99 166 C96 167 92 167 89 165 Z')
    + M2('rectus_abdominis', 'M89 169 C93 167 97 167 99 168 L99 184 C96 185 92 185 89 183 Z')
    + M2('rectus_abdominis', 'M89 187 C93 185 97 185 99 186 L99 202 C96 203 92 203 89 201 Z')
    + M2('rectus_abdominis', 'M90 205 C94 203 97 203 99 204 L99 222 C96 223 93 222 91 220 Z')
    + M2('obliques', 'M79 153 C75 161 73 173 73 185 C73 197 75 207 79 215 C85 211 88 201 88 189 C88 175 85 161 79 153 Z')
    + M2('hip_flexors', 'M80 217 C86 215 92 217 96 223 L88 233 C82 231 79 225 80 217 Z')
    /* three heads, the medialis sitting low and inside */
    + M2('quadriceps', 'M77 235 C71 253 69 275 71 297 C75 307 80 306 81 297 C80 273 81 251 83 235 Z')
    + M2('quadriceps', 'M85 233 C81 251 79 276 80 301 C83 313 89 315 92 307 C93 281 91 253 89 235 Z')
    + M2('quadriceps', 'M93 287 C91 297 91 307 94 315 C98 317 100 311 99 301 C98 293 96 289 93 287 Z')
    + M2('adductors', 'M95 233 C93 251 93 273 95 289 C99 291 100 285 100 273 L100 233 Z')
    + M2('tibialis_anterior', 'M81 345 C77 361 75 383 76 401 C79 407 83 405 84 399 C85 379 84 359 83 345 Z');

  /* ---- back ---- */
  const BACK = SKIN
    + M2('neck_extensors', 'M92 60 C96 58 99 58 99 58 L99 82 C95 82 92 78 92 72 Z')
    + M2('trapezius_upper', 'M100 67 C90 69 80 77 70 91 C77 97 87 99 95 97 C98 89 100 77 100 67 Z')
    + M2('trapezius_mid', 'M100 97 C92 99 84 103 78 110 C85 119 93 125 100 127 Z')
    + M2('trapezius_lower', 'M100 128 C94 131 88 138 84 147 C90 156 96 161 100 163 Z')
    + M2('posterior_deltoid', 'M70 92 C60 99 52 111 50 125 C57 131 65 131 70 125 C71 113 71 101 70 92 Z')
    + M2('rotator_cuff', 'M73 105 C67 109 64 117 65 125 C69 129 75 127 77 121 C77 114 76 108 73 105 Z')
    + M2('rhomboids', 'M99 129 C93 131 87 136 83 143 C88 152 94 157 99 158 Z')
    + M2('teres_major', 'M77 131 C71 133 67 139 68 145 C73 149 79 147 81 141 Z')
    + M2('latissimus_dorsi', 'M81 133 C71 141 65 157 63 175 C69 187 81 191 91 185 C95 169 93 149 89 135 Z')
    + M2('erector_spinae', 'M95 141 C92 157 91 179 92 201 C95 207 99 207 99 201 L99 141 Z')
    + M2('triceps_brachii', 'M53 153 C45 159 41 173 41 189 C41 199 45 207 50 209 C55 206 58 196 58 183 C58 169 57 158 53 153 Z')
    + M2('forearm_extensors', 'M41 209 C36 219 33 237 33 253 C33 265 37 273 42 273 C46 271 48 263 47 251 C46 233 44 217 41 209 Z')
    + M2('gluteus_medius', 'M73 201 C67 205 63 213 64 221 C69 227 77 227 81 221 C81 211 78 204 73 201 Z')
    + M2('gluteus_maximus', 'M81 209 C71 215 67 229 69 243 C75 253 89 255 97 247 C99 233 95 217 89 209 Z')
    + M2('hamstrings', 'M75 253 C69 271 67 293 69 313 C73 323 79 321 80 311 C80 289 79 269 80 255 Z')
    + M2('hamstrings', 'M87 253 C85 273 85 295 87 311 C91 319 96 315 95 303 C94 283 92 265 93 253 Z')
    + M2('gastrocnemius', 'M75 337 C70 349 68 367 70 381 C74 389 80 387 81 377 C81 361 79 345 79 337 Z')
    + M2('gastrocnemius', 'M85 337 C84 351 84 367 86 379 C90 387 95 383 94 373 C93 357 90 343 89 337 Z')
    + M2('soleus', 'M75 383 C72 393 72 403 75 411 C80 415 87 413 89 405 C89 395 87 387 85 383 Z');

  const wrap = inner =>
    `<svg class="an-fig" viewBox="0 0 200 440" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

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
