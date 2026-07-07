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
 * v20260707 v2: 改用 tick 按相机距离动态算 scale (基线 6×1.5 太大, 真实化后 1.5×0.375 太小)
 *             — SpriteMaterial + CanvasTexture 在 pmndrs composer 下验证可正常渲染
 *             — tick 里把 label 屏幕像素尺寸固定在 [8, 24] px
 *             — 拉近: maxPx 限制, 不会盖住行星
 *             — 拉远: minPx 限制, 不会缩到 0
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
  const mat = new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  // v20260707: 占位, tick 里按相机距离动态算 (8~24 px)
  sprite.scale.set(0.1, 0.025, 1);
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

/* ===== LOD 远档小点 (v20260707 v2)=====
 * 关键: SpriteMaterial + CanvasTexture 在 pmndrs composer 下能正常渲染
 *   — tick 里按相机距离动态算 scale, 让屏幕高度 = 24px
 *   — 远距离行星也能看到清晰的小圆点
 * 用 Sprite + AdditiveBlending 让小点"发光", 跟星空区分
 */
let _dotTex = null;
function getDotTexture() {
  if (_dotTex) return _dotTex;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _dotTex = new THREE.CanvasTexture(c);
  _dotTex.colorSpace = THREE.SRGBColorSpace;
  return _dotTex;
}

function makePlanetDot(color) {
  const mat = new THREE.SpriteMaterial({
    map: getDotTexture(),
    color: color,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,  // 加亮混合, 让小点更醒目
    toneMapped: false
  });
  const sprite = new THREE.Sprite(mat);
  // 占位, tick 里按相机距离动态算
  sprite.scale.set(0.1, 0.1, 1);
  return sprite;
}

/* 创建一个 LOD 包装的行星对象
 * - 近档: 原 mesh (带贴图, 适合近距离观察)
 * - 远档: makePlanetDot 屏幕 24px 小点 (适合远距离观察)
 * 阈值: 距行星 > 500 单位用远档
 */
export function makePlanetWithLOD(mesh, color, realSize) {
  // LOD 节点
  // 阈值含义: addLevel(distance) 的 distance 是"相机到这个 LOD 节点世界坐标"的距离（世界单位）
  //   - 距 < threshold → 显示第一个 addLevel 的对象 (近档 mesh)
  //   - 距 > threshold → 显示后一个 addLevel 的对象 (远档 sprite dot)
  //
  // 阈值设计: 视觉直径 = 2px 时切换 (近档仍可辨识)
  //   视觉 px = realSize / distance * (canvasH / 2 / tan(fov/2))
  //   2px 距离 = realSize * 800 / (2*0.521) / 2 = realSize * 384
  //
  // 案例 (默认相机 3354 距太阳):
  //   水星 0.383 → 阈值 147  (默认相机 2500 远 → 远档)
  //   地球 1.0   → 阈值 384  (默认相机 1883 远 → 远档)
  //   木星 11.2  → 阈值 4300 (默认相机 13243 远 → 远档)
  //   → 默认相机下 8 颗行星全远档
  //   → 拉近到地球 384 单位内 → 看到地球贴图
  //   → 拉近到水星 147 单位内 → 看到水星贴图
  //   → 拉近到木星 4300 单位内 → 看到木星贴图
  const lod = new THREE.LOD();
  // 阈值 = 视觉 2px 距离
  const threshold = realSize * 384;
  // 远档: 屏幕 4px sprite dot (之前 24px 太大, 看起来比太阳还大)
  lod.addLevel(makePlanetDot(color), threshold);
  // 近档: 原 mesh
  lod.addLevel(mesh, 0);
  lod.userData.isPlanetLOD = true;
  return lod;
}

