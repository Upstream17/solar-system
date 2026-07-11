/* planets.js — 太阳 + 行星 + 月球 创建 */

import * as THREE from 'three';
import { SUN_R, PLANETS, MOON, SUN_FACTS } from './constants.js';
import { safeTexture } from './textures.js';
import { makeSunGlow, makeDistantGlow } from './lighting.js';
import { tick as loaderTick } from './loader.js';

// 进度回调：每个纹理加载完调用一次，让 loader 显示 "X / N"
const onLoaderTick = (label) => loaderTick(label);

/* v20260711: 删 3D label — makeTextSprite / addLabel 整个移除
 * — 行星名通过图例 (BODIES panel) + 信息面板 (info-panel) 显示
 * — 3D 场景不再叠加 Sprite 文字标签, 视觉更干净
 */

/* ===== 小行星带 (v20260708) =====
 * 接收 a=semiMajor + eccentricity + longitudeOfPerihelion(ϖ) + inclination(I) + node(Ω)
 * 公式: r(θ) = a(1-e²) / (1 + e·cosθ)，θ 从近日点起算，太阳在椭圆焦点
 * 三维姿态: 先在轨道平面求 (x', y')，再按 JPL 公式用 Ω / I / ω=ϖ-Ω 转到黄道坐标
 * Three.js 世界坐标映射: world.x=ecliptic.x, world.z=ecliptic.y, world.y=ecliptic.z
 */
export function getOrbitPosition(
  distance,
  eccentricity = 0,
  longitudeOfPerihelion = 0,
  inclination = 0,
  longitudeOfAscendingNode = 0,
  theta = 0,
  target = new THREE.Vector3()
) {
  const a = distance;
  const e = eccentricity;
  const varpi = THREE.MathUtils.degToRad(longitudeOfPerihelion);
  const inc = THREE.MathUtils.degToRad(inclination);
  const node = THREE.MathUtils.degToRad(longitudeOfAscendingNode);
  const argPeri = varpi - node;

  const r = a * (1 - e * e) / (1 + e * Math.cos(theta));
  const xPrime = r * Math.cos(theta);
  const yPrime = r * Math.sin(theta);

  const cosO = Math.cos(node), sinO = Math.sin(node);
  const cosI = Math.cos(inc),  sinI = Math.sin(inc);
  const cosW = Math.cos(argPeri), sinW = Math.sin(argPeri);

  // JPL 近似行星位置公式：轨道平面 → J2000 黄道坐标
  const xEcl = (cosW * cosO - sinW * sinO * cosI) * xPrime
             + (-sinW * cosO - cosW * sinO * cosI) * yPrime;
  const yEcl = (cosW * sinO + sinW * cosO * cosI) * xPrime
             + (-sinW * sinO + cosW * cosO * cosI) * yPrime;
  const zEcl = (sinW * sinI) * xPrime + (cosW * sinI) * yPrime;

  return target.set(xEcl, zEcl, yEcl);
}

export function makeOrbit(
  distance,
  eccentricity = 0,
  longitudeOfPerihelion = 0,
  inclination = 0,
  longitudeOfAscendingNode = 0,
  color = 0x335577
) {
  // v20260711d: 段数按"段间角 Δθ 一致"反推 — 替代 v20260711c 的"误差一致"方案
  //   关键洞察 (用户反馈): "折线感" 不取决于几何误差 ε, 取决于段间角 Δθ
  //     Δθ=1.4° → 视觉上像 256 边形, 肉眼看能数段 (火星)
  //     Δθ=0.4° → 视觉上像 872 边形, 肉眼看不出多边形 (海王星)
  //   外行星"精细"是因为 Δθ 小, 不是因为段数多/误差小
  //   → 让所有行星 Δθ 一致 = 视觉上"对齐外行星"
  //   目标: Δθ = 0.5° → 1 周段数 = 720 (所有行星统一)
  //   物理: Δθ 决定多边形感 (像 720 边形), ε 决定几何精度 (sub-pixel)
  //     水星 ε=0.011u (sub-pixel) | 海王星 ε=0.834u (0.26 像素, 仍 < 1 像素)
  //   对比历史方案:
  //     旧 v20260711 (a/5000*256): 火星 256 段 (Δθ=1.41°, 像 256 边形) — 视觉粗糙
  //                              海王星 2048 段 (Δθ=0.18°, 过度精度, 多余段数)
  //     中 v20260711c (ε 一致, n=π√R): 火星 256 段 (Δθ=1.41°, 与旧同) — 视觉仍粗糙
  //                                  海王星 872 段 (Δθ=0.41°)
  //     新 v20260711d (Δθ 一致, n=720):  所有 Δθ=0.5° — 视觉对齐
  //   总段数: 旧 7052 → v20260711c 3446 (-51%) → v20260711d 5760 (-18%)
  //   上限 2048 保留 — 防止极小轨道 (水星 R=991u) 出现 Δθ 异常
  // 段数固定 720 → 所有行星 Δθ=0.5° (对齐外行星视觉)
  // 720 是经验值: <360 (Δθ>1°) 肉眼看得出多边形, >1024 (Δθ<0.35°) 边际效用低
  // 720 是"看不出多边形"的临界段数, 对 8 颗行星统一段数最简洁
  const seg = 720;
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const theta = (i / seg) * Math.PI * 2;  // 真近点角(从近日点起算)
    pts.push(getOrbitPosition(
      distance,
      eccentricity,
      longitudeOfPerihelion,
      inclination,
      longitudeOfAscendingNode,
      theta
    ).clone());
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent:true, opacity:0.55 });
  const line = new THREE.LineLoop(geo, mat);
  line.userData.isOrbit = true;
  line.userData.orbitColor = color;
  line.userData.inclination = inclination;
  return line;
}

