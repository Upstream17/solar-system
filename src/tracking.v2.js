/* tracking.js — 持续追踪系统
 *
 * 设计：
 *   - 追踪时禁用 OrbitControls，自己实现相机控制
 *   - cameraOffset = 球坐标 (radius, theta, phi)，表示相机相对 target 的偏移
 *   - 滚轮改 radius（缩放）
 *   - 鼠标拖拽改 theta/phi（旋转）
 *   - target 跟着目标平滑移动
 *   - 退出追踪时恢复 OrbitControls
 *
 * 优势：
 *   - 用户在追踪时可以自由缩放/旋转，不会被 OrbitControls 内部状态干扰
 *   - 相机永远聚焦在目标上，目标不会"飞出视野"
 */

import * as THREE from 'three';
import { getSunDisplayRadius, getPlanetDisplayRadius } from './scale.js';

let focusTarget = null;
let camAnim = null;
let _camera, _controls, _renderer;

/* 鼠标 + 触屏事件：当焦点模式下，禁用 OrbitControls，自己处理
 * 移动端支持:
 *  - 单指拖拽 = 旋转（与鼠标拖拽一致）
 *  - 双指捏合 = 缩放 (Pinch) — 用 ratio scale 计算
 *  - 鼠标滚轮 = 缩放
 */
let _isUserInteracting = false;
let _isMultiTouch = false;       // 双指/多指模式
let _lastPointer = { x: 0, y: 0 };
let _lastPinchDist = 0;          // 上次双指距离 (像素)
let _spherical = new THREE.Spherical();  // 相机相对 target 的球坐标
let _targetWorldPos = new THREE.Vector3();  // 缓存的 target 位置

/* 球坐标转笛卡尔偏移 */
function sphericalToOffset(sph) {
  return new THREE.Vector3(
    sph.radius * Math.sin(sph.phi) * Math.sin(sph.theta),
    sph.radius * Math.cos(sph.phi),
    sph.radius * Math.sin(sph.phi) * Math.cos(sph.theta)
  );
}

/* 笛卡尔偏移转球坐标 */
function offsetToSpherical(offset) {
  return new THREE.Spherical().setFromVector3(offset);
}

/* 双指距离 (像素) */
function pinchDistance(touches) {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

/* 用与 wheel 一样的 min/max 范围, 应用一次缩放 — scale > 1 拉远, < 1 拉近 */
function applyZoomScale(scale) {
  _spherical.radius *= scale;
  // 缩放范围基于目标行星半径 (与 onWheel 一致)
  const targetR = focusTarget.userData.isSun
    ? getSunDisplayRadius()
    : getPlanetDisplayRadius(focusTarget.userData.data);
  const minR = Math.max(targetR * 1.2, 0.3);
  const maxR = targetR * 50;
  _spherical.radius = Math.max(minR, Math.min(maxR, _spherical.radius));
}

export function initTracking(camera, controls, renderer) {
  _camera = camera;
  _controls = controls;
  _renderer = renderer;
}

/* 鼠标事件：当焦点模式下，禁用 OrbitControls，自己处理 */
function onPointerDown(e) {
  if (!focusTarget) return;
  if (e.button !== 0 && e.button !== 2) return;  // 只响应左/右键
  e.preventDefault();
  _isUserInteracting = true;
  _lastPointer.x = e.clientX;
  _lastPointer.y = e.clientY;
}
function onPointerMove(e) {
  if (!_isUserInteracting) return;
  const dx = e.clientX - _lastPointer.x;
  const dy = e.clientY - _lastPointer.y;
  _lastPointer.x = e.clientX;
  _lastPointer.y = e.clientY;

  // 旋转：theta 水平, phi 垂直
  const ROTATE_SPEED = 0.005;
  _spherical.theta -= dx * ROTATE_SPEED;
  _spherical.phi   -= dy * ROTATE_SPEED;
  // 限制 phi 避免翻转
  _spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, _spherical.phi));
}
function onPointerUp() {
  _isUserInteracting = false;
}
function onWheel(e) {
  if (!focusTarget) return;
  e.preventDefault();
  // 滚轮缩放：deltaY 正数 = 远离，负数 = 拉近
  const ZOOM_SPEED = 0.0015;
  applyZoomScale(1 + e.deltaY * ZOOM_SPEED);
}

/* 触屏事件: 单指旋转 + 双指 pinch 缩放 */
function onTouchStart(e) {
  if (!focusTarget) return;
  if (e.touches.length >= 2) {
    // 进入双指模式
    _isMultiTouch = true;
    _isUserInteracting = false;
    _lastPinchDist = pinchDistance(e.touches);
    e.preventDefault();
  } else if (e.touches.length === 1) {
    // 单指 = 旋转
    _isMultiTouch = false;
    _isUserInteracting = true;
    _lastPointer.x = e.touches[0].clientX;
    _lastPointer.y = e.touches[0].clientY;
    e.preventDefault();
  }
}

