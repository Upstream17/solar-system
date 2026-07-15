/* constants.js — 真实天文数据 + NASA 标准缩放 (v20260702f)
 *
 * v20260702f: 每个天体加 typeZh / typeEn / factZh / factEn
 * — 之前 type 和 fact 是 hardcode 中文, info-panel EN 模式切不动
 * — 现在每颗星球的描述都自带双语, ui.js 按 lang 选
 */

/* ============================================================
   真实天文数据 (NASA / JPL)
   - size        = 演示模式基准半径（艺术夸张）
   - realSize    = 真实半径（地球 = 1.0，NASA 公约）
   - diameterKm  = NASA 直径 (km)
   - distance    = 与太阳的距离 (AU)
   - orbital elements = JPL Approximate Positions of the Planets, Table 1 (J2000, 1800-2050)
     a/e/I/ϖ/Ω: semi-major axis / eccentricity / inclination to ecliptic / longitude of perihelion / longitude of ascending node
   ============================================================ */
export const AU = 1;  // 单位基准（不再乘 14，所有距离按 AU 直接算）

// ===== NASA 标准距离缩放 =====
// v20260707: 真实化轨道（×16），水星从 5.2 太阳直径远 → 真实 83 太阳直径远
//   - DIST_SCALE 160 → 2560
//   - 海王星在 76928 世界单位；要求 camera.far >= 200000, OrbitControls.maxDistance >= 100000
//   - 配合 planets.js 的 THREE.LOD 远距离小点方案
export const DIST_SCALE = 2560;

// ===== 太阳半径 =====
export const SUN_R = 12.0;

