// P2 测量流程 —— 由分屏外壳 main.js 在首次进入时调用 mount()。
// 约定：只在本文件内构建 DOM；样式写在 p2.css；所有数据来自 ../paper-detail.js，不得编造。

import {
  INCUBATION,
  ACQUISITION,
  SAMPLING_POINTS,
  GATES,
  LEAK_RULES,
  LIMITS
} from "../paper-detail.js";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));

const num = (value) => `<span class="num">${esc(value)}</span>`;
const unit = (value) => `<span class="unit">${esc(value)}</span>`;
// 把数据串里的数字包成 .num，保持“数字一律等宽”的排版约定。
const digitize = (text) => esc(text).replace(/(\d+(?:\.\d+)?)/g, '<span class="num">$1</span>');

const TOTAL = SAMPLING_POINTS.length;
const DAYS = [...new Set(SAMPLING_POINTS.map((p) => p.day))];
const dayPoints = (day) => SAMPLING_POINTS.filter((p) => p.day === day);
const dayId = (p) => `D${p.day}`;
const slotOrd = (p) => (p.slot === "上午" ? 1 : 2);
const pad2 = (value) => String(value).padStart(2, "0");

// mount() 建好的控制器；autoplay() 从 #screen-2 取回，避免重复写 DOM。
const controllers = new WeakMap();
let activeShow = null;

// 论文只给了一整句批次说明，这里拆成吨位/时长/人员三段，不在模板里另写数字。
const batchParts = ACQUISITION.batchSession.replace(/^≈\s*/, "").split("/").map((part) => part.trim());
const batchDuration = batchParts[0] || "";
const batchEggs = batchParts[1] || "";
const batchOps = batchParts[2] || "";

const pointMarkup = (p) => `
  <button type="button" class="p2-point" data-index="${p.index}"${p.index === 0 ? ' aria-current="step"' : ""}
    aria-label="${esc(`第 ${p.index + 1} 个时间点：${dayId(p)} ${p.slot}，累计 ${p.hours} 小时`)}">
    <span class="p2-slot">${esc(p.slot)}</span>
    <span class="p2-hours">${num(p.hours)} ${unit("h")}</span>
  </button>`;

const timelineMarkup = DAYS.map((day) => {
  const pts = dayPoints(day);
  const from = pts[0].hours;
  const to = pts[pts.length - 1].hours;
  return `
    <div class="p2-day" role="group" aria-label="${esc(`D${day}，累计 ${from} 至 ${to} 小时`)}">
      <div class="p2-day-head">
        <span class="p2-day-id">D${day}</span>
        <span class="p2-day-span">${num(from)}–${num(to)} ${unit("h")}</span>
      </div>
      ${pts.map(pointMarkup).join("")}
    </div>`;
}).join("");

const detailMarkup = (p) => {
  const i = p.index;
  const day = dayId(p);
  const gap =
    i === 0
      ? "本蛋第 1 次采样"
      : `距上一时间点 ${num(p.hours - SAMPLING_POINTS[i - 1].hours)} h`;
  return `
    <div class="p2-detail-top">
      <div>
        <p class="eyebrow">时间点 ${num(pad2(i + 1))} / ${num(TOTAL)}</p>
        <h3>${day} · ${esc(p.slot)}</h3>
      </div>
      <span class="tag">累计 ${num(p.hours)} h</span>
    </div>
    <p class="p2-detail-meta">
      <span>${gap}</span>
      <span>同日第 ${num(slotOrd(p))} / ${num(dayPoints(p.day).length)} 点</span>
    </p>
    <ol class="p2-steps">
      <li>
        <span class="p2-step-idx">01</span>
        <div>
          <b>白 / 暗参考</b>
          <span>同一光路先取参考帧；每 ${num(ACQUISITION.recalibrateMin)} min 重做一次</span>
        </div>
      </li>
      <li>
        <span class="p2-step-idx">02</span>
        <div>
          <b>${num(ACQUISITION.framesPerPoint)} 帧 × ${num(ACQUISITION.exposureMs)} ms</b>
          <span>连续采集，合计 ${num(ACQUISITION.integrationS)} s</span>
        </div>
      </li>
      <li>
        <span class="p2-step-idx">03</span>
        <div>
          <b>逐波长平均</b>
          <span>${num(ACQUISITION.points)} 个波长点各取均值 → 1 条时间点谱</span>
        </div>
      </li>
      <li>
        <span class="p2-step-idx">04</span>
        <div>
          <b>同日两条 → 1 条日谱</b>
          <span>${day} 上午 + ${day} 下午两条时间点谱逐波长平均，得到 1 条 ${day} 日谱</span>
        </div>
      </li>
    </ol>
    <div class="p2-detail-foot">
      <span class="tag is-quiet">入组条件</span>
      <p>${num(TOTAL)} 个时间点全齐才计入该蛋；缺一点即剔除，不插值、不平滑。</p>
    </div>`;
};

