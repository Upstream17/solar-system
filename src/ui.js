/* ui.js — UI 控件 + 交互 */

import * as THREE from 'three';
import { scaleScene } from './scale.js';
import { sunGlowSprites } from './planets.js';
import { startTracking, stopTracking } from './tracking.js';
import { regenerateStars } from './scene.js';
import { setGlowEnabled } from './lighting.js';

const $ = id => document.getElementById(id);

// 时间流速
let speedFactor = 1;
export function getSpeedFactor() { return speedFactor; }

function sliderToSpeed(v) {
  // v 0-100: 0→暂停, 50→1×, 100→100×
  if (v <= 0) return 0;
  if (v <= 50) return v / 50;
  return Math.pow(10, (v - 50) / 25);
}
function formatSpeed(s) {
  if (s === 0) return '⏸ 暂停';
  if (s < 0.1) return s.toFixed(2) + '×';
  if (s < 1) return s.toFixed(1) + '×';
  if (s < 10) return s.toFixed(1) + '×';
  return Math.round(s) + '×';
}

export function initSliders(sunLight) {
  const speedSlider = $('speed-slider');
  const speedLabel = $('speed-label');
  function applySpeed() {
    speedFactor = sliderToSpeed(+speedSlider.value);
    speedLabel.textContent = formatSpeed(speedFactor);
  }
  speedSlider.addEventListener('input', applySpeed);
  applySpeed();

  const brightnessSlider = $('brightness-slider');
  const brightnessLabel = $('brightness-label');
  function applyBrightness() {
    const v = +brightnessSlider.value;
    sunLight.intensity = v;
    brightnessLabel.textContent = v.toFixed(1);
  }
  brightnessSlider.addEventListener('input', applyBrightness);
  applyBrightness();
}

/* 显示开关 */
export function initToggles(scene, camera, controls) {
  const toggleOrbits   = $('toggle-orbits');
  const toggleLabels   = $('toggle-labels');
  const toggleBloom    = $('toggle-bloom');

  toggleOrbits.addEventListener('change', ()=>{
    scene.traverse(o=>{ if (o.userData?.isOrbit) o.visible = toggleOrbits.checked; });
  });
  toggleLabels.addEventListener('change', ()=>{
    scene.traverse(o=>{ if (o.userData?.isLabel) o.visible = toggleLabels.checked; });
  });

  // 辉光开关：调用 lighting.js 的 setGlowEnabled() 设置全局标志
  // — 由主循环 glowUpdate() 每帧检查这个标志，避免 per-frame 覆盖 visible
  // — 关闭时：所有 sprite 不可见，sun mesh 完全不透明（无光晕，纯纹理）
  // — 开启时：4 层 sprite 按距离平滑显示，sun mesh 适度淡出
  const BLOOM_ON = 0.4, BLOOM_OFF = 0.0;
  toggleBloom.addEventListener('change', ()=>{
    const enabled = toggleBloom.checked;
    // 联动 bloomPass（仅做中心提亮，强度很弱）
    const pass = window.__bloomPass;
    if (pass) pass.strength = enabled ? BLOOM_ON : BLOOM_OFF;
    // 设置全局标志 — 主循环 glowUpdate() 会检查这个标志
    setGlowEnabled(enabled);
    // 兼容：直接同步所有 sprite 的 visible（用户切换瞬间立即生效，不必等下一帧）
    sunGlowSprites.forEach(s => { s.visible = enabled; });
  });

  // 地球云层开关：遍历所有行星，找到 userData.cloudsMesh 的那个切换 visible
  const toggleClouds = $('toggle-clouds');
  toggleClouds.addEventListener('change', () => {
    const planets = window.__planets || [];
    planets.forEach(o => {
      if (o.mesh?.userData?.cloudsMesh) {
        o.mesh.userData.cloudsMesh.visible = toggleClouds.checked;
      }
    });
  });
}

