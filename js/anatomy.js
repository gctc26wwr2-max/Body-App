/* Front and back body diagrams for the "muscles worked" panel.

   The anatomy is the body model from body-highlighter (MIT, (c) 2020 GV79) —
   see js/anatomy-model.LICENSE. It is hand-drawn and its two halves do not
   match, which reads as something wrong with the body rather than as detail.
   So only its left-hand shapes are kept here, and the right side is the very
   same path reflected at render time — the halves cannot drift apart. The
   outlines run through a closed Catmull-Rom spline first, so every muscle
   belly is curved rather than faceted.

   Drawn in two layers. The model leaves gaps between its muscles and has no
   silhouette of its own, so the same shapes go down first, fattened and dark,
   to form a body behind. The muscles then sit on that, and the gaps read as
   the shadow between them — separation without outlining anything.

   Its regions are coarser than the taxonomy in exercise-content.json: no
   separate upper and lower chest, no split between the three trapezius bands,
   no brachialis apart from the biceps. TAXON_REGION folds the 34 taxonomy
   muscles onto the regions it does draw. The chips under the diagram still
   name the precise muscle.

   Only the top layer carries data-m; app.js adds classes to those. */
(() => {
const FRONT_D = [
  ["chest", ["M29.80 46.53 C29.80 46.53 31.43 55.51 31.43 55.51 C31.43 55.51 40.82 57.96 40.82 57.96 C40.82 57.96 48.16 55.10 48.16 55.10 C48.16 55.10 47.76 42.04 47.76 42.04 C47.76 42.04 37.55 42.04 37.55 42.04 C37.55 42.04 29.80 46.53 29.80 46.53Z"]],
  ["obliques", ["M33.88 78.37 C33.88 78.37 33.06 71.84 33.06 71.84 C33.06 71.84 31.02 63.27 31.02 63.27 C31.02 63.27 32.24 57.14 32.24 57.14 C32.24 57.14 40.82 59.18 40.82 59.18 C40.82 59.18 39.18 63.27 39.18 63.27 C39.18 63.27 39.18 83.67 39.18 83.67 C39.18 83.67 33.88 78.37 33.88 78.37Z"]],
  ["abs", ["M43.67 58.78 C43.67 58.78 48.57 57.14 48.57 57.14 C48.57 57.14 48.98 67.35 48.98 67.35 C48.98 67.35 48.57 84.49 48.57 84.49 C48.57 84.49 48.16 107.35 48.16 107.35 C48.16 107.35 44.49 103.67 44.49 103.67 C44.49 103.67 40.82 91.43 40.82 91.43 C40.82 91.43 40.82 78.37 40.82 78.37 C40.82 78.37 41.22 64.49 41.22 64.49 C41.22 64.49 43.67 58.78 43.67 58.78Z"]],
  ["biceps", ["M16.73 68.16 C16.73 68.16 17.96 71.43 17.96 71.43 C17.96 71.43 22.86 66.12 22.86 66.12 C22.86 66.12 28.98 53.88 28.98 53.88 C28.98 53.88 27.76 49.39 27.76 49.39 C27.76 49.39 20.41 55.92 20.41 55.92 C20.41 55.92 16.73 68.16 16.73 68.16Z"]],
  ["triceps", ["M22.45 69.39 C22.45 69.39 29.80 55.51 29.80 55.51 C29.80 55.51 29.80 60.82 29.80 60.82 C29.80 60.82 22.86 73.06 22.86 73.06 C22.86 73.06 22.45 69.39 22.45 69.39Z"]],
  ["neck", ["M28.98 44.90 C28.98 44.90 30.20 37.14 30.20 37.14 C30.20 37.14 36.33 35.10 36.33 35.10 C36.33 35.10 41.22 30.20 41.22 30.20 C41.22 30.20 44.49 24.49 44.49 24.49 C44.49 24.49 48.98 33.88 48.98 33.88 C48.98 33.88 48.57 39.18 48.57 39.18 C48.57 39.18 37.96 39.59 37.96 39.59 C37.96 39.59 28.98 44.90 28.98 44.90Z"]],
  ["front-deltoids", ["M28.16 47.35 C28.16 47.35 21.22 53.06 21.22 53.06 C21.22 53.06 20.00 47.76 20.00 47.76 C20.00 47.76 20.41 40.82 20.41 40.82 C20.41 40.82 24.49 37.14 24.49 37.14 C24.49 37.14 28.57 37.14 28.57 37.14 C28.57 37.14 26.94 43.27 26.94 43.27 C26.94 43.27 28.16 47.35 28.16 47.35Z"]],
  ["head", ["M42.45 2.86 C42.45 2.86 40.00 11.84 40.00 11.84 C40.00 11.84 42.04 19.59 42.04 19.59 C42.04 19.59 46.12 23.27 46.12 23.27 C46.12 23.27 49.80 25.31 49.80 25.31 C49.80 25.31 54.69 22.45 54.69 22.45 C54.69 22.45 57.55 19.18 57.55 19.18 C57.55 19.18 59.18 10.20 59.18 10.20 C59.18 10.20 57.14 2.45 57.14 2.45 C57.14 2.45 49.80 0.00 49.80 0.00 C49.80 0.00 42.45 2.86 42.45 2.86Z"]],
  ["abductors", ["M47.76 110.61 C47.76 110.61 44.90 125.31 44.90 125.31 C44.90 125.31 42.04 115.92 42.04 115.92 C42.04 115.92 40.41 113.06 40.41 113.06 C40.41 113.06 39.59 107.35 39.59 107.35 C39.59 107.35 37.96 102.45 37.96 102.45 C37.96 102.45 34.69 93.88 34.69 93.88 C34.69 93.88 39.59 92.24 39.59 92.24 C39.59 92.24 41.63 99.18 41.63 99.18 C41.63 99.18 43.67 105.31 43.67 105.31 C43.67 105.31 47.76 110.61 47.76 110.61Z"]],
  ["quadriceps", ["M34.69 98.78 C34.69 98.78 37.14 108.16 37.14 108.16 C37.14 108.16 37.14 127.76 37.14 127.76 C37.14 127.76 34.29 137.14 34.29 137.14 C34.29 137.14 31.02 132.65 31.02 132.65 C31.02 132.65 29.39 120.00 29.39 120.00 C29.39 120.00 28.16 111.43 28.16 111.43 C28.16 111.43 29.39 100.82 29.39 100.82 C29.39 100.82 32.24 94.69 32.24 94.69 C32.24 94.69 34.69 98.78 34.69 98.78Z","M38.78 129.39 C39.25 124.76 37.96 114.08 38.37 112.24 C38.78 110.41 40.20 115.51 41.22 118.37 C42.24 121.22 44.22 126.60 44.49 129.39 C44.76 132.18 43.61 132.31 42.86 135.10 C42.11 137.89 41.09 144.22 40.00 146.12 C38.91 148.03 37.07 147.55 36.33 146.53 C35.58 145.51 35.10 142.86 35.51 140.00 C35.92 137.14 38.30 134.01 38.78 129.39Z","M32.65 138.37 C31.70 142.45 28.84 146.26 26.53 145.71 C24.22 145.17 25.99 142.86 25.71 136.73 C25.44 130.61 25.31 134.83 25.71 127.35 C26.12 119.86 25.71 112.24 26.94 114.29 C28.16 116.33 27.48 125.44 29.39 133.47 C31.29 141.50 33.61 134.29 32.65 138.37Z"]],
  ["knees", ["M33.88 140.00 C33.88 140.00 34.69 143.27 34.69 143.27 C34.69 143.27 35.51 147.35 35.51 147.35 C35.51 147.35 36.33 151.02 36.33 151.02 C36.33 151.02 35.10 156.73 35.10 156.73 C35.10 156.73 29.80 156.73 29.80 156.73 C29.80 156.73 27.35 152.65 27.35 152.65 C27.35 152.65 27.35 147.35 27.35 147.35 C27.35 147.35 30.20 144.08 30.20 144.08 C30.20 144.08 33.88 140.00 33.88 140.00Z"]],
  ["calves", ["M24.90 194.69 C24.90 194.69 27.76 164.90 27.76 164.90 C27.76 164.90 28.16 160.41 28.16 160.41 C28.16 160.41 26.12 154.29 26.12 154.29 C26.12 154.29 24.90 157.55 24.90 157.55 C24.90 157.55 22.45 161.63 22.45 161.63 C22.45 161.63 20.82 167.76 20.82 167.76 C20.82 167.76 22.04 188.16 22.04 188.16 C22.04 188.16 20.82 195.51 20.82 195.51 C20.82 195.51 24.90 194.69 24.90 194.69Z","M35.51 158.37 C36.46 158.98 35.85 161.02 35.92 162.45 C35.99 163.88 36.05 165.31 35.92 166.94 C35.78 168.57 35.24 170.61 35.10 172.24 C34.97 173.88 35.58 175.10 35.10 176.73 C34.63 178.37 32.99 180.27 32.24 182.04 C31.50 183.81 31.50 185.24 30.61 187.35 C29.73 189.46 27.48 194.63 26.94 194.69 C26.39 194.76 27.14 190.14 27.35 187.76 C27.55 185.37 27.96 182.45 28.16 180.41 C28.37 178.37 28.44 177.28 28.57 175.51 C28.71 173.74 28.78 171.70 28.98 169.80 C29.18 167.89 29.59 165.92 29.80 164.08 C30.00 162.24 29.25 159.73 30.20 158.78 C31.16 157.82 34.56 157.76 35.51 158.37Z"]],
  ["forearm", ["M6.12 88.57 C6.12 88.57 10.20 75.10 10.20 75.10 C10.20 75.10 14.69 70.20 14.69 70.20 C14.69 70.20 16.33 74.29 16.33 74.29 C16.33 74.29 19.18 73.47 19.18 73.47 C19.18 73.47 4.49 97.55 4.49 97.55 C4.49 97.55 0.00 100.00 0.00 100.00 C0.00 100.00 6.12 88.57 6.12 88.57Z","M6.94 101.22 C8.37 99.86 11.50 93.47 13.47 90.61 C15.44 87.76 17.41 86.33 18.78 84.08 C20.14 81.84 21.22 79.18 21.63 77.14 C22.04 75.10 24.01 68.23 21.22 71.84 C18.44 75.44 7.28 93.88 4.90 98.78 C2.52 103.67 5.51 102.59 6.94 101.22Z"]]
];

const BACK_D = [
  ["head", ["M50.64 0.00 C50.64 0.00 45.96 0.85 45.96 0.85 C45.96 0.85 40.85 5.53 40.85 5.53 C40.85 5.53 40.43 12.77 40.43 12.77 C40.43 12.77 45.11 20.00 45.11 20.00 C45.11 20.00 55.74 20.00 55.74 20.00 C55.74 20.00 59.15 13.62 59.15 13.62 C59.15 13.62 59.57 4.68 59.57 4.68 C59.57 4.68 55.74 1.28 55.74 1.28 C55.74 1.28 50.64 0.00 50.64 0.00Z"]],
  ["trapezius", ["M44.68 21.70 C44.68 21.70 47.66 21.70 47.66 21.70 C47.66 21.70 47.23 38.30 47.23 38.30 C47.23 38.30 47.66 64.68 47.66 64.68 C47.66 64.68 38.30 53.19 38.30 53.19 C38.30 53.19 35.32 40.85 35.32 40.85 C35.32 40.85 31.06 36.60 31.06 36.60 C31.06 36.60 39.15 33.19 39.15 33.19 C39.15 33.19 43.83 27.23 43.83 27.23 C43.83 27.23 44.68 21.70 44.68 21.70Z"]],
  ["back-deltoids", ["M29.36 37.02 C29.36 37.02 22.98 39.15 22.98 39.15 C22.98 39.15 17.45 44.26 17.45 44.26 C17.45 44.26 18.30 53.62 18.30 53.62 C18.30 53.62 24.26 49.36 24.26 49.36 C24.26 49.36 27.23 46.38 27.23 46.38 C27.23 46.38 29.36 37.02 29.36 37.02Z"]],
  ["upper-back", ["M31.06 38.72 C31.06 38.72 28.09 48.94 28.09 48.94 C28.09 48.94 28.51 55.32 28.51 55.32 C28.51 55.32 34.04 75.32 34.04 75.32 C34.04 75.32 47.23 71.06 47.23 71.06 C47.23 71.06 47.23 66.38 47.23 66.38 C47.23 66.38 36.60 54.04 36.60 54.04 C36.60 54.04 33.62 41.28 33.62 41.28 C33.62 41.28 31.06 38.72 31.06 38.72Z"]],
  ["triceps", ["M26.81 49.79 C26.81 49.79 17.87 55.74 17.87 55.74 C17.87 55.74 14.47 72.34 14.47 72.34 C14.47 72.34 16.60 81.70 16.60 81.70 C16.60 81.70 21.70 63.83 21.70 63.83 C21.70 63.83 26.81 55.74 26.81 55.74 C26.81 55.74 26.81 49.79 26.81 49.79Z","M26.81 58.30 C27.52 58.79 27.45 65.67 26.81 68.51 C26.17 71.35 24.26 73.83 22.98 75.32 C21.70 76.81 19.22 79.08 19.15 77.45 C19.08 75.82 21.28 68.72 22.55 65.53 C23.83 62.34 26.10 57.80 26.81 58.30Z"]],
  ["lower-back", ["M47.66 72.77 C47.66 72.77 34.47 77.02 34.47 77.02 C34.47 77.02 35.32 83.40 35.32 83.40 C35.32 83.40 49.36 102.13 49.36 102.13 C49.36 102.13 46.81 82.98 46.81 82.98 C46.81 82.98 47.66 72.77 47.66 72.77Z"]],
  ["forearm", ["M13.62 75.74 C13.62 75.74 8.94 83.83 8.94 83.83 C8.94 83.83 6.81 93.62 6.81 93.62 C6.81 93.62 0.00 106.38 0.00 106.38 C0.00 106.38 3.83 104.26 3.83 104.26 C3.83 104.26 12.34 88.51 12.34 88.51 C12.34 88.51 15.74 82.98 15.74 82.98 C15.74 82.98 13.62 75.74 13.62 75.74Z","M18.72 79.57 C21.56 75.11 21.77 77.09 22.13 77.87 C22.48 78.65 22.98 80.07 20.85 84.26 C18.72 88.44 11.70 98.94 9.36 102.98 C7.02 107.02 7.52 108.23 6.81 108.51 C6.10 108.79 3.12 109.50 5.11 104.68 C7.09 99.86 15.89 84.04 18.72 79.57Z"]],
  ["gluteal", ["M44.68 99.57 C44.68 99.57 30.21 108.51 30.21 108.51 C30.21 108.51 29.79 118.72 29.79 118.72 C29.79 118.72 31.49 125.96 31.49 125.96 C31.49 125.96 47.23 121.28 47.23 121.28 C47.23 121.28 49.36 114.89 49.36 114.89 C49.36 114.89 44.68 99.57 44.68 99.57Z"]],
  ["adductor", ["M48.09 122.98 C48.09 122.98 44.68 122.98 44.68 122.98 C44.68 122.98 41.28 125.53 41.28 125.53 C41.28 125.53 45.11 144.26 45.11 144.26 C45.11 144.26 48.51 135.74 48.51 135.74 C48.51 135.74 48.94 129.36 48.94 129.36 C48.94 129.36 48.09 122.98 48.09 122.98Z"]],
  ["hamstring", ["M28.94 122.13 C28.94 122.13 31.06 129.36 31.06 129.36 C31.06 129.36 36.60 125.96 36.60 125.96 C36.60 125.96 35.32 135.32 35.32 135.32 C35.32 135.32 34.47 150.21 34.47 150.21 C34.47 150.21 29.36 158.30 29.36 158.30 C29.36 158.30 28.94 146.81 28.94 146.81 C28.94 146.81 27.66 141.28 27.66 141.28 C27.66 141.28 27.23 131.49 27.23 131.49 C27.23 131.49 28.94 122.13 28.94 122.13Z","M38.72 125.53 C39.93 127.30 43.97 139.08 44.26 145.96 C44.54 152.84 41.77 165.67 40.43 166.81 C39.08 167.94 36.74 158.01 36.17 152.77 C35.60 147.52 36.60 139.86 37.02 135.32 C37.45 130.78 37.52 123.76 38.72 125.53Z"]],
  ["knees", ["M34.47 153.19 C34.47 153.19 31.06 159.15 31.06 159.15 C31.06 159.15 33.62 166.38 33.62 166.38 C33.62 166.38 37.45 162.55 37.45 162.55 C37.45 162.55 34.47 153.19 34.47 153.19Z"]],
  ["calves", ["M29.36 160.43 C29.36 160.43 28.51 167.23 28.51 167.23 C28.51 167.23 24.68 179.57 24.68 179.57 C24.68 179.57 23.83 192.77 23.83 192.77 C23.83 192.77 25.53 197.02 25.53 197.02 C25.53 197.02 28.51 193.19 28.51 193.19 C28.51 193.19 29.79 180.00 29.79 180.00 C29.79 180.00 31.91 171.06 31.91 171.06 C31.91 171.06 31.91 166.81 31.91 166.81 C31.91 166.81 29.36 160.43 29.36 160.43Z","M37.45 165.11 C36.81 164.89 36.03 166.52 35.32 167.66 C34.61 168.79 33.90 169.79 33.19 171.91 C32.48 174.04 31.56 177.09 31.06 180.43 C30.57 183.76 29.72 188.65 30.21 191.91 C30.71 195.18 32.62 200.21 34.04 200.00 C35.46 199.79 37.87 195.82 38.72 190.64 C39.57 185.46 39.36 173.19 39.15 168.94 C38.94 164.68 38.09 165.32 37.45 165.11Z"]],
  ["left-soleus", ["M28.51 195.74 C28.51 195.74 30.21 195.74 30.21 195.74 C30.21 195.74 33.62 201.70 33.62 201.70 C33.62 201.70 30.64 220.00 30.64 220.00 C30.64 220.00 28.51 213.62 28.51 213.62 C28.51 213.62 26.81 198.30 26.81 198.30 C26.81 198.30 28.51 195.74 28.51 195.74Z"]],
  ["right-soleus", []]
];

  const MIRROR = 'transform="translate(100 0) scale(-1 1)"';
  /* every shape twice: as drawn, and reflected across the centre line */
  const layer = (list, cls, tagged) => '<g class="' + cls + '">'
    + list.map(([g, ds]) => ds.map(d => {
        const tag = tagged ? 'data-m="' + g + '" ' : '';
        return '<path ' + tag + 'd="' + d + '"/>'
             + '<path ' + tag + MIRROR + ' d="' + d + '"/>';
      }).join('')).join('')
    + '</g>';

  /* a little depth on a lit muscle, so it reads as tissue rather than a flat fill */
  const DEFS = '<defs>'
    + '<linearGradient id="anPri" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#E28C5C"/><stop offset="1" stop-color="#BE5C2D"/></linearGradient>'
    + '<linearGradient id="anSec" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#7C4A31"/><stop offset="1" stop-color="#5C3523"/></linearGradient>'
    + '</defs>';

  const wrap = list => '<svg class="an-fig" viewBox="0 0 100 200" '
    + 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + DEFS
    + layer(list, 'an-base', false) + layer(list, 'an-mus', true) + '</svg>';

  window.BODY_SVG = { front: wrap(FRONT_D), back: wrap(BACK_D) };
})();

