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

export function show() {
  if (_overlay) return;
  const html = `
    <div id="loader">
      <div class="loader-mark">
        <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true">
          <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(120,180,255,0.18)" stroke-width="1"/>
          <circle cx="16" cy="16" r="13" fill="none" stroke="#7eb6ff" stroke-width="1.5"
                  stroke-dasharray="20 100" stroke-linecap="round"
                  style="transform-origin:center;animation:lr-spin 1.2s linear infinite"/>
          <circle cx="16" cy="16" r="2" fill="#7eb6ff"/>
        </svg>
      </div>
      <div class="loader-title">SOLAR SYSTEM</div>
      <div class="loader-sub">INITIALIZING · LOADING ASSETS</div>
      <div class="loader-bar"><div class="loader-fill" id="loader-fill"></div></div>
      <div class="loader-meta">
        <span id="loader-pct">0%</span>
        <span id="loader-label" class="dim">准备中…</span>
      </div>
    </div>
    <style id="loader-style">
      #loader {
        position:fixed; inset:0; z-index:9999;
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap:14px;
        background:radial-gradient(ellipse at center, #060c18 0%, #02050a 70%);
        color:#e8edf5;
        font-family:'JetBrains Mono','SF Mono',ui-monospace,monospace;
        transition:opacity .6s cubic-bezier(0.4,0,0.2,1);
      }
      #loader.hide { opacity:0; pointer-events:none; }
      .loader-mark { filter: drop-shadow(0 0 12px rgba(126,182,255,0.3)); }
      @keyframes lr-spin { to { transform:rotate(360deg); } }
      .loader-title {
        font-size:22px; font-weight:300; letter-spacing:8px;
        color:#7eb6ff; text-shadow:0 0 24px rgba(126,182,255,0.4);
        margin-top:6px;
      }
      .loader-sub {
        font-size:10.5px; letter-spacing:3px; color:#5a6478;
        margin-bottom:8px;
      }
      .loader-bar {
        width:240px; height:2px; background:rgba(255,255,255,0.06);
        border-radius:1px; overflow:hidden;
      }
      .loader-fill {
        width:0%; height:100%;
        background:linear-gradient(90deg, #4d8fff, #7eb6ff);
        box-shadow:0 0 12px rgba(126,182,255,0.6);
        transition:width .25s ease-out;
      }
      .loader-meta {
        display:flex; gap:24px; font-size:11px; letter-spacing:2px;
        color:#aab; min-height:14px;
      }
      .loader-meta .dim { color:#5a6478; }
    </style>
  `;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  document.body.appendChild(wrap);
  _overlay = wrap.querySelector('#loader');
  _barEl   = wrap.querySelector('#loader-fill');
  _pctEl   = wrap.querySelector('#loader-pct');
  _labelEl = wrap.querySelector('#loader-label');
  _subEl   = wrap.querySelector('.loader-sub');
}

export function hide() {
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
