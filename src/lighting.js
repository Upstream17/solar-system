/* lighting.js — 光照 + 太阳辉光 sprite */

import * as THREE from 'three';

/* 太阳辉光 sprite
   sizeAttenuation:true（默认）让辉光随相机距离缩放 — 防止拉远时辉光比太阳还大
   整体 opacity 调到较低值（0.4/0.25/0.12），避免打开辉光就照亮整个太阳系 */
export function makeGlowSprite(color, scale, opacity) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128,128,0, 128,128,128);
  grad.addColorStop(0.0, color);
  grad.addColorStop(0.4, color.replace(/[\d.]+\)$/, '0.4)'));
  grad.addColorStop(1.0, color.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,256,256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true  // 关键修复 #4: 随距离缩放，远处辉光不会变成大光晕
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

/** 添加太阳直射光（PointLight, decay=0 → 平行光效果）
 *  + 环境光（保留暗面细节 + 晨昏线对比）
 *  返回 { sunLight, ambient }
 */
export function initLighting(scene) {
  // 弱环境光 + 强太阳直射，晨昏线清晰
  const ambient = new THREE.AmbientLight(0x8090b0, 0.35);
  scene.add(ambient);

  // PointLight distance=0 + decay=0 = 等效平行光（远距离不衰减）
  // 强度 3.5 已足够亮，slider 可调
  const sunLight = new THREE.PointLight(0xffffff, 3.5, 0, 0);
  sunLight.position.set(0,0,0);
  scene.add(sunLight);

  return { sunLight, ambient };
}

/** 太阳辉光 sprite 的基础 opacity（按 toggleBloom 控制） */
export const GLOW_BASE_OPACITY = [0.35, 0.22, 0.10];  // 偏低，避免一打开辉光就照亮整个太阳系

/** 辉光尺寸比例（相对当前太阳显示半径） */
export const GLOW_SCALE_RATIO = [1.2, 1.6, 2.2];