// ---------------------------------------------------------------------------
// Procedural WebAudio SFX + a light music bed. No external files.
// All sound is synthesized so the game stays a single self-contained bundle.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let started = false;
  let muted = false;
  let musicTimer = null;

  function ensure() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.55;
      sfxGain.connect(master);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.22;
      musicGain.connect(master);
    } catch (e) { ctx = null; }
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (!started) { started = true; startMusic(); }
  }

  // one-shot tone
  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx || muted) return;
    when = when || ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, when);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(when); o.stop(when + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, when) {
    if (!ctx || muted) return;
    when = when || ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(when);
  }

  const SFX = {
    dig: function () { noise(0.14, 0.35, 900); tone(160, 0.1, 'square', 0.12, 0, 90); },
    reveal: function () { tone(520, 0.06, 'triangle', 0.15); },
    flag: function () { tone(680, 0.05, 'square', 0.14); tone(920, 0.06, 'square', 0.1, ctx ? ctx.currentTime + 0.04 : 0); },
    unflag: function () { tone(400, 0.06, 'square', 0.12); },
    find: function () { // fossil found — happy arpeggio
      const t = ctx ? ctx.currentTime : 0;
      tone(523, 0.09, 'triangle', 0.22, t);
      tone(659, 0.09, 'triangle', 0.22, t + 0.08);
      tone(784, 0.14, 'triangle', 0.22, t + 0.16);
      tone(1046, 0.2, 'triangle', 0.2, t + 0.26);
    },
    ore: function () {
      const t = ctx ? ctx.currentTime : 0;
      tone(700, 0.07, 'square', 0.16, t);
      tone(1000, 0.1, 'square', 0.16, t + 0.06);
    },
    hazard: function () { // hit a hazard
      noise(0.3, 0.4, 500);
      tone(200, 0.3, 'sawtooth', 0.2, 0, 60);
    },
    coin: function () {
      const t = ctx ? ctx.currentTime : 0;
      tone(988, 0.05, 'square', 0.12, t);
      tone(1319, 0.08, 'square', 0.12, t + 0.05);
    },
    buy: function () {
      const t = ctx ? ctx.currentTime : 0;
      tone(440, 0.08, 'triangle', 0.2, t);
      tone(660, 0.08, 'triangle', 0.2, t + 0.07);
      tone(880, 0.12, 'triangle', 0.18, t + 0.14);
    },
    place: function () { noise(0.1, 0.25, 700); tone(300, 0.08, 'square', 0.12); },
    complete: function () { // skeleton assembled — fanfare
      const t = ctx ? ctx.currentTime : 0;
      const seq = [523, 659, 784, 1046, 784, 1046, 1318];
      for (let i = 0; i < seq.length; i++) tone(seq[i], 0.16, 'triangle', 0.2, t + i * 0.1);
    },
    click: function () { tone(600, 0.03, 'square', 0.1); },
    error: function () { tone(180, 0.12, 'sawtooth', 0.16, 0, 120); },
    tab: function () { tone(520, 0.04, 'triangle', 0.12); tone(700, 0.05, 'triangle', 0.1, ctx ? ctx.currentTime + 0.03 : 0); },
    newarea: function () {
      const t = ctx ? ctx.currentTime : 0;
      const seq = [392, 523, 659, 784, 1046];
      for (let i = 0; i < seq.length; i++) tone(seq[i], 0.18, 'triangle', 0.2, t + i * 0.09);
    },
    levelup: function () {
      const t = ctx ? ctx.currentTime : 0;
      tone(659, 0.1, 'triangle', 0.2, t);
      tone(880, 0.1, 'triangle', 0.2, t + 0.09);
      tone(1174, 0.22, 'triangle', 0.2, t + 0.18);
    },
  };

  // --- Music: gentle looping progression, calm "museum" feel ------------
  // Pentatonic-ish melody over a slow chord bass. Scheduled bar by bar.
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
  const ROOT = 220; // A3
  const CHORDS = [
    [0, 4, 7], [-3, 0, 4], [5, 9, 12], [2, 5, 9],
  ];
  let bar = 0;

  function midiFreq(semi) { return ROOT * Math.pow(2, semi / 12); }

  function scheduleBar() {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + 0.05;
    const beat = 0.42;
    const chord = CHORDS[bar % CHORDS.length];
    // bass note
    softTone(midiFreq(chord[0] - 12), t0, beat * 4, 0.16, 'sine');
    // pad chord
    for (let i = 0; i < chord.length; i++) {
      softTone(midiFreq(chord[i]), t0, beat * 4, 0.05, 'triangle');
    }
    // melody: 4 gentle plucks, notes drawn from scale, biased by bar
    for (let b = 0; b < 4; b++) {
      if ((bar + b) % 3 === 2 && b !== 0) continue; // some rests
      const idx = (bar * 3 + b * 2 + (b % 2 ? 2 : 0)) % SCALE.length;
      const semi = SCALE[idx] + (b === 3 ? 12 : 0);
      softTone(midiFreq(semi), t0 + b * beat, beat * 0.9, 0.07, 'triangle');
    }
    bar++;
    musicTimer = setTimeout(scheduleBar, beat * 4 * 1000);
  }

  function softTone(freq, when, dur, vol, type) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.06);
    g.gain.setValueAtTime(vol, when + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(musicGain);
    o.start(when); o.stop(when + dur + 0.05);
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    scheduleBar();
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.9;
  }
  function isMuted() { return muted; }

  window.Audio2 = {
    resume: resume,
    sfx: SFX,
    setMuted: setMuted,
    isMuted: isMuted,
    play: function (name) { ensure(); if (SFX[name]) SFX[name](); },
  };
})();
