/* planets.js — 太阳 + 行星 + 月球 创建 */

import * as THREE from 'three';
import { SUN_R, PLANETS, MOON, SUN_FACTS } from './constants.js';
import { safeTexture } from './textures.js';
import { makeSunGlow } from './lighting.js';
import { tick as loaderTick } from './loader.js';

// 进度回调：每个纹理加载完调用一次，让 loader 显示 "X / N"
const onLoaderTick = (label) => loaderTick(label);

/* 文字标签（Canvas 渲染 → Sprite） */
// v20260707: 改用 MeshBasicMaterial + PlaneGeometry 替代 Sprite
// 原因: pmndrs EffectComposer 不渲染 Sprite (实测不显示)
// - MeshBasicMaterial 不受光照影响, 红色/绿色等纯色正常显示
// - PlaneGeometry 渲染 quad, 加 CanvasTexture 当文字贴图
// - tick 里手动设 mesh.quaternion = camera.quaternion 做 billboard
/* 文字标签（Canvas 渲染 → Sprite）
 * v20260707: 改用 MeshBasicMaterial 替代 Sprite (pmndrs EffectComposer 不渲染 Sprite)
 *             — tick 里按相机距离算屏幕像素尺寸 (8~24px) + billboard
 *             — 但 Mesh + CanvasTexture 在 pmndrs composer 下也不显示 (实际验证)
 *             — 暂时回滚到基线 SpriteMaterial, 但 scale 改小到 1.5×0.375
 *               避免基线 6×1.5 太大盖住行星的问题
 *             — TODO: 调研 pmndrs composer CanvasTexture 渲染兼容问题
 */
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
  // v20260707: 基线 6×1.5 → 1.5×0.375 (缩小 4×), 拉近时不至于完全盖住行星
  sprite.scale.set(1.5, 0.375, 1);
  sprite.userData.isLabel = true;
  return sprite;
}

