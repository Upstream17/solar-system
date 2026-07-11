/* main.js — 入口 + 初始化 + 主循环 */

import * as THREE from 'three';
import * as Loader from './loader.js';
import { initScene, updateStarsTime, updateStarPositions } from './scene.js';
import { initLighting } from './lighting.js';
import { makeSun, makePlanet, makeMoon, makeOrbit, makeAsteroidBelt, updateAsteroidBelt } from './planets.js';
import { scaleScene, getDisplayDistance } from './scale.js';
import { initTracking, tickCameraAnim, tickTracking } from './tracking.v2.js';
import {
  initSliders, initToggles, bindStarsToggle,
  initInfoPanel, initLegend, initTrackingStopButton, initSceneClick,
  initFloatingTools,
  getSpeedFactor, initCollapse
} from './ui.js';
import { initI18n } from './i18n.js';
import { PLANETS, SUN_R, MOON, DIST_SCALE } from './constants.js';

// 进入页面立刻显示 loader overlay（在 JS bundle 完成前）
Loader.show();

// 1× 真实世界 1 hour/sec (v20260708 改动, C 方案)
//   — 1 sec = 1 hour = 1/24 day
//   — SIM_DAYS_PER_SEC = 1/24 (小时转天)
//   — 地球自转 1 圈 = 24 sec (看昼夜/云层)
//   — 地球公转 1 圈 = 4 小时 8 分 (看公转要 100× 加速, 2.5 分钟看完)
//   — 木星自转 1 圈 = 9.84 sec (看大红斑)
//   — 月球公转 = 10 分 54 秒
//   — 海王星公转 = 33 天
//   — 旧值 1 day/sec 自转/公转比例虽对, 但 1× 体感太闪 (自转 1 秒=昼夜闪烁)
//   — C 方案折中: 1× 自转能看, 100× 公转能看, 海王星仍 33 天
const SIM_DAYS_PER_SEC = 1 / 24;
let elapsedDays = 0;

