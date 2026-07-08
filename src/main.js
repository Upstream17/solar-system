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

// 1× 真实世界 1 day/sec (v20260708 改动)
//   — 1× = 1 day/sec: 地球年 365 sec = 6 min 5 sec
//   — 100× = 100 day/sec: 地球年 3.65 sec
//   — 旧值 5 day/sec 偏快, 改成 1 让"1×"=真实世界速率
const SIM_DAYS_PER_SEC = 1;
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
      planetObjs[2].mesh.add(moonObj.pivot);
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
        moon.pivot.rotation.y = elapsedDays * wm;
        moon.mesh.rotation.y += deltaSim * 0.01;
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