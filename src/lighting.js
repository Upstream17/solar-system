/* lighting.js — 光照 + 太阳辉光（v3 重写 — 镜头炫光 starburst）
 *
 * 设计核心（参考原神 tu2 截图）：
 *   1. 镜头光晕的核心特征：超长 + 超细的星芒 + 横向 flare streak + 中心白点
 *   2. 之前 v2 错误：6 道"等长等粗"对称光线 → 像雪花不像镜头
 *   3. 这次 v3 改动：
 *      - 6 道 starburst 但极细极长（sharpness=40, lengthFactor=2.5）
 *      - 单独一层 horizontal flare streak（横向镜头炫光，10×1 比例）
 *      - 中心改为"亮点"（disk 缩到 0.4× sunR），不再是大圆盘
 *      - 暖白但接近纯白（#fff8e8 / #fffaf0），不偏黄
 *
 * 4 层配置（全部仍按距离分级 + 平滑过渡）：
 *   - core (disk, scale 0.40): 中心亮白点（不是大圆）
 *   - rays (6-spike, scale 4.0): 6 道极细极长星芒
 *   - flare (disk 极端扁, scale 8.0×0.6): 横向镜头炫光
 *   - halo (disk, scale 2.0): 外圈柔光弥散
 *
 * 调试基准（基于"水星 62u / 默认视角 ~100u / 海王星 4808u"）：
 *   - core: 0-80u 都可见（远距离收缩为亮点）
 *   - rays: 30-300u（中等距离星芒最强）
 *   - flare: 30-250u（横向 streak，中等距离主导）
 *   - halo: 150-800u（远观散射）
 */

import * as THREE from 'three';

/* ========== 贴图生成 ========== */

/* 圆盘贴图 — 中心亮白、外圈柔和衰减
 * v3: 衰减指数从 1.2 → 2.0，让中心更集中、外圈更柔
 */
let _diskTex = null;
function getDiskTex() {
  if (_diskTex) return _diskTex;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0.00, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.15, 'rgba(255,255,255,0.70)');
  grad.addColorStop(0.40, 'rgba(255,255,255,0.20)');
  grad.addColorStop(0.70, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1.00, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _diskTex = new THREE.CanvasTexture(c);
  _diskTex.colorSpace = THREE.SRGBColorSpace;
  return _diskTex;
}

/* 6 道星芒贴图 — 极细极长
 * v3: sharpness 从 12 → 50（光线极细）
 *      lengthFactor 1.0 → 2.5（光线延伸到 2.5× 半径）
 *      disk 比例 0.50 → 0.30（中心圆盘更小，让星芒主导）
 *      距离衰减指数 0.8 → 0.5（光线可以延伸到很远）
 */
function makeStarburstTex6() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const cx = size / 2, cy = size / 2;
  const lengthFactor = 2.5;  // 光线延伸到 2.5× 半径

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxR = cx * lengthFactor;

      let alpha = 0;
      if (dist <= maxR) {
        const distNorm = dist / (cx * lengthFactor);  // 0..1

        // 圆盘（柔光核）— 占比小，让星芒主导
        const distNormDisk = dist / cx;
        const diskA = distNormDisk < 1.0
          ? Math.pow(Math.max(0, 1.0 - distNormDisk), 2.5) * 0.5
          : 0;

        // 放射光线 — 6 道、极细（sharpness=80）
        let spikeA = 0;
        if (dist > 1) {
          const angle = Math.atan2(dy, dx);
          const spikeRaw = Math.abs(Math.cos(angle * 3));
          // sharpness=80 让光线更细
          spikeA = Math.pow(spikeRaw, 80) * Math.pow(Math.max(0, 1.0 - distNorm), 0.5);
        }

        alpha = Math.min(1.0, diskA + spikeA * 1.2);
      }

      const idx = (y * size + x) * 4;
      data[idx]     = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let _raysTex6 = null;
function getRaysTex6() {
  if (!_raysTex6) _raysTex6 = makeStarburstTex6();
  return _raysTex6;
}

/* 横向 flare streak 贴图 — 模拟镜头炫光的水平光线
 * v3 新增：原神截图里最显眼的横向光线就是这个
 * 算法：
 *   - canvas 1:8 宽高比（512×64），光线水平延伸
 *   - 中心高斯亮点（横向宽度大，垂直极薄）
 *   - 中心处最亮，向左右两端衰减
 *   - 上下边缘快速衰减（让光线条"细"）
 */
