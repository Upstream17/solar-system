/* lighting.js — 光照 + 太阳辉光（v6 — 使用社区 FakeGlowMaterial）
 *
 * 设计核心（放弃 sprite 方案，v4-v5 都有 sprite bounding box 边界问题）：
 *   1. 使用社区标准方案：ektogamat/fake-glow-material-threejs（MIT License, 135 stars）
 *      — 通过 GLSL shader 在 mesh 上直接计算 fresnel 辉光
 *      — 不需要 bloom 后处理
 *      — 中心永远跟 mesh 对齐（解决 v5 中心对不上问题）
 *      — 没有 sprite bounding box 边界（解决"明显的光圈"问题）
 *   2. 用两个 fake glow 球叠加：
 *      - 外层大球（2.0× sunR）：暖白弥散外圈
 *      - 内层小球（1.3× sunR）：暖白更亮内核
 *   3. 太阳本体保持 sun.jpg 贴图 + MeshBasicMaterial（不受辉光影响）
 *   4. toggle 改成控制 glow sphere 的 visible
 *
 * 关于 fake glow material 的关键参数：
 *   - glowInternalRadius: 6.0 越小辉光越集中在边缘（反向思维：值大=更多区域发光）
 *   - falloff: 0.1 是辉光向边缘衰减的速度（0=不衰减，1=快速衰减）
 *   - glowSharpness: 0.5 辉光的锐度
 *   - glowColor: 辉光颜色
 */

import * as THREE from 'three';
import EdgeGlowMaterial from './EdgeGlowMaterial.js';

/* ========== 全局开关 ========== */

let _glowEnabled = true;
export function setGlowEnabled(v) { _glowEnabled = !!v; }

/* ========== 太阳辉光（FakeGlowMaterial mesh 方案） ========== */

/* 创建太阳辉光：返回 { group, meshes, update(cameraDistance, sunMesh) }
 *  - group: 加到 sun mesh
 *  - meshes: 内层 + 外层两个 fake glow 球（toggle 控制用）
 *  - update(): 每帧根据相机距离调整 opacity / 可见性（外层散射、内层亮核）
 *
 * 关于 fake glow material 的关键参数（基于"水星 62u / 默认视角 ~100u / 海王星 4808u"）：
 *   - glowInternalRadius: 越大辉光越集中在边缘，中心越透明
 *   - falloff: 辉光从中心向边缘的衰减速度（0=不衰减，1=快速衰减）
 *   - glowSharpness: 辉光锐度（影响 falloff 区间的形状）
 *   - glowColor: 辉光颜色
 *
 * v6.1: 之前的参数过曝 — 整体一片白光。原因是 glowInternalRadius=4.0 + opacity 0.85 太强
 *       调整：
 *       - glowInternalRadius 4.0 → 8.0（让辉光集中在边缘，中心透明能看到太阳本体）
 *       - falloff 0.3 → 0.5（更快衰减）
 *       - opacity 全部降低
 */
/* v6.4: 改用 EdgeGlowMaterial（fork 自 FakeGlowMaterial，翻转 fresnel）
 *   - 单 edge glow 球（去掉内层叠加）
 *   - 球尺寸 1.5× sunR — 略大于太阳，让边缘 fresnel 区域在 sun mesh 之外
 *   - glowInternalRadius=2.0（让 glow 仅在球的最外边缘 ~30% 区域）
 *   - falloff=0.3（中等过渡区）
 *   - opacity 0.85
 *
 * 视觉效果：
 *   - sun mesh 中心（1.0× sunR 半径内）：edge glow 透明 → 看到 sun.jpg 金黄纹理
 *   - sun mesh 外圈（1.0× ~ 1.5× sunR）：edge glow 渐显 → 暖白边缘晕
 *   - 球体最外缘（1.5× sunR）：edge glow → 0，自然 fade 到黑色背景
 */
export function makeSunGlow(sunR) {
  const group = new THREE.Group();

  // 单 edge glow 球（暖白边缘光晕）
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(sunR * 1.5, 64, 64),
    new EdgeGlowMaterial({
      glowColor: new THREE.Color('#fff5e0'),  // 暖白
      falloff: 0.3,
      glowInternalRadius: 2.0,
      glowSharpness: 0.5,
      opacity: 0.85
    })
  );
  group.add(glow);

  const meshes = [glow];

  // 缓存原始 opacity（用于距离分级恢复）
  const baseOpacities = meshes.map(m => m.material.uniforms.opacity.value);

  function update(cameraDistance, sunMesh) {
    if (!_glowEnabled) {
      for (const m of meshes) m.visible = false;
      if (sunMesh) {
        sunMesh.material.opacity = 1.0;
        sunMesh.material.transparent = false;
        sunMesh.material.needsUpdate = true;
      }
      return;
    }

    for (const m of meshes) m.visible = true;

    // 距离分级：远距离时辉光更明显（弥散感），近距离时更柔和（避免遮挡）
    const distFactor = THREE.MathUtils.smoothstep(cameraDistance, 50, 400);  // 0..1
    // glow opacity: 近距离 0.6×base → 远距离 1.0×base
    meshes[0].material.uniforms.opacity.value = baseOpacities[0] * (0.6 + 0.4 * distFactor);

    // 太阳本体按距离淡出（远处只看到光点）
    if (sunMesh) {
      const t = THREE.MathUtils.smoothstep(cameraDistance, 200, 1500);
      sunMesh.material.opacity = 1.0 - 0.5 * t;
      sunMesh.material.transparent = t > 0.001;
    }
  }

  return { group, sprites: meshes, meshes, update };
}

/* ========== 直射光 + 环境光 ========== */

export function initLighting(scene) {
  // 适度环境光（冷蓝）+ 强太阳直射（暖白 G2V 阳光）
  const ambient = new THREE.AmbientLight(0x8090b0, 0.45);
  scene.add(ambient);

  // 暖白 G2V 阳光（5500K 略偏暖）
  const sunLight = new THREE.PointLight(0xfff5e0, 3.5, 0, 0);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  return { sunLight, ambient };
}