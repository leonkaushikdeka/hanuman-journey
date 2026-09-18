# Hanuman's Journey — Ring to Lanka

An endless lane runner (Temple Run / Subway Surfers style) where **Hanuman carries Shri Ram's ring across the Setu to Lanka**. Dodge boulders and rakshasas, jump over logs, slide under temple arches, and collect laddus and sacred rings.

Pure HTML5 Canvas + vanilla JavaScript — **no build step, no runtime dependencies**. The remastered edition adds cinematic key art, a responsive mythic UI, richer biome lighting, textured perspective roads, stronger character silhouettes, and a mobile-first HUD. It runs on desktop and mobile and installs as a PWA.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Change lane | ← → / A D | Swipe left / right |
| Jump | ↑ / W / Space | Swipe up / tap |
| Slide | ↓ / S | Swipe down |
| Pause | P / Esc | ⏸ button |

## Play locally

Just open `index.html` in a browser. For full PWA/service-worker behaviour, serve it over HTTP:

```bash
# from the project folder
python -m http.server 8000
# then visit http://localhost:8000
```

## Deploy free on GitHub Pages

1. Create a repo and push these files:
   ```bash
   git init
   git add .
   git commit -m "Add Hanuman's Journey runner"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. In the repo, go to **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) deploys automatically on every push to `main`.
4. Your game will be live at `https://<you>.github.io/<repo>/`.

> No Actions? You can also just pick **Deploy from a branch → main → / (root)** — all files are static.

## Project layout

```
assets/             # optimized presentation art
index.html          # markup + overlays (menu / pause / game over)
css/styles.css      # responsive UI + theme
js/utils.js         # config + helpers
js/storage.js       # high score + mute (localStorage)
js/audio.js         # synthesized SFX + ambient music (WebAudio)
js/input.js         # keyboard + touch/swipe
js/world.js         # perspective projection + parallax background + track
js/player.js        # Hanuman: run / jump / slide, drawn with canvas paths
js/obstacles.js     # obstacles, collectibles, scenery, spawning, collisions
js/game.js          # state machine, loop, HUD, scoring
manifest.json, sw.js, icon.svg   # PWA (installable + offline)
```
