/* Tiny WebAudio SFX engine — no audio files, all synthesized.
   Also plays a gentle looping drone/arpeggio as background music. */

const Sound = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = Store.isMuted();
  let musicTimer = null;
  let started = false;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
  }

  // one-shot tone
  function tone(freq, dur, type, gain, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // pentatonic drone arpeggio, devotional feel
  const SCALE = [196.0, 233.08, 261.63, 293.66, 349.23, 392.0]; // G minor pentatonic-ish
  function musicStep() {
    if (!ctx || muted) return;
    const n = choice(SCALE);
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = n;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 1.0);
    // soft bass root every few notes
    if (chance(0.4)) tone(98, 0.9, "sine", 0.12);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === "suspended") ctx.resume();
    },
    startMusic() {
      ensure();
      if (!ctx || started) return;
      started = true;
      musicTimer = setInterval(musicStep, 520);
    },
    stopMusic() {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
      started = false;
    },
    jump() { tone(320, 0.18, "square", 0.22, 620); },
    slide() { tone(240, 0.2, "sawtooth", 0.16, 120); },
    lane() { tone(500, 0.06, "triangle", 0.14); },
    coin() { tone(880, 0.1, "square", 0.22, 1180); },
    ring() {
      tone(660, 0.12, "triangle", 0.26, 990);
      setTimeout(() => tone(990, 0.22, "triangle", 0.24, 1320), 90);
    },
    hit() { tone(140, 0.5, "sawtooth", 0.4, 60); },
    fly() {
      tone(220, 0.5, "sine", 0.24, 880);
      setTimeout(() => tone(440, 0.4, "triangle", 0.2, 1200), 120);
    },
    isMuted() { return muted; },
    toggleMute() {
      muted = !muted;
      Store.setMuted(muted);
      ensure();
      if (master) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
  };
})();
