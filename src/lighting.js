/* lighting.js — 光照 + 太阳辉光（按相机距离分级，平滑过渡）
 *
 * 设计核心（v2 重写）：
 *   1. 两种辉光贴图：
 *      - disk: 径向渐变圆盘（柔光核 / 外圈散射）
 *      - rays6 / rays8: 圆盘 + N 道放射光线的 starburst 贴图
 *      → 这是让效果看起来"真实"而非"贴上去的圆圈"的关键
 *   2. 4 层 sprite 按"贴图 × 距离"组合：
 *      - core (disk, 紧贴): 任何距离都可见的柔光核
 *      - rays (6-spike starburst): 中距离镜头光斑 — 关键层
 *      - corona (disk, 外圈): 中远距离扩散
 *      - halo (disk, 最外): 远观大气散射
 *   3. 每帧根据 cameraDistance 平滑插值每层 opacity 和 scale
 *   4. 颜色统一暖白（参考原神光效形状，但取暖白色不要冷色）
 *   5. sun mesh 本体按距离淡出
 *
 * 触发词/调参指南（基于"水星 62u / 火星 90u / 默认视角 ~100u / 海王星 4808u"）：
 *   - core range [0, 100]:   贴脸到火星距离都可见，提供"亮核"
 *   - rays range [40, 200]:  水星外到默认视角都看得到星芒，远处过曝
 *   - corona range [60, 300]: 中距离外圈扩散
 *   - halo range [200, 800]: 远观散射（海王星视角下作为"太阳光"主体）
 */

import * as THREE from 'three';

/* ========== 贴图生成 ========== */

/* 程序化生成"圆盘"贴图（中心实心白 → 边缘透明）
 * — 比 v1 更"柔"（过渡区窄），叠多层时不会出现硬边
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
  grad.addColorStop(0.08, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.50, 'rgba(255,255,255,0.15)');
  grad.addColorStop(0.80, 'rgba(255,255,255,0.03)');
  grad.addColorStop(1.00, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _diskTex = new THREE.CanvasTexture(c);
  _diskTex.colorSpace = THREE.SRGBColorSpace;
  return _diskTex;
}

/* 程序化生成"放射光线"贴图（圆盘 + N 道放射光线）
 * — 模拟镜头光斑（lens star spike）：光穿过镜头光圈产生衍射 → 6 道星芒
 * — 这是让太阳辉光"真实"而非"贴上去的圆"的关键
 * — 6 道是最经典的游戏镜头光晕数量（原神、God of War、HORIZON 都用 6 道）
 *
 * 设计思路（v2 改进）：
 *   - 把射线强度按"角度+距离"双重调制，让光线有"指向中心"的渐变感
 *   - 中心圆盘用更柔的衰减（指数 2.0），让中心更亮、外圈更柔
 *   - 射线用 sharpness=12（更细长），spikeA 用距离的 0.8 次方衰减（中心长、远端短）
 *   - 最终颜色由 sprite material color 控制，所以这里只输出 alpha
 *
 * 算法：每个像素
 *   - distNorm = 像素到中心的距离 / 半径 → 0..1
 *   - 圆盘 alpha = (1 - distNorm)^2.0 （柔光核，中心高斯式衰减）
 *   - 角度 = atan2(dy, dx)
 *   - 射线 alpha = |cos(angle × N/2)|^sharpness × (1 - distNorm)^0.8
 *     （N 道等分光线，sharpness 控制光线宽度）
 *   - 最终 alpha = min(1, 圆盘×0.50 + 射线×1.0) → 圆盘打底 + 射线主导
 */
function makeStarburstTex(spikes, sharpness, lengthFactor = 1.0) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const cx = size / 2, cy = size / 2;
  const maxR = cx * lengthFactor;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let alpha = 0;

      if (dist <= maxR) {
        const distNorm = dist / cx;  // 0..1

        // 圆盘（柔光核）— 指数 2.0 让中心很亮、外圈很快衰减
        const diskA = Math.pow(Math.max(0, 1.0 - distNorm), 2.0);

        // 放射光线 — 基于角度的 cos 调制
        let spikeA = 0;
        if (distNorm > 0.04) {  // 中心 4% 内留空给圆盘
          const angle = Math.atan2(dy, dx);
          // cos(angle × spikes/2) 在 angle ∈ [0, 2π] 内震荡 spikes 次
          // abs() 后得到 spikes 个"瓣" → 光线
          const spikeRaw = Math.abs(Math.cos(angle * spikes / 2));
          // sharpness 越大 → 光线越窄（中心高、两侧低）
          // 乘 (1 - distNorm)^0.8 让光线随距离衰减（中心长、远端短）
          spikeA = Math.pow(spikeRaw, sharpness) * Math.pow(Math.max(0, 1.0 - distNorm), 0.8);
        }

        // 综合：射线为主，圆盘打底（圆盘比例低，避免和 core 层叠加过曝）
        alpha = Math.min(1.0, diskA * 0.50 + spikeA * 1.0);
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
  if (!_raysTex6) _raysTex6 = makeStarburstTex(6, 12, 1.0);  // 6 道，sharpness=12（细长镜头光斑）
  return _raysTex6;
}

let _raysTex8 = null;
function getRaysTex8() {
  if (!_raysTex8) _raysTex8 = makeStarburstTex(8, 8, 1.0);  // 8 道，sharpness=8（更柔，预留）
  return _raysTex8;
}

/* ========== 配置 ========== */

