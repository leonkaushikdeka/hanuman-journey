/* Persistent high score + settings via localStorage (fails gracefully). */

const Store = (() => {
  const KEY_BEST = "hanuman_run_best";
  const KEY_MUTE = "hanuman_run_mute";

  function read(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }
  function write(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) { /* ignore */ }
  }

  return {
    getBest() { return parseInt(read(KEY_BEST, "0"), 10) || 0; },
    setBest(v) { write(KEY_BEST, Math.max(0, Math.floor(v))); },
    isMuted() { return read(KEY_MUTE, "0") === "1"; },
    setMuted(m) { write(KEY_MUTE, m ? "1" : "0"); },
  };
})();
