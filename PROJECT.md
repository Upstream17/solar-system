# PROJECT — 太阳系 3D 探索器

> **给 AI 助手读的项目索引** — 跨会话续接时，先读这个文件就能掌握当前开发现状，不用重新探索。
>
> **最后更新**：2026-07-06
> **基线 commit**：`待提交 — GodRaysEffect 辉光方案`（46fd802 的 sprite 方案已被 godrays 完全替代）

---

## 0. 一句话总览

**纯前端 Three.js 太阳系 3D 模拟器**，8 大行星 + 月球真实比例轨道，**零构建**（无 package.json / 无 node_modules），用 `<script type="importmap">` + unpkg CDN 引入依赖，部署在 **Cloudflare Pages**（`https://solarsystem.upstream.eu.cc/`）。

**太阳辉光方案**：`pmndrs/postprocessing` 的 `GodRaysEffect`（screen-space raymarched，社区 2.8k stars 标准方案）。替换了之前的 4 层 sprite 方案，效果更真实、零构建门槛不增加。

---

## 1. 技术栈

| 类别 | 选型 | 备注 |
|---|---|---|
| 渲染 | **Three.js r160** | unpkg CDN：`https://unpkg.com/three@0.160.0/build/three.module.js` |
| 后处理 | pmndrs/postprocessing 6.36.4 + three.js 后处理混用 | `EffectComposer` / `RenderPass` / `EffectPass` 用 pmndrs；不再用 three.js 内置 `UnrealBloomPass` |
| 太阳辉光 | `GodRaysEffect`（screen-space raymarched） | 关键 effect，从 sun mesh 中心向四周辐射 |
| 中心提亮 | `BloomEffect`（pmndrs，等价 UnrealBloomPass） | `intensity 0.4` + `luminanceThreshold 0.92` |
| 控件 | OrbitControls | camera 拖拽/缩放/旋转 |
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
│
├── src/
│   ├── main.js              # 入口 — async init() 串联所有模块
│   ├── scene.js             # scene + camera + renderer + OrbitControls + 星空 + 后处理 pipeline（GodRays + Bloom）
│   ├── lighting.js          # 光照 + 太阳辉光 makeSunGlow（保留但不再调用，详见 §3）
│   ├── planets.js           # makeSun / makePlanet / makeMoon / makeOrbit
│   ├── constants.js         # NASA 数据（PLANETS、MOON、SUN_FACTS、DIST_SCALE=160、SUN_R=12）
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
│       └── lensflare0.png ~ lensflare3.png            # 备用（项目保留但未使用）
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
  3. `makeSun(scene)` → 太阳本体（MeshBasicMaterial 暖白 G2V 颜色）
  4. `makeSun(scene).then(setSunMesh)` → 把 sun mesh 注入 GodRaysEffect
  5. 循环 `makePlanet(scene, p)` → 8 大行星
  6. `makeMoon()` → 月球，挂到地球 pivot
  7. ~~`scene.add(makeOrbit(SUN_R * 1.05))` 太阳赤道环~~ — **已删除**（看起来像"幽灵轨道"，跟水星轨道距离过近）
  8. `scaleScene()` → 应用 DIST_SCALE 缩放
  9. `initI18n()` 必须在所有 UI 之前
  10. UI 初始化（sliders / toggles / info / tracking / collapse）
  11. 点击交互
  12. 图例、浮动工具按钮
  13. resize 监听
  14. **主循环** `tick()`：
      - deltaReal（相机动画、星空旋转）/ deltaSim（受 speedFactor 影响）
      - 行星公转 + 自转 + 地球云层反向旋转
      - 月球轨道
      - 太阳自转
      - 星空 uTime + 位置跟随相机
      - ~~`sun.userData.glowUpdate()` — 4 层 sprite 距离驱动~~ — **已停用**（godrays 接管）
      - 相机动画 + 追踪
      - `composer.render(deltaReal)` — pmndrs composer 需要传 deltaTime