function makeFlareTex() {
  const w = 512, h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  const cx = w / 2, cy = h / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / cx;   // -1..1
      const dy = (y - cy) / cy;   // -1..1

      // 中心高斯亮点：横向按 e^(-5dx²) 衰减，垂直按 e^(-50dy²) 衰减
      // 这样得到一个"超扁、超长"的水平光线
      const hFactor = Math.exp(-5 * dx * dx);   // 横向宽
      const vFactor = Math.exp(-50 * dy * dy);  // 垂直极薄

      const alpha = hFactor * vFactor;

      const idx = (y * w + x) * 4;
      data[idx]     = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let _flareTex = null;
function getFlareTex() {
  if (!_flareTex) _flareTex = makeFlareTex();
  return _flareTex;
}

/* ========== 配置 ========== */

/* 4 层 sprite 配置 — v3 重写
 *
 * 颜色全部统一暖白（用户要求"参考原神但只要暖白"）：
 *   - core:   #fffaf0 (近纯白，中心高光)
 *   - rays:   #fff8e8 (暖白，星芒)
 *   - flare:  #fff5e0 (暖白，横向炫光)
 *   - halo:   #ffe8c0 (浅暖，外圈弥散)
 *
 * scale 含义（基于 sunR）：
 *   - core 0.40: 中心亮点（小于 sun 直径，远看就一个白点）
 *   - rays 4.0:  6 道极细星芒延伸 4× sunR（远超 sun 本体）
 *   - flare 8.0×0.6: 横向炫光 8× sunR 长 × 0.6× sunR 厚
 *   - halo 2.0:  外圈柔光
 */
const LAYERS = [
  // 第一层：中心亮白点（disk 收缩到 0.4×）— 远看就是一个小亮点，不是大圆
  { name: 'core',  baseScale: 0.40, baseOpacity: 0.85, color: 0xfffaf0, tex: 'disk',  range: [0,    80],
    customScale: [0.40, 0.40] },  // [x, y] 因为 sprite scale.set(scalar) 不够灵活
  // 第二层：6 道极细极长星芒（starburst6）— 中距离最强
  { name: 'rays',  baseScale: 4.0,  baseOpacity: 0.45, color: 0xfff8e8, tex: 'rays6', range: [30,  300] },
  // 第三层：横向镜头炫光（flare streak）— 原神图最显眼的那道水平线
  // opacity 0.30 → 0.18（横向 streak 太强会盖住行星轨道）
  { name: 'flare', baseScale: 8.0,  baseOpacity: 0.18, color: 0xfff5e0, tex: 'flare', range: [30,  250],
    customScale: [8.0, 0.6] },
  // 第四层：远观散射（disk）— 海王星视角下主导
  { name: 'halo',  baseScale: 2.0,  baseOpacity: 0.10, color: 0xffe8c0, tex: 'disk',  range: [150, 800] },
];

/* ========== 全局开关 ========== */

let _glowEnabled = true;
export function setGlowEnabled(v) { _glowEnabled = !!v; }

/* ========== 太阳辉光创建 ========== */

export function makeSunGlow(sunR) {
  const sprites = [];

  for (const cfg of LAYERS) {
    let tex;
    switch (cfg.tex) {
      case 'rays6': tex = getRaysTex6(); break;
      case 'flare': tex = getFlareTex(); break;
      case 'disk':
      default:      tex = getDiskTex();  break;
    }

    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: cfg.color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      sizeAttenuation: true,
      opacity: 0,
      toneMapped: false
    });
    const sp = new THREE.Sprite(mat);

    // scale 处理：customScale 用 x/y 分别设置（flare 这种扁的、core 这种小的）
    if (cfg.customScale) {
      sp.scale.set(sunR * cfg.customScale[0], sunR * cfg.customScale[1], 1);
    } else {
      sp.scale.setScalar(sunR * cfg.baseScale);
    }

    sp.userData = { cfg, baseScale: sunR * cfg.baseScale,
                    baseCustomScale: cfg.customScale ? [sunR * cfg.customScale[0], sunR * cfg.customScale[1]] : null };
    sprites.push(sp);
  }

  const group = new THREE.Group();
  // 从外到内加入（外层先渲染，内层后渲染叠加在太阳上）
  for (let i = sprites.length - 1; i >= 0; i--) group.add(sprites[i]);

  function update(cameraDistance, sunMesh) {
    if (!_glowEnabled) {
      for (const sp of sprites) {
        sp.visible = false;
      }
      if (sunMesh) {
        sunMesh.material.opacity = 1.0;
        sunMesh.material.transparent = false;
        sunMesh.material.needsUpdate = true;
      }
      return;
    }

    for (const sp of sprites) {
      const cfg = sp.userData.cfg;
      const [start, end] = cfg.range;
      const t = THREE.MathUtils.smoothstep(cameraDistance, start, end);
      sp.material.opacity = cfg.baseOpacity * t;

      // 距离缩放：远处稍放大（rays 和 flare 在远距离需要更突出）
      const scaleFactor = 1.0 + Math.min(0.3, Math.max(0, (cameraDistance - 100) / 1500) * 0.3);

      if (cfg.customScale) {
        sp.scale.set(
          sp.userData.baseCustomScale[0] * scaleFactor,
          sp.userData.baseCustomScale[1] * scaleFactor,
          1
        );
      } else {
        sp.scale.setScalar(sp.userData.baseScale * scaleFactor);
      }

      sp.visible = t > 0.001;
    }

    // 太阳本体按距离淡出
    if (sunMesh) {
      const t = THREE.MathUtils.smoothstep(cameraDistance, 200, 1500);
      sunMesh.material.opacity = 1.0 - 0.5 * t;
      sunMesh.material.transparent = t > 0.001;
    }
  }

  return { group, sprites, update };
}

/* ========== 直射光 + 环境光 ========== */

export function initLighting(scene) {
  const ambient = new THREE.AmbientLight(0x8090b0, 0.45);
  scene.add(ambient);

  // 暖白 G2V 阳光（5500K 略偏暖），不再偏冷
  const sunLight = new THREE.PointLight(0xfff5e0, 3.5, 0, 0);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  return { sunLight, ambient };
}