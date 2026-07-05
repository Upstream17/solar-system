/**
 * EdgeGlowMaterial.js
 * Fork 自社区 FakeGlowMaterial（ektogamat, MIT License）
 * Source: https://github.com/ektogamat/fake-glow-material-threejs
 *
 * 改动：把 fresnel 翻转（1.0 - fresnel），让球的"投影边缘"亮、"中心"透明
 * 适配"过曝太阳"——中心是 sun mesh 本体（金黄 sun.jpg），外圈是边缘光晕
 *
 * 工作原理：
 *   - 球的"投影边缘" = 法线垂直于相机 → dot(view, normal) ≈ 0 → edgeFresnel ≈ 1 → 亮
 *   - 球的"投影中心" = 法线正对相机 → dot ≈ 1 → edgeFresnel ≈ 0 → 透明
 *   - 球的"投影中段" = smoothstep 过渡区
 *
 * 这样叠在 sun mesh 上：
 *   - 中心区域（sun mesh 半径内）：球透明，看到金黄 sun.jpg 纹理
 *   - 球体延伸区（1.0× ~ 1.5× sunR）：显示暖白边缘光晕
 *   - 球体最外缘：fresnel 趋近 0，glow 也趋近 0，自然 fade 到黑色
 */

import { ShaderMaterial, Uniform, Color, AdditiveBlending, DoubleSide } from 'three';

class EdgeGlowMaterial extends ShaderMaterial {
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
        vec3 normal = normalize(vNormal);
        if(!gl_FrontFacing)
          normal *= - 1.0;
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        float fresnel = dot(viewDirection, normal);  // 0..1: 边缘=0, 中心=1

        // 翻转 fresnel: 中心 → 0, 边缘 → 1
        float edgeFresnel = 1.0 - fresnel;

        // 让边缘更集中（pow 让靠近边缘处快速升到 1，远离边缘快速降到 0）
        edgeFresnel = pow(edgeFresnel, glowInternalRadius + 0.1);

        float falloff = smoothstep(0., falloffAmount, edgeFresnel);
        float fakeGlow = edgeFresnel * (1.0 + glowSharpness) * falloff;

        // 颜色用 glowColor 直接（不再乘 fresnel 翻转）
        gl_FragColor = vec4(clamp(glowColor * edgeFresnel, 0., 1.0), clamp(fakeGlow, 0., opacity));

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

export default EdgeGlowMaterial;