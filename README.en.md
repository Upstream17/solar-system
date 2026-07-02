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
- **Cloud layer** — separate sphere with noise displacement (no plastic-texture look)

## 🚀 Run Locally

No build step. Use any static server:

```bash
python -m http.server 8765
# open http://localhost:8765
```

> ⚠️ **Must use HTTP protocol, can't double-click `index.html`**: modern browsers block ES module loading from `file://`. Use a static server.

## ☁️ Deploy to Cloudflare Pages

Deployed via **Cloudflare Pages + GitHub integration**: every `git push` auto-deploys in ~30s.

**Live**: [https://solarsystem.upstream.eu.cc](https://solarsystem.upstream.eu.cc) (custom domain) + `https://solar-system-etk.pages.dev` (Cloudflare default)

### One-time setup

1. **Create the Pages project**
   - Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** (NOT Workers)
   - **Connect to Git** → GitHub → authorize → pick `Upstream17/solar-system`

2. **Build settings** (critical — must be exact):
   | Option | Value |
   |---|---|
   | Project name | `solar-system` (Cloudflare appends suffix like `-etk` if taken) |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | **leave empty** (no build step) |
   | Build output directory | `/` |

3. **Save and Deploy** → wait 30-60s → "Your site is live" → done

### Custom domain (optional)

If you own a domain (e.g. `upstream.eu.cc`), bind a subdomain like `solarsystem.upstream.eu.cc`:

1. Pages project → **Custom domains** → **Set up a custom domain** → enter `solarsystem.upstream.eu.cc`
2. Cloudflare auto-configures the CNAME (if the domain is already on Cloudflare)
3. **If the domain is not on Cloudflare**, add at your DNS provider:
   ```
   Type: CNAME
   Name: solarsystem
   Target: solar-system-etk.pages.dev
   Proxy: DNS only (toggle cloud icon OFF)
   ```
4. SSL certificate auto-issues in 5-15 minutes

> ⚠️ **Apex domains like `upstream.eu.cc` cannot be bound directly** — must use a subdomain prefix.

### Day-to-day deploy

```bash
git add -A
git commit -m "your change"
git push origin main
```

Cloudflare detects the push → builds → deploys → live in 30s. **No wrangler commands, no API tokens needed.**

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
