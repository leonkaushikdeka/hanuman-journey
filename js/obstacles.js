/* Obstacles, collectibles and side scenery.
   Handles spawning, movement, drawing (far->near) and collision judging. */

const Obstacles = (() => {
  let list = [];
  let spawnCarry = 0;
  let sceneCarry = 0;
  let lastRingM = 0;
  let t = 0;

  const FULL = { rock: true, demon: true };     // must change lane
  const LOW = { log: true };                     // must jump
  const OVER = { arch: true };                    // must slide
  const PICK = { coin: true, ring: true };        // collectibles

  function reset() {
    list = []; spawnCarry = 0; sceneCarry = 0; lastRingM = 0; t = 0;
  }

  function spawnRow(metres) {
    const lanes = [-1, 0, 1];
    const safe = choice(lanes);
    let forceRing = false;
    if (metres - lastRingM >= CFG.ringEveryM) { forceRing = true; lastRingM = metres; }

    const obstProb = clamp(0.34 + metres * 0.00016, 0.34, 0.8);
    const types = metres > 320 ? ["log", "arch", "rock", "demon"] : ["log", "arch", "rock"];

    for (const lane of lanes) {
      if (lane === safe) {
        if (forceRing) push("ring", lane);
        else if (chance(0.5)) push("coin", lane);
        continue;
      }
      const r = Math.random();
      if (r < obstProb) push(choice(types), lane);
      else if (r < obstProb + 0.24) push("coin", lane);
    }
  }

  function spawnScenery(metres) {
    const { a } = World.biomeAt(metres);
    const side = choice([-2.3, -3.1, 2.3, 3.1]);
    let kind = "tree";
    if (a.name === "sea" || a.name === "coast") kind = choice(["pillar", "tree", "rockdeco"]);
    else if (a.name === "lanka") kind = choice(["pillar", "pillar", "rockdeco"]);
    else kind = choice(["tree", "tree", "rockdeco"]);
    list.push({ kind, lane: side, z: CFG.zFar, deco: true, passed: true, seed: Math.random() });
  }

  function push(kind, lane) {
    list.push({ kind, lane, z: CFG.zFar, passed: false, deco: false, seed: Math.random() });
  }

  function update(dt, speed, metres) {
    t += dt;
    const dz = speed * dt;

    // move + resolve
    for (const o of list) {
      o.z -= dz;
      if (!o.deco && !o.passed && o.z <= CFG.zResolve) {
        o.passed = true;
        resolve(o);
      }
    }
    // cull
    list = list.filter((o) => o.z > CFG.zGone);

    // spawn obstacle rows at fixed z spacing
    spawnCarry += dz;
    while (spawnCarry >= CFG.spawnGapZ) {
      spawnCarry -= CFG.spawnGapZ;
      spawnRow(metres);
    }
    // spawn scenery more densely
    sceneCarry += dz;
    while (sceneCarry >= 2.1) {
      sceneCarry -= 2.1;
      if (chance(0.9)) spawnScenery(metres);
    }
  }

  function resolve(o) {
    const laneMatch = Math.abs(Player.laneFloat - o.lane) < 0.55;
    if (!laneMatch) return;

    if (o.kind === "coin") { o.gone = true; Game.addCoin(); return; }
    if (o.kind === "ring") { o.gone = true; Game.addRing(); return; }
    if (LOW[o.kind]) { if (!Player.airborne) Game.onHit(); return; }
    if (OVER[o.kind]) { if (!Player.sliding) Game.onHit(); return; }
    if (FULL[o.kind]) { Game.onHit(); return; }
  }

  // ---------- drawing ----------
  function draw(ctx) {
    const L = World.layout();
    // far -> near
    const drawList = list.slice().sort((a, b) => b.z - a.z);
    for (const o of drawList) {
      if (o.gone) continue;
      const z = o.z;
      const sc = World.scaleAtZ(z);
      const cx = World.laneX(o.lane, z);
      const baseY = World.projY(z);
      const unit = L.h * sc;
      const w = L.spread * sc * 0.82;
      const fade = clamp((z - CFG.zGone) / 2, 0, 1);
      ctx.save();
      ctx.globalAlpha = fade;
      switch (o.kind) {
        case "coin": drawCoin(ctx, cx, baseY, unit); break;
        case "ring": drawRing(ctx, cx, baseY, unit); break;
        case "log": drawLog(ctx, cx, baseY, unit, w); break;
        case "arch": drawArch(ctx, cx, baseY, unit, w); break;
        case "rock": drawRock(ctx, cx, baseY, unit, w); break;
        case "demon": drawDemon(ctx, cx, baseY, unit, w); break;
        case "tree": drawTree(ctx, cx, baseY, unit, o.seed); break;
        case "pillar": drawPillar(ctx, cx, baseY, unit); break;
        case "rockdeco": drawRock(ctx, cx, baseY, unit, unit * 0.5); break;
      }
      ctx.restore();
    }
  }

  function shadow(ctx, cx, baseY, r) {
    ctx.save();
    ctx.globalAlpha *= 0.3;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, baseY, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCoin(ctx, cx, baseY, unit) {
    const r = unit * 0.05;
    const cy = baseY - unit * 0.1 + Math.sin(t * 4) * unit * 0.01;
    const sx = Math.abs(Math.cos(t * 3.5 + cx));
    shadow(ctx, cx, baseY, r * 0.9);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx * 0.7 + 0.3, 1);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    g.addColorStop(0, "#fff3b0"); g.addColorStop(1, "#e0a020");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#b9860b"; ctx.lineWidth = r * 0.14; ctx.stroke();
    ctx.fillStyle = "#b9860b";
    ctx.font = `bold ${r * 1.1}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("ॐ", 0, r * 0.08);
    ctx.restore();
  }

  function drawRing(ctx, cx, baseY, unit) {
    const R = unit * 0.062;
    const cy = baseY - unit * 0.14 + Math.sin(t * 3) * unit * 0.012;
    shadow(ctx, cx, baseY, R);
    // glow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 1.4);
    const glow = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 2.4);
    glow.addColorStop(0, "rgba(255,230,150,0.55)");
    glow.addColorStop(1, "rgba(255,210,90,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, R * 2.4, 0, Math.PI * 2); ctx.fill();
    // band
    ctx.lineWidth = R * 0.42;
    const bg = ctx.createLinearGradient(-R, -R, R, R);
    bg.addColorStop(0, "#fff3b0"); bg.addColorStop(0.5, "#f2c744"); bg.addColorStop(1, "#c98a10");
    ctx.strokeStyle = bg;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    // gem
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.35); ctx.lineTo(R * 0.3, -R * 0.95);
    ctx.lineTo(0, -R * 0.6); ctx.lineTo(-R * 0.3, -R * 0.95);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawLog(ctx, cx, baseY, unit, w) {
    const h = unit * 0.055;
    const y = baseY - h;
    shadow(ctx, cx, baseY, w * 0.55);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#9a6a3a"); g.addColorStop(1, "#5c3d1e");
    ctx.fillStyle = g;
    rrect(ctx, cx - w * 0.5, y, w, h, h * 0.5); ctx.fill();
    // end grain
    ctx.fillStyle = "#c79a5a";
    ctx.beginPath(); ctx.ellipse(cx - w * 0.5, y + h * 0.5, h * 0.28, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8a5a2a";
    ctx.beginPath(); ctx.ellipse(cx - w * 0.5, y + h * 0.5, h * 0.14, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawArch(ctx, cx, baseY, unit, w) {
    const postH = unit * 0.2;
    const beamY = baseY - postH;
    const pw = w * 0.16;
    shadow(ctx, cx, baseY, w * 0.55);
    const g = ctx.createLinearGradient(0, beamY, 0, baseY);
    g.addColorStop(0, "#d14a2a"); g.addColorStop(1, "#8a2a12");
    ctx.fillStyle = g;
    // posts
    ctx.fillRect(cx - w * 0.55, beamY, pw, postH);
    ctx.fillRect(cx + w * 0.55 - pw, beamY, pw, postH);
    // decorative top beam (torana)
    rrect(ctx, cx - w * 0.62, beamY - unit * 0.05, w * 1.24, unit * 0.06, unit * 0.02); ctx.fill();
    ctx.fillStyle = "#ffd15c";
    rrect(ctx, cx - w * 0.62, beamY - unit * 0.012, w * 1.24, unit * 0.014, unit * 0.006); ctx.fill();
    // small finials
    ctx.fillStyle = "#8a2a12";
    ctx.beginPath();
    ctx.moveTo(cx, beamY - unit * 0.05);
    ctx.lineTo(cx - unit * 0.02, beamY - unit * 0.085);
    ctx.lineTo(cx + unit * 0.02, beamY - unit * 0.085);
    ctx.closePath(); ctx.fill();
  }

  function drawRock(ctx, cx, baseY, unit, w) {
    const h = unit * 0.14;
    shadow(ctx, cx, baseY, w * 0.55);
    const g = ctx.createLinearGradient(0, baseY - h, 0, baseY);
    g.addColorStop(0, "#9aa1a8"); g.addColorStop(1, "#565c63");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.5, baseY);
    ctx.quadraticCurveTo(cx - w * 0.55, baseY - h * 0.8, cx - w * 0.2, baseY - h);
    ctx.quadraticCurveTo(cx + w * 0.1, baseY - h * 1.1, cx + w * 0.4, baseY - h * 0.7);
    ctx.quadraticCurveTo(cx + w * 0.58, baseY - h * 0.3, cx + w * 0.5, baseY);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath(); ctx.ellipse(cx - w * 0.1, baseY - h * 0.7, w * 0.14, h * 0.18, -0.4, 0, Math.PI * 2); ctx.fill();
  }

  function drawDemon(ctx, cx, baseY, unit, w) {
    const h = unit * 0.22;
    const top = baseY - h;
    shadow(ctx, cx, baseY, w * 0.55);
    // body
    const g = ctx.createLinearGradient(0, top, 0, baseY);
    g.addColorStop(0, "#3a2140"); g.addColorStop(1, "#1c0f22");
    ctx.fillStyle = g;
    rrect(ctx, cx - w * 0.32, top + h * 0.28, w * 0.64, h * 0.72, w * 0.1); ctx.fill();
    // head
    ctx.beginPath(); ctx.arc(cx, top + h * 0.24, h * 0.22, 0, Math.PI * 2); ctx.fill();
    // horns
    ctx.strokeStyle = "#20111a"; ctx.lineWidth = w * 0.07; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - h * 0.12, top + h * 0.1); ctx.lineTo(cx - h * 0.26, top - h * 0.06);
    ctx.moveTo(cx + h * 0.12, top + h * 0.1); ctx.lineTo(cx + h * 0.26, top - h * 0.06);
    ctx.stroke();
    // eyes
    ctx.fillStyle = "#ff3b30";
    ctx.beginPath(); ctx.arc(cx - h * 0.08, top + h * 0.24, h * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + h * 0.08, top + h * 0.24, h * 0.045, 0, Math.PI * 2); ctx.fill();
    // mouth
    ctx.strokeStyle = "#ff3b30"; ctx.lineWidth = w * 0.03;
    ctx.beginPath(); ctx.arc(cx, top + h * 0.33, h * 0.07, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  }

  function drawTree(ctx, cx, baseY, unit, seed) {
    const h = unit * (0.3 + seed * 0.15);
    ctx.fillStyle = "#5c3d1e";
    ctx.fillRect(cx - unit * 0.015, baseY - h * 0.4, unit * 0.03, h * 0.4);
    const g = ctx.createRadialGradient(cx, baseY - h * 0.6, 1, cx, baseY - h * 0.6, h * 0.4);
    g.addColorStop(0, "#5fae55"); g.addColorStop(1, "#2f6b32");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, baseY - h * 0.55, h * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - h * 0.2, baseY - h * 0.4, h * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + h * 0.2, baseY - h * 0.42, h * 0.22, 0, Math.PI * 2); ctx.fill();
  }

  function drawPillar(ctx, cx, baseY, unit) {
    const h = unit * 0.42;
    const w = unit * 0.07;
    const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    g.addColorStop(0, "#c9a86a"); g.addColorStop(0.5, "#f0d9a0"); g.addColorStop(1, "#a5824a");
    ctx.fillStyle = g;
    ctx.fillRect(cx - w * 0.5, baseY - h, w, h);
    ctx.fillRect(cx - w * 0.8, baseY - h, w * 1.6, h * 0.08);
    ctx.fillRect(cx - w * 0.8, baseY - h * 0.06, w * 1.6, h * 0.06);
  }

  return { reset, update, draw };
})();
