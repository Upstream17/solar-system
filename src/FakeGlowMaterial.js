/**
 * FakeGlowMaterial.js
 * Source: https://github.com/ektogamat/fake-glow-material-threejs
 * Author: Anderson Mancini (ektogamat) - MIT License (Feb 2024)
 *
 * 社区标准 Three.js 辉光材质：通过 fresnel（视角相关的法线夹角）计算辉光，
 * 不用 bloom 后处理，不会出现 sprite bounding box 边界问题。
 *
 * 用法：
 *   const sunGlowMaterial = new FakeGlowMaterial({
 *     glowColor: '#ffd9a0',
 *     falloff: 0.2,
 *     glowInternalRadius: 4.0,
 *     glowSharpness: 0.5
 *   });
 *   const glowSphere = new THREE.SphereGeometry(SUN_R * 1.8, 64, 64);
 *   const glowMesh = new THREE.Mesh(glowSphere, sunGlowMaterial);
 *   scene.add(glowMesh);
 */

import { ShaderMaterial, Uniform, Color, AdditiveBlending, DoubleSide } from 'three';

class FakeGlowMaterial extends ShaderMaterial {
  /**
   * Create a FakeGlowMaterial.
   *
   * @param {Object} parameters - The parameters to configure the material.
   * @param {number} [parameters.falloff=0.1] - The falloff factor for the glow effect.
   * @param {number} [parameters.glowInternalRadius=6.0] - The internal radius for the glow effect.
   * @param {Color} [parameters.glowColor=new Color('#00d5ff')] - The color of the glow effect.
   * @param {number} [parameters.glowSharpness=0.5] - The sharpness of the glow effect.
   * @param {number} [parameters.opacity=1.0] - The opacity of the hologram.
   * @param {number} [parameters.side=THREE.FrontSide] - The rendering side.
   * @param {boolean} [parameters.depthTest=false] - Enable or disable depth testing.
   */
  constructor(parameters = {}) {
    super();

    this.vertexShader = /* glsl */ `
      varying vec3 vPosition;
      varying vec3 vNormal;

      void main() {
        vec4 modelPosition = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * modelPosition;
        vec4 modelNormal = modelMatrix * vec4(normal, 0.0);
        vPosition = modelPosition.xyz;
        vNormal = modelNormal.xyz;
      }
    `;

    this.fragmentShader = /* glsl */ `
      uniform vec3 glowColor;
      uniform float falloffAmount;
      uniform float glowSharpness;
      uniform float glowInternalRadius;
      uniform float opacity;

      varying vec3 vPosition;
      varying vec3 vNormal;

      void main()
      {
        // Normal
        vec3 normal = normalize(vNormal);
        if(!gl_FrontFacing)
          normal *= - 1.0;
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        float fresnel = dot(viewDirection, normal);
        fresnel = pow(fresnel, glowInternalRadius + 0.1);
        float falloff = smoothstep(0., falloffAmount, fresnel);
        float fakeGlow = fresnel;
        fakeGlow += fresnel * glowSharpness;
        fakeGlow *= falloff;
        gl_FragColor = vec4(clamp(glowColor * fresnel, 0., 1.0), clamp(fakeGlow, 0., opacity));

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `;

    this.uniforms = {
      opacity: new Uniform(parameters.opacity !== undefined ? parameters.opacity : 1.0),
      glowInternalRadius: new Uniform(parameters.glowInternalRadius !== undefined ? parameters.glowInternalRadius : 6.0),
      glowSharpness: new Uniform(parameters.glowSharpness !== undefined ? parameters.glowSharpness : 0.5),
      falloff: new Uniform(parameters.falloff !== undefined ? parameters.falloff : 0.1),
      glowColor: new Uniform(parameters.glowColor !== undefined ? new Color(parameters.glowColor) : new Color("#00d5ff")),
    };

    this.setValues(parameters);
    this.depthTest = parameters.depthTest !== undefined ? parameters.depthTest : false;
    this.blending = parameters.blendMode !== undefined ? parameters.blendMode : AdditiveBlending;
    this.transparent = true;
    this.side = parameters.side !== undefined ? parameters.side : DoubleSide;
  }
}

export default FakeGlowMaterial;