# PROJECT_INDEX — 太阳系 3D 探索器

> **给 AI 助手读的项目索引** —— 跨会话续接时，先读这个文件就能掌握当前开发现状，不用重新探索。
>
> **最后更新**：2026-07-05
> **基线 commit**：`8c841a4`（46fd802 + 回滚 + 删除废弃文件）

---

## 0. 一句话总览

**纯前端 Three.js 太阳系 3D 模拟器**，8 大行星 + 月球真实比例轨道，**零构建**（无 package.json / 无 node_modules），用 `<script type="importmap">` + unpkg CDN 引入依赖，部署在 **Cloudflare Pages**（`https://solarsystem.upstream.eu.cc/`）。

---

## 1. 技术栈

| 类别 | 选型 | 备注 |
|---|---|---|
| 渲染 | **Three.js r160** | unpkg CDN：`https://unpkg.com/three@0.160.0/build/three.module.js` |
| 后处理 | Three.js 内置（EffectComposer + RenderPass + UnrealBloomPass + OutputPass） | scene.js |
| 控件 | OrbitControls | camera 拖拽/缩放/旋转 |
| 依赖管理 | importmap + unpkg CDN | **零 npm install**，直接部署到 Cloudflare Pages |
| 构建 | **无** | index.html + src/*.js 直接上传 |
| i18n | 自写 dict（zh-CN / en）| i18n.js |
| 音频 | CC0 mp3 ambient 音乐 | src/audio/ambient.mp3（2.1 MB）|

**后续如果要引入 postprocessing 库**：在 importmap 加一行 `"postprocessing": "https://unpkg.com/postprocessing@6.36.4/build/index.js"`（注意 `postprocessing@6.36.x` peer dep `three >= 0.157.0 < 0.171.0`，**与本项目 three 0.160 兼容**；最新 6.39.x 要求 three ≥ 0.168，**不兼容**）。

---

## 2. 文件结构

```
solar-system/
├── index.html               # 入口 HTML + importmap + 全部 SEO meta + 错误处理
├── _headers                 # Cloudflare Pages 缓存配置（HTML no-cache, JS/CSS immutable 1y）
├── robots.txt               # SEO
├── sitemap.xml              # SEO
├── README.md / README.zh-CN.md / README.en.md   # 用户文档
│
├── src/
│   ├── main.js              # 入口 — async init() 串联所有模块
│   ├── scene.js             # scene + camera + renderer + OrbitControls + 星空 + 后处理 pipeline
│   ├── lighting.js          # 光照 + 太阳辉光（v46fd802：4 层 sprite 方案）
│   ├── planets.js           # makeSun / makePlanet / makeMoon / makeOrbit / sunGlowSprites export
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
│       └── lensflare0.png ~ lensflare3.png            # Three.js 官方 Lensflare 贴图（项目保留但**未使用**）
│
└── .git/                    # git 仓库，远程 origin/main
```

---

## 3. 核心文件功能摘要

### `index.html`
- **唯一**的 HTML 文件
- 完整 SEO meta（Open Graph / Bing / Google / Baidu 验证）
- `<script type="importmap">` 定义 three + three/addons 的 CDN 映射
- 全局 `error` 和 `unhandledrejection` 监听器 → 错误弹窗显示在屏幕中央
- 入口 `<script type="module" src="./src/main.js">`
- 包含折叠面板 UI（CONTROLS / DASHBOARD / BODIES），含 GitHub 链接按钮（ref `e1`）和背景音乐按钮（ref `e2`）

### `src/main.js` — 入口（178 行）
- `Loader.show()` 立即显示加载层（在 import 完成前）
- `async init()`：
  1. `initScene()` → scene/camera/renderer/controls/stars/composer/bloomPass
  2. `initLighting()` → sunLight（PointLight，decay=0 模拟平行光）+ ambient
  3. `makeSun(scene)` → 太阳本体 + 辉光 group + label
  4. 循环 `makePlanet(scene, p)` → 8 大行星
  5. `makeMoon()` → 月球，挂到地球 pivot
  6. `makeOrbit(SUN_R * 1.05)` → 太阳"轨道"环（视觉提示中心）
  7. `scaleScene()` → 应用 DIST_SCALE 缩放
  8. `initI18n()` → 必须在 UI 之前
  9. UI 初始化（sliders / toggles / info / tracking / collapse）
  10. 点击交互（rebuildClickableList）
  11. 图例、浮动工具按钮
  12. resize 监听
  13. **主循环** `tick()`：
      - `deltaReal`（相机动画、星空旋转）/ `deltaSim`（受 speedFactor 影响）
      - 行星公转 + 自转 + 地球云层反向旋转
      - 月球轨道
      - 太阳自转
      - 星空 uTime + 位置跟随相机
      - **`sun.userData.glowUpdate(camDist, sun)`** — 每帧调，按距离调辉光
      - `composer.render()`（后处理 pipeline）

### `src/scene.js` — 场景/相机/星空/后处理（204 行）
- 程序化生成圆形柔边贴图（星星用 64×64，sun glow 用 256×256）
- `makeStars(count, radius, sizeRange)` — 用 ShaderMaterial 实现"闪烁"（sin 调制 + per-star speed/phase）
- `_starsGroup` — 每帧 `updateStarPositions(camera)` 把星空 group 移到相机位置（让相机在海王星也能看到星星）
- `regenerateStars(scene, densityPercent)` — 销毁旧 stars + 重建（密度滑条触发）
- `initScene()`：
  - 相机 PerspectiveCamera FOV=55，near=0.1，far=5000
  - WebGLRenderer，ACES tone mapping，**exposure=1.3**
  - OrbitControls min/max distance = 0.5 / 8000
  - 8000 颗星（默认）
  - **后处理 pipeline**：`RenderPass → UnrealBloomPass(0.4, 0.4, 0.92) → OutputPass`
  - bloom 强度 0.4 = 仅做中心微提亮（不是"光晕主体"）

### `src/lighting.js` — 光照 + 太阳辉光（181 行，46fd802 状态）
- **太阳辉光方案（4 层 sprite，distance-driven）**：
  - 用程序化白色径向渐变贴图（`getWhiteGlowTex()` 256×256）
  - `LAYERS` 数组配置 4 层：`halo / corona / glow / core`
  - 每层独立 baseScale、baseOpacity、color、range
  - `makeSunGlow(sunR)` 异步函数（v4 后改 async）→ 返回 `{ group, sprites, update }`
  - **每帧 `update(camDist, sunMesh)`**：
    - 按距离 smoothstep 插值每层 opacity + scale
    - 太阳本体按距离淡出（200→1500 区间 opacity 1→0.5）
    - toggle 控制 `_glowEnabled` 全局标志
- 光照：`AmbientLight(0x8090b0, 0.45)` + `PointLight(0xffffff, 3.5, 0, 0)`（decay=0 = 平行光）

### `src/planets.js` — 太阳/行星/月球工厂（203 行）
- `makeTextSprite(text, color)` — Canvas 渲染文字标签 → Sprite
- `addLabel(parent, text, yOffset)` — 挂标签
- `makeOrbit(distance)` — 256 段 LineLoop 轨道环
- **`sunGlowSprites = []`（export）** — 收集辉光 sprite 引用给 ui.js toggle 用
- `makeSun(scene)`：
  - `safeTexture('./src/textures/sun.jpg')`
  - `SphereGeometry(1.0, 64, 64)` + `MeshBasicMaterial({color: 0xfff5d8, toneMapped: false})`
  - 标 userData：isSun/name/en/size/typeZh/typeEn + factsZh/factsEn + factZh/factEn
  - **`const glow = await makeSunGlow(SUN_R)` → mesh.add(glow.group)**
  - 加"☀ 太阳"标签
- `makePlanet(scene, p)`：
  - `realSize` 几何（地球=1.0 基准）
  - MeshStandardMaterial（roughness 0.85, metalness 0.05, emissive 微亮）
  - pivot/tilt 倾斜容器
  - 土星/天王星环（RingGeometry + 贴图 UV 重映射）
  - 地球云层（独立 sphere + 顶点 displacement + 反向旋转）
  - 标签
- `makeMoon()` — 月球 mesh + pivot，挂在地球上

### `src/constants.js` — NASA 天文数据（175 行）
- `AU = 1`，`DIST_SCALE = 160`，`SUN_R = 12.0`
- `PLANETS[]` — 8 行星（含水/金/地/火/木/土/天/海王星）每颗含：
  - `distance` AU, `realSize`（地球=1基准）, `diameterKm`
  - `orbit` 地球日, `rotation` 地球日, `tilt` 度
  - `texture` 路径
  - `factsZh/factsEn`（NASA fact sheet）+ `factZh/factEn`（HTML 富文本介绍）
- `MOON`, `SUN_FACTS`

### `src/scale.js` — 缩放工具（84 行）
- `getPlanetDisplayRadius(p)` = p.realSize
- `getSunDisplayRadius()` = SUN_R
- `getDisplayDistance(p)` = AU × DIST_SCALE
- `scaleScene()` — 遍历所有行星/轨道/标签应用缩放

### `src/textures.js` — 贴图加载（222 行）
- `safeTexture(url, label, onTick)` — 加载 + 错误降级 + 进度回调

### `src/ui.js` — 全部 UI（303 行）
- `initSliders(sunLight)` — 速度滑条 + 亮度滑条（直接 `sunLight.intensity`）
- `initToggles(scene, camera, controls)` — orbits/labels/bloom toggle
  - BLOOM_ON = 0.4, BLOOM_OFF = 0.0
- `bindStarsToggle(stars)` — 星空显示 + 密度滑条（调 `regenerateStars`）
- `initInfoPanel()` — 点击星球显示 info（中文/EN facts）
- `initLegend()` — 右下角图例
- `initTracking(...)` — 点击追踪某星球（调用 tracking.v2）
- `initTrackingStopButton()` — 退出追踪
- `initSceneClick(renderer, camera, getter)` — raycaster 点击
- `initFloatingTools()` — GitHub + 背景音乐按钮
- `initCollapse()` — 折叠面板（操作提示/仪表盘/星球图例）

### `src/i18n.js` — 双语字典
- `bi(key)` — 按 `localStorage.lang` 或 `navigator.language` 返回 zh/en
- `setLang(lang)` — 切换语言
- `initI18n()` — 启动时初始化

### `src/tracking.v2.js` — 相机追踪系统
- `startTracking(target)` — 平滑移动相机到目标星球
- `tickCameraAnim(deltaReal)` — 主循环调用
- `tickTracking()` — 检查追踪状态

### `src/loader.js` — 启动 loader overlay
- `show()` / `hide()` + `tick(label)` 进度回调

### `src/ambient.js` — 背景音乐
- `<audio>` 标签 + 控制按钮

---

## 4. 关键不变量（事实）

- **基线 commit `8c841a4`** — lighting/planets/scene/ui 都在 46fd802 状态 + 已删除 EdgeGlow/FakeGlow
- **太阳辉光当前方案**：4 层 sprite + 程序化白色径向渐变贴图 + distance-driven smoothstep
- **后处理**：UnrealBloomPass strength=0.4（仅中心提亮，不是光晕主体）
- **太阳材质**：`MeshBasicMaterial({color: 0xfff5d8, toneMapped: false})`
- **8 个 viewport 距离**（参考 scale.js 注释）：水星 d=31.2 / 海王星 d=2404（基于 DIST_SCALE=160）
- **Cloudflare Pages 缓存**：HTML no-cache / JS+CSS 1 年 immutable（`_headers`）

---

## 5. 历史关键 commit

| Commit | 改动 |
|---|---|
| `46fd802` | **本项目基线**（会话开始前） |
| `8c841a4` | **当前 HEAD**：回滚 + 删除 EdgeGlow/FakeGlow |
| `d297e13` | 引入 6 道 starburst（已废弃） |
| `3f8f871` | 程序化细长星芒 + 横向 flare（已废弃） |
| `c74dae4` | 用 lensflare0_alpha 贴图（已废弃） |
| `1d67ec6` | 直接用 lensflare 原图（用户反映"原图没有明显分界"） |
| `30189ae` | 切外圈 50%（用户反映"分界太明显"） |
| `8022902` | 只保留 lens flare 中心（用户反映"还是有环"） |
| `fe89c67` | 引入 FakeGlowMaterial（已废弃） |
| `d6043f2` | fork 出 EdgeGlowMaterial（用户反映"完全不对"） |

**教训**：用户对"过曝太阳辉光"要求很高，sprite / 程序化 / fake glow 都被否。**PM/postprocessing GodRaysEffect** 是社区标准方案，**尚未尝试**。

---

## 6. 待办 / 后续方向

- **太阳辉光重做**（PM 任务）：调研 `pmndrs/postprocessing` 的 `GodRaysEffect` —— 这是 2.8k stars 的社区方案，screen-space raymarched god rays，能从 sun mesh 出发向四周辐射光线，没有 sprite bounding box 边界问题
- Cloudflare Pages 部署：直接 `git push` 触发自动构建（无需任何 build step）

---

## 7. 跨会话使用方式

如果在新会话里读到这个文件：

1. **确认 git 状态**：`git log --oneline -3` 应看到 `8c841a4` 是 HEAD
2. **不需要再读所有源码**——直接基于第 3 节的功能摘要判断要怎么改
3. **要改某个文件的具体细节**时，再用 read_file 读那一个文件
4. **新 commit 后**：更新第 5 节的 commit 列表和第 4 节的"基线 commit"

---

## 8. 关键 importmap（防止被改坏）

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
```

**不要随意升级 three 版本** —— 项目里用了多个 r160 后引入的 API（ACES tone mapping、MeshBasicMaterial 的 toneMapped 选项等）。如果要升级，先跑一遍测试。