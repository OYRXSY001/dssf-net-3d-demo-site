/* ===== 数字人讲解员 guide.js =====
   纯离线：内联 SVG 半身像 + Web Speech 朗读 + 字幕计时后备。
   契约（不可改签名）：
     const guide = createGuide({ root });
     await guide.say('文本', { ms? });   // 先打断上一句；绝不 reject、绝不挂死
     guide.stop();                      // 可重复调用，并 resolve 未完成的 say()
     guide.setMuted(true) / guide.isMuted() / guide.destroy() / guide.el
   形态：右下角 292px 卡片（右 24 / 下 96），浅灰影棚风；无中文音色时按 ≈190ms/字 估时。 */

const SPEAK_RATE = 1.02;
const MS_PER_CHAR = 190;
const MIN_MS = 1200;
const MAX_MS = 12000;
const IDLE_CAPTION = '待命中 · 需要时我会讲解当前步骤';

/* 口型 3 档：0 闭、1 半开、2 张开；按固定节奏循环，避免读字时的机械等幅 */
const LIP_FRAMES = [0, 2, 1, 0, 1, 2, 0, 2, 1, 1, 0, 2];
const LIP_RY = [0.45, 1.3, 2.15];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

function requestFrame(fn) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(fn);
  }
  return setTimeout(() => fn(now()), 16);
}
function cancelFrame(id) {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(id);
    return;
  }
  clearTimeout(id);
}
function prefersReduced() {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
}
function getSynth() {
  try {
    if (typeof window === 'undefined') return null;
    if (!window.speechSynthesis) return null;
    if (typeof window.SpeechSynthesisUtterance !== 'function') return null;
    return window.speechSynthesis;
  } catch {
    return null;
  }
}
function estimateMs(text) {
  const chars = Array.from(String(text).replace(/\s+/g, '')).length;
  return clamp(chars * MS_PER_CHAR, MIN_MS, MAX_MS);
}
/* 预生成音轨按「整句文本」索引；比对前统一空白，避免换行/多空格对不上 */
function normText(text) {
  return String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
}

/* ---------- 内联 SVG：中性写实比例的半身讲解员 ---------- */

