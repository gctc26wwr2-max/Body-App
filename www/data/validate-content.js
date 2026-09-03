#!/usr/bin/env node
/* Validation pass for the exercise content layer.
   Usage: node validate-content.js exercise-library.json exercise-content.json
   Exits non-zero if anything is broken, so it can gate a batch. */

const fs = require('fs');

const [libPath, conPath] = process.argv.slice(2);
if (!libPath || !conPath) {
  console.error('usage: node validate-content.js <exercise-library.json> <exercise-content.json>');
  process.exit(2);
}
const lib = JSON.parse(fs.readFileSync(libPath, 'utf8'));
const con = JSON.parse(fs.readFileSync(conPath, 'utf8'));

const exercises = lib.exercises;
const content = con.content;
const byId = new Map(exercises.map(e => [e.id, e]));
const libIds = new Set(byId.keys());
const conIds = new Set(content.map(c => c.id));

const muscles = new Map(con.muscle_taxonomy.muscles.map(m => [m.id, m]));

const REQUIRED = [
  'id', 'summary', 'description', 'force_type', 'mechanics', 'difficulty',
  'setup', 'execution', 'cues', 'common_mistakes', 'breathing', 'tempo_default',
  'rom_notes', 'safety_notes', 'grip_variations', 'tracking_type', 'log_per_side',
  'typical_rep_ranges', 'rest_seconds', 'warmup_recommended',
  'substitutes', 'regressions', 'progressions', 'media'
];
const ENUMS = {
  force_type: ['push', 'pull', 'static', 'carry'],
  mechanics: ['compound', 'isolation'],
  difficulty: ['beginner', 'intermediate', 'advanced'],
  tracking_type: ['weight_reps', 'bodyweight_reps', 'weighted_bodyweight_reps',
                  'time', 'distance_time', 'reps_only']
};

const errors = [];
const warnings = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

/* ---- coverage both ways ---- */
for (const e of exercises) if (!conIds.has(e.id)) warn(e.id, 'in library, no content entry yet');
for (const c of content) if (!libIds.has(c.id)) err(c.id, 'content entry has no matching library exercise');

const dupes = content.map(c => c.id).filter((id, i, a) => a.indexOf(id) !== i);
[...new Set(dupes)].forEach(id => err(id, 'duplicate content entry'));

