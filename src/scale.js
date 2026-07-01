/* scale.js — NASA 标准距离 + 真实体积 缩放
 *
 * 设计（基于 tycho.ioz 风格）：
 *   - 距离按 AU 真实比例 (1 AU = 80 世界单位)
 *   - 行星半径按真实相对大小（地球 = 1.0）
 *   - 太阳半径 = 1.0（小光点，不挡视线）
 *   - 月球相对地球 = 0.27（真实）
 *
 * 验证（不穿模）：
 *   水星 d=31.2, r=0.383, 太阳=1.0 → 边距 +29.8 ✅
 *   海王星 d=2404, r=3.88, 太阳=1.0 → 边距 +2399 ✅
 */

import * as THREE from 'three';
import { DIST_SCALE, SUN_R, PLANETS, MOON } from './constants.js';
import { makeOrbit, sunGlowSprites } from './planets.js';
import { GLOW_INNER_SCALE, GLOW_OUTER_SCALE } from './lighting.js';

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
  return MOON.distance;
}

/** 重新生成所有轨道线 */
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

/** 初始化场景时调用：太阳 scale、行星 scale、位置、月球、相机 */
export function scaleScene(scene, camera, controls) {
  const planetObjs = window.__planets;
  const sun = window.__sun;
  if (!planetObjs) return;

  // 太阳几何尺寸 1.0，scale = SUN_R（=1.0，不缩放）
  sun.scale.setScalar(SUN_R / 1.0);

  // 辉光：双层 sprite
  // 内层（紧贴太阳）+ 外层（淡黄覆盖）
  const innerScales = GLOW_INNER_SCALE;  // 单值
  const outerScales = GLOW_OUTER_SCALE;  // 单值
  sunGlowSprites.forEach((s, i) => {
    const sc = i === 0 ? innerScales : outerScales;
    s.scale.set(SUN_R * sc, SUN_R * sc, 1);
  });

  // 行星：geometry 已用 realSize 创建，无需 scale
  planetObjs.forEach(o=>{
    o.mesh.scale.setScalar(1.0);
    o.pivot.position.setLength(getDisplayDistance(o.data));
  });

  // 月球
  const moon = window.__moon;
  if (moon) {
    moon.mesh.scale.setScalar(1.0);
    moon.mesh.position.set(MOON.distance, 0, 0);
  }

  regenerateOrbits(scene);

  // 相机默认位置（tycho.ioz 风格：视野内能看到水星到火星）
  // 海王星在 2404 单位远处，需要相机 ~3000 才能看到完整太阳系
  // 默认相机放在能看到金星-火星的范围（用户滚轮拉远看外行星）
  camera.position.set(0, 80, 250);
  controls.target.set(0, 0, 0);
}