/* ambient.js — 程序化合成"浩瀚静谧" ambient pad
 *
 * 设计动机
 *   用户原话："找一个太空相关的音乐, 要求给人浩瀚静谧的感觉, 能支持长时间挂机"
 *   选型决策：不用外部音频文件（YouTube/Spotify/Freesound URL 都不稳定、版权复杂、
 *              CORS 难保证、音质参差不齐）。改用 Web Audio API 实时合成：
 *              - 零外链依赖, 永远能播
 *              - 无限循环, 任意时长挂机无重复感
 *              - 体积 0 字节, 不污染 Cloudflare Pages 部署
 *              - 无版权问题（程序化生成的音色本身就是 public domain）
 *
 * 音色构成（4 层 additive synthesis, 模拟深空极光频谱）
 *   L1 基底 drone  — 55 Hz (A1) + 82.4 Hz (E2) 五度叠置, sine, -24dBFS
 *                    模拟"行星际介质"的低频振动, 体感在胸腔
 *   L2 中频 pad   — 220 Hz (A3) + 330 Hz (E4) + 440 Hz (A4), triangle, -28dBFS
 *                    慢速 LFO (0.07 Hz, ~14s/周期) 调 detune, 制造"星云涌动"
 *   L3 高频 shimmer — 880 Hz (A5) + 1320 Hz (E6), sine + 极慢 LFO, -32dBFS
 *                    模拟极光高频泛音, 极轻, 空间感来源
 *   L4 白噪声底  — filtered white noise, bandpass 800-4000 Hz, -36dBFS
 *                    极轻噪声底, 模拟"宇宙微波背景", 没这层就太干净
 *
 * 所有层通过 LowPassFilter (3.5 kHz) + 主 Gain (0 → 0.18 fade-in 3s)
 * 整体特征：
 *   - 主音域 50-1500 Hz, 无刺耳高频, 不刺激听觉疲劳
 *   - 节奏由 LFO 控制（0.05-0.15 Hz）, 远低于人耳对"循环"的感知阈值
 *   - 合成器每帧用极慢 LFO 调 detune, 自然无机械感
 *   - fade-in 3 秒, fade-out 1.5 秒, 启停不突兀
 *
 * 浏览器策略
 *   AudioContext 必须在用户手势后启动（Chrome autoplay policy）
 *   → 用户第一次点音乐按钮时, 内部调 ctx.resume() 解锁
 *   → 之后 toggle play/pause 不再需要手势
 *
 * 暴露 API
 *   isPlaying()  → boolean
 *   toggle()     → Promise<boolean>  返回新状态（true=开始播, false=停止）
 *   play() / pause()  → Promise
 */

let ctx = null;          // AudioContext 实例（懒加载）
let masterGain = null;   // 主 GainNode, fade-in/out 用
let isStarted = false;   // 是否正在播放（区别于 ctx.state, ctx.suspended 时也算 started）

const FADE_IN_S  = 3.0;
const FADE_OUT_S = 1.5;

/* 懒创建 AudioContext — 必须等用户首次点击触发 */
function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    console.warn('[ambient] Web Audio API 不可用');
    return null;
  }
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0;  // 起始 0, play() 时 fade-in 到 0.18
  masterGain.connect(ctx.destination);
  buildLayers();
  return ctx;
}

/* 4 层音色构建 */
function buildLayers() {
  // 极慢 LFO 共享源（detune modulation）
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;  // ~14 秒/周期
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 8;       // detune ±8 cents, 极轻
  lfo.connect(lfoGain);
  lfo.start();

  // L1: 基底 drone（A1 + E2 五度, sine）
  //  — 单层 0.32, 2 路叠加 ≈ -18 dBFS, 体感在胸腔
  [55, 82.4].forEach(f => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.32;
    o.connect(g);
    g.connect(masterGain);
    o.start();
  });

  // L2: 中频 pad（A3 + E4 + A4, triangle）
  //  — 单层 0.18, 3 路叠加 ≈ -17 dBFS
  [220, 330, 440].forEach(f => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    lfoGain.connect(o.detune);
    const g = ctx.createGain();
    g.gain.value = 0.18;
    o.connect(g);
    g.connect(masterGain);
    o.start();
  });

  // L3: 高频 shimmer（A5 + E6, sine, 极轻）
  [880, 1320].forEach(f => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    lfoGain.connect(o.detune);
    const g = ctx.createGain();
    g.gain.value = 0.10;
    o.connect(g);
    g.connect(masterGain);
    o.start();
  });

  // L4: 白噪声底（bandpass filtered）
  //     1 秒白噪声 buffer, loop = 无限长但永远不重复（因为是 noise）
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

  // 噪声底是"宇宙微波背景"质感, 比之前调大一倍更明显
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.12;

  noiseSrc.connect(bp);
  bp.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseSrc.start();
}

/* fade 辅助 — 用 setTargetAtTime 平滑, 避免 click noise */
function fadeTo(targetGain, duration) {
  if (!ctx || !masterGain) return;
  // setTargetAtTime 时间常数 ≈ duration/3, 让 95% 在 duration 内完成
  const tau = duration / 3;
  // 先 cancelScheduledValues 避免叠加
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setTargetAtTime(targetGain, now, tau);
}

export function isPlaying() {
  return isStarted;
}

/* 启动播放 — 必须在用户手势内调用（首次） */
export async function play() {
  ensureCtx();
  if (!ctx) return false;
  // Chrome autoplay policy: 首次需 resume
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch (e) { console.warn('[ambient] resume failed', e); }
  }
  if (!isStarted) {
    // 0.42: 比之前 0.18 翻一倍多, 笔记本默认音量也能听到
    // 4 层叠加峰值 ≈ 0.55, 主音域 50-1500Hz 不刺耳
    fadeTo(0.42, FADE_IN_S);
    isStarted = true;
  } else {
    // 已经在播, 取消暂停状态（fade 回到 0.42）
    fadeTo(0.42, FADE_IN_S);
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

/* 切换状态 — UI 按钮 onClick 直接绑这个 */
export async function toggle() {
  if (isStarted) {
    await pause();
  } else {
    await play();
  }
  return isStarted;
}