### `src/scene.js` — 场景/相机/星空/后处理
- 程序化生成圆形柔边贴图（星星 64×64）
- `makeStars(count, radius, sizeRange)` — ShaderMaterial 实现闪烁
- `_starsGroup` 每帧跟随相机平移
- `regenerateStars(scene, densityPercent)` — 销毁旧 stars + 重建
- `initScene()` 返回：
  - scene / camera / renderer / controls / stars
  - composer（**pmndrs 的 EffectComposer**，不是 three.js 的）
  - bloomPass（pmndrs BloomEffect 包装的 EffectPass）
  - `setSunMesh(sunMesh)` — main.js 在 makeSun 后调用，把 sun mesh 绑给 GodRaysEffect
  - `setGodRaysEnabled(bool)` — UI SUN GLOW toggle 调用，控制 GodRaysEffect pass 开关
- **后处理 pipeline 顺序**：
  ```
  RenderPass(scene, camera)        → 渲染场景到 buffer
    → GodRaysEffect(EffectPass)     → 从 sun mesh 屏幕坐标辐射光线
    → BloomEffect(EffectPass)       → 中心提亮（luminanceThreshold 0.92）
    → (OutputPass 不需要，pmndrs 自动 tone mapping)
  ```
- **GodRaysEffect 关键参数**（调优后）：
  ```js
  {
    height: 480,
    kernelSize: KernelSize.SMALL,
    density: 0.96,       // 接近 1：rays 密而连续（避免相机突变时采样闪烁）
    decay: 0.92,         // rays 长度合理
    weight: 0.3,         // 避免过曝
    exposure: 0.45,      // rays 亮度克制
    samples: 80,         // 采样数（缩放时更平滑）
    clampMax: 1.0,
    blendFunction: BlendFunction.SCREEN  // 屏幕叠加
  }
  ```
- **pmndrs EffectComposer 接口差异**（vs three.js 内置）：
  - `composer.render(deltaTime)` 需要显式传 deltaTime
  - 不需要 OutputPass（自带 tone mapping）
  - `addPass(pass, index)` 第二个参数是 index（不是 insertPass）

### `src/lighting.js` — 光照 + 太阳辉光（4 层 sprite 方案保留）
- `initLighting(scene)`：AmbientLight(0x8090b0, 0.45) + PointLight(0xffffff, 3.5, 0, 0)
- `makeSunGlow(sunR)`：**保留但不调用**（godrays 接管后 4 层 sprite 显得球层分界明显，且 baseScale 2.8×SUN_R ≈ 33.6u ≈ 水星轨道，会包住水星）
- `setGlowEnabled(v)`：UI 仍调用它，但仅作为全局标志；目前无 sprite 需要它控制

### `src/planets.js` — 太阳/行星/月球工厂
- `makeTextSprite(text, color)` — Canvas 渲染文字标签 → Sprite
- `addLabel(parent, text, yOffset)` — 挂标签
- `makeOrbit(distance)` — 256 段 LineLoop 轨道环
- `sunGlowSprites = []`（export）— **保留 export 但不再 push**（空数组，ui.js 的 forEach 跑空循环不报错）
- `makeSun(scene)`：
  - `safeTexture('./src/textures/sun.jpg')`
  - SphereGeometry(1.0, 64, 64) + `MeshBasicMaterial({color: 0xfff5d8, toneMapped: false})`（暖白 G2V 真实颜色）
  - ~~4 层 sprite 辉光（halo/corona/glow/aura）~~ — **已注释掉**
  - **sun label 单独 add 到 scene，不放进 sun mesh 子节点树**（重要：避免 godrays 把 label 也当光辐射）
- `makePlanet(scene, p)`：realSize 几何（地球=1.0 基准），MeshStandardMaterial，土星/天王星环（RingGeometry + 贴图 UV 重映射），地球云层（独立 sphere + 顶点 displacement + 反向旋转）
- `makeMoon()` — 月球 mesh + pivot，挂在地球上

### `src/ui.js` — UI
- `initSliders(sunLight)` — 速度滑条 + 亮度滑条（直接 sunLight.intensity）
- `initToggles(scene, camera, controls)` — orbits/labels/bloom/earth-clouds toggle
  - **SUN GLOW toggle（关键 fix）**：
    ```js
    toggleBloom.addEventListener('change', () => {
      const enabled = toggleBloom.checked;
      const pass = window.__bloomPass;
      if (pass) pass.strength = enabled ? BLOOM_ON : BLOOM_OFF;
      setGlowEnabled(enabled);
      sunGlowSprites.forEach(s => { s.visible = enabled; });
      // 新增：联动 GodRaysEffect pass（控制 screen-space 光线辐射）
      if (window.__setGodRaysEnabled) window.__setGodRaysEnabled(enabled);
    });
    ```
