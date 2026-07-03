/* ui.js — UI 控件 + 交互 */

import * as THREE from 'three';
import { scaleScene } from './scale.js';
import { sunGlowSprites } from './planets.js';
import { startTracking, stopTracking } from './tracking.v2.js';
import { regenerateStars } from './scene.js';
import { setGlowEnabled } from './lighting.js';
import { bi, infoT } from './i18n.js';

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
  if (s === 0) return bi('speed_paused');
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

/* ====== SpaceX 风可折叠面板系统 ======
 * 每个 panel 通过 `[data-collapse]` + `[data-collapse-body]` 实现
 * 状态保存在 localStorage（key = panelId）
 */
export function initCollapse() {
  const panels = document.querySelectorAll('[data-collapse]');
  panels.forEach((panel) => {
    const id = panel.id;
    if (!id) return;
    const btn = panel.querySelector('[data-collapse-btn]');
    const key = `collapse_${id}`;
    let open = localStorage.getItem(key);
    // v20260702c: 首次访问默认折叠（用户偏好），已有用户保留历史偏好
    open = open === null ? false : open === '1';
    apply();
    btn?.addEventListener('click', () => {
      open = !open;
      localStorage.setItem(key, open ? '1' : '0');
      apply();
    });
    function apply() {
      panel.classList.toggle('collapsed', !open);
      if (btn) btn.setAttribute('aria-expanded', String(open));
    }
  });
}


export function initInfoPanel() {
  // v20260702e: 缓存当前展示的详情, info-panel 内嵌按钮切换语言时重画
  let _currentDetail = null;
  // 当前 info-panel 语言, 初始 'zh' (跟按钮 active 态同步)
  let _infoLang = 'zh';

  function render(d) {
    // v20260702g: 行星名单语模式 — 中文模式显示 "水星", 英文模式显示 "Mercury"
    // — 之前 "Mercury（水星）" 双语并列在纯单语模式里多此一举
    $('info-name').textContent = _infoLang === 'en' ? (d.en || d.name) : d.name;
    // v20260702f: type 和 fact 走 data 自带的双语字段 (d.typeZh/d.typeEn/d.factZh/d.factEn)
    // — 之前走字典 + TYPE_KEY_MAP, 太阳/木星等中英硬编码字段切不动
    // — 现在每颗星球的描述都自带双语, 切 EN 时 type 和 fact 都同步翻
    const typeKey = _infoLang === 'en' ? 'typeEn' : 'typeZh';
    $('info-type').textContent = d[typeKey] || d.type || (d.isSun ? infoT('info_type_sun', _infoLang) : infoT('info_type_body', _infoLang));
    // v20260702g: facts 按 lang 选 (factsEn / factsZh), 之前 facts 字典硬编码中文单位
    // — 比如 day:'58.6 地球日', EN 模式也显示中文单位
    // — 兼容: 若 factsZh/factsEn 都没有, 退回 d.facts (旧数据)
    const factsData = d.factsZh || d.factsEn || d.facts;
    if (factsData){
      const grid = $('info-data'); grid.innerHTML='';
      const labels = {
        diameter:   infoT('info_diameter',   _infoLang),
        mass:       infoT('info_mass',       _infoLang),
        day:        infoT('info_day',        _infoLang),
        year:       infoT('info_year',       _infoLang),
        temp:       infoT('info_temp',       _infoLang),
        moons:      infoT('info_moons',      _infoLang),
        gravity:    infoT('info_gravity',    _infoLang),
        age:        infoT('info_age',        _infoLang),
        luminosity: infoT('info_luminosity', _infoLang),
      };
      // 选当前 lang 对应的子集 (zh 用 factsZh, en 用 factsEn), 都没就兜底用 factsData
      const factsLangData = (_infoLang === 'en' ? d.factsEn : d.factsZh) || factsData;
      Object.entries(factsLangData).forEach(([k,v])=>{
        grid.innerHTML += `<div class="k">${labels[k]||k}</div><div class="v">${v}</div>`;
      });
    }
    const factKey = _infoLang === 'en' ? 'factEn' : 'factZh';
    $('info-fact').innerHTML = d[factKey] || d.fact || '';
  }

  window.addEventListener('show-info', (e) => {
    _currentDetail = e.detail;
    render(_currentDetail);
    $('info-panel').classList.add('show');
  });
  $('info-close').addEventListener('click', ()=> {
    $('info-panel').classList.remove('show');
    _currentDetail = null;
  });

  // v20260702e: info-panel 内嵌 lang toggle 切换
  window.addEventListener('info-lang-changed', (e) => {
    _infoLang = e.detail.lang;
    if (_currentDetail) render(_currentDetail);
  });
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
    // v20260702e: 行星名双语并列 — 太阳 (Sun)
    // — 优先从 userData.data.en 取 (行星); 太阳没 data, 走 userData.en
    // — 兜底: 太阳的 en 在这里硬编码, 因为 planets.js 加载顺序有时序坑
    const en = m.userData.data?.en || m.userData.en || (m.userData.isSun ? 'Sun' : '');
    item.innerHTML = `<span class="dot" style="background:${color};color:${color}"></span>
      <span class="name-zh">${m.userData.name}</span>${en ? `<span class="name-en">${en}</span>` : ''}`;
    item.onclick = (e)=>{
      e.stopPropagation();
      // 修 #2: 再次点击同一目标不再取消，改为重新飞过去
      startTracking(m, true);
    };
    legendList.appendChild(item);
  });
}

/* 浮动工具按钮 — GitHub 链接 + 背景音乐 toggle
 * — GitHub: 纯 <a target="_blank">, 不需要 JS
 * — 音乐: 调 ambient 模块 toggle, 同步按钮 .playing class + aria-pressed
 */
export function initFloatingTools() {
  const btn = document.getElementById('ambient-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    // 懒加载 ambient 模块 — 用户第一次点时才 import, 减少初始 bundle 解析
    // （虽然 ESM 不支持真正的 lazy, 但 import() 是动态的, 不阻塞首屏）
    const ambient = await import('./ambient.js');
    const playing = await ambient.toggle();
    btn.classList.toggle('playing', playing);
    btn.setAttribute('aria-pressed', String(playing));
    btn.setAttribute('title',
      playing
        ? '背景音乐 · 播放中 (点击暂停)'
        : '背景音乐 · Ambient Drone (浩瀚静谧)');
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