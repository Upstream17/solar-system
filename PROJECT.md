# PROJECT — 太阳系 3D 探索器

> **给 AI 助手读的项目索引** — 跨会话续接时，先读这个文件就能掌握当前开发现状，不用重新探索。

> **最后更新**：2026-07-11 (v20260711b 环真实化 commit & push 已完成)
> **基线 commit**：见 `git log -1`（v20260711b 土星+天王星环按 NASA 真实比例重设 — A 环 74500/141000 km, ε 环 38940/51140 km）
> **上一基线 commit**：`ff5fdda`（v20260711 JPL 三维轨道 + 删 3D label + 段数自适应 + 月球轨道 + 天王星 ring 缩）
> **再上一基线 commit**：`12a74aa`（v20260708 轨道 + 时间基线 — 椭圆轨道 + 小行星带 + 1× = 1 hour/sec + slider 上限 1000×）

---

## 0. 一句话总览

**纯前端 Three.js r160 太阳系 3D 模拟器**，8 大行星 + 月球，**真实 AU 比例轨道**（DIST_SCALE ×16），**零构建**（无 package.json / 无 node_modules），用 `<script type="importmap">` + unpkg CDN 引入依赖，部署在 **Cloudflare Pages**（`https://solarsystem.upstream.eu.cc/`）。

**LOD 系统**：每行星动态阈值 `realSize × 384`（视觉 2px 距离）；远档用 4px sprite dot；近档用原 mesh（带贴图 + 环 + 云层）。**太阳永远 mesh + godrays**（删了 sun LOD 二档切档，避免 sprite 视觉跳变）。

**太阳辉光**：双层 — `pmndrs/postprocessing` 的 `GodRaysEffect`（screen-space raymarched，从 sun mesh 屏幕坐标辐射光线）+ `BloomEffect`（中心提亮 luminanceThreshold 0.92）。**远日轨道占位亮星**：`makeDistantGlow` 在 D > 4000u 时渲染一颗**屏幕固定 48px** 的暖黄星芒 sprite（`lensflare_processed.png` 用户调好对比度，黑底全透明），木星及之外可见，火星-木星间渐入，内行星带不渲染（保持物理空旷感）。

---

## 1. 技术栈

