/* constants.js — 真实天文数据 + NASA 标准缩放 */

/* ============================================================
   真实天文数据 (NASA fact sheet)
   - size        = 演示模式基准半径（艺术夸张）
   - realSize    = 真实半径（地球 = 1.0，NASA 公约）
   - diameterKm  = NASA 直径 (km)
   - distance    = 与太阳的距离 (AU)
   ============================================================ */
export const AU = 1;  // 单位基准（不再乘 14，所有距离按 AU 直接算）

// ===== NASA 标准距离缩放 =====
// 1 AU = K 世界单位。tycho.ioz 风格：让轨道铺满视野
// K=160 → 水星 62.4 / 地球 160 / 海王星 4808（距离 ×2，宇宙空旷感 ×2）
// 太阳半径同步放大到 12.0，相对比例保持真实
export const DIST_SCALE = 160;

// ===== 太阳半径 =====
// 真实太阳半径 ≈ 109 × 地球，但这样所有行星都变成看不见的尘埃。
// 演示采用 12.0（DIST_SCALE 翻倍后同步翻倍，保持比例协调）
// 占视野比例 ≈ 2×atan(12/300) ≈ 4.6°，FOV 55° 下约占 8%，肉眼可识别为"有体积的天体"
// 信息面板已说明"距离按 AU 真实 · 体积艺术夸张"
export const SUN_R = 12.0;

// ===== 行星半径（按真实相对大小，单位：地球半径）=====
// 真实数据：
//   水星 0.383 / 金星 0.949 / 地球 1.000 / 火星 0.532
//   木星 11.209 / 土星 9.449 / 天王星 4.007 / 海王星 3.883

