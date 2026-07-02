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

let _isUserInteracting = false;
let _lastPointer = { x: 0, y: 0 };
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
  _spherical.radius *= 1 + e.deltaY * ZOOM_SPEED;

  // 修 #3: 缩放范围基于目标行星半径
  //  - 最小距离 = 目标半径 × 1.2（贴脸看但不能进入行星）
  //  - 最大距离 = 目标半径 × 50（远观）
  const targetR = focusTarget.userData.isSun
    ? getSunDisplayRadius()
    : getPlanetDisplayRadius(focusTarget.userData.data);
  const minR = Math.max(targetR * 1.2, 0.3);
  const maxR = targetR * 50;
  _spherical.radius = Math.max(minR, Math.min(maxR, _spherical.radius));
}

function onContextMenu(e) {
  if (focusTarget) e.preventDefault();  // 焦点模式禁用右键菜单
}

/* 鼠标事件绑定（initTracking 时调一次） */
let _eventsBound = false;
function bindEvents() {
  if (_eventsBound) return;
  _eventsBound = true;
  const dom = _renderer.domElement;
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointercancel', onPointerUp);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('contextmenu', onContextMenu);
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
  const row = document.getElementById('legend-tracking');
  if (focusTarget) {
    document.getElementById('tracking-name').textContent = focusTarget.userData.name;
    if (row) row.style.display = 'flex';
  } else {
    if (row) row.style.display = 'none';
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