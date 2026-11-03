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
    check('freq-A4', Math.abs(Synth.freq('A4') - 440) < 1e-6);

    check('norm-yo-dash', normAnswer('Уменьшённый си-бемоль') === 'уменьшенный си бемоль');
    check('data-loaded', TasksDB.length >= 9);
    /* Структура и корректность данных — в validate.js (node, CI) */

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
