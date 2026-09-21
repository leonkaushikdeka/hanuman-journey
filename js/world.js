/* World: perspective projection + per-biome parallax backgrounds,
   the receding track, and the final "reaching Ram" scene. */

const World = (() => {
  let L = { w: 0, h: 0, horizonY: 0, groundY: 0, cx: 0, spread: 0 };

  const BG_IMAGES = {};
  for (const biome of ["jungle", "coast", "sea", "lanka"]) {
    const img = new Image();
    img.decoding = "async";
    img.src = `assets/biome-${biome}-v2.jpg?v=2`;
    BG_IMAGES[biome] = img;
  }

  const PAL = {
    jungle: { skyTop: "#071d24", skyMid: "#467d72", skyLow: "#d3b777", sun: "#ffd88a", hill1: "#153a35", hill2: "#285348", tree: "#0d2926", ground: "#17372d", track: "#76502e", trackEdge: "#25180f", dash: "rgba(255,214,138,.48)" },
    coast: { skyTop: "#17364a", skyMid: "#d17c54", skyLow: "#ffd69b", sun: "#fff0b3", hill1: "#583c31", hill2: "#9e6847", sea: "#246b78", ground: "#66543a", track: "#b38a55", trackEdge: "#513a24", dash: "rgba(255,225,161,.5)" },
    sea: { skyTop: "#102d48", skyMid: "#4e91aa", skyLow: "#d5d7be", sun: "#fff0a8", seaDeep: "#092f4b", seaLight: "#2e7c91", ground: "#174f68", track: "#8d8d82", trackEdge: "#343a3d", dash: "rgba(255,209,103,.72)" },
    lanka: { skyTop: "#100b24", skyMid: "#4c1830", skyLow: "#b4432f", sun: "#ff7742", hill1: "#160c21", hill2: "#2a1226", city: "#090712", win: "#ffc55d", ground: "#171018", track: "#34262a", trackEdge: "#100a0d", dash: "rgba(255,180,90,.5)" },
  };

  function resize(w, h) {
    L.w = w; L.h = h;
    L.horizonY = h * CFG.horizonFrac;
    L.groundY = h * CFG.groundFrac;
    L.cx = w / 2;
    L.spread = w * CFG.laneSpreadFrac;
  }
  function layout() { return L; }

  function scaleAtZ(z) { return 1 / (1 + Math.max(z, -0.9) * CFG.zK); }
  function projY(z) { const s = scaleAtZ(z); return L.horizonY + (L.groundY - L.horizonY) * s; }
  function laneX(i, z) { const s = scaleAtZ(z); return L.cx + i * L.spread * s; }

  // ---------------- background ----------------
  function drawBackground(ctx, biome, time) {
    const P = PAL[biome] || PAL.jungle;
    const plate = BG_IMAGES[biome];
    if (plate && plate.complete && plate.naturalWidth) {
      drawPlate(ctx, plate, time, biome);
      return;
    }
    const g = ctx.createLinearGradient(0, 0, 0, L.horizonY + 20);
    g.addColorStop(0, P.skyTop); g.addColorStop(1, P.skyMid);
    ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.horizonY + 20);

    const hb = ctx.createLinearGradient(0, L.horizonY - L.h * 0.14, 0, L.horizonY + 6);
    hb.addColorStop(0, "rgba(255,255,255,0)"); hb.addColorStop(1, P.skyLow);
    ctx.fillStyle = hb; ctx.fillRect(0, L.horizonY - L.h * 0.14, L.w, L.h * 0.15);

    celestial(ctx, biome, P, time);
    ctx.fillStyle = biome === "lanka" ? "rgba(255,83,45,.08)" : "rgba(255,219,151,.10)";
    for (let i = 0; i < 3; i++) ctx.fillRect(0, L.horizonY - 18 + i * 10, L.w, 2);

    if (biome === "jungle") {
      hills(ctx, P.hill1, 0.11, time * 3, 0.6);
      hills(ctx, P.hill2, 0.07, time * 6 + 90, 0.85);
      treeLine(ctx, P.tree);
    } else if (biome === "coast") {
      seaLine(ctx, P);
      hills(ctx, P.hill1, 0.08, time * 2, 0.7);
      hills(ctx, P.hill2, 0.05, time * 4 + 60, 0.9);
      palms(ctx);
    } else if (biome === "sea") {
      clouds(ctx, time);
    } else {
      hills(ctx, P.hill1, 0.10, 0, 0.7);
      city(ctx, P, time);
    }

    if (biome === "sea") ocean(ctx, P, time);
    else {
      const land = ctx.createLinearGradient(0, L.horizonY, 0, L.h);
      land.addColorStop(0, P.ground); land.addColorStop(1, mixHex(P.ground, "#050403", .48));
      ctx.fillStyle = land; ctx.fillRect(0, L.horizonY, L.w, L.h - L.horizonY);
    }
    const edge = ctx.createRadialGradient(L.cx, L.h * .42, L.w * .12, L.cx, L.h * .48, L.w * .78);
    edge.addColorStop(0, "rgba(255,210,130,.035)"); edge.addColorStop(.58, "rgba(0,0,0,0)"); edge.addColorStop(1, "rgba(0,0,0,.46)");
    ctx.fillStyle = edge; ctx.fillRect(0, 0, L.w, L.h);
  }

  function drawPlate(ctx, img, time, biome) {
    const drift = Math.sin(time * .055) * L.w * .008;
    const scale = Math.max(L.w / img.naturalWidth, L.h / img.naturalHeight) * 1.025;
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.drawImage(img, (L.w - dw) / 2 + drift, (L.h - dh) / 2, dw, dh);

    // Animated distance haze binds the still plate to the moving canvas world.
    const haze = ctx.createLinearGradient(0, L.horizonY * .55, 0, L.horizonY * 1.35);
    haze.addColorStop(0, "rgba(255,226,174,0)");
    haze.addColorStop(.62, biome === "lanka" ? "rgba(190,49,30,.07)" : "rgba(220,235,218,.10)");
    haze.addColorStop(1, "rgba(3,8,8,0)");
    ctx.fillStyle = haze; ctx.fillRect(0, 0, L.w, L.horizonY * 1.5);

    const vignette = ctx.createRadialGradient(L.cx, L.h * .46, L.w * .14, L.cx, L.h * .5, L.w * .72);
    vignette.addColorStop(.42, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(2,3,3,.38)");
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, L.w, L.h);
  }

  function celestial(ctx, biome, P, time) {
    const x = L.cx + Math.sin(time * 0.15) * L.w * 0.14;
    const y = biome === "lanka" ? L.horizonY * 0.78 : L.horizonY * 0.44;
    const r = L.w * (biome === "lanka" ? 0.11 : 0.085);
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
    halo.addColorStop(0, biome === "lanka" ? "rgba(255,90,40,0.6)" : "rgba(255,240,190,0.85)");
    halo.addColorStop(0.4, biome === "lanka" ? "rgba(200,50,40,0.25)" : "rgba(255,200,120,0.3)");
    halo.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = halo; ctx.fillRect(0, 0, L.w, L.horizonY + 40);
    ctx.fillStyle = P.sun;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function hills(ctx, color, heightFrac, offset, alpha) {
    const base = L.horizonY, amp = L.h * heightFrac;
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, base);
    const step = L.w / 10;
    for (let i = 0; i <= 10; i++) {
      const x = i * step;
      const yy = base - amp * (0.5 + 0.5 * Math.sin(i * 1.1 + offset * 0.01));
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(L.w, base); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function treeLine(ctx, color) {
    const base = L.horizonY;
    ctx.fillStyle = color;
    const n = Math.ceil(L.w / (L.w * 0.05));
    for (let i = 0; i <= n; i++) {
      const x = i * L.w * 0.05;
      const r = L.h * (0.02 + ((i * 37) % 5) * 0.006);
      ctx.beginPath(); ctx.arc(x, base - r * 0.4, r, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(x, base, r * 1.1, Math.PI, 0); ctx.fill();
    }
  }

  function seaLine(ctx, P) {
    ctx.fillStyle = P.sea;
    ctx.fillRect(0, L.horizonY - L.h * 0.02, L.w, L.h * 0.02);
  }

  function palms(ctx) {
    const base = L.horizonY;
    for (const px of [L.w * 0.12, L.w * 0.86, L.w * 0.72]) {
      ctx.strokeStyle = "#3a2a18"; ctx.lineWidth = L.h * 0.006;
      ctx.beginPath(); ctx.moveTo(px, base); ctx.quadraticCurveTo(px + 6, base - L.h * 0.06, px + 2, base - L.h * 0.1); ctx.stroke();
      ctx.fillStyle = "#2f5d33";
      for (let a = -2; a <= 2; a++) {
        ctx.beginPath();
        ctx.ellipse(px + 2, base - L.h * 0.1, L.h * 0.045, L.h * 0.012, a * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function clouds(ctx, time) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 0.31 + time * 0.01) % 1.2 - 0.1) * L.w;
      const cy = L.horizonY * (0.2 + i * 0.12);
      const s = L.h * (0.03 + (i % 2) * 0.015);
      ctx.beginPath();
      ctx.arc(cx, cy, s, 0, Math.PI * 2);
      ctx.arc(cx + s, cy + s * 0.2, s * 0.8, 0, Math.PI * 2);
      ctx.arc(cx - s, cy + s * 0.2, s * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function ocean(ctx, P, time) {
    const g = ctx.createLinearGradient(0, L.horizonY, 0, L.h);
    g.addColorStop(0, P.seaLight); g.addColorStop(1, P.seaDeep);
    ctx.fillStyle = g; ctx.fillRect(0, L.horizonY, L.w, L.h - L.horizonY);
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = L.horizonY + (i / 9) * (L.h - L.horizonY);
      const off = (time * 20 * (1 + i * 0.2)) % 80;
      ctx.beginPath();
      for (let x = -80 + off; x < L.w; x += 80) {
        ctx.moveTo(x, y); ctx.lineTo(x + 30 + i * 3, y);
      }
      ctx.globalAlpha = 0.5 - i * 0.04; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function city(ctx, P, time) {
    const base = L.horizonY;
    ctx.fillStyle = P.city;
    let x = 0;
    let seed = 7;
    while (x < L.w) {
      seed = (seed * 9301 + 49297) % 233280;
      const rnd = seed / 233280;
      const tw = L.w * (0.05 + rnd * 0.05);
      const th = L.h * (0.06 + rnd * 0.14);
      ctx.fillRect(x, base - th, tw, th);
      // spire
      ctx.beginPath();
      ctx.moveTo(x, base - th); ctx.lineTo(x + tw / 2, base - th - L.h * 0.03); ctx.lineTo(x + tw, base - th);
      ctx.closePath(); ctx.fill();
      // windows
      ctx.fillStyle = P.win;
      const flick = 0.5 + 0.5 * Math.sin(time * 3 + x);
      ctx.globalAlpha = 0.5 + 0.4 * flick;
      for (let wy = base - th + 6; wy < base - 6; wy += th * 0.22) {
        for (let wx = x + tw * 0.2; wx < x + tw * 0.8; wx += tw * 0.3) {
          ctx.fillRect(wx, wy, tw * 0.12, th * 0.08);
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = P.city;
      x += tw + L.w * 0.01;
    }
  }

  // ---------------- track ----------------
  function drawTrack(ctx, biome, scrollZ) {
    const P = PAL[biome] || PAL.jungle;
    const nearL = laneX(-1.5, 0), nearR = laneX(1.5, 0);
    const farL = laneX(-1.5, CFG.zFar), farR = laneX(1.5, CFG.zFar);
    const nearY = projY(0), farY = projY(CFG.zFar);

    const grad = ctx.createLinearGradient(0, farY, 0, nearY);
    grad.addColorStop(0, biome === "sea" ? "rgba(58,65,66,.78)" : "rgba(31,21,15,.70)");
    grad.addColorStop(.55, biome === "sea" ? "rgba(105,105,98,.88)" : "rgba(79,52,31,.86)");
    grad.addColorStop(1, biome === "lanka" ? "rgba(48,31,32,.94)" : biome === "sea" ? "rgba(118,116,105,.95)" : "rgba(91,58,34,.94)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(farL, farY); ctx.lineTo(farR, farY);
    ctx.lineTo(nearR, nearY); ctx.lineTo(nearL, nearY);
    ctx.closePath(); ctx.fill();

    // Soft shoulders separate the playable path from the cinematic plate.
    ctx.save(); ctx.strokeStyle = biome === "sea" ? "rgba(255,194,69,.48)" : "rgba(236,175,83,.24)";
    ctx.lineWidth = Math.max(2, L.w * .004); ctx.shadowBlur = 16; ctx.shadowColor = ctx.strokeStyle;
    railLine(ctx, -1.5); railLine(ctx, 1.5); ctx.restore();

    const step = 2.35, phase = scrollZ % step;
    for (let z = CFG.zFar; z > -.5; z -= step) {
      const zz = z - phase;
      if (zz < -.7) continue;
      const y = projY(zz), sc = scaleAtZ(zz);
      const left = laneX(-1.46, zz), right = laneX(1.46, zz);
      ctx.strokeStyle = biome === "sea" ? `rgba(35,39,40,${.32 * sc + .08})` : `rgba(32,19,10,${.30 * sc + .06})`;
      ctx.lineWidth = Math.max(1, 5 * sc); ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      if (sc > .34) {
        ctx.strokeStyle = biome === "lanka" ? "rgba(235,120,66,.16)" : "rgba(255,218,151,.12)";
        for (const lane of [-1,0,1]) { const x = laneX(lane, zz); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7 * sc, y - 10 * sc); ctx.stroke(); }
      }

      // Stable grit and shoulder stones move with the road instead of flickering.
      if (sc > .2) {
        for (let i = 0; i < 4; i++) {
          const seed = Math.abs(Math.sin(z * 19.17 + i * 41.3));
          const lane = -1.25 + seed * 2.5;
          const px = laneX(lane, zz), py = y - (3 + i * 2) * sc;
          ctx.fillStyle = biome === "sea" ? "rgba(39,45,48,.24)" : "rgba(29,18,11,.20)";
          ctx.beginPath(); ctx.ellipse(px, py, (3 + seed * 7) * sc, (1.5 + seed * 3) * sc, seed * 2, 0, Math.PI * 2); ctx.fill();
        }
        for (const side of [-1, 1]) {
          const ex = laneX(side * 1.53, zz);
          const ew = Math.max(2, 15 * sc), eh = Math.max(1, 7 * sc);
          const stone = ctx.createLinearGradient(ex, y - eh, ex, y + eh);
          stone.addColorStop(0, biome === "sea" ? "rgba(210,205,178,.72)" : "rgba(145,103,63,.62)");
          stone.addColorStop(1, "rgba(30,22,18,.78)");
          ctx.fillStyle = stone; ctx.beginPath(); ctx.ellipse(ex, y, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // rails
    ctx.strokeStyle = biome === "sea" ? "#ffd15c" : P.trackEdge;
    ctx.shadowBlur = biome === "sea" ? 10 : 0; ctx.shadowColor = "rgba(255,194,74,.55)";
    ctx.lineWidth = biome === "sea" ? 5 : 3;
    railLine(ctx, -1.5); railLine(ctx, 1.5);
    ctx.shadowBlur = 0;

    // lane dashes
    ctx.strokeStyle = P.dash;
    for (const bx of [-0.5, 0.5]) dashLane(ctx, bx, scrollZ);
  }

  function railLine(ctx, bx) {
    ctx.beginPath();
    ctx.moveTo(laneX(bx, CFG.zFar), projY(CFG.zFar));
    ctx.lineTo(laneX(bx, 0), projY(0));
    ctx.stroke();
  }

  function dashLane(ctx, bx, scrollZ) {
    const period = 2.8, dash = 1.4;
    const phase = scrollZ % period;
    for (let z = CFG.zFar; z > -0.5; z -= period) {
      const zTop = z - phase, zBot = zTop - dash;
      if (zBot < -1) continue;
      const t1 = Math.max(zBot, -0.5);
      ctx.lineWidth = Math.max(1, (L.groundY / 120) * scaleAtZ(t1));
      ctx.beginPath();
      ctx.moveTo(laneX(bx, Math.max(zTop, -0.5)), projY(Math.max(zTop, -0.5)));
      ctx.lineTo(laneX(bx, t1), projY(t1));
      ctx.stroke();
    }
  }

  // ---------------- victory: reaching Ram ----------------
  function drawRamScene(ctx, time) {
    // divine warm backdrop
    const g = ctx.createLinearGradient(0, 0, 0, L.h);
    g.addColorStop(0, "#ffd98a"); g.addColorStop(0.5, "#ffb15a"); g.addColorStop(1, "#e07a3a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);

    // radiant rays behind Ram
    const cx = L.cx + L.w * 0.16, cy = L.h * 0.42;
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.fillStyle = `rgba(255,250,220,${0.10 + 0.05 * Math.sin(time * 2 + i)})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L.w, -40); ctx.lineTo(L.w, 40); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // ground
    ctx.fillStyle = "#caa15a"; ctx.fillRect(0, L.groundY, L.w, L.h - L.groundY);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath(); ctx.ellipse(cx, L.groundY, L.w * 0.09, L.h * 0.02, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(L.cx - L.w * 0.16, L.groundY, L.w * 0.08, L.h * 0.02, 0, 0, Math.PI * 2); ctx.fill();

    drawRam(ctx, cx, L.groundY, time);
    drawKneelingHanuman(ctx, L.cx - L.w * 0.16, L.groundY, time);
  }

  function drawRam(ctx, x, feetY, time) {
    const u = L.h;
    const bh = u * 0.34;                // total height
    const headR = u * 0.05;
    const shoulderY = feetY - bh + headR * 2.2;
    const hipY = feetY - bh * 0.42;

    // halo
    ctx.strokeStyle = "rgba(255,240,180,0.9)"; ctx.lineWidth = u * 0.012;
    ctx.beginPath(); ctx.arc(x, shoulderY - headR * 1.6, headR * 1.7, 0, Math.PI * 2); ctx.stroke();
    const hg = ctx.createRadialGradient(x, shoulderY - headR * 1.6, 1, x, shoulderY - headR * 1.6, headR * 2.4);
    hg.addColorStop(0, "rgba(255,245,200,0.5)"); hg.addColorStop(1, "rgba(255,245,200,0)");
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, shoulderY - headR * 1.6, headR * 2.4, 0, Math.PI * 2); ctx.fill();

    // legs
    ctx.fillStyle = "#5a7de0";
    rrect(ctx, x - u * 0.035, hipY, u * 0.03, feetY - hipY, u * 0.015); ctx.fill();
    rrect(ctx, x + u * 0.005, hipY, u * 0.03, feetY - hipY, u * 0.015); ctx.fill();
    // dhoti
    ctx.fillStyle = "#ffd15c";
    rrect(ctx, x - u * 0.05, hipY - u * 0.01, u * 0.1, u * 0.06, u * 0.02); ctx.fill();
    // torso
    const tg = ctx.createLinearGradient(0, shoulderY, 0, hipY);
    tg.addColorStop(0, "#6f92ee"); tg.addColorStop(1, "#3f63c8");
    ctx.fillStyle = tg;
    rrect(ctx, x - u * 0.055, shoulderY, u * 0.11, hipY - shoulderY + u * 0.01, u * 0.03); ctx.fill();
    // sash
    ctx.strokeStyle = "#ffe9a8"; ctx.lineWidth = u * 0.012;
    ctx.beginPath(); ctx.moveTo(x - u * 0.05, shoulderY + u * 0.01); ctx.lineTo(x + u * 0.05, hipY); ctx.stroke();

    // right arm raised in blessing
    ctx.strokeStyle = "#5a7de0"; ctx.lineWidth = u * 0.028; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x + u * 0.04, shoulderY + u * 0.02); ctx.lineTo(x + u * 0.09, shoulderY - u * 0.03); ctx.stroke();
    // left arm holding bow
    ctx.beginPath(); ctx.moveTo(x - u * 0.04, shoulderY + u * 0.02); ctx.lineTo(x - u * 0.1, shoulderY + u * 0.05); ctx.stroke();
    // bow
    ctx.strokeStyle = "#8a5a2a"; ctx.lineWidth = u * 0.01;
    ctx.beginPath(); ctx.arc(x - u * 0.13, shoulderY + u * 0.05, u * 0.1, -Math.PI * 0.6, Math.PI * 0.6); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = u * 0.004;
    const by = shoulderY + u * 0.05;
    ctx.beginPath(); ctx.moveTo(x - u * 0.062, by - u * 0.083); ctx.lineTo(x - u * 0.062, by + u * 0.083); ctx.stroke();

    // head
    const headY = shoulderY - headR * 0.6;
    ctx.fillStyle = "#5a7de0";
    ctx.beginPath(); ctx.arc(x, headY, headR, 0, Math.PI * 2); ctx.fill();
    // face hint
    ctx.fillStyle = "rgba(20,20,40,0.6)";
    ctx.beginPath(); ctx.arc(x - headR * 0.35, headY, headR * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + headR * 0.35, headY, headR * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffcf6a";
    ctx.beginPath(); ctx.moveTo(x, headY - headR * 0.1); ctx.lineTo(x - headR * 0.06, headY + headR * 0.2); ctx.lineTo(x + headR * 0.06, headY + headR * 0.2); ctx.closePath(); ctx.fill();
    // crown
    ctx.fillStyle = "#ffd15c"; ctx.strokeStyle = "#b9860b"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - headR, headY - headR * 0.8);
    ctx.lineTo(x - headR * 0.5, headY - headR * 1.7);
    ctx.lineTo(x, headY - headR * 0.9);
    ctx.lineTo(x + headR * 0.5, headY - headR * 1.7);
    ctx.lineTo(x + headR, headY - headR * 0.8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function drawKneelingHanuman(ctx, x, feetY, time) {
    const u = L.h;
    ctx.save();
    ctx.translate(x, feetY);
    // tail up behind
    ctx.strokeStyle = "#d96a1e"; ctx.lineWidth = u * 0.03; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-u * 0.02, -u * 0.02);
    ctx.quadraticCurveTo(-u * 0.12, -u * 0.05, -u * 0.1, -u * 0.16);
    ctx.quadraticCurveTo(-u * 0.09, -u * 0.22, -u * 0.13, -u * 0.24);
    ctx.stroke();

    // kneeling legs
    ctx.fillStyle = "#c76a2a";
    rrect(ctx, -u * 0.05, -u * 0.03, u * 0.11, u * 0.03, u * 0.01); ctx.fill(); // shin on ground
    rrect(ctx, u * 0.0, -u * 0.09, u * 0.035, u * 0.07, u * 0.015); ctx.fill(); // raised knee

    // torso leaned forward
    const shoulderY = -u * 0.17;
    const tg = ctx.createLinearGradient(0, shoulderY, 0, -u * 0.06);
    tg.addColorStop(0, "#ff9a3c"); tg.addColorStop(1, "#e85d04");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-u * 0.04, -u * 0.06);
    ctx.lineTo(u * 0.05, -u * 0.07);
    ctx.lineTo(u * 0.08, shoulderY);
    ctx.quadraticCurveTo(u * 0.0, shoulderY - u * 0.01, -u * 0.03, shoulderY);
    ctx.closePath(); ctx.fill();

    // arms extended forward holding the ring
    ctx.strokeStyle = "#c76a2a"; ctx.lineWidth = u * 0.026; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(u * 0.03, shoulderY + u * 0.01); ctx.lineTo(u * 0.13, shoulderY + u * 0.02); ctx.stroke();

    // glowing ring offered
    const rx = u * 0.15, ry = shoulderY + u * 0.01, R = u * 0.03;
    const glow = ctx.createRadialGradient(rx, ry, 1, rx, ry, R * 3);
    glow.addColorStop(0, "rgba(255,235,150,0.8)"); glow.addColorStop(1, "rgba(255,210,90,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(rx, ry, R * 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffd15c"; ctx.lineWidth = R * 0.5;
    ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.stroke();

    // head bowed
    const headR = u * 0.04;
    ctx.fillStyle = "#c76a2a";
    ctx.beginPath(); ctx.arc(u * 0.05, shoulderY - headR * 0.4, headR, 0, Math.PI * 2); ctx.fill();
    // crown
    ctx.fillStyle = "#ffd15c";
    ctx.beginPath();
    ctx.moveTo(u * 0.02, shoulderY - headR); ctx.lineTo(u * 0.04, shoulderY - headR * 1.8);
    ctx.lineTo(u * 0.06, shoulderY - headR); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  return {
    resize, layout, scaleAtZ, projY, laneX, drawBackground, drawTrack, drawRamScene,
    backgroundReady: (biome) => Boolean(BG_IMAGES[biome]?.naturalWidth),
  };
})();
