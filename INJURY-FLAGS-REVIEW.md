# Injury-flag review pack

*Generated from the live data (v308). For review by a physiotherapist or S&C coach.*

## What this system does

The user toggles injured areas. Each area maps to a set of stress tags; any
exercise carrying one of those tags is hidden from pickers, ready-made programs,
and the AI catalogue, with a substitute requested instead. The app shows this
disclaimer beside the switch: *"This hides movements that commonly stress the
area. It is a filter, not medical advice — follow your clinician."*

**What to review:** (1) does each area avoid the right tags? (2) is any
exercise missing a tag that should hide it? (3) is any exercise hidden that a
rehabbing user should probably keep? Mark the last column.

## Areas and the tags they avoid

| Area | Hides exercises tagged | Hidden count (of 183) |
|---|---|---|
| Lower back | spineload, hinge, spineflex, spinerot | 50 |
| Shoulder | overhead, shoulder | 77 |
| Knee | knee, impact | 52 |
| Elbow | elbow, grip | 63 |
| Wrist | wrist | 25 |
| Neck | neck, spineflex | 20 |
| Hip | hip, hinge | 70 |
| Ankle | ankle, impact | 17 |

## Tag meanings (as applied)

spineload — axial/compressive spinal load · hinge — loaded hip hinge ·
spineflex — repeated spinal flexion · spinerot — loaded rotation ·
overhead — arms loaded overhead · shoulder — general shoulder stress ·
knee — knee-dominant loading · impact — jumping/running impact ·
elbow / wrist / neck / hip / ankle — joint-specific stress · grip — heavy grip demand (hidden for elbow)

## Evidence notes (desk research, September 2026)

Checked against published guidance per area. The model held up; one change was
made (grip → elbow). Everything below still needs a professional eye — these are
summaries of general guidance, not a clinical judgement about this table.

- **Lower back** — modern reviews caution against *loaded* deep flexion, heavy axial
  load and loaded twisting during symptomatic periods, while noting flexion is not
  inherently injurious and hinges can be therapeutic. Matches our four tags; the
  disclaimer carries the nuance. (MDPI narrative review on deadlifting & spine 2025;
  PMC lifting-styles analysis.)
- **Shoulder** — impingement guidance names overhead pressing, behind-neck work,
  upright rows and deep dips as classic aggravators. All carry our overhead/shoulder
  tags. (NSCA S&C Journal on the upright row; HSS; EmergeOrtho.)
- **Knee (PFP)** — weighted open-chain leg extension and deep loaded flexion are the
  named early-stage aggravators, plus downhill running. Leg Extension carries knee;
  impact covers running. (Physiopedia PFPS; knee-extensor systematic review, PMC.)
- **Elbow (epicondylitis)** — heavy gripping is the consistent aggravator across
  guidance; light wrist curls are actually used in rehab. Change made: the elbow
  area now also avoids grip-tagged movements (26). Reviewer: confirm or trim.
  (InformedHealth/NCBI; Heiden Orthopedics.)
- **Hip (FAI)** — deep flexion under load (deep squats, full-depth leg press, deep
  lunges, rowing strokes) is the aggravating pattern. Leg press and squat family
  carry hip; the rower carries hinge, which the hip area avoids. (Beacon Ortho;
  E3 Rehab.)
- **Ankle** — early-phase guidance avoids impact and unstable landings, with
  progressive return. Matches ankle+impact. (Athletic Edge PT; plyometric-vs-
  resistive RCT, ResearchGate.)

## The flag table — all 183 movements

