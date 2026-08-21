/* runner.js — чекер ответов тренажёра (аналог песочницы из репо-оригинала).
   Проверяет ответ пользователя по формату задачи и возвращает результат. */
var Runner = {

  deepEqual: function (a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!this.deepEqual(a[i], b[i])) return false;
      return true;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      var ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (var j = 0; j < ka.length; j++) {
        var k = ka[j];
        if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
        if (!this.deepEqual(a[k], b[k])) return false;
      }
      return true;
    }
    return false;
  },

  /* Сравнение массивов клеток грифа {string, fret} */
  sameCells: function (a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      var found = false;
      for (var j = 0; j < b.length; j++) {
        if (a[i].string === b[j].string && a[i].fret === b[j].fret) { found = true; break; }
      }
      if (!found) return false;
    }
    return true;
  },

  /* Основная проверка. answer: строка / индекс выбора / массив клеток грифа */
  check: function (task, answer) {
    var res = { pass: false, actual: answer, expected: '' };

    if (task.kind === 'text') {
      var accepted = (task.accept || []).map(normAnswer);
      res.expected = task.accept[0] || '';
      res.pass = accepted.indexOf(normAnswer(answer)) >= 0;
    } else if (task.kind === 'choice') {
      var idx = parseInt(answer, 10);
      res.expected = task.options[task.answer];
      res.actual = (idx >= 0 && idx < task.options.length) ? task.options[idx] : '';
      res.pass = idx === task.answer;
    } else if (task.kind === 'fretboard') {
      var expected = task.board || [];
      var got = (answer || []).filter(function (c) { return c && typeof c.fret === 'number' && typeof c.string === 'number'; });
      res.expected = expected.map(function (c) { return c.string + ':' + c.fret; }).join(', ');
      res.actual = got.map(function (c) { return c.string + ':' + c.fret; }).join(', ');
      res.pass = this.sameCells(expected, got);
    }

    if (task.kind === 'fretboard') {
      res.message = res.pass
        ? 'Верно! Все нужные ноты отмечены.'
        : 'Пока неверно — отмеченные клетки не совпадают с ответом.';
    } else {
      res.message = res.pass ? 'Верно!' : 'Пока неверно — попробуйте ещё раз.';
    }
    return res;
  }
};