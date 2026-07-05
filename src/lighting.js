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
 * lensflare0_alpha.png 是 Three.js 官方 Lensflare 示例用的素材：
 *   - 中心白亮点 + 12 道极细放射光线 + 大圆盘柔光（外圈弥散）
 *   - 原本是暖橙色调
 *
 * 处理步骤：
 *   1. 加载原图
 *   2. 去色（保留亮度，转灰度）—— 这样 sprite color 可以染成任意色调
 *   3. 把外圈 50% 半径以外的像素全部涂黑 —— 去掉贴图本身带的柔光外圈
 *      （用户反馈"还有一个环"，那圈就是贴图自带的柔光外圈）
 *      保留中心 50% 半径内的中心亮点 + 放射光线
 *
 * 去色算法：对每个像素，max(R,G,B) 作为灰度（保留高光细节）
 * 切外圈算法：distNorm > 0.5 时 alpha = 0
 */
let _flareTex = null;
async function loadFlareTex() {
  if (_flareTex) return _flareTex;
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      './src/textures/lensflare0_alpha.png',
      (tex) => {
        // 加载后用 canvas 处理
        const img = tex.image;
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const data = imgData.data;
        const cx = c.width / 2, cy = c.height / 2;
        const cutoffRadius = Math.min(c.width, c.height) / 2;  // 整个 canvas 的中心半径

        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            const idx = (y * c.width + x) * 4;
            const dx = x - cx, dy = y - cy;
            const distNorm = Math.sqrt(dx * dx + dy * dy) / cutoffRadius;  // 0..1（边缘=1）

            // 1) 去色：取最亮通道作为灰度
            const lum = Math.max(data[idx], data[idx + 1], data[idx + 2]);
            data[idx]     = lum;
            data[idx + 1] = lum;
            data[idx + 2] = lum;

            // 2) 切外圈：distNorm > 0.5 时把 alpha 设为 0（去掉柔光外圈）
            if (distNorm > 0.5) {
              // 用平滑过渡而不是硬切：0.45→0.50 区间内 alpha 从 1 衰减到 0
              // 这样保留中心 50% 半径，丢弃外圈 50%，过渡区避免硬边
              const fadeFactor = THREE.MathUtils.smoothstep(distNorm, 0.45, 0.50);
              data[idx + 3] = Math.round(data[idx + 3] * (1 - fadeFactor));
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);

        const grayTex = new THREE.CanvasTexture(c);
        grayTex.colorSpace = THREE.SRGBColorSpace;
        grayTex.needsUpdate = true;
        _flareTex = grayTex;
        // 释放原始贴图
        tex.dispose();
        resolve(grayTex);
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
  // 唯一一层：lens flare 贴图（512×512 真实镜头炫光，已去色 + 切外圈）
  // 贴图被切到只剩中心 50% 半径（中心亮点 + 12 道放射光线，无外圈柔光）
  // baseScale 3.0：补偿切外圈带来的尺寸损失（之前 1.6 是完整贴图，砍掉一半后需要放大）
  // color 0xfff5e0 暖白：把灰度染成暖白
  { name: 'flare',     baseScale: 3.0, baseOpacity: 0.85, color: 0xfff5e0, tex: 'flare', range: [0,   800] },
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