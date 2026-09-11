/* audio.js — микро-синтезатор на Web Audio API (без библиотек).
   Показывает ноты, интервалы, аккорды и гаммы прямо в браузере.

   Устойчивость:
   - создание AudioContext и генерация звука обёрнуты в try/catch;
   - контекст «будим» при каждом проигрывании (мобильные браузеры и
     автоплей-политика создают контекст в состоянии 'suspended');
   - если контекст так и не проснулся — создаём новый и пробуем ещё раз;
   - play() возвращает boolean, чтобы интерфейс мог показать внятное
     сообщение вместо тихого «ничего не произошло». */
var Audio = (function () {
  var ctx = null;
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

  function tone(f, t0, dur, vol) {
    var c = getCtx();
    if (!c || !isFinite(f)) return false;
    try {
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.014);
      g.gain.setValueAtTime(vol, t0 + Math.max(0.06, dur - 0.08));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
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
    var t0 = c.currentTime + 0.03;
    try {
      if (opts.simult) {
        for (var i = 0; i < notes.length; i++) {
          var f = freq(notes[i]);
          if (f && tone(f, t0, (opts.dur || 0.9) * 1.6, 0.2)) scheduled++;
        }
      } else {
        var gap = opts.gap || 0.2;
        var dur = opts.dur || 0.6;
        for (var j = 0; j < notes.length; j++) {
          var fj = freq(notes[j]);
          if (fj) {
            if (tone(fj, t0, dur, 0.2)) scheduled++;
            t0 += gap;
          }
        }
      }
    } catch (e) {
      return false;
    }
    return scheduled > 0;
  }

  function schedule(spec) {
    if (spec.note) return playNotes([spec.note], { simult: true, dur: 0.9 });
    if (spec.interval) return playNotes(spec.interval, { gap: 0.34, dur: 0.62 });
    if (spec.chord) return playNotes(spec.chord, { simult: true, dur: 1.0 });
    if (spec.scale) return playNotes(spec.scale, { gap: 0.22, dur: 0.55 });
    if (spec.notes) return playNotes(spec.notes, { gap: 0.2, dur: 0.5 });
    if (spec.click) {
      var bpm = spec.click.bpm || 80;
      var beats = spec.click.beats || 4;
      var names = [];
      for (var k = 0; k < beats; k++) names.push(k === 0 ? 'C6' : 'G5');
      return playNotes(names, { gap: 60 / bpm, dur: 0.08 });
    }
    return false;
  }

  /* Универсальный вход: {note} | {interval} | {chord} | {scale} | {notes} | {click}.
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
    resume: function () { resumeCtx(); }
  };
})();