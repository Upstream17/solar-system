/* i18n.js — 中英双语字典 + DOM 应用
 * v20260702c
 *
 * 触发模式:
 *   - HTML 上写 <span data-i18n="key">默认(中)</span>
 *   - 切语言 = 遍历所有 [data-i18n] 替换 textContent
 *   - JS 动态插入的字符串 = 直接调 t('key')
 *
 * 设计取舍:
 *   - 字典放在这个文件,不再拆 JSON — 字典总共 ~25 条,拆出去反而难维护
 *   - localStorage 记 'zh' | 'en', 默认 'zh'
 *   - 字典 key 集中维护,避免 i18n('time') 和 i18n('time_') 这种 typo
 */

const DICT = {
  zh: {
    // panel 标题
    title_controls:  'Controls',
    title_dashboard: 'Dashboard',
    title_planets:   'Planets',
    // dashboard sliders
    time:           '时间流速',
    luminance:      '太阳亮度',
    star_density:   '星光密度',
    // dashboard toggles
    show_orbits:    '显示轨道',
    show_labels:    '显示星标',
    star_bg:        '星空背景',
    earth_clouds:   '地球云层',
    sun_glow:       '太阳辉光',
    footnote:       'AU 真实 · 体积艺术夸张',
    // hint
    hint_drag:      '左键旋转视角',
    hint_pan:       '右键平移',
    hint_zoom:      '滚轮缩放',
    hint_click:     '点击星球 / 图例',
    hint_esc:       '退出追踪',
    // 追踪浮条
    tracking:       '追踪中',
    stop:           '停止',
    // 图例提示
    legend_hint:    '点击追踪 · 再次点击取消',
    // 速度条 (slider)
    speed_paused:   '⏸ 暂停',
    // 抽屉类型标签
    info_type_sun:  '恒星 G2V 型 · 黄矮星',
    info_type_body: '太阳系天体',
    // 抽屉 data-grid 字段 (来自 ui.js initInfoPanel)
    info_diameter:  '直径',
    info_mass:      '质量',
    info_day:       '自转周期',
    info_year:      '公转周期',
    info_temp:      '温度',
    info_moons:     '卫星数',
    info_gravity:   '表面重力',
    info_age:       '年龄',
    info_luminosity:'光度',
  },
  en: {
    // panel 标题 (保持英文, 跟英文 README 视觉一致)
    title_controls:  'Controls',
    title_dashboard: 'Dashboard',
    title_planets:   'Planets',
    // dashboard sliders
    time:           'TIME',
    luminance:      'LUMINANCE',
    star_density:   'STAR DENSITY',
    // dashboard toggles
    show_orbits:    'Show Orbits',
    show_labels:    'Show Labels',
    star_bg:        'Starfield',
    earth_clouds:   'Earth Clouds',
    sun_glow:       'Sun Glow',
    footnote:       'AU true-to-scale · Volume artistic',
    // hint
    hint_drag:      'Left-drag to rotate',
    hint_pan:       'Right-drag to pan',
    hint_zoom:      'Scroll to zoom',
    hint_click:     'Click planet / legend',
    hint_esc:       'Exit tracking',
    // 追踪浮条
    tracking:       'TRACKING',
    stop:           'STOP',
    // 图例提示
    legend_hint:    'Click to track · Click again to release',
    // 速度条
    speed_paused:   '⏸ Paused',
    // 抽屉类型
    info_type_sun:  'G2V Yellow Dwarf',
    info_type_body: 'Solar System Body',
    // 抽屉字段
    info_diameter:  'Diameter',
    info_mass:      'Mass',
    info_day:       'Rotation',
    info_year:      'Orbital Period',
    info_temp:      'Temperature',
    info_moons:     'Moons',
    info_gravity:   'Surface Gravity',
    info_age:       'Age',
    info_luminosity:'Luminosity',
  },
};

const STORAGE_KEY = 'solar_lang';
let _currentLang = 'zh';

/** 读取已保存的语言, 缺省 zh */
function loadLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'zh' || saved === 'en') return saved;
  return 'zh';
}

/** 查字典 — 找不到 fallback 走 en, 再不行返回 key 本身 */
export function t(key) {
  const lang = DICT[_currentLang] || DICT.zh;
  if (key in lang) return lang[key];
  if (key in DICT.en) return DICT.en[key];
  return key;
}

/** 把字典刷到所有 [data-i18n] 元素 + 切换按钮 active 态 */
export function applyI18n() {
  document.documentElement.setAttribute('lang', _currentLang === 'zh' ? 'zh-CN' : 'en');
  // 1. 刷所有标记
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val) el.textContent = val;
  });
  // 2. 刷切换按钮 active 态
  document.querySelectorAll('#lang-switch button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === _currentLang);
  });
  // 3. 通知外部订阅者 (例如 info-panel 的字段需要重渲染)
  window.dispatchEvent(new CustomEvent('lang-changed', { detail: { lang: _currentLang } }));
}

/** 切换语言 */
export function setLang(lang) {
  if (lang !== 'zh' && lang !== 'en') return;
  _currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  applyI18n();
}

/** 当前语言 */
export function getLang() {
  return _currentLang;
}

/** 初始化 — 绑定按钮 + 加载默认语言 */
export function initI18n() {
  _currentLang = loadLang();
  document.querySelectorAll('#lang-switch button').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
  // 第一帧立刻应用, 防止初次闪烁默认中文
  applyI18n();
}
