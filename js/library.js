/* Built-in exercise library — browse and add to "My exercises" with one tap.
   You can attach your own photos/videos to any of these after adding. */
window.EXERCISE_LIBRARY = [
  // ---- Chest ----
  { name: 'Bench Press', group: 'Chest', notes: 'Barbell to mid-chest, elbows ~45°, feet planted, press up and slightly back.' },
  { name: 'Incline Dumbbell Press', group: 'Chest', notes: 'Bench at 30–45°. Press dumbbells up and together, control the descent.' },
  { name: 'Dumbbell Fly', group: 'Chest', notes: 'Slight elbow bend, open arms wide until chest stretch, squeeze back up.' },
  { name: 'Push-Up', group: 'Chest', notes: 'Body in one line, hands under shoulders, chest to floor, full lockout.' },
  { name: 'Cable Crossover', group: 'Chest', notes: 'Step forward, slight lean, bring handles together in an arc, squeeze chest.' },
  { name: 'Chest Dip', group: 'Chest', notes: 'Lean torso forward, elbows out slightly, lower until shoulder stretch.' },
  { name: 'Machine Chest Press', group: 'Chest', notes: 'Seat so handles are at mid-chest. Press smoothly, don’t lock elbows hard.' },

  // ---- Back ----
  { name: 'Pull-Up', group: 'Back', notes: 'Full hang to chin over bar, chest up, pull elbows to ribs.' },
  { name: 'Lat Pulldown', group: 'Back', notes: 'Grip wider than shoulders, pull bar to upper chest, no swinging.' },
  { name: 'Barbell Row', group: 'Back', notes: 'Hinge ~45°, flat back, pull bar to lower ribs, squeeze shoulder blades.' },
  { name: 'Dumbbell Row', group: 'Back', notes: 'One knee and hand on bench, flat back, row to hip, slow negative.' },
  { name: 'Seated Cable Row', group: 'Back', notes: 'Chest tall, pull handle to stomach, shoulders back and down.' },
  { name: 'T-Bar Row', group: 'Back', notes: 'Chest on pad or hinged stance, drive elbows back, squeeze mid-back.' },
  { name: 'Face Pull', group: 'Back', notes: 'Rope at face height, pull towards eyes, elbows high, external rotate.' },
  { name: 'Deadlift', group: 'Back', notes: 'Bar over mid-foot, flat back, push floor away, finish tall with hips.' },
  { name: 'Back Extension', group: 'Back', notes: 'Hinge at hips on the pad, raise torso to straight line, don’t hyperextend.' },

  // ---- Shoulders ----
  { name: 'Overhead Press', group: 'Shoulders', notes: 'Barbell at collarbone, brace core, press overhead to lockout.' },
  { name: 'Dumbbell Shoulder Press', group: 'Shoulders', notes: 'Seated or standing, press dumbbells up without flaring ribs.' },
  { name: 'Lateral Raise', group: 'Shoulders', notes: 'Slight elbow bend, raise to shoulder height, lead with elbows, light weight.' },
  { name: 'Front Raise', group: 'Shoulders', notes: 'Raise dumbbell/plate to eye level with straight arms, no swinging.' },
  { name: 'Rear Delt Fly', group: 'Shoulders', notes: 'Hinge forward, open arms wide, squeeze rear shoulders, light weight.' },
  { name: 'Arnold Press', group: 'Shoulders', notes: 'Start palms facing you, rotate out while pressing overhead.' },
  { name: 'Upright Row', group: 'Shoulders', notes: 'Pull bar/dumbbells to chest height, elbows lead, grip shoulder-width.' },
  { name: 'Shrug', group: 'Shoulders', notes: 'Heavy dumbbells/bar, shoulders straight up to ears, pause, lower slow.' },

  // ---- Arms ----
  { name: 'Barbell Curl', group: 'Arms', notes: 'Elbows pinned at sides, curl up without swinging, full stretch at bottom.' },
  { name: 'Dumbbell Curl', group: 'Arms', notes: 'Alternate or together, supinate wrist on the way up, control down.' },
  { name: 'Hammer Curl', group: 'Arms', notes: 'Neutral grip (palms facing in), curl to shoulder, hits forearm too.' },
  { name: 'Preacher Curl', group: 'Arms', notes: 'Arms on pad, curl with strict form, stretch fully at the bottom.' },
  { name: 'Triceps Pushdown', group: 'Arms', notes: 'Cable rope/bar, elbows pinned, extend fully and squeeze, control up.' },
  { name: 'Skull Crusher', group: 'Arms', notes: 'Lying, lower bar to forehead with still upper arms, extend back up.' },
  { name: 'Overhead Triceps Extension', group: 'Arms', notes: 'Dumbbell overhead with both hands, lower behind head, extend up.' },
  { name: 'Close-Grip Bench Press', group: 'Arms', notes: 'Hands shoulder-width, elbows tucked, press focusing on triceps.' },
  { name: 'Concentration Curl', group: 'Arms', notes: 'Seated, elbow braced on inner thigh, strict slow curls.' },

  // ---- Legs ----
  { name: 'Squat', group: 'Legs', notes: 'Bar on upper back, feet shoulder-width, sit down between hips, drive up.' },
  { name: 'Front Squat', group: 'Legs', notes: 'Bar on front delts, elbows high, torso upright, squat deep.' },
  { name: 'Goblet Squat', group: 'Legs', notes: 'Hold dumbbell at chest, squat deep between knees, chest tall.' },
  { name: 'Leg Press', group: 'Legs', notes: 'Feet shoulder-width on platform, lower to 90°+, don’t lock knees hard.' },
  { name: 'Lunge', group: 'Legs', notes: 'Big step forward, back knee toward floor, push through front heel.' },
  { name: 'Bulgarian Split Squat', group: 'Legs', notes: 'Rear foot on bench, drop straight down, front shin vertical.' },
  { name: 'Romanian Deadlift', group: 'Legs', notes: 'Soft knees, push hips back, bar close to legs, feel hamstring stretch.' },
  { name: 'Leg Extension', group: 'Legs', notes: 'Extend to full lockout, squeeze quads, lower slowly.' },
  { name: 'Leg Curl', group: 'Legs', notes: 'Curl heels to glutes, pause, resist on the way back.' },
  { name: 'Hip Thrust', group: 'Legs', notes: 'Upper back on bench, bar on hips, drive hips to full lockout, squeeze glutes.' },
  { name: 'Calf Raise', group: 'Legs', notes: 'Full stretch at bottom, pause at top, slow reps beat bouncing.' },
  { name: 'Step-Up', group: 'Legs', notes: 'Knee-height box, drive through the top leg, control the way down.' },
  { name: 'Sumo Deadlift', group: 'Legs', notes: 'Wide stance, toes out, grip inside knees, chest up, push floor apart.' },

  // ---- Core ----
  { name: 'Plank', group: 'Core', notes: 'Elbows under shoulders, body in one line, squeeze glutes, breathe. Log seconds as reps.' },
  { name: 'Side Plank', group: 'Core', notes: 'Stacked feet, hips high, hold. Log seconds as reps, both sides.' },
  { name: 'Crunch', group: 'Core', notes: 'Curl shoulder blades off floor, exhale up, don’t pull the neck.' },
  { name: 'Bicycle Crunch', group: 'Core', notes: 'Opposite elbow to knee, slow and controlled, full extension of the free leg.' },
  { name: 'Hanging Leg Raise', group: 'Core', notes: 'Dead hang, raise legs to 90°+ without swinging, lower slow.' },
  { name: 'Russian Twist', group: 'Core', notes: 'Seated lean-back, rotate side to side, add weight to progress.' },
  { name: 'Cable Crunch', group: 'Core', notes: 'Kneel, rope behind head, crunch ribs to hips, hips stay still.' },
  { name: 'Ab Wheel Rollout', group: 'Core', notes: 'From knees, roll out as far as control allows, no sagging hips.' },
  { name: 'Mountain Climbers', group: 'Core', notes: 'Plank position, drive knees to chest fast, hips low.' },
  { name: 'Dead Bug', group: 'Core', notes: 'On back, lower opposite arm and leg, lower back stays flat on floor.' },

  // ---- Cardio ----
  { name: 'Treadmill Run', group: 'Cardio', notes: 'Log minutes as reps. Easy pace = conversation possible; intervals = hard/easy.' },
  { name: 'Cycling', group: 'Cardio', notes: 'Log minutes as reps. Keep cadence ~80–100 rpm.' },
  { name: 'Rowing Machine', group: 'Cardio', notes: 'Legs → back → arms, then reverse. Log minutes or meters as reps.' },
  { name: 'Jump Rope', group: 'Cardio', notes: 'Small hops, wrists do the work. Log seconds or jumps as reps.' },
  { name: 'Stair Climber', group: 'Cardio', notes: 'Log minutes as reps. Stand tall, light grip on rails.' },
  { name: 'Elliptical', group: 'Cardio', notes: 'Log minutes as reps. Push and pull the handles for full body.' },
  { name: 'Swimming', group: 'Cardio', notes: 'Log minutes or laps as reps.' },
  { name: 'HIIT Sprints', group: 'Cardio', notes: 'e.g. 30s all-out / 90s easy. Log rounds as sets, seconds as reps.' },

  // ---- Full body ----
  { name: 'Burpee', group: 'Full body', notes: 'Squat, kick back to plank, push-up, jump up. Steady rhythm.' },
  { name: 'Kettlebell Swing', group: 'Full body', notes: 'Hip hinge, snap hips forward, bell floats to chest height, arms relaxed.' },
  { name: 'Clean and Press', group: 'Full body', notes: 'Explosive pull to shoulders, then press overhead, reset each rep.' },
  { name: 'Thruster', group: 'Full body', notes: 'Front squat straight into overhead press, one fluid motion.' },
  { name: 'Farmer’s Carry', group: 'Full body', notes: 'Heavy dumbbells at sides, walk tall. Log meters or seconds as reps.' },
  { name: 'Wall Ball', group: 'Full body', notes: 'Squat then throw ball to target, catch and repeat in rhythm.' },
  { name: 'Battle Ropes', group: 'Full body', notes: 'Alternating or double waves, athletic stance. Log seconds as reps.' }
];

