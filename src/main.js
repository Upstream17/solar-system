/* main.js — 入口 + 初始化 + 主循环 */

import * as THREE from 'three';
import * as Loader from './loader.js';
import { initScene, updateStarsTime, updateStarPositions } from './scene.js';
import { initLighting } from './lighting.js';
import { makeSun, makePlanet, makeMoon, makeAsteroidBelt, updateAsteroidBelt, getOrbitPosition, tickPlanetLODWithHysteresis } from './planets.js';
import { scaleScene, getDisplayDistance } from './scale.js';
import { initTracking, tickCameraAnim, tickTracking } from './tracking.v2.js';
import {
  initSliders, initToggles, bindStarsToggle,
  initInfoPanel, initLegend, initTrackingStopButton, initSceneClick,
  initFloatingTools,
  getSpeedFactor, initCollapse
} from './ui.js';
import { initI18n } from './i18n.js';
import { PLANETS, SUN_R, MOON, MOONS, DIST_SCALE } from './constants.js';

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

        // 5. 卫星系统 (v20260712: 扩展到所有行星的主要卫星)
        //   思路:
        //   - 遍历 MOONS[],对每颗调用 makeMoon(moonData) → 返回 { pivot, mesh, data, moonOrbitTilt }
        //   - 找到其母行星 (data.parent 对应的 planetObj),挂到 planetObj.pivot (不是 mesh,免受自转轴倾角影响)
        //   - 收集到 __allMoons[] 供 legend / click / tick 使用
        const allMoons = [];
        // 地球月球走 MOON 单例 (它不在 MOONS[] 中,因为 parent='地球' 且 schema 略不同)
        try {
          const moonObj = await makeMoon(MOON);
          const earthIdx = PLANETS.findIndex(p => p.name === '地球');
          if (earthIdx >= 0 && planetObjs[earthIdx]) {
            planetObjs[earthIdx].pivot.add(moonObj.pivot);
            planetObjs[earthIdx].pivot.add(moonObj.moonOrbitTilt);
          }
          // v20260712: 月球轨道倾角由 makeMoon 内部的 pivot.rotation.x 设置 (5.145°)
                // v20260708: 月球轨道倾角 (绕 x 轴倾斜 — 让月球相对黄道面有倾角)
                // moon.pivot.rotation.x = THREE.MathUtils.degToRad(MOON.inclination || 5.145);  // 移到 makeMoon 里
                moonObj.parentPlanet = '地球';
                moonObj.parentIdx = earthIdx;
                allMoons.push(moonObj);
                window.__moon = moonObj;  // backward compat
        } catch (e) { console.error('earth moon failed:', e); }

        // 5.5 其他 19 颗卫星 (火星2 + 木星5 + 土星6 + 天王星5 + 海王星1)
        for (const mData of MOONS) {
          try {
            const moonObj = await makeMoon(mData);
            const parentIdx = PLANETS.findIndex(p => p.name === mData.parent);
            if (parentIdx < 0 || !planetObjs[parentIdx]) {
              console.warn('moon parent not found:', mData.name, '→', mData.parent);
              continue;
            }
            planetObjs[parentIdx].pivot.add(moonObj.pivot);
            planetObjs[parentIdx].pivot.add(moonObj.moonOrbitTilt);
            moonObj.parentPlanet = mData.parent;
            moonObj.parentIdx = parentIdx;
            allMoons.push(moonObj);
          } catch (e) { console.error('moon failed:', mData.name, e); }
        }
        window.__allMoons = allMoons;
        console.log(`[INIT] Loaded ${allMoons.length} moons total (1 earth moon + ${MOONS.length} others)`);

        // 5.6 小行星带 (v20260708) — 2000 颗 Points, 火星-木星之间
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
          // v20260712: 所有卫星 (1 月球 + 19 新) 都可点击
          allMoons.forEach(m=>allClickable.push(m.mesh));
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
          // v20260711: JPL 三维椭圆公转
          //   — semiMajor = p.distance × DIST_SCALE (世界单位)
          //   — e = p.eccentricity (从 PLANETS 读)
          //   — ϖ = p.perihelion, I = p.inclination, Ω = p.ascendingNode (J2000 黄道坐标)
          //   — 平近点角 M = elapsedDays × w (w = 2π / p.orbit, orbit 是地球日)
          //   — 用 M≈θ 简化(精度足够视觉, 避免开普勒迭代)
          //   — r(θ) = a(1-e²) / (1 + e·cos(θ))
          const w = (Math.PI*2) / p.orbit;
          const theta = elapsedDays * w;  // 真近点角近似
          getOrbitPosition(
            getDisplayDistance(p),
            p.eccentricity || 0,
            p.perihelion || 0,
            p.inclination || 0,
            p.ascendingNode || 0,
            theta,
            o.pivot.position
          );
          // 自转
          const ws = (Math.PI*2) / (p.rotation || 1);
          o.mesh.rotation.y += deltaSim * SIM_DAYS_PER_SEC * ws * 0.02;
          // 地球云层反向旋转（西风效应，制造大气流动感）
          if (o.mesh.userData.cloudsMesh) {
            o.mesh.userData.cloudsMesh.rotation.y -= deltaSim * SIM_DAYS_PER_SEC * ws * 0.025;
          }
        });
        // v20260711: 删 3D label — 主循环里不再 compute label scale
        // — 行星名通过图例 (BODIES panel) + 信息面板 (info-panel) 显示
        // — 8 行星/Sun 的 Sprite 文字标签已从 planets.js 移除, 这里不需要 _allLabels 收集
        if (camera && window.__renderer) {
          const _v = new (camera.position.constructor)();
          const _fovRad = camera.fov * Math.PI / 180;
          const _canvasH = window.__renderer.domElement.height;
          const _halfWorldPerPx = (2 * Math.tan(_fovRad / 2)) / _canvasH;
          // LOD 切换: 用迟滞版 (v20260711) — 阈值边界 8% 死区, 减少高速下的视觉抽动
          window.__planets.forEach(o => {
            if (!o.lod) return;
            tickPlanetLODWithHysteresis(o.lod, camera);
            // 远档 dot scale: 只在远档 active 时重算, 避免每秒做 8 次无谓计算
            o.lod.levels.forEach(entry => {
              if (entry.object.isSprite && entry.object !== o.mesh && entry.object.visible) {
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

      // 月球 / 卫星系统 (v20260712: 通用化 — 处理所有 20 颗卫星)
            //   - 每颗有自己的公转周期、偏心率、轨道半径
            //   - 自转 = 公转 (潮汐锁定,除地球月球实际也是)
            //   - shader uniforms 更新: uParentPos/uParentR (母行星位置+半径) → 用于月食/本影计算
            //   - 逆向公转: orbit < 0 → rotation.y -= (轨道角速度用 abs(orbit))
            const moons = window.__allMoons || [];
            const planets = window.__planets || [];
            if (moons.length && planets.length) {
                          // 复用 Vector3 避免每帧 new
                          if (!window.__tmpMoonParentPos) window.__tmpMoonParentPos = new THREE.Vector3();
                          const tmpPP = window.__tmpMoonParentPos;
                          for (let mi = 0; mi < moons.length; mi++) {
                            const moon = moons[mi];
                            const d = moon.data;
                            const parent = planets[moon.parentIdx];
                            if (!parent) continue;

                            // 公转角速度 w = 2π / |orbit| (orbit 负值表示逆向)
                            const absOrbit = Math.abs(d.orbit) || 1;
                            const w = (Math.PI * 2) / absOrbit;
                            const theta = elapsedDays * w;
                            // 逆向: pivotOrbit.rotation.y 减; 顺向: 加
                            const sign = d.orbit < 0 ? -1 : 1;
                            moon.pivotOrbit.rotation.y = sign * theta;

                            // 椭圆轨道: r = a(1-e²)/(1+e·cos(theta))
                            const _e = d.eccentricity || 0;
                            if (_e > 0) {
                              const _a = d.distance;
                              const _r = _a * (1 - _e * _e) / (1 + _e * Math.cos(theta));
                              moon.mesh.position.x = _r;
                            } else {
                              if (moon.mesh.position.x !== d.distance) moon.mesh.position.x = d.distance;
                            }

                            // 自转 (潮汐锁定: 自转周期 = 公转周期)
                            moon.mesh.rotation.y = sign * theta;

                            // shader uniforms 更新 — uParentPos/uParentR 是月食/本影计算关键
                            if (parent.lod) {
                              parent.lod.getWorldPosition(tmpPP);
                            } else if (parent.mesh) {
                              parent.mesh.getWorldPosition(tmpPP);
                            }
                            const mat = moon.mesh.material;
                            if (mat && mat.userData && mat.userData.eclipseUniforms) {
                              const u = mat.userData.eclipseUniforms;
                              u.uParentPos.value.copy(tmpPP);
                              u.uParentR.value = parent.data.realSize || 1.0;
                            }
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