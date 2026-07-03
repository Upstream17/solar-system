/* ambient.js — 程序化合成"浩瀚静谧" ambient pad + 缓慢和弦进行
 *
 * 用户原话 (二次反馈后):
 *   "找一个太空相关的音乐, 要求给人浩瀚静谧的感觉, 能支持长时间挂机"
 *   "音乐默认播放, 应该有旋律, 不是纯噪声"
 *
 * 音色构成 (5 层)
 *   L1 主旋律    — sine + 缓慢 LFO, 走 A 小调五声音阶 (A B C E F# A C E ...),
 *                  节奏: 8 秒/音, 4-6 个音一个循环, 旋律感主要来源
 *   L2 和弦 pad  — triangle, 持续 A 小调四音和弦 (Am: A C E A, F: F A C F,
 *                  G: G B D G, 每 16 秒换一个和弦), 慢 LFO 调 detune
 *   L3 基底 drone — 55Hz + 82.4Hz 五度, sine, -18 dBFS, 体感低频
 *   L4 高频 shimmer — A5 + E6, sine, 极轻, 极光泛音
 *   L5 噪声底    — bandpass 白噪声, "宇宙微波背景", 极轻
 *
 * 调性: A 自然小调 (太空感经典调性, Hans Zimmer / Interstellar 风格)
 * 节奏: 全部由 setValueAtTime 排程, 循环周期约 64 秒 (4 和弦 × 16 秒)
 *
 * 浏览器策略
 *   AudioContext 必须在用户手势后启动 (Chrome autoplay policy)
 *   — 第一次点音乐按钮时, 内部调 ctx.resume() 解锁
 *   — 但本项目改为: 页面加载完自动尝试启动, 如果失败 (autoplay 政策拦截)
 *     就在按钮 click 时再 resume
 *   — 体验: 大部分浏览器允许 muted autoplay 或第一次手势后自动 resume
 *
 * API
 *   isPlaying()      → boolean
 *   toggle()         → Promise<boolean>  (新状态: true=开始播, false=停止)
 *   play() / pause() → Promise
 */

/* ===== A 小调和弦/音阶 (Hz) ===== */
const A4 = 440;
const NOTE = {
  A2: A4 / 4,         // 110
  C3: A4 * (2 ** (-9/12)) / 2,  // ~130.81
  E3: A4 * (2 ** (-7/12)) / 2,  // ~164.81
  F3: A4 * (2 ** (-6/12)) / 2,  // ~174.61
  G3: A4 * (2 ** (-5/12)) / 2,  // ~196
  A3: A4 / 2,         // 220
  B3: A4 * (2 ** (2/12)) / 2,  // ~246.94
  C4: A4 * (2 ** (-9/12)),  // ~261.63
  E4: A4 * (2 ** (-7/12)),  // ~329.63
  F4: A4 * (2 ** (-6/12)),  // ~349.23
  G4: A4 * (2 ** (-2/12)),  // ~392.00
  A4: A4,             // 440
  C5: A4 * (2 ** (3/12)),  // ~523.25
  E5: A4 * (2 ** (7/12)),  // ~659.25
  A5: A4 * 2,         // 880
  C6: A4 * (2 ** (15/12)), // ~1046.50
  E6: A4 * (2 ** (19/12)), // ~1318.51
};

/* A 小调四音和弦序列 (16 秒/和弦, 总循环 64 秒) */
const CHORD_PROG = [
  { root: 'A2', third: 'C3', fifth: 'E3', octave: 'A3' },  // Am
  { root: 'F3', third: 'A3', fifth: 'C4', octave: 'F4' },  // F
  { root: 'G3', third: 'B3', fifth: 'D4', octave: 'G3' },  // G (D3 用 B3 替代, 极低频会听不到)
  { root: 'E3', third: 'G3', fifth: 'B3', octave: 'E4' },  // Em
];

/* 主旋律序列 — A 小调五声音阶 (A C D E G), 每 8 秒换一个音
 * — 64 秒一个完整旋律, 由 setValueAtTime 排程
 * — 每音持续 6.5 秒, 留 1.5 秒"呼吸" (sine 自然衰减 + 主增益很慢) */