/* Demo animation slugs (2-frame photos in demos/<slug>/0.jpg + 1.jpg,
   from the public-domain free-exercise-db dataset). */
window.EXERCISE_DEMOS = {
  "Ab Wheel Rollout": "ab-wheel-rollout",
  "Arnold Press": "arnold-press",
  "Back Extension": "back-extension",
  "Barbell Curl": "barbell-curl",
  "Barbell Row": "barbell-row",
  "Battle Ropes": "battle-ropes",
  "Bench Press": "bench-press",
  "Bicycle Crunch": "bicycle-crunch",
  "Bulgarian Split Squat": "bulgarian-split-squat",
  "Cable Crossover": "cable-crossover",
  "Cable Crunch": "cable-crunch",
  "Calf Raise": "calf-raise",
  "Chest Dip": "chest-dip",
  "Clean and Press": "clean-and-press",
  "Close-Grip Bench Press": "close-grip-bench-press",
  "Concentration Curl": "concentration-curl",
  "Crunch": "crunch",
  "Cycling": "cycling",
  "Dead Bug": "dead-bug",
  "Deadlift": "deadlift",
  "Dumbbell Curl": "dumbbell-curl",
  "Dumbbell Fly": "dumbbell-fly",
  "Dumbbell Row": "dumbbell-row",
  "Dumbbell Shoulder Press": "dumbbell-shoulder-press",
  "Elliptical": "elliptical",
  "Face Pull": "face-pull",
  "Farmer's Carry": "farmer-s-carry",
  "Front Raise": "front-raise",
  "Front Squat": "front-squat",
  "Goblet Squat": "goblet-squat",
  "HIIT Sprints": "hiit-sprints",
  "Hammer Curl": "hammer-curl",
  "Hanging Leg Raise": "hanging-leg-raise",
  "Hip Thrust": "hip-thrust",
  "Incline Dumbbell Press": "incline-dumbbell-press",
  "Jump Rope": "jump-rope",
  "Kettlebell Swing": "kettlebell-swing",
  "Lat Pulldown": "lat-pulldown",
  "Lateral Raise": "lateral-raise",
  "Leg Curl": "leg-curl",
  "Leg Extension": "leg-extension",
  "Leg Press": "leg-press",
  "Lunge": "lunge",
  "Machine Chest Press": "machine-chest-press",
  "Mountain Climbers": "mountain-climbers",
  "Overhead Press": "overhead-press",
  "Overhead Triceps Extension": "overhead-triceps-extension",
  "Plank": "plank",
  "Preacher Curl": "preacher-curl",
  "Pull-Up": "pull-up",
  "Push-Up": "push-up",
  "Rear Delt Fly": "rear-delt-fly",
  "Romanian Deadlift": "romanian-deadlift",
  "Rowing Machine": "rowing-machine",
  "Russian Twist": "russian-twist",
  "Seated Cable Row": "seated-cable-row",
  "Shrug": "shrug",
  "Side Plank": "side-plank",
  "Skull Crusher": "skull-crusher",
  "Squat": "squat",
  "Stair Climber": "stair-climber",
  "Step-Up": "step-up",
  "Sumo Deadlift": "sumo-deadlift",
  "T-Bar Row": "t-bar-row",
  "Thruster": "thruster",
  "Treadmill Run": "treadmill-run",
  "Triceps Pushdown": "triceps-pushdown",
  "Upright Row": "upright-row",
  "Wall Ball": "wall-ball"
};
window.EXERCISE_LIBRARY.forEach(item => {
  const d = window.EXERCISE_DEMOS[item.name];
  if (d) item.demo = d;
});

