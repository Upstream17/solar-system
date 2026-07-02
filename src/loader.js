/* loader.js — 资产加载管理器 + 全屏 loading overlay
 *
 * 工作流：
 *   1. 页面 HTML 里放 #loader overlay（隐藏）
 *   2. main.js 在 import 完 Three.js 后立刻调 Loader.show()
 *   3. safeTexture 通过 Loader.tick(label, delta) 报告进度（0-1）
 *   4. total = 9 个纹理（太阳 + 8 行星），月亮复用 makeMercuryTex 算 1 个共 10
 *   5. 全部 done → main.js 调 Loader.hide() → 启动 3D scene
 */

const TOTAL_ASSETS = 11; // sun + mercury + venus + earth + earth_normal + earth_clouds + mars + jupiter + saturn + (saturn_ring + uranus_ring) + moon
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
