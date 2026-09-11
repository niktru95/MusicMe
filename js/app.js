/* app.js — интерфейс тренажёра: рендер, навигация, проверка ответов, прогресс. */
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var fmtText = function (s) { return esc(s).replace(/\n/g, '<br>'); };
/* Показать заметное сообщение, если звук не удалось воспроизвести
     (раньше клик по кнопке молча «ничего не делал»). */
  function audioWarn(container) {
    var host = typeof container === 'string' ? $(container) : container;
    if (!host) return;
    var old = host.querySelector('.audio-warn');
    if (old) old.remove();
    var w = document.createElement('div');
    w.className = 'audio-warn';
    w.textContent = '⚠️ Аудио недоступно: браузер не поддерживает Web Audio или заблокировал звук.';
    host.appendChild(w);
    setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w); }, 6000);
  }

  /* Воспроизвести пример; при неудаче — показать внятное сообщение. */
  function tryPlay(spec, container) {
    if (!spec) return;
    var result = Audio.play(spec);
    if (result && typeof result.then === 'function') {
      result.then(function (ok) { if (!ok) audioWarn(container); });
    } else if (!result) audioWarn(container);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  var DIFF = {
    1: { label: 'Легко', cls: 'diff-1' },
    2: { label: 'Средне', cls: 'diff-2' },
    3: { label: 'Сложно', cls: 'diff-3' }
  };

  /* Сессионная БД (копия тем и задач) */
  var SessionDB = TasksDB.map(function (topic) {
    return {
      id: topic.id, title: topic.title, icon: topic.icon, description: topic.description,
      theory: topic.theory,
      tasks: topic.tasks.map(function (t) {
        return {
          id: t.id, title: t.title, difficulty: t.difficulty, question: t.question, kind: t.kind,
          accept: t.accept, options: t.options, answer: t.answer, board: t.board,
          play: t.play, hints: t.hints || [], solution: t.solution, solutionNote: t.solutionNote
        };
      })
    };
  });

  var getTopic = function (id) {
    for (var i = 0; i < SessionDB.length; i++) if (SessionDB[i].id === id) return SessionDB[i];
    return null;
  };
  var getTask = function (topicId, taskId) {
    var t = getTopic(topicId);
    if (!t) return null;
    for (var j = 0; j < t.tasks.length; j++) if (t.tasks[j].id === taskId) return t.tasks[j];
    return null;
  };

  var state = {
    topicId: null,
    taskId: null,
    order: [],
    index: 0,
    filter: 'all',
    hintsCount: {},
    sel: {}
  };

  /* ---------- Прогресс ---------- */
  function totals() {
    var solved = 0, total = 0;
    SessionDB.forEach(function (topic) {
      topic.tasks.forEach(function (task) { total++; if (Storage.isSolved(task.id)) solved++; });
    });
    return { solved: solved, total: total };
  }

  function renderGlobalProgress() {
    var t = totals();
    var pct = t.total ? Math.round(t.solved / t.total * 100) : 0;
    $('#global-progress').innerHTML =
      '<div class="gprog-bar"><div class="gprog-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="gprog-text">' + t.solved + ' / ' + t.total + ' решено</span>';
  }

  /* ---------- Представления ---------- */
  function showView(name) {
    ['home', 'topic', 'task'].forEach(function (v) {
      $('#view-' + v).classList.toggle('hidden', v !== name);
    });
    window.scrollTo(0, 0);
  }

  function renderHome() {
    $('#topics-grid').innerHTML = SessionDB.map(function (topic) {
      var solved = topic.tasks.filter(function (t) { return Storage.isSolved(t.id); }).length;
      var pct = Math.round(solved / topic.tasks.length * 100);
      return '<a class="topic-card" href="#t-' + topic.id + '">' +
        '<div class="topic-icon">' + topic.icon + '</div>' +
        '<div style="flex:1">' +
        '<div class="topic-name">' + esc(topic.title) + '</div>' +
        '<div class="topic-desc">' + esc(topic.description) + '</div>' +
        '<div class="topic-progress-row">' +
        '<div class="prog-bar"><div class="prog-fill" style="width:' + pct + '%"></div></div>' +
        '<span>' + solved + ' / ' + topic.tasks.length + '</span>' +
        '</div></div></a>';
    }).join('');
    renderGlobalProgress();
  }

  function currentTopic() { return getTopic(state.topicId); }
  function currentTask() { return getTask(state.topicId, state.taskId); }

  function taskById(topic, id) {
    for (var i = 0; i < topic.tasks.length; i++) if (topic.tasks[i].id === id) return topic.tasks[i];
    return null;
  }

  function visibleTasks(topic) {
    var order = (state.orderTopic === topic.id && state.order.length)
      ? state.order
      : topic.tasks.map(function (t) { return t.id; });
    var out = [];
    for (var i = 0; i < order.length; i++) {
      var t = taskById(topic, order[i]);
      if (!t) continue;
      if (state.filter === 'solved' && !Storage.isSolved(t.id)) continue;
      if (state.filter === 'unsolved' && Storage.isSolved(t.id)) continue;
      out.push(t);
    }
    return out;
  }

  function statusLabel(taskId) {
    var s = Storage.getState(taskId);
    if (s.solved && s.hinted) return '✨ решена с подсказкой';
    if (s.solved) return '✅ решена';
    if (s.hinted) return '💡 подсказка';
    return '';
  }

  /* Обновить статус текущей задачи (после проверки, подсказки или решения) */
  function updateTaskStatus() {
    var task = currentTask();
    if (task) $('#task-status').textContent = statusLabel(task.id);
  }

function renderTopic() {
    var topic = currentTopic();
    if (!topic) { location.hash = ''; return; }
    $('#topic-title').textContent = topic.icon + ' ' + topic.title;
    $('#topic-description').textContent = topic.description;

    var solved = topic.tasks.filter(function (t) { return Storage.isSolved(t.id); }).length;
    var pct = Math.round(solved / topic.tasks.length * 100);
    $('#topic-progress').innerHTML =
      '<div class="prog-bar wide"><div class="prog-fill" style="width:' + pct + '%"></div></div>' +
      '<span>' + solved + ' / ' + topic.tasks.length + ' решено</span>';

    var filters = [
      { id: 'all', label: 'Все' },
      { id: 'unsolved', label: 'Не решённые' },
      { id: 'solved', label: 'Решённые' }
    ];
    $('#topic-filters').innerHTML = filters.map(function (f) {
      return '<button class="chip' + (state.filter === f.id ? ' active' : '') + '" data-filter="' + f.id + '">' + f.label + '</button>';
    }).join('');

    var tasks = visibleTasks(topic);

    $('#task-list').innerHTML = tasks.map(function (t, i) {
      var st = statusLabel(t.id);
      var dots = [1, 2, 3].map(function (n) {
        return '<span class="diff-dot" style="background:' + (n <= t.difficulty ? 'var(--accent)' : 'var(--border)') + '"></span>';
      }).join('');
      var icon = st.indexOf('✅') >= 0 ? '✅' : st.indexOf('✨') >= 0 ? '✨' : st.indexOf('💡') >= 0 ? '💡' : '';
      return '<div class="task-item" data-goto="#task-' + state.topicId + '/' + t.id + '">' +
        '<div class="task-num">' + (i + 1) + '</div>' +
        '<div class="task-item-title">' + esc(t.title) + '</div>' +
        '<div class="diff-dots">' + dots + '</div>' +
        '<div class="task-item-status">' + (icon ? '<span title="' + st + '">' + icon + '</span>' : '') + '</div>' +
        '</div>';
    }).join('');
  }

  /* ---------- Гриф ---------- */
  function renderFretboard(container, selected) {
    var selKeys = (selected || []).map(function (c) { return c.string + ':' + c.fret; });
    var nums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    var head = '<div class="fret-head"><div class="fret-fret-label">Струна</div>' +
      nums.map(function (f) { return '<div class="fret-label">' + f + '</div>'; }).join('') + '</div>';

    var rows = [];
    for (var s = 1; s <= 6; s++) {
      var cellsHtml = nums.map(function (f) {
        var key = s + ':' + f;
        var mark = (f === 3 || f === 5 || f === 7 || f === 9) ? '•' : f === 12 ? '◎' : '';
        return '<button class="fret-note' + (selKeys.indexOf(key) >= 0 ? ' selected' : '') + '" data-s="' + s + '" data-f="' + f + '">' +
          fretName(s, f) + (mark ? '<span class="fret-marker">' + mark + '</span>' : '') + '</button>';
      }).join('');
      rows.push('<div class="fret-head"><div class="fret-fret-label">' + STRING_NOTES[s - 1] + '</div>' + cellsHtml + '</div>');
    }

    container.innerHTML =
      '<div class="fret-wrap"><div class="fret-board">' + head + rows.join('') + '</div></div>' +
      '<div class="play-area"><button class="btn-play" id="play-selection">🔊 Сыграть отмеченное</button></div>' +
      '<div class="fretboard-hint">1-я струна (high e) сверху, 6-я (low E) снизу. Клик — отметить ноту.</div>';

    container.onclick = function onClick(e) {
      var btn = e.target.closest('.fret-note');
      if (btn) {
        var cell = { string: parseInt(btn.getAttribute('data-s'), 10), fret: parseInt(btn.getAttribute('data-f'), 10) };
        var arr = (state.sel[state.taskId] || []).slice();
        var i = -1;
        for (var k = 0; k < arr.length; k++) {
          if (arr[k].string === cell.string && arr[k].fret === cell.fret) { i = k; break; }
        }
        if (i >= 0) arr.splice(i, 1); else arr.push(cell);
        state.sel[state.taskId] = arr;
        Storage.setAnswer(state.taskId, arr);
        renderFretboard(container, arr);
        return;
      }
      var playBtn = e.target.closest('#play-selection');
      if (playBtn) {
        var cur = state.sel[state.taskId] || [];
        if (cur.length) {
          var sorted = cur.slice().sort(function (a, b) { return a.string - b.string || a.fret - b.fret; });
          var notes = sorted.map(function (c) { return midiName(fretMidi(c.string, c.fret)); });
          tryPlay({ notes: notes }, container);
        }
      }
    };
  }
function debounce(fn, ms) {
    var t = null;
    return function () {
      var self = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /* ---------- Форма ответа ---------- */
  function renderTaskAnswer(container, task) {
    container.innerHTML = '';
    container.onclick = null;

    if (task.kind === 'text') {
      var savedTxt = Storage.getAnswer(task.id);
      container.innerHTML =
        '<input type="text" id="answer-input" class="answer-input" placeholder="Ваш ответ..." autocomplete="off" autocapitalize="off" value="' + esc(typeof savedTxt === 'string' ? savedTxt : '') + '">' +
        '<div class="answer-input-hint">Напишите ответ и нажмите Enter или кнопку «✓ Проверить».</div>';
      var input = container.querySelector('#answer-input');
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') checkCurrent(); });
      input.addEventListener('input', debounce(function () { Storage.setAnswer(task.id, input.value); }, 300));
    } else if (task.kind === 'choice') {
      var savedIdx = parseInt(Storage.getAnswer(task.id), 10);
      container.innerHTML = '<div class="option-list">' + task.options.map(function (opt, i) {
        return '<button class="option-btn' + (i === savedIdx ? ' selected' : '') + '" data-i="' + i + '" value="' + i + '">' + esc(opt) + '</button>';
      }).join('') + '</div>';
      container.onclick = function (e) {
        var b = e.target.closest('.option-btn');
        if (!b) return;
        var i = parseInt(b.getAttribute('data-i'), 10);
        Storage.setAnswer(task.id, i);
        var all = container.querySelectorAll('.option-btn');
        for (var k = 0; k < all.length; k++) all[k].classList.toggle('selected', k === i);
      };
    } else if (task.kind === 'fretboard') {
      var savedCells = Storage.getAnswer(task.id);
      if (!Array.isArray(savedCells)) savedCells = [];
      state.sel[task.id] = savedCells;
      renderFretboard(container, savedCells);
    }
  }

  function collectCurrentAnswer() {
    var task = currentTask();
    if (!task) return '';
    if (task.kind === 'text') {
      var inp = $('#answer-input');
      return inp ? inp.value : '';
    }
    if (task.kind === 'choice') {
      var idx = parseInt(Storage.getAnswer(task.id), 10);
      return isNaN(idx) ? -1 : idx;
    }
    if (task.kind === 'fretboard') return state.sel[task.id] || [];
    return '';
  }

  /* ---------- Проверка ---------- */
  function checkCurrent() {
    var task = currentTask();
    if (!task) return;
    var answer = collectCurrentAnswer();
    if (task.kind === 'choice' && answer < 0) {
      renderResult(task, { pass: false, message: 'Сначала выберите один из вариантов ответа.' });
      return;
    }
    var res = Runner.check(task, answer);
    renderResult(task, res);
    if (res.pass) {
      Storage.setSolved(task.id, true);
      if ((state.hintsCount[task.id] || 0) > 0) Storage.setHinted(task.id, true);
      updateTaskStatus();
      renderGlobalProgress();
    }
  }

  function fmtAnswer(v) {
    if (v === null || typeof v === 'undefined') return '—';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    return String(v);
  }

  function renderResult(task, res) {
    $('#results-card').classList.remove('hidden');
    $('#results-summary').innerHTML =
      '<div class="results-summary ' + (res.pass ? 'summary-ok' : 'summary-error') + '">' +
      (res.pass ? '✅ ' : '❌ ') + esc(res.message) + '</div>';
    if (res.pass) {
      $('#results-list').innerHTML = '';
    } else {
      $('#results-list').innerHTML =
        '<div class="result fail"><div class="result-head">Ваш ответ</div>' +
        '<div class="result-line"><code>' + esc(fmtAnswer(res.actual)) + '</code></div></div>';
    }
  }
/* ---------- Страница задачи ---------- */
  function showTask() {
    var task = currentTask();
    if (!task) { location.hash = '#t-' + state.topicId; return; }
    var topic = currentTopic();
    var diff = DIFF[task.difficulty] || DIFF[1];

    $('#task-difficulty').textContent = diff.label;
    $('#task-difficulty').className = 'badge ' + diff.cls;
    $('#task-topic-label').textContent = topic.icon + ' ' + topic.title;
    $('#task-title').textContent = task.title;
    $('#task-question').innerHTML = fmtText(task.question);
    $('#task-status').textContent = statusLabel(task.id);

    $('#play-area').innerHTML = '';
    if (task.play) {
      var btnPlay = document.createElement('button');
      btnPlay.className = 'btn-play';
      btnPlay.textContent = '🔊 Сыграть пример';
      btnPlay.addEventListener('click', function () { tryPlay(task.play, $('#play-area')); });
      $('#play-area').appendChild(btnPlay);
    }

    if (typeof state.hintsCount[task.id] !== 'number') state.hintsCount[task.id] = 0;
    var hc = state.hintsCount[task.id];
    var hints = task.hints || [];
    $('#hints-block').innerHTML = hints.slice(0, hc).map(function (h) {
      return '<div class="hint">💡 ' + esc(h) + '</div>';
    }).join('');
    $('#btn-hint').disabled = hc >= hints.length && hints.length > 0;
    $('#btn-hint').textContent = (hc >= hints.length && hints.length) ? 'Подсказок больше нет' : '💡 Показать подсказку';
    $('#results-card').classList.add('hidden');

    renderTaskAnswer($('#answer-area'), task);
  }

  function showNextHint(task) {
    if (!task || !task.hints || !task.hints.length) return;
    state.hintsCount[task.id] = (state.hintsCount[task.id] || 0) + 1;
    Storage.setHinted(task.id, true);
    var shown = task.hints.slice(0, state.hintsCount[task.id]);
    $('#hints-block').innerHTML = shown.map(function (h) {
      return '<div class="hint">💡 ' + esc(h) + '</div>';
    }).join('');
    if (state.hintsCount[task.id] >= task.hints.length) {
      $('#btn-hint').textContent = 'Подсказок больше нет';
      $('#btn-hint').disabled = true;
    }
    updateTaskStatus();
  }

  function showSolution(task) {
    if (!task) return;
    Storage.setSolved(task.id, true);
    Storage.setHinted(task.id, true);
    $('#hints-block').innerHTML = '';
    $('#results-summary').innerHTML = '<div class="summary-partial">Задача отмечена как «решена с подсказкой» ✨</div>';
    $('#results-list').innerHTML =
      '<div class="solution-title">📖 Ответ и пояснение</div>' +
      '<div class="solution-code">' + esc(task.solution) + '</div>' +
      (task.solutionNote ? '<div class="solution-note">' + esc(task.solutionNote) + '</div>' : '');
    $('#results-card').classList.remove('hidden');
    updateTaskStatus();
    renderGlobalProgress();
  }

  /* ---------- Модалки ---------- */
  var modalCb = null;
  function openModal(title, body, cb) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;
    modalCb = cb;
    $('#modal-backdrop').classList.remove('hidden');
  }
  function closeModal(ok) {
    $('#modal-backdrop').classList.add('hidden');
    if (ok && modalCb) { var cb = modalCb; modalCb = null; cb(); }
  }

  /* ---------- Теория ---------- */
  function openTheory(topicId) {
    var topic = getTopic(topicId);
    if (!topic) return;
    $('#theory-topic-icon').textContent = topic.icon;
    $('#theory-topic-title').textContent = topic.title;
    $('#theory-content').innerHTML = (topic.theory || []).map(function (sec, i) {
      var playHtml = sec.play ? '<button class="btn-play theory-play" data-thplay="' + i + '">🔊 Прослушать</button>' : '';
      return '<div class="theory-section"><h3 class="theory-h">' + (i + 1) + '. ' + esc(sec.h) + '</h3>' +
        fmtText(sec.text) +
        (sec.code ? '<pre class="inline-code solution-code">' + esc(sec.code) + '</pre>' : '') +
        playHtml + '</div>';
    }).join('');
    $('#theory-backdrop').classList.remove('hidden');
  }
  function closeTheory() { $('#theory-backdrop').classList.add('hidden'); }

  /* ---------- Навигация ---------- */
  function resetOrder(topic) {
    state.orderTopic = topic.id;
    state.order = topic.tasks.map(function (t) { return t.id; });
    state.index = 0;
  }

  function navigate() {
    var h = location.hash || '';
    if (h.indexOf('#task-') === 0) {
      var parts = h.slice(6).split('/');
      var tid = parts[0], tkid = parts[1];
      var topic = getTopic(tid);
      if (!topic) { location.hash = ''; return; }
      state.topicId = tid;
      if (state.orderTopic !== tid) resetOrder(topic);
      state.taskId = tkid;
      state.index = state.order.indexOf(tkid);
      if (state.index < 0) {
        var fallback = state.order[0];
        if (fallback && fallback !== tkid) {
          location.replace('#task-' + tid + '/' + fallback);
          return;
        }
        state.index = 0;
        state.taskId = fallback || tkid;
      }
      showView('task');
      showTask();
    } else if (h.indexOf('#t-') === 0) {
      var id2 = h.slice(3);
      var t2 = getTopic(id2);
      if (!t2) { location.hash = ''; return; }
      state.topicId = id2;
      if (state.orderTopic !== id2) resetOrder(t2);
      showView('topic');
      renderTopic();
    } else {
      state.topicId = null;
      showView('home');
      renderHome();
    }
    renderGlobalProgress();
  }
/* ---------- События ---------- */
  function bindEvents() {
    $('#btn-home').addEventListener('click', function () { location.hash = ''; });
    $('#btn-back-home').addEventListener('click', function () { location.hash = ''; });
    $('#btn-reset-progress').addEventListener('click', function () {
      openModal('Сбросить прогресс?', 'Все отметки «решено» и сохранённые ответы будут удалены. Это действие нельзя отменить.', function () {
        Storage.resetAll();
        state.sel = {};
        renderHome();
      });
    });
    $('#btn-back-topic').addEventListener('click', function () { location.hash = '#t-' + state.topicId; });

    $('#btn-shuffle').addEventListener('click', function () {
      var topic = currentTopic();
      if (!topic) return;
      state.order = shuffle(topic.tasks.map(function (t) { return t.id; }));
      state.orderTopic = topic.id;
      renderTopic();
    });
    $('#btn-shuffle-task').addEventListener('click', function () {
      var topic = currentTopic();
      if (!topic) return;
      var vis = visibleTasks(topic);
      if (vis.length < 2) return;
      var idx;
      do { idx = Math.floor(Math.random() * vis.length); } while (vis[idx].id === state.taskId);
      location.hash = '#task-' + state.topicId + '/' + vis[idx].id;
    });
    $('#btn-next-task').addEventListener('click', function () {
      var topic = currentTopic();
      if (!topic) return;
      var vis = visibleTasks(topic);
      if (!vis.length) return;
      var pos = -1;
      for (var i = 0; i < vis.length; i++) if (vis[i].id === state.taskId) { pos = i; break; }
      var next = vis[(pos + 1) % vis.length];
      location.hash = '#task-' + state.topicId + '/' + next.id;
    });

    $('#btn-check').addEventListener('click', checkCurrent);
    $('#btn-reset').addEventListener('click', function () {
      var task = currentTask();
      if (!task) return;
      Storage.setAnswer(task.id, task.kind === 'choice' ? null : (task.kind === 'fretboard' ? [] : ''));
      state.sel[task.id] = [];
      $('#results-card').classList.add('hidden');
      renderTaskAnswer($('#answer-area'), task);
    });
    $('#btn-hint').addEventListener('click', function () { showNextHint(currentTask()); });
    $('#btn-solution').addEventListener('click', function () {
      openModal('Показать решение?', 'Задача будет отмечена как «решена с подсказкой» ✨', function () {
        showSolution(currentTask());
      });
    });

    $('#btn-theory').addEventListener('click', function () { openTheory(state.topicId); });
    $('#btn-theory-task').addEventListener('click', function () { openTheory(state.topicId); });
    $('#theory-close').addEventListener('click', closeTheory);
    $('#theory-start').addEventListener('click', closeTheory);
    $('#theory-backdrop').addEventListener('click', function (e) { if (e.target === $('#theory-backdrop')) closeTheory(); });
    $('#theory-content').addEventListener('click', function (e) {
      var b = e.target.closest('[data-thplay]');
      if (!b) return;
      var t = getTopic(state.topicId);
      var sec = t && t.theory ? t.theory[parseInt(b.getAttribute('data-thplay'), 10)] : null;
      if (sec && sec.play) { tryPlay(sec.play, $('#theory-content')); }
    });

    $('#topic-filters').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (btn) { state.filter = btn.getAttribute('data-filter'); renderTopic(); }
    });
    $('#task-list').addEventListener('click', function (e) {
      var item = e.target.closest('[data-goto]');
      if (item) location.hash = item.getAttribute('data-goto');
    });

    $('#modal-ok').addEventListener('click', function () { closeModal(true); });
    $('#modal-cancel').addEventListener('click', function () { closeModal(false); });
    $('#modal-backdrop').addEventListener('click', function (e) { if (e.target === $('#modal-backdrop')) closeModal(false); });

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 'Enter') checkCurrent();
      if (e.key === 'Escape') { closeModal(false); closeTheory(); }
    });

    window.addEventListener('hashchange', navigate);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindEvents();
    navigate();
  });
})();