/* Additional exercises used by the starter block */
[
  { name: 'Chest-Supported Row', group: 'Back', notes: 'Chest stays on the pad the whole set — zero spinal load. Drive elbows back, squeeze mid-back.', demo: 'chest-supported-row' },
  { name: 'Machine Shoulder Press', group: 'Shoulders', notes: 'Back flat on the pad, press smoothly overhead, don’t lock out hard.', demo: 'machine-shoulder-press' },
  { name: 'Assisted Pull-Up', group: 'Back', notes: 'Use the assist machine or a band. Full hang to chin over bar, chest up. Or do a lat pulldown.', demo: 'assisted-pull-up' },
  { name: 'Glute Bridge', group: 'Legs', notes: 'On the floor, bodyweight. Drive hips up, squeeze glutes at the top, lower slow. Back stays neutral.', demo: 'glute-bridge' },
  { name: 'Pallof Press', group: 'Core', notes: 'Cable at chest height, press arms straight out and resist the twist. Log reps per side.', demo: 'pallof-press' }
].forEach(item => window.EXERCISE_LIBRARY.push(item));

/* Ready-made starter program (back-friendly, low spinal load) —
   installable with one tap from Today / Plan when no block exists. */
window.STARTER_BLOCK = {
  name: 'Back-Friendly Block',
  weeks: 4,
  days: [
    { name: 'Day A', items: [
      { ex: 'Machine Chest Press', sets: 3, repLo: 8, repHi: 10 },
      { ex: 'Lat Pulldown', sets: 3, repLo: 8, repHi: 10 },
      { ex: 'Dumbbell Shoulder Press', sets: 3, repLo: 8, repHi: 10 },
      { ex: 'Leg Extension', sets: 2, repLo: 12, repHi: 15 },
      { ex: 'Dead Bug', sets: 3, repLo: 8, repHi: 8 }
    ]},
    { name: 'Day B', items: [
      { ex: 'Incline Dumbbell Press', sets: 3, repLo: 8, repHi: 10 },
      { ex: 'Chest-Supported Row', sets: 3, repLo: 8, repHi: 10 },
      { ex: 'Lateral Raise', sets: 3, repLo: 12, repHi: 15 },
      { ex: 'Leg Curl', sets: 2, repLo: 12, repHi: 15 },
      { ex: 'Side Plank', sets: 3, repLo: 15, repHi: 20 }
    ]},
    { name: 'Day C', items: [
      { ex: 'Assisted Pull-Up', sets: 3, repLo: 8, repHi: 10 },
      { ex: 'Machine Shoulder Press', sets: 3, repLo: 8, repHi: 10 },
      { ex: 'Cable Crossover', sets: 3, repLo: 10, repHi: 12 },
      { ex: 'Glute Bridge', sets: 2, repLo: 10, repHi: 12 },
      { ex: 'Pallof Press', sets: 3, repLo: 8, repHi: 10 }
    ]}
  ]
};