const FIG_SVG = [
  "<svg class=\"guide-figure\" viewBox=\"0 0 92 92\" aria-hidden=\"true\" focusable=\"false\">",
  "  <defs>",
  "    <radialGradient id=\"__U__-bg\" cx=\"50%\" cy=\"16%\" r=\"86%\">",
  "      <stop offset=\"0\" stop-color=\"#fdfefe\"/>",
  "      <stop offset=\".58\" stop-color=\"#eff3f6\"/>",
  "      <stop offset=\"1\" stop-color=\"#dfe6eb\"/>",
  "    </radialGradient>",
  "    <linearGradient id=\"__U__-coat\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">",
  "      <stop offset=\"0\" stop-color=\"#ffffff\"/>",
  "      <stop offset=\".62\" stop-color=\"#fbfcfd\"/>",
  "      <stop offset=\"1\" stop-color=\"#e6edf1\"/>",
  "    </linearGradient>",
  "    <linearGradient id=\"__U__-hair\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">",
  "      <stop offset=\"0\" stop-color=\"#4f565f\"/>",
  "      <stop offset=\".45\" stop-color=\"#3d424a\"/>",
  "      <stop offset=\"1\" stop-color=\"#2c3036\"/>",
  "    </linearGradient>",
  "    <linearGradient id=\"__U__-neck\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">",
  "      <stop offset=\"0\" stop-color=\"#e7c5b1\"/>",
  "      <stop offset=\".5\" stop-color=\"#f0d3c1\"/>",
  "      <stop offset=\"1\" stop-color=\"#f4ddcc\"/>",
  "    </linearGradient>",
  "    <clipPath id=\"__U__-round\"><circle cx=\"46\" cy=\"46\" r=\"45.2\"/></clipPath>",
  "    <clipPath id=\"__U__-face\"><path d=\"M46 20.6c8.4 0 13.2 6 13.2 14.6 0 5.2-1.2 9.8-3.6 13-2.3 3-5.5 4.4-9.6 4.4s-7.3-1.4-9.6-4.4c-2.4-3.2-3.6-7.8-3.6-13C32.8 26.6 37.6 20.6 46 20.6z\"/></clipPath>",
  "    <clipPath id=\"__U__-eye-l\"><ellipse cx=\"40\" cy=\"37.6\" rx=\"3.3\" ry=\"1.85\"/></clipPath>",
  "    <clipPath id=\"__U__-eye-r\"><ellipse cx=\"52\" cy=\"37.6\" rx=\"3.3\" ry=\"1.85\"/></clipPath>",
  "    <clipPath id=\"__U__-badge\"><rect x=\"55.4\" y=\"68.6\" width=\"8\" height=\"10.4\" rx=\"1.4\"/></clipPath>",
  "  </defs>",
  "",
  "  <g clip-path=\"url(#__U__-round)\">",
  "    <circle cx=\"46\" cy=\"46\" r=\"46\" fill=\"url(#__U__-bg)\"/>",
  "    <ellipse cx=\"46\" cy=\"96\" rx=\"31\" ry=\"11\" fill=\"rgba(16,24,40,.045)\"/>",
  "",
  "    <g transform=\"translate(46 92) scale(1.06) translate(-46 -92)\">",
  "    <path d=\"M40.2 44.6h11.6v15.6c0 2.8-2.6 4.4-5.8 4.4s-5.8-1.6-5.8-4.4z\" fill=\"url(#__U__-neck)\"/>",
  "    <ellipse cx=\"46\" cy=\"53.8\" rx=\"5.6\" ry=\"2\" fill=\"rgba(146,92,74,.10)\"/>",
  "",
  "    <path d=\"M46 58.2c-8 .2-14.4 3.4-18.6 9-4 5.4-6.2 14.8-6.8 24.8h50.8c-.6-10-2.8-19.4-6.8-24.8-4.2-5.6-10.6-8.8-18.6-9z\" fill=\"url(#__U__-coat)\" stroke=\"rgba(16,24,40,.11)\" stroke-width=\".7\"/>",
  "    <path d=\"M34.2 61.4c-1.7 3.4-2.7 7.2-3.1 11.4\" fill=\"none\" stroke=\"rgba(16,24,40,.055)\" stroke-width=\"2.6\" stroke-linecap=\"round\"/>",
  "    <path d=\"M57.8 61.4c1.7 3.4 2.7 7.2 3.1 11.4\" fill=\"none\" stroke=\"rgba(16,24,40,.05)\" stroke-width=\"2.6\" stroke-linecap=\"round\"/>",
  "    <path d=\"M36.8 59.8c5.4 3.6 13 3.6 18.4 0\" fill=\"none\" stroke=\"rgba(16,24,40,.10)\" stroke-width=\"1\" stroke-linecap=\"round\"/>",
  "",
  "    <path d=\"M46 58.4 37 60.2 46 75.4z\" fill=\"#ffffff\" stroke=\"rgba(16,24,40,.15)\" stroke-width=\".9\" stroke-linejoin=\"round\"/>",
  "    <path d=\"M46 58.4 55 60.2 46 75.4z\" fill=\"#ffffff\" stroke=\"rgba(16,24,40,.15)\" stroke-width=\".9\" stroke-linejoin=\"round\"/>",
  "    <path d=\"M43.2 58.9h5.6l-2.8 6.2z\" fill=\"#dee6ec\" stroke=\"rgba(16,24,40,.09)\" stroke-width=\".5\"/>",
  "    <path d=\"M46 59.2v16\" fill=\"none\" stroke=\"rgba(16,24,40,.06)\" stroke-width=\".7\"/>",
  "",
  "    <g transform=\"rotate(-5 59.4 73.8)\">",
  "      <path d=\"M59.2 67.3v1.6\" stroke=\"#b9c3cb\" stroke-width=\"1\" stroke-linecap=\"round\"/>",
  "      <rect x=\"55.4\" y=\"68.6\" width=\"8\" height=\"10.4\" rx=\"1.4\" fill=\"#ffffff\" stroke=\"rgba(16,24,40,.16)\" stroke-width=\".55\"/>",
  "      <rect x=\"55.4\" y=\"68.6\" width=\"8\" height=\"2.9\" fill=\"rgba(15,163,146,.78)\" clip-path=\"url(#__U__-badge)\"/>",
  "      <rect x=\"56.9\" y=\"72.9\" width=\"5\" height=\".85\" rx=\".42\" fill=\"rgba(16,24,40,.24)\"/>",
  "      <rect x=\"56.9\" y=\"74.6\" width=\"3.3\" height=\".85\" rx=\".42\" fill=\"rgba(16,24,40,.13)\"/>",
  "      <circle cx=\"59.4\" cy=\"67.6\" r=\".85\" fill=\"#c8d1d8\" stroke=\"rgba(16,24,40,.18)\" stroke-width=\".4\"/>",
  "    </g>",
  "",
  "    <g class=\"gg-head\">",
  "      <ellipse cx=\"31.9\" cy=\"39\" rx=\"2.05\" ry=\"3.25\" fill=\"#efd3c1\" stroke=\"rgba(160,110,90,.18)\" stroke-width=\".5\"/>",
  "      <path d=\"M32 37.2c.8.7.8 2.7-.1 3.7\" fill=\"none\" stroke=\"rgba(160,110,90,.26)\" stroke-width=\".5\" stroke-linecap=\"round\"/>",
  "      <ellipse cx=\"60.1\" cy=\"39\" rx=\"2.05\" ry=\"3.25\" fill=\"#efd3c1\" stroke=\"rgba(160,110,90,.18)\" stroke-width=\".5\"/>",
  "      <path d=\"M60 37.2c-.8.7-.8 2.7.1 3.7\" fill=\"none\" stroke=\"rgba(160,110,90,.24)\" stroke-width=\".5\" stroke-linecap=\"round\"/>",
  "",
  "      <path d=\"M46 20.6c8.4 0 13.2 6 13.2 14.6 0 5.2-1.2 9.8-3.6 13-2.3 3-5.5 4.4-9.6 4.4s-7.3-1.4-9.6-4.4c-2.4-3.2-3.6-7.8-3.6-13C32.8 26.6 37.6 20.6 46 20.6z\" fill=\"#f3dccb\"/>",
  "",
  "      <g clip-path=\"url(#__U__-face)\">",
  "        <ellipse cx=\"34.8\" cy=\"36\" rx=\"2.1\" ry=\"7.2\" fill=\"rgba(160,110,95,.05)\"/>",
  "        <ellipse cx=\"57.2\" cy=\"36\" rx=\"2.1\" ry=\"7.2\" fill=\"rgba(160,110,95,.045)\"/>",
  "        <ellipse cx=\"38\" cy=\"43\" rx=\"3.4\" ry=\"2.1\" fill=\"rgba(214,140,120,.09)\"/>",
  "        <ellipse cx=\"54\" cy=\"43\" rx=\"3.4\" ry=\"2.1\" fill=\"rgba(214,140,120,.08)\"/>",
  "        <ellipse cx=\"46\" cy=\"50.6\" rx=\"2.1\" ry=\"1\" fill=\"rgba(255,255,255,.22)\"/>",
  "        <path d=\"M46 52.2c-3.8 0-6.9-1.2-9.2-3.4 1.8 2.7 5 4.3 9.2 4.3s7.4-1.6 9.2-4.3c-2.3 2.2-5.4 3.4-9.2 3.4z\" fill=\"rgba(150,96,80,.06)\"/>",
  "      </g>",
  "",
  "      <ellipse cx=\"46\" cy=\"44.8\" rx=\"2.3\" ry=\"1.25\" fill=\"rgba(163,110,92,.055)\"/>",
  "      <path d=\"M47.1 39.4c.7 2.1.9 4.1.4 5.8-.2.8-.8 1.3-1.6 1.4\" fill=\"none\" stroke=\"rgba(163,110,92,.12)\" stroke-width=\"1\" stroke-linecap=\"round\"/>",
  "      <ellipse cx=\"44.5\" cy=\"45.4\" rx=\".55\" ry=\".45\" fill=\"rgba(140,86,70,.26)\"/>",
  "      <ellipse cx=\"47.5\" cy=\"45.4\" rx=\".55\" ry=\".45\" fill=\"rgba(140,86,70,.22)\"/>",
  "      <path d=\"M43.8 46.2c1.4.7 3 .7 4.4 0\" fill=\"none\" stroke=\"rgba(150,96,80,.11)\" stroke-width=\".6\" stroke-linecap=\"round\"/>",
  "",
  "      <g class=\"gg-mouth\" transform=\"translate(46 48.7)\">",
  "        <ellipse class=\"gg-mouth-cavity\" cx=\"0\" cy=\"-.1\" rx=\"2.65\" ry=\".3\" fill=\"#8a5b53\"/>",
  "        <path d=\"M-3.3 -.5c1-.6 2.1-.95 3.3-.95s2.3.35 3.3.95\" fill=\"none\" stroke=\"#a97a72\" stroke-width=\".82\" stroke-linecap=\"round\"/>",
  "        <g class=\"gg-lip-bottom\">",
  "          <path d=\"M-2.9 .05c.6 1.2 1.7 1.8 2.9 1.8s2.3-.6 2.9-1.8c-.95.4-1.95.6-2.9.6s-1.95-.2-2.9-.6z\" fill=\"#dda596\" opacity=\".55\"/>",
  "        </g>",
  "        <path d=\"M-2 4c1.3.55 2.7.55 4 0\" fill=\"none\" stroke=\"rgba(160,108,92,.1)\" stroke-width=\".6\" stroke-linecap=\"round\"/>",
  "      </g>",
  "",
  "      <g clip-path=\"url(#__U__-eye-l)\">",
  "        <ellipse cx=\"40\" cy=\"37.6\" rx=\"3.3\" ry=\"1.85\" fill=\"#fbf8f3\"/>",
  "        <circle cx=\"40.15\" cy=\"37.6\" r=\"1.68\" fill=\"#4c5a63\"/>",
  "        <circle cx=\"40.15\" cy=\"37.6\" r=\".8\" fill=\"#232a31\"/>",
  "        <ellipse cx=\"39.55\" cy=\"36.95\" rx=\".5\" ry=\".42\" fill=\"#ffffff\" opacity=\".92\"/>",
  "        <g class=\"gg-lid\">",
  "          <rect x=\"35.8\" y=\"29.6\" width=\"8.4\" height=\"6.5\" fill=\"#f3dccb\"/>",
  "          <path d=\"M36.5 36.15c1.9-.9 5.2-.9 7.1 0\" fill=\"none\" stroke=\"#343a41\" stroke-width=\".9\" stroke-linecap=\"round\"/>",
  "        </g>",
  "      </g>",
  "      <g clip-path=\"url(#__U__-eye-r)\">",
  "        <ellipse cx=\"52\" cy=\"37.6\" rx=\"3.3\" ry=\"1.85\" fill=\"#fbf8f3\"/>",
  "        <circle cx=\"51.85\" cy=\"37.6\" r=\"1.68\" fill=\"#4c5a63\"/>",
  "        <circle cx=\"51.85\" cy=\"37.6\" r=\".8\" fill=\"#232a31\"/>",
  "        <ellipse cx=\"51.25\" cy=\"36.95\" rx=\".5\" ry=\".42\" fill=\"#ffffff\" opacity=\".92\"/>",
  "        <g class=\"gg-lid\">",
  "          <rect x=\"47.8\" y=\"29.6\" width=\"8.4\" height=\"6.5\" fill=\"#f3dccb\"/>",
  "          <path d=\"M48.4 36.15c1.9-.9 5.2-.9 7.1 0\" fill=\"none\" stroke=\"#343a41\" stroke-width=\".9\" stroke-linecap=\"round\"/>",
  "        </g>",
  "      </g>",
  "      <path d=\"M36.6 34.9c2.1-1.3 4.9-1.4 6.9-.2\" fill=\"none\" stroke=\"rgba(150,100,86,.18)\" stroke-width=\".5\" stroke-linecap=\"round\"/>",
  "      <path d=\"M48.5 34.7c2-1.2 4.8-1.1 6.9.2\" fill=\"none\" stroke=\"rgba(150,100,86,.16)\" stroke-width=\".5\" stroke-linecap=\"round\"/>",
  "      <path d=\"M37.2 39.5c1.7.8 3.9.8 5.5 0\" fill=\"none\" stroke=\"rgba(140,95,80,.13)\" stroke-width=\".45\" stroke-linecap=\"round\"/>",
  "      <path d=\"M49.3 39.5c1.7.8 3.9.8 5.5 0\" fill=\"none\" stroke=\"rgba(140,95,80,.12)\" stroke-width=\".45\" stroke-linecap=\"round\"/>",
  "",
  "      <g class=\"gg-brows\">",
  "        <path d=\"M36.6 33.2c1.9-1 4.4-1 6.2 0\" fill=\"none\" stroke=\"#4a5058\" stroke-width=\".8\" stroke-linecap=\"round\"/>",
  "        <path d=\"M49.2 33.2c1.9-1 4.4-1 6.2 0\" fill=\"none\" stroke=\"#4a5058\" stroke-width=\".8\" stroke-linecap=\"round\"/>",
  "      </g>",
  "",
  "      <path d=\"M58.4 33.2c.5-3 .4-6.8-1-9.2-1.5-2.6-3.9-4-7-4.2-2.5-.2-5 .4-7.1 1.6-2.4 1.4-4 3.2-4.8 5.7\" fill=\"none\" stroke=\"rgba(150,108,94,.10)\" stroke-width=\"1.3\" stroke-linecap=\"round\"/>",
  "",
  "      <path d=\"M32.6 37C31.2 32.4 31.4 26.4 34 22.4 36.6 18.4 41.2 15.4 46.6 15.4c5.6 0 10 3.2 12 7.6 1.8 4 1.6 9.5.6 13.4-.6-3.2-1-6.2-2-8.4-1.4-3-4-4.4-7.1-4.2-3.4.2-6.4 1.2-8.8 3.1-2.4 1.9-3.8 4.1-4.6 6.7-.4 1.3-.6 2.5-.7 3.4z\" fill=\"url(#__U__-hair)\"/>",
  "",
  "      <path d=\"M49.6 23.6c.9-2.2.9-4.6.2-6.6\" fill=\"none\" stroke=\"rgba(24,28,33,.45)\" stroke-width=\".7\" stroke-linecap=\"round\"/>",
  "",
  "      <g fill=\"none\" stroke-linecap=\"round\" opacity=\".52\">",
  "        <path d=\"M48.4 16.6c-3.2 1.3-5.8 3.4-7.4 6.2\" stroke=\"#6b737e\" stroke-width=\".6\"/>",
  "        <path d=\"M49.8 19.4c-2.6 1.4-4.7 3.3-6 5.7\" stroke=\"#646c77\" stroke-width=\".5\"/>",
  "        <path d=\"M46.6 15.6c-2.2 1.5-3.9 3.4-4.9 5.6\" stroke=\"#6b737e\" stroke-width=\".6\"/>",
  "        <path d=\"M40 19.4c-2 2-3.3 4.3-3.9 6.8\" stroke=\"#646c77\" stroke-width=\".5\"/>",
  "        <path d=\"M51.6 16.4c1.9 1.9 3.2 4.3 3.8 7.1\" stroke=\"#6b737e\" stroke-width=\".6\"/>",
  "        <path d=\"M54.6 19.6c1.5 1.9 2.4 4.2 2.7 6.8\" stroke=\"#646c77\" stroke-width=\".5\"/>",
  "        <path d=\"M35.6 28.4c-.6 1.9-.9 3.8-.9 5.6\" stroke=\"#5c636e\" stroke-width=\".45\"/>",
  "        <path d=\"M57.4 27.4c.5 1.9.8 3.8.9 5.6\" stroke=\"#5c636e\" stroke-width=\".45\"/>",
  "      </g>",
  "      <path d=\"M37.4 21.6c-2.2 1.7-3.7 3.9-4.6 6.4\" fill=\"none\" stroke=\"rgba(255,255,255,.13)\" stroke-width=\"1.3\" stroke-linecap=\"round\"/>",
].join("\n");

