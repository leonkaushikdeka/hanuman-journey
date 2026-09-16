/* Shared config, level definitions + small helpers. Loaded first. */

const CFG = {
  lanes: [-1, 0, 1],
  zK: 0.15,
  zFar: 26,
  zResolve: 0.55,
  zGone: -2.2,

  baseSpeed: 9.5,          // attract-mode speed
  maxSpeedBonus: 6,        // extra speed a level can ramp to
  levelRamp: 0.006,        // speed gained per metre within a level
  metresPerZ: 1.6,

  spawnGapZ: 5.4,
  laneSpreadFrac: 0.255,
  horizonFrac: 0.34,
  groundFrac: 0.93,

  jumpVel: 1.3,
  gravity: 3.1,
  slideDur: 0.6,
  laneEase: 13,

  hearts: 3,
  iFrames: 1.5,            // invincibility seconds after a hit
  graceZ: 9,               // no obstacles for the first N z of a level
  ringEveryM: 220,

  // Divine Flight perk
  flightDur: 6.5,          // seconds aloft
  flightAlt: 0.32,         // hover height (fraction of screen height, up)
  flightSpeedMul: 1.22,    // extra pace while soaring
  flightEveryM: 360,       // roughly how often a flight orb appears
};

/* The four legs of Hanuman's journey. Each has its own biome, goal
   distance (metres), starting speed and monster/obstacle pool. */
const LEVELS = [
  {
    name: "Kishkindha Forest", biome: "jungle", goal: 420, speed: 8.5, obstProb: 0.22,
    // gentle intro: mostly jump/slide, a single lane-blocker, no monsters that force a dodge
    pool: ["log", "log", "snake", "vine", "rock"],
  },
  {
    name: "The Southern Shore", biome: "coast", goal: 620, speed: 11, obstProb: 0.42,
    pool: ["log", "rock", "snake", "bat", "vine", "rakshasa"],
  },
  {
    name: "Ram Setu Bridge", biome: "sea", goal: 780, speed: 12.5, obstProb: 0.46,
    pool: ["rock", "snake", "bat", "vine", "rakshasa"],
  },
  {
    name: "Lanka", biome: "lanka", goal: 950, speed: 14, obstProb: 0.5,
    pool: ["rock", "bat", "vine", "rakshasa", "demon"],
  },
];

// gameplay category for each obstacle/monster kind
const KIND = {
  log:      { cat: "jump" },   // hop over
  snake:    { cat: "jump" },   // hop over (monster)
  rock:     { cat: "lane" },   // change lane
  rakshasa: { cat: "lane" },   // change lane (monster)
  demon:    { cat: "lane" },   // change lane (big monster)
  vine:     { cat: "slide" },  // slide under
  bat:      { cat: "slide" },  // slide under (flying monster)
  coin:     { cat: "coin" },
  ring:     { cat: "ring" },
  flight:   { cat: "flight" }, // Divine Flight power-up
};

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function choice(arr) { return arr[(Math.random() * arr.length) | 0]; }
function chance(p) { return Math.random() < p; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

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

// mix two "#rrggbb" colors
function mixHex(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return `rgb(${r},${g},${bl})`;
}
