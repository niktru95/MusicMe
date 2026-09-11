/* selftest.js — автотест (откройте index.html?selftest).
   В заголовке вкладки появится SELFTEST-OK или SELFTEST-FAIL: <что сломалось> */
(function () {
  if (location.search.indexOf('selftest') < 0) return;
  var results = [];

  function check(name, cond) { results.push({ name: name, ok: !!cond }); render(); }
  function render() {
    var div = document.getElementById('selftest-result');
    if (!div) {
      div = document.createElement('div');
      div.id = 'selftest-result';
      div.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:999;background:#0f172a;color:#e2e8f0;font:12px monospace;padding:8px 12px;border-radius:8px;max-width:80vw;';
      document.body.appendChild(div);
    }
    div.textContent = results.map(function (r) { return (r.ok ? 'OK ' : 'FAIL ') + r.name; }).join('; ');
  }
  function finish() {
    var failed = results.filter(function (r) { return !r.ok; });
    document.title = failed.length
      ? 'SELFTEST-FAIL: ' + failed.map(function (f) { return f.name; }).join(', ')
      : 'SELFTEST-OK';
    render();
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(function () {
    check('norm-lower', normAnswer('  КвиНта ') === 'квинта');
    check('norm-sharp', normAnswer('F♯4') === 'f#4');
    check('norm-flat-commas', normAnswer('C, E, G') === 'c e g');
    check('note-midi-A4', noteMidi('A4') === 69);
    check('note-midi-E2', noteMidi('E2') === 40);
    check('fret-c5', fretName(5, 3) === 'C3');
    check('fret-g2', fretName(6, 3) === 'G2');
    check('fret-e5', fretName(1, 12) === 'E5');
    check('freq-A4', Math.abs(Audio.freq('A4') - 440) < 1e-6);

    check('data-topics', TasksDB.length >= 9);
    var total = 0, badDiff = 0, emptyHints = 0, ids = {}, dup = {};
    var kinds = { text: 0, choice: 0, fretboard: 0 };
    var badQuestion = 0, noSolution = 0, badKind = 0, badAccept = 0, badChoices = 0, badCells = 0, noTheoryOrTasks = 0;
    var badOctave = 0;

    TasksDB.forEach(function (topic) {
      if (!topic.id || !topic.title || !topic.icon) return;
      if (!Array.isArray(topic.theory) || !topic.theory.length) noTheoryOrTasks++;
      if (!Array.isArray(topic.tasks) || !topic.tasks.length) noTheoryOrTasks++;
      total += topic.tasks.length;
      topic.tasks.forEach(function (t) {
        if (ids[t.id]) dup[t.id] = (dup[t.id] || 0) + 1; else ids[t.id] = 1;
        if (!t.difficulty || t.difficulty < 1 || t.difficulty > 3) badDiff++;
        if (!t.question) badQuestion++;
        if (!Array.isArray(t.hints) || !t.hints.length) emptyHints++;
        if (!t.solution) noSolution++;
        if (['text', 'choice', 'fretboard'].indexOf(t.kind) < 0) badKind++;
        if (t.kind === 'text' && (!Array.isArray(t.accept) || !t.accept.length)) badAccept++;
        if (t.kind === 'choice') {
          if (!Array.isArray(t.options) || t.options.length < 2) badChoices++;
          if (typeof t.answer !== 'number' || t.answer < 0 || t.answer >= t.options.length) badChoices++;
        }
        if (t.kind === 'fretboard') {
          if (!Array.isArray(t.board) || !t.board.length) badCells++;
          (t.board || []).forEach(function (c) {
            if (!c || c.string < 1 || c.string > 6 || c.fret < 0 || c.fret > 12) badCells++;
          });
        }
        kinds[t.kind] = (kinds[t.kind] || 0) + 1;
      });
    });

    var n04 = ids['n-04'] && TasksDB[0].tasks.filter(function (t) { return t.id === 'n-04'; })[0];
    if (n04 && n04.accept && n04.accept.indexOf('g3') >= 0) badOctave++;
    var n15 = null;
    TasksDB.forEach(function (tp) {
      tp.tasks.forEach(function (t) {
        if (t.id === 'n-15') n15 = t;
      });
    });
    if (n15 && n15.accept && n15.accept.indexOf('e4') >= 0) badOctave++;

    check('data-total', total > 0);
    check('data-dup-ids', Object.keys(dup).length === 0);
    check('data-valid-difficulty', badDiff === 0);
    check('data-theory-per-topic', noTheoryOrTasks === 0);
    check('data-hints', emptyHints === 0);
    check('data-solution', noSolution === 0);
    check('data-question', badQuestion === 0);
    check('data-kind-valid', badKind === 0);
    check('data-accept', badAccept === 0);
    check('data-options', badChoices === 0);
    check('data-cells', badCells === 0);
    check('data-kinds', ['text', 'choice', 'fretboard'].every(function (k) { return (kinds[k] || 0) > 0; }));
    check('data-octave-accepts', badOctave === 0);

    var tText = { id: 'st-t', kind: 'text', accept: ['квинта', '5'] };
    var r1 = Runner.check(tText, '  Квинта ');
    check('check-text-correct', r1.pass);
    check('check-text-wrong', !Runner.check(tText, 'терция').pass);

    var tChoice = { id: 'st-c', kind: 'choice', options: ['A', 'B', 'C'], answer: 1 };
    check('check-choice-correct', Runner.check(tChoice, 1).pass);
    check('check-choice-wrong', !Runner.check(tChoice, 0).pass);

    var tBoard = { id: 'st-b', kind: 'fretboard', board: [{ string: 6, fret: 3 }] };
    check('check-board-correct', Runner.check(tBoard, [{ string: 6, fret: 3 }]).pass);
    check('check-board-wrong', !Runner.check(tBoard, [{ string: 6, fret: 5 }]).pass);

    finish();
  });
})();
