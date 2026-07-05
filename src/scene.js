/* scene.js — Three.js 场景搭建（camera/renderer/controls/stars）+ 后处理 Bloom */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ===== 圆形柔边贴图（程序化生成，去马赛克）===== */
let _starTex = null;
function getStarTexture() {
  if (_starTex) return _starTex;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // 径向渐变：中心白 → 边缘 0 透明
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _starTex = new THREE.CanvasTexture(c);
  _starTex.colorSpace = THREE.SRGBColorSpace;
  return _starTex;
}

/* 星空背景
 * - 用程序化圆形柔边贴图（去方形马赛克）
 * - 用 ShaderMaterial 实现闪烁（每颗星独立速度+相位，sin 调制）
 * - 支持动态调整密度（销毁旧 stars + 创建新 stars）*/
let _starsObj = null;
export function makeStars(count, radius, sizeRange) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  const col = new Float32Array(count*3);
  const aPhase = new Float32Array(count*2);  // (speed, offset) per star
  const aBrightness = new Float32Array(count);  // 基础亮度 0.7-1.0
  for (let i=0;i<count;i++) {
    const r = radius + Math.random()*2000;
    const theta = Math.acos(2*Math.random()-1);
    const phi = Math.random()*Math.PI*2;
    pos[i*3]   = r*Math.sin(theta)*Math.cos(phi);
    pos[i*3+1] = r*Math.sin(theta)*Math.sin(phi);
    pos[i*3+2] = r*Math.cos(theta);
    const b = 0.7 + Math.random()*0.3;
    aBrightness[i] = b;
    const tint = Math.random();
    col[i*3]   = b * (tint<0.7?1:1.0);
    col[i*3+1] = b * (tint<0.85?1:0.9);
    col[i*3+2] = b * (tint<0.95?1:0.8);
    // 闪烁速度 0.3-1.5 Hz（少数星快，多数星慢，看起来不规律）
    aPhase[i*2]   = 0.3 + Math.random() * 1.2;
    aPhase[i*2+1] = Math.random() * Math.PI * 2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col,3));
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(aPhase, 2));
  geo.setAttribute('aBrightness', new THREE.BufferAttribute(aBrightness, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: sizeRange },
      uMap:  { value: getStarTexture() }
    },
    vertexShader: `
      attribute vec2 aPhase;
      attribute float aBrightness;
      uniform float uTime;
      uniform float uSize;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = color;
        // 闪烁：sin(time * speed + offset) → 范围 [-1, 1]
        // 用 pow 把 sin 输出非线性化，让暗部更暗、亮部更亮（更明显的"眨眼"感）
        float s = sin(uTime * aPhase.x + aPhase.y);
        // pow(0.5 + 0.5*s, 1.5) — sin 波形偏置到 [0,1] 后做 1.5 次方，对比更明显
        float t01 = 0.5 + 0.5 * s;
        vTwinkle = pow(t01, 1.5) * 0.85 + 0.15;  // 范围 [0.15, 1.0]，暗到 15%
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(vColor * vTwinkle, tex.a);
      }
    `,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });
  return new THREE.Points(geo, mat);
}

/* 更新星空 uTime（主循环每帧调用）*/
export function updateStarsTime(deltaReal) {
  if (_starsObj && _starsObj.material.uniforms?.uTime) {
    _starsObj.material.uniforms.uTime.value += deltaReal;
  }
}

/* 星空 group：每帧跟随相机平移
 * — 星空 attribute 位置是相对 group 原点
 * — 把 group 移到 camera.position → 用户看到的是"无穷远星空"
 * — 海王星视角下背向太阳方向也能看到星星
 */
let _starsGroup = null;
export function updateStarPositions(camera) {
  if (!_starsGroup || !camera) return;
  _starsGroup.position.copy(camera.position);
}

/** 重新生成星空（销毁旧的，按新密度创建）*/
export function regenerateStars(scene, densityPercent) {
  // 0-100 → 0-12000 颗（默认 8000）
  const baseCount = 8000;
  const newCount = Math.max(0, Math.round(baseCount * densityPercent / 100));
  // 销毁旧 stars
  if (_starsObj) {
    if (_starsObj.parent) _starsObj.parent.remove(_starsObj);
    _starsObj.geometry.dispose();
    _starsObj.material.dispose();
    _starsObj = null;
  }
  if (newCount === 0) return null;  // 0 颗：完全销毁，不创建空对象
  // 创建新 stars（半径 200，size 1.6 保持跟原来一致）
  // 加到 _starsGroup（如果还没有 group，先建一个）
  if (!_starsGroup) {
    _starsGroup = new THREE.Group();
    scene.add(_starsGroup);
  }
  _starsObj = makeStars(newCount, 200, 1.6);
  _starsGroup.add(_starsObj);
  return _starsObj;
}

/** 初始化场景，返回 { scene, camera, renderer, controls, stars, composer, bloomPass } */
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
  // DIST_SCALE=160 后，海王星在 4808 单位远
  // maxDistance 限制到 8000（≈ 1.66× 海王星距离）— 防止用户拉到无穷远导致辉光/星空被裁剪
  // minDistance 0.5 — 允许贴近太阳表面看细节
  controls.minDistance = 0.5;
  controls.maxDistance = 8000;
  controls.target.set(0,0,0);

  // 星空 group：放在相机跟随位置，每帧平移
  _starsGroup = new THREE.Group();
  scene.add(_starsGroup);

  const stars = makeStars(8000, 200, 1.6);
  _starsGroup.add(stars);
  _starsObj = stars;

  /* ===== 后处理：Bloom Pass（仅做"中心微提亮"）=====
   * v6: 太阳辉光改用 FakeGlowMaterial mesh 方案（不用 sprite）
   *      → bloom 不再需要做"光晕主体"，只做细微中心提亮即可
   *      → strength 0.4 → 0.15（降低：避免跟 fake glow 叠加过曝）
   *      → threshold 0.92 → 0.95（更严格：只对最亮的部分触发）
   * 关闭 bloom 时 strength = 0，等同无后处理
   */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.15,   // strength（中心微提亮；fake glow 已经在做光晕）
    0.4,    // radius
    0.95    // threshold（更高 = 只对最亮的太阳中心触发，不影响纹理细节）
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  return { scene, camera, renderer, controls, stars, composer, bloomPass };
}