/* scale.js — NASA 标准距离 + 真实体积 缩放
 *
 * 设计：
 *   - 距离按 AU 真实比例 (1 AU = 50 世界单位)
 *   - 行星半径按真实相对大小（地球 = 1.0）
 *   - 太阳半径 = 16.8（明显大于最大行星木星 11.21，比例 1.5×）
 *   - 月球相对地球 = 0.27（真实）
 *
 * 验证（不穿模）：
 *   水星 d=19.5, r=0.383, 太阳=16.8 → 边距 +2.317 ✅
 *   海王星 d=1502, r=3.88, 太阳=16.8 → 边距 +1481.8 ✅
 */

import * as THREE from 'three';
import { DIST_SCALE, SUN_R, PLANETS, MOON } from './constants.js';
import { makeOrbit, sunGlowSprites } from './planets.js';
import { GLOW_SCALE_RATIO } from './lighting.js';

const _orbitLines = [];

/** 行星显示半径 = realSize（地球=1） */
export function getPlanetDisplayRadius(p) {
  return p.realSize;
}

/** 太阳显示半径 */
export function getSunDisplayRadius() {
  return SUN_R;
}

/** 行星到太阳的距离 = AU × DIST_SCALE */
export function getDisplayDistance(p) {
  return p.distance * DIST_SCALE;
}

/** 月球相对地球的距离 */
export function getMoonDistanceFromEarth() {
  return MOON.distance;  // 0.6
}

/** 重新生成所有轨道线（按真实 AU 距离） */
export function regenerateOrbits(scene) {
  _orbitLines.forEach(l=>{ scene.remove(l); l.geometry.dispose(); });
  _orbitLines.length = 0;
  const planetObjs = window.__planets;
  if (!planetObjs) return;
  planetObjs.forEach(o=>{
    const line = makeOrbit(getDisplayDistance(o.data));
    scene.add(line);
    _orbitLines.push(line);
  });
}

/** 初始化场景时调用：设置太阳 scale、行星 scale、位置、月球 */
export function scaleScene(scene, camera, controls) {
  const planetObjs = window.__planets;
  const sun = window.__sun;
  if (!planetObjs) return;

  // 太阳几何尺寸固定为 1.0（基准单位），scale = SUN_R
  const SUN_DEMO_GEOMETRY = 1.0;
  sun.scale.setScalar(SUN_R / SUN_DEMO_GEOMETRY);

  // 辉光尺寸：相对太阳显示半径
  const glowScales = GLOW_SCALE_RATIO.map(r => SUN_R * r);
  sunGlowSprites.forEach((s,i)=> s.scale.set(glowScales[i], glowScales[i], 1));

  // 行星：scale = realSize / geometry_size
  // 几何创建时是 data.size（也是 realSize，因为 size = realSize）
  planetObjs.forEach(o=>{
    o.mesh.scale.setScalar(1.0);  // geometry 创建时已用 realSize，无需缩放
    o.pivot.position.setLength(getDisplayDistance(o.data));
  });

  // 月球：相对地球
  const moon = window.__moon;
  if (moon) {
    moon.mesh.scale.setScalar(1.0);  // 月球几何 = 0.27 = realSize
    moon.mesh.position.set(MOON.distance, 0, 0);
  }

  regenerateOrbits(scene);

  // 相机默认位置：能看到金星-地球-火星
  // 默认位置：地球轨道 50，目标地球，相机距离 ~80
  camera.position.set(0, 35, 85);
  controls.target.set(DIST_SCALE, 0, 0);  // 看向地球（1 AU）
}