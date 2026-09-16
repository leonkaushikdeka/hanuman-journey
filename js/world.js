/* World: perspective projection + parallax background + receding track.
   Owns the projection math used by player and obstacles. */

const World = (() => {
  // layout recomputed on resize
  let L = { w: 0, h: 0, horizonY: 0, groundY: 0, cx: 0, spread: 0 };

  // biome themes cross-faded by distance for a sense of journey
  const BIOMES = [
    { name: "jungle", top: "#2a5c3a", mid: "#4a8c4a", low: "#6fae55", track: "#8a6a3a", trackEdge: "#5c4321" },
    { name: "coast",  top: "#2b6f86", mid: "#4fa3b0", low: "#8fd0c8", track: "#c9a86a", trackEdge: "#8a6a3a" },
    { name: "sea",    top: "#1f5a8a", mid: "#2f83b8", low: "#7fc6e0", track: "#b98c46", trackEdge: "#7a5a2a" },
    { name: "lanka",  top: "#5a2472", mid: "#a23a7a", low: "#e07a4a", track: "#9a6a3a", trackEdge: "#6a4520" },
  ];

  function resize(w, h) {
    L.w = w; L.h = h;
    L.horizonY = h * CFG.horizonFrac;
    L.groundY = h * CFG.groundFrac;
    L.cx = w / 2;
    L.spread = w * CFG.laneSpreadFrac;
  }

  function layout() { return L; }

  // ---- projection ----
  function scaleAtZ(z) { return 1 / (1 + Math.max(z, -0.9) * CFG.zK); }
  function projY(z) {
    const s = scaleAtZ(z);
    return L.horizonY + (L.groundY - L.horizonY) * s;
  }
  function laneX(laneIndex, z) {
    const s = scaleAtZ(z);
    return L.cx + laneIndex * L.spread * s;
  }

  function biomeAt(metres) {
    const seg = 700; // metres per biome step
    const m = Math.max(0, metres || 0);
    const f = m / seg;
    const n = BIOMES.length;
    const i = ((Math.floor(f) % n) + n) % n;
    const j = (i + 1) % n;
    const t = f - Math.floor(f);
    return { a: BIOMES[i], b: BIOMES[j], t, index: i };
  }

  function mix(c1, c2, t) {
    const a = hex(c1), b = hex(c2);
    const r = Math.round(lerp(a[0], b[0], t));
    const g = Math.round(lerp(a[1], b[1], t));
    const bl = Math.round(lerp(a[2], b[2], t));
    return `rgb(${r},${g},${bl})`;
  }
  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ---- background ----
  function drawBackground(ctx, metres) {
    const { a, b, t } = biomeAt(metres);
    const top = mix(a.top, b.top, t);
    const mid = mix(a.mid, b.mid, t);
    const low = mix(a.low, b.low, t);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, L.horizonY + 40);
    sky.addColorStop(0, top);
    sky.addColorStop(1, mid);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, L.w, L.horizonY + 40);

    // sun / halo
    const sunX = L.cx + Math.sin(metres * 0.0006) * L.w * 0.18;
    const sunY = L.horizonY * 0.5;
    const sunR = L.w * 0.09;
    const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3.2);
    halo.addColorStop(0, "rgba(255,235,180,0.9)");
    halo.addColorStop(0.4, "rgba(255,190,90,0.35)");
    halo.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, L.w, L.horizonY + 60);
    ctx.fillStyle = "rgba(255,244,214,0.95)";
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();

    // distant mountain silhouettes (parallax)
    drawRidge(ctx, mix(a.mid, b.mid, t), 0.42, metres * 0.02, 0.10);
    drawRidge(ctx, low, 0.62, metres * 0.05 + 100, 0.07);

    // ground band under horizon
    ctx.fillStyle = low;
    ctx.fillRect(0, L.horizonY, L.w, L.h - L.horizonY);
  }

  function drawRidge(ctx, color, heightFrac, offset, jag) {
    const base = L.horizonY;
    const amp = L.h * jag;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, base);
    const step = L.w / 8;
    for (let i = 0; i <= 8; i++) {
      const x = i * step;
      const y = base - amp * (0.5 + 0.5 * Math.sin(i * 1.3 + offset * 0.01));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(L.w, base);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- track ----
  function drawTrack(ctx, metres, distZ) {
    const { a, b, t } = biomeAt(metres);
    const trackCol = mix(a.track, b.track, t);
    const edgeCol = mix(a.trackEdge, b.trackEdge, t);

    const nearL = laneX(-1.5, 0), nearR = laneX(1.5, 0);
    const farL = laneX(-1.5, CFG.zFar), farR = laneX(1.5, CFG.zFar);
    const nearY = projY(0), farY = projY(CFG.zFar);

    // track surface
    const grad = ctx.createLinearGradient(0, farY, 0, nearY);
    grad.addColorStop(0, edgeCol);
    grad.addColorStop(1, trackCol);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(farL, farY);
    ctx.lineTo(farR, farY);
    ctx.lineTo(nearR, nearY);
    ctx.lineTo(nearL, nearY);
    ctx.closePath();
    ctx.fill();

    // side rails
    ctx.strokeStyle = edgeCol;
    ctx.lineWidth = 2;
    railLine(ctx, -1.5);
    railLine(ctx, 1.5);

    // animated lane dividers (dashes that scroll toward the camera)
    ctx.strokeStyle = "rgba(255,246,220,0.55)";
    for (const bx of [-0.5, 0.5]) {
      drawDashLane(ctx, bx, distZ);
    }
  }

  function railLine(ctx, bx) {
    ctx.beginPath();
    ctx.moveTo(laneX(bx, CFG.zFar), projY(CFG.zFar));
    ctx.lineTo(laneX(bx, 0), projY(0));
    ctx.stroke();
  }

  function drawDashLane(ctx, bx, distZ) {
    const dash = 1.4, gap = 1.4, period = dash + gap;
    const phase = distZ % period;
    for (let z = CFG.zFar; z > -0.5; z -= period) {
      const zz = z - phase;
      const zTop = zz, zBot = zz - dash;
      if (zBot < -1) continue;
      const t1 = Math.max(zBot, -0.5);
      const w = Math.max(1, (L.groundY / 120) * scaleAtZ(t1));
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(laneX(bx, Math.max(zTop, -0.5)), projY(Math.max(zTop, -0.5)));
      ctx.lineTo(laneX(bx, t1), projY(t1));
      ctx.stroke();
    }
  }

  return {
    resize, layout, biomeAt,
    scaleAtZ, projY, laneX,
    drawBackground, drawTrack,
  };
})();
