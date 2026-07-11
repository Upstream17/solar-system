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

// 1× 真实世界 1 hour/sec (v20260708 改动, C 方案)
//   — 1× = 1 hour/sec: 地球自转 24 sec, 公转 4 小时
//   — 100× = 100 hour/sec: 地球年 2.48 分钟
//   — 1000× = 1000 hour/sec = 41.7 day/sec: 地球年 8.75 秒看完
//   — slider max=125 触达 1000×, 公式 (v-50)/25 不变
//   — 演进: 5 day/s → 1 day/s (D) → 1/24 day/s = 1 hour/s (C) → 1000× 上限
function sliderToSpeed(v) {
  // v 0-125: 0→暂停, 50→1×(1 hour/s), 100→100×, 125→1000×(41.7 day/s)
  if (v <= 0) return 0;
  if (v <= 50) return v / 50;
  return Math.pow(10, (v - 50) / 25);
}
function formatSpeed(s) {
  // v20260708 C 方案: label 显示成"× 真实", 直观对齐真实时间
  //   — 1× = 真实 1 hour/sec
  //   — 10× = 10 hour/sec
  //   — 100× = 100 hour/sec = 4.17 day/sec
  // — 替代之前"day/s"(用户得心算 ×24 转 hour)
  if (s === 0) return bi('speed_paused');
  if (s < 0.1) return s.toFixed(2) + '×';
  if (s < 1)   return s.toFixed(1) + '×';
  if (s < 10)  return s.toFixed(1) + '×';
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
  const toggleBloom    = $('toggle-bloom');

  toggleOrbits.addEventListener('change', ()=>{
    scene.traverse(o=>{ if (o.userData?.isOrbit) o.visible = toggleOrbits.checked; });
  });

  // v20260711: 删 3D label — toggle UI 节点已拆, 不再有 addEventListener
  // — 行星名通过图例 (BODIES panel) + 信息面板 (info-panel) 展示
  // — 3D 场景渲染天体几何即可, 不再叠加 Sprite 文字标签

  // 辉光开关：调用 lighting.js 的 setGlowEnabled() 设置全局标志
  // — 由主循环 glowUpdate() 每帧检查这个标志，避免 per-frame 覆盖 visible
  // — 关闭时：所有 sprite 不可见，sun mesh 完全不透明（无光晕，纯纹理）
  // — 开启时：4 层 sprite 按距离平滑显示，sun mesh 适度淡出
  // — 同时控制 GodRaysEffect pass 开关（新方案：screen-space raymarched）
  const BLOOM_ON = 0.4, BLOOM_OFF = 0.0;
  toggleBloom.addEventListener('change', ()=>{
    const enabled = toggleBloom.checked;
    // 联动 bloomPass（仅做中心提亮，强度很弱）
    const pass = window.__bloomPass;
    if (pass) pass.strength = enabled ? BLOOM_ON : BLOOM_OFF;
    // 设置全局标志 — 主循环 glowUpdate() 会检查这个标志（控制 4 层 sprite）
    setGlowEnabled(enabled);
    // 兼容：直接同步所有 sprite 的 visible（用户切换瞬间立即生效，不必等下一帧）
    sunGlowSprites.forEach(s => { s.visible = enabled; });
    // 联动 GodRaysEffect pass（控制 screen-space 光线辐射）
    if (window.__setGodRaysEnabled) window.__setGodRaysEnabled(enabled);
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

  // v20260708: 小行星带开关
  const toggleAsteroids = $('toggle-asteroids');
  if (toggleAsteroids) {
    toggleAsteroids.addEventListener('change', () => {
      if (window.__asteroidBelt) {
        window.__asteroidBelt.visible = toggleAsteroids.checked;
      }
    });
  }
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

/* 图例 — 支持多星系统 (v20260712 重构)
 * 结构:
 *   - 太阳 (恒星)
 *   - 行星 (按距太阳远近排序)
 *   - 卫星分组 (按母行星分组,每个行星可折叠)
 * - 滚动: panel-body 设 max-height + overflow-y:auto
 * - 选中追踪: data-name 匹配 userData.name
 */
export function initLegend() {
  const legendList = $('legend-list');
  legendList.innerHTML = '';

  // ===== 1. 太阳 (恒星) =====
  if (window.__sun) {
    const groupHeader = document.createElement('div');
    groupHeader.className = 'legend-group';
    groupHeader.textContent = '恒星 · STAR';
    legendList.appendChild(groupHeader);
    legendList.appendChild(makeLegendItem(window.__sun, true));
  }

  // ===== 2. 行星 =====
  if (window.__planets && window.__planets.length) {
    const groupHeader = document.createElement('div');
    groupHeader.className = 'legend-group';
    groupHeader.textContent = '行星 · PLANETS';
    legendList.appendChild(groupHeader);
    window.__planets.forEach(planetObj => {
      legendList.appendChild(makeLegendItem(planetObj.mesh, false));
    });
  }

  // ===== 3. 卫星分组 (按母行星) =====
  if (window.__allMoons && window.__allMoons.length) {
    const groupHeader = document.createElement('div');
    groupHeader.className = 'legend-group';
    groupHeader.textContent = `卫星 · MOONS (${window.__allMoons.length})`;
    legendList.appendChild(groupHeader);

    // 按母行星分组
    const moonsByParent = {};
    window.__allMoons.forEach(m => {
      const pName = m.parentPlanet || m.data.parent || '未知';
      if (!moonsByParent[pName]) moonsByParent[pName] = [];
      moonsByParent[pName].push(m);
    });

    // 按 PLANETS 顺序遍历 (跟行星列表的视觉顺序对齐)
    // 火星 → 木星 → 土星 → 天王星 → 海王星 → 地球 (月球按发现位置排在地球行星下)
    const planetOrder = ['地球', '火星', '木星', '土星', '天王星', '海王星'];
    const sortedParents = Object.keys(moonsByParent).sort((a, b) => {
      const ai = planetOrder.indexOf(a); const bi = planetOrder.indexOf(b);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });

    sortedParents.forEach(parentName => {
      const moons = moonsByParent[parentName];
      // 折叠容器
      const moonGroup = document.createElement('div');
      moonGroup.className = 'moon-group';
      const isOpen = localStorage.getItem(`moon_group_${parentName}`) !== '0';  // 默认展开
      moonGroup.dataset.parent = parentName;
      moonGroup.dataset.open = String(isOpen);

      // 折叠 header
      const header = document.createElement('div');
      header.className = 'moon-group-header';
      header.innerHTML = `<span class="chevron">${isOpen ? '▼' : '▶'}</span><span class="name">${parentName}</span><span class="count">(${moons.length})</span>`;
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = moonGroup.dataset.open === 'true';
        moonGroup.dataset.open = String(!cur);
        header.querySelector('.chevron').textContent = !cur ? '▼' : '▶';
        body.style.display = !cur ? 'block' : 'none';
        localStorage.setItem(`moon_group_${parentName}`, !cur ? '1' : '0');
      });
      moonGroup.appendChild(header);

      // 折叠 body
      const body = document.createElement('div');
      body.className = 'moon-group-body';
      body.style.display = isOpen ? 'block' : 'none';
      moons.forEach(m => body.appendChild(makeLegendItem(m.mesh, false, parentName)));
      moonGroup.appendChild(body);

      legendList.appendChild(moonGroup);
    });
  }

  // 应用 current tracking highlight (如果用户在追踪某天体)
  if (window.__focusTarget) updateLegendHighlight();
}

/* 单个图例项 (复用): 太阳/行星/卫星同款 UI, 只是父级分组不同 */
function makeLegendItem(mesh, isSun, parentHint = '') {
  const item = document.createElement('div');
  item.className = 'item';
  item.dataset.name = mesh.userData.name;
  item.dataset.parent = parentHint;  // 仅卫星用
  const color = mesh.userData.isSun ? '#ffcc55' :
                mesh.userData.data?.color ? '#'+mesh.userData.data.color.toString(16).padStart(6,'0') : '#aaaaaa';
  const en = mesh.userData.data?.en || mesh.userData.en || (mesh.userData.isSun ? 'Sun' : '');
  item.innerHTML = `<span class="dot" style="background:${color};color:${color}"></span>
    <span class="name-zh">${mesh.userData.name}</span>${en ? `<span class="name-en">${en}</span>` : ''}`;
  item.onclick = (e) => {
    e.stopPropagation();
    startTracking(mesh, true);
  };
  return item;
}

/* legend 高亮当前追踪目标 (在 tracking.v2.js updateLegendHighlight 调用)
 * 改为 querySelector 整个 #legend-list (兼容分类结构)
 */
function updateLegendHighlight() {
  // export 给 tracking.v2.js 用
  const target = window.__focusTarget;
  document.querySelectorAll('#legend-list .item').forEach(el => {
    if (target && el.dataset.name === target.userData.name) {
      el.classList.add('tracking');
      // 自动展开父级 moon group (避免选中看不到)
      const mg = el.closest('.moon-group');
      if (mg && mg.dataset.open !== 'true') {
        mg.dataset.open = 'true';
        mg.querySelector('.moon-group-body').style.display = 'block';
        mg.querySelector('.chevron').textContent = '▼';
        localStorage.setItem(`moon_group_${mg.dataset.parent}`, '1');
      }
    } else {
      el.classList.remove('tracking');
    }
  });
}

// 暴露给 tracking.v2.js 调用
window.__updateLegendHighlight = updateLegendHighlight;

/* 浮动工具按钮 — GitHub 链接 + 背景音乐 toggle
 * — GitHub: 纯 <a target="_blank">, 不需要 JS
 * — 音乐: 浏览器 autoplay 政策禁止未手势自动播放带声音的音频 (Chrome 92+),
 *   所以默认显示"关闭"状态 (红图标 + 斜杠), 用户主动点按钮才播放
 * — 状态用 .playing class 控制图标 + 颜色
 */
export function initFloatingTools() {
  const btn = document.getElementById('ambient-btn');
  if (!btn) return;

  // 默认状态: 已关闭 (红图标 + 斜杠)
  // — 浏览器 autoplay 政策要求必须有用户手势才能播放带声音的音频
  // — 显示"关闭"是诚实的初始状态, 不会假装在播
  btn.classList.remove('playing');
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('title', '背景音乐 · 已关闭 (点击开启)');

  // 用户点击 toggle
    // v20260708 修复: 动态 import + toggle() 都用 try/catch 包
    // 根因: 移动端 importmap 动态 import 在 user-gesture handler 里可能 reject,
    //   不 catch 整个 promise 就跳 script 错, 用户看到 console 报错
    btn.addEventListener('click', async () => {
      let playing = false;
      try {
        const ambient = await import('./ambient.js');
        playing = await ambient.toggle();
      } catch (e) {
        console.warn('[ui] ambient toggle failed:', e.message);
        // 失败时把按钮弹回关闭态, 不留"假播放"状态
        playing = false;
      }
      btn.classList.toggle('playing', playing);
      btn.setAttribute('aria-pressed', String(playing));
      btn.setAttribute('title',
        playing
          ? '背景音乐 · 播放中 (点击关闭)'
          : '背景音乐 · 已关闭 (点击开启)');
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