/* tracking.js — 行星追踪系统 */

import * as THREE from 'three';
import { getSunDisplayRadius, getPlanetDisplayRadius } from './scale.js';

let trackingTarget = null;
let camAnim = null;
let _camera, _controls;

export function initTracking(camera, controls) {
  _camera = camera;
  _controls = controls;
}

export function getTrackingTarget() { return trackingTarget; }
export function getCamAnim() { return camAnim; }

export function startTracking(mesh, withFocus=true) {
  trackingTarget = mesh;
  resetTrackingOffset();  // 切换目标时重置偏移缓存
  updateTrackingBadge();
  updateLegendHighlight();
  if (withFocus) focusOn(mesh);
}

export function stopTracking() {
  if (!trackingTarget) return;
  trackingTarget = null;
  updateTrackingBadge();
  updateLegendHighlight();
}

function updateTrackingBadge() {
  const badge = document.getElementById('tracking-badge');
  if (trackingTarget) {
    document.getElementById('tracking-name').textContent = trackingTarget.userData.name;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

function updateLegendHighlight() {
  document.querySelectorAll('#legend .item').forEach(el=>{
    if (trackingTarget && el.dataset.name === trackingTarget.userData.name) {
      el.classList.add('tracking');
    } else {
      el.classList.remove('tracking');
    }
  });
}

function focusOn(mesh) {
  const info = mesh.userData.isSun
    ? mesh.userData
    : mesh.userData.data;
  // 信息面板由 UI 模块管理，这里通过自定义事件传递
  window.dispatchEvent(new CustomEvent('show-info', { detail: info }));

  const wp = mesh.getWorldPosition(new THREE.Vector3());
  const displayR = mesh.userData.isSun
    ? getSunDisplayRadius()
    : getPlanetDisplayRadius(mesh.userData.data);
  // 相机距离目标 = max(行星半径 × 8, 6) — 留出足够空间看全行星
  const offset = Math.max(displayR * 8, 6);
  const target = wp.clone().add(new THREE.Vector3(offset, offset*0.5, offset*0.8));
  animateCamera(target, wp);
}

function animateCamera(toPos, toTarget) {
  camAnim = {
    fromPos: _camera.position.clone(),
    toPos,
    fromTarget: _controls.target.clone(),
    toTarget,
    t:0
  };
}

/** 主循环里调用：推进相机动画 */
export function tickCameraAnim(deltaReal) {
  if (camAnim){
    camAnim.t += deltaReal * 1.5;
    const t = Math.min(1, camAnim.t);
    const e = t<.5 ? 2*t*t : -1+(4-2*t)*t;
    _camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, e);
    _controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, e);
    if (t >= 1) camAnim = null;
  }
}

/** 主循环里调用：追踪时相机跟随目标平移
 *  修复 #2 真正根因：只改 target 不改 camera 会让 OrbitControls 误判用户缩放
 *  正确做法：让相机与目标保持相对位置（相机跟着 target 一起移动），
 *  这样用户滚轮缩放时改的是"相机与目标的相对距离"，不会被打断
 */
const _targetOffset = new THREE.Vector3();  // 缓存 camera - target 偏移
let _trackingOffsetInitialized = false;

export function tickTracking() {
  if (trackingTarget) {
    const targetPos = trackingTarget.getWorldPosition(new THREE.Vector3());

    if (!_trackingOffsetInitialized) {
      // 第一次进入追踪：记录当前相机与 target 的偏移
      _targetOffset.copy(_camera.position).sub(_controls.target);
      _trackingOffsetInitialized = true;
    }

    // target 平滑跟随目标位置
    _controls.target.lerp(targetPos, 0.15);

    // 相机跟随 target 平移（保持相机-target 偏移不变）
    // 这样 OrbitControls 的内部状态不会被打断
    _camera.position.copy(_controls.target).add(_targetOffset);
  } else {
    _trackingOffsetInitialized = false;
  }
}

/** 重置追踪偏移缓存（用户切换目标时调用）*/
export function resetTrackingOffset() {
  _trackingOffsetInitialized = false;
}

/* ESC 取消追踪 */
addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') stopTracking();
});