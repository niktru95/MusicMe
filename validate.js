// Проверка данных и чекера: node validate.js (запускается в CI, код выхода 1 при ошибках)
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const files = [
  'js/data/core.js',
  'js/data/t01-notes.js', 'js/data/t02-intervals.js', 'js/data/t03-major.js',
  'js/data/t04-minor.js', 'js/data/t05-triads.js', 'js/data/t06-sevenths.js',
  'js/data/t07-chords.js', 'js/data/t08-pentatonic.js', 'js/data/t09-circle.js',
  'js/data/t10-progressions.js', 'js/data/t11-inversions.js', 'js/data/t12-modes.js',
  'js/data/t13-rhythm.js', 'js/data/t14-ear.js', 'js/runner.js'
];
const dataCtx = { TasksDB: [], console };
let loadErrs = 0;
vm.createContext(dataCtx);
for (const f of files) {
  try {
    vm.runInContext(fs.readFileSync(path.join(process.cwd(), f), 'utf8'), dataCtx);
  } catch (e) {
    console.log('LOAD ERROR in ' + f + ': ' + e.message);
    loadErrs++;
  }
}
const fretMidi = vm.runInContext('fretMidi', dataCtx);
const fretCellsOfPitch = vm.runInContext('fretCellsOfPitch', dataCtx);
const Runner = vm.runInContext('Runner', dataCtx);

const db = dataCtx.TasksDB;
let total = 0, errs = loadErrs;
const kinds = { text: 0, choice: 0, fretboard: 0, tap: 0 };
const ids = new Set();

for (const t of db) {
  console.log('  -', t.id, '|', t.title, '| tasks:', t.tasks.length, '| theory:', Array.isArray(t.theory) ? t.theory.length : 0);
  for (const base of t.tasks) {
    total++;
    if (ids.has(base.id)) { console.log('  DUP ID', base.id); errs++; }
    ids.add(base.id);
    kinds[base.kind] = (kinds[base.kind] || 0) + 1;
    // генератор: проверяем 50 случайных вариантов
    const instances = base.generate ? Array.from({ length: 50 }, () => Object.assign({}, base, base.generate())) : [base];
    for (const task of instances) {
    if (![1, 2, 3].includes(task.difficulty)) { console.log('  BAD DIFF', task.id); errs++; }
    if (!task.question) { console.log('  NO QUESTION', task.id); errs++; }
    if (!Array.isArray(task.hints) || task.hints.length === 0) { console.log('  NO HINTS', task.id); errs++; }
    if (!task.solution) { console.log('  NO SOLUTION', task.id); errs++; }
    if (task.kind === 'text') {
      if (!Array.isArray(task.accept) || !task.accept.length) { console.log('  BAD ACCEPT', task.id); errs++; }
      else if (!Runner.check(task, task.accept[0]).pass) { console.log('  SELF CHECK', task.id); errs++; }
    } else if (task.kind === 'tap') {
      const pt = task.tap && task.tap.pattern;
      if (!task.tap || !(task.tap.bpm > 0) || !Array.isArray(pt) || !pt.length || pt.some((b, i) => i && b <= pt[i - 1])) { console.log('  BAD TAP', task.id); errs++; }
    } else if (task.kind === 'choice') {
      if (!Array.isArray(task.options) || task.options.length < 2 || typeof task.answer !== 'number' || task.answer < 0 || task.answer >= task.options.length) { console.log('  BAD CHOICE', task.id); errs++; }
    } else if (task.kind === 'fretboard') {
      if (!Array.isArray(task.board) || !task.board.length) { console.log('  BAD BOARD', task.id); errs++; }
      else {
        for (const c of task.board) if (!c || c.string < 1 || c.string > 6 || c.fret < 0 || c.fret > 12) { console.log('  BAD CELL', task.id, JSON.stringify(c)); errs++; }
        // «(лады 0–12)» в условии: в ответе должны быть все позиции тех же нот на этой струне (часто забывают 12-й лад)
        if (task.question.includes('лады 0–12')) {
          for (const c of task.board) {
            for (const need of fretCellsOfPitch(c.string, fretMidi(c.string, c.fret) % 12)) {
              if (!task.board.some(b => b.string === need.string && b.fret === need.fret)) { console.log('  MISSING CELL', task.id, need.string + ':' + need.fret); errs++; }
            }
          }
        }
        // range: [от, до] — все позиции тех же нот на всех струнах в этих ладах
        if (task.range) {
          const pcs = new Set(task.board.map(c => fretMidi(c.string, c.fret) % 12));
          for (let st = 1; st <= 6; st++) for (let f = task.range[0]; f <= task.range[1]; f++) {
            if (pcs.has(fretMidi(st, f) % 12) && !task.board.some(b => b.string === st && b.fret === f)) { console.log('  MISSING CELL', task.id, st + ':' + f); errs++; }
          }
        }
        if (!Runner.check(task, task.board).pass) { console.log('  SELF CHECK', task.id); errs++; }
      }
    } else { console.log('  BAD KIND', task.id, task.kind); errs++; }
    }
  }
}