/* ---------------------------------------------------------------------------
   Movement map — what each exercise IS, not what it is called.

   Every entry is [pattern, ...stress tags]. The pattern drives substitution
   (swap a lift for another that trains the same job); the tags drive the
   injury filter. Filtering on tags rather than names means a new exercise
   only has to be described once, here or by inference, to be handled.
--------------------------------------------------------------------------- */
window.MOVEMENTS = {
  // chest
  'Bench Press':                 ['hpush', 'shoulder'],
  'Incline Dumbbell Press':      ['hpush', 'shoulder'],
  'Dumbbell Fly':                ['fly', 'shoulder'],
  'Push-Up':                     ['hpush', 'shoulder', 'wrist'],
  'Cable Crossover':             ['fly', 'shoulder'],
  'Chest Dip':                   ['hpush', 'shoulder', 'elbow', 'wrist'],
  'Machine Chest Press':         ['hpush'],
  // back
  'Pull-Up':                     ['vpull', 'overhead', 'shoulder', 'elbow', 'grip'],
  'Lat Pulldown':                ['vpull', 'overhead'],
  'Barbell Row':                 ['hpull', 'hinge', 'spineload'],
  'Dumbbell Row':                ['hpull'],
  'Seated Cable Row':            ['hpull'],
  'T-Bar Row':                   ['hpull', 'hinge', 'spineload'],
  'Face Pull':                   ['delt'],
  'Deadlift':                    ['hinge', 'spineload', 'hinge', 'hip', 'grip'],
  'Back Extension':              ['hinge', 'hinge'],
  // shoulders
  'Overhead Press':              ['vpush', 'overhead', 'shoulder', 'spineload', 'neck'],
  'Dumbbell Shoulder Press':     ['vpush', 'overhead', 'shoulder', 'neck'],
  'Lateral Raise':               ['delt', 'shoulder'],
  'Front Raise':                 ['delt', 'shoulder'],
  'Rear Delt Fly':               ['delt'],
  'Arnold Press':                ['vpush', 'overhead', 'shoulder', 'neck'],
  'Upright Row':                 ['delt', 'shoulder', 'neck'],
  'Shrug':                       ['trap', 'neck', 'spineload', 'grip'],
  // arms
  'Barbell Curl':                ['curl', 'elbow', 'wrist'],
  'Dumbbell Curl':               ['curl', 'elbow'],
  'Hammer Curl':                 ['curl', 'elbow'],
  'Preacher Curl':               ['curl', 'elbow'],
  'Concentration Curl':          ['curl', 'elbow'],
  'Triceps Pushdown':            ['tri', 'elbow'],
  'Skull Crusher':               ['tri', 'elbow', 'shoulder'],
  'Overhead Triceps Extension':  ['tri', 'elbow', 'overhead', 'shoulder'],
  'Close-Grip Bench Press':      ['hpush', 'elbow', 'shoulder', 'wrist'],
  // legs
  'Squat':                       ['squat', 'knee', 'hip', 'spineload'],
  'Front Squat':                 ['squat', 'knee', 'hip', 'spineload', 'wrist', 'shoulder'],
  'Goblet Squat':                ['squat', 'knee', 'hip'],
  'Leg Press':                   ['squat', 'knee', 'hip'],
  'Lunge':                       ['lunge', 'knee', 'hip'],
  'Bulgarian Split Squat':       ['lunge', 'knee', 'hip'],
  'Romanian Deadlift':           ['hinge', 'hinge', 'spineload'],
  'Leg Extension':               ['legiso', 'knee'],
  'Leg Curl':                    ['legiso', 'knee'],
  'Hip Thrust':                  ['bridge', 'hip'],
  'Calf Raise':                  ['calf', 'ankle'],
  'Step-Up':                     ['lunge', 'knee', 'hip'],
  'Sumo Deadlift':               ['hinge', 'spineload', 'hinge', 'hip', 'grip'],
  // core
  'Plank':                       ['corebrace', 'wrist'],
  'Side Plank':                  ['corebrace', 'wrist', 'shoulder'],
  'Crunch':                      ['coreflex', 'spineflex', 'neck'],
  'Bicycle Crunch':              ['coreflex', 'spineflex', 'spinerot', 'neck'],
  'Hanging Leg Raise':           ['coreflex', 'spineflex', 'hip', 'overhead', 'shoulder', 'grip'],
  'Russian Twist':               ['corerot', 'spinerot', 'spineflex'],
  'Cable Crunch':                ['coreflex', 'spineflex'],
  'Ab Wheel Rollout':            ['corebrace', 'spineload', 'wrist', 'shoulder'],
  'Mountain Climbers':           ['corebrace', 'wrist', 'knee', 'hip'],
  'Dead Bug':                    ['corebrace'],
  // cardio
  'Treadmill Run':               ['cardio', 'impact', 'knee', 'ankle'],
  'Cycling':                     ['cardio'],
  'Rowing Machine':              ['cardio', 'hinge', 'knee'],
  'Jump Rope':                   ['cardio', 'impact', 'knee', 'ankle'],
  'Stair Climber':               ['cardio', 'knee', 'hip'],
  'Elliptical':                  ['cardio'],
  'Swimming':                    ['cardio', 'overhead', 'shoulder'],
  'HIIT Sprints':                ['cardio', 'impact', 'knee', 'ankle', 'hip'],
  // full body
  'Burpee':                      ['full', 'impact', 'wrist', 'knee', 'spineflex'],
  'Kettlebell Swing':            ['hinge', 'hinge', 'spineload', 'grip'],
  'Clean and Press':             ['full', 'overhead', 'shoulder', 'spineload', 'hinge', 'wrist', 'knee'],
  'Thruster':                    ['full', 'overhead', 'shoulder', 'spineload', 'knee', 'wrist'],
  'Farmer’s Carry':              ['carry', 'grip'],
  'Wall Ball':                   ['full', 'overhead', 'shoulder', 'knee'],
  'Battle Ropes':                ['full', 'shoulder'],
  // joint-friendly additions
  'Chest-Supported Row':         ['hpull'],
  'Machine Shoulder Press':      ['vpush', 'overhead', 'shoulder'],
  'Assisted Pull-Up':            ['vpull', 'overhead', 'shoulder', 'elbow', 'grip'],
  'Glute Bridge':                ['bridge'],
  'Pallof Press':                ['corebrace']
};

