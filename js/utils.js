/* Shared config + small helpers. Loaded first; everything lives on window. */

const CFG = {
  lanes: [-1, 0, 1],       // world lane indices
  zK: 0.15,                // perspective depth constant (higher = flatter)
  zFar: 26,                // spawn distance ahead
  zResolve: 0.55,          // distance at which a collision/collect is judged
  zGone: -2.2,             // distance behind camera before removal

  baseSpeed: 9.5,          // starting forward speed (z units / sec)
  maxSpeed: 27,            // speed cap
  speedRamp: 0.05,         // speed gained per metre travelled
  metresPerZ: 1.6,         // distance conversion for the scoreboard

  spawnGapZ: 5.4,          // z-distance between obstacle rows
  laneSpreadFrac: 0.255,   // near-plane half lane spread (fraction of width)
  horizonFrac: 0.33,       // horizon height (fraction of height)
  groundFrac: 0.93,        // near ground line (fraction of height)

  // jump physics expressed as fractions of screen height (resolution independent)
  jumpVel: 1.28,           // initial upward velocity (frac/s)
  gravity: 3.1,            // downward accel (frac/s^2)
  slideDur: 0.6,           // seconds
  laneEase: 13,            // lane-change snappiness

  ringEveryM: 260,         // guaranteed ring roughly every N metres
};

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function choice(arr) { return arr[(Math.random() * arr.length) | 0]; }
function chance(p) { return Math.random() < p; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// rounded rectangle path helper
function rrect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
