/* Hanuman — the player. Back-view lane runner with a run cycle,
   jump-tuck, slide-squash, running dust and post-hit invincibility. */

const Player = (() => {
  const s = {
    laneTarget: 0, laneFloat: 0,
    yFrac: 0, vy: 0, airborne: false,
    sliding: false, slideT: 0,
    runPhase: 0, lastSin: 0,
    inv: 0,
    flying: false, flightT: 0, flyPose: false,
  };

  function reset() {
    s.laneTarget = 0; s.laneFloat = 0;
    s.yFrac = 0; s.vy = 0; s.airborne = false;
    s.sliding = false; s.slideT = 0;
    s.runPhase = 0; s.lastSin = 0; s.inv = 0;
    s.flying = false; s.flightT = 0; s.flyPose = false;
  }

  function left() { if (s.laneTarget > -1) { s.laneTarget--; Sound.lane(); } }
  function right() { if (s.laneTarget < 1) { s.laneTarget++; Sound.lane(); } }
  function jump() { if (!s.flying && !s.airborne && !s.sliding) { s.vy = -CFG.jumpVel; s.airborne = true; Sound.jump(); } }
  function slide() { if (!s.flying && !s.sliding && !s.airborne) { s.sliding = true; s.slideT = CFG.slideDur; Sound.slide(); } }
  function setInvincible(t) { s.inv = t; }
  function startFlight(dur) { s.flying = true; s.flightT = dur; s.airborne = false; s.vy = 0; s.sliding = false; }

  function update(dt, speed) {
    s.laneFloat += (s.laneTarget - s.laneFloat) * Math.min(1, CFG.laneEase * dt);

    if (s.flying) {
      s.flightT -= dt;
      const hover = -CFG.flightAlt + Math.sin(s.runPhase * 2) * 0.012;
      s.yFrac += (hover - s.yFrac) * Math.min(1, 6 * dt);
      s.airborne = false; s.vy = 0; s.sliding = false; s.flyPose = true;
      if (s.flightT <= 0) s.flying = false;
    } else if (s.airborne) {
      s.yFrac += s.vy * dt;
      s.vy += CFG.gravity * dt;
      if (s.yFrac >= 0) { s.yFrac = 0; s.vy = 0; s.airborne = false; }
    } else if (s.flyPose) {
      // glide back down once flight ends
      s.yFrac += (0 - s.yFrac) * Math.min(1, 6 * dt);
      if (s.yFrac > -0.02) { s.yFrac = 0; s.flyPose = false; }
    }

    if (s.sliding) { s.slideT -= dt; if (s.slideT <= 0) s.sliding = false; }
    if (s.inv > 0) s.inv -= dt;

    const grounded = !s.airborne && !s.flyPose;
    const prev = s.lastSin;
    s.runPhase += dt * (7 + speed * 0.22);
    s.lastSin = Math.sin(s.runPhase);
    if (grounded && prev > 0 && s.lastSin <= 0 && !s.sliding) {
      const L = World.layout();
      Particles.dust(World.laneX(s.laneFloat, 0), L.groundY);
    }
  }

  function draw(ctx) {
    const L = World.layout();
    const x = World.laneX(s.laneFloat, 0);
    const feetY = L.groundY + s.yFrac * L.h;
    const airLift = clamp(-s.yFrac / 0.22, 0, 1);

    // shadow
    ctx.save();
    ctx.globalAlpha = 0.3 * (1 - airLift * 0.7);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x, L.groundY + L.h * 0.008, L.h * 0.09 * (1 - airLift * 0.4), L.h * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (s.flyPose) { drawFlying(ctx, L, x, feetY); return; }

    ctx.save();
    ctx.translate(x, feetY);
    if (s.sliding) ctx.scale(1.2, 0.5);
    if (s.inv > 0 && Math.floor(s.inv * 12) % 2 === 0) ctx.globalAlpha = 0.35;

    const u = L.h;
    const cw = u * 0.115;
    const legLen = u * 0.052;
    const torsoH = u * 0.088;
    const headR = u * 0.038;
    const swing = s.airborne ? 0.5 : Math.sin(s.runPhase);
    const bob = s.airborne ? -legLen * 0.5 : Math.abs(Math.cos(s.runPhase)) * u * 0.006;
    const hipY = -legLen + bob;
    const shoulderY = hipY - torsoH;

    const OUT = "#7a3d0f"; // outline color
    ctx.lineJoin = "round";

    // tail
    ctx.strokeStyle = "#d96a1e"; ctx.lineWidth = cw * 0.36; ctx.lineCap = "round";
    const tsway = Math.sin(s.runPhase * 0.8) * u * 0.02;
    ctx.beginPath();
    ctx.moveTo(-cw * 0.1, hipY + legLen * 0.4);
    ctx.quadraticCurveTo(cw * 0.95 + tsway, hipY - u * 0.02, cw * 0.72 + tsway, shoulderY - u * 0.03);
    ctx.quadraticCurveTo(cw * 0.55 + tsway, shoulderY - u * 0.09, cw * 1.02 + tsway, shoulderY - u * 0.075);
    ctx.stroke();
    ctx.fillStyle = "#8a3f10";
    ctx.beginPath(); ctx.arc(cw * 1.02 + tsway, shoulderY - u * 0.075, cw * 0.19, 0, Math.PI * 2); ctx.fill();

    // legs
    const liftL = Math.max(0, swing) * legLen * 0.75;
    const liftR = Math.max(0, -swing) * legLen * 0.75;
    limb(ctx, -cw * 0.26, hipY, legLen, liftL, cw * 0.32, "#c76a2a", OUT);
    limb(ctx, cw * 0.26, hipY, legLen, liftR, cw * 0.32, "#c76a2a", OUT);

    // torso
    const tg = ctx.createLinearGradient(0, shoulderY, 0, hipY);
    tg.addColorStop(0, "#ffa64d"); tg.addColorStop(1, "#e0550a");
    ctx.fillStyle = tg; ctx.strokeStyle = OUT; ctx.lineWidth = u * 0.004;
    ctx.beginPath();
    ctx.moveTo(-cw * 0.42, hipY);
    ctx.lineTo(cw * 0.42, hipY);
    ctx.lineTo(cw * 0.5, shoulderY + torsoH * 0.2);
    ctx.quadraticCurveTo(cw * 0.5, shoulderY, 0, shoulderY);
    ctx.quadraticCurveTo(-cw * 0.5, shoulderY, -cw * 0.5, shoulderY + torsoH * 0.2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // spine highlight
    ctx.strokeStyle = "rgba(255,220,170,0.5)"; ctx.lineWidth = u * 0.006;
    ctx.beginPath(); ctx.moveTo(0, shoulderY + torsoH * 0.15); ctx.lineTo(0, hipY - torsoH * 0.1); ctx.stroke();

    // dhoti
    ctx.fillStyle = "#ffd15c"; ctx.strokeStyle = "#c9950f"; ctx.lineWidth = u * 0.003;
    rrect(ctx, -cw * 0.46, hipY - legLen * 0.35, cw * 0.92, legLen * 0.62, cw * 0.16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f2a900";
    rrect(ctx, -cw * 0.46, hipY - legLen * 0.02, cw * 0.92, legLen * 0.16, cw * 0.1); ctx.fill();

    // arms (swing opposite legs)
    const armSw = swing * legLen * 0.5;
    limb(ctx, -cw * 0.54, shoulderY + torsoH * 0.14, torsoH * 0.78, -armSw + torsoH * 0.1, cw * 0.25, "#c76a2a", OUT);
    limb(ctx, cw * 0.54, shoulderY + torsoH * 0.14, torsoH * 0.78, armSw + torsoH * 0.1, cw * 0.25, "#c76a2a", OUT);

    // mace (gada) glowing
    ctx.save();
    ctx.translate(cw * 0.64, shoulderY + u * 0.004);
    ctx.rotate(0.22 + swing * 0.15);
    ctx.strokeStyle = "#6a3f16"; ctx.lineWidth = cw * 0.16;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -u * 0.05); ctx.stroke();
    ctx.shadowBlur = u * 0.02; ctx.shadowColor = "rgba(255,210,90,0.9)";
    const mg = ctx.createRadialGradient(-cw * 0.1, -u * 0.075, 1, 0, -u * 0.065, cw * 0.4);
    mg.addColorStop(0, "#fff3c0"); mg.addColorStop(1, "#dca018");
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(0, -u * 0.065, cw * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // head
    const headY = shoulderY - headR * 0.85;
    ctx.fillStyle = "#c76a2a"; ctx.strokeStyle = OUT; ctx.lineWidth = u * 0.003;
    ctx.beginPath(); ctx.arc(-headR * 0.92, headY, headR * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headR * 0.92, headY, headR * 0.42, 0, Math.PI * 2); ctx.fill();
    const hg = ctx.createRadialGradient(-headR * 0.3, headY - headR * 0.3, 1, 0, headY, headR * 1.35);
    hg.addColorStop(0, "#e58f48"); hg.addColorStop(1, "#a5521c");
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, headY, headR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,80,40,0.55)";
    ctx.beginPath(); ctx.arc(0, headY, headR * 0.3, 0, Math.PI * 2); ctx.fill();

    // crown with gem
    ctx.fillStyle = "#ffd15c"; ctx.strokeStyle = "#b9860b"; ctx.lineWidth = 1;
    const cyTop = headY - headR;
    ctx.beginPath();
    ctx.moveTo(-headR * 0.95, cyTop + headR * 0.35);
    ctx.lineTo(-headR * 0.6, cyTop - headR * 0.55);
    ctx.lineTo(-headR * 0.3, cyTop + headR * 0.1);
    ctx.lineTo(0, cyTop - headR * 0.75);
    ctx.lineTo(headR * 0.3, cyTop + headR * 0.1);
    ctx.lineTo(headR * 0.6, cyTop - headR * 0.55);
    ctx.lineTo(headR * 0.95, cyTop + headR * 0.35);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath(); ctx.arc(0, cyTop - headR * 0.2, headR * 0.16, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  function limb(ctx, x, topY, len, lift, w, fill, out) {
    ctx.fillStyle = fill; ctx.strokeStyle = out; ctx.lineWidth = w * 0.14;
    rrect(ctx, x - w / 2, topY - lift, w, len, w * 0.5);
    ctx.fill();
  }

  // Soaring pose: leaning body, mace raised, tail streaming, radiant aura.
  function drawFlying(ctx, L, x, feetY) {
    const u = L.h;
    const cw = u * 0.115, legLen = u * 0.052, torsoH = u * 0.09, headR = u * 0.038;
    const OUT = "#7a3d0f";

    // aura + speed streaks
    ctx.save();
    const aura = ctx.createRadialGradient(x, feetY - u * 0.05, 1, x, feetY - u * 0.05, u * 0.2);
    aura.addColorStop(0, "rgba(255,235,150,0.5)");
    aura.addColorStop(0.55, "rgba(120,200,255,0.22)");
    aura.addColorStop(1, "rgba(120,200,255,0)");
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(x, feetY - u * 0.05, u * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(190,230,255,0.5)"; ctx.lineWidth = u * 0.005;
    for (let i = -2; i <= 2; i++) {
      const y = feetY - u * 0.02 + i * u * 0.022;
      ctx.beginPath(); ctx.moveTo(x - u * 0.05, y); ctx.lineTo(x - u * 0.24 - Math.abs(i) * u * 0.01, y); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(x, feetY);
    ctx.rotate(-0.18);
    ctx.lineJoin = "round";
    const hipY = 0, shoulderY = -torsoH;

    // tail streaming behind/below
    ctx.strokeStyle = "#d96a1e"; ctx.lineWidth = cw * 0.36; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-cw * 0.1, hipY + legLen * 0.3);
    ctx.quadraticCurveTo(-cw * 1.0, hipY + legLen * 1.2, -cw * 1.4, hipY + legLen * 0.3);
    ctx.quadraticCurveTo(-cw * 1.6, hipY - legLen * 0.2, -cw * 1.25, hipY - legLen * 0.6);
    ctx.stroke();
    ctx.fillStyle = "#8a3f10";
    ctx.beginPath(); ctx.arc(-cw * 1.25, hipY - legLen * 0.6, cw * 0.19, 0, Math.PI * 2); ctx.fill();

    // legs together, trailing down
    limb(ctx, -cw * 0.14, hipY, legLen * 1.35, -legLen * 0.2, cw * 0.32, "#c76a2a", OUT);
    limb(ctx, cw * 0.16, hipY, legLen * 1.35, -legLen * 0.4, cw * 0.32, "#c76a2a", OUT);

    // torso
    const tg = ctx.createLinearGradient(0, shoulderY, 0, hipY);
    tg.addColorStop(0, "#ffa64d"); tg.addColorStop(1, "#e0550a");
    ctx.fillStyle = tg; ctx.strokeStyle = OUT; ctx.lineWidth = u * 0.004;
    ctx.beginPath();
    ctx.moveTo(-cw * 0.42, hipY);
    ctx.lineTo(cw * 0.42, hipY);
    ctx.lineTo(cw * 0.5, shoulderY + torsoH * 0.2);
    ctx.quadraticCurveTo(cw * 0.5, shoulderY, 0, shoulderY);
    ctx.quadraticCurveTo(-cw * 0.5, shoulderY, -cw * 0.5, shoulderY + torsoH * 0.2);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // dhoti
    ctx.fillStyle = "#ffd15c";
    rrect(ctx, -cw * 0.46, hipY - legLen * 0.35, cw * 0.92, legLen * 0.62, cw * 0.16); ctx.fill();

    // trailing (left) arm
    limb(ctx, -cw * 0.5, shoulderY + torsoH * 0.14, torsoH * 0.7, -torsoH * 0.15, cw * 0.24, "#c76a2a", OUT);

    // leading (right) arm raised, mace overhead
    ctx.strokeStyle = "#c76a2a"; ctx.lineWidth = cw * 0.28; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cw * 0.4, shoulderY + torsoH * 0.08); ctx.lineTo(cw * 0.56, shoulderY - torsoH * 0.5); ctx.stroke();
    ctx.save();
    ctx.shadowBlur = u * 0.02; ctx.shadowColor = "rgba(255,210,90,0.9)";
    ctx.strokeStyle = "#6a3f16"; ctx.lineWidth = cw * 0.16;
    const mx = cw * 0.62, my = shoulderY - torsoH * 0.62;
    ctx.beginPath(); ctx.moveTo(cw * 0.56, shoulderY - torsoH * 0.5); ctx.lineTo(mx, my); ctx.stroke();
    const mg = ctx.createRadialGradient(mx - cw * 0.1, my, 1, mx, my, cw * 0.4);
    mg.addColorStop(0, "#fff3c0"); mg.addColorStop(1, "#dca018");
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, cw * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // head + crown
    const headY = shoulderY - headR * 0.85;
    ctx.fillStyle = "#c76a2a"; ctx.strokeStyle = OUT; ctx.lineWidth = u * 0.003;
    ctx.beginPath(); ctx.arc(-headR * 0.92, headY, headR * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headR * 0.92, headY, headR * 0.42, 0, Math.PI * 2); ctx.fill();
    const hg = ctx.createRadialGradient(-headR * 0.3, headY - headR * 0.3, 1, 0, headY, headR * 1.35);
    hg.addColorStop(0, "#e58f48"); hg.addColorStop(1, "#a5521c");
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, headY, headR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffd15c"; ctx.strokeStyle = "#b9860b"; ctx.lineWidth = 1;
    const cyTop = headY - headR;
    ctx.beginPath();
    ctx.moveTo(-headR * 0.95, cyTop + headR * 0.35);
    ctx.lineTo(-headR * 0.6, cyTop - headR * 0.55);
    ctx.lineTo(-headR * 0.3, cyTop + headR * 0.1);
    ctx.lineTo(0, cyTop - headR * 0.75);
    ctx.lineTo(headR * 0.3, cyTop + headR * 0.1);
    ctx.lineTo(headR * 0.6, cyTop - headR * 0.55);
    ctx.lineTo(headR * 0.95, cyTop + headR * 0.35);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath(); ctx.arc(0, cyTop - headR * 0.2, headR * 0.16, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  return {
    reset, left, right, jump, slide, update, draw, setInvincible, startFlight,
    get laneFloat() { return s.laneFloat; },
    get laneTarget() { return s.laneTarget; },
    get airborne() { return s.airborne; },
    get sliding() { return s.sliding; },
    get invincible() { return s.inv > 0; },
    get flying() { return s.flying; },
    get flightRemaining() { return Math.max(0, s.flightT); },
  };
})();