for (const c of content) {
  const ex = byId.get(c.id);

  /* ---- required fields ---- */
  for (const f of REQUIRED) {
    const v = c[f];
    if (v === undefined || v === null || v === '' ||
        (Array.isArray(v) && v.length === 0 && f !== 'regressions' && f !== 'progressions')) {
      err(c.id, `missing or empty required field "${f}"`);
    }
  }
  for (const [f, allowed] of Object.entries(ENUMS)) {
    if (c[f] !== undefined && !allowed.includes(c[f])) {
      err(c.id, `${f} "${c[f]}" is not one of ${allowed.join(' | ')}`);
    }
  }

  /* ---- id references ---- */
  for (const field of ['substitutes', 'regressions', 'progressions']) {
    const list = c[field] || [];
    if (!Array.isArray(list)) { err(c.id, `${field} must be an array`); continue; }
    for (const ref of list) {
      if (!libIds.has(ref)) err(c.id, `${field} → "${ref}" does not exist in the library`);
      if (ref === c.id) err(c.id, `${field} lists itself`);
    }
    if (new Set(list).size !== list.length) err(c.id, `${field} has duplicates`);
  }
  if (!(c.substitutes || []).length) err(c.id, 'no substitutes — the injury filter can leave a gap here');

  /* ---- substitutes must share the pattern, or the primary muscles ----
     A swap only has to keep the same job covered. Same pattern is the usual way
     to do that; hitting the same primary muscles is the other. Leg extension for
     leg press crosses the pattern but still trains the quads, so it stands.
     Cross-pattern swaps are still surfaced as warnings — they are deliberate,
     not accidental, and worth being able to see. */
  if (ex) {
    for (const ref of c.substitutes || []) {
      const sub = byId.get(ref);
      if (!sub || sub.pattern === ex.pattern) continue;
      const shared = (ex.primary || []).filter(m => (sub.primary || []).includes(m));
      if (shared.length) {
        warn(c.id, `substitute "${ref}" crosses pattern (${ex.pattern} → ${sub.pattern}) ` +
                   `but shares ${shared.join(', ')}`);
      } else {
        err(c.id, `substitute "${ref}" is pattern "${sub.pattern}", not "${ex.pattern}", ` +
                  `and shares no primary muscle`);
      }
    }
  }

  /* ---- muscle maps: exist, and on the right view ---- */
  const media = c.media || {};
  for (const [field, view] of [['muscle_map_front', 'front'], ['muscle_map_back', 'back']]) {
    const list = media[field] || [];
    if (!Array.isArray(list)) { err(c.id, `media.${field} must be an array`); continue; }
    for (const m of list) {
      const rec = muscles.get(m);
      if (!rec) err(c.id, `media.${field} → "${m}" is not in the muscle taxonomy`);
      else if (rec.view !== view) err(c.id, `"${m}" is a ${rec.view} muscle, listed under ${field}`);
    }
  }
  if (!((media.muscle_map_front || []).length + (media.muscle_map_back || []).length)) {
    err(c.id, 'no muscles mapped on either view');
  }
  if (media.video_url !== '' || media.thumbnail_url !== '') {
    warn(c.id, 'media urls are not empty — expected placeholders for now');
  }

  /* ---- fields that must agree with the library ---- */
  if (ex) {
    if (!!ex.unilateral !== !!c.log_per_side) {
      err(c.id, `log_per_side is ${c.log_per_side} but library says unilateral: ${!!ex.unilateral}`);
    }
    const wantDiff = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' }[ex.skill];
    if (wantDiff && c.difficulty !== wantDiff) {
      warn(c.id, `difficulty "${c.difficulty}" vs library skill ${ex.skill} ("${wantDiff}")`);
    }
  }

  /* ---- shape of the nested bits ---- */
  for (const m of c.common_mistakes || []) {
    if (!m || !m.mistake || !m.fix) err(c.id, 'common_mistakes entry needs both mistake and fix');
  }
  for (const g of c.grip_variations || []) {
    if (!g || !g.name || !g.effect) err(c.id, 'grip_variations entry needs both name and effect');
  }
  for (const f of ['typical_rep_ranges', 'rest_seconds']) {
    const o = c[f] || {};
    for (const goal of ['strength', 'hypertrophy', 'endurance']) {
      if (o[goal] === undefined) err(c.id, `${f} missing "${goal}"`);
    }
  }

  /* ---- depth, measured against the written samples ---- */
  if ((c.setup || []).length < 3) warn(c.id, `only ${(c.setup || []).length} setup steps`);
  if ((c.execution || []).length < 3) warn(c.id, `only ${(c.execution || []).length} execution steps`);
  if ((c.cues || []).length < 3) warn(c.id, `only ${(c.cues || []).length} cues`);
  if ((c.common_mistakes || []).length < 4) warn(c.id, `only ${(c.common_mistakes || []).length} common mistakes`);
  if ((c.description || '').split(/\s+/).length < 35) warn(c.id, 'description is thin (<35 words)');
  for (const m of c.common_mistakes || []) {
    if (/proper form|good form|be careful|use correct/i.test(m.fix || '')) {
      err(c.id, `generic fix: "${m.fix}"`);
    }
  }
}

/* ---- report ---- */
const missing = exercises.filter(e => !conIds.has(e.id)).length;
console.log(`library ${exercises.length} · content ${content.length} · still to write ${missing}`);
console.log(`errors ${errors.length} · warnings ${warnings.length}\n`);
if (errors.length) { console.log('ERRORS'); errors.forEach(e => console.log('  ✗ ' + e)); console.log(''); }
if (warnings.length) {
  const cov = warnings.filter(w => w.includes('no content entry yet'));
  const rest = warnings.filter(w => !w.includes('no content entry yet'));
  if (rest.length) { console.log('WARNINGS'); rest.forEach(w => console.log('  · ' + w)); console.log(''); }
  if (cov.length) console.log(`(${cov.length} library exercises still have no content entry)`);
}
if (!errors.length) console.log('No errors.');
process.exit(errors.length ? 1 : 0);
