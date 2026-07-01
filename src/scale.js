/* scale.js — 演示/真实模式切换 + 缩放 */

import * as THREE from 'three';
import {
  AU, SUN_DEMO, SUN_REAL, PLANETS, MOON, realPlanetRadius,
  DIST_SCALE_REAL
} from './constants.js';
import { makeOrbit, sunGlowSprites } from './planets.js';
import { GLOW_SCALE_RATIO } from './lighting.js';

let realistic = false;
const _orbitLines = [];

/** 演示/真实模式下的尺寸计算
 *  演示模式：data.size（艺术夸张值）
 *  真实模式：realSize^0.4（power 压缩，详见 constants.js）
 */
export function getPlanetDisplayRadius(p) {
  if (realistic) {
    return realPlanetRadius(p.realSize, p.name);
  } else {
    return p.size;
  }
}
export function getSunDisplayRadius() {
  return realistic ? SUN_REAL : SUN_DEMO;
}
export function getDisplayDistance(p) {
  if (realistic) {
    // 真实模式：按 AU 比例，水星 0.39AU → 4.68，海王星 30.05AU → 360.6
    return p.distance / AU * DIST_SCALE_REAL;
  } else {
    // 演示模式：水星 0.39*14 = 5.46，乘 0.6 = 3.28，太阳 1.5 → 边距 1.78
    return p.distance * 0.6;
  }
}
export function isRealistic() { return realistic; }
export function setRealistic(v) { realistic = v; }

/** 重新生成所有轨道线（按当前 distance） */
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

/** 缩放场景（按当前 realistic 模式调整所有 mesh.scale 和 pivot.position）
 *  修复 #1: 月球演示模式距离更紧凑（不再让月球轨道显得撞太阳）
 */
export function scaleScene(scene, camera, controls) {
  const planetObjs = window.__planets;
  const sun = window.__sun;
  if (!planetObjs) return;

  const sunRadius = getSunDisplayRadius();
  // 太阳几何尺寸固定为 SUN_DEMO，scale 调整显示
  sun.scale.setScalar(sunRadius / SUN_DEMO);

  // 辉光尺寸：用相对当前显示太阳半径的小倍数（视觉占比 1.3×~2.3×）
  const glowScales = GLOW_SCALE_RATIO.map(r => sunRadius * r);
  sunGlowSprites.forEach((s,i)=> s.scale.set(glowScales[i], glowScales[i], 1));

  // 行星
  planetObjs.forEach(o=>{
    const target = getPlanetDisplayRadius(o.data);
    const base = o.data.size;
    o.mesh.scale.setScalar(target / base);
    o.pivot.position.setLength(getDisplayDistance(o.data));
  });

  // 月球大小 + 距离
  const moon = window.__moon;
  if (moon) {
    const earth = planetObjs[2];
    const earthRadius = getPlanetDisplayRadius(earth.data);
    // 真实模式月球 = realSize^0.4；演示模式 = MOON.size
    const moonTarget = realistic ? realPlanetRadius(MOON.realSize, MOON.name)
                                  : MOON.size;
    moon.mesh.scale.setScalar(moonTarget / MOON.size);
    // 月球距离：
    //   演示模式：MOON.distance=2.5 改为 1.5（更紧凑，视觉上不撞太阳）
    //   真实模式：地球半径 × 6
    let moonDist;
    if (realistic) {
      moonDist = earthRadius * 6.0;
    } else {
      // 演示模式：1.2 + earthRadius * 0.5（让月球轨道明显但不夸张）
      moonDist = 1.2 + earthRadius * 0.4;
    }
    moon.mesh.position.set(moonDist, 0, 0);
  }

  regenerateOrbits(scene);

  // 切换时智能调整相机（让用户能看到有意义的场景）
  const neptuneDist = getDisplayDistance(PLANETS[PLANETS.length-1]);
  const camDist = camera.position.distanceTo(controls.target);
  if (realistic) {
    // 进入真实模式：相机默认拉到能看见外圈行星（海王星 360），但保留用户手动调节
    if (camDist < neptuneDist * 0.6) {
      camera.position.set(0, neptuneDist*0.4, neptuneDist*0.7);
      controls.target.set(0,0,0);
    }
  } else {
    // 退出真实模式：拉近演示模式视图（看太阳系全貌）
    if (camDist > neptuneDist * 2) {
      camera.position.set(0, 40, 80);
      controls.target.set(0,0,0);
    }
  }
}