/* ===== 小行星带 (v20260708) =====
 * 2000 颗 Points, 分布 2.1-3.3 AU (火星 1.52 ↔ 木星 5.20 之间)
 * 每颗: 随机 semiMajor(2.1-3.3) + 随机 ecc(0.05-0.2) + 随机 perihelion + 随机 inclination(±10°)
 * — 真实小行星带特征: 偏心率分散 + 倾角分散
 * — 固定 opacity 0.7：不做距离 LOD 渐变，避免远观 α 累积反成实心带
 * — 每帧更新位置 (公转), 主带平均周期 ~3-5 年
 *
 * 性能: 1 draw call, BufferGeometry 2000 顶点, 移动端 60 fps 无压力
 */
const ASTEROID_COUNT = 2000;
const BELT_INNER = 2.1;   // AU
const BELT_OUTER = 3.3;   // AU

export function makeAsteroidBelt(distScale) {
  const geo = new THREE.BufferGeometry();
  // v20260708: 每颗预计算轨道参数, 存到 attribute (a, e, ω, i, M0)
  //   — 不预计算位置, 位置每帧由 elapsedDays 算 (跟主行星 tick 一致)
  //   — 这样"行星飞过去时小行星也在动"是统一的
  const aArr = new Float32Array(ASTEROID_COUNT);
  const eArr = new Float32Array(ASTEROID_COUNT);
  const oArr = new Float32Array(ASTEROID_COUNT);  // perihelion 弧度
  const iArr = new Float32Array(ASTEROID_COUNT);  // inclination 弧度
  const mArr = new Float32Array(ASTEROID_COUNT);  // 初始平近点角(弧度)
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const sma = BELT_INNER + Math.random() * (BELT_OUTER - BELT_INNER);
    // 随机偏心率 0.05-0.2 (真实小行星带主带特征)
    const e = 0.05 + Math.random() * 0.15;
    // 随机近心点辐角 0-360°
    const om = Math.random() * Math.PI * 2;
    // 随机轨道倾角 ±10° (小行星带特征)
    const inc = (Math.random() - 0.5) * 0.35;  // 0.35 rad ≈ 20° 峰-峰
    // 初始平近点角 0-360°
    const m0 = Math.random() * Math.PI * 2;
    aArr[i] = sma;
    eArr[i] = e;
    oArr[i] = om;
    iArr[i] = inc;
    mArr[i] = m0;
  }
  geo.setAttribute('aParam', new THREE.BufferAttribute(aArr, 1));
  geo.setAttribute('eParam', new THREE.BufferAttribute(eArr, 1));
  geo.setAttribute('oParam', new THREE.BufferAttribute(oArr, 1));
  geo.setAttribute('iParam', new THREE.BufferAttribute(iArr, 1));
  geo.setAttribute('mParam', new THREE.BufferAttribute(mArr, 1));

  // 位置 attribute — 每帧重写
  const posArr = new Float32Array(ASTEROID_COUNT * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

  // 程序化小行星点贴图 — 跟 planet dot 同款径向渐变
  const size = 32;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.PointsMaterial({
    map: tex,
    color: 0xb8a890,         // 灰棕小行星色
    size: 1.5,               // 世界单位
    sizeAttenuation: true,   // 随距离缩小
    transparent: true,
    opacity: 0.7,            // 固定 (v20260708 修复, 见 updateAsteroidBelt 注释)
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const points = new THREE.Points(geo, mat);
  points.userData.isAsteroidBelt = true;
  points.userData.distScale = distScale;
  return points;
}

/* 更新小行星位置 (main.js tick 调用)
 * elapsedDays: 模拟时间(天)
 * — 主带平均周期 ~3-5 年 (1100-1800 天), 角速度 = 2π/period
 * — 用 M≈θ 简化(小行星精度需求低, 视觉上够)
 * — 简化开普勒第三定律 T² ∝ a³ → T = 365.25 * a^1.5 (年转天, a 是 AU)
 *   a=2.7 AU → T ≈ 1610 天
 *
 * v20260708 修复: 删掉 camDist + LOD 渐变
 *   — 远档 opacity 0.15 反而因为 α 累积看着是实心带, 近档反而稀
 *   — 真实小行星带远看是带(自然累积), 近看是几个稀疏石头
 *   — 不再 per-frame 调 opacity, 节省 2000 顶点遍历外的额外判断
 */
export function updateAsteroidBelt(points, elapsedDays) {
  if (!points) return;
  const geo = points.geometry;
  const posAttr = geo.getAttribute('position');
  const aAttr = geo.getAttribute('aParam');
  const eAttr = geo.getAttribute('eParam');
  const oAttr = geo.getAttribute('oParam');
  const iAttr = geo.getAttribute('iParam');
  const mAttr = geo.getAttribute('mParam');
  const ds = points.userData.distScale;
  const N = posAttr.count;
  for (let i = 0; i < N; i++) {
    const a = aAttr.array[i] * ds;        // 世界单位
    const e = eAttr.array[i];
    const om = oAttr.array[i];            // 弧度
    const inc = iAttr.array[i];
    const m0 = mAttr.array[i];
    // 周期 (天) — 简化开普勒第三定律
    const aAU = a / ds;
    const periodDays = 365.25 * Math.pow(aAU, 1.5);
    const w = (Math.PI * 2) / periodDays;
    const theta = m0 + elapsedDays * w;  // 真近点角近似
    const r = a * (1 - e*e) / (1 + e * Math.cos(theta));
    const xEll = r * Math.cos(theta);
    const yEll = r * Math.sin(theta);
    // 旋 ω 到世界坐标
    const cosO = Math.cos(om), sinO = Math.sin(om);
    const wx = xEll * cosO - yEll * sinO;
    const wz = xEll * sinO + yEll * cosO;
    // 倾角: y 分量 (简化 — 倾角小, 视觉差异不大)
    const wy = yEll * Math.sin(inc);
    posAttr.setXYZ(i, wx, wy, wz);
  }
  posAttr.needsUpdate = true;

  // LOD 移除 (v20260708 修复):
  //   远档 opacity 0.15 + 近档 opacity 0.6 的设计反了 —
  //   远观: 2000 颗点挤在小角度区域, α 累积 ≈ 0.96 看着像实心带
  //   近观: 视锥只覆盖 10-30 颗, 累积失效看着稀疏
  //   真实小行星带: 远看是带(自然累积), 近看是几个稀疏石头
  //   — 删 LOD 渐变, 固定 opacity 0.7
  //   — 近观时靠 sizeAttenuation 让单点变大, 远观时靠数量累积成带
  // 保留 LOD 函数位置但不再调用, 防止回归
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
 *
 * v20260711: 加 LOD 迟滞窗口（避免高速时间下 planet 在阈值边界来回切换导致视觉抖动）
 *   — default LOD 切换是“距 > threshold 立即切远档、距 < threshold 立即切近档”
 *   — 在轨道上 instant jump 时相机本身不动，但 when 相机在阈值边界附近，进/出带状区域会出现"咯瞪"跳变
 *   — 加 8% 的迟滞：进入远档的条件是 camDist > threshold×1.08；返航近档的条件是 camDist < threshold×0.92
 *   — 进入阈值后切换状态，给下一帧 tick 查到
 */
const _lodHysteresisUp   = 1.08;   // camDist > threshold * up   → 切到远档 sprite dot
const _lodHysteresisDown = 0.92;   // camDist < threshold * down → 切到近档 mesh
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
  lod.userData.lodThreshold = threshold;
  lod.userData.lodHysteresisUp   = _lodHysteresisUp;
  lod.userData.lodHysteresisDown = _lodHysteresisDown;
  return lod;
}

/* v20260711: 带迟滞的 LOD update — 取代 o.lod.update(camera)
 *   — 以“上一次在近档吗”为状态机，距离跨越 up 阈值才切远档，跨越 down 阈值才切近档
 *   — main.js tick 里调用本函数代替 lod.update(camera)
 *   — 减少高速公转下 LOD 抽动
 */
export function tickPlanetLODWithHysteresis(lod, camera) {
  if (!lod || !lod.userData?.isPlanetLOD) {
    lod.update(camera);
    return;
  }
  const t = lod.userData.lodThreshold;
  const up = lod.userData.lodHysteresisUp;
  const down = lod.userData.lodHysteresisDown;
  const isNear = !lod.userData.lodIsFar;  // 初始默认近档 (level 0 = mesh)
  // 距 LOD 节点的距离
  lod.getWorldPosition(_lodTmpVec);
  const camDist = camera.position.distanceTo(_lodTmpVec);
  if (isNear) {
    if (camDist > t * up) {
      lod.userData.lodIsFar = true;
      lod.levels[1].object.visible = true;   // 远档 sprite dot
      lod.levels[0].object.visible = false;  // 近档 mesh
    }
  } else {
    if (camDist < t * down) {
      lod.userData.lodIsFar = false;
      lod.levels[1].object.visible = false;  // 远档 sprite dot
      lod.levels[0].object.visible = true;   // 近档 mesh
    }
  }
}
const _lodTmpVec = new THREE.Vector3();

/* ===== 太阳 ===== */
export async function makeSun(scene, camera, renderer) {
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

  // v20260711: 删 3D label — 不再给 sun 加文字标签
  // — 行星/Sun 名称通过图例 (BODIES panel) + 信息面板显示
  // — 此前 sun label 单独 add 到 scene（不放进 sun mesh 子节点树）的逻辑也移除
  /* v20260707 v5: 远日轨道占位亮星 (LOD + 屏幕固定 60px via 距离反推)
     *  - 内行星带 + 火星以内 (D < 4000u) 不渲染
     *  - 火星→木星 (4000-13000u) 渐入
     *  - 木星及之外 (D > 13000u) 满显
     *  - scale 每帧根据 cameraDistance + camera.fov + canvasH 反推
     *  - 任何距离下屏幕都是 60px, 既不糊屏也不消失
     */
    const distantGlow = await makeDistantGlow(SUN_R, camera, renderer);
        scene.add(distantGlow.sprite);
        mesh.userData.distantGlow = distantGlow;

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

  // v20260711: 删 3D label — addLabel 函数已移除, 不再调用
  return { pivot, mesh, data:p, lod };
}

/* ===== 月球 (v20260708-B3: ShaderMaterial 方案) =====
 * 改用 ShaderMaterial, 完全自己控制 vertex/fragment
 * - 顶点: 算 worldPos + normal, 写到 varying
 * - 片段: TEST 阶段直接红色, 验证 shader 跑
 * 复用: 任何卫星挂同款, tick 传 parent world position
 */
export async function makeMoon() {
  const tex = await safeTexture(MOON.texture, 'moon', onLoaderTick);
  const geo = new THREE.SphereGeometry(MOON.size, 32, 32);

  // uniforms 先建, mat.userData 引用它
  const eclipseUniforms = {
    uSunPos:   { value: new THREE.Vector3(0, 0, 0) },
    uEarthPos: { value: new THREE.Vector3() },
    uEarthR:   { value: 1.0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTex:      { value: tex },
      uSunPos:   eclipseUniforms.uSunPos,
      uEarthPos: eclipseUniforms.uEarthPos,
      uEarthR:   eclipseUniforms.uEarthR,
      uAmbient:  { value: 0.15 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        // v20260708: 用 mat3(modelMatrix) 算 world-space normal
        //   之前用 normalMatrix (view-space), 跟 sunDir 不在同空间 → Lambert 错
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform vec3 uSunPos;
      uniform vec3 uEarthPos;
      uniform float uEarthR;
      uniform float uAmbient;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      void main() {
        // 1. 采样月球纹理
        vec3 albedo = texture2D(uTex, vUv).rgb;

        // 2. 简单 Lambert 光照 (太阳是平行光, 在原点)
        //   太阳方向 = 从月球指向太阳 (uSunPos - vWorldPos) 然后归一化
        vec3 lightDir = normalize(uSunPos - vWorldPos);
        // v20260708: 用 vWorldNormal (跟 lightDir 都在 world space)
        vec3 N = normalize(vWorldNormal);
        float NdotL = max(dot(N, lightDir), 0.0);

        // 3. 月球本影/半影计算 (B2 公式, 现在确定在跑)
        //   axisDir = 太阳→地球 方向 (月食要背向太阳那一侧)
        vec3 axisDir = normalize(uEarthPos - uSunPos);
        //   月球到地球向量
        vec3 moonFromEarth = vWorldPos - uEarthPos;
        //   月球沿 sun-earth 轴的投影距离 (正=在地球背面=本影侧)
        float projDist = dot(moonFromEarth, axisDir);
        //   月球到轴的垂直距离
        vec3 perpVec = moonFromEarth - projDist * axisDir;
        float perpDist = length(perpVec);
        //   本影截面半径 = 地球半径 (月球远, 本影锥近似不变)
        float umbraR = uEarthR * 1.0;
        //   本影因子: perpDist < umbraR → 1.0, perpDist > umbraR*1.5 → 0.0
        float umbraFactor = 1.0 - smoothstep(umbraR * 0.8, umbraR * 1.5, perpDist);
        //   限制只在 projDist > 0 (月球在地球背面=本影侧) 时才生效
        umbraFactor *= step(0.0, projDist);
        //   半影因子: 本影外渐变
        float penumbraFactor = 1.0 - smoothstep(umbraR * 1.5, umbraR * 2.5, perpDist);
        penumbraFactor *= step(0.0, projDist);
        penumbraFactor *= (1.0 - umbraFactor);

        // 4. 光照 (Lambert + ambient)
        //   本影区: 光照被遮挡 → 极暗 (0.04 亮度, 只剩 ambient)
        //   半影区: 光照减半
        //   正常区: 标准 Lambert + ambient
        // v20260708: 用户原话"变红其实不对, 只保留黑白变化" — 去掉色调, 只调亮度
        float lightMult = NdotL * (1.0 - umbraFactor) * (1.0 - penumbraFactor * 0.5);
        lightMult += uAmbient;
        // 本影区压暗到 0.04 (几乎黑, 模拟地球本影完全挡光)
        lightMult *= mix(1.0, 0.04, umbraFactor);
        vec3 finalColor = albedo * lightMult;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });

  // 让 main.js tick 能找到 uniforms
  mat.userData.eclipseUniforms = eclipseUniforms;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { isPlanet:true, data:MOON, name:MOON.name, en:MOON.en, typeZh:MOON.typeZh, typeEn:MOON.typeEn };

  const pivot = new THREE.Object3D();
  pivot.add(mesh);
  mesh.position.set(MOON.distance, 0, 0);

  // v20260711: 月球椭圆轨道 line — 渲染在 moon pivot 同级, 即作为 earth.pivot 的子节点
  // — 用 MOON.distance × (1 - eccentricity²) / (1 + eccentricity·cos θ) 公式, 沿 0° 黄道倾角
  // — 5.145° 倾角 (月轨相对黄道) 通过把这条 line 加到一个独立的 Object3D (orbitTilt) 下, 让 orbitTilt 旋转 5.145°
  // — 月球 mesh 月相/位置由主循环单独更新 (radius / 旋转), 这里只画静态椭圆 line
  const orbitTilt = new THREE.Object3D();
  orbitTilt.rotation.x = THREE.MathUtils.degToRad(5.145);
  const moonE = MOON.eccentricity || 0;
  const moonA = MOON.distance;
  const moonSeg = 128;  // 月球轨道小, 半径 8u, 128 段弦长差 ≈ 8*(2π/128)³/24 ≈ 1e-3u
  const moonPts = [];
  for (let i = 0; i <= moonSeg; i++) {
    const th = (i / moonSeg) * Math.PI * 2;
    const r = moonA * (1 - moonE * moonE) / (1 + moonE * Math.cos(th));
    moonPts.push(new THREE.Vector3(r * Math.cos(th), 0, r * Math.sin(th)));
  }
  const moonOrbitGeo = new THREE.BufferGeometry().setFromPoints(moonPts);
  // 月球轨道色 = earth.orbitColor (0x48a9ff), 但更淡一点 (opacity 0.4)
  const moonOrbitMat = new THREE.LineBasicMaterial({ color: 0x48a9ff, transparent: true, opacity: 0.4 });
  const moonOrbit = new THREE.LineLoop(moonOrbitGeo, moonOrbitMat);
  moonOrbit.userData.isOrbit = true;
  orbitTilt.add(moonOrbit);
  // — 把 orbitTilt 暴露给 main.js, 让 main.js 在 moon pivot 挂到 earth.pivot 后, 同样的 orbitTilt 也挂到 earth.pivot
  return { pivot, mesh, data:MOON, moonOrbitTilt: orbitTilt };
}
