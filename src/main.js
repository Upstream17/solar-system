/* main.js — 入口 + 初始化 + 主循环 */

import * as THREE from 'three';
import * as Loader from './loader.js';
import { initScene, updateStarsTime, updateStarPositions } from './scene.js';
import { initLighting } from './lighting.js';
import { makeSun, makePlanet, makeMoon, makeOrbit } from './planets.js';
import { scaleScene, getDisplayDistance } from './scale.js';
import { initTracking, tickCameraAnim, tickTracking } from './tracking.js';
import {
  initSliders, initToggles, bindStarsToggle,
  initInfoPanel, initLegend, initTrackingStopButton, initSceneClick,
  getSpeedFactor, initCollapse
} from './ui.js';
import { initI18n, t, applyI18n } from './i18n.js';
import { PLANETS, SUN_R, MOON, DIST_SCALE } from './constants.js';

// 进入页面立刻显示 loader overlay（在 JS bundle 完成前）
Loader.show();

const SIM_DAYS_PER_SEC = 5;
let elapsedDays = 0;

/* 入口 */
async function init() {
  try {
    // 1. 场景
    const { scene, camera, renderer, controls, stars, composer, bloomPass } = initScene();
    window.__scene = scene;
    window.__camera = camera;        // 新增：loader 调试 / collapse 用
    window.__renderer = renderer;
    window.__bloomPass = bloomPass;

    // 2. 光照
    const { sunLight } = initLighting(scene);
    window.__sunLight = sunLight;

    // 3. 太阳（辉光 Sprite 内部生成）
    const sun = await makeSun(scene);
    window.__sun = sun;

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

    // 6. 太阳轨道环
    scene.add(makeOrbit(SUN_R * 1.05));

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

    // 12. resize
    addEventListener('resize', ()=>{
      camera.aspect = innerWidth/innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);  // composer 也要同步
    });

    // 13. 主循环
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
          // 距离从 scale 模块获取（会根据演示/真实模式自动调整）
          const w = (Math.PI*2) / p.orbit;
          const ang = elapsedDays * w;
          const dist = getDisplayDistance(p);
          o.pivot.position.set(Math.cos(ang)*dist, 0, Math.sin(ang)*dist);
          const ws = (Math.PI*2) / (p.rotation || 1);
          o.mesh.rotation.y += deltaSim * SIM_DAYS_PER_SEC * ws * 0.02;
          // 地球云层反向旋转（西风效应，制造大气流动感）
          if (o.mesh.userData.cloudsMesh) {
            o.mesh.userData.cloudsMesh.rotation.y -= deltaSim * SIM_DAYS_PER_SEC * ws * 0.025;
          }
        });
      }

      // 月球
      const moon = window.__moon;
      if (moon && window.__planets) {
        const wm = (Math.PI*2) / MOON.orbit;
        moon.pivot.rotation.y = elapsedDays * wm;
        moon.mesh.rotation.y += deltaSim * 0.01;
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

      // 相机动画 + 追踪
      tickCameraAnim(deltaReal);
      tickTracking();

      controls.update();
      composer.render();  // 用后处理 pipeline 渲染（带 bloom）
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