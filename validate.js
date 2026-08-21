// Временный скрипт валидации данных (удаляется после проверки)
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const files = [
  'js/data/core.js',
  'js/data/t01-notes.js', 'js/data/t02-intervals.js', 'js/data/t03-major.js',
  'js/data/t04-minor.js', 'js/data/t05-triads.js', 'js/data/t06-sevenths.js',
  'js/data/t07-chords.js', 'js/data/t08-pentatonic.js', 'js/data/t09-circle.js'
];
const dataCtx = { TasksDB: [], console };
for (const f of files) {
  try {
    vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), f), 'utf8'), dataCtx);
  } catch (e) {
    console.log('LOAD ERROR in ' + f + ': ' + e.message);
  }
}

const db = dataCtx.TasksDB;
let total = 0, errs = 0;
const kinds = { text: 0, choice: 0, fretboard: 0 };
const ids = new Set();

for (const t of db) {
  console.log('  -', t.id, '|', t.title, '| tasks:', t.tasks.length, '| theory:', Array.isArray(t.theory) ? t.theory.length : 0);
  for (const task of t.tasks) {
    total++;
    if (ids.has(task.id)) { console.log('  DUP ID', task.id); errs++; }
    ids.add(task.id);
    if (![1, 2, 3].includes(task.difficulty)) { console.log('  BAD DIFF', task.id); errs++; }
    if (!task.question) { console.log('  NO QUESTION', task.id); errs++; }
    if (!Array.isArray(task.hints) || task.hints.length === 0) { console.log('  NO HINTS', task.id); errs++; }
    if (!task.solution) { console.log('  NO SOLUTION', task.id); errs++; }
    if (task.kind === 'text') {
      kinds.text++;
      if (!Array.isArray(task.accept) || !task.accept.length) { console.log('  BAD ACCEPT', task.id); errs++; }
    } else if (task.kind === 'choice') {
      kinds.choice++;
      if (!Array.isArray(task.options) || task.options.length < 2 || typeof task.answer !== 'number' || task.answer < 0 || task.answer >= task.options.length) { console.log('  BAD CHOICE', task.id); errs++; }
    } else if (task.kind === 'fretboard') {
      kinds.fretboard++;
      if (!Array.isArray(task.board) || !task.board.length) { console.log('  BAD BOARD', task.id); errs++; }
      else for (const c of task.board) if (!c || c.string < 1 || c.string > 6 || c.fret < 0 || c.fret > 12) { console.log('  BAD CELL', task.id, JSON.stringify(c)); errs++; }
    } else { console.log('  BAD KIND', task.id, task.kind); errs++; }
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
console.log('check text ok  :', R2.check({ kind: 'text', accept: ['квинта', '5'] }, ' Квинта ').pass);
console.log('check text no  :', R2.check({ kind: 'text', accept: ['квинта'] }, 'терция').pass);
console.log('check choice   :', R2.check({ kind: 'choice', options: ['a', 'b', 'c'], answer: 1 }, 1).pass);
console.log('check board    :', R2.check({ kind: 'fretboard', board: [{ string: 6, fret: 3 }] }, [{ string: 6, fret: 3 }]).pass);
console.log('fret(6,3)      :', vm.runInContext('fretName(6,3)', coreCtx), '| fret(5,3):', vm.runInContext('fretName(5,3)', coreCtx), '| fret(1,0):', vm.runInContext('fretName(1,0)', coreCtx));