function figureMarkup(uid) {
  return FIG_SVG.replace(/__U__/g, uid);
}

const ICON_ON =
  '<svg class="guide-icon guide-icon-on" viewBox="0 0 16 16" aria-hidden="true"><path d="M8.4 2.6 5.2 5.2H2.9v5.6h2.3l3.2 2.6z" fill="currentColor" opacity=".85"/><path d="M10.4 5.6c.9.9.9 3.9 0 4.8M12.2 3.9c1.9 1.9 1.9 6.3 0 8.2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
const ICON_OFF =
  '<svg class="guide-icon guide-icon-off" viewBox="0 0 16 16" aria-hidden="true"><path d="M8.4 2.6 5.2 5.2H2.9v5.6h2.3l3.2 2.6z" fill="currentColor" opacity=".85"/><path d="M10.4 6.2 13.6 9.8M13.6 6.2 10.4 9.8" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';

function cardMarkup(figure) {
  return (
    '<div class="guide-head">' +
    '<div class="guide-avatar">' + figure + '</div>' +
    '<div class="guide-id">' +
    '<p class="guide-kicker">GUIDE · 语音讲解</p>' +
    '<p class="guide-name">晓晓 · 讲解员</p>' +
    '<p class="guide-state-row">' +
    '<span class="guide-live" aria-hidden="true"></span>' +
    '<span class="guide-state">待机</span>' +
    '<span class="guide-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
    '</p>' +
    '</div>' +
    '<button class="guide-sound" type="button" aria-pressed="false" aria-label="关闭语音" title="关闭语音">' +
    ICON_ON +
    ICON_OFF +
    '</button>' +
    '</div>' +
    '<p class="guide-caption is-quiet" aria-live="polite">' +
    IDLE_CAPTION +
    '</p>'
  );
}

