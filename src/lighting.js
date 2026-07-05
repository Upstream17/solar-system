/* lighting.js — 光照 + 太阳辉光（v4 — 使用真实 lens flare 贴图）
 *
 * 设计核心（放弃程序化贴图，v3 假死）：
 *   1. 直接使用项目里已经准备好的 lensflare0_alpha.png（512×512 暖橙镜头炫光）
 *      — 真实摄影的镜头炫光：中心亮点 + 12 道极细光线 + 暖色弥散圆盘
 *      — 比任何程序化 starburst 都更真实
 *   2. 通过 SpriteMaterial.color 把橙色冲成暖白（用户要求"只要暖白"）
 *   3. 保留 4 层结构但简化为 2 种用途：
 *      - flare 贴图层（lensflare0_alpha）：中近距离主导
 *      - disk 圆盘（保留程序化，作为最外弥散层）
 *   4. 距离分级 + 平滑过渡 / sun 本体淡出 / toggle 全部保留
 */

import * as THREE from 'three';

/* ========== 贴图加载 ========== */

/* Lens flare 贴图（直接用项目里已经准备好的镜头炫光贴图）
 * lensflare0_alpha.png 原始结构：
 *   - 中心亮白点（占中央约 5-10% 区域）
 *   - 暖橙红色圆球形柔光（覆盖几乎整张图，外圈渐变到透明）
 *   - 一条斜 45° 对角线穿过中心（横穿整个画面的 flare streak）
 *   - 整体颜色暖橙
 *
 * v5 处理：完全放弃 Canvas 处理
 *   - 直接用原始贴图，保留暖橙色（用户最终接受了这个色调，因为"原始贴图并没有明显环形分界"）
 *   - 之前 v4.2 错误：用 distNorm > 0.5 硬切外圈，制造了"分界线"假象
 *   - 正确做法：让 sprite 显示得比贴图"外圈柔光"更大，让外圈自然 fade 进黑色背景
 *   - sprite scale 调到 4.0+ × sunR，让贴图外圈柔和延伸到世界背景里
 */
let _flareTex = null;
async function loadFlareTex() {
  if (_flareTex) return _flareTex;
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      './src/textures/lensflare0_alpha.png',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        _flareTex = tex;
        resolve(tex);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/* 程序化圆盘贴图（保留作为最外层弥散）
 * 256×256 径向渐变，柔光外圈
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

/* ========== 配置 ========== */

/* 简化的 3 层配置（v4）：
 *   - flare: lensflare0_alpha 镜头炫光贴图（主层，近距离/中距离显示）
 *   - flare_far: 同贴图但更大、更淡（远距离显示）
 *   - halo: 程序化圆盘（远观弥散）
 *
 * 颜色全部暖白（用 SpriteMaterial.color 把 lensflare0 的暖橙冲成暖白）
 */
const LAYERS = [
  // 唯一一层：lens flare 贴图（512×512 原始贴图，不再做任何处理）
  // 包含：中心亮白点 + 暖橙圆球柔光 + 斜 45° flare streak
  // baseScale 4.0：让 sprite 显示范围比贴图内容更大，让外圈柔光自然 fade 进黑色背景
  //   — 不再硬切外圈（之前硬切制造了"分界线"假象）
  //   — 贴图本身的柔光是平滑的，sprite 大一点就看不到边界
  // color 0xffffff：保持原始暖橙色调（用户反馈"原图并没有明显环形分界"，原色是对的）
  { name: 'flare',     baseScale: 4.0, baseOpacity: 0.75, color: 0xffffff, tex: 'flare', range: [0,   800] },
];

/* ========== 全局开关 ========== */

let _glowEnabled = true;
export function setGlowEnabled(v) { _glowEnabled = !!v; }

/* ========== 太阳辉光创建 ========== */

export async function makeSunGlow(sunR) {
  // 预先加载 lens flare 贴图（异步）
  const flareTex = await loadFlareTex();

  const sprites = [];

  for (const cfg of LAYERS) {
    let tex;
    switch (cfg.tex) {
      case 'flare': tex = flareTex; break;
      case 'disk':
      default:      tex = getDiskTex(); break;
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
    sp.scale.setScalar(sunR * cfg.baseScale);
    sp.userData = { cfg, baseScale: sunR * cfg.baseScale };
    sprites.push(sp);
  }

  const group = new THREE.Group();
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

      // 远处稍微放大
      const scaleFactor = 1.0 + Math.min(0.3, Math.max(0, (cameraDistance - 100) / 1500) * 0.3);
      sp.scale.setScalar(sp.userData.baseScale * scaleFactor);

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

  // 暖白 G2V 阳光（5500K 略偏暖）
  const sunLight = new THREE.PointLight(0xfff5e0, 3.5, 0, 0);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  return { sunLight, ambient };
}