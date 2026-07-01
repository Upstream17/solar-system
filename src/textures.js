/* textures.js — 在线纹理加载 + 高质量程序化 fallback
 *
 * 重要：threejs.org 已删除大部分行星纹理（404），
 * 所以 fallback 必须是高质量程序化纹理（看上去像真实行星）
 */

import * as THREE from 'three';

const texLoader = new THREE.TextureLoader();
texLoader.crossOrigin = 'anonymous';

/* ===== 高质量程序化行星纹理 ===== */

/** 通用：噪声 + 颜色（基础噪声纹理） */
function noiseColor(r, g, b, size = 512, noiseAmp = 30) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size*size; i++) {
    const n = (Math.random() - 0.5) * noiseAmp;
    img.data[i*4]   = Math.max(0, Math.min(255, r + n));
    img.data[i*4+1] = Math.max(0, Math.min(255, g + n));
    img.data[i*4+2] = Math.max(0, Math.min(255, b + n));
    img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx, size };
}

/** 地球：蓝绿海陆（带云层感） */
function makeEarthTex(size = 512) {
  const { c, ctx, size: s } = noiseColor(50, 90, 180, s, 15);
  // 海洋纹理
  for (let k = 0; k < 200; k++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = 20 + Math.random() * 40;
    ctx.fillStyle = `rgba(${40 + Math.random()*40}, ${100 + Math.random()*60}, ${50 + Math.random()*40}, 0.7)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 白云
  for (let k = 0; k < 50; k++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, 10 + Math.random() * 30, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 金星：橙黄色 + 厚云层条纹 */
function makeVenusTex(size = 512) {
  const { c, ctx, size: s } = noiseColor(220, 180, 100, s, 20);
  // 云层条纹（水平）
  for (let y = 0; y < s; y += 8) {
    ctx.fillStyle = `rgba(${180 + Math.random()*40}, ${140 + Math.random()*40}, ${80 + Math.random()*30}, ${0.3 + Math.random() * 0.3})`;
    ctx.fillRect(0, y, s, 4 + Math.random() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 水星：灰色 + 陨石坑密布 */
function makeMercuryTex(size = 512) {
  const { c, ctx, size: s } = noiseColor(180, 160, 140, s, 25);
  // 大量陨石坑
  for (let k = 0; k < 100; k++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = 3 + Math.random() * 25;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(80, 70, 60, 0.8)');
    grad.addColorStop(0.7, 'rgba(120, 110, 100, 0.4)');
    grad.addColorStop(1, 'rgba(180, 160, 140, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 火星：红褐色 + 暗斑 */
function makeMarsTex(size = 512) {
  const { c, ctx, size: s } = noiseColor(200, 100, 60, s, 30);
  // 暗斑（火山/低地）
  for (let k = 0; k < 30; k++) {
    ctx.fillStyle = `rgba(${100 + Math.random()*30}, ${50 + Math.random()*20}, ${30 + Math.random()*15}, ${0.4 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, 15 + Math.random() * 40, 0, Math.PI * 2);
    ctx.fill();
  }
  // 极冠（白）
  ctx.fillStyle = 'rgba(255, 240, 230, 0.6)';
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.1, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.9, 30, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 木星：橙棕色 + 横向条纹（大红斑） */
function makeJupiterTex(size = 512) {
  const { c, ctx, size: s } = noiseColor(220, 180, 130, s, 15);
  // 横向条纹
  for (let y = 0; y < s; y += 12) {
    const lightness = 0.6 + Math.random() * 0.4;
    const r = 200 + Math.random() * 40;
    const g = 160 + Math.random() * 40;
    const b = 100 + Math.random() * 40;
    ctx.fillStyle = `rgba(${r * lightness}, ${g * lightness}, ${b * lightness}, 0.6)`;
    ctx.fillRect(0, y, s, 8 + Math.random() * 6);
  }
  // 大红斑
  ctx.fillStyle = 'rgba(200, 80, 50, 0.7)';
  ctx.beginPath();
  ctx.ellipse(s * 0.3, s * 0.6, 50, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 土星：淡黄色 + 横向条纹 */
function makeSaturnTex(size = 512) {
  const { c, ctx, size: s } = noiseColor(230, 210, 150, s, 15);
  for (let y = 0; y < s; y += 10) {
    const lightness = 0.7 + Math.random() * 0.3;
    ctx.fillStyle = `rgba(${230 * lightness}, ${210 * lightness}, ${150 * lightness}, 0.5)`;
    ctx.fillRect(0, y, s, 6 + Math.random() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 天王星：青蓝色 + 微弱条纹 */
function makeUranusTex(size = 512) {
  const { c, ctx, size: s } = noiseColor(160, 220, 230, s, 15);
  for (let y = 0; y < s; y += 20) {
    ctx.fillStyle = `rgba(${140 + Math.random()*30}, ${200 + Math.random()*30}, ${210 + Math.random()*30}, 0.3)`;
    ctx.fillRect(0, y, s, 10 + Math.random() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 海王星：深蓝色 + 微弱条纹 */
function makeNeptuneTex(size = 512) {
  const { c, ctx, size: s } = noiseColor(60, 100, 200, s, 15);
  for (let y = 0; y < s; y += 15) {
    ctx.fillStyle = `rgba(${40 + Math.random()*30}, ${80 + Math.random()*30}, ${180 + Math.random()*30}, 0.3)`;
    ctx.fillRect(0, y, s, 8 + Math.random() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 月球：灰色 + 陨石坑 */
function makeMoonTex(size = 512) {
  return makeMercuryTex(size);  // 复用
}

/** 太阳：橙黄色 + 颗粒感 */
function makeSunTex(size = 512) {
  const { c, ctx, size: s } = noiseColor(255, 200, 80, s, 40);
  // 颗粒（对流元胞）
  for (let k = 0; k < 300; k++) {
    ctx.fillStyle = `rgba(${200 + Math.random()*55}, ${100 + Math.random()*60}, ${20 + Math.random()*40}, ${0.3 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, 5 + Math.random() * 15, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ===== 统一 fallback 函数 ===== */
export function proceduralTexture(name, size = 512) {
  switch (name) {
    case 'sun':     return makeSunTex(size);
    case 'mercury': return makeMercuryTex(size);
    case 'venus':   return makeVenusTex(size);
    case 'earth':   return makeEarthTex(size);
    case 'mars':    return makeMarsTex(size);
    case 'jupiter': return makeJupiterTex(size);
    case 'saturn':  return makeSaturnTex(size);
    case 'uranus':  return makeUranusTex(size);
    case 'neptune': return makeNeptuneTex(size);
    case 'moon':    return makeMoonTex(size);
    default:        return makeEarthTex(size);
  }
}

/** 加载纹理，失败 fallback 到对应行星的程序化纹理 */
export function safeTexture(url, fallbackName) {
  return new Promise((resolve) => {
    texLoader.load(
      url,
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
      undefined,
      () => { resolve(proceduralTexture(fallbackName)); console.warn('Texture 404, using procedural fallback for:', url); }
    );
  });
}