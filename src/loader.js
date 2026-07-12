/* loader.js — 资产加载管理器 + 全屏 loading overlay
 *
 * 工作流：
 *   1. 页面 HTML 里放 #loader overlay（隐藏）
 *   2. main.js 在 import 完 Three.js 后立刻调 Loader.show()
 *   3. safeTexture 通过 Loader.tick(label, delta) 报告进度（0-1）
 *   4. total = 实际纹理数 (sun 1 + 行星主图 8 + earth_normal/clouds 2 + 土星/天王星环 2 + 月球 1 + 新卫星 19 = 33)
 *   5. 全部 done → main.js 调 Loader.hide() → 启动 3D scene
 *
 * v20260712c: 修复进度条卡 100% 问题 — 之前 TOTAL_ASSETS=11 硬编码, 现在 20 颗卫星 = 33 张图,
 *   进度条要等全部 33 张都完成才到 100%, 否则显示"还在准备中"用户以为页面挂了
 */

const TOTAL_ASSETS = 33; // sun(1) + 行星主图(8) + earth_normal/clouds(2) + saturn_ring + uranus_ring(2) + earth moon(1) + 19 新卫星
let _done = 0;
let _labels = new Set();

/** 报告一项资源加载完成 */
export function tick(label) {
  _done++;
  _labels.add(label);
  if (_labelEl) _labelEl.textContent = Array.from(_labels).join(' · ');
  update();
}

/** 直接 set 百分比（0-1），用于有 progress 事件的 loader */
export function setProgress(p, label) {
  if (_barEl) _barEl.style.width = `${Math.min(100, p * 100).toFixed(1)}%`;
  if (label && _labelEl) _labelEl.textContent = label;
}

/** 顶层 show / hide */
let _overlay, _barEl, _labelEl, _pctEl, _subEl;

/** v20260702h: HTML 已经有 #loader, show() 只绑定引用 + 强制可见, 不再 createElement */
export function show() {
  _overlay = document.getElementById('loader');
  _barEl   = document.getElementById('loader-fill');
  _pctEl   = document.getElementById('loader-pct');
  _labelEl = document.getElementById('loader-label');
  _subEl   = _overlay?.querySelector('.loader-sub');
  // 强制可见 (移除可能残留的 .hide class, 防止用户刷新时遮罩消失)
  if (_overlay) _overlay.classList.remove('hide');
}

export function hide() {
  if (!_overlay) _overlay = document.getElementById('loader');
  if (!_overlay) return;
  _overlay.classList.add('hide');
  setTimeout(() => {
    _overlay?.remove();
    _overlay = null;
  }, 700);
}

function update() {
  const pct = Math.min(1, _done / TOTAL_ASSETS);
  if (_barEl) _barEl.style.width = `${(pct * 100).toFixed(1)}%`;
  if (_pctEl) _pctEl.textContent = `${Math.round(pct * 100)}%`;
  if (_subEl && pct >= 1) _subEl.textContent = 'READY · BUILDING SCENE';
}
