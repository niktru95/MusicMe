/* runner.js — чекер ответов тренажёра (аналог песочницы из репо-оригинала).
   Проверяет ответ пользователя по формату задачи и возвращает результат. */
var Runner = {

  /* Клетки из a, которых нет в b */
  cellsMissing: function (a, b) {
    return a.filter(function (x) {
      return !b.some(function (y) { return x.string === y.string && x.fret === y.fret; });
    });
  },

  /* Тап: answer — моменты нажатий (мс от первого щелчка отсчёта).
     Постоянную задержку звука/экрана вычитаем (медиана), проверяем ровность. */
  checkTap: function (task, taps) {
    var beat = 60000 / task.tap.bpm;
    var want = task.tap.pattern.map(function (b) { return (4 + b) * beat; });  /* 4 щелчка отсчёта */
    var res = { pass: false, actual: taps.length + ' нажатий', expected: want.length + ' нажатий' };
    if (taps.length !== want.length) {
      res.message = 'Нужно ' + want.length + ' нажатий, а было ' + taps.length + '. Попробуйте ещё раз.';
      return res;
    }
    var err = taps.map(function (t, i) { return t - want[i]; });
    var sorted = err.slice().sort(function (a, b) { return a - b; });
    var lag = sorted[Math.floor(sorted.length / 2)];
    var worst = Math.max.apply(null, err.map(function (e) { return Math.abs(e - lag); }));
    var avg = Math.round(err.reduce(function (s, e) { return s + Math.abs(e - lag); }, 0) / err.length);
    res.pass = worst <= (task.tap.tolerance || 90) && Math.abs(lag) <= 250;
    res.message = res.pass
      ? 'Верно! Среднее отклонение ±' + avg + ' мс.'
      : Math.abs(lag) > 250
        ? 'Нажатия ' + (lag > 0 ? 'опаздывают' : 'спешат') + ' в среднем на ' + Math.abs(Math.round(lag)) + ' мс — слушайте отсчёт и попробуйте ещё раз.'
        : 'Неровно: самое сильное отклонение ' + Math.round(worst) + ' мс (среднее ±' + avg + '). Попробуйте ещё раз.';
    return res;
  },

  /* Основная проверка. answer: строка / индекс выбора / массив клеток грифа */
  check: function (task, answer) {
    var res = { pass: false, actual: answer, expected: '' };

    if (task.kind === 'text') {
      var accepted = (task.accept || []).map(normAnswer);
      res.expected = task.accept[0] || '';
      res.pass = accepted.indexOf(normAnswer(answer)) >= 0 ||
        sameNotes(parseNotes(task.accept[0]), parseNotes(answer), task.ordered);
    } else if (task.kind === 'tap') {
      return this.checkTap(task, answer || []);
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
