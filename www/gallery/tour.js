const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/user/Body-App/gallery';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const took = [];
  const shot = async (name, label) => {
    await p.waitForTimeout(650);
    await p.screenshot({ path: `${OUT}/${name}.png` });
    took.push([name, label]);
    console.log('✓', name);
  };
  const goto = () => p.goto('http://localhost:8899/index.html', { waitUntil: 'networkidle' });
  const tab = async t => { await p.click(`.tabbar button:has-text("${t}")`); await p.waitForTimeout(700); };

  // ---------- 1. fresh install ----------
  await goto(); await p.waitForTimeout(900);
  await shot('01-today-empty', 'Today · first run — starter block + empty-state doors');

  // ---------- seed a lived-in world ----------
  await p.evaluate(async () => {
    localStorage.setItem('profile', JSON.stringify({
      name: 'Amin', birth: '1992-03', heightCm: 178, waistCm: 85, neckCm: 39,
      sex: 'male', goal: 'muscle', level: 'mid', sessionMins: 60
    }));
    localStorage.setItem('lastSeen', String(Date.now() - 20 * 3600e3));
    localStorage.setItem('coach.scale', '1'); localStorage.setItem('coach.reps', '1'); localStorage.setItem('coach.rest', '1');
    const lib = window.EXERCISE_LIBRARY || [];
    const pick = n => lib.find(x => x.name === n) || { name: n, group: 'Other', notes: '' };
    const exs = ['Goblet Squat', 'Bench Press', 'Barbell Row', 'Overhead Press', 'Romanian Deadlift', 'Plank']
      .map((n, i) => ({ id: 'e' + i, ...pick(n) }));
    for (const e of exs) await DB.put('exercises', e);
    const day = (nm, ids) => ({ name: nm, items: ids.map(i => ({ exerciseId: 'e' + i, sets: 3, repLo: 8, repHi: 12, kg: 40 + i * 5 })) });
    const start = new Date(Date.now() - 16 * 864e5).toISOString().slice(0, 10);
    await DB.put('plans', { id: 'p1', createdAt: Date.now() - 16 * 864e5, name: 'Foundation', weeks: 4, deload: true,
      startDate: start, completed: [
        { week: 1, day: 0, date: '2026-08-18' }, { week: 1, day: 1, date: '2026-08-20' }, { week: 1, day: 2, date: '2026-08-22' },
        { week: 2, day: 0, date: '2026-08-25' }, { week: 2, day: 1, date: '2026-08-27' }
      ], finishedAt: null, prefDays: [0, 2, 4],
      days: [day('Push', [1, 3, 5]), day('Pull', [2, 4]), day('Legs', [0, 4, 5])] });
    let ts = Date.now() - 15 * 864e5;
    const dates = ['2026-08-18', '2026-08-20', '2026-08-22', '2026-08-25', '2026-08-27'];
    for (let i = 0; i < 5; i++) {
      await DB.put('workouts', { id: 'w' + i, ts: ts += 2 * 864e5, date: dates[i], planId: 'p1',
        volume: 2800 + i * 240, duration: 42 + i, prs: i === 3 ? [{ name: 'Bench Press' }] : [], stars: 4 });
      await DB.put('sessions', { id: 's' + i, ts, date: dates[i], exerciseId: 'e1', exercise: 'Bench Press',
        sets: [{ kg: 50 + i * 2.5, reps: 10 }, { kg: 50 + i * 2.5, reps: 9 }, { kg: 50 + i * 2.5, reps: 8 }] });
    }
    await DB.put('bodyweight', { id: 'b1', ts: Date.now() - 10 * 864e5, date: '2026-08-24', kg: 77.8 });
    await DB.put('bodyweight', { id: 'b2', ts: Date.now(), date: '2026-09-03', kg: 77.2 });
    await DB.put('cardio', { id: 'c1', ts: Date.now() - 3 * 864e5, date: '2026-08-31', activity: 'Run', env: 'outdoor', minutes: 25, calories: 300 });
  });
  await goto(); await p.waitForTimeout(1100);
  await shot('02-today-block', 'Today · greeting, week strip, progress arc, next session');

  // ---------- live workout ----------
  await p.click('#view-today .btn-cta').catch(() => {});
  await p.waitForTimeout(1000);
  await shot('03-workout-live', 'Live workout · exercise rail, weight ruler, reps strip');

  // pause overlay
  await p.click('.w-chip, .pill').catch(() => {});
  await p.waitForTimeout(400);
  await shot('04-workout-pause', 'Pause · freeze or discard').catch(() => {});
  await p.evaluate(() => { localStorage.removeItem('liveWorkout'); });

  // ---------- cardio ----------
  await goto(); await p.waitForTimeout(800);
  await tab('Cardio');
  await shot('05-cardio-idle', 'Cardio · activity + program rails, the watch at zero');
  const rails = await p.$$('.or-rail');
  await rails[1].focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(600);
  await shot('06-cardio-program', 'Cardio · program picked — bezel turned to its minutes');
  await p.click('#view-cardio .btn-cta').catch(() => {});
  await p.waitForTimeout(900);
  await shot('07-cardio-running', 'Cardio · running — inner dial, orbit dot, progress ring');
  await p.evaluate(() => localStorage.removeItem('liveCardio'));

  // ---------- plan tab ----------
  await goto(); await p.waitForTimeout(800);
  await tab('Plan');
  await shot('08-plan', 'Plan · the block on one rail — days and history share it');

  // ---------- stats ----------
  await tab('Stats');
  await shot('09-stats', 'Stats · volume, trends, records, body weight');

  // ---------- blocks / library ----------
  await tab('Blocks');
  await shot('10-blocks', 'Blocks · ready-program shelves / start a block');

  // ---------- exercise detail ----------
  await p.evaluate(() => { openDetail('e1', 'library'); });
  await p.waitForTimeout(900);
  await shot('11-detail', 'Exercise detail · demo, history, PRs, muscle panel');

  // ---------- profile ----------
  await goto(); await p.waitForTimeout(800);
  await tab('Profile');
  await shot('12-profile', 'Profile · identity card, lifetime stats, body weight');

  // ---------- about you ----------
  await p.click('.gear-btn[title="About you"]').catch(() => p.evaluate(() => openAbout()));
  await p.waitForTimeout(800);
  await shot('13-about', 'About you · goal, level, born wheels, tape measures');

  // ---------- settings + panels ----------
  await p.evaluate(() => { sDraft = null; openPrefs(); });
  await p.waitForTimeout(700);
  await shot('14-settings', 'Settings · one page, drafts commit on Save');
  await p.click('.pref-row:has-text("Weight jumps")'); await p.waitForTimeout(500);
  await p.$eval('.jump-wheels', n => n.scrollIntoView({ block: 'center' })).catch(() => {});
  await shot('15-settings-jumps', 'Weight jumps · three wheels, real rack steps');
  await p.click('.pref-row:has-text("Weight jumps")'); await p.waitForTimeout(300);
  await p.click('.pref-row:has-text("Accent")'); await p.waitForTimeout(500);
  await p.$eval('.hue-wrap', n => n.scrollIntoView({ block: 'center' })).catch(() => {});
  await shot('16-settings-accent', 'Accent · hue wheel + presets, recolours everything live');
  await p.click('.pref-row:has-text("Equipment")').catch(() => {});
  await p.waitForTimeout(600);
  await shot('17-settings-equipment', 'Equipment · photo rails, tick all / untick all');

  fs.writeFileSync(OUT + '/manifest.json', JSON.stringify(took, null, 2));
  console.log('\ncaptured:', took.length, '| page errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