console.log('total tasks:', total, '| errors:', errs);
console.log('kinds:', JSON.stringify(kinds));

// Проверка чекера и нотных функций
const coreCtx = { TasksDB: [] };
vm.createContext(coreCtx);
vm.runInContext(fs.readFileSync(path.join(process.cwd(), 'js/data/core.js'), 'utf8'), coreCtx);

const runnerCtx = { TasksDB: [], console };
vm.createContext(runnerCtx);
vm.runInContext(fs.readFileSync(path.join(process.cwd(), 'js/data/core.js'), 'utf8'), runnerCtx);
vm.runInContext(fs.readFileSync(path.join(process.cwd(), 'js/runner.js'), 'utf8'), runnerCtx);
const R2 = vm.runInContext('Runner', runnerCtx);
const ok = (name, cond) => { console.log(name.padEnd(15) + ':', !!cond); if (!cond) errs++; };
ok('check text ok', R2.check({ kind: 'text', accept: ['квинта', '5'] }, ' Квинта ').pass);
ok('check text no', !R2.check({ kind: 'text', accept: ['квинта'] }, 'терция').pass);
ok('check ё/дефис', R2.check({ kind: 'text', accept: ['уменьшённый', 'си-бемоль'] }, 'уменьшенный').pass &&
  R2.check({ kind: 'text', accept: ['си-бемоль'] }, 'си бемоль').pass);
ok('notes any order', R2.check({ kind: 'text', accept: ['c e g'] }, 'G, до, ми').pass);
ok('notes H/enharm', R2.check({ kind: 'text', accept: ['b d f#'] }, 'h d gb').pass);
ok('notes ordered', !R2.check({ kind: 'text', accept: ['c f g'], ordered: true }, 'g f c').pass);
ok('notes wrong', !R2.check({ kind: 'text', accept: ['c e g'] }, 'c eb g').pass);
const tapTask = { kind: 'tap', tap: { bpm: 60, pattern: [0, 1, 2, 3] } };
ok('tap steady+lag', R2.check(tapTask, [4120, 5130, 6110, 7125]).pass);
ok('tap uneven', !R2.check(tapTask, [4000, 5000, 6200, 7000]).pass);
ok('tap count', !R2.check(tapTask, [4000, 5000]).pass);
ok('check board', R2.check({ kind: 'fretboard', board: [{ string: 6, fret: 3 }] }, [{ string: 6, fret: 3 }]).pass);
ok('board missing', /не хватает нот: 1/.test(R2.check({ kind: 'fretboard', board: [{ string: 6, fret: 0 }, { string: 6, fret: 12 }] }, [{ string: 6, fret: 0 }]).message));
console.log('fret(6,3)      :', vm.runInContext('fretName(6,3)', coreCtx), '| fret(5,3):', vm.runInContext('fretName(5,3)', coreCtx), '| fret(1,0):', vm.runInContext('fretName(1,0)', coreCtx));

console.log('errors:', errs);
process.exit(errs ? 1 : 0);
