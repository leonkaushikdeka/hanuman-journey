/* Tap-driven 1v1 encounters: a quick strike race inside the runner. */

const Duel = (() => {
  const sprite = new Image();
  sprite.decoding = "async";
  sprite.src = "assets/hanuman-runner-v2.png?v=2";

  const ENEMIES = [
    { name: "Vana Rakshasa", subtitle: "Guardian of the forest", color: "#47622b", glow: "#bdea67" },
    { name: "Shore Marauder", subtitle: "Terror of the southern shore", color: "#74442b", glow: "#ffb76a" },
    { name: "Setu Breaker", subtitle: "Storm-born raider", color: "#315878", glow: "#8de1ff" },
    { name: "Lanka Champion", subtitle: "Ravana's sworn blade", color: "#541a3a", glow: "#ff705f" },
  ];

  const s = { active: false, level: 0, hp: 12, maxHp: 12, guard: 3, enemyTimer: 1.45, entered: 0, strikeFx: 0, enemyFx: 0, combo: 0, comboT: 0, flash: 0, hitThisFrame: false, outcome: null };

  function start(level) {
    s.active = true; s.level = level; s.maxHp = 11 + level * 2; s.hp = s.maxHp;
    s.guard = 3; s.enemyTimer = 1.55; s.entered = .45; s.strikeFx = 0; s.enemyFx = 0;
    s.combo = 0; s.comboT = 0; s.flash = 0; s.hitThisFrame = false; s.outcome = null;
  }

  function strike() {
    if (!s.active || s.outcome) return false;
    s.combo = s.comboT > 0 ? Math.min(9, s.combo + 1) : 1;
    s.comboT = .52;
    const damage = 1 + (s.combo >= 6 ? 1 : 0);
    s.hp = Math.max(0, s.hp - damage); s.strikeFx = .24; s.flash = .16;
    if (s.hp <= 0) { s.outcome = "win"; s.active = false; }
    return true;
  }

  function update(dt) {
    s.hitThisFrame = false;
    if (!s.active) return s.outcome;
    s.entered = Math.max(0, s.entered - dt); s.strikeFx = Math.max(0, s.strikeFx - dt);
    s.enemyFx = Math.max(0, s.enemyFx - dt); s.flash = Math.max(0, s.flash - dt); s.comboT -= dt;
    if (s.comboT <= 0) s.combo = 0;
    if (s.entered > 0) return null;
    s.enemyTimer -= dt;
    if (s.enemyTimer <= 0) {
      s.guard--; s.enemyFx = .42; s.hitThisFrame = true; s.enemyTimer = Math.max(.86, 1.52 - s.level * .1);
      if (s.guard <= 0) { s.outcome = "loss"; s.active = false; }
    }
    return s.outcome;
  }

  function snapshot() { const enemy = ENEMIES[s.level] || ENEMIES[0]; return { ...s, enemy, hpPct: s.hp / s.maxHp }; }

  function draw(ctx, time) {
    const L = World.layout(), enemy = ENEMIES[s.level] || ENEMIES[0], u = Math.min(L.w, L.h);
    ctx.save();
    ctx.fillStyle = "rgba(5,5,7,.53)"; ctx.fillRect(0, 0, L.w, L.h);
    const light = ctx.createRadialGradient(L.cx, L.h * .55, u * .04, L.cx, L.h * .55, u * .58);
    light.addColorStop(0, "rgba(255,203,111,.16)"); light.addColorStop(.58, "rgba(0,0,0,.04)"); light.addColorStop(1, "rgba(0,0,0,.56)");
    ctx.fillStyle = light; ctx.fillRect(0, 0, L.w, L.h);
    ctx.strokeStyle = "rgba(246,200,95,.36)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L.w * .08, L.h * .76); ctx.lineTo(L.w * .92, L.h * .76); ctx.stroke();
    const pulse = 1 + Math.sin(time * 4) * .025;
    drawHanuman(ctx, L, L.w * .32 + (s.enemyFx > 0 ? -u * .018 : s.strikeFx > 0 ? u * .018 : 0), L.h * .78, u * .32 * pulse);
    drawEnemy(ctx, L, L.w * .68 + (s.strikeFx > 0 ? u * .018 : 0), L.h * .76, u * .29 * pulse, enemy);
    drawImpact(ctx, L, enemy); ctx.restore();
  }

  function drawHanuman(ctx, L, x, feetY, h) {
    ctx.save(); ctx.translate(x, feetY); const w = h * .67;
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.ellipse(0, 0, w * .48, h * .06, 0, 0, Math.PI * 2); ctx.fill();
    if (sprite.complete && sprite.naturalWidth) { ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = h * .04; ctx.shadowOffsetY = h * .018; ctx.drawImage(sprite, -w * .58, -h, w, h); }
    else { ctx.fillStyle = "#d8782b"; rrect(ctx, -w * .18, -h * .6, w * .36, h * .55, w * .12); ctx.fill(); ctx.fillStyle = "#f2c85d"; rrect(ctx, -w * .28, -h * .18, w * .56, h * .15, w * .05); ctx.fill(); }
    ctx.restore();
  }

  function drawEnemy(ctx, L, x, feetY, h, enemy) {
    const w = h * .62, bob = Math.sin(performance.now() * .005) * h * .014;
    ctx.save(); ctx.translate(x, feetY + bob);
    ctx.fillStyle = "rgba(0,0,0,.54)"; ctx.beginPath(); ctx.ellipse(0, 0, w * .5, h * .065, 0, 0, Math.PI * 2); ctx.fill();
    const glow = ctx.createRadialGradient(0, -h * .58, 2, 0, -h * .58, h * .52); glow.addColorStop(0, enemy.glow + "66"); glow.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -h * .58, h * .52, 0, Math.PI * 2); ctx.fill();
    const armor = ctx.createLinearGradient(0, -h * .76, 0, -h * .18); armor.addColorStop(0, enemy.color); armor.addColorStop(1, "#170d18"); ctx.fillStyle = armor; ctx.strokeStyle = "#170b13"; ctx.lineWidth = h * .018;
    ctx.beginPath(); ctx.moveTo(-w * .31, -h * .15); ctx.lineTo(-w * .38, -h * .57); ctx.quadraticCurveTo(0, -h * .83, w * .38, -h * .57); ctx.lineTo(w * .31, -h * .15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#b98935"; rrect(ctx, -w * .31, -h * .27, w * .62, h * .07, h * .025); ctx.fill(); ctx.fillStyle = "#241725"; rrect(ctx, -w * .25, -h * .22, w * .19, h * .21, w * .06); ctx.fill(); rrect(ctx, w * .06, -h * .22, w * .19, h * .21, w * .06); ctx.fill();
    ctx.strokeStyle = enemy.color; ctx.lineWidth = w * .17; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-w * .29, -h * .58); ctx.lineTo(-w * .5, -h * .32); ctx.stroke(); ctx.beginPath(); ctx.moveTo(w * .29, -h * .58); ctx.lineTo(w * (.5 + (s.enemyFx > 0 ? .18 : 0)), -h * (.4 + (s.enemyFx > 0 ? .16 : 0))); ctx.stroke();
    ctx.fillStyle = "#342132"; ctx.beginPath(); ctx.arc(0, -h * .72, w * .22, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#cfb587"; ctx.lineWidth = w * .08; ctx.beginPath(); ctx.moveTo(-w * .12, -h * .85); ctx.quadraticCurveTo(-w * .34, -h * 1.04, -w * .3, -h * .76); ctx.moveTo(w * .12, -h * .85); ctx.quadraticCurveTo(w * .34, -h * 1.04, w * .3, -h * .76); ctx.stroke();
    ctx.fillStyle = enemy.glow; ctx.shadowColor = enemy.glow; ctx.shadowBlur = h * .07; ctx.beginPath(); ctx.arc(-w * .075, -h * .72, w * .04, 0, Math.PI * 2); ctx.arc(w * .075, -h * .72, w * .04, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.restore();
  }

  function drawImpact(ctx, L, enemy) {
    if (s.strikeFx > 0) { const p = 1 - s.strikeFx / .24, x = L.w * (.5 + p * .13), y = L.h * (.5 - p * .05), r = L.h * (.045 + p * .03); ctx.save(); ctx.globalAlpha = 1 - p; ctx.strokeStyle = "#ffe8a0"; ctx.shadowColor = "#ffb343"; ctx.shadowBlur = 22; ctx.lineWidth = 4; for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * .25, y + Math.sin(a) * r * .25); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); } ctx.restore(); }
    if (s.enemyFx > 0) { ctx.save(); ctx.globalAlpha = s.enemyFx / .42; ctx.fillStyle = enemy.glow + "33"; ctx.fillRect(0, 0, L.w, L.h); ctx.restore(); }
  }

  return { start, strike, update, draw, snapshot, get active() { return s.active; } };
})();
