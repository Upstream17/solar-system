/* textures.js — 在线纹理加载 + 程序化 fallback */

import * as THREE from 'three';

const texLoader = new THREE.TextureLoader();
texLoader.crossOrigin = 'anonymous';

/** 程序化纹理（fallback） */
export function proceduralTexture(color, size=256) {
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(color);
  const img = ctx.createImageData(size,size);
  for (let i=0;i<size*size;i++) {
    const n = (Math.random()-0.5)*40;
    img.data[i*4]   = Math.max(0,Math.min(255,col.r*255+n));
    img.data[i*4+1] = Math.max(0,Math.min(255,col.g*255+n));
    img.data[i*4+2] = Math.max(0,Math.min(255,col.b*255+n));
    img.data[i*4+3] = 255;
  }
  ctx.putImageData(img,0,0);
  for (let k=0;k<size/8;k++){
    ctx.beginPath();
    ctx.arc(Math.random()*size, Math.random()*size, Math.random()*size/15+2, 0, Math.PI*2);
    ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.15})`;
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 加载纹理，失败 fallback 到程序化纹理 */
export function safeTexture(url, fallbackColor) {
  return new Promise((resolve)=>{
    texLoader.load(
      url,
      (tex)=>{ tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
      undefined,
      ()=>{ resolve(proceduralTexture(fallbackColor)); console.warn('fallback for', url); }
    );
  });
}