export const PLANETS = [
  {
    name:'水星', en:'Mercury', color:0xb5a187,
    distance:0.38709927, size:0.383, realSize:0.383, diameterKm:4879,
    orbit:88,   rotation:58.6,  tilt:0.03, eccentricity:0.20563593,
    // JPL Keplerian elements (J2000): I=黄道面倾角, Ω=升交点黄经, ϖ=近日点黄经
    inclination:7.00497902, ascendingNode:48.33076593, perihelion:77.45779628,
    orbitColor:0xb8a08a,
    texture:'./src/textures/mercury.jpg',
    typeZh:'类地行星 · 岩石行星',
    typeEn:'Terrestrial · Rocky Planet',
    factsZh:{ diameter:'4,879 km', mass:'3.30×10²³ kg', day:'58.6 地球日', year:'88 地球日',
              temp:'-173 ~ 427 °C', moons:'0', gravity:'3.7 m/s²' },
    factsEn:{ diameter:'4,879 km', mass:'3.30×10²³ kg', day:'58.6 Earth days', year:'88 Earth days',
              temp:'-173 ~ 427 °C', moons:'0', gravity:'3.7 m/s²' },
    factZh:'<b>水星</b>是离太阳最近的行星，昼夜温差极大。<br>一个水星日（约 176 地球日）比它的一年还长！<br>它没有大气层保护，陨石坑密布。',
    factEn:'<b>Mercury</b> is the closest planet to the Sun, with extreme day-night temperature swings.<br>One Mercury day (~176 Earth days) is longer than its year!<br>It has no atmosphere, leaving its surface covered in craters.'
  },
  {
    name:'金星', en:'Venus', color:0xe8c084,
    distance:0.72333566, size:0.949, realSize:0.949, diameterKm:12104,
    orbit:225,  rotation:-243,  tilt:177.4, eccentricity:0.00677672,
    inclination:3.39467605, ascendingNode:76.67984255, perihelion:131.60246718,
    orbitColor:0xffc46f,
    texture:'./src/textures/venus.jpg',
    typeZh:'类地行星 · 岩石行星',
    typeEn:'Terrestrial · Rocky Planet',
    factsZh:{ diameter:'12,104 km', mass:'4.87×10²⁴ kg', day:'243 地球日 (逆向)', year:'225 地球日',
              temp:'462 °C (均温)', moons:'0', gravity:'8.87 m/s²' },
    factsEn:{ diameter:'12,104 km', mass:'4.87×10²⁴ kg', day:'243 Earth days (retrograde)', year:'225 Earth days',
              temp:'462 °C (avg)', moons:'0', gravity:'8.87 m/s²' },
    factZh:'<b>金星</b>是太阳系最热的行星，比水星还热！<br>浓厚的二氧化碳大气造成强烈温室效应。<br>它是<b>逆向自转</b>的 —— 太阳从西边升起。',
    factEn:'<b>Venus</b> is the hottest planet in the Solar System, even hotter than Mercury!<br>Its thick CO₂ atmosphere creates a runaway greenhouse effect.<br>It rotates <b>retrograde</b> — the Sun rises in the west.'
  },
  {
    name:'地球', en:'Earth', color:0x3a8fd7,
    distance:1.00000261, size:1.000, realSize:1.000, diameterKm:12742,
    orbit:365.25, rotation:1,   tilt:23.44, eccentricity:0.01671123,
    inclination:-0.00001531, ascendingNode:0.0, perihelion:102.93768193,
    orbitColor:0x48a9ff,
    texture:'./src/textures/earth.jpg',
    bumpMap:'./src/textures/earth_normal.jpg',
    cloudsTexture:'./src/textures/earth_clouds.jpg',
    typeZh:'类地行星 · 我们的家园',
    typeEn:'Terrestrial · Our Home',
    factsZh:{ diameter:'12,742 km', mass:'5.97×10²⁴ kg', day:'24 小时', year:'365.25 天',
              temp:'-88 ~ 58 °C', moons:'1', gravity:'9.81 m/s²' },
    factsEn:{ diameter:'12,742 km', mass:'5.97×10²⁴ kg', day:'24 hours', year:'365.25 days',
              temp:'-88 ~ 58 °C', moons:'1', gravity:'9.81 m/s²' },
    factZh:'<b>地球</b>是已知唯一存在生命的星球。<br>表面 71% 被水覆盖，故称"蓝色弹珠"。<br>月球是它唯一的天然卫星。',
    factEn:'<b>Earth</b> is the only known planet that harbors life.<br>71% of its surface is covered by water, hence "the Blue Marble".<br>The Moon is its only natural satellite.'
  },
  {
    name:'火星', en:'Mars', color:0xc1440e,
    distance:1.52371034, size:0.532, realSize:0.532, diameterKm:6779,
    orbit:687,  rotation:1.03, tilt:25.19, eccentricity:0.09339410,
    inclination:1.84969142, ascendingNode:49.55953891, perihelion:336.05637041,
    orbitColor:0xff6b3d,
    texture:'./src/textures/mars.jpg',
    typeZh:'类地行星 · 岩石行星',
    typeEn:'Terrestrial · Rocky Planet',
    factsZh:{ diameter:'6,779 km', mass:'6.42×10²³ kg', day:'24.6 小时', year:'687 地球日',
              temp:'-63 °C (均温)', moons:'2', gravity:'3.71 m/s²' },
    factsEn:{ diameter:'6,779 km', mass:'6.42×10²³ kg', day:'24.6 hours', year:'687 Earth days',
              temp:'-63 °C (avg)', moons:'2', gravity:'3.71 m/s²' },
    factZh:'<b>火星</b>拥有太阳系最高的山 — 奥林帕斯山（22 km）。<br>表面富含氧化铁，故呈红色，又称"红色行星"。<br>是人类未来移民的首选目标。',
    factEn:'<b>Mars</b> hosts the tallest mountain in the Solar System — Olympus Mons (22 km).<br>Its iron oxide-rich surface gives it a red hue, hence "the Red Planet".<br>It is the prime candidate for future human colonization.'
  },
  {
    name:'木星', en:'Jupiter', color:0xd6a878,
    distance:5.20288700, size:11.21, realSize:11.209, diameterKm:139820,
    orbit:4333, rotation:0.41, tilt:3.13, eccentricity:0.04838624,
    inclination:1.30439695, ascendingNode:100.47390909, perihelion:14.72847983,
    orbitColor:0xf0a35e,
    texture:'./src/textures/jupiter.jpg',
    typeZh:'气态巨行星',
    typeEn:'Gas Giant',
    factsZh:{ diameter:'139,820 km', mass:'1.90×10²⁷ kg', day:'9.9 小时', year:'11.86 年',
              temp:'-145 °C', moons:'95+', gravity:'24.79 m/s²' },
    factsEn:{ diameter:'139,820 km', mass:'1.90×10²⁷ kg', day:'9.9 hours', year:'11.86 years',
              temp:'-145 °C', moons:'95+', gravity:'24.79 m/s²' },
    factZh:'<b>木星</b>是太阳系最大的行星，质量是其他所有行星总和的 2.5 倍！<br>大红斑是一个已持续 350+ 年的超级风暴。<br>它是地球的"清道夫"，用引力吸引大量小行星。',
    factEn:'<b>Jupiter</b> is the largest planet in the Solar System, 2.5× more massive than all other planets combined!<br>The Great Red Spot is a super-storm that has persisted for 350+ years.<br>It acts as Earth\'s "cosmic vacuum cleaner", deflecting asteroids with its gravity.'
  },
  {
    name:'土星', en:'Saturn', color:0xeacb8b,
    distance:9.53667594, size:9.45, realSize:9.449, diameterKm:116460,
    orbit:10759, rotation:0.45, tilt:26.73, eccentricity:0.05386179,
    inclination:2.48599187, ascendingNode:113.66242448, perihelion:92.59887831,
    orbitColor:0xe6d58a,
    texture:'./src/textures/saturn.jpg',
    ringTexture:'./src/textures/saturn_ring.png',
    ring:true,
    ringInner:1.24, ringOuter:2.34,
    typeZh:'气态巨行星 · 带环行星',
    typeEn:'Gas Giant · Ringed',
    factsZh:{ diameter:'116,460 km', mass:'5.68×10²⁶ kg', day:'10.7 小时', year:'29.46 年',
              temp:'-178 °C', moons:'146+', gravity:'10.44 m/s²' },
    factsEn:{ diameter:'116,460 km', mass:'5.68×10²⁶ kg', day:'10.7 hours', year:'29.46 years',
              temp:'-178 °C', moons:'146+', gravity:'10.44 m/s²' },
    factZh:'<b>土星</b>的光环主要由冰块和岩石碎片组成，宽度达 28 万 km，但厚度仅 10 m！<br>密度比水还低 —— 理论上它能浮在水上。<br>它有 146 颗已知卫星，是卫星最多的行星。',
    factEn:'<b>Saturn</b>\'s rings are made of ice and rock fragments, 280,000 km wide but only 10 m thick!<br>Its density is lower than water — theoretically it could float in a bathtub.<br>It has 146 known moons, the most of any planet.'
  },
  {
    name:'天王星', en:'Uranus', color:0x9fd9e8,
    distance:19.18916464, size:4.01, realSize:4.007, diameterKm:50724,
    orbit:30687, rotation:-0.72, tilt:97.77, eccentricity:0.04725744,
    inclination:0.77263783, ascendingNode:74.01692503, perihelion:170.95427630,
    orbitColor:0x6fe7e9,
    texture:'./src/textures/uranus.jpg',
    ringTexture:'./src/textures/uranus_ring.jpg',
    // v20260711: 缩天王星 ring 外半径 (realSize*3.2 → 1.6) — 之前 12.8u ≈ 3 倍 mesh 直径, 近距镜头下会遮挡 mesh + 让人以为 mesh 偏离轨道
    ring:true, ringInner:1.54, ringOuter:2.02, ringColor:0x556677,
    typeZh:'冰巨行星',
    typeEn:'Ice Giant',
    factsZh:{ diameter:'50,724 km', mass:'8.68×10²⁵ kg', day:'17.2 小时 (逆向)', year:'84 年',
              temp:'-224 °C', moons:'27', gravity:'8.69 m/s²' },
    factsEn:{ diameter:'50,724 km', mass:'8.68×10²⁵ kg', day:'17.2 hours (retrograde)', year:'84 years',
              temp:'-224 °C', moons:'27', gravity:'8.69 m/s²' },
    factZh:'<b>天王星</b>的自转轴倾斜 97.77°，是"躺着"转的！<br>可能源于早期一次巨大碰撞。<br>大气含大量甲烷，呈青蓝色。',
    factEn:'<b>Uranus</b>\'s axis is tilted 97.77°, meaning it rolls on its side!<br>It likely suffered a massive collision early in its history.<br>Its methane-rich atmosphere gives it a cyan color.'
  },
  {
    name:'海王星', en:'Neptune', color:0x4060e0,
    distance:30.06992276, size:3.88, realSize:3.883, diameterKm:49244,
    orbit:60190, rotation:0.67, tilt:28.32, eccentricity:0.00859048,
    inclination:1.77004347, ascendingNode:131.78422574, perihelion:44.96476227,
    orbitColor:0x6a7cff,
    texture:'./src/textures/neptune.jpg',
    typeZh:'冰巨行星',
    typeEn:'Ice Giant',
    factsZh:{ diameter:'49,244 km', mass:'1.02×10²⁶ kg', day:'16.1 小时', year:'164.8 年',
              temp:'-218 °C', moons:'14', gravity:'11.15 m/s²' },
    factsEn:{ diameter:'49,244 km', mass:'1.02×10²⁶ kg', day:'16.1 hours', year:'164.8 years',
              temp:'-218 °C', moons:'14', gravity:'11.15 m/s²' },
    factZh:'<b>海王星</b>是太阳系最远的行星，风速可达 2,100 km/h！<br>它是 1846 年通过数学计算预测出位置的行星。<br>2012 年完成首次完整公转（自 1846 年发现）。',
    factEn:'<b>Neptune</b> is the most distant planet, with winds reaching 2,100 km/h!<br>It was the first planet discovered through mathematical prediction in 1846.<br>It completed its first full orbit since discovery in 2012.'
  },
];

