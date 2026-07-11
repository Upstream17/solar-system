/* i18n.js — 双语并列字典 + info-panel 单语切换 (v20260702e)
 *
 * 两套并存:
 *   1. 底部 dock / legend / 追踪浮条 / footnote: 全部双语并列
 *      - 用 bi('key') → "中文 · ENGLISH"
 *   2. info-panel (右侧抽屉): 单语切换
 *      - 用 infoT('key', lang) → 单语字符串
 *      - lang = 'zh' | 'en', 由 info-panel 内嵌按钮控制
 *
 * 设计取舍:
 *   - 底部面板内容是"短标签"型, 双语并列最省事
 *   - info-panel 内容是"长描述"型 (fact 段落), 单语切换更省空间
 *   - 两套并存, 因为场景不同
 */

const DICT = {
  // ============ 底部 dock / legend / 通用 (双语并列) ============

  // panel 标题
  title_controls:  ['操作提示',  'Controls'],
  title_dashboard: ['仪表盘',    'Dashboard'],
  // v20260702f: title_planets 改 "星球图例" / "Bodies" — 太阳是恒星不是行星
  title_planets:   ['星球图例',  'Bodies'],

  // dashboard sliders
  time:           ['时间流速',   'TIME'],
  luminance:      ['太阳亮度',   'LUMINANCE'],
  star_density:   ['星光密度',   'STAR DENSITY'],

  // dashboard toggles
  show_orbits:    ['显示轨道',   'SHOW ORBITS'],
  star_bg:        ['星空背景',   'STARFIELD'],
  earth_clouds:   ['地球云层',   'EARTH CLOUDS'],
  sun_glow:       ['太阳辉光',   'SUN GLOW'],
  asteroid_belt:  ['小行星带',   'ASTEROID BELT'],

  // hint (controls 面板内的快捷键说明)
  // v20260702e: CLICK → TRACE, 因为点星球=追踪, "CLICK" 没说明结果
  // 改成 TRACE 后用户立刻知道"点了会追踪"
  hint_drag_k:    'DRAG',
  hint_drag_v:    '左键旋转视角 · LEFT-DRAG TO ROTATE',
  hint_pan_k:     'PAN',
  hint_pan_v:     '右键平移 · RIGHT-DRAG TO PAN',
  hint_zoom_k:    'ZOOM',
  hint_zoom_v:    '滚轮缩放 · SCROLL TO ZOOM',
  hint_trace_k:   'TRACE',
  hint_trace_v:   '点击行星 / 图例追踪 · TAP PLANET OR LEGEND',
  hint_esc_k:     'ESC',
  hint_esc_v:     '退出追踪 · EXIT TRACKING',

  // 追踪浮条 (左下角)
  tracking:       '追踪中 · TRACKING',
  stop:           '停止 · STOP',

  // v20260702j: 已不支持再次点击取消 (commit c152b6f 改: 重复点同一目标 = 无反应, 避免误操作)
  // 退出追踪: ESC / 追踪条的 × 按钮 / 点击另一个星球切换
  legend_hint:    '点击追踪 · ESC 或 × 取消  ·  TAP TO TRACE · ESC OR × TO RELEASE',

  // footer
  footnote:       'AU 真实 · 体积艺术夸张  ·  AU TRUE-TO-SCALE · VOLUME ARTISTIC',

  // 速度条
  speed_paused:   '⏸ 暂停 · PAUSED',

  // ============ info-panel 专用 (单语切换, 由 lang 决定显示哪边) ============
  // info-panel 字段
  info_diameter:  { zh: '直径',       en: 'Diameter' },
  info_mass:      { zh: '质量',       en: 'Mass' },
  info_day:       { zh: '自转周期',   en: 'Rotation' },
  info_year:      { zh: '公转周期',   en: 'Orbital Period' },
  info_temp:      { zh: '温度',       en: 'Temperature' },
  info_moons:     { zh: '卫星数',     en: 'Moons' },
  info_gravity:   { zh: '表面重力',   en: 'Surface Gravity' },
  info_age:       { zh: '年龄',       en: 'Age' },
  info_luminosity:{ zh: '光度',       en: 'Luminosity' },
  info_type_sun:  { zh: 'G2V 型黄矮星', en: 'G2V Yellow Dwarf' },
  info_type_body: { zh: '太阳系天体',   en: 'Solar System Body' },
  // v20260702e: planet type 也走字典 (类地行星/气态巨行星/冰巨行星)
  type_terrestrial:    { zh: '类地行星 · 岩石行星',  en: 'Terrestrial · Rocky Planet' },
  type_gas_giant:      { zh: '气态巨行星',           en: 'Gas Giant' },
  type_ringed:         { zh: '气态巨行星 · 带环行星', en: 'Gas Giant · Ringed' },
  type_ice_giant:      { zh: '冰巨行星',             en: 'Ice Giant' },
  type_home:           { zh: '类地行星 · 我们的家园', en: 'Terrestrial · Our Home' },
};

/** 拼接双语字符串 (用于底部 dock / 通用) */
export function bi(key) {
  const v = DICT[key];
  if (v === undefined) return key;
  return typeof v === 'string' ? v : v.join(' · ');
}

/** 单语查询 (用于 info-panel) */
export function infoT(key, lang = 'zh') {
  const v = DICT[key];
  if (v === undefined) return key;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v[lang] !== undefined) return v[lang];
  // 数组形式 (['中文', '英文']) — 退化兼容
  if (Array.isArray(v)) return lang === 'en' ? v[1] : v[0];
  return key;
}

/** 把字典刷到所有 [data-i18n] 元素 (底部 dock 用) */
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = bi(key);
    if (val) el.textContent = val;
  });
}

/** 初始化 — 底部 dock + info-panel 切换按钮 */
export function initI18n() {
  applyI18n();

  // info-panel 内嵌的 lang toggle
  // 监听事件, info-panel 重画逻辑在 ui.js initInfoPanel 里
  document.querySelectorAll('#info-panel .lang-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      // 切 active 态
      document.querySelectorAll('#info-panel .lang-toggle button').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === lang);
      });
      // 派发事件, ui.js 监听并重画 info-panel
      window.dispatchEvent(new CustomEvent('info-lang-changed', { detail: { lang } }));
    });
  });
}