function onTouchMove(e) {
  if (!focusTarget) return;
  if (_isMultiTouch && e.touches.length >= 2) {
    // 双指 pinch 缩放
    const newDist = pinchDistance(e.touches);
    if (_lastPinchDist > 0 && newDist > 0) {
      // 距离变大 = 拉远 (scale > 1), 距离变小 = 拉近 (scale < 1)
      const scale = newDist / _lastPinchDist;
      applyZoomScale(scale);
    }
    _lastPinchDist = newDist;
    e.preventDefault();
  } else if (_isUserInteracting && e.touches.length === 1) {
    // 单指旋转 (与 onPointerMove 逻辑一致)
    const dx = e.touches[0].clientX - _lastPointer.x;
    const dy = e.touches[0].clientY - _lastPointer.y;
    _lastPointer.x = e.touches[0].clientX;
    _lastPointer.y = e.touches[0].clientY;

    const ROTATE_SPEED = 0.005;
    _spherical.theta -= dx * ROTATE_SPEED;
    _spherical.phi   -= dy * ROTATE_SPEED;
    _spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, _spherical.phi));
    e.preventDefault();
  }
}

function onTouchEnd(e) {
  if (_isMultiTouch && e.touches.length < 2) {
    // 双指松开, 退回单指模式
    _isMultiTouch = false;
    _lastPinchDist = 0;
  }
  if (e.touches.length === 0) {
    _isUserInteracting = false;
    _isMultiTouch = false;
    _lastPinchDist = 0;
  }
}

function onContextMenu(e) {
  if (focusTarget) e.preventDefault();  // 焦点模式禁用右键菜单
}

/* 事件绑定（initTracking 时调一次） */
let _eventsBound = false;
function bindEvents() {
  if (_eventsBound) return;
  _eventsBound = true;
  const dom = _renderer.domElement;
  // 鼠标 (Pointer Events)
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointercancel', onPointerUp);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('contextmenu', onContextMenu);
  // 触屏 (Touch Events) — 移动端 pinch + 单指旋转
  // passive: false 因为要 preventDefault 阻止页面滚动
  dom.addEventListener('touchstart', onTouchStart, { passive: false });
  dom.addEventListener('touchmove', onTouchMove, { passive: false });
  dom.addEventListener('touchend', onTouchEnd, { passive: false });
  dom.addEventListener('touchcancel', onTouchEnd, { passive: false });
}

export function getFocusTarget() { return focusTarget; }
export function getCamAnim() { return camAnim; }

/** 设置焦点（点击星球/图例）
 * 修 #2: 再次点击同一目标 → 不做任何反应（避免误操作抖动）
 * 退出焦点只能通过 ESC 或徽章上的"停止"按钮 */
export function startTracking(mesh, withFocus = true) {
  // 重复点同一目标 → 不做任何反应（避免画面抖动误操作）
  if (focusTarget === mesh) return;
  // 切换目标 → 重新追踪
  focusTarget = mesh;
  bindEvents();
  updateTrackingBadge();
  updateLegendHighlight();
  if (withFocus) focusOn(mesh);
}

/** 退出焦点模式 */
export function stopTracking() {
  if (!focusTarget) return;
  focusTarget = null;
  // 把控制权还回 OrbitControls
  _controls.enabled = true;
  updateTrackingBadge();
  updateLegendHighlight();
}

/* 飞到目标附近（一次性动画） */
function focusOn(mesh) {
  const info = mesh.userData.isSun
    ? mesh.userData
    : mesh.userData.data;
  window.dispatchEvent(new CustomEvent('show-info', { detail: info }));

  const wp = mesh.getWorldPosition(new THREE.Vector3());
  const displayR = mesh.userData.isSun
    ? getSunDisplayRadius()
    : getPlanetDisplayRadius(mesh.userData.data);

  // 相机距离 = 行星半径 × 4-6 倍（让用户能看清全行星，但保持合适的观察距离）
  const offset = Math.max(displayR * 4, 5);
  const target = wp.clone().add(new THREE.Vector3(offset, offset * 0.4, offset * 0.7));
  animateCamera(target, wp, offset);
}

function animateCamera(toPos, toTarget, expectedOffset) {
  // 焦点模式：动画结束后初始化 spherical（让用户立即能滚轮缩放）
  camAnim = {
    fromPos: _camera.position.clone(),
    toPos,
    fromTarget: _controls.target.clone(),
    toTarget,
    t: 0,
    expectedOffset,  // 动画结束后相机的 spherical.radius
    postAction: () => {
      // 动画结束后：禁用 OrbitControls，记录当前 offset 为 spherical
      _controls.enabled = false;
      const offsetVec = _camera.position.clone().sub(_controls.target);
      _spherical = offsetToSpherical(offsetVec);
      _targetWorldPos.copy(_controls.target);
    }
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
    if (t >= 1) {
      if (camAnim.postAction) camAnim.postAction();
      camAnim = null;
    }
  }
}

/** 主循环：焦点模式 + 自由控制 */
export function tickTracking() {
  if (focusTarget && !camAnim) {
    // 1. target 跟随目标
    const targetPos = focusTarget.getWorldPosition(_targetWorldPos);
    _controls.target.copy(targetPos);

    // 2. 相机位置 = target + offset（由用户滚轮/拖拽控制的 spherical）
    const offset = sphericalToOffset(_spherical);
    _camera.position.copy(_controls.target).add(offset);
  }
}

/* 焦点模式：禁用 OrbitControls（仅在非交互时） */
function updateTrackingBadge() {
  // v20260702f: 追踪条整合到图例顶部 (#legend-tracking), 替代左下角浮条
  // — 加 null check 防御: 老版本浏览器可能缓存了 #tracking-badge 已被删的代码
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