/* Patterns that can stand in for each other when the exact one is ruled out. */
window.MOVE_FAMILY = {
  hpush: 'push', vpush: 'push', fly: 'push', tri: 'push',
  hpull: 'pull', vpull: 'pull', delt: 'pull', trap: 'pull', curl: 'pull',
  squat: 'legs', lunge: 'legs', legiso: 'legs', calf: 'legs',
  hinge: 'legs', bridge: 'legs',
  coreflex: 'core', corerot: 'core', corebrace: 'core', carry: 'core',
  cardio: 'cardio', full: 'full'
};

/* Anything not in the map is read from its name, then its muscle group, so a
   new exercise is described rather than waved through. Order matters —
   "leg curl" must be caught before "curl". */
window.MOVE_INFER = [
  [/leg\s*curl|hamstring curl/i,                    ['legiso', 'knee']],
  [/leg\s*extension|knee extension/i,               ['legiso', 'knee']],
  [/calf|heel raise/i,                              ['calf', 'ankle']],
  [/pull[-\s]?up|chin[-\s]?up|pulldown|lat pull/i,  ['vpull', 'overhead', 'shoulder', 'elbow', 'grip']],
  [/\brow\b/i,                                      ['hpull']],
  [/shrug/i,                                        ['trap', 'neck', 'spineload', 'grip']],
  [/deadlift|good ?morning|hip hinge|kettlebell swing|swing/i, ['hinge', 'hinge', 'spineload', 'hip', 'grip']],
  [/hip thrust|glute bridge|bridge/i,               ['bridge', 'hip']],
  [/split squat|lunge|step[-\s]?up/i,               ['lunge', 'knee', 'hip']],
  [/squat|leg press|hack/i,                         ['squat', 'knee', 'hip', 'spineload']],
  [/overhead press|shoulder press|military|push press|jerk|snatch|handstand/i, ['vpush', 'overhead', 'shoulder', 'neck']],
  [/upright row|lateral raise|front raise|delt|rear fly/i, ['delt', 'shoulder']],
  [/overhead (triceps|tricep|extension)/i,          ['tri', 'elbow', 'overhead', 'shoulder']],
  [/pushdown|skull ?crusher|triceps|tricep|kickback/i, ['tri', 'elbow']],
  [/curl/i,                                         ['curl', 'elbow']],
  [/dip\b/i,                                        ['hpush', 'shoulder', 'elbow', 'wrist']],
  [/push[-\s]?up|press[-\s]?up/i,                   ['hpush', 'shoulder', 'wrist']],
  [/landmine/i,                                     ['vpush', 'shoulder']],
  [/sled|prowler/i,                                 ['cardio', 'knee', 'impact']],
  [/bench|chest press|floor press/i,                ['hpush', 'shoulder']],
  [/fly|flye|crossover|pec deck/i,                  ['fly', 'shoulder']],
  [/plank|dead ?bug|pallof|bird ?dog|hollow/i,      ['corebrace']],
  [/twist|woodchop|rotation/i,                      ['corerot', 'spinerot', 'spineflex']],
  [/crunch|sit[-\s]?up|leg raise|knee raise/i,      ['coreflex', 'spineflex', 'neck']],
  [/carry|farmer|suitcase/i,                        ['carry', 'grip']],
  [/sprint|run|jog|jump|skip|burpee|box jump/i,     ['cardio', 'impact', 'knee', 'ankle']],
  [/cycl|bike|elliptical|swim|walk|stair|erg|rower|rowing machine/i, ['cardio']]
];