| Exercise | Flags | Hidden for | Reviewer notes |
|---|---|---|---|
| Ab Wheel Rollout | spineload, wrist, shoulder | Lower back, Shoulder, Wrist | |
| Air Bike | knee, hip, shoulder | Shoulder, Knee, Hip | |
| Arnold Press | overhead, shoulder, neck | Shoulder, Neck | |
| Assisted Dip Machine | shoulder, elbow | Shoulder, Elbow | |
| Assisted Pull-Up | overhead, shoulder, elbow, grip | Shoulder, Elbow | |
| Back Extension | hinge | Lower back, Hip | |
| Band Pull-Apart | shoulder | Shoulder | |
| Barbell Curl | elbow, wrist | Elbow, Wrist | |
| Barbell High Pull | shoulder, hip | Shoulder, Hip | |
| Barbell Row | hinge, spineload | Lower back, Hip | |
| Battle Ropes | shoulder | Shoulder | |
| Belt Squat | knee, hip | Knee, Hip | |
| Bench Dip | shoulder, elbow, wrist | Shoulder, Elbow, Wrist | |
| Bench Press | shoulder | Shoulder | |
| Biceps Curl Machine | elbow | Elbow | |
| Bicycle Crunch | spineflex, spinerot, neck | Lower back, Neck | |
| Bird Dog | — | — | |
| Bodyweight Squat | knee, hip | Knee, Hip | |
| Box Jump | knee, hip, ankle, impact | Knee, Hip, Ankle | |
| Box Squat | knee, hip, spineload | Lower back, Knee, Hip | |
| Broad Jump | knee, hip, ankle, impact | Knee, Hip, Ankle | |
| Bulgarian Split Squat | knee, hip | Knee, Hip | |
| Burpee | impact, wrist, knee, spineflex | Lower back, Knee, Wrist, Neck, Ankle | |
| Cable Biceps Curl | elbow | Elbow | |
| Cable Crossover | shoulder | Shoulder | |
| Cable Crunch | spineflex | Lower back, Neck | |
| Cable External Rotation | shoulder | Shoulder | |
| Cable Glute Kickback | hip | Hip | |
| Cable Lateral Raise | shoulder | Shoulder | |
| Cable Pull-Through | hinge, hip | Lower back, Hip | |
| Cable Woodchop | spinerot | Lower back | |
| Calf Raise | ankle | Ankle | |
| Captain's Chair Knee Raise | hip | Hip | |
| Chest Dip | shoulder, elbow, wrist | Shoulder, Elbow, Wrist | |
| Chest-Supported Row | — | — | |
| Chin-Up | shoulder, elbow, overhead, grip | Shoulder, Elbow | |
| Clean and Press | overhead, shoulder, spineload, hinge, wrist, knee | Lower back, Shoulder, Knee, Wrist, Hip | |
| Close-Grip Bench Press | elbow, shoulder, wrist | Shoulder, Elbow, Wrist | |
| Close-Grip Lat Pulldown | shoulder, elbow, overhead | Shoulder, Elbow | |
| Concentration Curl | elbow | Elbow | |
| Copenhagen Plank | hip | Hip | |
| Crunch | spineflex, neck | Lower back, Neck | |
| Curtsy Lunge | knee, hip, spinerot | Lower back, Knee, Hip | |
| Cycling | — | — | |
| Dead Bug | — | — | |
| Dead Hang | shoulder, grip, overhead | Shoulder, Elbow | |
| Deadlift | spineload, hinge, hip, grip | Lower back, Elbow, Hip | |
| Decline Barbell Bench Press | shoulder, elbow | Shoulder, Elbow | |
| Deficit Deadlift | hinge, hip, knee, spineload, spineflex, grip | Lower back, Knee, Elbow, Neck, Hip | |
| Deficit Push-Up | shoulder, elbow | Shoulder, Elbow | |
| Dumbbell Bench Press | shoulder, elbow | Shoulder, Elbow | |
| Dumbbell Curl | elbow | Elbow | |
| Dumbbell Fly | shoulder | Shoulder | |
| Dumbbell Romanian Deadlift | hinge, hip, grip | Lower back, Elbow, Hip | |
| Dumbbell Row | — | — | |
| Dumbbell Shoulder Press | overhead, shoulder, neck | Shoulder, Neck | |
| Dumbbell Shrug | shoulder, grip | Shoulder, Elbow | |
| Dumbbell Squat | knee, hip, grip | Knee, Elbow, Hip | |
| Elliptical | — | — | |
| EZ-Bar Curl | elbow | Elbow | |
| Face Pull | — | — | |
| Farmer’s Carry | grip | Elbow | |
| Floor Press | shoulder, elbow | Shoulder, Elbow | |
| Front Rack Carry | shoulder, spineload, wrist | Lower back, Shoulder, Wrist | |
| Front Raise | shoulder | Shoulder | |
| Front Squat | knee, hip, spineload, wrist, shoulder | Lower back, Shoulder, Knee, Wrist, Hip | |
| Glute Bridge | — | — | |
| Glute-Ham Raise | hinge, knee, hip | Lower back, Knee, Hip | |
| Goblet Squat | knee, hip | Knee, Hip | |
| Good Morning | hinge, hip, spineload, spineflex | Lower back, Neck, Hip | |
| Hack Squat Machine | knee, hip | Knee, Hip | |
| Hammer Curl | elbow | Elbow | |
| Handstand Push-Up | shoulder, elbow, wrist, overhead | Shoulder, Elbow, Wrist | |
| Hang Clean | hip, knee, shoulder, wrist | Shoulder, Knee, Wrist, Hip | |
| Hanging Leg Raise | spineflex, hip, overhead, shoulder, grip | Lower back, Shoulder, Elbow, Neck, Hip | |
| HIIT Sprints | impact, knee, ankle, hip | Knee, Hip, Ankle | |
| Hip Abduction Machine | hip | Hip | |
| Hip Adduction Machine | hip | Hip | |
| Hip Thrust | hip | Hip | |
| Hip Thrust Machine | hinge, hip | Lower back, Hip | |
| Incline Barbell Bench Press | shoulder, elbow, wrist | Shoulder, Elbow, Wrist | |
| Incline Dumbbell Curl | elbow, shoulder | Shoulder, Elbow | |
| Incline Dumbbell Press | shoulder | Shoulder | |
| Incline Push-Up | shoulder, elbow, wrist | Shoulder, Elbow, Wrist | |
| Incline Treadmill Walk | hip, ankle | Hip, Ankle | |
| Inverted Row | shoulder, elbow, grip | Shoulder, Elbow | |
| Jump Rope | impact, knee, ankle | Knee, Ankle | |
| Kettlebell Clean | hip, shoulder, wrist, grip | Shoulder, Elbow, Wrist, Hip | |
| Kettlebell Snatch | hip, shoulder, overhead, grip | Shoulder, Elbow, Hip | |
| Kettlebell Swing | hinge, spineload, grip | Lower back, Elbow, Hip | |
| Landmine Press | shoulder, elbow | Shoulder, Elbow | |
| Lat Pulldown | overhead | Shoulder | |
| Lateral Lunge | knee, hip | Knee, Hip | |
| Lateral Raise | shoulder | Shoulder | |
| Lateral Raise Machine | shoulder | Shoulder | |
| Leg Curl | knee | Knee | |
| Leg Extension | knee | Knee | |
| Leg Press | knee, hip | Knee, Hip | |
| Leg Press Calf Raise | ankle | Ankle | |
| Low Bar Back Squat | knee, hip, shoulder, spineload | Lower back, Shoulder, Knee, Hip | |
| Lunge | knee, hip | Knee, Hip | |
| Machine Chest Press | — | — | |
| Machine Shoulder Press | overhead, shoulder | Shoulder | |
| Meadows Row | shoulder, elbow, spinerot, grip | Lower back, Shoulder, Elbow | |
| Medicine Ball Slam | shoulder, overhead, spineflex | Lower back, Shoulder, Neck | |
| Mountain Climbers | wrist, knee, hip | Knee, Wrist, Hip | |
| Neck Extension | neck | Neck | |
| Neck Flexion | neck | Neck | |
| Neutral-Grip Pull-Up | shoulder, elbow, overhead, grip | Shoulder, Elbow | |
| Nordic Hamstring Curl | hinge, knee | Lower back, Knee, Hip | |
| Overhead Carry | shoulder, overhead, spineload | Lower back, Shoulder | |
| Overhead Press | overhead, shoulder, spineload, neck | Lower back, Shoulder, Neck | |
| Overhead Triceps Extension | elbow, overhead, shoulder | Shoulder, Elbow | |
| Pallof Press | — | — | |
| Pec Deck / Machine Fly | shoulder | Shoulder | |
| Pendulum Squat | knee, hip | Knee, Hip | |
| Pike Push-Up | shoulder, elbow, wrist, overhead | Shoulder, Elbow, Wrist | |
| Pistol Squat | knee, hip, ankle | Knee, Hip, Ankle | |
| Plank | wrist | Wrist | |
| Power Clean | hip, knee, shoulder, wrist, spineload, impact | Lower back, Shoulder, Knee, Wrist, Hip, Ankle | |
| Power Snatch | hip, knee, shoulder, overhead, impact | Shoulder, Knee, Hip, Ankle | |
| Preacher Curl | elbow | Elbow | |
| Pull-Up | overhead, shoulder, elbow, grip | Shoulder, Elbow | |
| Push Press | shoulder, knee, overhead, spineload | Lower back, Shoulder, Knee | |
| Push-Up | shoulder, wrist | Shoulder, Wrist | |
| Rack Pull | hinge, hip, spineload, grip | Lower back, Elbow, Hip | |
| Rear Delt Fly | — | — | |
| Rear Delt Fly Machine | shoulder | Shoulder | |
| Reverse Curl | elbow, wrist | Elbow, Wrist | |
| Reverse Hyperextension | hinge, hip | Lower back, Hip | |
| Reverse Lunge | knee, hip | Knee, Hip | |
| Reverse Wrist Curl | wrist, elbow | Elbow, Wrist | |
| Romanian Deadlift | hinge, spineload | Lower back, Hip | |
| Rope Climb | shoulder, elbow, grip, overhead | Shoulder, Elbow | |
| Rope Triceps Pushdown | elbow | Elbow | |
| Rotational Med Ball Throw | spinerot | Lower back | |
| Rowing Machine | hinge, knee | Lower back, Knee, Hip | |
| Russian Twist | spinerot, spineflex | Lower back, Neck | |
| Safety Squat Bar Squat | knee, hip, spineload | Lower back, Knee, Hip | |
| Seal Row | shoulder, elbow | Shoulder, Elbow | |
| Seated Cable Row | — | — | |
| Seated Calf Raise | ankle | Ankle | |
| Seated Dumbbell Press | shoulder, elbow, overhead | Shoulder, Elbow | |
| Seated Leg Curl | knee | Knee | |
| Seated Row Machine | shoulder, elbow | Shoulder, Elbow | |
| Seated Z-Press | shoulder, overhead, hip | Shoulder, Hip | |
| Shrug | neck, spineload, grip | Lower back, Elbow, Neck | |
| Side Plank | wrist, shoulder | Shoulder, Wrist | |
| Single-Arm Lat Pulldown | shoulder, elbow, overhead | Shoulder, Elbow | |
| Single-Leg Press | knee, hip | Knee, Hip | |
| Single-Leg Romanian Deadlift | hinge, hip, ankle | Lower back, Hip, Ankle | |
| Sit-Up | hip, spineflex | Lower back, Neck, Hip | |
| Ski Erg | shoulder, overhead, spineflex | Lower back, Shoulder, Neck | |
| Skull Crusher | elbow, shoulder | Shoulder, Elbow | |
| Sled Drag | knee, hip | Knee, Hip | |
| Sled Push | knee, hip, ankle | Knee, Hip, Ankle | |
| Smith Machine Bench Press | shoulder, elbow | Shoulder, Elbow | |
| Smith Machine Split Squat | knee, hip, spineload | Lower back, Knee, Hip | |
| Smith Machine Squat | knee, hip, spineload | Lower back, Knee, Hip | |
| Split Squat | knee, hip | Knee, Hip | |
| Squat | knee, hip, spineload | Lower back, Knee, Hip | |
| Stair Climber | knee, hip | Knee, Hip | |
| Step-Up | knee, hip | Knee, Hip | |
| Stiff-Leg Deadlift | hinge, hip, spineload, spineflex, grip | Lower back, Elbow, Neck, Hip | |
| Straight-Arm Pulldown | shoulder, overhead | Shoulder | |
| Suitcase Carry | shoulder, grip | Shoulder, Elbow | |
| Sumo Deadlift | spineload, hinge, hip, grip | Lower back, Elbow, Hip | |
| Suspension Trainer Row | shoulder, elbow, grip | Shoulder, Elbow | |
| Swimming | overhead, shoulder | Shoulder | |
| T-Bar Row | hinge, spineload | Lower back, Hip | |
| Thruster | overhead, shoulder, spineload, knee, wrist | Lower back, Shoulder, Knee, Wrist | |
| Tibialis Raise | ankle | Ankle | |
| Trap Bar Deadlift | hinge, hip, knee, spineload, grip | Lower back, Knee, Elbow, Hip | |
| Treadmill Run | impact, knee, ankle | Knee, Ankle | |
| Triceps Extension Machine | elbow | Elbow | |
| Triceps Kickback | elbow, spineflex | Lower back, Elbow, Neck | |
| Triceps Pushdown | elbow | Elbow | |
| Turkish Get-Up | shoulder, hip, knee, wrist, overhead | Shoulder, Knee, Wrist, Hip | |
| Upright Row | shoulder, neck | Shoulder, Neck | |
| Walking Lunge | knee, hip, ankle, grip | Knee, Elbow, Hip, Ankle | |
| Wall Ball | overhead, shoulder, knee | Shoulder, Knee | |
| Wall Sit | knee | Knee | |
| Wrist Curl | wrist, elbow | Elbow, Wrist | |

## Open questions from the in-house audit

1. Dumbbell / Single-Leg RDL carry `hinge` (hidden for back and hip) but not `spineload` — is hinge alone the right call for lighter unilateral hinges?
2. `grip` now hides its 26 movements for the elbow area (evidence: heavy grip loads the epicondyles) — confirm, or trim the grip list.
3. Neck area avoids `neck` and `spineflex` — should it also avoid `overhead`?
4. Wrist curls were given `elbow` in this pass (medial epicondyle stress) — confirm.
5. Are any rehab-appropriate movements being hidden that a recovering user should keep (e.g. Cable External Rotation is deliberately NOT hidden for shoulder)? Please scan the kept-vs-hidden split per area, not only the hidden list.