/* 入口 */
async function init() {
  try {
// 1. 场景
    const { scene, camera, renderer, controls, stars, composer, bloomPass, setSunMesh, setGodRaysEnabled } = initScene();
    window.__scene = scene;
    window.__camera = camera;
    window.__renderer = renderer;
    window.__bloomPass = bloomPass;
    window.__setGodRaysEnabled = setGodRaysEnabled;  // ui.js 用

    // 2. 光照
    const { sunLight } = initLighting(scene);
    window.__sunLight = sunLight;

    // 3. 太阳（辉光 Sprite 内部生成）
    const sun = await makeSun(scene, camera, renderer);
    window.__sun = sun;
    // 3.1 把 sun mesh 注入 GodRaysEffect（后处理链）
    // — GodRaysEffect 需要 sun mesh 作为 lightSource，从 sun 屏幕坐标辐射光线
    setSunMesh(sun);

    // 4. 行星
    const planetObjs = [];
    for (const p of PLANETS) {
      try {
        const obj = await makePlanet(scene, p);
        planetObjs.push(obj);
      } catch (e) { console.error('planet failed:', p.name, e); }
    }
    window.__planets = planetObjs;

    // 5. 月球
    let moonObj;
    try {
      moonObj = await makeMoon();
      // v20260708-B2-fix: 月球挂到 planetObjs[2].pivot (不是 mesh)
      //   - mesh 有 tilt.rotation.z = 23.44° (地球自转轴倾角), 月球继承后会偏出黄道面
      //   - 偏出 ≈ 8 * sin(23.44°) = 3.18 单位, 比本影截面 (1.0) 大很多 → 月球永远不进本影
      //   - pivot 没有 tilt, 月球绕黄道面内的圆周转 → perpDist 能到 0 → 月食发生
      planetObjs[2].pivot.add(moonObj.pivot);
      // v20260708: 月球轨道 5° 倾角 (绕 x 轴倾斜 — 让月球相对黄道面有倾角)
      // 真实月球轨道相对黄道倾角 5.14°
      // 月球轨道半径 8 × sin(5°) ≈ 0.70 单位 < 本影半径 1.0 → 月球仍能进本影
      // v20260708: 月球轨道倾角 5.145° (NASA 真实值, 月球相对黄道面倾角)
      moonObj.pivot.rotation.x = THREE.MathUtils.degToRad(5.145);
    } catch (e) { console.error('moon failed:', e); }
    window.__moon = moonObj;

    // 5.5 小行星带 (v20260708) — 2000 颗 Points, 火星-木星之间
    //   — 放在月亮之后, 行星 tick 之前 (跟 planets 平级, scene 顶层)
    //   — 自己的 LOD tick, 不影响行星 LOD
    const asteroidBelt = makeAsteroidBelt(DIST_SCALE);
    scene.add(asteroidBelt);
    window.__asteroidBelt = asteroidBelt;

    // 6. 太阳轨道环
    // — 之前加了 makeOrbit(SUN_R * 1.05) 作为"中心锚点"提示
    // — 但 SUN_R=12 时这个 12.6u 的环跟水星轨道 d=31.2 距离过近
    // — 远观时看起来像"幽灵轨道"（不锚定任何天体）
    // — godrays 已经提供中心辐射感，不需要这个环做视觉提示
    // — 删除：scene.add(makeOrbit(SUN_R * 1.05));

    // 7. 缩放初始化
    scaleScene(scene, camera, controls);

    // 8. i18n 必须在所有 UI 初始化之前 — 字典 + 按钮 + 首帧应用
    initI18n();

    // 9. UI
    initSliders(sunLight);
    initToggles(scene, camera, controls);
    bindStarsToggle(stars);
    initInfoPanel();
    initTracking(camera, controls, renderer);
    initTrackingStopButton();
    initCollapse();   // 折叠面板初始化（必须在 UI 元素都加载完后）

    // 10. 点击交互
    const allClickable = [];
    function rebuildClickableList() {
      allClickable.length = 0;
      allClickable.push(sun);
      planetObjs.forEach(o=>allClickable.push(o.mesh));
      if (moonObj) allClickable.push(moonObj.mesh);
    }
    rebuildClickableList();
    initSceneClick(renderer, camera, () => allClickable);

    // 11. 图例
    initLegend();

    // 12. 浮动工具按钮（GitHub + 背景音乐）
    initFloatingTools();

    // 13. resize
    addEventListener('resize', ()=>{
      camera.aspect = innerWidth/innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);  // composer 也要同步
    });

    // 14. 主循环
    const clock = new THREE.Clock();
    function tick() {
      // deltaReal: 真实经过时间（相机动画、星空旋转用这个，跟 speedFactor 无关）
      // deltaSim:  模拟时间（受 speedFactor 影响，用于天体力学）
      const deltaReal = clock.getDelta();
      const deltaSim  = deltaReal * getSpeedFactor();
      elapsedDays += deltaSim * SIM_DAYS_PER_SEC;

      // 行星公转 + 自转
      if (window.__planets) {
        window.__planets.forEach(o=>{
          const p = o.data;
          // v20260708: 椭圆公转
          //   — semiMajor = p.distance × DIST_SCALE (世界单位)
          //   — e = p.eccentricity (从 PLANETS 读)
          //   — ω = p.perihelion × π/180 (从 PLANETS 读)
          //   — 平近点角 M = elapsedDays × w (w = 2π / p.orbit, orbit 是地球日)
          //   — 用 M≈θ 简化(精度足够视觉, 避免开普勒迭代)
          //   — r(θ) = a(1-e²) / (1 + e·cos(θ))
          const w = (Math.PI*2) / p.orbit;
          const theta = elapsedDays * w;  // 真近点角近似
          const a = getDisplayDistance(p);
          const e = p.eccentricity || 0;
          const omega = (p.perihelion || 0) * Math.PI / 180;
          const r = a * (1 - e*e) / (1 + e * Math.cos(theta));
          const xEll = r * Math.cos(theta);
          const yEll = r * Math.sin(theta);
          // 旋 ω 到世界坐标
          const cosO = Math.cos(omega), sinO = Math.sin(omega);
          const wx = xEll * cosO - yEll * sinO;
          const wz = xEll * sinO + yEll * cosO;
          o.pivot.position.set(wx, 0, wz);
          // 自转
          const ws = (Math.PI*2) / (p.rotation || 1);
          o.mesh.rotation.y += deltaSim * SIM_DAYS_PER_SEC * ws * 0.02;
          // 地球云层反向旋转（西风效应，制造大气流动感）
          if (o.mesh.userData.cloudsMesh) {
            o.mesh.userData.cloudsMesh.rotation.y -= deltaSim * SIM_DAYS_PER_SEC * ws * 0.025;
          }
        });
        // v20260707 v3: label 屏幕像素尺寸固定 (8~24 px) + LOD 远档小点屏幕 24px
        // 关键: 验证 SpriteMaterial + CanvasTexture 在 pmndrs composer 下能正常渲染
        // 公式: 屏幕 px = (scale.y / camDist) * (canvasH / 2 / tan(fov/2))
        //   → scale.y = targetPx * camDist * 2 * tan(fov/2) / canvasH
        if (camera && window.__renderer) {
          const _v = new (camera.position.constructor)();
          const _fovRad = camera.fov * Math.PI / 180;
          const _canvasH = window.__renderer.domElement.height;
          const _halfWorldPerPx = (2 * Math.tan(_fovRad / 2)) / _canvasH;
          // 遍历所有 isLabel 标记的 mesh (子节点 + scene 顶层 sun label)
          const _allLabels = [];
          window.__planets.forEach(o => {
            // LOD 内部 mesh 的 children (label) 才能被找到
            o.lod && o.lod.traverse(c => { if (c.userData && c.userData.isLabel) _allLabels.push({label: c, parent: o.data}); });
          });
          if (window.__sun) {
            window.__sun.traverse(c => { if (c.userData && c.userData.isLabel) _allLabels.push({label: c, parent: null}); });
          }
          _allLabels.forEach(({label, parent}) => {
            label.getWorldPosition(_v);
            const camDist = camera.position.distanceTo(_v);
            const base = parent ? parent.realSize : 12.0;
            const minPx = 8;
            const maxPx = 24 * Math.max(1, base);
            const refDist = base * 50;
            const t = Math.max(0, Math.min(1, camDist / refDist));
            const targetPx = maxPx + (minPx - maxPx) * t;
            // canvas 256x64 (4:1), sprite 4:1 宽高比
            const sH = targetPx * camDist * _halfWorldPerPx;
            label.scale.set(sH * 4, sH, 1);
          });
          // LOD update: 每帧检查每个行星距相机距离, 决定 mesh 还是 dot
          // 同时给远档 dot 算屏幕 4px scale (小于太阳视觉 5.5px, 符合"远观小亮点")
          window.__planets.forEach(o => {
            if (!o.lod) return;
            o.lod.update(camera);
            o.lod.levels.forEach(entry => {
              if (entry.object.isSprite && entry.object !== o.mesh) {
                o.lod.getWorldPosition(_v);
                const camDist = camera.position.distanceTo(_v);
                const sPx = 4;  // 屏幕 4px (默认相机下太阳视觉约 5.5px, dot 应更小)
                const s = sPx * camDist * _halfWorldPerPx;
                entry.object.scale.set(s, s, 1);
              }
            });
          });
        }
      }

      // 月球
      const moon = window.__moon;
      if (moon && window.__planets) {
      const wm = (Math.PI*2) / MOON.orbit;
      const moonTheta = elapsedDays * wm;  // 月球轨道平近点角
      moon.pivot.rotation.y = moonTheta;
      // v20260708: 月球椭圆轨道 (eccentricity = 0.0549)
      //   r = a(1-e²) / (1 + e·cos(theta))
      //   a = MOON.distance = 8, e = 0.0549
      //   r ∈ [7.56, 8.44] — 真实月球近地点/远地点比
      const _moonE = MOON.eccentricity || 0;
      if (_moonE > 0) {
        const _moonA = MOON.distance;
        const _moonR = _moonA * (1 - _moonE * _moonE) / (1 + _moonE * Math.cos(moonTheta));
        moon.mesh.position.set(_moonR, 0, 0);
      }
      moon.mesh.rotation.y += deltaSim * 0.01;

      // v20260708-B2: 月食 shader uniforms 更新
      //   — 地球世界位置每帧重算 (公转 + LOD 切档会改 transform)
      //   — uniforms 写在 material.userData.eclipseUniforms 里 (planets.js L527)
      //   — 只有月球进了地球本影才会触发 shader 内的本影计算
      if (moon.mesh.material.userData.eclipseUniforms) {
      const u = moon.mesh.material.userData.eclipseUniforms;
      window.__planets[2].lod.getWorldPosition(u.uEarthPos.value);
      u.uEarthR.value = 1.0;

      // v20260708-B3: debug log 仅在月食时输出 (umbraFactor > 0.1), 每 2 秒一次
      if (!window.__eclipseDebugFrame) window.__eclipseDebugFrame = 0;
      window.__eclipseDebugFrame++;
        const moonWP = new THREE.Vector3();
        moon.mesh.getWorldPosition(moonWP);
        const earthWP = u.uEarthPos.value;
        const _ax = earthWP.x, _ay = earthWP.y, _az = earthWP.z;
        const _aLen = Math.sqrt(_ax*_ax + _ay*_ay + _az*_az) || 1;
        const _dx = _ax/_aLen, _dy = _ay/_aLen, _dz = _az/_aLen;
        const _mx = moonWP.x - earthWP.x;
        const _my = moonWP.y - earthWP.y;
        const _mz = moonWP.z - earthWP.z;
        const _proj = _mx*_dx + _my*_dy + _mz*_dz;
        const _px = _mx - _proj*_dx;
        const _py = _my - _proj*_dy;
        const _pz = _mz - _proj*_dz;
        const perpDist = Math.sqrt(_px*_px + _py*_py + _pz*_pz);
        const umbraR = u.uEarthR.value;
        const umbraFactor = Math.max(0, Math.min(1,
          1 - Math.max(0, Math.min(1, (perpDist - umbraR*0.8) / (umbraR*1.5 - umbraR*0.8)))
        ));
        if (umbraFactor > 0.1 && window.__eclipseDebugFrame % 120 === 0) {
        console.log('[ECLIPSE]', JSON.stringify({
          elapsedDays: elapsedDays.toFixed(2),
          moonWP: [moonWP.x.toFixed(1), moonWP.y.toFixed(1), moonWP.z.toFixed(1)],
          earthWP: [earthWP.x.toFixed(1), earthWP.y.toFixed(1), earthWP.z.toFixed(1)],
          projDist: _proj.toFixed(2),
          perpDist: perpDist.toFixed(3),
          umbraR: umbraR.toFixed(2),
          umbraFactor: umbraFactor.toFixed(3),
          hint: _proj > 0 ? 'moon-on-shadow-side' : 'moon-on-sun-side'
        }));}
      }
    }
      // 小行星带 tick (v20260708)
      //   — 位置每帧重算 (跟行星 tick 一致, 公转周期 ~3-5 年)
      //   — LOD 渐变已移除 (v20260708 修复, 见 planets.js 注释)
      if (window.__asteroidBelt) {
        updateAsteroidBelt(window.__asteroidBelt, elapsedDays);
      }

      // 太阳自转
      if (window.__sun) window.__sun.rotation.y += deltaSim * 0.05;

      // 星空旋转（用 deltaReal，不跟 speedFactor）
      stars.rotation.y += deltaReal * 0.0008;
      // 星空闪烁 uTime（用 deltaReal，不跟 speedFactor）
      updateStarsTime(deltaReal);
      // 星空位置跟随相机（让相机移到海王星时背向太阳方向也能看到星星）
      updateStarPositions(camera);

      // 太阳辉光：按相机距离分级 + 平滑过渡
      // （每帧调用 update() 重新计算 4 层 sprite 的 opacity/scale，并淡出 sun 本体）
      const sun = window.__sun;
      if (sun && sun.userData.glowUpdate) {
        const camDist = camera.position.length();
        sun.userData.glowUpdate(camDist, sun);
      }

      // v20260707 v4: 远日轨道占位亮星 LOD (火星-木星之间开始渲染)
      if (sun && sun.userData.distantGlow) {
        const camDist = camera.position.length();
        sun.userData.distantGlow.update(camDist);
      }

      // 相机动画 + 追踪
      tickCameraAnim(deltaReal);
      tickTracking();

      controls.update();
            composer.render(deltaReal);  // pmndrs EffectComposer 需要传 deltaTime
            requestAnimationFrame(tick);
    }
    tick();

    Loader.hide();

    console.log('%c🌌 太阳系 3D 探索器已就绪','color:#9bd0ff;font-size:14px;font-weight:bold');
  } catch (e) {
    console.error('[INIT ERROR]', e);
    document.body.insertAdjacentHTML('afterbegin',
      `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#f55;font-family:monospace;background:#000a;padding:20px;border-radius:8px;z-index:9999;">
        初始化失败: ${e.message}<br>请按 F12 查看 Console
      </div>`);
  }
}

init();