/* Last resort: judge by muscle group, erring towards caution. */
window.MOVE_BY_GROUP = {
  Chest: ['hpush', 'shoulder'],
  Back: ['hpull'],
  Shoulders: ['delt', 'shoulder'],
  Arms: ['curl', 'elbow'],
  Legs: ['squat', 'knee', 'hip'],
  Core: ['corebrace', 'spineflex'],
  Cardio: ['cardio', 'impact', 'knee', 'ankle'],
  'Full body': ['full', 'spineload', 'shoulder', 'knee']
};

/* ---------------------------------------------------------------------------
   Equipment — what a lift needs to exist. Owning less is a filter, same as an
   injury: anything asking for kit you have switched off drops out of the
   builder. Bodyweight is always on, so a home setup still has a plan.
--------------------------------------------------------------------------- */
window.EQUIPMENT = [
  { key: 'bodyweight', label: 'Bodyweight', always: true },
  { key: 'barbell',    label: 'Barbell' },
  { key: 'dumbbell',   label: 'Dumbbells' },
  { key: 'kettlebell', label: 'Kettlebell' },
  { key: 'bench',      label: 'Bench' },
  { key: 'rack',       label: 'Rack' },
  { key: 'machine',    label: 'Machine' },
  { key: 'cable',      label: 'Cable' },
  { key: 'bar',        label: 'Pull-up bar' },
  { key: 'band',       label: 'Bands' },
  { key: 'mat',        label: 'Mat' },
  { key: 'ball',       label: 'Ball' },
  { key: 'rope',       label: 'Rope' },
  { key: 'cardio',     label: 'Cardio machine' },
  { key: 'wheel',      label: 'Ab wheel' },
  { key: 'pool',       label: 'Pool' }
];

