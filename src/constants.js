/* constants.js — 真实天文数据 + 演示/真实模式缩放公式 */

/* ============================================================
   1. 真实天文数据 (NASA fact sheet)
   - size        = 演示模式基准半径（艺术夸张，已含视觉友好）
   - realSize    = 真实半径（地球 = 1.0，NASA 公约）
   - diameterKm  = NASA 直径 (km)，用于科普展示
   - distance    = 与太阳的距离 (AU)
   ============================================================ */
export const AU = 14;

// ===== 演示模式 =====
// 太阳偏小（保证水星不穿模），行星用 data.size（艺术夸张值）
export const SUN_DEMO = 1.5;

// ===== 真实模式（power 压缩 + 大小顺序对 — 工业级 demo 做法）=====
// 体积不能既"真实"又"装得下"（太阳≈109×地球，海王星≈30×地球轨道）。
// 折中：power 压缩（EXP=0.4）+ 硬编码水星最小值，保证不穿模
//   太阳 4.0
//   水星 0.5 (硬编码)
//   火星 0.78 / 金星 0.98 / 地球 1.0
//   海王星 1.72 / 天王星 1.74 / 土星 2.46 / 木星 2.63
//   太阳/木星 = 1.52× ✓
//   大小顺序：水星<火星<金星<地球<海王星<天王星<土星<木星<太阳（与真实完全一致 ✓）
// 距离按真实 AU 比例：DIST_SCALE_REAL = 12
export const SUN_REAL = 4.0;
export const PLANET_POWER_EXP = 0.4;
export const DIST_SCALE_REAL = 12;
export const SUN_REAL_MAX_PLANET_RATIO = 0.85;  // 最大行星不超过太阳 85%
export const MERCURY_MIN_RADIUS = 0.5;          // 水星最小半径（保证不穿模）

/** 真实模式行星半径：realSize^0.4
 *  水星最小 0.5，最大不超过太阳 85%
 */
export function realPlanetRadius(realSize, name) {
  if (name === '水星') return MERCURY_MIN_RADIUS;
  const r = Math.pow(realSize, PLANET_POWER_EXP);
  return Math.min(r, SUN_REAL * SUN_REAL_MAX_PLANET_RATIO);
}