/* 月球 (基线: 一直存在) */
export const MOON = {
  name:'月球', en:'Moon', parent:'地球',
  distance:8.0, size:0.25, realSize:0.273, diameterKm:3474,
  orbit:27.3, rotation:27.3,
  // v20260708: 月球轨道偏心率 (NASA: 0.0549)
  //   真实月球距地球 363,300 km (近地点) 到 405,500 km (远地点)
  //   演示值: r = 8.0 × (1 - 0.0549²) / (1 + 0.0549 × cos(theta))
  //          r ∈ [7.56, 8.44] (相对单位)
  //   main.js tick 里每帧用这个公式算 r
  eccentricity:0.0549,
  inclination:5.145,
  texture:'./src/textures/moon.jpg',
  color:0xc0b89e,
  typeZh:'地球的天然卫星',
  typeEn:'Earth\'s Natural Satellite',
  factsZh:{ diameter:'3,474 km', mass:'7.35×10²² kg', day:'27.3 地球日', year:'27.3 地球日',
            temp:'-173 ~ 127 °C', moons:'0', gravity:'1.62 m/s²' },
  factsEn:{ diameter:'3,474 km', mass:'7.35×10²² kg', day:'27.3 Earth days', year:'27.3 Earth days',
            temp:'-173 ~ 127 °C', moons:'0', gravity:'1.62 m/s²' },
  factZh:'<b>月球</b>是地球唯一的天然卫星，约形成于 45 亿年前。<br>它的潮汐作用稳定了地球自转轴。<br>月球正以每年 3.8 cm 的速度远离地球。',
  factEn:'<b>The Moon</b> is Earth\'s only natural satellite, formed about 4.5 billion years ago.<br>Its tidal forces stabilize Earth\'s axial tilt.<br>The Moon is drifting away from Earth at 3.8 cm per year.'
};

/* v20260712: 其他行星主要卫星 (Moon System 扩展)
 * 数据来源: Wikipedia "Moons of X" + NASA Planetary Fact Sheet (JPL)
 * 选择标准: 每行星最大/最有特征的卫星,优先考虑:
 *   - 火星: 全部 2 颗 (只有 2 颗)
 *   - 木星: 4 颗伽利略卫星 + Amalthea (最大内卫星)
 *   - 土星: Titan (最大,有大气) + Rhea + Iapetus (双色) + Tethys + Dione + Mimas (死星)
 *   - 天王星: 全部 5 颗主卫星 (Miranda, Ariel, Umbriel, Titania, Oberon)
 *   - 海王星: Triton (唯一重要的,逆向公转)
 * 共 19 颗新卫星 + 现有月球 = 20 颗
 *
 * 字段说明:
 *   distance   — 演示值,绕母行星的距离(场景单位)
 *   size       — 演示值,几何半径(场景单位)
 *   realSize   — 真实半径相对地球 (NASA 数据)
 *   eccentricity — 轨道偏心率 (JPL)
 *   inclination  — 轨道相对黄道面倾角 (度)
 *   orbit      — 公转周期(地球日);负值表示逆向公转
 *   color      — UI 颜色 (legend dot)
 *   texture    — 默认共享 moon.jpg (项目里没有单独卫星贴图)
 */