window.EXERCISE_EQUIP = {
  'Bench Press': ['barbell', 'bench', 'rack'],
  'Incline Dumbbell Press': ['dumbbell', 'bench'],
  'Dumbbell Fly': ['dumbbell', 'bench'],
  'Push-Up': ['bodyweight'],
  'Cable Crossover': ['cable'],
  'Chest Dip': ['bar'],
  'Machine Chest Press': ['machine'],
  'Pull-Up': ['bar'],
  'Lat Pulldown': ['machine'],
  'Barbell Row': ['barbell'],
  'Dumbbell Row': ['dumbbell', 'bench'],
  'Seated Cable Row': ['cable'],
  'T-Bar Row': ['barbell'],
  'Face Pull': ['cable'],
  'Deadlift': ['barbell'],
  'Back Extension': ['machine'],
  'Overhead Press': ['barbell', 'rack'],
  'Dumbbell Shoulder Press': ['dumbbell'],
  'Lateral Raise': ['dumbbell'],
  'Front Raise': ['dumbbell'],
  'Rear Delt Fly': ['dumbbell'],
  'Arnold Press': ['dumbbell'],
  'Upright Row': ['barbell'],
  'Shrug': ['dumbbell'],
  'Barbell Curl': ['barbell'],
  'Dumbbell Curl': ['dumbbell'],
  'Hammer Curl': ['dumbbell'],
  'Preacher Curl': ['bench', 'dumbbell'],
  'Concentration Curl': ['dumbbell', 'bench'],
  'Triceps Pushdown': ['cable'],
  'Skull Crusher': ['barbell', 'bench'],
  'Overhead Triceps Extension': ['dumbbell'],
  'Close-Grip Bench Press': ['barbell', 'bench', 'rack'],
  'Squat': ['barbell', 'rack'],
  'Front Squat': ['barbell', 'rack'],
  'Goblet Squat': ['dumbbell'],
  'Leg Press': ['machine'],
  'Lunge': ['bodyweight'],
  'Bulgarian Split Squat': ['bench'],
  'Romanian Deadlift': ['barbell'],
  'Leg Extension': ['machine'],
  'Leg Curl': ['machine'],
  'Hip Thrust': ['barbell', 'bench'],
  'Calf Raise': ['bodyweight'],
  'Step-Up': ['bench'],
  'Sumo Deadlift': ['barbell'],
  'Plank': ['mat'],
  'Side Plank': ['mat'],
  'Crunch': ['mat'],
  'Bicycle Crunch': ['mat'],
  'Hanging Leg Raise': ['bar'],
  'Russian Twist': ['mat'],
  'Cable Crunch': ['cable'],
  'Ab Wheel Rollout': ['wheel'],
  'Mountain Climbers': ['bodyweight'],
  'Dead Bug': ['mat'],
  'Treadmill Run': ['cardio'],
  'Cycling': ['cardio'],
  'Rowing Machine': ['cardio'],
  'Jump Rope': ['rope'],
  'Stair Climber': ['cardio'],
  'Elliptical': ['cardio'],
  'Swimming': ['pool'],
  'HIIT Sprints': ['bodyweight'],
  'Burpee': ['bodyweight'],
  'Kettlebell Swing': ['kettlebell'],
  'Clean and Press': ['barbell'],
  'Thruster': ['barbell'],
  'Farmer’s Carry': ['dumbbell'],
  'Wall Ball': ['ball'],
  'Battle Ropes': ['rope'],
  'Chest-Supported Row': ['machine'],
  'Machine Shoulder Press': ['machine'],
  'Assisted Pull-Up': ['machine'],
  'Glute Bridge': ['mat'],
  'Pallof Press': ['cable']
};

