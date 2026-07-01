/* main.js — 入口 + 初始化 + 主循环 */

import * as THREE from 'three';
import { initScene } from './scene.js';
import { initLighting } from './lighting.js';
import { makeSun, makePlanet, makeMoon, makeOrbit } from './planets.js';
import { scaleScene } from './scale.js';
import { initTracking, tickCameraAnim, tickTracking } from './tracking.js';
import {
  initSliders, initToggles, bindStarsToggle,
  initInfoPanel, initLegend, initTrackingStopButton, initSceneClick,
  getSpeedFactor
} from './ui.js';
import { PLANETS, SUN_DEMO, MOON } from './constants.js';
import { getDisplayDistance } from './scale.js';

const SIM_DAYS_PER_SEC = 5;
let elapsedDays = 0;

/* 入口 */
async function init() {
  try {
    // 1. 场景
    const { scene, camera, renderer, controls, stars } = initScene();

    // 2. 光照
    const { sunLight } = initLighting(scene);

    // 3. 太阳
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

    // 6. 太阳轨道环（艺术装饰）
    scene.add(makeOrbit(SUN_DEMO*1.5));

    // 7. 缩放初始化
    scaleScene(scene, camera, controls);

    // 8. UI
    initSliders(sunLight);
    initToggles(scene, camera, controls);
    bindStarsToggle(stars);
    initInfoPanel();
    initTracking(camera, controls);
    initTrackingStopButton();

    // 9. 点击交互（行星列表）
    const allClickable = [];
    function rebuildClickableList() {
      allClickable.length = 0;
      allClickable.push(sun);
      planetObjs.forEach(o=>allClickable.push(o.mesh));
      if (moonObj) allClickable.push(moonObj.mesh);
    }
    rebuildClickableList();
    initSceneClick(renderer, camera, () => allClickable);

    // 10. 图例
    initLegend();

    // 11. resize
    addEventListener('resize', ()=>{
      camera.aspect = innerWidth/innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });

    // 12. 主循环
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

      // 相机动画 + 追踪
      tickCameraAnim(deltaReal);
      tickTracking();

      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    tick();

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