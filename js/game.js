/* Main controller: state machine, loop, rendering, HUD, scoring. */

const Game = (() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  let state = "menu";           // menu | playing | paused | over
  let speed = CFG.baseSpeed;
  let distZ = 0;                // travelled distance (drives lane dashes)
  let metres = 0;
  let attractMetres = 0;
  let coins = 0, rings = 0, score = 0;
  let best = Store.getBest();
  let last = 0;

  // ---------- DOM ----------
  const el = {
    hud: document.getElementById("hud"),
    score: document.getElementById("score"),
    distance: document.getElementById("distance"),
    rings: document.getElementById("rings"),
    toast: document.getElementById("toast"),
    menu: document.getElementById("menu"),
    pause: document.getElementById("pause"),
    over: document.getElementById("over"),
    bestMenu: document.getElementById("best-menu"),
    finalScore: document.getElementById("final-score"),
    finalDist: document.getElementById("final-dist"),
    finalRings: document.getElementById("final-rings"),
    newBest: document.getElementById("new-best"),
    overTitle: document.getElementById("over-title"),
    mute: document.getElementById("btn-mute"),
  };

  // ---------- canvas sizing ----------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    World.resize(w, h);
  }

  // ---------- overlays ----------
  function show(node) { node.classList.remove("hidden"); }
  function hide(node) { node.classList.add("hidden"); }

  function setState(next) {
    state = next;
    hide(el.menu); hide(el.pause); hide(el.over); el.hud.classList.add("hidden");
    if (next === "menu") { el.bestMenu.textContent = best; show(el.menu); }
    else if (next === "playing") { el.hud.classList.remove("hidden"); }
    else if (next === "paused") { show(el.pause); }
    else if (next === "over") { showOver(); }
  }

  // ---------- lifecycle ----------
  function startGame() {
    speed = CFG.baseSpeed;
    distZ = 0; metres = 0; coins = 0; rings = 0; score = 0;
    Player.reset();
    Obstacles.reset();
    Sound.unlock();
    Sound.startMusic();
    updateHud();
    setState("playing");
  }

  function pause() {
    if (state !== "playing") return;
    setState("paused");
  }
  function resume() {
    if (state !== "paused") return;
    last = performance.now();
    setState("playing");
  }
  function quitToMenu() { Sound.stopMusic(); setState("menu"); }

  function onHit() {
    if (state !== "playing") return;
    Sound.hit();
    Player.hurtFlash();
    endGame();
  }

  function endGame() {
    Sound.stopMusic();
    const isBest = score > best;
    if (isBest) { best = score; Store.setBest(best); }
    el.newBest.classList.toggle("hidden", !isBest);
    setState("over");
  }

  function showOver() {
    el.finalScore.textContent = score;
    el.finalDist.textContent = Math.floor(metres);
    el.finalRings.textContent = rings;
    el.overTitle.textContent = rings > 0 ? "Jai Shri Ram!" : "The Journey Pauses";
    show(el.over);
  }

  // ---------- scoring ----------
  function addCoin() {
    coins++;
    score = computeScore();
    Sound.coin();
    updateHud();
  }
  function addRing() {
    rings++;
    score = computeScore();
    Sound.ring();
    toast(chance(0.5) ? "Jai Shri Ram!" : "Ring Collected!");
    updateHud();
  }
  function computeScore() { return Math.floor(metres) + coins * 10 + rings * 100; }

  function updateHud() {
    el.score.textContent = score;
    el.distance.textContent = Math.floor(metres);
    el.rings.textContent = rings;
  }

  let toastTimer = null;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.remove("show");
    void el.toast.offsetWidth; // reflow to restart animation
    el.toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1200);
  }

  // ---------- loop ----------
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05) || 0;
    last = now;

    if (state === "playing") {
      speed = clamp(CFG.baseSpeed + metres * CFG.speedRamp * 0.01, CFG.baseSpeed, CFG.maxSpeed);
      distZ += speed * dt;
      metres += speed * dt * CFG.metresPerZ;
      Player.update(dt, speed);
      Obstacles.update(dt, speed, metres);
      score = computeScore();
      updateHud();
    } else if (state === "menu" || state === "over") {
      // attract animation behind the panels
      const s = CFG.baseSpeed * 0.7;
      distZ += s * dt;
      attractMetres += s * dt * CFG.metresPerZ;
      Player.update(dt, s);
    }

    render();
    requestAnimationFrame(frame);
  }

  function render() {
    const bgMetres = state === "playing" ? metres : attractMetres;
    World.drawBackground(ctx, bgMetres);
    World.drawTrack(ctx, bgMetres, distZ);
    if (state === "playing" || state === "paused") Obstacles.draw(ctx);
    Player.draw(ctx);
  }

  // ---------- input ----------
  function handleAction(a) {
    Sound.unlock();
    switch (state) {
      case "menu":
        if (a === "start" || a === "up") startGame();
        break;
      case "playing":
        if (a === "left") Player.left();
        else if (a === "right") Player.right();
        else if (a === "up") Player.jump();
        else if (a === "down") Player.slide();
        else if (a === "pause") pause();
        break;
      case "paused":
        if (a === "pause" || a === "start") resume();
        break;
      case "over":
        if (a === "start" || a === "up") startGame();
        break;
    }
  }

  // ---------- wire up ----------
  function init() {
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", () => setTimeout(resize, 200));

    Input.bind(handleAction);

    document.getElementById("btn-start").addEventListener("click", startGame);
    document.getElementById("btn-retry").addEventListener("click", startGame);
    document.getElementById("btn-resume").addEventListener("click", resume);
    document.getElementById("btn-quit").addEventListener("click", quitToMenu);
    document.getElementById("btn-menu").addEventListener("click", quitToMenu);
    document.getElementById("btn-pause").addEventListener("click", pause);

    const muteBtn = el.mute;
    muteBtn.textContent = Sound.isMuted() ? "🔇" : "🔊";
    muteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const m = Sound.toggleMute();
      muteBtn.textContent = m ? "🔇" : "🔊";
    });

    // pause when tab hidden
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state === "playing") pause();
    });

    setState("menu");
    last = performance.now();
    requestAnimationFrame(frame);

    // PWA (only registers on http/https, silently skips file://)
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  return { init, addCoin, addRing, onHit, get state() { return state; } };
})();

window.Game = Game;
window.addEventListener("load", Game.init);