/* Same idea as the movement tags: an exercise typed in by hand is read from
   its name so it cannot dodge the filter. Unknown means bodyweight, which is
   always available — a guess should never hide something you own. */
window.EQUIP_INFER = [
  [/barbell|bench press|deadlift|squat|clean|snatch|thruster|good ?morning/i, ['barbell']],
  [/dumbbell|db\b|goblet|hammer curl|farmer/i, ['dumbbell']],
  [/kettlebell|kb\b|swing/i, ['kettlebell']],
  [/cable|pushdown|crossover|pallof|pec deck/i, ['cable']],
  [/machine|press machine|pulldown|leg press|leg curl|leg extension|assisted/i, ['machine']],
  [/pull[-\s]?up|chin[-\s]?up|hanging|dip\b/i, ['bar']],
  [/band|resistance band/i, ['band']],
  [/treadmill|cycl|bike|elliptical|stair|erg|rowing machine/i, ['cardio']],
  [/rope/i, ['rope']],
  [/wall ball|med(icine)? ball|slam ball/i, ['ball']],
  [/ab wheel|rollout/i, ['wheel']],
  [/swim/i, ['pool']],
  [/plank|crunch|sit[-\s]?up|dead ?bug|bird ?dog|bridge|twist/i, ['mat']],
  [/bench|step[-\s]?up|split squat|preacher/i, ['bench']]
];
