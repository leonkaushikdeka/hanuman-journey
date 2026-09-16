/* Lightweight particle system in screen space: dust, sparkles, bursts
   and per-biome ambient motes (leaves / spray / embers / petals). */

const Particles = (() => {
  let list = [];
  let ambientCarry = 0;

  function reset() { list = []; ambientCarry = 0; }

  function add(p) { if (list.length < 260) list.push(p); }

  function dust(x, y) {
    add({
      type: "dust", x, y,
      vx: rand(-30, -90), vy: rand(-30, -70),
      g: 120, life: 0, max: rand(0.35, 0.6),
      r: rand(3, 7), col: "rgba(190,160,110,",
    });
  }

  function sparkle(x, y, col) {
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(40, 160);
      add({
        type: "spark", x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: 30, life: 0, max: rand(0.3, 0.6),
        r: rand(2, 4), col: col || "rgba(255,220,120,",
      });
    }
  }

  function burst(x, y, col) {
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(80, 320);
      add({
        type: "spark", x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        g: 380, life: 0, max: rand(0.4, 0.9),
        r: rand(2, 6), col: col || "rgba(255,90,60,",
      });
    }
  }

  // biome mote emitter (call each frame)
  function ambient(dt, biome, L) {
    ambientCarry += dt;
    const rate = biome === "lanka" ? 0.05 : 0.09;
    while (ambientCarry >= rate) {
      ambientCarry -= rate;
      spawnMote(biome, L);
    }
  }

  function spawnMote(biome, L) {
    const x = rand(0, L.w), y = rand(-20, L.h * 0.7);
    if (biome === "jungle") {
      add({ type: "leaf", x, y: rand(-20, L.h), vx: rand(-20, -50), vy: rand(15, 45),
        g: 0, life: 0, max: rand(3, 6), r: rand(4, 8), col: "rgba(120,190,90,", spin: rand(-3, 3), rot: rand(0, 6) });
    } else if (biome === "lanka") {
      add({ type: "ember", x, y: rand(L.h * 0.4, L.h), vx: rand(-10, 20), vy: rand(-40, -90),
        g: -20, life: 0, max: rand(1.4, 2.8), r: rand(1.5, 3.5), col: "rgba(255,140,50," });
    } else if (biome === "sea") {
      add({ type: "spray", x, y: rand(L.horizonY, L.h * 0.8), vx: rand(-30, -70), vy: rand(-10, 10),
        g: 0, life: 0, max: rand(1.2, 2.5), r: rand(2, 4), col: "rgba(230,245,255," });
    } else { // coast
      add({ type: "leaf", x, y: rand(-20, L.h * 0.5), vx: rand(-15, -40), vy: rand(10, 30),
        g: 0, life: 0, max: rand(3, 5), r: rand(3, 6), col: "rgba(255,235,170,", spin: rand(-2, 2), rot: rand(0, 6) });
    }
  }

  // streaming wind/energy trail while flying
  function flightTrail(x, y) {
    add({ type: "spark", x: x + rand(-8, 8), y: y + rand(-8, 8),
      vx: rand(120, 220), vy: rand(-20, 20), g: 0, life: 0, max: rand(0.3, 0.6),
      r: rand(2, 5), col: chance(0.5) ? "rgba(120,220,255," : "rgba(255,225,140," });
  }

  // petals for the victory scene
  function petal(L) {
    add({ type: "petal", x: rand(0, L.w), y: rand(-30, -5),
      vx: rand(-25, 25), vy: rand(35, 75), g: 0, life: 0, max: rand(3, 6),
      r: rand(5, 10), col: "rgba(255,180,90,", spin: rand(-2.5, 2.5), rot: rand(0, 6) });
  }

  function update(dt) {
    for (const p of list) {
      p.life += dt;
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rot += p.spin * dt;
    }
    list = list.filter((p) => p.life < p.max);
  }

  function draw(ctx) {
    for (const p of list) {
      const t = 1 - p.life / p.max;
      ctx.save();
      if (p.type === "leaf" || p.type === "petal") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.col + (0.85 * t) + ")";
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "ember" || p.type === "spark") {
        ctx.fillStyle = p.col + (p.col.endsWith(",") ? (t + ")") : (0.9 * t) + ")");
        ctx.shadowBlur = 8; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + 0.6 * t), 0, Math.PI * 2); ctx.fill();
      } else { // dust / spray
        ctx.fillStyle = p.col + (0.5 * t) + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + 0.4 * t), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  return { reset, dust, sparkle, burst, ambient, petal, flightTrail, update, draw, count: () => list.length };
})();
