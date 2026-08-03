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

/* Slugs with a real demo video in demos/videos/<slug>.mp4
   (wger.de community, CC-BY-SA 4.0). */
window.EXERCISE_VIDEOS = [
  'assisted-pull-up', 'barbell-curl', 'bench-press', 'calf-raise', 'chest-dip',
  'dumbbell-curl', 'dumbbell-shoulder-press', 'face-pull', 'front-squat',
  'hammer-curl', 'hip-thrust', 'incline-dumbbell-press', 'lateral-raise',
  'leg-curl', 'leg-press', 'lunge', 'machine-shoulder-press',
  'overhead-triceps-extension', 'preacher-curl', 'pull-up', 'rear-delt-fly',
  'romanian-deadlift', 'seated-cable-row', 'shrug', 'skull-crusher',
  'triceps-pushdown'
];

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
