/* scene.js — Three.js 场景搭建（camera/renderer/controls/stars） */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* 星空背景 */
export function makeStars(count, radius, sizeRange) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  const col = new Float32Array(count*3);
  for (let i=0;i<count;i++) {
    const r = radius + Math.random()*2000;
    const theta = Math.acos(2*Math.random()-1);
    const phi = Math.random()*Math.PI*2;
    pos[i*3]   = r*Math.sin(theta)*Math.cos(phi);
    pos[i*3+1] = r*Math.sin(theta)*Math.sin(phi);
    pos[i*3+2] = r*Math.cos(theta);
    const b = 0.7 + Math.random()*0.3;
    const tint = Math.random();
    col[i*3]   = b * (tint<0.7?1:1.0);
    col[i*3+1] = b * (tint<0.85?1:0.9);
    col[i*3+2] = b * (tint<0.95?1:0.8);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col,3));
  const mat = new THREE.PointsMaterial({
    size: sizeRange, sizeAttenuation:true, vertexColors:true,
    transparent:true, opacity:0.95, depthWrite:false
  });
  return new THREE.Points(geo, mat);
}

/** 初始化场景，返回 { scene, camera, renderer, controls, stars } */
export function initScene() {
  const app = document.getElementById('app');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000007);

  const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 0.1, 5000);
  camera.position.set(0, 50, 90);

  const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;  // 修 #5: 提亮整体曝光，让太阳更刺眼
  app.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  // tycho.ioz 风格：相机可在很近（看太阳细节）和很远（看海王星）之间自由切换
  controls.minDistance = 0.5;
  controls.maxDistance = 10000;
  controls.target.set(0,0,0);

  const stars = makeStars(8000, 200, 1.6);
  scene.add(stars);

  return { scene, camera, renderer, controls, stars };
}