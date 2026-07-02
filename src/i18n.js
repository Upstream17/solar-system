/* i18n.js — 双语并列字典 (v20260702d)
 *
 * 设计原则:
 *   - 默认中文为主,英文跟在后面,中间用「·」分隔
 *   - 例: bi('time') → "时间流速 · TIME"
 *   - 不再切换语言,所有用户都看到同一组双语
 *
 * 为什么不切换:
 *   - 切换按钮的 active 视觉太弱, 用户感觉"点了没反应"
 *   - 切换时部分动态内容(抽屉)会闪烁重画
 *   - 双语并列同时照顾中英读者, 不强迫选边
 *
 * 字典 key 集中维护,避免 typo:
 */

const DICT = {
  // panel 标题 — 中文为主, 英文跟在后面
  title_controls:  ['操作提示',  'Controls'],
  title_dashboard: ['仪表盘',    'Dashboard'],
  title_planets:   ['行星图例',  'Planets'],

  // dashboard sliders
  time:           ['时间流速',   'TIME'],
  luminance:      ['太阳亮度',   'LUMINANCE'],
  star_density:   ['星光密度',   'STAR DENSITY'],

  // dashboard toggles
  show_orbits:    ['显示轨道',   'SHOW ORBITS'],
  show_labels:    ['显示星标',   'SHOW LABELS'],
  star_bg:        ['星空背景',   'STARFIELD'],
  earth_clouds:   ['地球云层',   'EARTH CLOUDS'],
  sun_glow:       ['太阳辉光',   'SUN GLOW'],

  // hint (controls 面板内的快捷键说明) — 每行只显示一种语言, 上下两行展示
  hint_drag_k:    'DRAG',
  hint_drag_v:    '左键旋转视角 · LEFT-DRAG TO ROTATE',
  hint_pan_k:     'PAN',
  hint_pan_v:     '右键平移 · RIGHT-DRAG TO PAN',
  hint_zoom_k:    'ZOOM',
  hint_zoom_v:    '滚轮缩放 · SCROLL TO ZOOM',
  hint_click_k:   'CLICK',
  hint_click_v:   '点击星球 / 图例 · CLICK PLANET OR LEGEND',
  hint_esc_k:     'ESC',
  hint_esc_v:     '退出追踪 · EXIT TRACKING',

  // 追踪浮条 (左下角)
  tracking:       '追踪中 · TRACKING',
  stop:           '停止 · STOP',

  // 图例提示
  legend_hint:    '点击追踪 · 再次点击取消  ·  CLICK TO TRACK · CLICK AGAIN TO RELEASE',

  // footer
  footnote:       'AU 真实 · 体积艺术夸张  ·  AU TRUE-TO-SCALE · VOLUME ARTISTIC',

  // 速度条
  speed_paused:   '⏸ 暂停 · PAUSED',

  // 抽屉类型
  info_type_sun:  'G2V 型黄矮星 · G2V YELLOW DWARF',
  info_type_body: '太阳系天体 · SOLAR SYSTEM BODY',

  // 抽屉 data-grid 字段
  info_diameter:  '直径 · DIAMETER',
  info_mass:      '质量 · MASS',
  info_day:       '自转周期 · ROTATION',
  info_year:      '公转周期 · ORBITAL PERIOD',
  info_temp:      '温度 · TEMPERATURE',
  info_moons:     '卫星数 · MOONS',
  info_gravity:   '表面重力 · SURFACE GRAVITY',
  info_age:       '年龄 · AGE',
  info_luminosity:'光度 · LUMINOSITY',
};

/** 拼接双语字符串, key 不存在时返回 key 本身 */
export function bi(key) {
  const v = DICT[key];
  if (v === undefined) return key;
  return typeof v === 'string' ? v : v.join(' · ');
}

/** 给需要保留两个独立标签的场景 (例如 .k 是 key, .v 是 value) */
export function biParts(key) {
  const v = DICT[key];
  if (v === undefined) return [key, ''];
  if (typeof v === 'string') return ['', v];
  return v;
}

/** 把字典刷到所有 [data-i18n] 元素 */
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = bi(key);
    if (val) el.textContent = val;
  });
}

/** 初始化 — 加载首帧 (无切换按钮, 所以不绑事件) */
export function initI18n() {
  applyI18n();
}
