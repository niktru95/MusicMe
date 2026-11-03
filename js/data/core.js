/* core.js — основа базы задач тренажёра по музыкальной теории для гитариста.
   Темы добавляются в TasksDB: TasksDB.push({ id, title, icon, description, theory: [], tasks: [] }).

   Задача:
   { id, title, difficulty: 1|2|3, kind: 'text'|'choice'|'fretboard',
     question: 'условие задачи',
     // для kind 'text':
     accept: [ 'допустимые ответы', ... ],  // нормализуются: регистр, ♯/♭/#/b, ё/е, пробелы/запятые/дефисы
     // для kind 'choice':
     options: [ 'вариант1', ... ], answer: <индекс верного>,
     // для kind 'fretboard': отметить клетки грифа
     board: [ { string: 1..6, fret: 0..12 }, ... ],  // 1-я струна — верхняя (high e)
     // необязательное аудио (Web Audio):
     play: { note:'C4' } | { interval:['C4','G4'] } | { harmonic:['C4','G4'] } | { chord:[...] } | { chords:[[...],[...]] } | { scale:[...] },
     hints: [...], solution: 'ответ и пояснение', solutionNote: 'короткая заметка' }

   Ответ из нот (kind 'text'): если accept[0] — список нот, засчитывается тот же набор в любом
   порядке и написании (C#/Db, до-диез, H = B, с октавой или без). ordered: true — порядок важен.

   Генератор: generate: function () { return { question, accept, ... } } — поля задачи
   создаются заново по кнопке «Новый вариант».

   Тап (kind 'tap'): tap: { bpm, pattern: [доли от начала такта после отсчёта 4 щелчков] }.
*/

var TasksDB = [];

/* ---------- Музыкальная база ---------- */

/* Питч-классы: C=0 C#=1 D=2 D#=3 E=4 F=5 F#=6 G=7 G#=8 A=9 A#=10 B=11 */
var PITCH_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var PITCH_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/* Стандартный строй EADGBE. STRING_NOTES[i] — нота i-й струны (1-я — верхняя, high e). */
var STRING_NOTES = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];
var FRET_COUNT = 12;

function _pcIdx(s) { return PITCH_SHARP.indexOf(s); }

