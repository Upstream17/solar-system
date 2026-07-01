/* planets.js — 太阳 + 行星 + 月球 创建 */

import * as THREE from 'three';
import { SUN_R, PLANETS, MOON } from './constants.js';
import { safeTexture } from './textures.js';
import { makeGlowSprite, GLOW_BASE_OPACITY, GLOW_SCALE_RATIO } from './lighting.js';

/* 文字标签（Canvas 渲染 → Sprite） */
function makeTextSprite(text, color='#9bd0ff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 6;
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(6, 1.5, 1);
  sprite.userData.isLabel = true;
  return sprite;
}

function addLabel(parent, text, yOffset) {
  const s = makeTextSprite(text);
  s.position.set(0, yOffset || 2, 0);
  parent.add(s);
}

/* 轨道线（圆环） */
export function makeOrbit(distance) {
  const seg = 256;
  const pts = [];
  for (let i=0;i<=seg;i++){
    const a = (i/seg)*Math.PI*2;
    pts.push(new THREE.Vector3(Math.cos(a)*distance, 0, Math.sin(a)*distance));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color:0x335577, transparent:true, opacity:0.45 });
  const line = new THREE.LineLoop(geo, mat);
  line.userData.isOrbit = true;
  return line;
}

/* 太阳辉光 sprite 数组（外部可访问以控制 opacity/visible） */
export const sunGlowSprites = [];

/* ===== 太阳 ===== */
export async function makeSun(scene) {
  const sunTex = await safeTexture('https://threejs.org/examples/textures/planets/sun.jpg', 0xffcc55);
  // 几何尺寸固定为 1.0（基准单位），scale 调整显示（scale = SUN_R = 1.0）
  const geo = new THREE.SphereGeometry(1.0, 48, 48);
  // 修复 #3: 太阳偏暗问题 — 用亮黄色 + 提亮 texture + toneMapped:false 让太阳保持亮色不被压暗
  const mat = new THREE.MeshBasicMaterial({
    map: sunTex,
    color: 0xffeeaa,  // 暖黄色叠加
    toneMapped: false  // 不参与 tone mapping（保持最亮）
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { isSun:true, name:'太阳', size:SUN_R, type:'恒星 G2V 型 · 黄矮星',
    facts:{ diameter:'1,392,700 km', mass:'1.99×10³⁰ kg', age:'46 亿年',
            temp:'表面 5,500 °C · 核心 1,500 万 °C', gravity:'274 m/s²', luminosity:'3.83×10²⁶ W' },
    fact:'<b>太阳</b>是太阳系的中心天体，占系统总质量的 99.86%。<br>每秒将约 600 万吨氢聚变成氦。<br>光从太阳表面到达地球约需 8 分 20 秒。' };
  scene.add(mesh);

  // 辉光（tycho.ioz 风格：单一 sprite，整体小而透明）
  // 修复 #3: 辉光从暖黄色改为更亮更白的颜色 — 看上去更亮
  const glow = makeGlowSprite('rgba(255,240,200,1.0)', SUN_R * GLOW_SCALE_RATIO, GLOW_BASE_OPACITY);
  mesh.add(glow);
  sunGlowSprites.push(glow);

  addLabel(mesh, '☀ 太阳', 1.5);
  return mesh;
}

/* ===== 行星 ===== */
export async function makePlanet(scene, p) {
  const tex = await safeTexture(p.texture, p.color);
  // 几何尺寸 = realSize（地球 = 1.0），与真实比例一致
  const geo = new THREE.SphereGeometry(p.realSize, 48, 48);
  const mat = new THREE.MeshStandardMaterial({ map:tex, roughness:0.85, metalness:0.05,
    emissive: new THREE.Color(p.color).multiplyScalar(0.04),
    emissiveIntensity: 0.05
  });
  if (p.bumpMap) {
    const bump = await safeTexture(p.bumpMap, 0x808080);
    mat.bumpMap = bump;
    mat.bumpScale = 0.04;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { isPlanet:true, data:p, name:p.name };

  // 倾斜容器
  const pivot = new THREE.Object3D();
  const tilt = new THREE.Object3D();
  tilt.rotation.z = THREE.MathUtils.degToRad(p.tilt);
  mesh.rotation.y = Math.random()*Math.PI*2;
  tilt.add(mesh);
  pivot.add(tilt);

  // 起始位置（scaleScene 会按真实 AU 距离设置）
  const a = p.distance;
  const theta0 = Math.random()*Math.PI*2;
  pivot.position.set(Math.cos(theta0)*a, 0, Math.sin(theta0)*a);
  scene.add(pivot);

  // 土星/天王星环
  if (p.ring) {
    const ringGeo = new THREE.RingGeometry(p.realSize*1.4, p.realSize*(p.ringOuter||2.2), 96);
    const pos = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    for (let i=0;i<pos.count;i++){
      const x = pos.getX(i), y = pos.getY(i);
      uv.setXY(i, (Math.sqrt(x*x+y*y) - p.realSize*1.4) / (p.realSize*((p.ringOuter||2.2)-1.4)), 0.5);
    }
    const ringMat = new THREE.MeshBasicMaterial({
      color:p.ringColor||0xc9b896, side:THREE.DoubleSide, transparent:true, opacity:0.75
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI/2;
    mesh.add(ring);
  }

  addLabel(mesh, p.name, p.realSize * 1.6);
  return { pivot, mesh, data:p };
}

/* ===== 月球 ===== */
export async function makeMoon() {
  const tex = await safeTexture(MOON.texture, 0xaaaaaa);
  const geo = new THREE.SphereGeometry(MOON.realSize, 32, 32);
  const mat = new THREE.MeshStandardMaterial({ map:tex, roughness:1,
    emissive: new THREE.Color(0xaaaaaa).multiplyScalar(0.06), emissiveIntensity: 0.08 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { isPlanet:true, data:MOON, name:MOON.name };

  const pivot = new THREE.Object3D();
  pivot.add(mesh);
  mesh.position.set(MOON.distance, 0, 0);
  return { pivot, mesh, data:MOON };
}