/* Taxonomy muscle → the region the model actually draws. Where the model is
   coarser, several muscles land on one region; that region lights up if any of
   them is worked. */
window.TAXON_REGION = {
  pectoralis_major: 'chest', pectoralis_upper: 'chest', pectoralis_lower: 'chest',
  anterior_deltoid: 'front-deltoids', lateral_deltoid: 'front-deltoids',
  posterior_deltoid: 'back-deltoids', rotator_cuff: 'back-deltoids',
  biceps_brachii: 'biceps', brachialis: 'biceps',
  triceps_brachii: 'triceps',
  brachioradialis: 'forearm', forearm_flexors: 'forearm', forearm_extensors: 'forearm',
  latissimus_dorsi: 'upper-back', rhomboids: 'upper-back', teres_major: 'upper-back',
  trapezius_upper: 'trapezius', trapezius_mid: 'trapezius', trapezius_lower: 'upper-back',
  erector_spinae: 'lower-back',
  rectus_abdominis: 'abs', transverse_abdominis: 'abs', obliques: 'obliques',
  gluteus_maximus: 'gluteal', gluteus_medius: 'abductors',
  quadriceps: 'quadriceps', hip_flexors: 'quadriceps',
  hamstrings: 'hamstring', adductors: 'adductor',
  gastrocnemius: 'calves', tibialis_anterior: 'calves',
  soleus: ['left-soleus', 'right-soleus'],
  neck_flexors: 'neck', neck_extensors: 'trapezius'
};

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
