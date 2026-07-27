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
