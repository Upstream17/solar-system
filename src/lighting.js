/* lighting.js — 光照 + 太阳辉光（按相机距离分级，平滑过渡）
 *
 * 设计核心：
 *   1. 单一白色径向渐变贴图（不分层颜色）— 4 个 sprite 叠起来就是连续衰减
 *   2. 4 层 sprite：core（白炽核心） / glow（中圈柔光） / corona（外圈光晕） / halo（最外散射）
 *   3. 每帧根据 cameraDistance 平滑插值每层的 opacity 和 scale：
 *      - 近处（< 30）：只显示 core（不挡视线）
 *      - 中距离（30-80）：core + glow 渐显
 *      - 默认距离（80-200）：+ corona
 *      - 远观（> 200）：全 4 层
 *   4. sun mesh 本体也按距离淡出（远处变成亮点，不挡散射）
 *   5. toneMapped:false — 保持 HDR 亮度
 */

import * as THREE from 'three';

/* 程序化生成"白色径向渐变"贴图（单色，alpha 渐变）
 * — 关键：所有 sprite 共用同一张白色贴图，靠 opacity 和 scale 区分强度
 * — 这样多层叠起来是连续衰减，没有颜色断层
 */
let _whiteGlowTex = null;
function getWhiteGlowTex() {
  if (_whiteGlowTex) return _whiteGlowTex;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // 径向 alpha 渐变（中心实心白 → 边缘 0）
  // 衰减曲线刻意做得"柔"（中间有过渡区），避免叠层时的硬边缘
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0.00, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.10, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.30, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  grad.addColorStop(0.80, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1.00, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _whiteGlowTex = new THREE.CanvasTexture(c);
  _whiteGlowTex.colorSpace = THREE.SRGBColorSpace;
  return _whiteGlowTex;
}

/* 距离分级阈值（基于 camera.position.length()） */
const D_CLOSE = 30;    // < 30: 近处
const D_MID   = 80;    // 30-80: 中距离
const D_FAR   = 200;   // 80-200: 默认
// > 200: 远观

/* 4 层 sprite 配置
 * — baseScale: 基础尺寸（相对 sunR 的倍数）
 * — baseOpacity: 该层满显时的透明度
 * — color: 该层颜色（白→暖白→浅黄→暖黄）
 * — distanceRange: 这层可见的相机距离范围 [start, end]（smoothstep 插值 0→baseOpacity）
 *
 * 调参原则（基于"水星距离 ≈ 62 单位"作为参考点）：
 *   - glow:  紧贴太阳，1.15× — 任何距离都只比太阳大一圈
 *   - corona: 1.4× — 中距离时可见的"光晕外缘"，不该填满视野
 *   - halo:   1.9× — 默认距离才出现的"大气层"
 *   - aura:   2.8× — 远观散射，只在 200+ 单位外出现
 *
 * 距离阈值也重新调整：corona 从 40-120 → 80-200（让水星距离看不到 corona）
 */
const LAYERS = [
  // 第一层（紧贴太阳边缘外圈，暖白）— 30u 外才出现（贴脸看不到，避开"糊屏"）
  { name: 'glow',   baseScale: 1.15,  baseOpacity: 0.20, color: 0xffffff, range: [30,  80]  },
  // 第二层（外缘光晕，暖白）— 80 单位外才出现（避免水星距离糊屏）
  { name: 'corona', baseScale: 1.4,   baseOpacity: 0.18, color: 0xfff5d0, range: [80,  200] },
  // 第三层（外圈柔光，淡黄）— 200 单位外
  { name: 'halo',   baseScale: 1.9,   baseOpacity: 0.14, color: 0xffdcaa, range: [200, 500] },
  // 第四层（最外散射，暖黄）— 500 单位外（远观）
  { name: 'aura',   baseScale: 2.8,   baseOpacity: 0.11, color: 0xffcc88, range: [500, 1500]},
];

/* 全局开关状态：UI toggle 控制，update() 检查它决定要不要渲染
 * 默认 true；UI 点击 checkbox 改这个值
 */
let _glowEnabled = true;
export function setGlowEnabled(v) { _glowEnabled = !!v; }

/* 创建太阳辉光（4 层 Sprite，distance-driven）
 * 返回 { group, sprites, update(camera, sunMesh) }
 *   - group: 加到 sun mesh
 *   - sprites: 4 个 Sprite 引用（toggle 控制用）
 *   - update(): 每帧调用，传 camera 和 sunMesh，按距离调整 opacity/scale/visible + sun 本体淡出
 */
export function makeSunGlow(sunR) {
  const tex = getWhiteGlowTex();
  const sprites = [];

  for (const cfg of LAYERS) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: cfg.color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,        // 关键：让 sprite 被水星等球体遮挡，不再穿透
      sizeAttenuation: true,
      opacity: 0,            // 初始 0，由 update() 动态设置
      toneMapped: false
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.setScalar(sunR * cfg.baseScale);
    sp.userData = { cfg, baseScale: sunR * cfg.baseScale };
    sprites.push(sp);
  }

  const group = new THREE.Group();
  // 从外到内加入（外层先渲染，内层后渲染叠加在太阳上）
  for (let i = sprites.length - 1; i >= 0; i--) group.add(sprites[i]);

  /* 每帧更新：根据相机距离插值每层的 opacity 和 scale
   * cameraDistance: 相机到原点的距离（用 camera.position.length()）
   * sunMesh: 太阳本体（用于按距离淡出 mesh，远处只看到光点）
   *
   * 全局开关 _glowEnabled：
   *   - true:  按距离正常计算各层 opacity（默认）
   *   - false: 所有 sprite 不可见、sun mesh 完全不透明（toggle off 时）
   */
  function update(cameraDistance, sunMesh) {
    if (!_glowEnabled) {
      // toggle off：所有辉光 sprite 不可见，sun mesh 完全不透明
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
      // 该层 opacity = baseOpacity × smoothstep(start, end, distance)
      const t = THREE.MathUtils.smoothstep(cameraDistance, start, end);
      sp.material.opacity = cfg.baseOpacity * t;
      // 关键：sprite 实际尺寸 = baseScale × min(1, distance/100)
      // — 近处 (< 100u): scale 不放大，保持 baseScale（让光晕紧贴太阳，不糊屏）
      // — 远处 (> 100u): scale 慢慢变大到 baseScale × 1.3（增强散射感）
      //   之前用 1.0 + (distance/500) × 0.3 公式，distance=500 时 scale=1.3× baseScale
      //   但 baseScale 本身在远距离就太大（4×SUN_R），1.3× = 5.2×SUN_R 把视野糊住
      // — 现在 baseScale 本身已经小（最大 2.8×），1.3× = 3.64× 仍然合理
      const scaleFactor = 1.0 + Math.min(0.3, Math.max(0, (cameraDistance - 100) / 1500) * 0.3);
      sp.scale.setScalar(sp.userData.baseScale * scaleFactor);
      sp.visible = t > 0.001;  // 完全透明就不渲染（省 GPU）
    }

    // 太阳本体按距离淡出：把范围拉到 200-1500，让中距离（100-300）仍保持清晰
    // 之前 80-250 太早了，导致用户中距离看太阳就变暗被光晕压过
    if (sunMesh) {
      const t = THREE.MathUtils.smoothstep(cameraDistance, 200, 1500);
      // distance<200: opacity=1（清晰太阳），distance>1500: opacity=0.5（亮点但仍可见）
      sunMesh.material.opacity = 1.0 - 0.5 * t;
      sunMesh.material.transparent = t > 0.001;
    }
  }

  return { group, sprites, update };
}

/* 添加太阳直射光（PointLight, decay=0 → 平行光效果）
 * + 环境光（保留暗面细节 + 晨昏线对比）
 * 返回 { sunLight, ambient }
 */
export function initLighting(scene) {
  // 适度环境光 + 强太阳直射，晨昏线清晰
  const ambient = new THREE.AmbientLight(0x8090b0, 0.45);
  scene.add(ambient);

  // PointLight distance=0 + decay=0 = 等效平行光（远距离不衰减）
  const sunLight = new THREE.PointLight(0xffffff, 3.5, 0, 0);
  sunLight.position.set(0,0,0);
  scene.add(sunLight);

  return { sunLight, ambient };
}