export const MOONS = [
  // ===== 火星 (Mars) =====
  { name:'火卫一', en:'Phobos', parent:'火星',
    distance:1.6, size:0.04, realSize:22.2/12742, diameterKm:22.2,
    orbit:0.319, rotation:0.319, eccentricity:0.0151, inclination:1.093,
    color:0xa89078, texture:'./src/textures/phobos.jpg',
    typeZh:'火星的内卫星', typeEn:'Mars\' Inner Moon',
    factsZh:{ diameter:'22.2 km', mass:'1.07×10¹⁶ kg', day:'7h 39m', year:'7h 39m',
              temp:'-40 °C', moons:'0', gravity:'0.0057 m/s²' },
    factsEn:{ diameter:'22.2 km', mass:'1.07×10¹⁶ kg', day:'7h 39m', year:'7h 39m',
              temp:'-40 °C', moons:'0', gravity:'0.0057 m/s²' },
    factZh:'<b>火卫一 (Phobos)</b>是火星两颗卫星中较大的一颗。<br>距火星仅 9,377 km — 比地球同步卫星还近。<br>由于潮汐作用，它正以每百年 ~2 cm 的速度向火星靠近，预计 5,000 万年内将解体或撞上火星。',
    factEn:'<b>Phobos</b> is the larger of Mars\' two moons.<br>It orbits Mars at only ~9,377 km — closer than a synchronous satellite.<br>Due to tidal deceleration, it spirals inward at ~2 cm per century and will break up or crash into Mars within ~50 million years.' },
  { name:'火卫二', en:'Deimos', parent:'火星',
    distance:2.6, size:0.025, realSize:12.6/12742, diameterKm:12.6,
    orbit:1.263, rotation:1.263, eccentricity:0.00033, inclination:0.93,
    color:0x9c806a, texture:'./src/textures/deimos.jpg',
    typeZh:'火星的外卫星', typeEn:'Mars\' Outer Moon',
    factsZh:{ diameter:'12.6 km', mass:'1.5×10¹⁵ kg', day:'30h 18m', year:'30h 18m',
              temp:'-40 °C', moons:'0', gravity:'0.003 m/s²' },
    factsEn:{ diameter:'12.6 km', mass:'1.5×10¹⁵ kg', day:'30h 18m', year:'30h 18m',
              temp:'-40 °C', moons:'0', gravity:'0.003 m/s²' },
    factZh:'<b>火卫二 (Deimos)</b>是火星较小的卫星。<br>非常暗 (反照率 0.07)，可能是被火星引力捕获的小行星。<br>它在火星天空中几乎看不见 — 距离火星太远，亮度比金星还低。',
    factEn:'<b>Deimos</b> is the smaller of Mars\' two moons.<br>It is very dark (albedo 0.07) and may be a captured asteroid.<br>It is barely visible in the Martian sky, fainter than Venus from Earth.' },
  // ===== 木星 (Jupiter) =====
  { name:'木卫五', en:'Amalthea', parent:'木星',
    distance:14, size:0.05, realSize:167/12742, diameterKm:167,
    orbit:0.499, rotation:0.499, eccentricity:0.0032, inclination:0.374,
    color:0xa05028, texture:'./src/textures/moon.jpg',
    typeZh:'木星的内卫星', typeEn:'Jupiter\'s Inner Moon',
    factsZh:{ diameter:'167 km', mass:'2.1×10¹⁸ kg', day:'11h 58m', year:'11h 58m',
              temp:'-160 °C', moons:'0', gravity:'0.02 m/s²' },
    factsEn:{ diameter:'167 km', mass:'2.1×10¹⁸ kg', day:'11h 58m', year:'11h 58m',
              temp:'-160 °C', moons:'0', gravity:'0.02 m/s²' },
    factZh:'<b>木卫五 (Amalthea)</b>是木星最内侧的伽利略卫星之一。<br>形状不规则 (250×146×128 km)，表面被木卫一抛出的硫磺沉积物覆盖呈红色。<br>1892 年由爱德华·巴纳德发现 — 是最后一颗用肉眼发现的卫星。',
    factEn:'<b>Amalthea</b> is the innermost of Jupiter\'s Galilean-group moons.<br>Irregularly shaped (250×146×128 km), its surface is coated with reddish sulfur deposits ejected from Io.<br>Discovered in 1892 by Edward Barnard — the last moon discovered by visual observation.' },
  { name:'木卫一', en:'Io', parent:'木星',
    distance:17, size:0.55, realSize:3642.6/12742, diameterKm:3643,
    orbit:1.769, rotation:1.769, eccentricity:0.0041, inclination:0.05,
    color:0xf4d35e, texture:'./src/textures/io.jpg',
    typeZh:'木星的火山卫星 · 伽利略卫星', typeEn:'Jupiter\'s Volcanic Moon · Galilean',
    factsZh:{ diameter:'3,643 km', mass:'8.93×10²² kg', day:'1.77 天', year:'1.77 天',
              temp:'-130 °C', moons:'0', gravity:'1.79 m/s²' },
    factsEn:{ diameter:'3,643 km', mass:'8.93×10²² kg', day:'1.77 days', year:'1.77 days',
              temp:'-130 °C', moons:'0', gravity:'1.79 m/s²' },
    factZh:'<b>木卫一 (Io)</b>是太阳系内最活跃的火山天体。<br>因木星引力潮汐加热，内部熔融，拥有 400+ 座活火山。<br>表面被硫磺覆盖呈黄、橙、红色，没有撞击坑。',
    factEn:'<b>Io</b> is the most volcanically active body in the Solar System.<br>Tidal heating from Jupiter keeps its interior molten, sustaining 400+ active volcanoes.<br>Its surface is coated in sulfur — yellow, orange, red — and has no impact craters.' },
  { name:'木卫二', en:'Europa', parent:'木星',
    distance:21, size:0.50, realSize:3121.6/12742, diameterKm:3122,
    orbit:3.550, rotation:3.550, eccentricity:0.0094, inclination:0.47,
    color:0xdce3ed, texture:'./src/textures/europa.jpg',
    typeZh:'木星的冰卫星 · 伽利略卫星', typeEn:'Jupiter\'s Icy Moon · Galilean',
    factsZh:{ diameter:'3,122 km', mass:'4.80×10²² kg', day:'3.55 天', year:'3.55 天',
              temp:'-170 °C', moons:'0', gravity:'1.31 m/s²' },
    factsEn:{ diameter:'3,122 km', mass:'4.80×10²² kg', day:'3.55 days', year:'3.55 days',
              temp:'-170 °C', moons:'0', gravity:'1.31 m/s²' },
    factZh:'<b>木卫二 (Europa)</b>表面是光滑的冰层，下方有液态水海洋 (深度可达 100 km)。<br>被认为是太阳系内最可能存在地外生命的地方之一。<br>NASA Europa Clipper 任务于 2024 年发射，预计 2030 年抵达。',
    factEn:'<b>Europa</b> has a smooth icy crust over a deep subsurface ocean (up to 100 km deep).<br>It is one of the most promising places to find extraterrestrial life in the Solar System.<br>NASA\'s Europa Clipper launched in 2024 and is expected to arrive in 2030.' },
  { name:'木卫三', en:'Ganymede', parent:'木星',
    distance:26, size:0.70, realSize:5268.2/12742, diameterKm:5268,
    orbit:7.155, rotation:7.155, eccentricity:0.0011, inclination:0.20,
    color:0xc4b39a, texture:'./src/textures/ganymede.jpg',
    typeZh:'太阳系最大的卫星 · 伽利略卫星', typeEn:'Solar System\'s Largest Moon · Galilean',
    factsZh:{ diameter:'5,268 km', mass:'1.48×10²³ kg', day:'7.16 天', year:'7.16 天',
              temp:'-160 °C', moons:'0', gravity:'1.43 m/s²' },
    factsEn:{ diameter:'5,268 km', mass:'1.48×10²³ kg', day:'7.16 days', year:'7.16 days',
              temp:'-160 °C', moons:'0', gravity:'1.43 m/s²' },
    factZh:'<b>木卫三 (Ganymede)</b>是太阳系最大的卫星，比水星还大。<br>是唯一拥有自己磁场的卫星 — 内核有液态金属对流。<br>表面有暗区 (古老) 和亮区 (年轻)，可能也有地下海洋。',
    factEn:'<b>Ganymede</b> is the largest moon in the Solar System — larger than Mercury.<br>It is the only moon with its own magnetic field, generated by a liquid-metal core.<br>Its surface shows both dark (ancient) and bright (younger) terrain, and may harbor a subsurface ocean.' },
  { name:'木卫四', en:'Callisto', parent:'木星',
    distance:32, size:0.65, realSize:4820.6/12742, diameterKm:4821,
    orbit:16.69, rotation:16.69, eccentricity:0.0074, inclination:0.19,  // Callisto incl: 0.19° to Jupiter's equator (Galilean co-planar); 2.017° to ecliptic
    color:0x6e6258, texture:'./src/textures/callisto.jpg',
    typeZh:'木星最远的伽利略卫星', typeEn:'Jupiter\'s Outermost Galilean',
    factsZh:{ diameter:'4,821 km', mass:'1.08×10²³ kg', day:'16.69 天', year:'16.69 天',
              temp:'-140 °C', moons:'0', gravity:'1.24 m/s²' },
    factsEn:{ diameter:'4,821 km', mass:'1.08×10²³ kg', day:'16.69 days', year:'16.69 days',
              temp:'-140 °C', moons:'0', gravity:'1.24 m/s²' },
    factZh:'<b>木卫四 (Callisto)</b>是太阳系撞击坑最多的天体之一。<br>表面古老而稳定，可能是太阳系最原始的天体之一。<br>2024 年的木卫四飞越任务 JUICE 主要目标之一。',
    factEn:'<b>Callisto</b> has the most heavily cratered surface of any known body in the Solar System.<br>Its surface is ancient and undisturbed, possibly the most pristine in the Solar System.<br>It is a primary target of ESA\'s JUICE mission (arriving 2031).' },
  // ===== 土星 (Saturn) =====
  { name:'土卫一', en:'Mimas', parent:'土星',
    distance:16, size:0.05, realSize:396/12742, diameterKm:396,
    orbit:0.942, rotation:0.942, eccentricity:0.0202, inclination:1.6,
    color:0xc8c2b3, texture:'./src/textures/mimas.jpg',
    typeZh:'土星的"死星"卫星', typeEn:'Saturn\'s "Death Star" Moon',
    factsZh:{ diameter:'396 km', mass:'4×10¹⁹ kg', day:'22h 36m', year:'22h 36m',
              temp:'-210 °C', moons:'0', gravity:'0.064 m/s²' },
    factsEn:{ diameter:'396 km', mass:'4×10¹⁹ kg', day:'22h 36m', year:'22h 36m',
              temp:'-210 °C', moons:'0', gravity:'0.064 m/s²' },
    factZh:'<b>土卫一 (Mimas)</b>直径仅 396 km，最显著的特征是 130 km 宽的赫歇尔撞击坑。<br>比例上占卫星直径的 1/3，使它看起来像《星球大战》中的"死星"。<br>它的引力扰动塑造了土星环中的卡西尼缝。',
    factEn:'<b>Mimas</b> is just 396 km across but dominated by the 130-km Herschel crater.<br>That crater is 1/3 the moon\'s diameter, giving it the appearance of the "Death Star".<br>Its gravity sculpts Saturn\'s Cassini Division in the rings.' },
  { name:'土卫三', en:'Tethys', parent:'土星',
    distance:20, size:0.16, realSize:1062/12742, diameterKm:1062,
    orbit:1.888, rotation:1.888, eccentricity:0.0001, inclination:1.1,
    color:0xd8d3c4, texture:'./src/textures/tethys.jpg',
    typeZh:'土星的冰卫星', typeEn:'Saturn\'s Icy Moon',
    factsZh:{ diameter:'1,062 km', mass:'6.2×10²⁰ kg', day:'1.89 天', year:'1.89 天',
              temp:'-187 °C', moons:'0', gravity:'0.146 m/s²' },
    factsEn:{ diameter:'1,062 km', mass:'6.2×10²⁰ kg', day:'1.89 days', year:'1.89 days',
              temp:'-187 °C', moons:'0', gravity:'0.146 m/s²' },
    factZh:'<b>土卫三 (Tethys)</b>是土星系统中最亮的卫星之一，反照率高达 1.0。<br>表面有巨大的奥德赛撞击坑 (400 km) 和一条赤道峡谷 Ithaca Chasma (100 km 宽)。<br>主要由水冰组成，密度仅 0.985 g/cm³。',
    factEn:'<b>Tethys</b> is one of the brightest moons in the Saturn system, with albedo 1.0.<br>Its surface bears the giant 400-km Odysseus crater and the 100-km-wide Ithaca Chasma.<br>Composed mainly of water ice, density just 0.985 g/cm³.' },
  { name:'土卫四', en:'Dione', parent:'土星',
    distance:24, size:0.17, realSize:1123/12742, diameterKm:1123,
    orbit:2.737, rotation:2.737, eccentricity:0.0022, inclination:0.0,
    color:0xc4bba9, texture:'./src/textures/dione.jpg',
    typeZh:'土星的冰卫星', typeEn:'Saturn\'s Icy Moon',
    factsZh:{ diameter:'1,123 km', mass:'1.1×10²¹ kg', day:'2.74 天', year:'2.74 天',
              temp:'-186 °C', moons:'0', gravity:'0.231 m/s²' },
    factsEn:{ diameter:'1,123 km', mass:'1.1×10²¹ kg', day:'2.74 days', year:'2.74 days',
              temp:'-186 °C', moons:'0', gravity:'0.231 m/s²' },
    factZh:'<b>土卫四 (Dione)</b>是土星第四大卫星。<br>有由冰和岩石组成的高密度 (1.478 g/cm³)，暗示内部有较大的硅酸盐核。<br>表面布满明亮条纹 — 可能是古老冰喷泉留下的痕迹。',
    factEn:'<b>Dione</b> is Saturn\'s fourth-largest moon.<br>With density 1.478 g/cm³, it has a large silicate core beneath the ice.<br>Bright wispy streaks on its surface may be traces of ancient cryovolcanic activity.' },
  { name:'土卫五', en:'Rhea', parent:'土星',
    distance:29, size:0.23, realSize:1528/12742, diameterKm:1528,
    orbit:4.518, rotation:4.518, eccentricity:0.0013, inclination:0.3,
    color:0x9c9485, texture:'./src/textures/rhea.jpg',
    typeZh:'土星的冰卫星 · 第二大卫星', typeEn:'Saturn\'s Icy Moon · 2nd Largest',
    factsZh:{ diameter:'1,528 km', mass:'2.3×10²¹ kg', day:'4.52 天', year:'4.52 天',
              temp:'-174 °C', moons:'0', gravity:'0.264 m/s²' },
    factsEn:{ diameter:'1,528 km', mass:'2.3×10²¹ kg', day:'4.52 days', year:'4.52 days',
              temp:'-174 °C', moons:'0', gravity:'0.264 m/s²' },
    factZh:'<b>土卫五 (Rhea)</b>是土星第二大卫星。<br>主要由水冰组成 (占 75%)，是太阳系第九大卫星。<br>卡西尼号曾在它附近发现稀薄的氧气与二氧化碳大气层。',
    factEn:'<b>Rhea</b> is Saturn\'s second-largest moon, the 9th largest in the Solar System.<br>Composed of ~75% water ice, it has a faint oxygen-CO₂ atmosphere detected by Cassini.<br>It may even have a tenuous ring system.' },
  { name:'土卫六', en:'Titan', parent:'土星',
    distance:42, size:0.78, realSize:5149/12742, diameterKm:5149,
    orbit:15.945, rotation:15.945, eccentricity:0.0288, inclination:0.3,
    color:0xd49e58, texture:'./src/textures/titan.jpg',
    typeZh:'土星最大卫星 · 唯一拥有浓密大气的卫星', typeEn:'Saturn\'s Largest · Only Moon with Thick Atmosphere',
    factsZh:{ diameter:'5,149 km', mass:'1.35×10²³ kg', day:'15.95 天', year:'15.95 天',
              temp:'-179 °C', moons:'0', gravity:'1.35 m/s²' },
    factsEn:{ diameter:'5,149 km', mass:'1.35×10²³ kg', day:'15.95 days', year:'15.95 days',
              temp:'-179 °C', moons:'0', gravity:'1.35 m/s²' },
    factZh:'<b>土卫六 (Titan)</b>是太阳系第二大卫星，比水星还大。<br>是太阳系内除地球外唯一表面有稳定液体 (甲烷-乙烷湖) 的天体。<br>氮气大气压是地球的 1.5 倍。NASA Dragonfly 任务 2027 年发射，将于 2034 年飞抵。',
    factEn:'<b>Titan</b> is the Solar System\'s 2nd-largest moon — larger than Mercury.<br>It is the only other body in the Solar System with stable surface liquids (methane-ethane lakes).<br>Its N₂ atmosphere is 1.5× Earth\'s surface pressure. NASA Dragonfly launches 2027, arrives 2034.' },
  { name:'土卫八', en:'Iapetus', parent:'土星',
    distance:68, size:0.22, realSize:1469/12742, diameterKm:1469,
    orbit:79.33, rotation:79.33, eccentricity:0.0273, inclination:7.6,  // Iapetus incl: 7.6° to Saturn's equator; 17.28° to ecliptic
    color:0xa89878, texture:'./src/textures/iapetus.jpg',
    typeZh:'土星的"阴阳"卫星', typeEn:'Saturn\'s "Yin-Yang" Moon',
    factsZh:{ diameter:'1,469 km', mass:'1.8×10²¹ kg', day:'79.33 天', year:'79.33 天',
              temp:'-173 °C', moons:'0', gravity:'0.223 m/s²' },
    factsEn:{ diameter:'1,469 km', mass:'1.8×10²¹ kg', day:'79.33 days', year:'79.33 days',
              temp:'-173 °C', moons:'0', gravity:'0.223 m/s²' },
    factZh:'<b>土卫八 (Iapetus)</b>以两半球明暗对比著称 — 一面像雪 (反照率 0.6)，另一面像煤 (0.05)。<br>暗面物质来自另一卫星菲比 (Phoebe) 抛出的尘埃。<br>赤道有一条 13 km 高、100 km 宽的山脊，环绕卫星一周。',
    factEn:'<b>Iapetus</b> has a striking two-tone appearance — one hemisphere bright (albedo 0.6), one dark (0.05).<br>The dark material comes from dust ejected by the outer moon Phoebe.<br>It also has a 13-km-high equatorial ridge spanning 100 km wide around the moon.' },
  // ===== 天王星 (Uranus) =====
  { name:'天卫五', en:'Miranda', parent:'天王星',
    distance:12, size:0.07, realSize:472/12742, diameterKm:472,
    orbit:1.413, rotation:1.413, eccentricity:0.0013, inclination:4.42,
    color:0xb8b3a3, texture:'./src/textures/miranda.jpg',
    typeZh:'天王星最奇特的卫星', typeEn:'Uranus\' Most Bizarre Moon',
    factsZh:{ diameter:'472 km', mass:'6.6×10¹⁹ kg', day:'1.41 天', year:'1.41 天',
              temp:'-213 °C', moons:'0', gravity:'0.079 m/s²' },
    factsEn:{ diameter:'472 km', mass:'6.6×10¹⁹ kg', day:'1.41 days', year:'1.41 days',
              temp:'-213 °C', moons:'0', gravity:'0.079 m/s²' },
    factZh:'<b>天卫五 (Miranda)</b>是天王星最小的内卫星，但拥有太阳系最戏剧化的地形。<br>有高达 20 km 的维罗纳断崖 (Verona Rupes) — 太阳系最高的悬崖。<br>表面沟槽和冰山结构暗示它在过去曾被引力撕裂后重新聚合。',
    factEn:'<b>Miranda</b> is Uranus\' smallest major moon but has the most extreme terrain in the Solar System.<br>It hosts Verona Rupes, the tallest known cliff (~20 km high) in the Solar System.<br>Its jumbled surface suggests it was once shattered and reassembled by gravity.' },
  { name:'天卫一', en:'Ariel', parent:'天王星',
    distance:15, size:0.18, realSize:1158/12742, diameterKm:1158,
    orbit:2.520, rotation:2.520, eccentricity:0.0012, inclination:0.03,
    color:0xc8c4b4, texture:'./src/textures/ariel.jpg',
    typeZh:'天王星的冰卫星', typeEn:'Uranus\' Icy Moon',
    factsZh:{ diameter:'1,158 km', mass:'1.3×10²¹ kg', day:'2.52 天', year:'2.52 天',
              temp:'-213 °C', moons:'0', gravity:'0.27 m/s²' },
    factsEn:{ diameter:'1,158 km', mass:'1.3×10²¹ kg', day:'2.52 days', year:'2.52 days',
              temp:'-213 °C', moons:'0', gravity:'0.27 m/s²' },
    factZh:'<b>天卫一 (Ariel)</b>是天王星最亮的卫星。<br>表面有大量交叉的峡谷和山谷，最深达 10 km，暗示过去有冰火山活动。<br>主要由等量的冰和硅酸盐岩石组成。',
    factEn:'<b>Ariel</b> is the brightest of Uranus\' moons.<br>Its surface is cut by intersecting canyons up to 10 km deep, hinting at past cryovolcanic activity.<br>Composed of roughly equal parts ice and silicate rock.' },
  { name:'天卫二', en:'Umbriel', parent:'天王星',
    distance:19, size:0.18, realSize:1169/12742, diameterKm:1169,
    orbit:4.144, rotation:4.144, eccentricity:0.0040, inclination:0.08,
    color:0x6e6457, texture:'./src/textures/umbriel.jpg',
    typeZh:'天王星最暗的卫星', typeEn:'Uranus\' Darkest Moon',
    factsZh:{ diameter:'1,169 km', mass:'1.2×10²¹ kg', day:'4.14 天', year:'4.14 天',
              temp:'-213 °C', moons:'0', gravity:'0.23 m/s²' },
    factsEn:{ diameter:'1,169 km', mass:'1.2×10²¹ kg', day:'4.14 days', year:'4.14 days',
              temp:'-213 °C', moons:'0', gravity:'0.23 m/s²' },
    factZh:'<b>天卫二 (Umbriel)</b>是天王星最暗的卫星之一，反照率仅 0.21。<br>表面遍布撞击坑，看起来非常古老。<br>它是所有天王星卫星中最不具地质活跃性的一颗。',
    factEn:'<b>Umbriel</b> is the darkest of Uranus\' major moons, with albedo only 0.21.<br>Its heavily cratered surface looks ancient and shows little sign of geological activity.<br>It is the least geologically active of Uranus\' large moons.' },
  { name:'天卫三', en:'Titania', parent:'天王星',
    distance:24, size:0.25, realSize:1577/12742, diameterKm:1577,
    orbit:8.706, rotation:8.706, eccentricity:0.0011, inclination:0.11,
    color:0x8c8676, texture:'./src/textures/titania.jpg',
    typeZh:'天王星最大的卫星', typeEn:'Uranus\' Largest Moon',
    factsZh:{ diameter:'1,577 km', mass:'3.4×10²¹ kg', day:'8.71 天', year:'8.71 天',
              temp:'-213 °C', moons:'0', gravity:'0.38 m/s²' },
    factsEn:{ diameter:'1,577 km', mass:'3.4×10²¹ kg', day:'8.71 days', year:'8.71 days',
              temp:'-213 °C', moons:'0', gravity:'0.38 m/s²' },
    factZh:'<b>天卫三 (Titania)</b>是天王星最大的卫星。<br>表面有巨大峡谷系统 (Messina Chasma)，宽达 1,500 km。<br>其轨道的进动暗示内部可能存在液态水海洋。',
    factEn:'<b>Titania</b> is Uranus\' largest moon.<br>Its surface features the giant Messina Chasma canyon system, up to 1,500 km wide.<br>Its orbital precession hints at a possible subsurface liquid-water ocean.' },
  { name:'天卫四', en:'Oberon', parent:'天王星',
    distance:30, size:0.24, realSize:1523/12742, diameterKm:1523,
    orbit:13.46, rotation:13.46, eccentricity:0.0014, inclination:0.13,
    color:0x807a6c, texture:'./src/textures/oberon.jpg',
    typeZh:'天王星最远的大卫星', typeEn:'Uranus\' Outermost Major Moon',
    factsZh:{ diameter:'1,523 km', mass:'2.9×10²¹ kg', day:'13.46 天', year:'13.46 天',
              temp:'-213 °C', moons:'0', gravity:'0.35 m/s²' },
    factsEn:{ diameter:'1,523 km', mass:'2.9×10²¹ kg', day:'13.46 days', year:'13.46 days',
              temp:'-213 °C', moons:'0', gravity:'0.35 m/s²' },
    factZh:'<b>天卫四 (Oberon)</b>是天王星最远的卫星。<br>表面有许多大型撞击坑，包括带暗圈 (暗物质沉积) 的哈姆雷撞击坑。<br>是天王星系统中最早被发现的卫星 (1787 年，威廉·赫歇尔)。',
    factEn:'<b>Oberon</b> is Uranus\' outermost major moon.<br>Its surface bears many large craters, including Hamlet, which has a dark floor of unknown composition.<br>It was the first Uranian moon discovered (1787, by William Herschel).' },
  // ===== 海王星 (Neptune) =====
  { name:'海卫一', en:'Triton', parent:'海王星',
    distance:18, size:0.40, realSize:2705/12742, diameterKm:2705,
    orbit:-5.877, rotation:5.877, eccentricity:0.000016, inclination:156.9,  // Triton incl: 156.9° to Neptune's equator (polar retrograde, 几乎垂直); 129.812° to ecliptic
    color:0xc8c4b8, texture:'./src/textures/triton.jpg',
    typeZh:'海王星最大卫星 · 逆向公转', typeEn:'Neptune\'s Largest · Retrograde',
    factsZh:{ diameter:'2,705 km', mass:'2.14×10²² kg', day:'5.88 天 (逆向)', year:'5.88 天 (逆向)',
              temp:'-235 °C', moons:'0', gravity:'0.78 m/s²' },
    factsEn:{ diameter:'2,705 km', mass:'2.14×10²² kg', day:'5.88 days (retrograde)', year:'5.88 days (retrograde)',
              temp:'-235 °C', moons:'0', gravity:'0.78 m/s²' },
    factZh:'<b>海卫一 (Triton)</b>是海王星最大的卫星。<br>是太阳系内少数几个具有大气层 (主要由氮构成) 的卫星之一。<br>它是<b>逆向公转</b>的 — 因此被认为是被海王星从柯伊伯带捕获的天体。表面有活跃的冰喷泉，喷射氮气至 8 km 高。',
    factEn:'<b>Triton</b> is Neptune\'s largest moon.<br>It is one of the few moons with an atmosphere (mainly nitrogen).<br>It orbits <b>retrograde</b> — strongly suggesting it was captured from the Kuiper Belt. It has active nitrogen geysers erupting up to 8 km high.' },
];

/* 太阳 (v20260702g: facts 改 factsZh/factsEn 双语, 单位英文模式用 billion years / °C) */
export const SUN_FACTS = {
  diameterKm: 1392700,
  mass: '1.99×10³⁰ kg',
  age: '46 亿年',
  ageEn: '4.6 billion years',
  temp: '表面 5,500 °C · 核心 1,500 万 °C',
  tempEn: 'Surface 5,500 °C · Core 15 million °C',
  gravity: '274 m/s²',
  luminosity: '3.83×10²⁶ W',
  typeZh:'G2V 型黄矮星',
  typeEn:'G2V Yellow Dwarf',
  factZh:'<b>太阳</b>是太阳系的中心天体，占系统总质量的 99.86%。<br>每秒将约 600 万吨氢聚变成氦。<br>光从太阳表面到达地球约需 8 分 20 秒。',
  factEn:'<b>The Sun</b> is the central body of the Solar System, holding 99.86% of its total mass.<br>Every second it fuses ~6 million tons of hydrogen into helium.<br>Sunlight takes about 8 minutes 20 seconds to reach Earth.'
};
