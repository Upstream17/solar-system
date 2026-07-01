/* lighting.js — 光照 + 太阳辉光 sprite */

import * as THREE from 'three';

/* 太阳辉光 sprite（双层）
   - sizeAttenuation:true 让辉光跟随相机距离缩放
   - 修 #1：外层 2.5×太阳、淡色、浅淡覆盖；内层 1.2×、纯白、刺眼核心
   - 修 #5：HDR 观感 = 纯白核心 + 淡黄外层（让眼睛有'刺眼'感）*/
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
  // 适度环境光 + 强太阳直射，晨昏线清晰
  const ambient = new THREE.AmbientLight(0x8090b0, 0.45);
  scene.add(ambient);

  // PointLight distance=0 + decay=0 = 等效平行光（远距离不衰减）
  const sunLight = new THREE.PointLight(0xffffff, 3.5, 0, 0);
  sunLight.position.set(0,0,0);
  scene.add(sunLight);

  return { sunLight, ambient };
}

/* === 太阳辉光：双层 sprite 实现 HDR 观感 === */
// 修 #1: 外层从 1.5× 改为 2.5×（"浅浅一层"在太阳外面）
// 修 #5: 纯白内层 + 淡黄外层 = 刺眼 HDR 观感
export const GLOW_INNER_SCALE = 1.2;  // 纯白核心（紧贴太阳表面，比太阳稍大）
export const GLOW_INNER_OPACITY = 1.0;  // 完全不透明，纯白
export const GLOW_INNER_COLOR = 'rgba(255,255,255,1.0)';

export const GLOW_OUTER_SCALE = 2.5;  // 淡黄外层（修 #1：从 1.5 提到 2.5）
export const GLOW_OUTER_OPACITY = 0.35;  // 偏低，浅浅覆盖
export const GLOW_OUTER_COLOR = 'rgba(255,220,150,1.0)';