function addLabel(parent, text, yOffset, sceneRef) {
  const s = makeTextSprite(text);
  s.position.set(0, yOffset || 2, 0);
  parent.add(s);
  return s;
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

/* 太阳辉光元素数组（4 层 Sprite，外部可访问以控制 visible）
 * 元素顺序: [halo, corona, glow, core] — 从外到内
 */
export const sunGlowSprites = [];

/* ===== 太阳 ===== */
export async function makeSun(scene) {
  const sunTex = await safeTexture('./src/textures/sun.jpg', 'sun', onLoaderTick);
  // 几何尺寸固定为 1.0（基准单位），scale 调整显示（scale = SUN_R = 12.0）
  const geo = new THREE.SphereGeometry(1.0, 64, 64);
  // 太阳本体：温和暖白（G2V 真实颜色）— 亮度由 toneMapped:false + bloom 维持，不靠颜色
  // 之前用纯白 #ffffff 显得"电灯泡"，G2V 型恒星实际是带轻微暖色的白色
  // 暖白 #fff5d8 在视觉上更像真实太阳（NASA SDO 影像的真实颜色）
  const mat = new THREE.MeshBasicMaterial({
    map: sunTex,
    color: 0xfff5d8,        // 温和暖白（G2V 真实颜色，不偏黄也不偏冷）
    toneMapped: false,      // 不参与 tone mapping（保持最亮，配合 bloom 过曝）
    transparent: false,
    depthWrite: true
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { isSun:true, name:'太阳', en:'Sun', size:SUN_R, typeZh:SUN_FACTS.typeZh, typeEn:SUN_FACTS.typeEn,
    factsZh:{ diameter:'1,392,700 km', mass:'1.99×10³⁰ kg', age:'46 亿年',
              temp:'表面 5,500 °C · 核心 1,500 万 °C', gravity:'274 m/s²', luminosity:'3.83×10²⁶ W' },
    factsEn:{ diameter:'1,392,700 km', mass:'1.99×10³⁰ kg', age:'4.6 billion years',
              temp:'Surface 5,500 °C · Core 15 million °C', gravity:'274 m/s²', luminosity:'3.83×10²⁶ W' },
    factZh:SUN_FACTS.factZh,
    factEn:SUN_FACTS.factEn };
  scene.add(mesh);

  // 4 层 Sprite 辉光（halo / corona / glow / aura）— 已废弃
  // — 原因：GodRaysEffect 接管了"中心辐射"视觉效果
  // — sprite 4 层叠加看起来是"同心球层"，分界明显
  // — 而且 baseScale 2.8×SUN_R ≈ 33.6u ≈ 水星轨道 (d=31.2) — 把水星轨道包进去了
  // — godrays 是 screen-space raymarched，从屏幕中心平滑扩散，没有球层分界
  // — 保留代码（makeSunGlow 在 lighting.js 里）但不调用，方便以后想用再恢复
  // const glow = makeSunGlow(SUN_R);
  // mesh.add(glow.group);
  // glow.sprites.forEach(s => sunGlowSprites.push(s));
// mesh.userData.glowUpdate = glow.update;

  // sun label 单独 add 到 scene，不放进 sun mesh 子节点树
    // 原因：GodRaysEffect 把 sun mesh 当 lightSource 时，整棵子树都算 lightSource
    //        如果 label 在子节点里，会被 godrays 当成"光"渲染（label 也会发光）
    const label = makeTextSprite('☀ 太阳', '#fff5d8');
    label.position.set(0, 1.5 * SUN_R, 0);
    scene.add(label);
    return mesh;
  }

/* ===== 行星 ===== */
export async function makePlanet(scene, p) {
  // 行星名 → 程序化纹理名
  const texName = { '水星':'mercury', '金星':'venus', '地球':'earth', '火星':'mars',
                    '木星':'jupiter', '土星':'saturn', '天王星':'uranus', '海王星':'neptune' }[p.name] || 'earth';
  const tex = await safeTexture(p.texture, texName, onLoaderTick);
  // 几何尺寸 = realSize（地球 = 1.0），与真实比例一致
  const geo = new THREE.SphereGeometry(p.realSize, 48, 48);
  const mat = new THREE.MeshStandardMaterial({ map:tex, roughness:0.85, metalness:0.05,
    emissive: new THREE.Color(p.color).multiplyScalar(0.04),
    emissiveIntensity: 0.05
  });
  if (p.bumpMap) {
    const bump = await safeTexture(p.bumpMap, texName, onLoaderTick);
    mat.bumpMap = bump;
    mat.bumpScale = 0.04;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { isPlanet:true, data:p, name:p.name, en:p.en, typeZh:p.typeZh, typeEn:p.typeEn };

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
    const ringInner = p.realSize*1.4;
    const ringOuter = p.realSize*(p.ringOuter||2.2);
    const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 96);
    const pos = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    for (let i=0;i<pos.count;i++){
      const x = pos.getX(i), y = pos.getY(i);
      uv.setXY(i, (Math.sqrt(x*x+y*y) - ringInner) / (ringOuter - ringInner), 0.5);
    }
    // 有 ringTexture 用贴图；没有 fallback 纯色（向后兼容）
    let ringMap = null;
    if (p.ringTexture) {
      ringMap = await safeTexture(p.ringTexture, p.name === '土星' ? 'saturn_ring' : 'uranus_ring', onLoaderTick);
    }
    const ringMat = new THREE.MeshBasicMaterial({
      map: ringMap || null,
      color: ringMap ? 0xffffff : (p.ringColor||0xc9b896),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI/2;
    mesh.add(ring);
  }

  // 地球云层（独立 sprite — 降透明度 + noise displacement 避免塑料贴图感）
  // 关键：opacity 0.55 → 0.35（与海陆融合），displacement 让云朵有"凸起感"而非平贴
  if (p.cloudsTexture) {
    const cloudsTex = await safeTexture(p.cloudsTexture, 'earth_clouds', onLoaderTick);
    const cloudsGeo = new THREE.SphereGeometry(p.realSize * 1.018, 64, 64);
    // 顶点 displacement — 用噪声让云层表面起伏（凸起的云团比平贴真实）
    const posAttr = cloudsGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
      // 用顶点方向 + 噪声幅度推出去（伪 noise — 数学稳定）
      const noise = Math.sin(x * 8) * Math.cos(y * 8) * Math.sin(z * 8) * 0.005;
      posAttr.setXYZ(i, x * (1 + noise), y * (1 + noise), z * (1 + noise));
    }
    cloudsGeo.computeVertexNormals();
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsTex, transparent: true, opacity: 0.35,
      depthWrite: false,
      roughness: 0.95,
      emissive: 0xffffff, emissiveMap: cloudsTex, emissiveIntensity: 0.08  // 让云白天反射阳光
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    cloudsMesh.userData.isClouds = true;
    mesh.add(cloudsMesh);
    mesh.userData.cloudsMesh = cloudsMesh;
  }

  addLabel(mesh, p.name, p.realSize * 1.6);
  return { pivot, mesh, data:p };
}

/* ===== 月球 ===== */
export async function makeMoon() {
  const tex = await safeTexture(MOON.texture, 'moon', onLoaderTick);
  // 几何尺寸 = MOON.size（演示值 0.18，明显小于地球 1.0）
  const geo = new THREE.SphereGeometry(MOON.size, 32, 32);
  const mat = new THREE.MeshStandardMaterial({ map:tex, roughness:1,
    emissive: new THREE.Color(0xaaaaaa).multiplyScalar(0.06), emissiveIntensity: 0.08 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { isPlanet:true, data:MOON, name:MOON.name, en:MOON.en, typeZh:MOON.typeZh, typeEn:MOON.typeEn };

  const pivot = new THREE.Object3D();
  pivot.add(mesh);
  mesh.position.set(MOON.distance, 0, 0);
  return { pivot, mesh, data:MOON };
}