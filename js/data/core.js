/* core.js — основа базы задач тренажёра по музыкальной теории для гитариста.
   Темы добавляются в TasksDB: TasksDB.push({ id, title, icon, description, theory: [], tasks: [] }).

   Задача:
   { id, title, difficulty: 1|2|3, kind: 'text'|'choice'|'fretboard',
     question: 'условие задачи',
     // для kind 'text':
     accept: [ 'допустимые ответы', ... ],  // нормализуются: регистр, ♯/♭/#/b, пробелы/запятые
     // для kind 'choice':
     options: [ 'вариант1', ... ], answer: <индекс верного>,
     // для kind 'fretboard': отметить клетки грифа
     board: [ { string: 1..6, fret: 0..12 }, ... ],  // 1-я струна — верхняя (high e)
     // необязательное аудио (Web Audio):
     play: { note:'C4' } | { interval:['C4','G4'] } | { chord:[...] } | { scale:[...] },
     hints: [...], solution: 'ответ и пояснение', solutionNote: 'короткая заметка' }
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
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Буквенное имя ноты нормализованно: "C#4", "c#4", "Соль" остаётся как есть */
function normNoteInput(s) {
  return normAnswer(s).replace(/-/g, '');
}