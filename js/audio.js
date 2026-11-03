/* audio.js — микро-синтезатор на Web Audio API (без библиотек).
   Показывает ноты, интервалы, аккорды и гаммы прямо в браузере.

   Устойчивость:
   - создание AudioContext и генерация звука обёрнуты в try/catch;
   - контекст «будим» при каждом проигрывании (мобильные браузеры и
     автоплей-политика создают контекст в состоянии 'suspended');
   - если контекст так и не проснулся — создаём новый и пробуем ещё раз;
   - play() возвращает boolean, чтобы интерфейс мог показать внятное
     сообщение вместо тихого «ничего не произошло». */
var Synth = (function () {
  var ctx = null;
  var active = [];  /* звучащие осцилляторы — глушим их перед новым примером */
  var startedAt = 0;  /* performance.now() первого звука последнего примера (для тап-задач) */
  var supportedFlag = !!(window.AudioContext || window.webkitAudioContext);

  function getCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  /* Отказаться от текущего контекста (например, он «застрял» в suspended). */
  function dropCtx() {
    if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; }
  }

  /* «Разбудить» контекст и дождаться resume — иначе тон ставится в очередь,
     пока state ещё suspended, и на телефоне звука нет. */
  function resumeCtx() {
    var c = getCtx();
    if (!c) return Promise.resolve(null);
    if (c.state === 'suspended' && c.resume) {
      try {
        var p = c.resume();
        if (p && typeof p.then === 'function') {
          return p.then(function () { return c; }).catch(function () { return c; });
        }
      } catch (e) {}
    }
    return Promise.resolve(c);
  }

  function freqFromMidi(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function freq(note) {
    var m = noteMidi(note);
    return m >= 0 ? freqFromMidi(m) : null;
  }

  /* pluck — «щипок струны»: пила через закрывающийся фильтр и быстрый спад громкости.
     Без pluck — синус (метроном). */
  function tone(f, t0, dur, vol, pluck) {
    var c = getCtx();
    if (!c || !isFinite(f)) return false;
    try {
      var o = c.createOscillator();
      var g = c.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      if (pluck) {
        o.type = 'sawtooth';
        var lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(Math.min(f * 8, 12000), t0);
        lp.frequency.exponentialRampToValueAtTime(f * 1.5, t0 + dur);
        g.gain.linearRampToValueAtTime(vol * 0.8, t0 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(lp);
        lp.connect(g);
      } else {
        o.type = 'sine';
        g.gain.linearRampToValueAtTime(vol, t0 + 0.014);
        g.gain.setValueAtTime(vol, t0 + Math.max(0.06, dur - 0.08));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
      }
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
      active.push(o);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Проиграть массив нот последовательно или аккордом.
     Возвращает true, если звук успешно запланирован. */
  function playNotes(notes, opts) {
    var c = getCtx();
    if (!c || !Array.isArray(notes) || !notes.length) return false;
    opts = opts || {};
    var scheduled = 0;
    var t0 = c.currentTime + 0.03 + (opts.at || 0);
    var pluck = opts.pluck !== false;
    try {
      if (opts.simult) {
        for (var i = 0; i < notes.length; i++) {
          var f = freq(notes[i]);
          if (f && tone(f, t0 + i * 0.015, (opts.dur || 0.9) * 1.6, 0.2, pluck)) scheduled++;
        }
      } else {
        var gap = opts.gap || 0.2;
        var dur = opts.dur || 0.6;
        for (var j = 0; j < notes.length; j++) {
          var fj = freq(notes[j]);
          if (fj) {
            if (tone(fj, t0, dur, 0.2, pluck)) scheduled++;
            t0 += gap;
          }
        }
      }
    } catch (e) {
      return false;
    }
    return scheduled > 0;
  }

  function stopAll() {
    active.forEach(function (o) { try { o.stop(); } catch (e) {} });
    active = [];
  }

  /* Метроном: beats щелчков, sub щелчков на долю (2 = восьмые), swing — вторая восьмая на 2/3 доли (шаффл) */
  function clicks(spec) {
    var c = getCtx();
    var beat = 60 / (spec.bpm || 80);
    var beats = spec.beats || 4;
    var sub = spec.sub || 1;
    var t0 = c.currentTime + 0.03;
    var scheduled = 0;
    for (var k = 0; k < beats; k++) {
      var part = k % sub;
      var off = Math.floor(k / sub) * beat + (part ? (spec.swing && sub === 2 ? 2 / 3 : part / sub) * beat : 0);
      if (tone(freq(k === 0 ? 'C6' : part ? 'D5' : 'G5'), t0 + off, 0.08, 0.2, false)) scheduled++;
    }
    return scheduled > 0;
  }

  function schedule(spec) {
    stopAll();
    var c = getCtx();
    startedAt = performance.now() + 30 + ((c && c.outputLatency) || 0) * 1000;
    if (spec.chords) {
      /* последовательность аккордов: [[...], [...]] */
      return spec.chords.map(function (ch, i) { return playNotes(ch, { simult: true, dur: 0.75, at: i * 1.15 }); }).some(Boolean);
    }
    if (spec.harmonic) return playNotes(spec.harmonic, { simult: true, dur: 1.0 });
    if (spec.note) return playNotes([spec.note], { simult: true, dur: 0.9 });
    if (spec.interval) return playNotes(spec.interval, { gap: 0.34, dur: 0.62 });
    if (spec.chord) return playNotes(spec.chord, { simult: true, dur: 1.0 });
    if (spec.scale) return playNotes(spec.scale, { gap: 0.22, dur: 0.55 });
    if (spec.notes) return playNotes(spec.notes, { gap: 0.2, dur: 0.5 });
    if (spec.click) return clicks(spec.click);
    return false;
  }

  /* Универсальный вход: {note} | {interval} | {harmonic} | {chord} | {chords} | {scale} | {notes} | {click: {bpm, beats, sub, swing}}.
     Возвращает Promise<boolean> (совместимо с .then). */
  function play(spec) {
    if (!spec || !supportedFlag) return Promise.resolve(false);
    if (!getCtx()) return Promise.resolve(false);
    function runOnce() {
      return resumeCtx().then(function (c) {
        if (!c) return false;
        return schedule(spec);
      });
    }
    return runOnce().then(function (ok) {
      if (ok) return true;
      var c = getCtx();
      if (c && c.state === 'suspended') {
        dropCtx();
        if (!getCtx()) return false;
        return runOnce();
      }
      return false;
    });
  }

  return {
    play: play,
    playNotes: playNotes,
    freq: freq,
    freqFromMidi: freqFromMidi,
    supported: function () { return supportedFlag; },
    stop: stopAll,
    startedAt: function () { return startedAt; },
    resume: function () { resumeCtx(); }
  };
})();