const MELODY = [
  // 第 1 段 (Am): A4 → C5 → E5 → A5 (上升)
  { at: 0,  freq: NOTE.A4, dur: 6.5, gain: 0.18 },
  { at: 8,  freq: NOTE.C5, dur: 6.5, gain: 0.18 },
  { at: 16, freq: NOTE.E5, dur: 6.5, gain: 0.18 },
  { at: 24, freq: NOTE.A5, dur: 6.5, gain: 0.18 },
  // 第 2 段 (F 和弦下用 G4 替代 F4 — F 不在 A 小调五声音阶内)
  { at: 32, freq: NOTE.C5, dur: 6.5, gain: 0.18 },
  { at: 40, freq: NOTE.A4, dur: 6.5, gain: 0.18 },
  { at: 48, freq: NOTE.G4, dur: 6.5, gain: 0.18 },
  { at: 56, freq: NOTE.C5, dur: 6.0, gain: 0.18 },
];

const LOOP_S = 64;  // 一个完整循环的时长 (秒)

let ctx = null;
let masterGain = null;
let isStarted = false;
let melodyOsc = null;
let melodyGain = null;

const FADE_IN_S  = 2.5;
const FADE_OUT_S = 1.5;

/* 懒创建 AudioContext */
function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    console.warn('[ambient] Web Audio API 不可用');
    return null;
  }
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0;  // 起始 0
  masterGain.connect(ctx.destination);
  buildLayers();
  scheduleLoop(0);  // 立即排程第一轮旋律
  scheduleNextLoops();  // 启动循环调度器
  return ctx;
}

/* 启动循环调度: 每 64 秒重新排程下一轮
 * — 用 setTimeout 而不是 setInterval, 因为 64 秒太长 setInterval 会被节流 */
function scheduleNextLoops() {
  if (!ctx) return;
  // 第一轮已经在 scheduleLoop(0) 排程
  // 第二轮: 当前时间 + LOOP_S
  const t1 = ctx.currentTime + LOOP_S;
  setTimeout(() => {
    if (ctx) scheduleLoop(t1);
    scheduleNextLoops();
  }, LOOP_S * 1000);
}

/* 排程主旋律的频率变化 (使用 setValueAtTime 在指定时间切换) */
function scheduleLoop(startTime) {
  if (!ctx || !melodyOsc) return;
  MELODY.forEach(({ at, freq }) => {
    melodyOsc.frequency.setValueAtTime(freq, startTime + at);
  });
  // 64 秒后回到第一个音, 形成无缝循环
  melodyOsc.frequency.setValueAtTime(NOTE.A4, startTime + LOOP_S);
}