export const PLANETS = [
  {
    name:'水星', en:'Mercury', color:0xb5a187,
    distance:0.39, size:0.383, realSize:0.383, diameterKm:4879,
    orbit:88,   rotation:58.6,  tilt:0.03, eccentricity:0.205,
    texture:'./src/textures/mercury.jpg',
    type:'类地行星 · 岩石行星',
    facts:{ diameter:'4,879 km', mass:'3.30×10²³ kg', day:'58.6 地球日', year:'88 地球日',
            temp:'-173 ~ 427 °C', moons:'0', gravity:'3.7 m/s²' },
    fact:'<b>水星</b>是离太阳最近的行星，昼夜温差极大。<br>一个水星日（约 176 地球日）比它的一年还长！<br>它没有大气层保护，陨石坑密布。'
  },
  {
    name:'金星', en:'Venus', color:0xe8c084,
    distance:0.72, size:0.949, realSize:0.949, diameterKm:12104,
    orbit:225,  rotation:-243,  tilt:177.4, eccentricity:0.007,
    texture:'./src/textures/venus.jpg',
    type:'类地行星 · 岩石行星',
    facts:{ diameter:'12,104 km', mass:'4.87×10²⁴ kg', day:'243 地球日 (逆向)', year:'225 地球日',
            temp:'462 °C (均温)', moons:'0', gravity:'8.87 m/s²' },
    fact:'<b>金星</b>是太阳系最热的行星，比水星还热！<br>浓厚的二氧化碳大气造成强烈温室效应。<br>它是<b>逆向自转</b>的 —— 太阳从西边升起。'
  },
  {
    name:'地球', en:'Earth', color:0x3a8fd7,
    distance:1.00, size:1.000, realSize:1.000, diameterKm:12742,
    orbit:365.25, rotation:1,   tilt:23.44, eccentricity:0.017,
    texture:'./src/textures/earth.jpg',
    bumpMap:'./src/textures/earth_normal.jpg',
    cloudsTexture:'./src/textures/earth_clouds.jpg',
    type:'类地行星 · 我们的家园',
    facts:{ diameter:'12,742 km', mass:'5.97×10²⁴ kg', day:'24 小时', year:'365.25 天',
            temp:'-88 ~ 58 °C', moons:'1', gravity:'9.81 m/s²' },
    fact:'<b>地球</b>是已知唯一存在生命的星球。<br>表面 71% 被水覆盖，故称"蓝色弹珠"。<br>月球是它唯一的天然卫星。'
  },
  {
    name:'火星', en:'Mars', color:0xc1440e,
    distance:1.52, size:0.532, realSize:0.532, diameterKm:6779,
    orbit:687,  rotation:1.03, tilt:25.19, eccentricity:0.093,
    texture:'./src/textures/mars.jpg',
    type:'类地行星 · 岩石行星',
    facts:{ diameter:'6,779 km', mass:'6.42×10²³ kg', day:'24.6 小时', year:'687 地球日',
            temp:'-63 °C (均温)', moons:'2', gravity:'3.71 m/s²' },
    fact:'<b>火星</b>拥有太阳系最高的山 — 奥林帕斯山（22 km）。<br>表面富含氧化铁，故呈红色，又称"红色行星"。<br>是人类未来移民的首选目标。'
  },
  {
    name:'木星', en:'Jupiter', color:0xd6a878,
    distance:5.20, size:11.21, realSize:11.209, diameterKm:139820,
    orbit:4333, rotation:0.41, tilt:3.13, eccentricity:0.048,
    texture:'./src/textures/jupiter.jpg',
    type:'气态巨行星 (Gas Giant)',
    facts:{ diameter:'139,820 km', mass:'1.90×10²⁷ kg', day:'9.9 小时', year:'11.86 年',
            temp:'-145 °C', moons:'95+', gravity:'24.79 m/s²' },
    fact:'<b>木星</b>是太阳系最大的行星，质量是其他所有行星总和的 2.5 倍！<br>大红斑是一个已持续 350+ 年的超级风暴。<br>它是地球的"清道夫"，用引力吸引大量小行星。'
  },
  {
    name:'土星', en:'Saturn', color:0xeacb8b,
    distance:9.58, size:9.45, realSize:9.449, diameterKm:116460,
    orbit:10759, rotation:0.45, tilt:26.73, eccentricity:0.054,
    texture:'./src/textures/saturn.jpg',
    ringTexture:'./src/textures/saturn_ring.jpg',
    ring:true,
    ringInner:3.5, ringOuter:6.5,
    type:'气态巨行星 · 带环行星',
    facts:{ diameter:'116,460 km', mass:'5.68×10²⁶ kg', day:'10.7 小时', year:'29.46 年',
            temp:'-178 °C', moons:'146+', gravity:'10.44 m/s²' },
    fact:'<b>土星</b>的光环主要由冰块和岩石碎片组成，宽度达 28 万 km，但厚度仅 10 m！<br>密度比水还低 —— 理论上它能浮在水上。<br>它有 146 颗已知卫星，是卫星最多的行星。'
  },
  {
    name:'天王星', en:'Uranus', color:0x9fd9e8,
    distance:19.20, size:4.01, realSize:4.007, diameterKm:50724,
    orbit:30687, rotation:-0.72, tilt:97.77, eccentricity:0.047,
    texture:'./src/textures/uranus.jpg',
    ringTexture:'./src/textures/uranus_ring.jpg',
    ring:true, ringInner:2.4, ringOuter:3.2, ringColor:0x556677,
    type:'冰巨行星 (Ice Giant)',
    facts:{ diameter:'50,724 km', mass:'8.68×10²⁵ kg', day:'17.2 小时 (逆向)', year:'84 年',
            temp:'-224 °C', moons:'27', gravity:'8.69 m/s²' },
    fact:'<b>天王星</b>的自转轴倾斜 97.77°，是"躺着"转的！<br>可能源于早期一次巨大碰撞。<br>大气含大量甲烷，呈青蓝色。'
  },
  {
    name:'海王星', en:'Neptune', color:0x4060e0,
    distance:30.05, size:3.88, realSize:3.883, diameterKm:49244,
    orbit:60190, rotation:0.67, tilt:28.32, eccentricity:0.009,
    texture:'./src/textures/neptune.jpg',
    type:'冰巨行星 (Ice Giant)',
    facts:{ diameter:'49,244 km', mass:'1.02×10²⁶ kg', day:'16.1 小时', year:'164.8 年',
            temp:'-218 °C', moons:'14', gravity:'11.15 m/s²' },
    fact:'<b>海王星</b>是太阳系最远的行星，风速可达 2,100 km/h！<br>它是 1846 年通过数学计算预测出位置的行星。<br>2012 年完成首次完整公转（自 1846 年发现）。'
  },
];

/* 月球（地球的卫星）
 * 真实：月地距离 60 地球半径，月球/地球半径 0.27
 * 演示：距离 8.0（演示上明显远离地球，但仍肉眼可识别月球 + 陨石坑纹理，
 *              且 tracking 地球时相机距离 ~5 单位，月球在视野边缘可见）
 *       大小 0.25（比真实 0.27 略小，让月球看上去明显小于地球但不至于完全消失）
 *       距离 8 = 8 地球半径，介于真实 60 地球半径和当前 3 的折中值 */
export const MOON = {
  name:'月球', en:'Moon', parent:'地球',
  distance:8.0, size:0.25, realSize:0.273, diameterKm:3474,
  orbit:27.3, rotation:27.3,
  texture:'./src/textures/moon.jpg',
  facts:{ diameter:'3,474 km', mass:'7.35×10²² kg', day:'27.3 地球日', year:'27.3 地球日',
          temp:'-173 ~ 127 °C', moons:'0', gravity:'1.62 m/s²' },
  fact:'<b>月球</b>是地球唯一的天然卫星，约形成于 45 亿年前。<br>它的潮汐作用稳定了地球自转轴。<br>月球正以每年 3.8 cm 的速度远离地球。'
};

/* 行星尺寸信息（用于太阳相对大小比较）*/
export const SUN_FACTS = {
  diameterKm: 1392700,
  mass: '1.99×10³⁰ kg',
  age: '46 亿年',
  temp: '表面 5,500 °C · 核心 1,500 万 °C',
  gravity: '274 m/s²',
  luminosity: '3.83×10²⁶ W'
};