const gateMarkup = GATES.map((gate) => `
  <article class="p2-gate">
    <div class="p2-gate-head">
      <span class="tag">${esc(gate.id)}</span>
      <h4>${esc(gate.name)}</h4>
    </div>
    <p class="p2-gate-when">${esc(gate.when)}</p>
    <p class="p2-gate-verdict">${esc(gate.verdict)}</p>
    <div class="p2-gate-value"><span>结论值</span><strong>${esc(gate.value)}</strong></div>
  </article>`).join("");

export function mount(root) {
  const [temp, tempTol] = INCUBATION.tempC;
  const [rhLo, rhHi] = INCUBATION.rh;
  const [rhLateLo, rhLateHi] = INCUBATION.rhLate;
  const orderLimit = LIMITS.find((item) => item.includes("未随机化")) || LIMITS[0];

  const chips = [
    `镜头–蛋 ${num(ACQUISITION.lensToEggCm)} cm`,
    `曝光 ${num(ACQUISITION.exposureMs)} ms × ${num(ACQUISITION.framesPerPoint)} 帧`,
    `灯预热 ${num(ACQUISITION.lampWarmupMin)} min`,
    `每 ${num(ACQUISITION.recalibrateMin)} min 重校准`,
    `单蛋 ${num(ACQUISITION.secondsPerEgg)} s`,
    `一批 ${digitize(batchEggs)} · 约 ${digitize(batchDuration)}`,
    `离箱 ≤ ${num(ACQUISITION.offIncubatorMin)} min`
  ]
    .map((text) => `<span class="chip">${text}</span>`)
    .join("");

  root.innerHTML = `
    <div class="screen-inner p2">
      <header class="screen-head">
        <p class="eyebrow">P2 · 测量流程</p>
        <h2>一枚蛋，14 次采样，7 条日谱</h2>
        <p class="lead">光路固定、顺序固定、时间固定：卤钨灯在下、种蛋钝端朝上、镜头在蛋上方 ${num(ACQUISITION.lensToEggCm)}&nbsp;cm，同一位姿完成全部 ${num(TOTAL)} 次采样。D1–D7 每 ${num(ACQUISITION.intervalH)}&nbsp;h 采一次，每次 ${num(ACQUISITION.framesPerPoint)} 帧、合计 ${num(ACQUISITION.integrationS)}&nbsp;s；${num(TOTAL)} 个时间点全齐才入组，缺一即剔除，不插值、不平滑。</p>
      </header>

      <div class="kpi-row">
        <div class="kpi is-accent">
          <span class="kpi-label">孵化温度</span>
          <span class="kpi-value">${num(temp)}${unit("℃")}</span>
          <span class="kpi-sub">±${num(tempTol)} ℃ · 全程恒温</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">相对湿度</span>
          <span class="kpi-value">${num(`${rhLo}–${rhHi}`)}${unit("%")}</span>
          <span class="kpi-sub">D${num(INCUBATION.stopTurningDay)} 后 ${num(`${rhLateLo}–${rhLateHi}`)}%</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">采样间隔</span>
          <span class="kpi-value">${num(ACQUISITION.intervalH)}${unit("h")}</span>
          <span class="kpi-sub">D1–D7 · 每天上午 / 下午各一次</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">每蛋时间点</span>
          <span class="kpi-value">${num(TOTAL)}${unit("个")}</span>
          <span class="kpi-sub">全齐才入组 · 缺一即剔除</span>
        </div>
      </div>

      <div class="screen-grid grid-2 p2-main">
        <section class="panel p2-timeline-panel" aria-label="14 点采样时间轴">
          <div class="panel-head">
            <h3>14 点时间轴</h3>
            <span class="sub">D1–D7 × 上午 / 下午</span>
          </div>
          <p class="panel-title-note">点选任一时间点查看该点流程；同一孵化日的两点以同色底相连。</p>
          <div class="p2-timeline" role="group" aria-label="14 个采样时间点，D1 至 D7 每天上午与下午各一点">
            ${timelineMarkup}
          </div>
          <div class="legend p2-legend">
            <span><i class="is-live"></i>当前</span>
            <span><i class="is-done"></i>已走完</span>
            <span><i class="is-todo"></i>未开始</span>
          </div>
          <div class="p2-rollup">
            <span class="p2-rollup-key">${num(DAYS.length)} 条日谱</span>
            <p>同日两点各成 1 条时间点谱，逐波长平均后合成 1 条日谱；D1–D7 累计 ${num(DAYS.length)} 条。</p>
          </div>
          <div class="p2-play">
            <button type="button" class="p2-play-btn" id="p2-play" aria-pressed="false">
              <span class="p2-play-glyph" id="p2-play-glyph" aria-hidden="true">▶</span>
              <span id="p2-play-text">播放 14 点</span>
            </button>
            <div class="p2-play-meta">
              <div class="p2-track" id="p2-track" role="progressbar" aria-label="14 点播放进度"
                aria-valuemin="0" aria-valuemax="14" aria-valuenow="0">
                <span id="p2-fill"></span>
              </div>
              <div class="p2-play-info">
                <span class="p2-status" id="p2-status">待机 · 选择任一时间点查看该点流程</span>
                <span class="p2-count"><span class="num" id="p2-count">0</span> / 14</span>
              </div>
            </div>
          </div>
        </section>

        <aside class="panel p2-detail" aria-live="polite" aria-label="时间点详情">
          <div id="p2-detail">${detailMarkup(SAMPLING_POINTS[0])}</div>
        </aside>
      </div>

      <div class="screen-grid grid-2 p2-mid">
        <section class="panel p2-chain-panel">
          <div class="panel-head">
            <h3>校正链</h3>
            <span class="sub">每次采集 · 每 30 min 重校准</span>
          </div>
          <p class="panel-title-note">白、暗参考在同一光路下先采；T(λ) 保留为无量纲相对透射率，只做逐波长平均。</p>

          <div class="p2-chain">
            <div class="p2-chain-step">
              <span class="p2-chain-idx">01</span>
              <b>白参考</b>
              <span class="p2-chain-note">标准白参考帧</span>
              <em>I<sub>w</sub>(λ)</em>
            </div>
            <span class="p2-chain-arrow" aria-hidden="true">→</span>
            <div class="p2-chain-step">
              <span class="p2-chain-idx">02</span>
              <b>暗参考</b>
              <span class="p2-chain-note">遮光暗帧</span>
              <em>I<sub>d</sub>(λ)</em>
            </div>
            <span class="p2-chain-arrow" aria-hidden="true">→</span>
            <div class="p2-chain-step">
              <span class="p2-chain-idx">03</span>
              <b>相对透射率</b>
              <span class="p2-chain-note">逐波长计算</span>
              <em>T(λ)</em>
            </div>
            <span class="p2-chain-arrow" aria-hidden="true">→</span>
            <div class="p2-chain-step">
              <span class="p2-chain-idx">04</span>
              <b>有效透光区平均</b>
              <span class="p2-chain-note">${num(ACQUISITION.points)} 点各取均值 → 1 条时间点谱</span>
              <em>1 条 / 点</em>
            </div>
          </div>

          <div class="p2-formula-card">
            <div class="p2-formula" role="math"
              aria-label="T(lambda) 等于 I_s(lambda) 减 I_d(lambda)，除以 I_w(lambda) 减 I_d(lambda)">
              <span aria-hidden="true">T(λ) =</span>
              <span class="p2-frac" aria-hidden="true">
                <span class="p2-frac-num">I<sub>s</sub>(λ) − I<sub>d</sub>(λ)</span>
                <span class="p2-frac-den">I<sub>w</sub>(λ) − I<sub>d</sub>(λ)</span>
              </span>
            </div>
            <div class="p2-symbols">
              <span><b>I<sub>s</sub></b> 样品帧</span>
              <span><b>I<sub>d</sub></b> 暗参考帧</span>
              <span><b>I<sub>w</sub></b> 白参考帧</span>
            </div>
          </div>

          <p class="footnote"><b>不转 %T、不转吸光度；空间纹理不进模型。</b> 全谱 ${num(ACQUISITION.wavelength[0])}–${num(ACQUISITION.wavelength[1])} nm、${num(ACQUISITION.stepNm)} nm 步长、${num(ACQUISITION.points)} 点；仪器实际分辨率约 ${num(ACQUISITION.resolutionNm)} nm。</p>
        </section>

        <section class="panel p2-params">
          <div class="panel-head">
            <h3>采集参数</h3>
            <span class="sub">论文值</span>
          </div>
          <div class="chip-row">${chips}</div>
          <p class="footnote">一批 ${digitize(batchEggs)}由 ${digitize(batchOps)}完成，约 ${digitize(batchDuration)}；单蛋 ${num(ACQUISITION.secondsPerEgg)} s。</p>
        </section>
      </div>

      <section class="panel p2-gates-panel">
        <div class="panel-head">
          <h3>决策门</h3>
          <span class="sub">G1–G4 · 逐门放行</span>
        </div>
        <p class="panel-title-note">四道门依次推进；G4 的留出集与跨批次结果只评一次，不参与任何选择。</p>
        <div class="p2-gates">${gateMarkup}</div>
      </section>

      <div class="screen-grid grid-2 p2-tail">
        <section class="panel">
          <div class="panel-head">
            <h3>防泄漏红线</h3>
            <span class="tag is-warn">${num(LEAK_RULES.length)} 条</span>
          </div>
          <p class="panel-title-note">划分在采集侧就固定：同蛋多日谱与派生特征永远同侧。</p>
          <ol class="dot-list is-num">
            ${LEAK_RULES.map((rule) => `<li>${esc(rule)}</li>`).join("")}
          </ol>
        </section>

        <section class="panel p2-limits">
          <div class="panel-head">
            <h3>已知局限</h3>
            <span class="tag is-warn">论文自述</span>
          </div>
          <p class="caveat">${esc(orderLimit)}</p>
          <p class="p2-limit-note">论文未提供随机化对照，该局限未消除；解读同日差异与跨日差异时需保留这一前提。</p>
        </section>
      </div>
    </div>
  `;

  const pageEl = root.querySelector(".p2");
  const el = {
    detail: root.querySelector("#p2-detail"),
    points: Array.from(root.querySelectorAll(".p2-point")),
    play: root.querySelector("#p2-play"),
    playText: root.querySelector("#p2-play-text"),
    playGlyph: root.querySelector("#p2-play-glyph"),
    track: root.querySelector("#p2-track"),
    fill: root.querySelector("#p2-fill"),
    count: root.querySelector("#p2-count"),
    status: root.querySelector("#p2-status")
  };

  const state = { current: 0, played: 0, playing: false, timer: 0 };
  let autoplayActive = false;

  const statusIdle = () => {
    if (state.played >= TOTAL) return "入组：14/14 完整";
    if (state.played === 0) return "待机 · 选择任一时间点查看该点流程";
    return `已点亮 ${state.played} / ${TOTAL} · 可继续播放`;
  };

  const paint = () => {
    el.points.forEach((btn, idx) => {
      if (idx === state.current) btn.setAttribute("aria-current", "step");
      else btn.removeAttribute("aria-current");
      btn.classList.toggle("is-done", idx < state.played);
    });
    el.count.textContent = String(state.played);
    el.track.setAttribute("aria-valuenow", String(state.played));
    el.fill.style.width = `${(state.played / TOTAL) * 100}%`;
  };

  const show = (index) => {
    state.current = index;
    el.detail.innerHTML = detailMarkup(SAMPLING_POINTS[index]);
    paint();
  };

  const syncPlayButton = () => {
    if (autoplayActive) {
      el.play.disabled = true;
      el.play.setAttribute("aria-pressed", "true");
      el.play.classList.add("is-stop");
      el.playText.textContent = "演出中";
      el.playGlyph.textContent = "■";
      return;
    }
    el.play.disabled = false;
    el.play.setAttribute("aria-pressed", String(state.playing));
    el.play.classList.toggle("is-stop", state.playing);
    el.playText.textContent = state.playing ? "停止" : state.played >= TOTAL ? "重播 14 点" : "播放 14 点";
    el.playGlyph.textContent = state.playing ? "■" : "▶";
  };

  // 演出用的临时标记，统一加 is-p2- 前缀；结束/停止时全部清掉。
  const clearShowMarks = () => {
    if (pageEl) pageEl.classList.remove("is-p2-autoplay");
    root.querySelectorAll(".is-p2-lit").forEach((node) => node.classList.remove("is-p2-lit"));
  };
  const mark = (node) => {
    if (node) node.classList.add("is-p2-lit");
  };
  const setAutoplayMode = (on) => {
    autoplayActive = on;
    if (pageEl) pageEl.classList.toggle("is-p2-autoplay", on);
    syncPlayButton();
  };

  // 静态初始态：计数归零、详情回 D1、按钮回「播放 14 点」、清掉演出类。
  const resetToStatic = () => {
    autoplayActive = false;
    clearShowMarks();
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = 0;
    }
    state.playing = false;
    state.played = 0;
    state.current = 0;
    show(0);
    syncPlayButton();
    el.status.textContent = statusIdle();
  };

  const showPoint = (index, played, statusText) => {
    state.current = index;
    state.played = played;
    show(index);
    if (statusText != null) el.status.textContent = statusText;
  };

  const finishShow = () => {
    autoplayActive = false;
    clearShowMarks();
    state.playing = false;
    state.current = TOTAL - 1;
    state.played = TOTAL;
    show(TOTAL - 1);
    syncPlayButton();
    el.status.textContent = `入组：${TOTAL}/${TOTAL} 完整`;
  };

  const stop = ({ status = true } = {}) => {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = 0;
    }
    state.playing = false;
    syncPlayButton();
    if (status) el.status.textContent = statusIdle();
  };

  const finish = () => {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = 0;
    }
    state.playing = false;
    syncPlayButton();
    el.status.textContent = `入组：${TOTAL}/${TOTAL} 完整`;
  };

  const tick = () => {
    if (state.played >= TOTAL) {
      finish();
      return;
    }
    show(state.played);
    state.played += 1;
    paint();
    if (state.played >= TOTAL) {
      finish();
      return;
    }
    const point = SAMPLING_POINTS[state.current];
    el.status.textContent = `播放中 · ${state.played} / ${TOTAL} · ${dayId(point)} ${point.slot}`;
  };

  const play = () => {
    if (autoplayActive) return;
    if (state.playing) {
      stop();
      return;
    }
    if (state.played >= TOTAL) {
      state.played = 0;
      state.current = 0;
      show(0);
    }
    state.playing = true;
    syncPlayButton();
    el.status.textContent = "播放中 · 每 600 ms 点亮一个时间点";
    tick();
    if (!state.playing) return;
    state.timer = window.setInterval(tick, 600);
  };

  el.play.addEventListener("click", play);

  el.points.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (autoplayActive) return;
      const index = Number(btn.dataset.index);
      if (state.playing) stop({ status: false });
      show(index);
      const point = SAMPLING_POINTS[index];
      el.status.textContent = `已选 · 第 ${index + 1} 点 · ${dayId(point)} ${point.slot} · 累计 ${point.hours} h`;
    });
  });

  // main.js 的全局 Space 会触发 3D 采集，这里截停；Enter 一并显式处理，
  // 保证两种键在原生按钮与辅助技术下都只触发一次 click。
  root.addEventListener("keydown", (event) => {
    const activate = event.code === "Space" || event.key === " " || event.key === "Enter";
    if (!activate) return;
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button || !root.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    button.click();
  });

  const ctl = {
    root,
    reset: resetToStatic,
    begin: () => setAutoplayMode(true),
    point: showPoint,
    status: (text) => {
      el.status.textContent = text;
    },
    mark,
    finish: finishShow,
    chain: Array.from(root.querySelectorAll(".p2-chain-step")),
    formula: root.querySelector(".p2-formula-card"),
    rollup: root.querySelector(".p2-rollup"),
    // 详情卡会随选中点重绘，必须每次取当前节点，不能缓存 detached 引用。
    get detailFoot() {
      return root.querySelector(".p2-detail-foot");
    },
    gates: Array.from(root.querySelectorAll(".p2-gate")),
    rules: Array.from(root.querySelectorAll(".dot-list.is-num li"))
  };
  controllers.set(root, ctl);

  // 外壳在 2→3 切换时不调用 leave()，用 hidden 兜底停表，避免后台计时。
  const observer = new MutationObserver(() => {
    if (!root.hidden) return;
    if (activeShow && activeShow.root === root) activeShow.stop();
    else if (state.playing) stop();
  });
  observer.observe(root, { attributes: true, attributeFilter: ["hidden"] });

  paint();
  syncPlayButton();

  return {
    enter() {
      // 首屏即静态完整；不启动 rAF，也不自动播放。
      el.detail.innerHTML = detailMarkup(SAMPLING_POINTS[state.current]);
      paint();
      syncPlayButton();
    },
    leave() {
      // 演出中切屏时优先停演出，确保计时器不留在后台。
      if (activeShow && activeShow.root === root) activeShow.stop();
      else stop({ status: false });
      el.status.textContent = statusIdle();
    }
  };
}