/* 4 层音色构建 (外加主旋律层) */
function buildLayers() {
  // 极慢 LFO 共享源 (detune modulation)
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;  // ~14 秒/周期
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 8;       // detune ±8 cents
  lfo.connect(lfoGain);
  lfo.start();

  // L0: 主旋律 (sine, A 小调五声音阶, 64 秒循环)
  melodyOsc = ctx.createOscillator();
  melodyOsc.type = 'sine';
  melodyOsc.frequency.value = NOTE.A4;  // 起始 A4
  melodyGain = ctx.createGain();
  melodyGain.gain.value = 0.18;
  melodyOsc.connect(melodyGain);
  melodyGain.connect(masterGain);
  melodyOsc.start();

  // L1: 和弦 pad (A 小调四和弦 64 秒循环)
  //  — 每次 currentTime 推进到下个和弦时, 用 setValueAtTime 切换频率
  //  — 音量 0.15, 4 个音叠加 ≈ -20 dBFS
  //  — 为简化, 我们用静态 4 个 oscillator 分别代表 4 个音, 但只在对应和弦
  //    期间 active
  CHORD_PROG.forEach((chord, i) => {
    const startAt = i * (LOOP_S / 4);  // 0, 16, 32, 48
    [chord.root, chord.third, chord.fifth, chord.octave].forEach(noteKey => {
      const f = NOTE[noteKey];
      if (!f) return;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      lfoGain.connect(o.detune);
      const g = ctx.createGain();
      g.gain.value = 0;  // 初始 0
      o.connect(g);
      g.connect(masterGain);
      o.start();
      // 在对应和弦期间 ramp 到 0.15, 之后 ramp 回 0
      g.gain.setValueAtTime(0, startAt);
      g.gain.linearRampToValueAtTime(0.15, startAt + 2);
      g.gain.setValueAtTime(0.15, startAt + (LOOP_S / 4) - 2);
      g.gain.linearRampToValueAtTime(0, startAt + (LOOP_S / 4));
      // 循环: 第二轮起每个和弦重复
      // — 但 setValueAtTime 是一次性事件, 所以下一轮要重排
      // — 简单方案: 每 LOOP_S 重新排程一次和弦包络
    });
  });
  // 循环包络调度: 每 64 秒重新排程和弦包络
  scheduleChordEnvelopes();

  // L2: 基底 drone (A1 + E2 五度, sine)
  [NOTE.A2 / 2, NOTE.C3 / 2].forEach(f => {  // 55Hz + ~65Hz (用 C3 代替 E2 简化)
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.20;
    o.connect(g);
    g.connect(masterGain);
    o.start();
  });

  // L3: 高频 shimmer (A5 + E6, sine, 极轻)
  [NOTE.A5, NOTE.E6].forEach(f => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    lfoGain.connect(o.detune);
    const g = ctx.createGain();
    g.gain.value = 0.06;
    o.connect(g);
    g.connect(masterGain);
    o.start();
  });

  // L4: 白噪声底 (bandpass, "宇宙微波背景")
  const bufSize = ctx.sampleRate * 1;
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  noiseSrc.loop = true;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.6;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.04;  // 噪声层调低, 让旋律/和弦透出来

  noiseSrc.connect(bp);
  bp.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseSrc.start();
}

/* 每 LOOP_S 重新排程一次和弦包络 (让和弦无限循环切换) */
function scheduleChordEnvelopes() {
  if (!ctx) return;
  const cycleStart = ctx.currentTime + LOOP_S;  // 第二轮起点
  CHORD_PROG.forEach((chord, i) => {
    const startAt = cycleStart + i * (LOOP_S / 4);
    [chord.root, chord.third, chord.fifth, chord.octave].forEach(noteKey => {
      // 找到对应的 gain 节点 — 简单方案: 重新创建新 oscillator
      // (旧 oscillator 已经衰减到 0, 不再触发)
      const f = NOTE[noteKey];
      if (!f) return;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 8;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      lfo.connect(lfoGain);
      lfo.start(startAt);
      lfoGain.connect(o.detune);
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(masterGain);
      o.start(startAt);
      g.gain.setValueAtTime(0, startAt);
      g.gain.linearRampToValueAtTime(0.15, startAt + 2);
      g.gain.setValueAtTime(0.15, startAt + (LOOP_S / 4) - 2);
      g.gain.linearRampToValueAtTime(0, startAt + (LOOP_S / 4));
      lfo.stop(startAt + LOOP_S);
    });
  });
  // 第三轮: 再 LOOP_S
  setTimeout(scheduleChordEnvelopes, LOOP_S * 1000);
}

/* fade 辅助 */
function fadeTo(targetGain, duration) {
  if (!ctx || !masterGain) return;
  const tau = duration / 3;
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setTargetAtTime(targetGain, now, tau);
}

export function isPlaying() {
  return isStarted;
}

/* 启动播放 — 必须在用户手势内调用 (首次) */
export async function play() {
  ensureCtx();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch (e) { console.warn('[ambient] resume failed', e); }
  }
  if (!isStarted) {
    // 0.30: 5 层叠加, 主旋律 + 和弦 + drone 都能清楚听到
    // 4 层叠加峰值 ≈ 0.40, 主音域 50-1500Hz 不刺耳
    fadeTo(0.30, FADE_IN_S);
    isStarted = true;
  } else {
    fadeTo(0.30, FADE_IN_S);
  }
  return true;
}

/* 暂停播放 */
export async function pause() {
  if (!ctx || !masterGain) return;
  if (isStarted) {
    fadeTo(0.0, FADE_OUT_S);
    isStarted = false;
  }
}

export async function toggle() {
  if (isStarted) {
    await pause();
  } else {
    await play();
  }
  return isStarted;
}