| 类别 | 选型 | 备注 |
|---|---|---|
| 渲染 | **Three.js r160** | unpkg CDN：`https://unpkg.com/three@0.160.0/build/three.module.js` |
| 后处理 | pmndrs/postprocessing 6.36.4 + three.js 后处理混用 | `EffectComposer` / `RenderPass` / `EffectPass` 用 pmndrs |
| 太阳辉光 | `GodRaysEffect`（screen-space raymarched） | 从 sun mesh 屏幕坐标辐射光线 |
| 中心提亮 | `BloomEffect`（pmndrs，等价 UnrealBloomPass） | `intensity 0.4` + `luminanceThreshold 0.92` |
| 控件 | OrbitControls | camera 拖拽/缩放/旋转；`maxDistance 200000` |
| 依赖管理 | importmap + unpkg CDN | **零 npm install** |
| 构建 | **无** | index.html + src/*.js 直接上传 |
| i18n | 自写 dict（zh-CN / en）| i18n.js |
| 音频 | CC0 mp3 ambient 音乐 | src/audio/ambient.mp3（2.1 MB）|

**importmap 关键项**：
```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
    "postprocessing": "https://unpkg.com/postprocessing@6.36.4/build/index.js"
  }
}
</script>
```

**postprocessing 兼容性**：6.36.x 要求 three ≥ 0.157 < 0.171（本项目 three 0.160 兼容）；最新 6.39.x 要求 three ≥ 0.168，**不兼容**。**不要随意升级**。

---

## 2. 文件结构

```
solar-system/
├── index.html               # 入口 HTML + importmap + 全部 SEO meta + 错误处理
├── _headers                 # Cloudflare Pages 缓存配置（HTML no-cache, JS/CSS immutable 1y）
├── robots.txt               # SEO
├── sitemap.xml              # SEO
├── README.md / README.zh-CN.md / README.en.md   # 用户文档
├── PROJECT.md               # 本文件（项目索引，AI 上下文）
├── AGENTS.md                # 给 AI 助手的快速上下文入口
│
├── src/
│   ├── main.js              # 入口 — async init() 串联所有模块
│   ├── scene.js             # scene + camera + renderer + OrbitControls + 星空 + 后处理 pipeline（GodRays + Bloom）
│   ├── lighting.js          # 光照（sunLight PointLight, decay=0 模拟平行光 + ambient）
│   ├── planets.js           # makeSun / makePlanet (含 LOD) / makeMoon (含月球轨道 line) / getOrbitPosition + makeOrbit (JPL 三维椭圆 v20260711, 段数自适应) / makeAsteroidBelt / makePlanetDot
│   ├── constants.js         # NASA/JPL 数据（PLANETS、MOON、SUN_FACTS、DIST_SCALE=2560、SUN_R=12）
│   ├── scale.js             # 距离/半径缩放工具
│   ├── textures.js          # safeTexture 加载器
│   ├── ui.js                # 全部 UI（slider / toggle / info panel / legend / tracking stop）
│   ├── i18n.js              # 双语字典 + 切换
│   ├── tracking.v2.js       # 行星/太阳追踪系统（点击跳转相机）
│   ├── loader.js            # 启动加载 overlay
│   ├── ambient.js           # 背景音乐播放控制
│   │
│   ├── audio/
│   │   └── ambient.mp3      # CC0 背景音乐（2.1 MB）
│   │
│   └── textures/
│       ├── sun.jpg / earth.jpg / ... / neptune.jpg   # 各行星贴图
│       ├── earth_clouds.jpg / earth_normal.jpg        # 地球专用
│       ├── saturn_ring.jpg / uranus_ring.jpg          # 行星环
│       ├── lensflare0.png ~ lensflare3.png            # 备用（项目保留但未使用 — 大半实心圆没有明显星芒）
│       └── lensflare_processed.png                    # 远日占位 sprite 用的星芒贴图（用户调好对比度，黑底全透明）
│
└── .git/                    # git 仓库，远程 origin/main
```

---

## 3. 核心文件功能摘要

### `index.html`
- 唯一 HTML 文件
- 完整 SEO meta（Open Graph / Bing / Google / Baidu 验证）
- `<script type="importmap">` 定义 three + three/addons + postprocessing
- 全局 `error` 和 `unhandledrejection` 监听器 → 错误弹窗
- 入口 `<script type="module" src="./src/main.js">`
- 折叠面板 UI（CONTROLS / DASHBOARD / BODIES）+ GitHub 链接按钮 + 背景音乐按钮

### `src/main.js` — 入口
- `Loader.show()` 立即显示加载层
- `async init()`：
  1. `initScene()` → scene/camera/renderer/controls/stars/composer/bloomPass + setSunMesh + setGodRaysEnabled
  2. `initLighting()` → sunLight（PointLight, decay=0 模拟平行光）+ ambient
  3. `makeSun(scene)` → 太阳 mesh, add 到 scene, setSunMesh 注入 GodRays
  4. 循环 `makePlanet(scene, p)` → 8 大行星（带 LOD）
  5. `makeMoon()` → 月球，挂到地球 pivot
  6. `scaleScene()` → 应用 DIST_SCALE 缩放
  7. `initI18n()` 必须在所有 UI 之前
  8. UI 初始化（sliders / toggles / info / tracking / collapse）
  9. 点击交互
  10. 图例、浮动工具按钮
  11. resize 监听
  12. **主循环** `tick()`：
      - deltaReal（相机动画、星空旋转）/ deltaSim（受 speedFactor 影响）
      - **SIM_DAYS_PER_SEC = 1/24 (v20260708 C 方案, 1× = 1 hour/sec)**
      - 行星公转（JPL 三维 Keplerian elements：e / I / Ω / ϖ；公式 r=a(1-e²)/(1+e·cosθ) 后转黄道坐标）+ 自转 + 地球云层反向旋转
      - **月球轨道 (v20260708)**:
        - 椭圆: r = a(1-e²)/(1+e·cos(theta)), a=MOON.distance=8, e=MOON.eccentricity=0.0549
        - 月球 mesh 位置每帧重算 moon.mesh.position.x = r (距 pivot 7.56-8.44)
        - 月球 pivot rotation.y = elapsedDays × wm (wm = 2π/27.3) — 月球公转
        - 月球 pivot rotation.x = 5.145° (NASA 真实轨道倾角)
        - 月球挂 earth.pivot (不是 earth.mesh) — 摆脱 23.44° tilt
      - 太阳自转
      - 星空 uTime + 位置跟随相机
      - v20260711 删 3D label, 行星名只走图例 + 信息面板
      - **LOD update** + 远档 dot 屏幕 4px scale
      - **distantGlow.update(cameraDistance)** — 远日占位 sprite 按距离 LOD 渐入
      - **小行星带 tick** — 2000 颗 Points 位置每帧重算
      - 相机动画 + 追踪
      - `composer.render(deltaReal)` — pmndrs composer 需要传 deltaTime

### `src/scene.js` — 场景/相机/星空/后处理
- 程序化生成圆形柔边贴图（星星 64×64）
- `makeStars(count, radius, sizeRange)` — ShaderMaterial 实现闪烁
- `_starsGroup` 每帧跟随相机平移
- `regenerateStars(scene, densityPercent)` — 销毁旧 stars + 重建
- `initScene()` 返回：scene / camera (far=200000) / renderer / controls / stars / composer (pmndrs) / bloomPass / setSunMesh / setGodRaysEnabled
- **后处理 pipeline 顺序**：
  ```
  RenderPass(scene, camera)
    → GodRaysEffect(EffectPass)  ← 从 sun mesh 屏幕坐标辐射光线
    → BloomEffect(EffectPass)    ← 中心提亮（luminanceThreshold 0.92）
  ```
- **GodRaysEffect 调参（v4 收敛版）**：
  ```js
  {
    height: 480,
    kernelSize: KernelSize.SMALL,
    density: 0.94,       // 略降: 减少累积采样误差
    decay: 0.88,         // 略降: rays 长度收敛 (避免远观大光晕)
    weight: 0.30,        // 避免过曝淹没太阳本体
    exposure: 0.40,      // 略降: rays 亮度更克制
    samples: 80,
    clampMax: 1.0,
    blendFunction: BlendFunction.SCREEN
  }
  ```
- **pmndrs EffectComposer 接口差异**（vs three.js 内置）：
  - `composer.render(deltaTime)` 需要显式传 deltaTime
  - 不需要 OutputPass（自带 tone mapping）
  - `addPass(pass, index)` 第二个参数是 index

### `src/lighting.js` — 光照
- `initLighting(scene)`：AmbientLight(0x8090b0, 0.45) + PointLight(0xffffff, 3.5, 0, 0)
- **不调用** `makeSunGlow`（godrays 接管，4 层 sprite 方案废弃保留代码但不用）
- `getWhiteGlowTex()`：程序化径向渐变白色贴图（保留兼容，未被使用）
- `loadLensFlareTex()`：异步加载 `lensflare_processed.png`，单例缓存，**不做任何处理**（用户已调好对比度）
- `makeDistantGlow(sunR, camera, renderer)`：**远日轨道太阳占位 sprite**
  - async 加载 lens flare 贴图
  - SpriteMaterial: NormalBlending + depthTest:false + renderOrder:9999 + sizeAttenuation:true
  - color: 0xffe890（暖黄染色）
  - LOD 阈值: D < 4000u 不渲染 / 4000~13000u smoothstep 渐入 / > 13000u 满显 opacity 1.0
  - 屏幕尺寸 48px 固定: scale = 48 × cameraDistance × 2 × tan(fov/2) / canvasH，每帧重算
  - 挂到 userData.distantGlow，main.js tick 每帧调 update(cameraDistance)

### `src/planets.js` — 太阳 + 行星 + 月球 工厂
- v20260711 删除 `makeTextSprite / addLabel` — 3D 场景不叠加 Sprite 文字标签
- `addLabel(parent, text, yOffset)` — 挂标签，标记 `userData.isLabel = true`
- `getOrbitPosition(distance, eccentricity, perihelion, inclination, ascendingNode, theta)` — JPL 三维轨道坐标 (v20260711)
  - 公式: r(θ)=a(1-e²)/(1+e·cosθ)，太阳在焦点；再用 Ω / I / ω=ϖ-Ω 转 J2000 黄道坐标
  - Three.js 映射: world.x=ecliptic.x, world.z=ecliptic.y, world.y=ecliptic.z
- `makeOrbit(distance, eccentricity, perihelion, inclination, ascendingNode, color)` — 256 段 LineLoop 三维椭圆轨道环 + 每行星独立颜色
- `makeAsteroidBelt(distScale)` (v20260708) — 2000 颗 THREE.Points, 2.1-3.3 AU 主带
  - 每颗独立 ecc 0.05-0.2 / perihelion 随机 / inclination ±10°
  - `updateAsteroidBelt(points, elapsedDays)` 每帧重算位置, 固定 opacity 0.7 (LOD 反了已删)
- `makePlanetDot(color)` — 远档 sprite（AdditiveBlending + 行星 color + 圆形贴图，tick 算屏幕 4px scale）
- `makePlanetWithLOD(mesh, color, realSize)` — THREE.LOD 包装：2 档（mesh + dot），阈值 = `realSize × 384`（视觉 2px 距离）
- **LOD 阈值表**（默认相机 3354 距太阳）：
  - 水星 147 / 金星 364 / 地球 384 / 火星 204 / 木星 4304 / 土星 3628 / 天王星 1539 / 海王星 1491
  - 默认相机下**全部 8 颗**距相机 > 阈值 → **全远档 dot**
  - 用户拉近到 ~realSize×400 距离内 → 切近档 mesh
- `makeSun(scene, camera, renderer)`：
  - `safeTexture('./src/textures/sun.jpg')`
  - SphereGeometry(1.0, 64, 64) + `MeshBasicMaterial({color: 0xfff5d8, toneMapped: false})`
  - **永远 add mesh 到 scene（删了之前的 sun LOD 二档切档）**
  - sun label v20260711 已删
  - **v20260707**: 调用 `makeDistantGlow(SUN_R, camera, renderer)` 创建远日占位 sprite，挂到 `userData.distantGlow`
- `makePlanet(scene, p)`：
  - realSize 几何（地球=1 基准）
  - MeshStandardMaterial
  - 土星/天王星环（RingGeometry + 贴图 UV 重映射）
  - 地球云层（独立 sphere + 顶点 displacement + 反向旋转）
  - **LOD 包装**：mesh 作为近档 + makePlanetDot(p.color) 作为远档
  - **每行星动态阈值** `realSize × 384`
- `makeMoon()` — 月球 mesh + pivot，挂在地球上

### `src/constants.js` — NASA 天文数据
- `AU = 1`，`DIST_SCALE = 2560`（×16 真实化）
- `SUN_R = 12.0`
- `PLANETS[]` — 8 行星（每颗含 JPL distance/eccentricity/inclination/ascendingNode/perihelion/orbitColor + realSize/diameterKm/orbit/rotation/tilt/texture/factsZh/factsEn/factZh/factEn）
- `MOON`, `SUN_FACTS`

### `src/scale.js` — 缩放工具
- `getPlanetDisplayRadius(p)` = p.realSize
- `getSunDisplayRadius()` = SUN_R
- `getDisplayDistance(p)` = AU × DIST_SCALE
- `scaleScene()` — 遍历所有行星/轨道/标签应用缩放
- 相机初始位置 (0, 1500, 3000)（DIST_SCALE×16 后太阳视觉 ~0.7% 视野）

### `src/textures.js` — 贴图加载
- `safeTexture(url, label, onTick)` — 加载 + 错误降级 + 进度回调

### `src/i18n.js` / `src/tracking.v2.js` / `src/loader.js` / `src/ambient.js`
- 标准 i18n 字典 / 追踪系统（pinch 修复版）/ 加载层 / 背景音乐

---

## 4. 关键不变量（事实）

- **基线 commit**：v20260711b（见 `git log -1`，土星+天王星环按 NASA 真实比例重设）
| **太阳辉光当前方案**：`GodRaysEffect`（pmndrs 6.36.4，screen-space raymarched，永远启用，无 LOD 切档） |
| **后处理顺序**：RenderPass → GodRaysEffect → BloomEffect（pmndrs EffectComposer 接管） |
| **太阳材质**：`MeshBasicMaterial({color: 0xfff5d8, toneMapped: false})` |
| **distantGlow sprite**：`depthTest:true` + `renderOrder:0`（默认）+ `NormalBlending` + `frustumCulled:false`。**不要** `depthTest:false` + `renderOrder:9999`——会让 distantGlow 被当成 godrays 新光源向四周辐射（v20260708 修复） |
| **轨道真实化 (v20260711 工作树)**：8 行星使用 JPL Approximate Positions Table 1 (J2000, 1800-2050) 的 a/e/I/ϖ/Ω；`getOrbitPosition` 先算 r(θ)=a(1-e²)/(1+e·cosθ)，再按 Ω/I/ω=ϖ-Ω 转黄道坐标；轨道线和行星 pivot 同一公式；每颗轨道线使用独立 `orbitColor` |
| **小行星带 (v20260708)**：2000 颗 THREE.Points, 2.1-3.3 AU, 1 draw call; **固定 opacity 0.7, 无 LOD 渐变** (远档 α 累积反成实心带, 7ebe793 修复) |
| **时间流速 (v20260708)**：SIM_DAYS_PER_SEC = 1/24, 1× = 1 hour/sec; slider max 125, v=125→1000× (10^(125-50)/25 = 10^3); 1× 看自转, 100-1000× 看公转 |
- **轨道真实化**：`DIST_SCALE = 2560`（×16），水星距太阳 998 单位 = 83 个太阳直径（真实）
- **LOD 系统**：
  - 行星：`THREE.LOD`，阈值 = `realSize × 384`（视觉 2px 距离）
  - 远档：4px sprite dot（AdditiveBlending + 行星 color）
  - 近档：原 mesh（带贴图 + 环 + 云层）
  - 太阳：单一 mesh（删了 sun LOD，避免 sprite 视觉跳变）
- **3D label 系统** | v20260711 已删。行星名 / Sun 名通过图例 (BODIES panel) + 信息面板 (info-panel) 显示；3D 场景不叠加 Sprite 文字标签
- **相机/控制范围**：camera.far 200000, OrbitControls.maxDistance 200000, zoomSpeed 2.0
- **Cloudflare Pages 缓存**：HTML no-cache / JS+CSS 1 年 immutable（`_headers`）

---

## 5. 历史关键 commit

| Commit | 改动 |
|---|---|
| `cc2564b` | 新增 PROJECT_INDEX.md（后被重命名为 PROJECT.md） |
| `3bf5415` | 新增 AGENTS.md |
| `c317f17` | **辉光基线** — 太阳辉光改用 pmndrs/postprocessing GodRaysEffect |
| `5e7d278` | **真实化基线** — DIST_SCALE 160→2560（×16），camera 拉远到 (0,1500,3000)，camera.far 200000 |
| `b24f82d` | **LOD 基线** — 远档 sprite dot（屏幕 24px 初始）+ label 屏幕像素尺寸动态 clamp — **v20260711 label 整体删除** |
| `3e23ac4` | **LOD 优化** — 阈值改成每行星动态 `realSize × 384`，远档 dot 24px→4px，新增太阳 LOD（mesh↔sun dot sprite 切档） |
| `b1c4a83` | 删太阳 LOD（二档切档 sprite 视觉丑，跟 mesh 跳变），godrays 参数收敛（density 0.94/decay 0.88/exposure 0.40） |
| `d14d943` | docs: 更新 PROJECT.md 对齐 b1c4a83 基线 |
| `7134d28` | `makeDistantGlow` 远日轨道太阳占位 sprite (LOD + 屏幕固定 48px + 用户调好对比度的 `lensflare_processed.png`)，解决远日轨道看不到太阳位置的问题 |
| `2249d02` | 移动端音乐按钮 script 错 (try/catch + 绝对路径) + 太阳 LOD 贴图渲染层级 (depthTest:true + renderOrder:0 解决 distantGlow 被当成 godrays 新光源) |
| **`9191c27`** | **椭圆轨道 + 小行星带 (v20260708)** — `makeOrbit` 改椭圆参数公式 r=a(1-e²)/(1+e·cos(θ)) + 太阳在焦点 + perihelion 各异椭圆朝向不重; `makeAsteroidBelt` 2000 颗 Points 分布 2.1-3.3 AU, LOD 远档(>8000u) opacity 0.15 雾带 / 近档(<4000u) opacity 0.6 清晰, 1 draw call 移动端 60fps; 8 行星 inclination=0 (黄道面对齐, A 方案); 公转用 M≈θ 简化, 视觉足够 |
| `7ebe793` | fix(belt): 小行星带 LOD 反了, 删掉 opacity 渐变 — 远档 α 累积反成实心带, 近档累积失效反稀, 固定 opacity 0.7 让 2000 颗自然累积 |
| `1416789` | feat(time): 1× = 1 day/sec (D 方案, 自转/公转比例对齐真实, 地球年 6 分 5 秒) — **已被 b1a5aff 推翻** |
| `b1a5aff` | feat(time): 1× = 1 hour/sec (C 方案) — 1× = 1 hour/s, 地球自转 24 sec, 公转 4 小时; 旧值 5 day/s → 1 day/s (D) → 1/24 day/s = 1 hour/s (C) |
| `12a74aa` | **再上一基线 (v20260708 轨道+时间)** — slider max 100→125, 1000× 触达 (公式 (v-50)/25 不变, v=125 → 10^3 = 1000×); 1000× = 1000 hour/s = 41.7 day/s, 地球年 8.75 秒看完 |
| `ff5fdda` | **上一基线 (v20260711 轨道+天文+UI)** — 8 行星换用 JPL Table 1 (J2000) a/e/I/ϖ/Ω 实现三维真轨道 + 每行星独立轨道色；`makeOrbit` 段数自适应 clamp(round(a/5000×256),256,2048)；`makeMoon` 新增 128 段椭圆 line (#48a9ff, 5.145°倾角) 作为 `moonOrbitTilt` 挂到 earth.pivot；删 `makeTextSprite/addLabel/sun label` + `toggle-labels` UI；天王星 ring 12.82u → 6.41u；camera 近距抖动用 LOD 8% 迟滞 |
| **`v20260711b`** | **当前基线 (土星+天王星环按 NASA 真实比例重设)** — 之前土星 ring 3.5/6.5 把环放大了 3 倍 ("夸张的电影土星", 真实 A 环 74500/141000 km / 行星半径 60268 km = 1.24/2.34 倍 mesh 半径); 天王星 ring 1.4/1.6 把 ε 环缩进 mesh 里且只剩 0.2 倍半径宽 (真实 ε 环 38940/51140 km / 行星半径 25362 km = 1.54/2.02 倍 mesh 半径)。新环宽比 土星:天王星 = 1.10/0.48 = 2.29 倍 ≈ NASA 真实 2.15 倍 ✓ |
| **WORKTREE v20260711** | **JPL 三维轨道 + 删 3D label + 段数自适应 + 月球轨道** — `constants.js` 更新 8 行星 a/e/I/Ω/ϖ 为 JPL Table 1；新增 `orbitColor`；`planets.js` 增加 `getOrbitPosition` 统一轨道线与行星位置；`makeOrbit` 段数自适应 `clamp(round(a/5000×256),256,2048)`；删除 `makeTextSprite/addLabel/sun label`；`makeMoon` 新增 128 段椭圆 line (e=0.0549, 5.145°倾角) 作为 `moonOrbitTilt` 挂到 earth.pivot，色 #48a9ff opacity 0.4；UI 删 `toggle-labels` switch 与字典 `show_labels`。验证：node --check 通过；浏览器 nLabels=0, nOrbits=9, segCounts∈[256,2048], moonOrbit 半径 7.56-8.44 ✓ |

**v20260707 distantGlow 设计过程教训**：
1. **路线 3（godRaySource 150u 固定 mesh）失败**：world-unit 尺寸跟相机距离不解耦 → 近视角巨大光球
2. **方案 2 v1（sizeAttenuation:true + clamp(40,150)）失败**：远距离 saturate → 完全看不见
3. **方案 2 v3（sizeAttenuation:false + 屏幕固定 80px）失败**：scale 单位是世界单位不是像素，scale × distance 巨大 → 糊屏
4. **方案 2 v4-v5**：用 distance 反推 scale（屏幕固定 48px），NormalBlending + depthTest:false + renderOrder:9999 — 但贴图是程序化径向看着"实心圆盘"，分界明显
5. **v6 用 lensflare0_alpha.png 失败**：原图是大半实心圆+微弱星芒，阈值过滤后看着跟程序化径向一样 → 用户 push back
6. **v6.3 用 `lensflare_processed.png`（用户调好对比度）成功**：黑底全透明 + 中心高亮实心圆 + 6 道贯穿星芒 + 暖橙色调 → 直接加载无 Canvas 处理，SpriteMaterial.color 暖黄染色

**根本教训**：任何 sprite 方案"屏幕占比合理" + "远距离可见"是二选一。**真正解法**：屏幕固定像素（每帧反推 scale）+ 用户调好对比度的真实摄影贴图 + NormalBlending 不糊屏 + depthTest:false 不被 sun mesh 自己遮挡。

**其他教训记录**：
1. **sprite 在 pmndrs composer 下能正常渲染**（之前误判为不显示，实际是 scale 太小导致亚像素）
2. **SpriteMaterial + CanvasTexture 跟 mesh + CanvasTexture 都能渲染**，关键是 tick 按相机距离动态算 scale 让屏幕尺寸固定
3. **LOD 阈值用"视觉直径 = 2px 距离 = realSize × 384"** 比固定值好（每行星独立的切换距离）
4. **太阳 LOD 二档切档（mesh↔sprite）视觉跳变**——sprite 6px core + 12px halo + AdditiveBlending 跟星空叠加变成巨大光球，丑。改成永远 mesh + godrays 解决
5. **lens flare 资源在 `src/textures/lensflare0.png` 系列** — 真实摄影贴图，但大半实心圆没有明显星芒；`lensflare_processed.png` 是用户调好对比度的版本（黑底全透明 + 星芒）

---

## 6. 待办 / 后续方向
- Cloudflare Pages 部署：直接 `git push` 触发自动构建（无需任何 build step）— **已部署 `ff5fdda` 至 origin/main, Cloudflare Pages 会在下次 webhook 时拉取**
- 远档 dot 当前屏幕 4px，可调（5-8px 让 dot 更明显）
- 4 个外行星（土/天/海）默认相机下距 > 5000，但阈值 ≤ 4304 应该是 dot —— **确认 LOD 切档对 4 外行星正确**（L1 dot）
- 如果 godrays 在某些视角（特别是从行星表面看太阳时）出现视觉异常，再调 `density` / `decay` / `samples`
- 太阳辉光优化：1× 时 `GodRaysEffect` + `BloomEffect` 偏亮，远档需要更柔和的 sun mesh（待评估）

---

## 7. 跨会话使用方式

如果在新会话里读到这个文件：

1. **确认 git 状态**：先看 `git status --short`；若有 v20260711 工作树改动，重点检查 `src/constants.js / src/planets.js / src/scale.js / src/main.js / PROJECT.md`
2. **不需要再读所有源码** — 直接基于第 3 节的功能摘要判断要怎么改
3. **要改某个文件的具体细节**时，再用 read_file 读那一个文件
4. **新 commit 后**：更新第 5 节的 commit 列表和第 4 节的"基线 commit"
5. **优先回滚到上一基线**：`git checkout 12a74aa -- src/ PROJECT.md index.html` 回到 v20260708 椭圆轨道时间基线

---

## 8. 关键 importmap（防止被改坏）

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
    "postprocessing": "https://unpkg.com/postprocessing@6.36.4/build/index.js"
  }
}
</script>
```

**不要随意升级 three 版本** —— 项目里用了多个 r160 后引入的 API（ACES tone mapping、MeshBasicMaterial 的 toneMapped 选项等）。
**不要随意升级 postprocessing** —— 6.39.x 要求 three ≥ 0.168，本项目 three 0.160 不兼容。如果要升级，先跑一遍兼容性测试。