- `bindStarsToggle(stars)` — 星空显示 + 密度滑条
- `initInfoPanel()` — 点击星球显示 info（中文/EN facts）
- `initLegend()` — 右下角图例
- `initTracking(...)` — 点击追踪某星球
- `initTrackingStopButton()` — 退出追踪
- `initSceneClick(renderer, camera, getter)` — raycaster 点击
- `initFloatingTools()` — GitHub + 背景音乐按钮
- `initCollapse()` — 折叠面板

### `src/constants.js` — NASA 天文数据
- `AU = 1`，`DIST_SCALE = 160`，`SUN_R = 12.0`
- `PLANETS[]` — 8 行星（每颗含 distance/realSize/diameterKm/orbit/rotation/tilt/texture/factsZh/factsEn/factZh/factEn）
- `MOON`, `SUN_FACTS`

### `src/scale.js` — 缩放工具
- `getPlanetDisplayRadius(p)` = p.realSize
- `getSunDisplayRadius()` = SUN_R
- `getDisplayDistance(p)` = AU × DIST_SCALE
- `scaleScene()` — 遍历所有行星/轨道/标签应用缩放

### `src/textures.js` — 贴图加载（222 行）
- `safeTexture(url, label, onTick)` — 加载 + 错误降级 + 进度回调

### `src/i18n.js` / `src/tracking.v2.js` / `src/loader.js` / `src/ambient.js`
- 标准 i18n 字典 / 追踪系统（pinch 修复版）/ 加载层 / 背景音乐

---

## 4. 关键不变量（事实）

- **基线 commit**：`待提交 — GodRaysEffect 辉光方案`（工作树内容即新基线）
- **太阳辉光当前方案**：`GodRaysEffect`（pmndrs 6.36.4，screen-space raymarched）
- **后处理顺序**：RenderPass → GodRaysEffect → BloomEffect（pmndrs EffectComposer 接管）
- **太阳材质**：`MeshBasicMaterial({color: 0xfff5d8, toneMapped: false})`
- **8 个 viewport 距离**（基于 DIST_SCALE=160）：水星 d=31.2 / 海王星 d=2404
- **Cloudflare Pages 缓存**：HTML no-cache / JS+CSS 1 年 immutable（`_headers`）

---

## 5. 历史关键 commit

| Commit | 改动 |
|---|---|
| `46fd802` | **上一个基线**（辉光实验前的稳定版本） |
| `d297e13` → `d6043f2` | 6 次辉光失败实验（starburst / lens flare / FakeGlow / EdgeGlow）— 全部失败回滚 |
| `8c841a4` | 回滚 commit（lighting/planets/scene/ui → 46fd802 + 删除 EdgeGlow/FakeGlow）|
| `cc2564b` | 新增 PROJECT_INDEX.md（后被重命名为 PROJECT.md）|
| `3bf5415` | 新增 AGENTS.md |
| **`待提交`** | **新基线**：GodRaysEffect 方案 + 删除太阳赤道环 + 删除 4 层 sprite |

**教训**：sprite / 程序化 / fake glow / edge glow 4 种方向全部失败 → 改走 GodRaysEffect（pmndrs 社区标准方案）一次成功。

---

## 6. 待办 / 后续方向

- Cloudflare Pages 部署：直接 `git push` 触发自动构建（无需任何 build step）
- 如果 godrays 在某些视角（特别是从行星表面看太阳时）出现视觉异常，再调 `density` / `decay` / `samples`

---

## 7. 跨会话使用方式

如果在新会话里读到这个文件：

1. **确认 git 状态**：`git log --oneline -3` 应看到最新 commit 是 godrays 方案
2. **不需要再读所有源码** — 直接基于第 3 节的功能摘要判断要怎么改
3. **要改某个文件的具体细节**时，再用 read_file 读那一个文件
4. **新 commit 后**：更新第 5 节的 commit 列表和第 4 节的"基线 commit"

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