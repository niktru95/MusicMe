/* runner.js — чекер ответов тренажёра (аналог песочницы из репо-оригинала).
   Проверяет ответ пользователя по формату задачи и возвращает результат. */
var Runner = {

  /* Клетки из a, которых нет в b */
  cellsMissing: function (a, b) {
    return a.filter(function (x) {
      return !b.some(function (y) { return x.string === y.string && x.fret === y.fret; });
    });
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
      var missing = this.cellsMissing(expected, got).length;
      var extra = this.cellsMissing(got, expected).length;
      res.expected = expected.map(function (c) { return c.string + ':' + c.fret; }).join(', ');
      res.actual = got.map(function (c) { return c.string + ':' + c.fret; }).join(', ');
      res.pass = missing === 0 && extra === 0;
      res.message = res.pass
        ? 'Верно! Все нужные ноты отмечены.'
        : 'Пока неверно — ' + [missing ? 'не хватает нот: ' + missing : '', extra ? 'лишних нот: ' + extra : ''].filter(Boolean).join(', ') + '.';
      return res;
    }

    res.message = res.pass ? 'Верно!' : 'Пока неверно — попробуйте ещё раз.';
    return res;
  }
};
