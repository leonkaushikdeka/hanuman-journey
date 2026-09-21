/* Obstacles, monsters, collectibles and per-biome scenery.
   Spawns from the current level's pool, moves everything toward the
   camera, draws far->near, and judges collisions by KIND category. */

const Obstacles = (() => {
  let list = [];
  let spawnCarry = 0, sceneCarry = 0, lastRingM = 0, lastFlightM = 0, t = 0;
  const asuraArt = new Image();
  asuraArt.decoding = "async";
  asuraArt.src = "assets/asura-warrior-v1.png?v=1";

  function reset() { list = []; spawnCarry = 0; sceneCarry = 0; lastRingM = 0; lastFlightM = 0; t = 0; }

  function push(kind, lane) {
    list.push({ kind, lane, z: CFG.zFar, passed: false, deco: false, seed: Math.random(), variant: randInt(0, 3) });
  }

  function spawnRow(cfg) {
    const lanes = [-1, 0, 1];
    const safe = choice(lanes);
    let forceRing = false, forceFlight = false;
    if (cfg.metres - lastFlightM >= CFG.flightEveryM) { forceFlight = true; lastFlightM = cfg.metres; }
    else if (cfg.metres - lastRingM >= CFG.ringEveryM) { forceRing = true; lastRingM = cfg.metres; }

    for (const lane of lanes) {
      if (lane === safe) {
        if (forceFlight) push("flight", lane);
        else if (forceRing) push("ring", lane);
        else if (chance(0.5)) push("coin", lane);
        continue;
      }
      const r = Math.random();
      if (r < cfg.obstProb) push(choice(cfg.pool), lane);
      else if (r < cfg.obstProb + 0.24) push("coin", lane);
    }
  }

  function spawnScenery(biome) {
    // The remastered biome plates already contain dense, perspective-correct scenery.
    // Keep the old procedural decorations only as a fallback while a plate is loading.
    if (World.backgroundReady && World.backgroundReady(biome)) return;
    const side = choice([-2.3, -3.1, 2.3, 3.1]);
    let kind = "tree";
    if (biome === "jungle") kind = choice(["tree", "tree", "bush", "rockdeco"]);
    else if (biome === "coast") kind = choice(["palm", "rockdeco", "bush"]);
    else if (biome === "sea") kind = choice(["postbig", "rockdeco", "postbig"]);
    else kind = choice(["pillar", "torch", "rockdeco"]);
    list.push({ kind, lane: side, z: CFG.zFar, deco: true, passed: true, seed: Math.random() });
  }

  function update(dt, speed, cfg) {
    t += dt;
    const dz = speed * dt;
    let fightStarted = false;
    for (const o of list) {
      o.z -= dz;
      if (!o.deco && !o.passed && o.z <= CFG.zResolve) {
        o.passed = true;
        fightStarted = resolve(o) || fightStarted;
        if (fightStarted) break;
      }
    }
    list = list.filter((o) => o.z > CFG.zGone && !o.gone);

    if (cfg.spawn) {
      spawnCarry += dz;
      while (spawnCarry >= CFG.spawnGapZ) { spawnCarry -= CFG.spawnGapZ; spawnRow(cfg); }
    } else {
      spawnCarry = 0;
    }
    sceneCarry += dz;
    while (sceneCarry >= 2.1) { sceneCarry -= 2.1; if (chance(0.9)) spawnScenery(cfg.biome); }
    return fightStarted;
  }

  function resolve(o) {
    const cat = (KIND[o.kind] || {}).cat;
    const laneMatch = Math.abs(Player.laneFloat - o.lane) < 0.55;
    // collectibles are magneted while flying, otherwise need the same lane
    if (cat === "coin") { if (Player.flying || laneMatch) { o.gone = true; Game.addCoin(); } return; }
    if (cat === "ring") { if (Player.flying || laneMatch) { o.gone = true; Game.addRing(); } return; }
    if (cat === "flight") { if (Player.flying || laneMatch) { o.gone = true; Game.activateFlight(); } return; }
    if (!laneMatch) return;
    if (Player.invincible || Player.flying) return; // soaring over all danger
    if (cat === "fight") {
      o.gone = true;
      return Game.beginAsuraClash(o.variant);
    }
  }

  // ---------------- drawing ----------------
  function draw(ctx) {
    const L = World.layout();
    const drawList = list.slice().sort((a, b) => b.z - a.z);
    for (const o of drawList) {
      const sc = World.scaleAtZ(o.z);
      const cx = World.laneX(o.lane, o.z);
      const baseY = World.projY(o.z);
      const unit = L.h * sc;
      const w = L.spread * sc * 0.82;
      ctx.save();
      ctx.globalAlpha = clamp((o.z - CFG.zGone) / 2, 0, 1);
      switch (o.kind) {
        case "coin": drawCoin(ctx, cx, baseY, unit); break;
        case "ring": drawRing(ctx, cx, baseY, unit); break;
        case "flight": drawFlightOrb(ctx, cx, baseY, unit); break;
        case "log": drawLog(ctx, cx, baseY, unit, w); break;
        case "vine": drawVine(ctx, cx, baseY, unit, w); break;
        case "rock": drawRock(ctx, cx, baseY, unit, w); break;
        case "asura": drawAsura(ctx, cx, baseY, unit, w, o.variant); break;
        case "tree": drawTree(ctx, cx, baseY, unit, o.seed); break;
        case "bush": drawBush(ctx, cx, baseY, unit, o.seed); break;
        case "palm": drawPalm(ctx, cx, baseY, unit, o.seed); break;
        case "pillar": drawPillar(ctx, cx, baseY, unit); break;
        case "postbig": drawPost(ctx, cx, baseY, unit); break;
        case "torch": drawTorch(ctx, cx, baseY, unit); break;
        case "rockdeco": drawRock(ctx, cx, baseY, unit, unit * 0.5); break;
      }
      ctx.restore();
    }
  }

  function shadow(ctx, cx, baseY, r) {
    ctx.save(); ctx.globalAlpha *= 0.3; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(cx, baseY, r, r * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  // ---- collectibles ----
  function drawCoin(ctx, cx, baseY, unit) {
    const r = unit * 0.05, cy = baseY - unit * 0.1 + Math.sin(t * 4 + cx) * unit * 0.01;
    const sx = Math.abs(Math.cos(t * 3.5 + cx));
    shadow(ctx, cx, baseY, r * 0.9);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sx * 0.7 + 0.3, 1);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    g.addColorStop(0, "#fff3b0"); g.addColorStop(1, "#e0a020");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#b9860b"; ctx.lineWidth = r * 0.14; ctx.stroke();
    ctx.fillStyle = "#b9860b"; ctx.font = `bold ${r * 1.1}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("ॐ", 0, r * 0.08);
    ctx.restore();
  }

  function drawRing(ctx, cx, baseY, unit) {
    const R = unit * 0.062, cy = baseY - unit * 0.14 + Math.sin(t * 3 + cx) * unit * 0.012;
    shadow(ctx, cx, baseY, R);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 1.4);
    const glow = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 2.4);
    glow.addColorStop(0, "rgba(255,230,150,0.55)"); glow.addColorStop(1, "rgba(255,210,90,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, R * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = R * 0.42;
    const bg = ctx.createLinearGradient(-R, -R, R, R);
    bg.addColorStop(0, "#fff3b0"); bg.addColorStop(0.5, "#f2c744"); bg.addColorStop(1, "#c98a10");
    ctx.strokeStyle = bg; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath(); ctx.moveTo(0, -R * 1.35); ctx.lineTo(R * 0.3, -R * 0.95); ctx.lineTo(0, -R * 0.6); ctx.lineTo(-R * 0.3, -R * 0.95); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawFlightOrb(ctx, cx, baseY, unit) {
    const R = unit * 0.07;
    const cy = baseY - unit * 0.15 + Math.sin(t * 3 + cx) * unit * 0.015;
    shadow(ctx, cx, baseY, R * 0.9);
    ctx.save(); ctx.translate(cx, cy);
    const glow = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 2.6);
    glow.addColorStop(0, "rgba(180,235,255,0.85)");
    glow.addColorStop(0.5, "rgba(120,200,255,0.35)");
    glow.addColorStop(1, "rgba(120,200,255,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, R * 2.6, 0, Math.PI * 2); ctx.fill();
    // wings
    ctx.fillStyle = "rgba(255,246,205,0.92)";
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * R * 0.7, -R * 0.1);
      ctx.quadraticCurveTo(dir * R * 1.9, -R * 0.7, dir * R * 1.7, R * 0.15);
      ctx.quadraticCurveTo(dir * R * 1.2, -R * 0.02, dir * R * 0.7, R * 0.22);
      ctx.closePath(); ctx.fill();
    }
    // core
    const core = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 1, 0, 0, R);
    core.addColorStop(0, "#ffffff"); core.addColorStop(0.6, "#bfe9ff"); core.addColorStop(1, "#5ab0e0");
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    // swirl
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = R * 0.14; ctx.lineCap = "round";
    ctx.save(); ctx.rotate(t * 3);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0.2, Math.PI * 1.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.32, Math.PI, Math.PI * 2.1); ctx.stroke();
    ctx.restore();
    // up chevron
    ctx.strokeStyle = "#2b6d8a"; ctx.lineWidth = R * 0.16; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(-R * 0.35, R * 0.15); ctx.lineTo(0, -R * 0.35); ctx.lineTo(R * 0.35, R * 0.15); ctx.stroke();
    ctx.restore();
  }

  // ---- obstacles ----
  function drawLog(ctx, cx, baseY, unit, w) {
    const h = unit * 0.055, y = baseY - h;
    shadow(ctx, cx, baseY, w * 0.55);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#9a6a3a"); g.addColorStop(1, "#5c3d1e");
    ctx.fillStyle = g; rrect(ctx, cx - w * 0.5, y, w, h, h * 0.5); ctx.fill();
    ctx.fillStyle = "#c79a5a"; ctx.beginPath(); ctx.ellipse(cx - w * 0.5, y + h * 0.5, h * 0.28, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8a5a2a"; ctx.beginPath(); ctx.ellipse(cx - w * 0.5, y + h * 0.5, h * 0.14, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawVine(ctx, cx, baseY, unit, w) {
    // overhead branch with hanging tendrils -> slide under
    const beamY = baseY - unit * 0.2;
    shadow(ctx, cx, baseY, w * 0.5);
    ctx.strokeStyle = "#5c3d1e"; ctx.lineWidth = unit * 0.02; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - w * 0.62, beamY - unit * 0.01); ctx.quadraticCurveTo(cx, beamY - unit * 0.03, cx + w * 0.62, beamY); ctx.stroke();
    ctx.strokeStyle = "#3f8f3a"; ctx.lineWidth = unit * 0.008;
    ctx.fillStyle = "#4faa46";
    for (let i = -3; i <= 3; i++) {
      const hx = cx + i * w * 0.16;
      const hang = unit * (0.06 + 0.03 * ((i + 3) % 3)) + Math.sin(t * 2 + i) * unit * 0.01;
      ctx.beginPath(); ctx.moveTo(hx, beamY); ctx.lineTo(hx, beamY + hang); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(hx, beamY + hang, unit * 0.02, unit * 0.035, 0.4, 0, Math.PI * 2); ctx.fill();
    }
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

  // ---- monsters ----
  function drawAsura(ctx, cx, baseY, unit, w, variant) {
    if (asuraArt.complete && asuraArt.naturalWidth) {
      const h = unit * .38, artW = h * (asuraArt.naturalWidth / asuraArt.naturalHeight);
      shadow(ctx, cx, baseY, artW * .34);
      ctx.save(); ctx.translate(0, Math.sin(t * 4 + cx) * unit * .008);
      ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = h * .025; ctx.shadowOffsetY = h * .012;
      ctx.drawImage(asuraArt, cx - artW * .5, baseY - h, artW, h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(13,7,13,.82)"; rrect(ctx, cx - artW * .33, baseY - h * .29, artW * .66, h * .036, h * .015); ctx.fill();
      ctx.fillStyle = ["#a366d4", "#bf615e", "#4c99c9", "#b24465"][variant % 4];
      rrect(ctx, cx - artW * .29, baseY - h * .275, artW * .58, h * .012, h * .006); ctx.fill();
      ctx.restore();
      return;
    }
    const palettes = [
      ["#3f285b", "#a366d4", "#ffb14d"],
      ["#52313a", "#bf615e", "#ffcc6c"],
      ["#213f58", "#4c99c9", "#b9ebff"],
      ["#4f1e37", "#b24465", "#ff755c"],
    ];
    const [body, trim, eye] = palettes[variant % palettes.length];
    const h = unit * 0.31, top = baseY - h, bob = Math.sin(t * 4 + cx) * unit * .009;
    shadow(ctx, cx, baseY, w * .54);
    ctx.save(); ctx.translate(0, bob);
    const aura = ctx.createRadialGradient(cx, top + h * .35, 2, cx, top + h * .35, h * .75);
    aura.addColorStop(0, eye + "32"); aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, top + h * .38, h * .75, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(0, top, 0, baseY);
    g.addColorStop(0, trim); g.addColorStop(.32, body); g.addColorStop(1, "#130c16");
    ctx.fillStyle = g; rrect(ctx, cx - w * .34, top + h * .3, w * .68, h * .7, w * .12); ctx.fill();
    ctx.fillStyle = "#1b111a"; rrect(ctx, cx - w * .42, baseY - h * .22, w * .2, h * .22, w * .06); ctx.fill(); rrect(ctx, cx + w * .22, baseY - h * .22, w * .2, h * .22, w * .06); ctx.fill();
    ctx.strokeStyle = body; ctx.lineWidth = w * .13; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - w * .29, top + h * .48); ctx.lineTo(cx - w * .47, top + h * .76); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + w * .29, top + h * .48); ctx.lineTo(cx + w * .47, top + h * .65); ctx.stroke();
    ctx.fillStyle = trim; rrect(ctx, cx - w * .3, top + h * .67, w * .6, h * .08, h * .025); ctx.fill();
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, top + h * .22, h * .23, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#d7bc8a"; ctx.lineWidth = w * .055;
    ctx.beginPath(); ctx.moveTo(cx - h * .13, top + h * .1); ctx.quadraticCurveTo(cx - h * .32, top - h * .08, cx - h * .27, top - h * .17); ctx.moveTo(cx + h * .13, top + h * .1); ctx.quadraticCurveTo(cx + h * .32, top - h * .08, cx + h * .27, top - h * .17); ctx.stroke();
    ctx.fillStyle = eye; ctx.shadowColor = eye; ctx.shadowBlur = unit * .035;
    ctx.beginPath(); ctx.arc(cx - h * .09, top + h * .22, h * .047, 0, Math.PI * 2); ctx.arc(cx + h * .09, top + h * .22, h * .047, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.restore();
  }

  function drawBat(ctx, cx, baseY, unit, w) {
    const cy = baseY - unit * 0.16 + Math.sin(t * 3 + cx) * unit * 0.02;
    shadow(ctx, cx, baseY, w * 0.35);
    const flap = Math.sin(t * 12 + cx) * 0.5;
    ctx.fillStyle = "#2a1830";
    // wings
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + dir * w * 0.3, cy - unit * 0.06 - flap * unit * 0.05, cx + dir * w * 0.55, cy + unit * 0.01);
      ctx.quadraticCurveTo(cx + dir * w * 0.32, cy + unit * 0.03, cx + dir * w * 0.2, cy + unit * 0.05);
      ctx.quadraticCurveTo(cx + dir * w * 0.15, cy + unit * 0.02, cx, cy);
      ctx.closePath(); ctx.fill();
    }
    // body
    ctx.fillStyle = "#1a0f22";
    ctx.beginPath(); ctx.ellipse(cx, cy, unit * 0.04, unit * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    // ears
    ctx.beginPath(); ctx.moveTo(cx - unit * 0.02, cy - unit * 0.04); ctx.lineTo(cx - unit * 0.035, cy - unit * 0.075); ctx.lineTo(cx - unit * 0.005, cy - unit * 0.05); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + unit * 0.02, cy - unit * 0.04); ctx.lineTo(cx + unit * 0.035, cy - unit * 0.075); ctx.lineTo(cx + unit * 0.005, cy - unit * 0.05); ctx.fill();
    // eyes
    ctx.fillStyle = "#ff3b30"; ctx.shadowBlur = unit * 0.02; ctx.shadowColor = "#ff3b30";
    ctx.beginPath(); ctx.arc(cx - unit * 0.015, cy - unit * 0.01, unit * 0.008, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + unit * 0.015, cy - unit * 0.01, unit * 0.008, 0, Math.PI * 2); ctx.fill();
  }

  function drawRakshasa(ctx, cx, baseY, unit, w) {
    const h = unit * 0.22, top = baseY - h;
    const bob = Math.sin(t * 4 + cx) * unit * 0.008;
    shadow(ctx, cx, baseY, w * 0.55);
    ctx.save(); ctx.translate(0, bob);
    // body
    const g = ctx.createLinearGradient(0, top, 0, baseY);
    g.addColorStop(0, "#4a6a2a"); g.addColorStop(1, "#243812");
    ctx.fillStyle = g;
    rrect(ctx, cx - w * 0.34, top + h * 0.3, w * 0.68, h * 0.7, w * 0.12); ctx.fill();
    // arms
    ctx.strokeStyle = "#3a5420"; ctx.lineWidth = w * 0.12; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - w * 0.3, top + h * 0.45); ctx.lineTo(cx - w * 0.42, top + h * 0.75); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + w * 0.3, top + h * 0.45); ctx.lineTo(cx + w * 0.42, top + h * 0.75); ctx.stroke();
    // head
    ctx.fillStyle = "#557a30";
    ctx.beginPath(); ctx.arc(cx, top + h * 0.24, h * 0.23, 0, Math.PI * 2); ctx.fill();
    // horns
    ctx.strokeStyle = "#e8dcc0"; ctx.lineWidth = w * 0.06;
    ctx.beginPath(); ctx.moveTo(cx - h * 0.14, top + h * 0.1); ctx.lineTo(cx - h * 0.26, top - h * 0.05);
    ctx.moveTo(cx + h * 0.14, top + h * 0.1); ctx.lineTo(cx + h * 0.26, top - h * 0.05); ctx.stroke();
    // eyes
    ctx.fillStyle = "#ffdd33"; ctx.shadowBlur = unit * 0.02; ctx.shadowColor = "#ffcc00";
    ctx.beginPath(); ctx.arc(cx - h * 0.09, top + h * 0.22, h * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + h * 0.09, top + h * 0.22, h * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(cx - h * 0.09, top + h * 0.22, h * 0.02, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + h * 0.09, top + h * 0.22, h * 0.02, 0, Math.PI * 2); ctx.fill();
    // fangs
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(cx - h * 0.06, top + h * 0.34); ctx.lineTo(cx - h * 0.02, top + h * 0.34); ctx.lineTo(cx - h * 0.04, top + h * 0.42); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + h * 0.06, top + h * 0.34); ctx.lineTo(cx + h * 0.02, top + h * 0.34); ctx.lineTo(cx + h * 0.04, top + h * 0.42); ctx.fill();
    ctx.restore();
  }

  function drawDemon(ctx, cx, baseY, unit, w) {
    const h = unit * 0.27, top = baseY - h;
    const bob = Math.sin(t * 3 + cx) * unit * 0.01;
    shadow(ctx, cx, baseY, w * 0.6);
    ctx.save(); ctx.translate(0, bob);
    const g = ctx.createLinearGradient(0, top, 0, baseY);
    g.addColorStop(0, "#4a1440"); g.addColorStop(1, "#1c0820");
    ctx.fillStyle = g;
    rrect(ctx, cx - w * 0.4, top + h * 0.26, w * 0.8, h * 0.74, w * 0.12); ctx.fill();
    // shoulders spikes
    ctx.fillStyle = "#2a0e28";
    for (const dx of [-w * 0.36, w * 0.36]) {
      ctx.beginPath(); ctx.moveTo(cx + dx, top + h * 0.34); ctx.lineTo(cx + dx * 1.2, top + h * 0.18); ctx.lineTo(cx + dx * 0.7, top + h * 0.34); ctx.fill();
    }
    // arms with club
    ctx.strokeStyle = "#3a1030"; ctx.lineWidth = w * 0.14; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx + w * 0.34, top + h * 0.4); ctx.lineTo(cx + w * 0.5, top + h * 0.2); ctx.stroke();
    ctx.fillStyle = "#5a2a18";
    ctx.beginPath(); ctx.arc(cx + w * 0.5, top + h * 0.14, w * 0.12, 0, Math.PI * 2); ctx.fill();
    // head
    ctx.fillStyle = "#5a1a50";
    ctx.beginPath(); ctx.arc(cx, top + h * 0.2, h * 0.24, 0, Math.PI * 2); ctx.fill();
    // big horns
    ctx.strokeStyle = "#160616"; ctx.lineWidth = w * 0.09;
    ctx.beginPath(); ctx.moveTo(cx - h * 0.16, top + h * 0.06); ctx.quadraticCurveTo(cx - h * 0.36, top - h * 0.12, cx - h * 0.2, top - h * 0.2);
    ctx.moveTo(cx + h * 0.16, top + h * 0.06); ctx.quadraticCurveTo(cx + h * 0.36, top - h * 0.12, cx + h * 0.2, top - h * 0.2); ctx.stroke();
    // glowing eyes
    ctx.fillStyle = "#ff2a2a"; ctx.shadowBlur = unit * 0.03; ctx.shadowColor = "#ff2a2a";
    ctx.beginPath(); ctx.arc(cx - h * 0.1, top + h * 0.18, h * 0.055, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + h * 0.1, top + h * 0.18, h * 0.055, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // grin
    ctx.strokeStyle = "#fff"; ctx.lineWidth = w * 0.03;
    ctx.beginPath(); ctx.arc(cx, top + h * 0.28, h * 0.09, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.restore();
  }

  // ---- scenery ----
  function drawTree(ctx, cx, baseY, unit, seed) {
    const h = unit * (0.34 + seed * 0.16);
    ctx.fillStyle = "#5c3d1e"; ctx.fillRect(cx - unit * 0.017, baseY - h * 0.4, unit * 0.034, h * 0.4);
    const g = ctx.createRadialGradient(cx, baseY - h * 0.62, 1, cx, baseY - h * 0.62, h * 0.42);
    g.addColorStop(0, "#63b459"); g.addColorStop(1, "#2f6b32");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, baseY - h * 0.58, h * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - h * 0.22, baseY - h * 0.42, h * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + h * 0.22, baseY - h * 0.44, h * 0.24, 0, Math.PI * 2); ctx.fill();
  }

  function drawBush(ctx, cx, baseY, unit, seed) {
    const h = unit * (0.1 + seed * 0.05);
    const g = ctx.createRadialGradient(cx, baseY - h, 1, cx, baseY - h, h * 1.4);
    g.addColorStop(0, "#5aa64f"); g.addColorStop(1, "#2f6b32");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx - h * 0.6, baseY - h * 0.4, h * 0.7, 0, Math.PI * 2);
    ctx.arc(cx + h * 0.6, baseY - h * 0.4, h * 0.7, 0, Math.PI * 2);
    ctx.arc(cx, baseY - h, h * 0.9, 0, Math.PI * 2); ctx.fill();
  }

  function drawPalm(ctx, cx, baseY, unit, seed) {
    const h = unit * (0.4 + seed * 0.2);
    ctx.strokeStyle = "#7a5326"; ctx.lineWidth = unit * 0.03; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.quadraticCurveTo(cx + unit * 0.05, baseY - h * 0.6, cx + unit * 0.02, baseY - h); ctx.stroke();
    ctx.fillStyle = "#3f8f3a";
    for (let a = 0; a < 6; a++) {
      const ang = -Math.PI / 2 + (a - 2.5) * 0.5;
      ctx.save(); ctx.translate(cx + unit * 0.02, baseY - h); ctx.rotate(ang);
      ctx.beginPath(); ctx.ellipse(unit * 0.12, 0, unit * 0.13, unit * 0.03, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawPillar(ctx, cx, baseY, unit) {
    const h = unit * 0.44, w = unit * 0.08;
    const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    g.addColorStop(0, "#8a6a3a"); g.addColorStop(0.5, "#c9a86a"); g.addColorStop(1, "#6a4a24");
    ctx.fillStyle = g;
    ctx.fillRect(cx - w * 0.5, baseY - h, w, h);
    ctx.fillRect(cx - w * 0.85, baseY - h, w * 1.7, h * 0.08);
    ctx.fillRect(cx - w * 0.85, baseY - h * 0.06, w * 1.7, h * 0.06);
  }

  function drawPost(ctx, cx, baseY, unit) {
    const h = unit * 0.3, w = unit * 0.09;
    const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    g.addColorStop(0, "#7c848d"); g.addColorStop(0.5, "#c2c8cf"); g.addColorStop(1, "#5c646d");
    ctx.fillStyle = g; ctx.fillRect(cx - w * 0.5, baseY - h, w, h);
    ctx.fillStyle = "#ffd15c"; ctx.fillRect(cx - w * 0.5, baseY - h, w, h * 0.05);
  }

  function drawTorch(ctx, cx, baseY, unit) {
    const h = unit * 0.3;
    ctx.strokeStyle = "#2a1a10"; ctx.lineWidth = unit * 0.03;
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.lineTo(cx, baseY - h); ctx.stroke();
    const fy = baseY - h;
    const glow = ctx.createRadialGradient(cx, fy, 1, cx, fy, unit * 0.1);
    glow.addColorStop(0, "rgba(255,180,60,0.9)"); glow.addColorStop(1, "rgba(255,120,30,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, fy, unit * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffcf6a";
    const fl = unit * (0.03 + 0.01 * Math.sin(t * 12 + cx));
    ctx.beginPath(); ctx.moveTo(cx - fl, fy); ctx.quadraticCurveTo(cx, fy - fl * 2.5, cx + fl, fy); ctx.fill();
  }

  return { reset, update, draw };
})();
