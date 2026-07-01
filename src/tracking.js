/* tracking.js — 焦点模式系统
 *
 * 设计哲学（tycho.ioz 风格）：
 *   - 点击星球/图例 = 一次 animateCamera 飞到目标附近 + 进入"焦点模式"
 *   - 焦点模式下 target 锁定到目标（自动跟随公转），但 camera.position 完全由 OrbitControls 管理
 *   - 用户可以自由缩放/旋转/平移
 *   - 再次点击同一目标 或 ESC 或徽章按钮 = 退出焦点模式
 *   - 这是 OrbitControls 唯一能正常工作的方案 — 每帧强行覆盖 camera.position 会彻底破坏 OrbitControls 内部状态
 */

import * as THREE from 'three';
import { getSunDisplayRadius, getPlanetDisplayRadius } from './scale.js';

let focusTarget = null;  // 当前焦点目标（不等于"持续追踪"）
let camAnim = null;
let _camera, _controls;

export function initTracking(camera, controls) {
  _camera = camera;
  _controls = controls;
}

export function getFocusTarget() { return focusTarget; }
export function getCamAnim() { return camAnim; }

/** 设置焦点（点击星球/图例）— 触发飞行动画 + 进入焦点模式 */
export function startTracking(mesh, withFocus=true) {
  // 再次点同一目标 → 取消焦点
  if (focusTarget === mesh) {
    stopTracking();
    return;
  }
  focusTarget = mesh;
  updateTrackingBadge();
  updateLegendHighlight();
  if (withFocus) focusOn(mesh);
}

/** 退出焦点模式 */
export function stopTracking() {
  if (!focusTarget) return;
  focusTarget = null;
  updateTrackingBadge();
  updateLegendHighlight();
}

/** 切换到不同目标 */
export function switchToTarget(mesh) {
  focusTarget = mesh;
  updateTrackingBadge();
  updateLegendHighlight();
  focusOn(mesh);
}

function updateTrackingBadge() {
  const badge = document.getElementById('tracking-badge');
  if (focusTarget) {
    document.getElementById('tracking-name').textContent = focusTarget.userData.name;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

function updateLegendHighlight() {
  document.querySelectorAll('#legend .item').forEach(el=>{
    if (focusTarget && el.dataset.name === focusTarget.userData.name) {
      el.classList.add('tracking');
    } else {
      el.classList.remove('tracking');
    }
  });
}

/** 飞到目标附近（一次性动画，不持续追踪） */
function focusOn(mesh) {
  const info = mesh.userData.isSun
    ? mesh.userData
    : mesh.userData.data;
  window.dispatchEvent(new CustomEvent('show-info', { detail: info }));

  const wp = mesh.getWorldPosition(new THREE.Vector3());
  const displayR = mesh.userData.isSun
    ? getSunDisplayRadius()
    : getPlanetDisplayRadius(mesh.userData.data);

  // 相机距离 = max(行星半径 × 12, 8) — 看全行星
  const offset = Math.max(displayR * 12, 8);
  const target = wp.clone().add(new THREE.Vector3(offset, offset*0.4, offset*0.7));
  animateCamera(target, wp);
}

function animateCamera(toPos, toTarget) {
  camAnim = {
    fromPos: _camera.position.clone(),
    toPos,
    fromTarget: _controls.target.clone(),
    toTarget,
    t: 0
  };
}

/** 主循环里调用：推进相机动画 */
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

/** 主循环里调用：焦点模式下锁定 target 到目标
 *  注意：target 平滑跟随（target.lerp），但 camera.position 完全不动
 *  这样 OrbitControls 内部状态完好 — 用户缩放/旋转完全自由
 *  视觉效果：相机聚焦在目标周围旋转/缩放，但 target 不会"飘走"
 */
export function tickTracking() {
  if (focusTarget) {
    const targetPos = focusTarget.getWorldPosition(new THREE.Vector3());
    // 用更高的 lerp 系数 (0.2) 让 target 紧跟目标，避免目标移出视野
    _controls.target.lerp(targetPos, 0.2);
    // 不动 camera.position！
  }
}

/* ESC 退出焦点模式 */
addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') stopTracking();
});