/* ---------- 组件 ---------- */

export function createGuide(options = {}) {
  const opts = options || {};
  let host = opts.root;
  if (typeof host === 'string') {
    try {
      host = document.querySelector(host);
    } catch {
      host = null;
    }
  }
  if (!host || host.nodeType !== 1) host = document.body || document.documentElement;

  const uid = 'gg' + Math.random().toString(36).slice(2, 8);
  const card = document.createElement('aside');
  card.className = 'guide-card';
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', '数字人讲解员');
  card.innerHTML = cardMarkup(figureMarkup(uid));
  host.appendChild(card);

  const q = (sel) => card.querySelector(sel);
  const captionEl = q('.guide-caption');
  const stateEl = q('.guide-state');
  const muteBtn = q('.guide-sound');
  const headG = q('.gg-head');
  const browsG = q('.gg-brows');
  const cavity = q('.gg-mouth-cavity');
  const lipLower = q('.gg-lip-bottom');

  const synth = getSynth();
  let destroyed = false;
  let muted = false;
  let currentJob = null;
  let motionRaf = 0;
  let blinkTimer = 0;
  let blinkOut = 0;
  let voiceCache = [];
  let voiceChangedHandler = null;
  let seq = 0;
  let preferredVoice = '';
  let speakRate = SPEAK_RATE;
  let speakPitch = 1;
  /* 预生成神经语音（开发期用 edge-tts 生成 mp3，运行时不依赖网络与系统音色） */
  let audioBase = '';
  let audioSets = [];
  let audioIndex = new Map(); // (id + '\u0000' + 文本) → 相对路径
  let prefAudio = '';
  let audioEl = null;

  /* ----- 语音列表 ----- */

  function refreshVoices() {
    if (!synth) return;
    try {
      voiceCache = Array.from(synth.getVoices() || []);
    } catch {
      voiceCache = [];
    }
  }

  /* 中文音色池：zh 语言或名字里带 Chinese/中文；离线优先，其次自然音色 */
  function voicePool() {
    if (!voiceCache.length) refreshVoices();
    return voiceCache.filter(
      (v) => /^zh/i.test(v.lang || '') || /chinese|中文|普通话/i.test(v.name || '')
    );
  }

  const FEMALE_HINTS = ['xiaoxiao', 'xiaoyi', 'yunxia', 'yunhui', 'huihui', 'yaoyao', 'tingting', 'lili', 'zhiyu', 'female', '女'];
  const NATURAL_HINTS = ['natural', 'neural', 'online'];

  function isNatural(v) {
    const n = String(v.name || '').toLowerCase();
    return NATURAL_HINTS.some((k) => n.includes(k));
  }

  /* 排序：本机音色优先（保证离线可用），本机里自然音色 > 女声 > 其它 */
  function rankVoice(v) {
    const local = v.localService === false ? 1 : 0;
    const natural = isNatural(v) ? 0 : 1;
    const name = String(v.name || '').toLowerCase();
    const female = FEMALE_HINTS.some((k) => name.includes(k)) ? 0 : 1;
    return local * 100 + natural * 10 + female;
  }

  function pickVoice() {
    const pool = voicePool();
    if (!pool.length) return null; // 没有中文音色 → 只走字幕估时
    if (preferredVoice) {
      const want = String(preferredVoice).toLowerCase();
      const hit =
        pool.find((v) => String(v.name || '') === preferredVoice) ||
        pool.find((v) => String(v.name || '').toLowerCase() === want) ||
        pool.find((v) => String(v.name || '').toLowerCase().includes(want));
      if (hit) return hit;
    }
    const xiaoxiao = pool.find((v) => /xiaoxiao|晓晓/i.test(String(v.name || "")));
    if (xiaoxiao) return xiaoxiao;
    return pool.slice().sort((a, b) => rankVoice(a) - rankVoice(b))[0];
  }

  function listVoices() {
    return voicePool()
      .slice()
      .sort((a, b) => rankVoice(a) - rankVoice(b))
      .map((v) => ({
        name: String(v.name || ''),
        lang: String(v.lang || ''),
        local: v.localService !== false
      }));
  }

  function setAudioVoices(list, origin) {
    audioBase = String(origin == null ? '' : origin);
    audioSets = (Array.isArray(list) ? list : [])
      .filter((v) => v && v.id && v.files)
      .map((v) => ({
        id: String(v.id),
        label: String(v.label || v.id),
        desc: String(v.desc || ''),
        voice: String(v.voice || ''),
        files: v.files
      }));
    audioIndex = new Map();
    for (const set of audioSets) {
      for (const [text, rel] of Object.entries(set.files || {})) {
        audioIndex.set(set.id + '\u0000' + normText(text), String(rel));
      }
    }
    if (prefAudio && !audioSets.some((v) => v.id === prefAudio)) prefAudio = '';
    return audioSets.length;
  }

  function listAudioVoices() {
    return audioSets.map((v) => ({ id: v.id, label: v.label, desc: v.desc }));
  }

  function getAudioVoice() {
    return prefAudio;
  }

  /* 当前选中音色对应的整句音轨；没有就返回空串（退回系统音色或字幕） */
  function audioSourceFor(text) {
    if (!prefAudio) return '';
    const rel = audioIndex.get(prefAudio + '\u0000' + normText(text));
    if (!rel) return '';
    try {
      return new URL(audioBase + rel, document.baseURI).href;
    } catch {
      return '';
    }
  }

  /* setVoice: "audio:xiaoxiao" 选预生成音色；其余按系统音色名字匹配 */
  function setVoice(name) {
    const raw = name == null ? '' : String(name);
    if (/^audio:/i.test(raw)) {
      const id = raw.slice(6);
      prefAudio = audioSets.some((v) => v.id === id) ? id : '';
      preferredVoice = '';
      return prefAudio ? 'audio:' + prefAudio : '';
    }
    prefAudio = '';
    preferredVoice = raw;
    return preferredVoice;
  }

  function getVoice() {
    if (prefAudio) return 'audio:' + prefAudio;
    const picked = pickVoice();
    return picked ? String(picked.name || '') : '';
  }

  function setRate(value) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) speakRate = clamp(n, 0.5, 2);
    return speakRate;
  }

  function setPitch(value) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) speakPitch = clamp(n, 0.5, 2);
    return speakPitch;
  }

  function whenVoicesReady(timeout = 240) {
    if (!synth || voiceCache.length) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      let timer = 0;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (typeof synth.removeEventListener === 'function') {
          try {
            synth.removeEventListener('voiceschanged', onChange);
          } catch {
            /* 忽略 */
          }
        }
        resolve();
      };
      const onChange = () => {
        refreshVoices();
        if (voiceCache.length) finish();
      };
      timer = setTimeout(finish, timeout);
      if (typeof synth.addEventListener === 'function') {
        try {
          synth.addEventListener('voiceschanged', onChange);
        } catch {
          finish();
        }
      } else {
        finish();
      }
    });
  }

  refreshVoices();
  if (synth && typeof synth.addEventListener === 'function') {
    voiceChangedHandler = () => refreshVoices();
    try {
      synth.addEventListener('voiceschanged', voiceChangedHandler);
    } catch {
      voiceChangedHandler = null;
    }
  }

  /* ----- 状态与字幕 ----- */

  function setCaption(text, quiet) {
    captionEl.textContent = text || '';
    captionEl.classList.toggle('is-quiet', !!quiet);
  }

  function updateState() {
    const speaking = !!currentJob && !currentJob.done;
    stateEl.textContent = muted ? '静音' : speaking ? '讲解中' : '待机';
    card.dataset.state = muted ? 'muted' : speaking ? 'speaking' : 'idle';
  }

  /* ----- 动画：口型 / 微摆 / 眨眼 ----- */

  function startMotion() {
    stopMotion();
    if (destroyed) return;
    const t0 = now();
    const reduce = prefersReduced();
    let lipIndex = -1;
    const loop = (ts) => {
      motionRaf = 0;
      if (destroyed || !currentJob) return;
      // 虚拟时间/时钟回跳时 ts 可能略小于 t0，负数会让 % 变负 → 取 0 兜底
      const t = Math.max(0, (typeof ts === 'number' ? ts : now()) - t0);
      const sway = reduce ? 0 : Math.sin(t / 1250) * 1.2 + Math.sin(t / 405) * 0.16;
      headG.setAttribute('transform', 'rotate(' + sway.toFixed(2) + ' 46 63)');
      const brow = reduce ? 0 : Math.sin(t / 760) * 0.24;
      browsG.setAttribute('transform', 'translate(0 ' + brow.toFixed(2) + ')');
      const idx = Math.floor(t / 118) % LIP_FRAMES.length;
      if (idx !== lipIndex) {
        lipIndex = idx;
        const ry = LIP_RY[LIP_FRAMES[idx]];
        const open = ry - LIP_RY[0];
        cavity.setAttribute('ry', ry.toFixed(2));
        cavity.setAttribute('cy', (-0.15 + open * 0.35).toFixed(2));
        lipLower.setAttribute('transform', 'translate(0 ' + (open * 0.85).toFixed(2) + ')');
      }
      motionRaf = requestFrame(loop);
    };
    motionRaf = requestFrame(loop);
  }

  function stopMotion() {
    if (motionRaf) {
      cancelFrame(motionRaf);
      motionRaf = 0;
    }
    if (!headG) return;
    headG.removeAttribute('transform');
    browsG.removeAttribute('transform');
    cavity.setAttribute('ry', LIP_RY[0].toFixed(2));
    cavity.setAttribute('cy', '-0.15');
    lipLower.setAttribute('transform', 'translate(0 0)');
  }

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(
      () => {
        if (destroyed) return;
        card.classList.add('is-blinking');
        clearTimeout(blinkOut);
        blinkOut = setTimeout(() => {
          card.classList.remove('is-blinking');
          scheduleBlink();
        }, 140);
      },
      4200 + Math.random() * 2800
    );
  }

  /* ----- 语音任务 ----- */

  function cancelSynth() {
    if (!synth) return;
    try {
      synth.cancel();
    } catch {
      /* 忽略 */
    }
  }

  function timerJob(job) {
    if (job.done) return;
    job.timers.push(setTimeout(() => finishJob(job), Math.max(120, job.est)));
  }

  function speakJob(job, voice, content) {
    let utter = null;
    try {
      utter = new window.SpeechSynthesisUtterance(content);
    } catch {
      timerJob(job);
      return;
    }
    utter.lang = 'zh-CN';
    utter.rate = speakRate;
    utter.pitch = speakPitch;
    utter.volume = 1;
    try {
      utter.voice = voice;
    } catch {
      /* 忽略 */
    }
    job.utter = utter;
    utter.onstart = () => {
      if (!job.done) job.started = true;
    };
    utter.onend = () => finishJob(job);
    utter.onerror = () => finishJob(job);

    const queue = () => {
      if (job.done || destroyed) return;
      try {
        if (synth.paused) synth.resume();
      } catch {
        /* 忽略 */
      }
      try {
        synth.cancel();
      } catch {
        /* 忽略 */
      }
      try {
        synth.speak(utter);
      } catch {
        timerJob(job);
        return;
      }
      // 被浏览器策略吞掉（无 onstart）：退回字幕估时，绝不挂死
      job.timers.push(
        setTimeout(() => {
          if (job.done || job.started) return;
          try {
            synth.cancel();
          } catch {
            /* 忽略 */
          }
          timerJob(job);
        }, 900)
      );
      // 兜底：已开始但 onend 永不来（标签页休眠等）
      job.timers.push(
        setTimeout(
          () => finishJob(job),
          Math.min(60000, Math.max(9000, job.est * 2 + 4000))
        )
      );
    };
    // cancel 后立刻 speak 在 Chromium 下偶发被吞，让出一拍
    job.timers.push(setTimeout(queue, 40));
  }

  /* 系统音色朗读；没有中文音色就按字幕估时 */
  function speakWithSynth(job) {
    whenVoicesReady().then(() => {
      if (job.done || destroyed) return;
      if (muted) {
        timerJob(job);
        return;
      }
      const voice = pickVoice();
      if (!voice) {
        timerJob(job);
        return;
      }
      speakJob(job, voice, job.text);
    });
  }

  function pauseAudio() {
    const el = audioEl;
    audioEl = null;
    if (!el) return;
    try {
      el.pause();
    } catch {
      /* 忽略 */
    }
  }

  /* 播放预生成音轨：时长即朗读时长，省掉估时；加载失败退回系统音色 */
  function playAudioJob(job, src) {
    let el = null;
    try {
      el = new window.Audio(src);
    } catch {
      el = null;
    }
    if (!el) {
      speakWithSynth(job);
      return;
    }
    job.audio = el;
    audioEl = el;
    el.preload = 'auto';
    el.volume = 1;
    try {
      el.playbackRate = clamp(speakRate, 0.5, 2);
    } catch {
      /* 忽略 */
    }
    let started = false;
    const guard = setTimeout(() => {
      if (job.done || started) return;
      try {
        el.pause();
      } catch {
        /* 忽略 */
      }
      if (job.audio === el) job.audio = null;
      if (audioEl === el) audioEl = null;
      speakWithSynth(job);
    }, 3600);
    el.addEventListener('playing', () => {
      started = true;
      job.started = true;
      clearTimeout(guard);
    });
    el.addEventListener('ended', () => {
      clearTimeout(guard);
      finishJob(job);
    });
    el.addEventListener('error', () => {
      clearTimeout(guard);
      if (job.done) return;
      if (job.audio === el) job.audio = null;
      if (audioEl === el) audioEl = null;
      speakWithSynth(job);
    });
    try {
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          if (job.done || started) return;
          clearTimeout(guard);
          if (job.audio === el) job.audio = null;
          if (audioEl === el) audioEl = null;
          speakWithSynth(job);
        });
      }
    } catch {
      clearTimeout(guard);
      if (job.audio === el) job.audio = null;
      speakWithSynth(job);
    }
  }

  function finishJob(job) {
    if (!job || job.done) return;
    job.done = true;
    for (const t of job.timers) clearTimeout(t);
    job.timers.length = 0;
    job.utter = null;
    if (job.audio) {
      const el = job.audio;
      job.audio = null;
      if (audioEl === el) audioEl = null;
      try {
        el.pause();
      } catch {
        /* 忽略 */
      }
    }
    if (currentJob === job) {
      currentJob = null;
      stopMotion();
      card.classList.remove('is-speaking');
      updateState();
    }
    try {
      job.resolve();
    } catch {
      /* 忽略 */
    }
  }

  /* ----- 对外 API ----- */

  function say(text, sayOpts) {
    const content = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    stop(); // 先打断上一句（并 resolve 旧 Promise）
    if (destroyed) return Promise.resolve();
    if (!content) {
      setCaption('', true);
      return Promise.resolve();
    }
    setCaption(content, false);
    const ms = sayOpts && Number(sayOpts.ms);
    const est = Number.isFinite(ms) && ms > 0 ? ms : estimateMs(content);

    return new Promise((resolve) => {
      const job = {
        seq: ++seq,
        est,
        t0: now(),
        done: false,
        started: false,
        utter: null,
        timers: [],
        resolve
      };
      currentJob = job;
      card.classList.add('is-speaking');
      updateState();
      if (!muted) startMotion();

      job.text = content;
      const audioSrc = muted ? '' : audioSourceFor(content);
      if (audioSrc) playAudioJob(job, audioSrc);
      else speakWithSynth(job);
    });
  }

  function stop() {
    const job = currentJob;
    if (job) finishJob(job);
    pauseAudio();
    cancelSynth();
    stopMotion();
    card.classList.remove('is-speaking');
    updateState();
  }

  function setMuted(next) {
    muted = !!next;
    card.classList.toggle('is-muted', muted);
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    const label = muted ? '开启语音' : '关闭语音';
    muteBtn.setAttribute('aria-label', label);
    muteBtn.title = label;
    if (muted) {
      pauseAudio();
      cancelSynth(); // 立即静音
      stopMotion();
      const job = currentJob;
      if (job && !job.done) {
        // 静音后字幕按剩余估时继续走完，口型不动
        const left = Math.max(400, job.est - (now() - job.t0));
        job.timers.push(setTimeout(() => finishJob(job), left));
      }
    }
    updateState();
    return muted;
  }

  const onMuteClick = (event) => {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    setMuted(!muted);
  };
  muteBtn.addEventListener('click', onMuteClick);

  function destroy() {
    if (destroyed) return;
    stop();
    destroyed = true;
    clearTimeout(blinkTimer);
    clearTimeout(blinkOut);
    if (motionRaf) cancelFrame(motionRaf);
    motionRaf = 0;
    card.classList.remove('is-blinking');
    if (synth && voiceChangedHandler && typeof synth.removeEventListener === 'function') {
      try {
        synth.removeEventListener('voiceschanged', voiceChangedHandler);
      } catch {
        /* 忽略 */
      }
    }
    voiceChangedHandler = null;
    muteBtn.removeEventListener('click', onMuteClick);
    if (card.parentNode) card.parentNode.removeChild(card);
  }

  scheduleBlink();
  updateState();

  return {
    say,
    stop,
    setMuted,
    isMuted: () => muted,
    /* 音色：listVoices 给 UI 列，setVoice 传名字（传空回到自动挑选） */
    listVoices,
    setVoice,
    getVoice,
    /* 预生成音色：main.js 读完 manifest 后灌进来 */
    setAudioVoices,
    listAudioVoices,
    getAudioVoice,
    setRate,
    getRate: () => speakRate,
    setPitch,
    getPitch: () => speakPitch,
    destroy,
    el: card
  };
}
