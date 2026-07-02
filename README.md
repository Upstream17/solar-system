# 🌌 太阳系 3D 探索器

<a href="README.en.md"><img src="https://img.shields.io/badge/Lang-English-blue?style=for-the-badge" alt="English"></a>
<a href="README.zh-CN.md"><img src="https://img.shields.io/badge/Lang-中文-red?style=for-the-badge" alt="中文"></a>
<a href="https://solarsystem.upstream.eu.cc"><img src="https://img.shields.io/badge/🌐_在线访问-solarsystem.upstream.eu.cc-FF6B35?style=for-the-badge" alt="在线访问"></a>

基于 **Three.js 0.160** 的太阳系 3D 探索器，纯前端单页应用，无构建步骤，部署到 Cloudflare Pages 即可访问。


## ✨ 主要特性

- **8 大行星 + 月球** — 真实 NASA 半径比、AU 距离比、自转/公转周期
- **真实纹理** — 本地化行星贴图（避免 CDN 失效），开普勒轨道
- **太阳辉光** — 4 层 additive sprite，按相机距离分级显示
  - 近处：紧贴太阳的暖白核心
  - 中距离：暖黄外缘
  - 远观：完整大气散射
- **太阳本体** — 温和暖白色（G2V 真实恒星色温）
- **星空闪烁** — ShaderMaterial 自定义 vertex shader，每颗星独立 sin 调制
- **星空跟随相机** — 移动到海王星时背向太阳方向也能看到星星
- **轨道追踪** — 点击行星或图例 → 相机飞过去 + 自定义球坐标控制
- **时间流速** — 暂停 / 1× / 100× 多档
- **真实比例 toggle** — 演示模式 / 真实比例模式切换
- **地球云层** — 独立 sphere 叠加（带 noise displacement 避免塑料贴图感）

## 🚀 本地运行

无构建步骤，直接用 Python 静态服务器即可：

```bash
python -m http.server 8765
# 打开 http://localhost:8765
```

> ⚠️ **必须用 HTTP 协议，不能双击 `index.html`**：现代浏览器禁止从 `file://` 加载 ES module，会得到黑屏。详见 [CORS 章节](#关于-file-协议黑屏)。

## ☁️ 部署到 Cloudflare Pages

**方法 1 — 拖拽上传（最简单）**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages
2. 点击 "Create a project" → "Direct Upload"
3. 把整个项目目录拖进去（**包含 `index.html` 和 `src/`**）
4. Cloudflare 自动分配 `*.pages.dev` 域名
5. 完成，无需任何配置

**方法 2 — GitHub 集成（自动部署）**

1. 把代码推到 GitHub（参考下方 git 步骤）
2. Cloudflare Pages → "Connect to Git" → 选你的 repo
3. Build settings 留空（**无构建步骤**），Output dir = `/`
4. 每次 push 自动部署

**关于 Worker 部署**：你提到 "运行在 Cloudflare 的 worker 中" — 但 Pages 比 Workers 更适合静态站点。Workers 需要 JS 入口 + 路由逻辑来 serve 静态文件。如果你确实要用 Workers，可以加一个 `src/index.js` 用 [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) 模式。

## 📁 文件结构

```
solar-system/
├── index.html              # HTML + CSS + importmap
├── src/
│   ├── main.js             # 入口 + 主循环
│   ├── scene.js            # Three.js 场景 + OrbitControls + Bloom + 星空
│   ├── lighting.js         # 太阳光照 + 4 层辉光 sprite
│   ├── planets.js          # 太阳/行星/月球创建
│   ├── tracking.js         # 追踪系统（自定义球坐标相机）
│   ├── ui.js               # UI 控件 + 交互
│   ├── scale.js            # 真实比例缩放
│   ├── constants.js        # 天文数据表
│   ├── textures.js         # 纹理加载（含程序化 fallback）
│   └── textures/           # 本地化的行星/卫星/光晕贴图
└── README.md
```

## 🎮 操作

| 操作 | 行为 |
|---|---|
| 拖拽 | 旋转视角 |
| 滚轮 | 缩放 |
| 右键拖拽 | 平移 |
| 点击星球 | 进入追踪模式 |
| 点击图例 | 进入追踪模式（同一目标再次点击重新飞过去） |
| ESC / 停止按钮 | 退出追踪 |
| 时间流速滑块 | 0（暂停）~ 100× |
| 太阳亮度滑块 | PointLight intensity |
| 太阳辉光 checkbox | 切换 4 层 sprite + bloom |

## 🎨 设计理念

**距离按 AU 真实 · 体积艺术夸张** — 真实太阳是地球的 109×，如果按真实比例做，所有行星都会变成看不见的尘埃。本项目采用 NASA-Standard 妥协：距离按 AU 真实比例，体积相对真实但太阳明显大于行星。UI 右下角明确标注此约定。

**G2V 真实色温** — 太阳本体用 `#fff5d8`（暖白），不是纯白也不是橙黄。NASA SDO 影像同款色温。

**辉光分级** — 4 层 sprite（glow / corona / halo / aura）按相机距离 smoothstep 切换，单层 opacity 0.10-0.20 靠 additive 叠加成"恒星大气感"。

## ⚠️ 关于 `file://` 协议黑屏

如果你双击 `index.html` 看到黑屏，**这是正常的**。现代浏览器禁止从 `file://` 加载 ES module（出于安全考虑）。解决方案：

- 本地：用 `python -m http.server 8765` 或任何静态服务器
- 部署：用 Cloudflare Pages（自动 HTTPS）

## 🛠️ 技术栈

- **Three.js 0.160.0** + OrbitControls + EffectComposer + UnrealBloomPass
- **原生 ES Modules**（无 webpack / vite / 任何打包器）
- **WebGL 2**（需要支持 WebGL 2 的现代浏览器）
- **importmap** 加载 three.js（CDN: unpkg）

## 📜 Credits

- **Three.js** — [mrdoob/three.js](https://github.com/mrdoob/three.js) (MIT)
- **行星纹理** — Solar System Scope ([solarsystemscope.com](https://www.solarsystemscope.com/textures/)) (CC BY 4.0)
- **天文数据** — NASA Planetary Fact Sheet

## 📄 License

MIT
