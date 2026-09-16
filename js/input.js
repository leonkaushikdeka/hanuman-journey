/* Keyboard + touch input. Emits high-level actions to a handler.
   Actions: "left", "right", "up", "down", "start", "pause". */

const Input = (() => {
  let handler = () => {};

  function bind(fn) { handler = fn; }

  // ---- Keyboard ----
  window.addEventListener("keydown", (e) => {
    let action = null;
    switch (e.key) {
      case "ArrowLeft": case "a": case "A": action = "left"; break;
      case "ArrowRight": case "d": case "D": action = "right"; break;
      case "ArrowUp": case "w": case "W": case " ": action = "up"; break;
      case "ArrowDown": case "s": case "S": action = "down"; break;
      case "Enter": action = "start"; break;
      case "p": case "P": case "Escape": action = "pause"; break;
    }
    if (action) { e.preventDefault(); handler(action); }
  }, { passive: false });

  // ---- Touch / swipe ----
  const canvas = document.getElementById("game");
  let sx = 0, sy = 0, st = 0, tracking = false;
  const SWIPE = 26;      // min px for a directional swipe
  const TAP_MS = 260;    // max ms for a tap
  const TAP_MOVE = 16;   // max px movement to still count as tap

  function down(x, y) { sx = x; sy = y; st = performance.now(); tracking = true; }
  function up(x, y) {
    if (!tracking) return;
    tracking = false;
    const dx = x - sx, dy = y - sy;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const dt = performance.now() - st;

    if (adx < TAP_MOVE && ady < TAP_MOVE && dt < TAP_MS) {
      handler("up"); // tap = jump
      return;
    }
    if (adx < SWIPE && ady < SWIPE) return;
    if (adx > ady) handler(dx > 0 ? "right" : "left");
    else handler(dy > 0 ? "down" : "up");
  }

  canvas.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    down(t.clientX, t.clientY);
  }, { passive: true });

  canvas.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    up(t.clientX, t.clientY);
  }, { passive: true });

  // Mouse (desktop convenience: click canvas to jump, drag to swipe)
  canvas.addEventListener("mousedown", (e) => down(e.clientX, e.clientY));
  canvas.addEventListener("mouseup", (e) => up(e.clientX, e.clientY));

  return { bind };
})();
