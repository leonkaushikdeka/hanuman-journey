/* Main controller: level progression, hearts, states, loop, HUD, scoring. */

const Game = (() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // states: menu | playing | duel | levelclear | over | victory | paused
  let state = "menu";
  let levelIndex = 0;
  let levelDist = 0;
  let coins = 0, rings = 0, score = 0, hearts = CFG.hearts;
  let best = Store.getBest();
  let speed = CFG.baseSpeed;
  let distZ = 0, graceZ = 0, clock = 0, petalCarry = 0;
  let last = 0, duelSeen = false;

  const el = {
    hud: document.getElementById("hud"),
    score: document.getElementById("score"),
    distance: document.getElementById("distance"),
    rings: document.getElementById("rings"),
    hearts: document.getElementById("hearts"),
    levelLabel: document.getElementById("level-label"),
    progressFill: document.getElementById("progress-fill"),
    toast: document.getElementById("toast"),
    banner: document.getElementById("level-banner"),
    menu: document.getElementById("menu"),
    pause: document.getElementById("pause"),
    levelclear: document.getElementById("levelclear"),
    over: document.getElementById("over"),
    victory: document.getElementById("victory"),
    bestMenu: document.getElementById("best-menu"),
    lcTitle: document.getElementById("lc-title"),
    lcSub: document.getElementById("lc-sub"),
    overTitle: document.getElementById("over-title"),
    overSub: document.getElementById("over-sub"),
    finalScore: document.getElementById("final-score"),
    finalDist: document.getElementById("final-dist"),
    finalRings: document.getElementById("final-rings"),
    vScore: document.getElementById("v-score"),
    vRings: document.getElementById("v-rings"),
    vCoins: document.getElementById("v-coins"),
    vBest: document.getElementById("v-best"),
    mute: document.getElementById("btn-mute"),
    flightMeter: document.getElementById("flight-meter"),
    flightFill: document.getElementById("flight-fill"),
    duelUi: document.getElementById("duel-ui"),
    duelName: document.getElementById("duel-name"),
    duelSubtitle: document.getElementById("duel-subtitle"),
    duelHealth: document.getElementById("duel-health-fill"),
    duelGuard: document.getElementById("duel-guard"),
    duelCombo: document.getElementById("duel-combo"),
    strike: document.getElementById("btn-strike"),
  };

  // ---------- canvas ----------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    World.resize(w, h);
  }

  // ---------- overlays ----------
  const OVERLAYS = ["menu", "pause", "levelclear", "over", "victory"];
  function refreshOverlays() {
    for (const k of OVERLAYS) el[k].classList.add("hidden");
    el.hud.classList.add("hidden");
    el.duelUi.classList.add("hidden");
    if (state === "menu") { el.bestMenu.textContent = best; el.menu.classList.remove("hidden"); }
    else if (state === "playing") el.hud.classList.remove("hidden");
    else if (state === "duel") el.duelUi.classList.remove("hidden");
    else if (state === "paused") el.pause.classList.remove("hidden");
    else if (state === "levelclear") el.levelclear.classList.remove("hidden");
    else if (state === "over") el.over.classList.remove("hidden");
    else if (state === "victory") el.victory.classList.remove("hidden");
  }

  function prevGoals() {
    let s = 0;
    for (let i = 0; i < levelIndex; i++) s += LEVELS[i].goal;
    return s;
  }
  function displayDist() { return prevGoals() + levelDist; }
  function computeScore() { return rings * 100 + coins * 10 + Math.floor(displayDist()) + levelIndex * 250; }

  // ---------- lifecycle ----------
  function startGame() {
    coins = 0; rings = 0; score = 0;
    Sound.unlock(); Sound.startMusic();
    startLevel(0);
  }

  function startLevel(i) {
    levelIndex = i;
    levelDist = 0;
    hearts = CFG.hearts;
    speed = LEVELS[i].speed;
    distZ = 0;
    graceZ = CFG.graceZ + (i === 0 ? 6 : 0); // extra breathing room on level 1
    duelSeen = false;
    Player.reset();
    Obstacles.reset();
    Particles.reset();
    updateHud();
    state = "playing";
    refreshOverlays();
    showBanner(`Level ${i + 1}: ${LEVELS[i].name}`);
  }

  function completeLevel() {
    Sound.ring();
    if (levelIndex >= LEVELS.length - 1) { victory(); return; }
    state = "levelclear";
    el.lcTitle.textContent = `${LEVELS[levelIndex].name} cleared!`;
    el.lcSub.textContent = `Next: ${LEVELS[levelIndex + 1].name}`;
    refreshOverlays();
  }

  function nextLevel() { if (state === "levelclear") startLevel(levelIndex + 1); }

  function victory() {
    state = "victory";
    Sound.stopMusic(); Sound.ring();
    score = computeScore();
    const isBest = score > best;
    if (isBest) { best = score; Store.setBest(best); }
    el.vBest.classList.toggle("hidden", !isBest);
    el.vScore.textContent = score;
    el.vRings.textContent = rings;
    el.vCoins.textContent = coins;
    refreshOverlays();
  }

  function onHit() {
    if (state !== "playing" || Player.invincible) return;
    hearts--;
    Sound.hit();
    Particles.burst(World.laneX(Player.laneFloat, 0), World.layout().groundY - World.layout().h * 0.08);
    Player.setInvincible(CFG.iFrames);
    updateHearts();
    if (hearts <= 0) endRun();
    else toast(hearts === 1 ? "Last heart!" : "−1 ♥");
  }

  function endRun() {
    state = "over";
    Sound.stopMusic();
    score = computeScore();
    if (score > best) { best = score; Store.setBest(best); }
    el.overTitle.textContent = "The Journey Pauses";
    el.overSub.textContent = `${LEVELS[levelIndex].name} — Leg ${levelIndex + 1} of 4`;
    el.finalScore.textContent = score;
    el.finalDist.textContent = Math.floor(displayDist());
    el.finalRings.textContent = rings;
    refreshOverlays();
  }

  function retryLevel() { if (state === "over") startLevel(levelIndex); }
  function quitToMenu() { Sound.stopMusic(); state = "menu"; refreshOverlays(); }
  function pause() { if (state === "playing") { state = "paused"; refreshOverlays(); } }
  function resume() { if (state === "paused") { last = performance.now(); state = "playing"; refreshOverlays(); } }

  // ---------- tap duel ----------
  function beginDuel() {
    duelSeen = true;
    Duel.start(levelIndex);
    state = "duel";
    updateDuelUi();
    refreshOverlays();
    toast("1V1 encounter!");
  }

  function strikeDuel() {
    if (state !== "duel") return;
    if (Duel.strike()) {
      Sound.strike();
      updateDuelUi();
      const outcome = Duel.snapshot().outcome;
      if (outcome) resolveDuel(outcome);
    }
  }

  function updateDuelUi() {
    const d = Duel.snapshot();
    el.duelName.textContent = d.enemy.name;
    el.duelSubtitle.textContent = d.enemy.subtitle;
    el.duelHealth.style.width = clamp(d.hpPct, 0, 1) * 100 + "%";
    el.duelGuard.textContent = "♥".repeat(Math.max(0, d.guard)) + "♡".repeat(3 - Math.max(0, d.guard));
    el.duelCombo.textContent = d.combo >= 2 ? `×${d.combo} COMBO` : "";
  }

  function resolveDuel(outcome) {
    state = "playing";
    refreshOverlays();
    if (outcome === "win") {
      coins += 12;
      Particles.burst(World.layout().w * .64, World.layout().h * .52, "rgba(255,205,90,");
      Sound.ring(); toast("Victory! +120 score");
    } else {
      Player.setInvincible(0);
      onHit();
      if (state === "playing") toast("The enemy broke your guard!");
    }
  }

  // ---------- scoring / hud ----------
  function addCoin() { coins++; Particles.sparkle(World.laneX(Player.laneFloat, 0), World.layout().groundY - World.layout().h * 0.1, "rgba(255,220,120,"); Sound.coin(); }
  function addRing() { rings++; Particles.sparkle(World.laneX(Player.laneFloat, 0), World.layout().groundY - World.layout().h * 0.12, "rgba(255,180,90,"); Sound.ring(); toast(chance(0.5) ? "Jai Shri Ram!" : "Ring!"); }
  function activateFlight() {
    Player.startFlight(CFG.flightDur);
    Player.setInvincible(0);
    Sound.fly();
    toast("✦ Divine Flight!");
  }

  function updateHearts() {
    let h = "";
    for (let i = 0; i < CFG.hearts; i++) h += i < hearts ? "♥" : "♡";
    el.hearts.textContent = h;
  }
  function updateHud() {
    score = computeScore();
    el.score.textContent = score;
    el.distance.textContent = Math.floor(displayDist());
    el.rings.textContent = rings;
    el.levelLabel.textContent = `LEG ${levelIndex + 1} / 4 · ${LEVELS[levelIndex].name.toUpperCase()}`;
    el.progressFill.style.width = clamp(levelDist / LEVELS[levelIndex].goal, 0, 1) * 100 + "%";
    updateHearts();
    updateFlightMeter();
  }

  function updateFlightMeter() {
    if (Player.flying) {
      el.flightMeter.classList.add("show");
      el.flightFill.style.width = clamp(Player.flightRemaining / CFG.flightDur, 0, 1) * 100 + "%";
    } else {
      el.flightMeter.classList.remove("show");
    }
  }

  let toastTimer = null;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.remove("show"); void el.toast.offsetWidth; el.toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1200);
  }
  function showBanner(text) {
    el.banner.textContent = text;
    el.banner.classList.remove("show"); void el.banner.offsetWidth; el.banner.classList.add("show");
  }

  // ---------- loop ----------
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05) || 0;
    last = now;
    if (state !== "paused") { clock += dt; step(dt); }
    render();
    requestAnimationFrame(frame);
  }

  function step(dt) {
    if (state === "playing") {
      const lvl = LEVELS[levelIndex];
      speed = clamp(lvl.speed + levelDist * CFG.levelRamp, lvl.speed, lvl.speed + CFG.maxSpeedBonus);
      if (Player.flying) speed *= CFG.flightSpeedMul;
      const dz = speed * dt;
      distZ += dz;
      levelDist += dz * CFG.metresPerZ;
      if (graceZ > 0) graceZ -= dz;
      Player.update(dt, speed);
      if (Player.flying) {
        const py = World.layout().groundY - CFG.flightAlt * World.layout().h;
        Particles.flightTrail(World.laneX(Player.laneFloat, 0), py);
      }
      Obstacles.update(dt, speed, {
        pool: lvl.pool, obstProb: lvl.obstProb, biome: lvl.biome,
        spawn: graceZ <= 0, metres: levelDist,
      });
      Particles.ambient(dt, lvl.biome, World.layout());
      Particles.update(dt);
      updateHud();
      if (!duelSeen && levelDist >= CFG.duelMarks[levelIndex]) { beginDuel(); return; }
      if (levelDist >= lvl.goal) completeLevel();
    } else if (state === "duel") {
      const outcome = Duel.update(dt);
      const d = Duel.snapshot();
      if (d.hitThisFrame) Sound.enemyStrike();
      updateDuelUi();
      if (outcome) resolveDuel(outcome);
    } else if (state === "victory") {
      petalCarry += dt;
      while (petalCarry >= 0.12) { petalCarry -= 0.12; Particles.petal(World.layout()); }
      Particles.update(dt);
    } else { // menu / levelclear / over : attract run
      const s = CFG.baseSpeed * 0.7;
      distZ += s * dt;
      Player.update(dt, s);
      Particles.ambient(dt, attractBiome(), World.layout());
      Particles.update(dt);
    }
  }

  function attractBiome() { return state === "menu" ? "jungle" : LEVELS[levelIndex].biome; }

  function render() {
    if (state === "victory") {
      World.drawRamScene(ctx, clock);
      Particles.draw(ctx);
      return;
    }
    const biome = state === "menu" ? "jungle" : LEVELS[levelIndex].biome;
    World.drawBackground(ctx, biome, clock);
    World.drawTrack(ctx, biome, distZ);
    if (state === "duel") { Duel.draw(ctx, clock); return; }
    if (state === "playing" || state === "paused") Obstacles.draw(ctx);
    Player.draw(ctx);
    Particles.draw(ctx);
    const L = World.layout();
    const shade = ctx.createLinearGradient(0, L.h * .72, 0, L.h);
    shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(3,2,1,.34)");
    ctx.fillStyle = shade; ctx.fillRect(0, L.h * .7, L.w, L.h * .3);
  }

  // ---------- input ----------
  function handleAction(a) {
    Sound.unlock();
    switch (state) {
      case "menu": if (a === "start" || a === "up") startGame(); break;
      case "playing":
        if (a === "left") Player.left();
        else if (a === "right") Player.right();
        else if (a === "up") Player.jump();
        else if (a === "down") Player.slide();
        else if (a === "pause") pause();
        break;
      case "duel":
        if (a === "up" || a === "start") strikeDuel();
        break;
      case "paused": if (a === "pause" || a === "start") resume(); break;
      case "levelclear": if (a === "start" || a === "up") nextLevel(); break;
      case "over": if (a === "start" || a === "up") retryLevel(); break;
      case "victory": if (a === "start" || a === "up") startGame(); break;
    }
  }

  // ---------- init ----------
  function init() {
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", () => setTimeout(resize, 200));
    Input.bind(handleAction);

    document.getElementById("btn-start").addEventListener("click", startGame);
    document.getElementById("btn-next").addEventListener("click", nextLevel);
    document.getElementById("btn-retry").addEventListener("click", retryLevel);
    document.getElementById("btn-resume").addEventListener("click", resume);
    document.getElementById("btn-quit").addEventListener("click", quitToMenu);
    document.getElementById("btn-menu").addEventListener("click", quitToMenu);
    document.getElementById("btn-play-again").addEventListener("click", startGame);
    document.getElementById("btn-victory-menu").addEventListener("click", quitToMenu);
    document.getElementById("btn-pause").addEventListener("click", pause);
    el.strike.addEventListener("click", (e) => { e.stopPropagation(); Sound.unlock(); strikeDuel(); });

    el.mute.textContent = Sound.isMuted() ? "🔇" : "🔊";
    el.mute.addEventListener("click", (e) => {
      e.stopPropagation();
      el.mute.textContent = Sound.toggleMute() ? "🔇" : "🔊";
    });

    document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pause(); });

    updateHearts();
    state = "menu";
    refreshOverlays();
    last = performance.now();
    requestAnimationFrame(frame);

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  return { init, addCoin, addRing, activateFlight, onHit, strikeDuel, get state() { return state; } };
})();

window.Game = Game;
window.addEventListener("load", Game.init);
