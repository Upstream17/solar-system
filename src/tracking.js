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
  const offset = displayR * 4 + 4;
  const target = wp.clone().add(new THREE.Vector3(offset, offset*0.6, offset));
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

/** 主循环里调用：追踪时锁定 target 到目标 */
export function tickTracking() {
  if (trackingTarget) {
    const targetPos = trackingTarget.getWorldPosition(new THREE.Vector3());
    _controls.target.lerp(targetPos, 0.1);
    // 相机位置完全由 OrbitControls 管理
  }
}

/* ESC 取消追踪 */
addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') stopTracking();
});