/* Разбор ноты "C#4" / "Bb3" → MIDI-номер. Возвращает -1 при ошибке. */
function noteMidi(s) {
  s = String(s || '').replace(/\s/g, '');
  var m = s.match(/^([A-Ga-g])([#b]?)(-?\d)$/);
  if (!m) return -1;
  var pc = m[1].toUpperCase();
  var acc = m[2] || '';
  var oct = parseInt(m[3], 10);
  var idx = _pcIdx(pc + (acc === '#' ? '#' : ''));
  if (idx < 0) return -1;
  if (acc === 'b') idx = (idx + 11) % 12;
  return idx + 12 * (oct + 1);
}

/* MIDI-номер → каноническое имя в диезах, напр. 60 → "C4" */
function midiName(midi) {
  var pc = ((midi % 12) + 12) % 12;
  var oct = Math.floor(midi / 12) - 1;
  return PITCH_SHARP[pc] + oct;
}

/* Питч-класс MIDI-ноты: 0..11 */
function midiPitch(midi) { return ((midi % 12) + 12) % 12; }

/* Нота на струне (1..6) и ладу (0..12) → MIDI и имя */
function fretMidi(string, fret) { return noteMidi(STRING_NOTES[string - 1]) + fret; }
function fretName(string, fret) { return midiName(fretMidi(string, fret)); }

/* Все позиции питч-класса на одной струне в ладах 0..12 (для проверки) */
function fretCellsOfPitch(string, pc) {
  var cells = [];
  for (var f = 0; f <= FRET_COUNT; f++) {
    if (midiPitch(fretMidi(string, f)) === pc) cells.push({ string: string, fret: f });
  }
  return cells;
}

/* ---------- Нормализация ответов ---------- */

function normAnswer(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/♯|＃/g, '#')
    .replace(/♭/g, 'b')
    .replace(/ё/g, 'е')
    .replace(/[,.\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------- Ответы из нот ---------- */

var LETTER_PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, h: 11 };
var SOLFEGE_PC = { 'до': 0, 'ре': 2, 'ми': 4, 'фа': 5, 'соль': 7, 'ля': 9, 'си': 11 };

/* "C E G" / "до-ми-соль" / "F# A# C#" / "си бемоль" → питч-классы [0, 4, 7]; null, если это не ноты */
function parseNotes(s) {
  var tokens = normAnswer(s).replace(/\//g, ' ').split(' ').filter(Boolean);
  if (!tokens.length) return null;
  var out = [];
  for (var i = 0; i < tokens.length; i++) {
    var tok = tokens[i];
    if ((tok === 'диез' || tok === 'бемоль') && out.length) {
      out[out.length - 1] = (out[out.length - 1] + (tok === 'диез' ? 1 : 11)) % 12;
      continue;
    }
    var m = tok.match(/^(до|ре|ми|фа|соль|ля|си|[a-h])(#|b|диез|бемоль)?(\d)?$/);
    if (!m) return null;
    var pc = m[1] in SOLFEGE_PC ? SOLFEGE_PC[m[1]] : LETTER_PC[m[1]];
    if (m[2] === '#' || m[2] === 'диез') pc += 1;
    if (m[2] === 'b' || m[2] === 'бемоль') pc += 11;
    out.push(pc % 12);
  }
  return out;
}

function sameNotes(a, b, ordered) {
  if (!a || !b) return false;
  if (ordered) return a.join() === b.join();
  var key = function (x) { return x.filter(function (v, i) { return x.indexOf(v) === i; }).sort(function (p, q) { return p - q; }).join(); };
  return key(a) === key(b);
}

/* ---------- Генераторы задач ---------- */

function rnd(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rnd(arr.length)]; }

/* Правописание: нота на steps ступеней и semis полутонов выше root ("Eb" + 2 ст./4 пт. → "G").
   Возвращает null для дубль-диезов/бемолей — генераторы такие варианты пропускают. */
var LETTERS = 'CDEFGAB';
function spellUp(root, steps, semis) {
  var li = LETTERS.indexOf(root[0]);
  var target = (noteMidi(root + '4') + semis) % 12;
  var letter = LETTERS[(li + steps) % 7];
  var diff = ((target - LETTER_PC[letter.toLowerCase()]) % 12 + 18) % 12 - 6;
  if (diff > 1 || diff < -1) return null;
  return letter + (diff === 1 ? '#' : diff === -1 ? 'b' : '');
}

/* Ноты аккорда/гаммы по формуле [[ступени, полутоны], ...] от root; null, если нужен дубль-знак */
function spellAll(root, formula) {
  var out = [];
  for (var i = 0; i < formula.length; i++) {
    var n = spellUp(root, formula[i][0], formula[i][1]);
    if (!n) return null;
    out.push(n);
  }
  return out;
}

/* Ноты в 4-й октаве для проигрывания (по возрастанию от root) */
function voiced(names, octave) {
  var base = noteMidi(names[0] + (octave || 3));
  var prev = base - 1;
  return names.map(function (n) {
    var m = noteMidi(n + (octave || 3));
    while (m <= prev) m += 12;
    prev = m;
    return midiName(m);
  });
}

var ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

var INTERVALS = [
  { semis: 1, steps: 1, name: 'малая секунда', acc: 'малую секунду' },
  { semis: 2, steps: 1, name: 'большая секунда', acc: 'большую секунду' },
  { semis: 3, steps: 2, name: 'малая терция', acc: 'малую терцию' },
  { semis: 4, steps: 2, name: 'большая терция', acc: 'большую терцию' },
  { semis: 5, steps: 3, name: 'чистая кварта', acc: 'чистую кварту' },
  { semis: 6, steps: 3, name: 'тритон', acc: 'тритон (увеличенную кварту)' },
  { semis: 7, steps: 4, name: 'чистая квинта', acc: 'чистую квинту' },
  { semis: 8, steps: 5, name: 'малая секста', acc: 'малую сексту' },
  { semis: 9, steps: 5, name: 'большая секста', acc: 'большую сексту' },
  { semis: 10, steps: 6, name: 'малая септима', acc: 'малую септиму' },
  { semis: 11, steps: 6, name: 'большая септима', acc: 'большую септиму' },
  { semis: 12, steps: 7, name: 'октава', acc: 'октаву' }
];

var CHORD_TYPES = {
  '': { name: 'мажорное трезвучие', f: [[0, 0], [2, 4], [4, 7]] },
  'm': { name: 'минорное трезвучие', f: [[0, 0], [2, 3], [4, 7]] },
  'dim': { name: 'уменьшённое трезвучие', f: [[0, 0], [2, 3], [4, 6]] },
  'aug': { name: 'увеличенное трезвучие', f: [[0, 0], [2, 4], [4, 8]] },
  '7': { name: 'доминантсептаккорд', f: [[0, 0], [2, 4], [4, 7], [6, 10]] },
  'maj7': { name: 'большой мажорный септаккорд', f: [[0, 0], [2, 4], [4, 7], [6, 11]] },
  'm7': { name: 'минорный септаккорд', f: [[0, 0], [2, 3], [4, 7], [6, 10]] },
  'm7b5': { name: 'полууменьшённый септаккорд', f: [[0, 0], [2, 3], [4, 6], [6, 10]] }
};

/* Повторять f(), пока не вернёт не-null (отсев вариантов с дубль-знаками) */
function retry(f) {
  for (var i = 0; i < 100; i++) { var r = f(); if (r) return r; }
  throw new Error('generator failed');
}

/* Задача «какие ноты в аккорде» для типов types */
function chordNotesTask(types) {
  return retry(function () {
    var root = pick(ROOTS);
    var type = pick(types);
    var notes = spellAll(root, CHORD_TYPES[type].f);
    if (!notes) return null;
    return {
      question: 'Какие ноты в аккорде ' + root + type + '?\n\nЗапишите через пробел от тоники.',
      accept: [notes.join(' ').toLowerCase()],
      hints: [root + type + ' — ' + CHORD_TYPES[type].name, 'Формула в полутонах от тоники: ' + CHORD_TYPES[type].f.map(function (x) { return x[1]; }).join(' – ')],
      play: { chord: voiced(notes) },
      solution: root + type + ' = ' + notes.join(', ') + ' (' + CHORD_TYPES[type].name + ').'
    };
  });
}
