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
import { makeOrbit } from './planets.js';

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

  // 太阳几何尺寸 1.0，scale = SUN_R（保持基准单位 1.0，外部 scale 控制大小）
  sun.scale.setScalar(SUN_R);

  // 辉光 Sprite 已通过 sizeAttenuation 自适应相机距离，无需手动控制

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

  // v20260707: DIST_SCALE×16 后相机同步拉远
  // 相机距离太阳 ≈ sqrt(1500² + 3000²) ≈ 3354 单位
  // 太阳半径 12.0，FOV 55° 下占视野 ≈ 2×atan(12/3354) ≈ 0.41° ≈ 视野 0.7%
  // 跟 NASA 真实望远镜视角（0.5°）一致 → 太阳"远而小"才是真实太空感
  camera.position.set(0, 1500, 3000);
  controls.target.set(0, 0, 0);
}