/* 星空显示 + 密度控制 */
export function bindStarsToggle(stars) {
  const toggleStars = $('toggle-stars');
  const densitySlider = $('stars-density-slider');
  const densityLabel = $('stars-density-label');

  // 显示/隐藏：直接改 stars.visible（不需要销毁几何）
  toggleStars.addEventListener('change', () => {
    if (_currentStarsObj) _currentStarsObj.visible = toggleStars.checked;
  });

  // 密度滑块：销毁旧 stars + 重新生成
  // 注意：regenerateStars 内部已管理全局 _starsObj
  densitySlider.addEventListener('input', () => {
    const pct = +densitySlider.value;
    densityLabel.textContent = `${pct}%`;
    // 找当前 scene
    const scene = window.__scene;
    if (!scene) return;
    const newStars = regenerateStars(scene, pct);
    _currentStarsObj = newStars;
    // 同步 toggle 状态
    if (newStars) newStars.visible = toggleStars.checked;
  });

  // 初始化 _currentStarsObj 引用
  _currentStarsObj = stars;
}

let _currentStarsObj = null;

/* 信息面板（通过自定义事件接收） */
export function initInfoPanel() {
  window.addEventListener('show-info', (e) => {
    const d = e.detail;
    $('info-name').textContent = d.name + (d.en?` (${d.en})`:'');
    $('info-type').textContent = d.type || (d.isSun?'恒星 G2V 型':'太阳系天体');
    if (d.facts){
      const grid = $('info-data'); grid.innerHTML='';
      const labels = { diameter:'直径', mass:'质量', day:'自转周期', year:'公转周期',
                       temp:'温度', moons:'卫星数', gravity:'表面重力', age:'年龄', luminosity:'光度' };
      Object.entries(d.facts).forEach(([k,v])=>{
        grid.innerHTML += `<div class="k">${labels[k]||k}</div><div class="v">${v}</div>`;
      });
    }
    $('info-fact').innerHTML = d.fact || '';
    $('info-panel').classList.add('show');
  });
  $('info-close').addEventListener('click', ()=> $('info-panel').classList.remove('show'));
}

/* 图例点击 = 切换追踪 */
export function initLegend() {
  const legendList = $('legend-list');
  legendList.innerHTML = '';
  const items = [];
  if (window.__sun) items.push(window.__sun);
  if (window.__planets) items.push(...window.__planets.map(o=>o.mesh));
  if (window.__moon) items.push(window.__moon.mesh);

  items.forEach(m=>{
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.name = m.userData.name;
    const color = m.userData.isSun ? '#ffcc55' :
                  m.userData.data.color ? '#'+m.userData.data.color.toString(16).padStart(6,'0') : '#aaaaaa';
    item.innerHTML = `<span class="dot" style="background:${color};color:${color}"></span>
      ${m.userData.name}`;
    item.onclick = (e)=>{
      e.stopPropagation();
      // 修 #2: 再次点击同一目标不再取消，改为重新飞过去
      startTracking(m, true);
    };
    legendList.appendChild(item);
  });
}

/* 追踪徽章的"停止"按钮 */
export function initTrackingStopButton() {
  $('tracking-stop-btn').addEventListener('click', (e)=>{
    e.stopPropagation();
    stopTracking();
  });
}

/* 模拟器点击交互（点击星球进入追踪） */
export function initSceneClick(renderer, camera, getClickable) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.addEventListener('click', (e)=>{
    mouse.x = (e.clientX/innerWidth)*2-1;
    mouse.y = -(e.clientY/innerHeight)*2+1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(getClickable(), false);
    if (hits.length) {
      const m = hits[0].object;
      // 修 #2: 再次点击同一目标不再取消，改为重新飞过去
      startTracking(m, true);
    }
    // 修：空白处不取消追踪
  });

  renderer.domElement.addEventListener('mousemove', (e)=>{
    mouse.x = (e.clientX/innerWidth)*2-1;
    mouse.y = -(e.clientY/innerHeight)*2+1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(getClickable(), false);
    renderer.domElement.style.cursor = hits.length ? 'pointer' : 'default';
  });
}