// 供外部演出调用的入口（v0.5 起讲解走 P1，不再自动调用）；import 本模块不会自动运行。
export function autoplay(opts = {}) {
  const root = typeof document !== "undefined" ? document.getElementById("screen-2") : null;
  if (!root) {
    return { done: Promise.resolve(), stop() {} };
  }

  let ctl = controllers.get(root);
  if (!ctl) {
    mount(root);
    ctl = controllers.get(root);
  }
  if (!ctl) {
    return { done: Promise.resolve(), stop() {} };
  }

  if (activeShow) activeShow.stop();
  ctl.reset();
  ctl.begin();

  const options = opts && typeof opts === "object" ? opts : {};
  const rawSpeed = Number(options.speed);
  const speed = Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : 1;
  const timers = new Set();
  const said = new Set();
  let halted = false;
  let ended = false;
  let settled = false;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const settle = () => {
    if (settled) return;
    settled = true;
    resolveDone();
  };
  const clearTimers = () => {
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  };
  const say = (text) => {
    if (said.has(text)) return;
    said.add(text);
    if (typeof options.caption !== "function") return;
    try {
      options.caption(text);
    } catch (error) {
      // 字幕回调失败不应中断演出。
    }
  };
  const stop = () => {
    if (halted) return;
    halted = true;
    clearTimers();
    ctl.reset();
    if (activeShow && activeShow.root === root) activeShow = null;
    settle();
  };

  say("D1–D7，每 12 h 一次谱，共 14 个时间点");

  const steps = [];
  const push = (at, fn) => steps.push({ at, fn });
  const pointStart = 600;
  const pointGap = 420;

  SAMPLING_POINTS.forEach((point, index) => {
    push(pointStart + index * pointGap, () => {
      ctl.point(
        index,
        index + 1,
        "演出中 · " + pad2(index + 1) + " / " + TOTAL + " · " + dayId(point) + " " + point.slot
      );
      if (index === 2 || index === 6 || index === 13) {
        say("第 " + (index + 1) + " 点 · " + dayId(point) + " " + point.slot + " · 入孵 " + point.hours + " h");
      }
    });
  });

  push(6660, () => {
    ctl.status("14 / 14 · 日谱合成");
    ctl.mark(ctl.rollup);
    say("每点 3 帧平均，同日 2 点再平均 → 7 条日谱");
  });

  push(7260, () => {
    ctl.status("校正链 · 白参考");
    ctl.mark(ctl.chain[0]);
    say("先采白参考，光路与位姿固定");
  });
  push(7800, () => {
    ctl.status("校正链 · 暗参考");
    ctl.mark(ctl.chain[1]);
    say("再采暗参考，遮光同一位姿");
  });
  push(8340, () => {
    ctl.status("校正链 · 相对透射率");
    ctl.mark(ctl.chain[2]);
    ctl.mark(ctl.formula);
    say("T(λ) 是无量纲相对透射率，不转吸光度");
  });
  push(8880, () => {
    ctl.status("校正链 · 逐波长平均");
    ctl.mark(ctl.chain[3]);
    say("681 点平均成时间点谱，同日两点再平均");
  });

  push(9540, () => {
    ctl.status("防泄漏 · 按蛋划分");
    ctl.mark(ctl.detailFoot);
    ctl.mark(ctl.rules[0]);
    say("14 点全齐才入组；按蛋划分训练与验证");
  });
  ctl.rules.slice(1).forEach((rule, offset) => {
    push(9760 + offset * 220, () => {
      ctl.mark(rule);
      if (offset === 0) say("Z-score 的 μ/σ 只来自训练侧");
    });
  });

  push(10820, () => {
    ctl.status("决策门 · G1");
    ctl.mark(ctl.gates[0]);
    say("四道门逐门放行，G4 只评一次");
  });
  ctl.gates.slice(1).forEach((gate, offset) => {
    push(11120 + offset * 300, () => {
      ctl.status("决策门 · G" + (offset + 2));
      ctl.mark(gate);
    });
  });

  push(12020, () => {
    ctl.status("演出完成 · 14/14 完整");
    say("过四道门，才进模型与结论");
  });
  push(13020, () => {
    if (halted) return;
    ended = true;
    clearTimers();
    ctl.finish();
    if (activeShow && activeShow.root === root) activeShow = null;
    settle();
  });

  steps.forEach((step) => {
    const delay = Math.max(0, Math.round(step.at / speed));
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (halted || ended) return;
      step.fn();
    }, delay);
    timers.add(id);
  });

  const run = { root, done, stop };
  activeShow = run;
  return run;
}