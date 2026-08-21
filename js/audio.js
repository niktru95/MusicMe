/* audio.js — микро-синтезатор на Web Audio API (без библиотек).
   Показывает ноты, интервалы, аккорды и гаммы прямо в браузере. */
var Audio = (function () {
  var ctx = null;
  var supportedFlag = !!(window.AudioContext || window.webkitAudioContext);

  function getCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
    return ctx;
  }

  function freqFromMidi(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function freq(note) {
    var m = noteMidi(note);
    return m >= 0 ? freqFromMidi(m) : null;
  }

  function tone(f, t0, dur, vol) {
    var c = getCtx();
    if (!c) return;
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
  }

  /* Проиграть массив нот последовательно или аккордом */
  function playNotes(notes, opts) {
    var c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    opts = opts || {};
    var t0 = c.currentTime + 0.03;
    if (opts.simult) {
      for (var i = 0; i < notes.length; i++) {
        var f = freq(notes[i]);
        if (f) tone(f, t0, (opts.dur || 0.9) * 1.6, 0.2);
      }
    } else {
      var gap = opts.gap || 0.2;
      var dur = opts.dur || 0.6;
      for (var j = 0; j < notes.length; j++) {
        var fj = freq(notes[j]);
        if (fj) tone(fj, t0, dur, 0.2);
        t0 += gap;
      }
    }
  }

  /* Универсальный вход: {note} | {interval} | {chord} | {scale} | {notes} */
  function play(spec) {
    if (!spec) return;
    if (spec.note) return playNotes([spec.note], { simult: true, dur: 0.9 });
    if (spec.interval) return playNotes(spec.interval, { gap: 0.34, dur: 0.62 });
    if (spec.chord) return playNotes(spec.chord, { simult: true, dur: 1.0 });
    if (spec.scale) return playNotes(spec.scale, { gap: 0.22, dur: 0.55 });
    if (spec.notes) return playNotes(spec.notes, { gap: 0.2, dur: 0.5 });
  }

  return {
    play: play,
    playNotes: playNotes,
    freq: freq,
    freqFromMidi: freqFromMidi,
    supported: function () { return supportedFlag; },
    resume: function () {
      var c = getCtx();
      if (c && c.state === 'suspended') c.resume();
    }
  };
})();