export const PLANETS = [
  {
    name:'水星', en:'Mercury', color:0xb5a187,
    distance:0.39*AU, size:0.42, realSize:0.383, diameterKm:4879,
    orbit:88,   rotation:58.6,  tilt:0.03, eccentricity:0.205,
    texture:'https://threejs.org/examples/textures/planets/mercury.jpg',
    type:'类地行星 · 岩石行星',
    facts:{ diameter:'4,879 km', mass:'3.30×10²³ kg', day:'58.6 地球日', year:'88 地球日',
            temp:'-173 ~ 427 °C', moons:'0', gravity:'3.7 m/s²' },
    fact:'<b>水星</b>是离太阳最近的行星，昼夜温差极大。<br>一个水星日（约 176 地球日）比它的一年还长！<br>它没有大气层保护，陨石坑密布。'
  },
  {
    name:'金星', en:'Venus', color:0xe8c084,
    distance:0.72*AU, size:0.95, realSize:0.949, diameterKm:12104,
    orbit:225,  rotation:-243,  tilt:177.4, eccentricity:0.007,
    texture:'https://threejs.org/examples/textures/planets/venus.jpg',
    type:'类地行星 · 岩石行星',
    facts:{ diameter:'12,104 km', mass:'4.87×10²⁴ kg', day:'243 地球日 (逆向)', year:'225 地球日',
            temp:'462 °C (均温)', moons:'0', gravity:'8.87 m/s²' },
    fact:'<b>金星</b>是太阳系最热的行星，比水星还热！<br>浓厚的二氧化碳大气造成强烈温室效应。<br>它是<b>逆向自转</b>的 —— 太阳从西边升起。'
  },
  {
    name:'地球', en:'Earth', color:0x3a8fd7,
    distance:1.00*AU, size:1.00, realSize:1.000, diameterKm:12742,
    orbit:365.25, rotation:1,   tilt:23.44, eccentricity:0.017,
    texture:'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
    bumpMap:'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg',
    type:'类地行星 · 我们的家园',
    facts:{ diameter:'12,742 km', mass:'5.97×10²⁴ kg', day:'24 小时', year:'365.25 天',
            temp:'-88 ~ 58 °C', moons:'1', gravity:'9.81 m/s²' },
    fact:'<b>地球</b>是已知唯一存在生命的星球。<br>表面 71% 被水覆盖，故称"蓝色弹珠"。<br>月球是它唯一的天然卫星。'
  },
  {
    name:'火星', en:'Mars', color:0xc1440e,
    distance:1.52*AU, size:0.55, realSize:0.532, diameterKm:6779,
    orbit:687,  rotation:1.03, tilt:25.19, eccentricity:0.093,
    texture:'https://threejs.org/examples/textures/planets/mars.jpg',
    type:'类地行星 · 岩石行星',
    facts:{ diameter:'6,779 km', mass:'6.42×10²³ kg', day:'24.6 小时', year:'687 地球日',
            temp:'-63 °C (均温)', moons:'2', gravity:'3.71 m/s²' },
    fact:'<b>火星</b>拥有太阳系最高的山 — 奥林帕斯山（22 km）。<br>表面富含氧化铁，故呈红色，又称"红色行星"。<br>是人类未来移民的首选目标。'
  },
  {
    name:'木星', en:'Jupiter', color:0xd6a878,
    distance:5.20*AU, size:1.6, realSize:11.209, diameterKm:139820,
    orbit:4333, rotation:0.41, tilt:3.13, eccentricity:0.048,
    texture:'https://threejs.org/examples/textures/planets/jupiter.jpg',
    type:'气态巨行星 (Gas Giant)',
    facts:{ diameter:'139,820 km', mass:'1.90×10²⁷ kg', day:'9.9 小时', year:'11.86 年',
            temp:'-145 °C', moons:'95+', gravity:'24.79 m/s²' },
    fact:'<b>木星</b>是太阳系最大的行星，质量是其他所有行星总和的 2.5 倍！<br>大红斑是一个已持续 350+ 年的超级风暴。<br>它是地球的"清道夫"，用引力吸引大量小行星。'
  },
  {
    name:'土星', en:'Saturn', color:0xeacb8b,
    distance:9.58*AU, size:1.4, realSize:9.449, diameterKm:116460,
    orbit:10759, rotation:0.45, tilt:26.73, eccentricity:0.054,
    texture:'https://threejs.org/examples/textures/planets/saturn.jpg',
    ring:true,
    ringInner:3.5, ringOuter:6.5,
    type:'气态巨行星 · 带环行星',
    facts:{ diameter:'116,460 km', mass:'5.68×10²⁶ kg', day:'10.7 小时', year:'29.46 年',
            temp:'-178 °C', moons:'146+', gravity:'10.44 m/s²' },
    fact:'<b>土星</b>的光环主要由冰块和岩石碎片组成，宽度达 28 万 km，但厚度仅 10 m！<br>密度比水还低 —— 理论上它能浮在水上。<br>它有 146 颗已知卫星，是卫星最多的行星。'
  },
  {
    name:'天王星', en:'Uranus', color:0x9fd9e8,
    distance:19.20*AU, size:1.0, realSize:4.007, diameterKm:50724,
    orbit:30687, rotation:-0.72, tilt:97.77, eccentricity:0.047,
    texture:'https://threejs.org/examples/textures/planets/uranus.jpg',
    ring:true, ringInner:2.4, ringOuter:3.2, ringColor:0x556677,
    type:'冰巨行星 (Ice Giant)',
    facts:{ diameter:'50,724 km', mass:'8.68×10²⁵ kg', day:'17.2 小时 (逆向)', year:'84 年',
            temp:'-224 °C', moons:'27', gravity:'8.69 m/s²' },
    fact:'<b>天王星</b>的自转轴倾斜 97.77°，是"躺着"转的！<br>可能源于早期一次巨大碰撞。<br>大气含大量甲烷，呈青蓝色。'
  },
  {
    name:'海王星', en:'Neptune', color:0x4060e0,
    distance:30.05*AU, size:0.95, realSize:3.883, diameterKm:49244,
    orbit:60190, rotation:0.67, tilt:28.32, eccentricity:0.009,
    texture:'https://threejs.org/examples/textures/planets/neptune.jpg',
    type:'冰巨行星 (Ice Giant)',
    facts:{ diameter:'49,244 km', mass:'1.02×10²⁶ kg', day:'16.1 小时', year:'164.8 年',
            temp:'-218 °C', moons:'14', gravity:'11.15 m/s²' },
    fact:'<b>海王星</b>是太阳系最远的行星，风速可达 2,100 km/h！<br>它是 1846 年通过数学计算预测出位置的行星。<br>2012 年完成首次完整公转（自 1846 年发现）。'
  },
];

export const MOON = {
  name:'月球', en:'Moon', parent:'地球',
  distance:2.5, size:0.27, realSize:0.273, diameterKm:3474,
  orbit:27.3, rotation:27.3,
  texture:'https://threejs.org/examples/textures/planets/moon.jpg',
  facts:{ diameter:'3,474 km', mass:'7.35×10²² kg', day:'27.3 地球日', year:'27.3 地球日',
          temp:'-173 ~ 127 °C', moons:'0', gravity:'1.62 m/s²' },
  fact:'<b>月球</b>是地球唯一的天然卫星，约形成于 45 亿年前。<br>它的潮汐作用稳定了地球自转轴。<br>月球正以每年 3.8 cm 的速度远离地球。'
};