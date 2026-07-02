/* tracking.js — 持续追踪系统 (v20260702i 重写: 用 OrbitControls 模式)
 *
 * 设计 (重写前 vs 重写后):
 *   重写前: 自己实现 _spherical + pointer/wheel 事件, _controls.enabled=false 禁用 OC
 *           问题: 移动端 pinch 双指缩放不工作, 1 年 immutable cache 等坑
 *   重写后: 让 OrbitControls 全权处理 rotate/zoom/pan (包括移动端 pinch)
 *           追踪模式只控制 target (让 target 跟着目标移动), camera 由 OC 自动维护
 *           保留 ESC 退出 + 徽章更新
 *
 * 优势:
 *   - 移动端双指缩放自动 work (OC 自带 touch handler)
 *   - 鼠标滚轮 + 左键拖 + 中键 pan + 双指 pan 全部走 OC, 不重复实现
 *   - 代码大幅简化, bug 面减少
 *   - 单指拖拽旋转/双指 pinch 缩放/滚轮缩放 跨平台统一
 */

import * as THREE from 'three';
import { getSunDisplayRadius, getPlanetDisplayRadius } from './scale.js';

let focusTarget = null;             // 当前追踪目标
let _camera, _controls, _renderer;

export function initTracking(camera, controls, renderer) {
  _camera = camera;
  _controls = controls;
  _renderer = renderer;
}

/** 设置焦点（点击星球/图例）
 * 修 #2: 再次点击同一目标 → 不做任何反应（避免误操作抖动）
 * 退出焦点只能通过 ESC 或徽章上的"停止"按钮 */
export function startTracking(mesh, withFocus = true) {
  if (focusTarget === mesh) return;
  focusTarget = mesh;
  updateTrackingBadge();
  updateLegendHighlight();
  if (withFocus) focusOn(mesh);
}

/** 退出焦点模式 */
export function stopTracking() {
  if (!focusTarget) return;
  focusTarget = null;
  // OrbitControls 保持启用, 不用改 enabled
  updateTrackingBadge();
  updateLegendHighlight();
}

/* 飞到目标附近（一次性动画）*/
function focusOn(mesh) {
  const info = mesh.userData.isSun ? mesh.userData : mesh.userData.data;
  window.dispatchEvent(new CustomEvent('show-info', { detail: info }));

  const wp = mesh.getWorldPosition(new THREE.Vector3());
  const displayR = mesh.userData.isSun
    ? getSunDisplayRadius()
    : getPlanetDisplayRadius(mesh.userData.data);
  // 相机距离 = 行星半径 × 4-6 倍
  const offset = Math.max(displayR * 4, 5);
  const target = wp.clone().add(new THREE.Vector3(offset, offset * 0.4, offset * 0.7));
  animateCamera(target, wp);
}

let camAnim = null;
function animateCamera(toPos, toTarget) {
  camAnim = {
    fromPos: _camera.position.clone(),
    toPos,
    fromTarget: _controls.target.clone(),
    toTarget,
    t: 0,
  };
}

/** 主循环：推进相机动画 */
export function tickCameraAnim(deltaReal) {
  if (camAnim) {
    camAnim.t += deltaReal * 1.5;
    const t = Math.min(1, camAnim.t);
    const e = t < 0.5 ? 2*t*t : -1 + (4-2*t)*t;
    _camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, e);
    _controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, e);
    if (t >= 1) camAnim = null;
  }
}

/** 主循环：焦点模式 + target 跟随
 * 重写后: 只改 target, camera 位置由 OrbitControls 自动维护
 * — 这样移动端双指 pinch / 鼠标滚轮 / 拖拽全部走 OC, 自然 work */
export function tickTracking() {
  if (focusTarget && !camAnim) {
    const targetPos = focusTarget.getWorldPosition(new THREE.Vector3());
    _controls.target.copy(targetPos);
  }
}

/* 焦点模式：禁用 OrbitControls 内部的 onContextMenu */
function onContextMenu(e) {
  if (focusTarget) e.preventDefault();
}

/* 事件绑定（initTracking 时调一次）*/
let _eventsBound = false;
function bindEvents() {
  if (_eventsBound) return;
  _eventsBound = true;
  _renderer.domElement.addEventListener('contextmenu', onContextMenu);
}

export function getFocusTarget() { return focusTarget; }
export function getCamAnim() { return camAnim; }

/* 焦点模式徽章/图例高亮 */
function updateTrackingBadge() {
  // v20260702f: 追踪条整合到图例顶部 (#legend-tracking), 替代左下角浮条
  const row = document.getElementById('legend-tracking');
  const legacy = document.getElementById('tracking-badge');
  const nameEl = document.getElementById('tracking-name');
  if (focusTarget) {
    if (nameEl) nameEl.textContent = focusTarget.userData.name;
    if (row) row.style.display = 'flex';
    if (legacy) legacy.classList.add('show');
  } else {
    if (row) row.style.display = 'none';
    if (legacy) legacy.classList.remove('show');
  }
}

function updateLegendHighlight() {
  document.querySelectorAll('#legend .item').forEach(el => {
    if (focusTarget && el.dataset.name === focusTarget.userData.name) {
      el.classList.add('tracking');
    } else {
      el.classList.remove('tracking');
    }
  });
}

/* ESC 退出 */
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') stopTracking();
});

// 立即绑定 contextmenu (不需要等 startTracking, 早期右键就该拦)
if (typeof document !== 'undefined') {
  document.addEventListener('contextmenu', (e) => {
    if (focusTarget && e.target.tagName === 'CANVAS') e.preventDefault();
  });
}