/* ===== 太阳 ===== */
// 远档太阳 sprite: 暖白圆点 + 中心柔光
// 跟行星 dot 不同: 太阳 dot 用 2 层 sprite (中心亮核 + 外层柔光晕)
// 模拟真实"远观太阳" = 明亮小亮点 + 短柔光
function makeSunDot() {
  // 中心亮核: 暖白圆形 (亮黄白色)
  const size = 64;
  const coreC = document.createElement('canvas');
  coreC.width = coreC.height = size;
  const coreCtx = coreC.getContext('2d');
  const coreGrad = coreCtx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  coreGrad.addColorStop(0.0, 'rgba(255,255,240,1.0)');    // 中心极亮
  coreGrad.addColorStop(0.3, 'rgba(255,245,200,0.9)');   // 暖白
  coreGrad.addColorStop(0.7, 'rgba(255,200,120,0.3)');   // 暖橙外缘
  coreGrad.addColorStop(1.0, 'rgba(255,150,80,0)');       // 渐变透明
  coreCtx.fillStyle = coreGrad;
  coreCtx.fillRect(0, 0, size, size);
  const coreTex = new THREE.CanvasTexture(coreC);
  coreTex.colorSpace = THREE.SRGBColorSpace;

  // 外层柔光晕: 更大更暗
  const haloSize = 128;
  const haloC = document.createElement('canvas');
  haloC.width = haloC.height = haloSize;
  const haloCtx = haloC.getContext('2d');
  const haloGrad = haloCtx.createRadialGradient(haloSize/2, haloSize/2, 0, haloSize/2, haloSize/2, haloSize/2);
  haloGrad.addColorStop(0.0, 'rgba(255,220,150,0.5)');
  haloGrad.addColorStop(0.3, 'rgba(255,200,130,0.2)');
  haloGrad.addColorStop(0.7, 'rgba(255,150,100,0.05)');
  haloGrad.addColorStop(1.0, 'rgba(255,120,80,0)');
  haloCtx.fillStyle = haloGrad;
  haloCtx.fillRect(0, 0, haloSize, haloSize);
  const haloTex = new THREE.CanvasTexture(haloC);
  haloTex.colorSpace = THREE.SRGBColorSpace;

  // 创建 sprite group (亮核 + 外晕)
  const group = new THREE.Group();

  const coreMat = new THREE.SpriteMaterial({
    map: coreTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const coreSprite = new THREE.Sprite(coreMat);
  coreSprite.scale.set(0.1, 0.1, 1);
  coreSprite.userData.isSunCore = true;
  group.add(coreSprite);

  const haloMat = new THREE.SpriteMaterial({
    map: haloTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const haloSprite = new THREE.Sprite(haloMat);
  haloSprite.scale.set(0.2, 0.2, 1);
  haloSprite.userData.isSunHalo = true;
  group.add(haloSprite);

  return group;
}

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

  // v20260707 v3: 用 LOD 包装 — 远距离切到 sun dot sprite (2 层 sprite: 中心亮核 + 外晕)
  //   阈值 = SUN_R * 384 = 4608 (跟行星 LOD 算法一致: 视觉 2px 距离)
  //   默认相机 3354 距太阳 < 4608 → 近档 mesh + godrays
  //   用户拉远到 > 4608 (例如在海王星附近) → 远档 sun dot + 关 godrays
  const sunLod = new THREE.LOD();
  sunLod.addLevel(makeSunDot(), SUN_R * 384);  // 远档
  sunLod.addLevel(mesh, 0);                     // 近档
  sunLod.userData = mesh.userData;
  sunLod.userData.isSunLOD = true;
  scene.add(sunLod);

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
    return sunLod;
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

  // v20260707: 用 LOD 包装 mesh — 远距离 (>500) 自动切到屏幕 24px sprite 小点
  // 近档: mesh (带 ring/clouds/label 子节点) — 适合近距离观察
  // 远档: sprite 小点 — 远距离也能看到行星位置
  const lod = makePlanetWithLOD(mesh, p.color, p.realSize);
  // LOD 中心 = mesh 中心 = 行星位置, lod.update(camera) 自动按距 mesh 距离切档
  lod.userData = mesh.userData;
  lod.userData.isPlanetLOD = true;

  // 倾斜容器
  const pivot = new THREE.Object3D();
  const tilt = new THREE.Object3D();
  tilt.rotation.z = THREE.MathUtils.degToRad(p.tilt);
  mesh.rotation.y = Math.random()*Math.PI*2;
  // 注意: 把 lod 放在 tilt 里, mesh 放在 lod 里 (level 0)
  //   — LOD 节点本身不带 transform, 只是 level 切换的容器
  //   — 远档 dot 也在 lod 里, 跟 mesh 同一位置
  tilt.add(lod);
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
  return { pivot, mesh, data:p, lod };
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