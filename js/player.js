/* Hanuman — the player character. Back-view lane runner with
   run cycle, jump-tuck and slide-squash animations, drawn with canvas paths. */

const Player = (() => {
  const s = {
    laneTarget: 0,
    laneFloat: 0,
    yFrac: 0,      // vertical offset as fraction of screen height (negative = up)
    vy: 0,
    airborne: false,
    sliding: false,
    slideT: 0,
    runPhase: 0,
    hurt: 0,       // flash timer on collision
  };

  function reset() {
    s.laneTarget = 0; s.laneFloat = 0;
    s.yFrac = 0; s.vy = 0;
    s.airborne = false; s.sliding = false; s.slideT = 0;
    s.runPhase = 0; s.hurt = 0;
  }

  function left() {
    if (s.laneTarget > -1) { s.laneTarget--; Sound.lane(); }
  }
  function right() {
    if (s.laneTarget < 1) { s.laneTarget++; Sound.lane(); }
  }
  function jump() {
    if (!s.airborne && !s.sliding) {
      s.vy = -CFG.jumpVel; s.airborne = true; Sound.jump();
    }
  }
  function slide() {
    if (!s.sliding && !s.airborne) {
      s.sliding = true; s.slideT = CFG.slideDur; Sound.slide();
    }
  }

  function update(dt, speed) {
    // lane easing
    s.laneFloat += (s.laneTarget - s.laneFloat) * Math.min(1, CFG.laneEase * dt);

    // jump physics
    if (s.airborne) {
      s.yFrac += s.vy * dt;
      s.vy += CFG.gravity * dt;
      if (s.yFrac >= 0) { s.yFrac = 0; s.vy = 0; s.airborne = false; }
    }

    // slide timer
    if (s.sliding) {
      s.slideT -= dt;
      if (s.slideT <= 0) s.sliding = false;
    }

    // run cycle (freezes mid-air)
    if (!s.airborne) s.runPhase += dt * (7 + speed * 0.22);
    if (s.hurt > 0) s.hurt -= dt;
  }

  function draw(ctx) {
    const L = World.layout();
    const x = World.laneX(s.laneFloat, 0);
    const feetY = L.groundY + s.yFrac * L.h;

    // ---- shadow ----
    const shW = L.h * 0.09;
    const airLift = clamp(-s.yFrac / 0.22, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.32 * (1 - airLift * 0.7);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x, L.groundY + L.h * 0.008, shW * (1 - airLift * 0.4), shW * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ---- body transform ----
    ctx.save();
    ctx.translate(x, feetY);
    if (s.sliding) ctx.scale(1.18, 0.5);
    if (s.hurt > 0 && (Math.floor(s.hurt * 20) % 2 === 0)) ctx.globalAlpha = 0.4;

    const u = L.h;                 // size unit
    const cw = u * 0.11;           // char width
    const legLen = u * 0.05;
    const torsoH = u * 0.085;
    const headR = u * 0.036;
    const swing = s.airborne ? 0.5 : Math.sin(s.runPhase);
    const bob = s.airborne ? -legLen * 0.5 : Math.abs(Math.cos(s.runPhase)) * u * 0.006;

    const hipY = -legLen + bob;
    const shoulderY = hipY - torsoH;

    // ---- tail (curved, behind) ----
    ctx.strokeStyle = "#d96a1e";
    ctx.lineWidth = cw * 0.34;
    ctx.lineCap = "round";
    ctx.beginPath();
    const tsway = Math.sin(s.runPhase * 0.8) * u * 0.02;
    ctx.moveTo(-cw * 0.1, hipY + legLen * 0.4);
    ctx.quadraticCurveTo(cw * 0.9 + tsway, hipY - u * 0.02, cw * 0.7 + tsway, shoulderY - u * 0.03);
    ctx.quadraticCurveTo(cw * 0.55 + tsway, shoulderY - u * 0.08, cw * 1.0 + tsway, shoulderY - u * 0.075);
    ctx.stroke();
    // tail tip
    ctx.fillStyle = "#8a3f10";
    ctx.beginPath();
    ctx.arc(cw * 1.0 + tsway, shoulderY - u * 0.075, cw * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // ---- legs (back view, alternating) ----
    const liftL = Math.max(0, swing) * legLen * 0.7;
    const liftR = Math.max(0, -swing) * legLen * 0.7;
    ctx.fillStyle = "#c76a2a";
    legShape(ctx, -cw * 0.26, hipY, legLen, liftL, cw * 0.3);
    legShape(ctx, cw * 0.26, hipY, legLen, liftR, cw * 0.3);

    // ---- torso (saffron) ----
    const tg = ctx.createLinearGradient(0, shoulderY, 0, hipY);
    tg.addColorStop(0, "#ff9a3c");
    tg.addColorStop(1, "#e85d04");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-cw * 0.4, hipY);
    ctx.lineTo(cw * 0.4, hipY);
    ctx.lineTo(cw * 0.5, shoulderY + torsoH * 0.2);
    ctx.quadraticCurveTo(cw * 0.5, shoulderY, 0, shoulderY);
    ctx.quadraticCurveTo(-cw * 0.5, shoulderY, -cw * 0.5, shoulderY + torsoH * 0.2);
    ctx.closePath();
    ctx.fill();

    // ---- dhoti (gold band at hips) ----
    ctx.fillStyle = "#ffd15c";
    rrect(ctx, -cw * 0.45, hipY - legLen * 0.35, cw * 0.9, legLen * 0.6, cw * 0.16);
    ctx.fill();
    ctx.fillStyle = "#f2a900";
    rrect(ctx, -cw * 0.45, hipY - legLen * 0.05, cw * 0.9, legLen * 0.16, cw * 0.1);
    ctx.fill();

    // ---- arms (swing opposite legs) ----
    ctx.fillStyle = "#c76a2a";
    const armSw = swing * legLen * 0.5;
    legShape(ctx, -cw * 0.52, shoulderY + torsoH * 0.15, torsoH * 0.75, -armSw + torsoH * 0.1, cw * 0.24);
    legShape(ctx, cw * 0.52, shoulderY + torsoH * 0.15, torsoH * 0.75, armSw + torsoH * 0.1, cw * 0.24);

    // ---- mace (gada) in right hand ----
    ctx.save();
    ctx.translate(cw * 0.62, shoulderY - u * 0.005);
    ctx.rotate(0.2 + swing * 0.15);
    ctx.strokeStyle = "#7a4a1a";
    ctx.lineWidth = cw * 0.14;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -u * 0.05); ctx.stroke();
    const mg = ctx.createRadialGradient(0, -u * 0.06, 1, 0, -u * 0.06, cw * 0.4);
    mg.addColorStop(0, "#fff0b0"); mg.addColorStop(1, "#e0a020");
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(0, -u * 0.065, cw * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ---- head ----
    const headY = shoulderY - headR * 0.8;
    ctx.fillStyle = "#c76a2a";
    // ears
    ctx.beginPath(); ctx.arc(-headR * 0.9, headY, headR * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headR * 0.9, headY, headR * 0.4, 0, Math.PI * 2); ctx.fill();
    // skull
    const hg = ctx.createRadialGradient(-headR * 0.3, headY - headR * 0.3, 1, 0, headY, headR * 1.3);
    hg.addColorStop(0, "#e08a44"); hg.addColorStop(1, "#b25a20");
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, headY, headR, 0, Math.PI * 2); ctx.fill();
    // tilak hint on back of head (small)
    ctx.fillStyle = "rgba(255,80,40,0.5)";
    ctx.beginPath(); ctx.arc(0, headY, headR * 0.28, 0, Math.PI * 2); ctx.fill();

    // ---- crown (mukut) ----
    ctx.fillStyle = "#ffd15c";
    ctx.strokeStyle = "#b9860b";
    ctx.lineWidth = 1;
    const cyTop = headY - headR;
    ctx.beginPath();
    ctx.moveTo(-headR * 0.9, cyTop + headR * 0.35);
    ctx.lineTo(-headR * 0.6, cyTop - headR * 0.5);
    ctx.lineTo(-headR * 0.3, cyTop + headR * 0.1);
    ctx.lineTo(0, cyTop - headR * 0.7);
    ctx.lineTo(headR * 0.3, cyTop + headR * 0.1);
    ctx.lineTo(headR * 0.6, cyTop - headR * 0.5);
    ctx.lineTo(headR * 0.9, cyTop + headR * 0.35);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.restore();
  }

  // a rounded limb from (x, topY) going down by len, lifted by `lift`
  function legShape(ctx, x, topY, len, lift, w) {
    rrect(ctx, x - w / 2, topY - lift, w, len, w * 0.5);
    ctx.fill();
  }

  return {
    reset, left, right, jump, slide, update, draw,
    get laneFloat() { return s.laneFloat; },
    get laneTarget() { return s.laneTarget; },
    get airborne() { return s.airborne; },
    get sliding() { return s.sliding; },
    hurtFlash() { s.hurt = 0.5; },
  };
})();
