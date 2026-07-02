# 🌌 Solar System 3D Explorer

<a href="README.md"><img src="https://img.shields.io/badge/Lang-中文-red?style=for-the-badge" alt="中文"></a>
<a href="README.en.md"><img src="https://img.shields.io/badge/Lang-English-blue?style=for-the-badge" alt="English"></a>
<a href="https://solarsystem.upstream.eu.cc"><img src="https://img.shields.io/badge/🌐_Live-solarsystem.upstream.eu.cc-FF6B35?style=for-the-badge" alt="Live demo"></a>
<a href="https://github.com/Upstream17/solar-system"><img src="https://img.shields.io/badge/☁️_Hosted_on-Cloudflare_Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Pages"></a>

A **Three.js 0.160** based 3D solar system explorer. Pure-frontend single-page app, no build step, deploys to Cloudflare Pages out of the box.

## ✨ Features

- **8 planets + Moon** — real NASA radius ratios, AU distance ratios, rotation/orbit periods
- **Real textures** — locally bundled planetary maps (no CDN dependency)
- **Sun glow** — 4 additive sprite layers, distance-graded
  - Close: tight warm-white core
  - Mid: warm-yellow outer rim
  - Far: full atmospheric scattering
- **Sun body** — warm white (real G2V stellar color temperature)
- **Star twinkle** — custom ShaderMaterial, per-star sin modulation
- **Camera-following starfield** — stars visible in all directions even at Neptune
- **Orbit tracking** — click planet or legend → camera flies to it + custom spherical camera control
- **Time speed** — pause / 1× / 100× multi-stage
- **Cloud layer** — separate sphere with noise displacement (no plastic-贴图 look)

## 🚀 Run Locally

No build step. Use any static server:

```bash
python -m http.server 8765
# open http://localhost:8765
```

> ⚠️ **Must use HTTP protocol, can't double-click `index.html`**: modern browsers block ES module loading from `file://`. Use a static server.

## ☁️ Deploy to Cloudflare Pages

**Method 1 — Direct Upload (easiest)**

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages
2. Click "Create a project" → "Direct Upload"
3. Drag the entire project directory in (must include `index.html` and `src/`)
4. Cloudflare auto-assigns a `*.pages.dev` subdomain
5. Done — no configuration needed

**Method 2 — GitHub Integration (auto-deploy)**

1. Push code to GitHub
2. Cloudflare Pages → "Connect to Git" → select your repo
3. Build settings: leave empty (**no build step**), Output dir = `/`
4. Every push auto-deploys

## 🎮 Controls

| Action | Behavior |
|---|---|
| Drag | Rotate view |
| Scroll wheel | Zoom |
| Right-click drag | Pan |
| Click planet | Track mode |
| Click legend | Track mode (re-click = re-fly) |
| ESC / Stop button | Exit tracking |
| Time-speed slider | 0 (pause) ~ 100× |
| Sun-brightness slider | PointLight intensity |
| Sun-glow checkbox | Toggle 4 sprite layers + bloom |

## 📁 File Structure

```
solar-system/
├── index.html              # HTML + CSS + importmap
├── src/
│   ├── main.js             # Entry + main loop
│   ├── scene.js            # Three.js scene + OrbitControls + Bloom + stars
│   ├── lighting.js         # Sun light + 4-layer glow sprites
│   ├── planets.js          # Sun/planets/moon factory
│   ├── tracking.js         # Tracking system (custom spherical camera)
│   ├── ui.js               # UI controls + interaction
│   ├── scale.js            # Real-scale compression
│   ├── constants.js        # Astronomy data tables
│   ├── textures.js         # Texture loader (with procedural fallback)
│   └── textures/           # Locally bundled planet/satellite/glow textures
```

## 🛠️ Tech Stack

- **Three.js 0.160.0** + OrbitControls + EffectComposer + UnrealBloomPass
- **Native ES Modules** (no webpack / vite / bundler)
- **WebGL 2** (modern browser required)
- **importmap** for three.js (CDN: unpkg)

## 📜 Credits

- **Three.js** — [mrdoob/three.js](https://github.com/mrdoob/three.js) (MIT)
- **Planet textures** — Solar System Scope ([solarsystemscope.com](https://www.solarsystemscope.com/textures/)) (CC BY 4.0)
- **Astronomy data** — NASA Planetary Fact Sheet

## 📄 License

MIT
