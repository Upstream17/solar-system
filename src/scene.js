/* scene.js — Three.js 场景搭建（camera/renderer/controls/stars）+ 后处理 GodRays + Bloom */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// 用 pmndrs/postprocessing 的整套后处理（替换 three.js 内置的 EffectComposer/UnrealBloomPass）
// — 原因：three.js r160 的 examples/jsm 里没有 EffectPass 类
// — pmndrs 自带 RenderPass / EffectComposer / GodRaysEffect / BloomEffect 都是同一套接口
import {
  EffectComposer, RenderPass, EffectPass,
  GodRaysEffect, BloomEffect,
  KernelSize, BlendFunction
} from 'postprocessing';

/* ===== 圆形柔边贴图（程序化生成，去马赛克）===== */
let _starTex = null;
function getStarTexture() {
  if (_starTex) return _starTex;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
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

let _starsObj = null;
export function makeStars(count, radius, sizeRange) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  const col = new Float32Array(count*3);
  const aPhase = new Float32Array(count*2);
  const aBrightness = new Float32Array(count);
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
        float s = sin(uTime * aPhase.x + aPhase.y);
        float t01 = 0.5 + 0.5 * s;
        vTwinkle = pow(t01, 1.5) * 0.85 + 0.15;
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

export function updateStarsTime(deltaReal) {
  if (_starsObj && _starsObj.material.uniforms?.uTime) {
    _starsObj.material.uniforms.uTime.value += deltaReal;
  }
}

let _starsGroup = null;
export function updateStarPositions(camera) {
  if (!_starsGroup || !camera) return;
  _starsGroup.position.copy(camera.position);
}

export function regenerateStars(scene, densityPercent) {
  const baseCount = 8000;
  const newCount = Math.max(0, Math.round(baseCount * densityPercent / 100));
  if (_starsObj) {
    if (_starsObj.parent) _starsObj.parent.remove(_starsObj);
    _starsObj.geometry.dispose();
    _starsObj.material.dispose();
    _starsObj = null;
  }
  if (newCount === 0) return null;
  if (!_starsGroup) {
    _starsGroup = new THREE.Group();
    scene.add(_starsGroup);
  }
  _starsObj = makeStars(newCount, 200, 1.6);
  _starsGroup.add(_starsObj);
  return _starsObj;
}

/** 初始化场景，返回 { scene, camera, renderer, controls, stars, composer, bloomPass, setSunMesh, setGodRaysEnabled } */
export function initScene() {
  const app = document.getElementById('app');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000007);

  // v20260707: DIST_SCALE×16 后海王星在 76928 单位 → camera.far 必须够大才能看见
  const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 0.1, 200000);
  camera.position.set(0, 1500, 3000);

  const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  app.appendChild(renderer.domElement);
  
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 0.5;
  controls.maxDistance = 200000;  // v20260707: 跟随 camera.far 放大，允许滚到海王星
  controls.zoomSpeed = 2.0;       // v20260707: 距离量级变大后加快缩放（默认 1.0 偏慢）
  controls.target.set(0,0,0);

  _starsGroup = new THREE.Group();
  scene.add(_starsGroup);

  const stars = makeStars(8000, 200, 1.6);
  _starsGroup.add(stars);
  _starsObj = stars;

  /* ===== 后处理：RenderPass → GodRaysEffect → BloomEffect =====
   *   - GodRaysEffect：screen-space raymarched，从 sun mesh 中心辐射光线
   *     pmndrs 社区标准方案（2.8k stars）
   *   - BloomEffect：太阳中心微提亮（luminanceThreshold 0.92 = 仅最亮处触发）
   *
   * 注意：sun mesh 加到 scene（要渲染太阳本体），GodRaysEffect 会在
   *       渲染时把 sun mesh 当作 lightSource，从它的屏幕坐标辐射光线
   *
   * pmndrs EffectComposer 跟 three.js EffectComposer 接口差异：
   *   - pmndrs 的 composer.render(deltaTime) 需要显式传 deltaTime
   *   - pmndrs 不需要 OutputPass（自带 tone mapping）
   */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  let godRaysPass = null;
  function setSunMesh(sunMesh) {
    if (godRaysPass) {
      composer.removePass(godRaysPass);
      godRaysPass = null;
    }
    if (!sunMesh) return;
    const godRaysEffect = new GodRaysEffect(camera, sunMesh, {
      height: 480,
      kernelSize: KernelSize.SMALL,
      // v20260707 v4: 保持 c317f17 调参 (近/远都 sun mesh + godrays)
      //   太阳 LOD 已删除, 不会出现"图 1 vs 图 2"跳变
      //   旧: density 0.96 + decay 0.92 + weight 0.3 + exposure 0.45
      //   略调: density 0.94 + decay 0.88 (远观略收敛)
      density: 0.94,
      decay: 0.88,
      weight: 0.30,
      exposure: 0.40,
      samples: 80,
      clampMax: 1.0,
      blendFunction: BlendFunction.SCREEN
    });
    godRaysPass = new EffectPass(camera, godRaysEffect);
    // pmndrs addPass(pass, index) — index 1 = 插在 RenderPass(0) 之后，Bloom(2) 之前
    composer.addPass(godRaysPass, 1);
  }

  // UI toggle 用：控制 godrays pass 开关
  function setGodRaysEnabled(enabled) {
    if (godRaysPass) godRaysPass.enabled = !!enabled;
  }

  // pmndrs BloomEffect — 等价 UnrealBloomPass（intensity 0.4 / threshold 0.92）
  const bloomEffect = new BloomEffect({
    intensity: 0.4,
    luminanceThreshold: 0.92,
    luminanceSmoothing: 0.025,
    mipmapBlur: true,
    radius: 0.4
  });
  const bloomPass = new EffectPass(camera, bloomEffect);
  composer.addPass(bloomPass);

  return {
    scene, camera, renderer, controls, stars, composer, bloomPass,
    setSunMesh,
    setGodRaysEnabled,  // UI toggle 控制 godrays pass
    get godRaysEnabled() { return !!godRaysPass; }
  };
}