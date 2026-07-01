/* lighting.js — 光照 + 太阳辉光 sprite */

import * as THREE from 'three';

/* 太阳辉光 sprite
   sizeAttenuation:true 让辉光跟随相机距离缩放
   tycho.ioz 风格：辉光小且不挡视线（太阳本体极小）*/
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
    sizeAttenuation: true
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
  const sunLight = new THREE.PointLight(0xffffff, 3.5, 0, 0);
  sunLight.position.set(0,0,0);
  scene.add(sunLight);

  return { sunLight, ambient };
}

/** 太阳辉光 sprite 的基础 opacity（tycho.ioz 风格：偏小，不挡视线） */
export const GLOW_BASE_OPACITY = 0.55;  // 单一 sprite，整体半透明

/** 辉光尺寸比例（相对太阳显示半径） */
export const GLOW_SCALE_RATIO = 1.5;  // 单一 sprite，太阳 1.5× 半径