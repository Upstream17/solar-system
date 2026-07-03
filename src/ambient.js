/* ambient.js — 背景音乐 (加载本地 CC0 mp3 + HTML5 Audio 循环)
 *
 * 用户反馈历程 (重要, 写在这里避免重蹈覆辙):
 *   v1  程序化合成静态 pad          → 用户: "听不到声音"
 *   v2  提升音量                    → 用户: "听不到 / 噪声太吵 / 旋律刺耳"
 *   v3  加主旋律+和弦               → 用户: "图标错 / 音乐很难听 / 旋律刺耳"
 *   v4  修复图标 (双 SVG 切换)      → 用户: "图标还是一片黑 / 噪声太吵 / 旋律刺耳"
 *   v5  (当前) 放弃程序化合成, 改用现成 CC0 mp3 文件本地加载
 *
 * 选曲: "Observing The Star" by YD (2013, OpenGameArt)
 *   - CC0 1.0 Universal (Public Domain Dedication)
 *     完全免版权, 无需署名, 可商用, 永久有效
 *   - 2:14 时长, 44100 Hz stereo
 *   - 192 favorites (OpenGameArt 高赞资源)
 *   - 标签: ambient + space + relaxing + peaceful + endless + universe + sleep + frozen
 *   - 被 SquadChess / boxgm 等多个项目用做背景音乐
 *   - 文件路径: src/audio/ambient.mp3 (相对页面, 浏览器同源加载, 无 CORS)
 *
 * API (保持不变, 避免改 main.js / ui.js):
 *   isPlaying()    → boolean
 *   toggle()       → Promise<boolean>  (新状态)
 *   play()         → Promise
 *   pause()        → Promise
 */

let audio = null;          // HTMLAudioElement
let isStarted = false;     // 业务状态 (与 audio.paused 解耦)
const FADE_IN_S  = 2.0;
const FADE_OUT_S = 1.5;

/* 懒创建 Audio 元素 + 绑事件 */
function ensureAudio() {
  if (audio) return audio;
  audio = new Audio('./src/audio/ambient.mp3');
  audio.loop = true;        // 2:14 自动循环, 挂机无重复感
  audio.preload = 'auto';   // 提前预加载, 点按钮时无延迟
  audio.volume = 0;         // 起始 0, play() 时 fade-in 到 0.7
  return audio;
}

/* fade 用线性插值, 简单稳 */
function fadeTo(targetVol, duration) {
  if (!audio) return;
  const startVol = audio.volume;
  const startTime = performance.now();
  const diff = targetVol - startVol;
  // 取消上一次 fade
  if (audio._fadeRaf) cancelAnimationFrame(audio._fadeRaf);

  function step() {
    const elapsed = (performance.now() - startTime) / 1000;
    if (elapsed >= duration) {
      audio.volume = targetVol;
      audio._fadeRaf = null;
      return;
    }
    audio.volume = startVol + diff * (elapsed / duration);
    audio._fadeRaf = requestAnimationFrame(step);
  }
  audio._fadeRaf = requestAnimationFrame(step);
}

export function isPlaying() {
  return isStarted;
}

export async function play() {
  const a = ensureAudio();
  if (!a) return false;
  if (a.paused) {
    try {
      await a.play();
    } catch (e) {
      // Autoplay 政策拦截时静默失败 (按钮已显示状态会反映在 isPlaying)
      console.warn('[ambient] play() blocked:', e.message);
      return false;
    }
  }
  isStarted = true;
  fadeTo(0.7, FADE_IN_S);
  return true;
}

export async function pause() {
  if (!audio) return;
  isStarted = false;
  fadeTo(0.0, FADE_OUT_S);
  // fade 结束后真的暂停 audio 元素
  setTimeout(() => {
    if (!isStarted && audio && !audio.paused) {
      audio.pause();
    }
  }, FADE_OUT_S * 1000 + 50);
}

export async function toggle() {
  if (isStarted) {
    await pause();
  } else {
    await play();
  }
  return isStarted;
}