/* 4 层 sprite 配置 — 重构为"贴图驱动"
 *
 * 颜色全部统一暖白（用户要求"参考原神但只要暖白"）：
 *   - core:   #fff8e8 (接近纯白，最亮核心)
 *   - rays:   #fff5d8 (暖白，镜头光斑 — 这是新引入的关键层)
 *   - corona: #ffe8c0 (浅暖，光晕外圈)
 *   - halo:   #ffe0a0 (暖黄，远观弥散)
 *
 * 调参原则：
 *   - core scale 1.08：紧贴太阳（sunR × 1.08），永远比 sun 略大一圈
 *   - rays scale 1.80：六道光线从中心向外延伸 80% 半径
 *   - corona scale 1.35：紧贴核心的外圈扩散
 *   - halo scale 2.20：远观散射，最大但不糊屏
 */
const LAYERS = [
  // 第一层：柔光核心（disk）— 紧贴太阳，0-100u 都可见（提供"亮核"而非过曝白片）
  // 颜色 #fff8e8（接近纯白）：提供核心高光，不偏黄
  { name: 'core',   baseScale: 1.06, baseOpacity: 0.42, color: 0xfff8e8, tex: 'disk',  range: [0,   100] },
  // 第二层：放射光线（6-spike starburst）— 中距离镜头光斑（关键层）
  // 颜色 #fff5e0（暖白，但接近纯白）：模拟 G2V 真实阳光色温
  // 范围 [30, 200]：起点从 30u 起（让中距离就能看到星芒），终点 200u 后完全消失
  { name: 'rays',   baseScale: 1.55, baseOpacity: 0.20, color: 0xfff5e0, tex: 'rays6', range: [30,  200] },
  // 第三层：外圈柔光（disk）— 中远距离扩散（rays 之外再包一层）
  // 范围与 rays 重叠 [60, 250]：让过渡区两层叠加更平滑，避免"暗环"
  // 颜色 #ffe8c8（浅暖）：比 rays 更柔的暖光圈
  { name: 'corona', baseScale: 1.65, baseOpacity: 0.14, color: 0xffe8c8, tex: 'disk',  range: [60,  250] },
  // 第四层：远观散射（disk）— 远观大气散射（海王星视角下主导）
  // 颜色 #ffe0a8（暖）：远观的轻微暖色调
  { name: 'halo',   baseScale: 2.40, baseOpacity: 0.10, color: 0xffe0a8, tex: 'disk',  range: [180, 800] },
];

/* ========== 全局开关 ========== */

/* 全局开关状态：UI toggle 控制，update() 检查它决定要不要渲染
 * 默认 true；UI 点击 checkbox 改这个值
 */
let _glowEnabled = true;
export function setGlowEnabled(v) { _glowEnabled = !!v; }

/* ========== 太阳辉光创建 ========== */

/* 创建太阳辉光（4 层 Sprite，distance-driven）
 * 返回 { group, sprites, update(camera, sunMesh) }
 *   - group: 加到 sun mesh
 *   - sprites: 4 个 Sprite 引用（toggle 控制用）
 *   - update(): 每帧调用，传 camera 和 sunMesh，按距离调整 opacity/scale/visible + sun 本体淡出
 */
export function makeSunGlow(sunR) {
  const sprites = [];

  for (const cfg of LAYERS) {
    // 按 cfg.tex 选择贴图
    let tex;
    switch (cfg.tex) {
      case 'rays6': tex = getRaysTex6(); break;
      case 'rays8': tex = getRaysTex8(); break;
      case 'disk':
      default:      tex = getDiskTex();  break;
    }

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
      const scaleFactor = 1.0 + Math.min(0.3, Math.max(0, (cameraDistance - 100) / 1500) * 0.3);
      sp.scale.setScalar(sp.userData.baseScale * scaleFactor);
      sp.visible = t > 0.001;  // 完全透明就不渲染（省 GPU）
    }

    // 太阳本体按距离淡出：把范围拉到 200-1500，让中距离（100-300）仍保持清晰
    if (sunMesh) {
      const t = THREE.MathUtils.smoothstep(cameraDistance, 200, 1500);
      // distance<200: opacity=1（清晰太阳），distance>1500: opacity=0.5（亮点但仍可见）
      sunMesh.material.opacity = 1.0 - 0.5 * t;
      sunMesh.material.transparent = t > 0.001;
    }
  }

  return { group, sprites, update };
}

/* ========== 直射光 + 环境光 ========== */

/* 添加太阳直射光（PointLight, decay=0 → 平行光效果）
 * + 环境光（保留暗面细节 + 晨昏线对比）
 * 返回 { sunLight, ambient }
 */
export function initLighting(scene) {
  // 适度环境光 + 强太阳直射，晨昏线清晰
  // 环境光冷蓝（0x8090b0）— 模拟地球大气对暗面散射的冷色调，对比日光的暖
  const ambient = new THREE.AmbientLight(0x8090b0, 0.45);
  scene.add(ambient);

  // PointLight distance=0 + decay=0 = 等效平行光（远距离不衰减）
  // 颜色改为暖白 0xfff5e0 — G2V 真实太阳光（约 5500K 略偏暖），与 sprite 辉光色调一致
  // 之前 0xffffff 偏冷，会让行星被照亮面显得"电灯泡"
  const sunLight = new THREE.PointLight(0xfff5e0, 3.5, 0, 0);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  return { sunLight, ambient };
}