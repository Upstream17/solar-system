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

  // 相机默认位置（tycho.ioz 风格：视野内能看到金星-火星）
  // DIST_SCALE 翻倍后同步：相机放在 (0, 100, 300) 距离 ≈ 316 单位
  // 太阳半径 12.0，FOV 55° 下占视野 ≈ 2×atan(12/316) ≈ 4.4° ≈ 视野 8%
  // 海王星在 4808 单位远处，需要相机 ~6000 才能看到完整太阳系（用户滚轮拉远）
  camera.position.set(0, 100, 300);
  controls.target.set(0, 0, 0);
}