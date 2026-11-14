// P4 结果与验证 —— 由分屏外壳 main.js 在首次进入时调用 mount()。
// 规矩：数字只来自 ../paper-detail.js；三段口径分开渲染，切换时整体替换，不并排、不混引。

import { SCORES, BATCHES, LIMITS, INCUBATION, ACQUISITION, LEAK_RULES } from "../paper-detail.js";

const f3 = (v) => v.toFixed(3);
const f2 = (v) => v.toFixed(2);
const fPct = (v) => (v * 100).toFixed(1) + "%";
const sumBy = (key) => BATCHES.reduce((s, b) => s + b[key], 0);

/* ---------------- 小积木 ---------------- */

function kpi(o) {
  const unit = o.unit ? ` <span class="unit num">${o.unit}</span>` : "";
  const sub = o.sub ? `<span class="kpi-sub">${o.sub}</span>` : "";
  const v = String(o.value);
  // data-v / data-dec 供 autoplay 计数用；静态渲染时就是终值
  const dec = v.includes(".") ? v.split(".")[1].length : 0;
  return `<div class="kpi ${o.cls || ""}">
      <span class="kpi-label">${o.label}</span>
      <span class="kpi-value num"><span class="p4-v" data-v="${v}" data-dec="${dec}">${v}</span>${unit}</span>
      ${sub}
    </div>`;
}

const FIG_META = {
  cv: { tag: "主口径", cls: "", label: SCORES.cv.label },
  holdout: { tag: "只评一次", cls: "is-blue", label: SCORES.holdout.label },
  lobo: { tag: "跨批次", cls: "is-quiet", label: SCORES.lobo.label }
};

function figLabel(mode) {
  const m = FIG_META[mode];
  return `<p class="p4-fig-label"><span class="tag ${m.cls}">${m.tag}</span>
      <span class="p4-fig-label-text">${m.label}</span></p>`;
}

function note(tag, cls, title, text) {
  return `<div class="p4-note">
      <div class="p4-note-head"><span class="tag ${cls}">${tag}</span><b>${title}</b></div>
      <p>${text}</p>
    </div>`;
}

/* ---------------- 三段口径 ---------------- */

function cvFigure() {
  const s = SCORES.cv;
  const sd = "5 折均值 ± 折间标准差";
  return figLabel("cv") + `
    <div class="kpi-row cols-3">
      ${kpi({ label: "ACC · 5 折", value: f3(s.acc), unit: "± " + f3(s.accSd), sub: sd, cls: "is-accent" })}
      ${kpi({ label: "AUC · 5 折", value: f3(s.auc), unit: "± " + f3(s.aucSd), sub: sd, cls: "is-blue" })}
      ${kpi({ label: "F1 · 5 折", value: f3(s.f1), unit: "± " + f3(s.f1Sd), sub: sd })}
    </div>
    <div class="p4-fig-body">
      ${note("主口径", "", "模型比较主口径",
        "1400 枚按蛋号分层 5 折；候选模型、输入方案与消融共用同一折划分，表中数值为 5 折均值 ± 折间标准差。")}
    </div>`;
}

function holdoutFigure() {
  const s = SCORES.holdout;
  const c = s.confusion;
  const cell = (v, tag, cls) =>
    `<span class="p4-cm-cell ${cls}"><b class="num">${v}</b><em>${tag}</em></span>`;
  return figLabel("holdout") + `
    <div class="kpi-row">
      ${kpi({ label: "ACC · 留出", value: f3(s.acc), sub: `n = ${s.n} · 只评一次`, cls: "is-accent" })}
      ${kpi({ label: "AUC · 留出", value: f3(s.auc), sub: `95% CI ${f3(s.aucCI[0])}–${f3(s.aucCI[1])}`, cls: "is-blue" })}
      ${kpi({ label: "sensitivity", value: f2(s.sensitivity), sub: "TP / (TP + FN)" })}
      ${kpi({ label: "specificity", value: f2(s.specificity), sub: "TN / (TN + FP)" })}
    </div>
    <div class="p4-fig-body is-split">
      ${note("只评一次", "is-blue", "全部选型完成后只评一次", LEAK_RULES[2] + "。")}
      <div class="p4-cm-block">
        <div class="p4-cm" role="img" aria-label="留出集 2×2 混淆矩阵：TN 92、FP 8、FN 9、TP 91">
          <span class="p4-cm-corner" aria-hidden="true"></span>
          <span class="p4-cm-head">预测 ♀</span>
          <span class="p4-cm-head">预测 ♂</span>
          <span class="p4-cm-head is-row">实 ♀</span>
          ${cell(c.tn, "TN", "is-good")}
          ${cell(c.fp, "FP", "is-bad")}
          <span class="p4-cm-head is-row">实 ♂</span>
          ${cell(c.fn, "FN", "is-bad")}
          ${cell(c.tp, "TP", "is-good")}
        </div>
        <p class="p4-cm-note">灵敏度 = TP / (TP + FN) = ${f2(s.sensitivity)}；特异度 = TN / (TN + FP) = ${f2(s.specificity)}。${LEAK_RULES[3]}。</p>
      </div>
    </div>`;
}

function loboFigure() {
  const s = SCORES.lobo;
  return figLabel("lobo") + `
    <div class="kpi-row cols-3">
      ${kpi({ label: "ACC · 跨批", value: f3(s.acc), unit: "± " + f3(s.accSd), sub: "4 轮均值 ± SD", cls: "is-accent" })}
      ${kpi({ label: "AUC · 跨批", value: f3(s.auc), unit: "± " + f3(s.aucSd), sub: "4 轮均值 ± SD", cls: "is-blue" })}
      ${kpi({ label: "外层评估", value: String(BATCHES.length), unit: "轮", sub: "每轮 3 批建模 · 留 1 批外评" })}
    </div>
    <div class="p4-fig-body">
      ${note("跨批次", "is-quiet", "4 轮嵌套留一批次",
        "每轮用 3 批建模、留 1 批外评；外部批全程隔离，模型定稿后每批只评一次。")}
    </div>`;
}

const FIGURES = { cv: cvFigure, holdout: holdoutFigure, lobo: loboFigure };

/* ---------------- 挂载 ---------------- */

// mount() 留下的演出句柄与被驱动的当前演出（autoplay 用；平时都是 null）
let ctx = null;
let activeRun = null;

export function mount(root) {
  const perBatch = INCUBATION.perBatch;
  const total = {
    n: BATCHES.length * perBatch,
    infertile: sumBy("infertile"),
    dead: sumBy("dead"),
    unhatched: sumBy("unhatched"),
    hatched: sumBy("hatched"),
    fertile: sumBy("fertile"),
    malePre: sumBy("malePre"),
    femalePre: sumBy("femalePre"),
    droppedSpectrum: sumBy("droppedSpectrum"),
    droppedLabel: sumBy("droppedLabel")
  };
  const totalRate = total.hatched / total.fertile;
  const dropped = total.droppedSpectrum + total.droppedLabel;
  const sexed = total.malePre + total.femalePre;
  const sl = `<span class="p4-slash">/</span>`;
  const sexPair = (m, f) =>
    `<span class="p4-sex is-m">♂</span> ${m} ${sl} <span class="p4-sex is-f">♀</span> ${f}`;

  const rows = BATCHES.map((b) => `
        <tr>
          <td><b>${b.id}</b></td>
          <td class="is-num num">${perBatch}</td>
          <td class="is-num num">${b.infertile}</td>
          <td class="is-num num">${b.dead}</td>
          <td class="is-num num">${b.unhatched}</td>
          <td class="is-num num">${b.hatched} ${sl} ${b.fertile}</td>
          <td class="is-num num">${fPct(b.hatchRate)}</td>
          <td class="is-num num">${sexPair(b.malePre, b.femalePre)}</td>
          <td class="is-num num">${b.droppedSpectrum} ${sl} ${b.droppedLabel}</td>
        </tr>`).join("");

  root.innerHTML = `
    <div class="screen-inner">
      <header class="screen-head">
        <p class="eyebrow">P4 · 结果与验证</p>
        <h2>0.915 / 0.966 / 0.846：三个口径分开说</h2>
        <p class="lead">同一套流程的三段验证，<b>混引就是错</b>。5 折回答“模型之间谁更好”，留出回答“定稿后到底多少”，留一批次回答“换一批还灵不灵”——三个问题，三套数字，各说各的。</p>
      </header>

      <div class="stack">
        <!-- 单枚示例：只示意“一枚蛋进、一个判定出”的链路。
             18.6% 来自 ../data.js 的本地演示桩（buildSample 默认 seed 20261108 → localPredict），
             不是论文指标，面板上已标注，且与下方三段口径分开看。 -->
        <section class="panel p4-verdict" id="p4-verdict">
          <div class="p4-verdict-body">
            <div class="p4-verdict-in">
              <span class="tag is-quiet">代理演示</span>
              <b>一枚蛋的光谱 → 一次判定</b>
              <span class="p4-verdict-sub">DSSF-Net 四支输入（D2 + D5 + ΔS + R）· 阈值 0.5 · 本地演示桩，非论文权重</span>
            </div>
            <div class="p4-prob">
              <span class="p4-prob-label">P(雄性)</span>
              <span class="p4-prob-value num"><span class="p4-v" data-v="18.6" data-dec="1">18.6</span><span class="p4-prob-unit">%</span></span>
              <span class="p4-prob-bar" aria-hidden="true"><i class="p4-prob-fill" data-w="18.6" style="width: 18.6%"></i></span>
            </div>
            <div class="p4-verdict-out">
              <span class="p4-verdict-k">判定</span>
              <b class="p4-verdict-label">雌性</b>
              <span class="p4-verdict-hint">P(雄性) &lt; 0.5</span>
            </div>
          </div>
          <p class="p4-verdict-foot">这一枚只示意判定链路：概率来自本地演示桩，不是论文值，不与下方三段口径混引。</p>
        </section>

        <section class="panel p4-score">
          <div class="panel-head">
            <h3>评估口径</h3>
            <div class="seg" id="p4-seg" role="group" aria-label="切换评估口径">
              <button type="button" data-mode="cv" aria-pressed="true">统一 5 折 · 1400 枚</button>
              <button type="button" data-mode="holdout" aria-pressed="false">固定留出 · 200 枚</button>
              <button type="button" data-mode="lobo" aria-pressed="false">留一批次 · 4 轮</button>
            </div>
          </div>
          <div class="p4-fig" id="p4-fig" aria-live="polite"></div>
          <p class="caveat p4-caveat"><b>口径提示</b>0.974 是五折 AUC，不是准确率；留出 0.915 与跨批 0.846 不可混引。</p>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>三段验证的关系</h3>
            <span class="sub">200 枚封存 · 外部批隔离</span>
          </div>
          <div class="p4-flow">
            <div class="p4-lane">
              <div class="p4-lane-head">
                <span class="tag">主口径</span>
                <b>5 折比较 + 固定留出</b>
                <span class="p4-lane-note">1600 枚平衡集里划出 200 枚封存，其余 1400 枚建模</span>
              </div>
              <ol class="p4-chain">
                <li class="p4-node"><b>1600 枚平衡集</b><em>4 批 × 400 · 公 200 + 母 200</em></li>
                <li class="p4-arrow" aria-hidden="true"></li>
                <li class="p4-node is-sealed"><b>留 200 枚封存</b><em>不参与任何选择</em></li>
                <li class="p4-arrow" aria-hidden="true"></li>
                <li class="p4-node"><b>1400 枚建模</b><em>选型与消融只在训练侧</em></li>
                <li class="p4-arrow" aria-hidden="true"></li>
                <li class="p4-node"><b>统一 5 折</b><em>同一折划分比模型</em></li>
                <li class="p4-arrow" aria-hidden="true"></li>
                <li class="p4-node"><b>1400 全量重训</b><em>定稿后冻结结构与超参</em></li>
                <li class="p4-arrow" aria-hidden="true"></li>
                <li class="p4-node"><b>200 枚只评一次</b><em>全部选型完成后</em></li>
              </ol>
            </div>
            <div class="p4-lane">
              <div class="p4-lane-head">
                <span class="tag is-quiet">跨批次</span>
                <b>留一批次 LOB · 4 轮</b>
                <span class="p4-lane-note">另起一条外层评估，每轮拿 1 批当外部批</span>
              </div>
              <ol class="p4-chain is-lobo">
                <li class="p4-node"><b>4 批 × 400</b><em>平衡后的 4 个批次</em></li>
                <li class="p4-arrow" aria-hidden="true"></li>
                <li class="p4-node"><b>每轮 3 批建模</b><em>内层完成选型</em></li>
                <li class="p4-arrow" aria-hidden="true"></li>
                <li class="p4-node is-sealed"><b>留 1 批外评</b><em>外部批全程隔离</em></li>
                <li class="p4-arrow" aria-hidden="true"></li>
                <li class="p4-node"><b>4 轮汇总</b><em>均值 ± SD</em></li>
              </ol>
            </div>
          </div>
          <p class="footnote">封存集与外部批不参与任何选择：<b>日、特征、超参、早停、阈值、模型</b>。</p>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>批次产量与平衡前性别</h3>
            <span class="sub">入孵 ${perBatch} 枚 / 批 · ${BATCHES.length} 批</span>
          </div>
          <p class="panel-title-note">受精蛋孵化率 = 出雏数 / 受精蛋数；剔除 = 光谱不全 / 标签不确定，剔除后进入性别平衡。</p>
          <div class="p4-tbl-wrap">
            <table class="tbl p4-tbl">
              <thead>
                <tr>
                  <th>批次</th>
                  <th class="is-num">入孵</th>
                  <th class="is-num">无精</th>
                  <th class="is-num">死胚</th>
                  <th class="is-num">未出雏</th>
                  <th class="is-num">出雏<em>/ 受精蛋</em></th>
                  <th class="is-num">受精蛋孵化率</th>
                  <th class="is-num">平衡前<em>♂ / ♀</em></th>
                  <th class="is-num">剔除<em>谱 / 签</em></th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr>
                  <td><strong>合计</strong></td>
                  <td class="is-num num">${total.n}</td>
                  <td class="is-num num">${total.infertile}</td>
                  <td class="is-num num">${total.dead}</td>
                  <td class="is-num num">${total.unhatched}</td>
                  <td class="is-num num">${total.hatched} ${sl} ${total.fertile}</td>
                  <td class="is-num num">${fPct(totalRate)}</td>
                  <td class="is-num num">${sexPair(total.malePre, total.femalePre)}</td>
                  <td class="is-num num">${total.droppedSpectrum} ${sl} ${total.droppedLabel}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p class="p4-tbl-hint">左右滑动查看完整表格 →</p>
          <p class="footnote">出雏 <b class="num">${total.hatched}</b> 剔除 <b class="num">${dropped}</b> 枚（谱不全 / 标签不确定）后为 <b class="num">${sexed}</b> 枚进入性别平衡；平衡后每批 公 <b class="num">200</b> + 母 <b class="num">200</b> → 4 × 400 = <b class="num">1600</b> 枚；留出 200 枚与建模 1400 枚均取自该平衡集。</p>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>局限</h3>
            <span class="sub">论文自述的 6 条边界</span>
          </div>
          <ol class="dot-list is-num p4-limits">
            ${LIMITS.map((t) => `<li>${t}</li>`).join("")}
          </ol>
        </section>

        <p class="footnote p4-legal"><b>研究演示</b> · 仅用于技术验证与内部汇报，不构成生产决策依据。样本范围：坝上长尾鸡粉壳蛋 · ${ACQUISITION.wavelength[0]}–${ACQUISITION.wavelength[1]} nm · ${BATCHES.length} 批次。页面指标一律按口径分开展示，不跨口径加总或比较。</p>
      </div>
    </div>
  `;

  const fig = root.querySelector("#p4-fig");
  const seg = root.querySelector("#p4-seg");
  let mode = "";

  function render(next, animate) {
    if (!FIGURES[next] || next === mode) return;
    mode = next;
    seg.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.mode === next));
    });
    fig.innerHTML = FIGURES[next]();
    fig.classList.remove("is-swap");
    if (!animate) return;
    void fig.offsetWidth;
    fig.classList.add("is-swap");
  }

  seg.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mode]");
    if (btn) render(btn.dataset.mode, true);
  });

  render("cv", false);

  ctx = {
    root,
    figEl: fig,
    segEl: seg,
    render,
    renderStatic() {
      render("cv", false);
    }
  };

  return {
    enter() {},
    leave() {
      // 若演出还在进行，先停演并复位：离开本屏不留计时器与临时类名
      if (activeRun) activeRun.stop();
      fig.classList.remove("is-swap");
    }
  };
}

/* ---------------- 自动演出（外部调用，v0.5 起不再自动触发） ---------------- */

/**
 * 让本屏自己演一遍收尾段（约 11 s）。
 * @param {{ caption?: (text: string) => void, speed?: number }} opts
 * @returns {{ done: Promise<void>, stop: () => void }}
 */
export function autoplay(opts = {}) {
  const caption = typeof opts.caption === "function" ? opts.caption : () => {};
  const speed = Number(opts.speed) > 0 ? Number(opts.speed) : 1;
  const s = (ms) => ms / speed;
  const say = (text) => {
    try {
      caption(text);
    } catch (_) {
      /* 字幕回调异常不打断演出 */
    }
  };

  let resolveDone;
  const done = new Promise((res) => {
    resolveDone = res;
  });

  // 未挂载：直接收工（调用方会先 mount + enter）
  if (!ctx) {
    resolveDone();
    return { done, stop() {} };
  }

  // 可重复调用：先收掉上一场（含它的计时器与临时类名）
  if (activeRun) activeRun.stop();

  const root = ctx.root;
  const $ = (sel, sc) => (sc || root).querySelector(sel);
  const $$ = (sel, sc) => Array.from((sc || root).querySelectorAll(sel));

  const timers = new Set();
  const tweens = new Set();
  let closed = false;

  const clearTimers = () => {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
  };
  const clearTweens = () => {
    tweens.forEach((id) => clearInterval(id));
    tweens.clear();
  };

  function stop() {
    if (closed) return;
    closed = true;
    clearTimers();
    clearTweens();
    restore(); // 停演 = 静态完整态：默认档、数字归位、临时类名清干净
    if (activeRun === api) activeRun = null;
    resolveDone();
  }

  const api = { done, stop };
  activeRun = api;

  const setNum = (el, n, dec) => {
    el.textContent = Number(n).toFixed(dec);
  };

  // 用 interval 计时而不是 rAF：headless 与后台标签页里 rAF 会被节流甚至不跑
  function tween(ms, step) {
    if (closed) return;
    const dur = Math.max(1, ms);
    const t0 = performance.now();
    let id = 0;
    const tick = () => {
      if (closed) {
        clearInterval(id);
        tweens.delete(id);
        return;
      }
      const p = Math.min(1, (performance.now() - t0) / dur);
      step(p < 1 ? 1 - Math.pow(1 - p, 3) : 1);
      if (p >= 1) {
        clearInterval(id);
        tweens.delete(id);
      }
    };
    id = setInterval(tick, 16);
    tweens.add(id);
    tick();
  }

  function at(ms, fn) {
    if (closed) return;
    const id = setTimeout(() => {
      timers.delete(id);
      if (!closed) fn();
    }, s(ms));
    timers.add(id);
  }

  function roll(scope, ms) {
    $$(".p4-v", scope).forEach((el) => {
      const target = Number(el.dataset.v);
      const dec = Number(el.dataset.dec || 0);
      setNum(el, 0, dec);
      tween(s(ms), (p) => setNum(el, target * p, dec));
    });
  }

  function settleNumbers(scope) {
    $$(".p4-v", scope || root).forEach((el) => {
      el.textContent = Number(el.dataset.v).toFixed(Number(el.dataset.dec || 0));
    });
  }

  function clearLive() {
    $$(".p4-live", root).forEach((el) => el.classList.remove("p4-live"));
    $$(".is-lit", root).forEach((el) => el.classList.remove("is-lit"));
    $$(".is-hold", root).forEach((el) => el.classList.remove("is-hold"));
  }

  function resetBar() {
    const bar = $(".p4-prob-fill");
    if (bar) bar.style.width = (bar.dataset.w || "0") + "%";
  }

  // 页内滚动：表与局限在首屏之外，演出时要跟着镜头走（#screen-4 自己是滚动容器）
  function scrollTo(y, ms) {
    const max = Math.max(0, root.scrollHeight - root.clientHeight);
    const from = root.scrollTop;
    const to = Math.max(0, Math.min(Number(y) || 0, max));
    if (Math.abs(to - from) < 2) {
      root.scrollTop = to;
      return;
    }
    tween(ms, (p) => {
      root.scrollTop = from + (to - from) * p;
    });
  }

  function scrollToEl(el, pad, ms) {
    if (!el) return;
    const top = root.scrollTop + el.getBoundingClientRect().top - root.getBoundingClientRect().top - (pad || 0);
    scrollTo(top, ms);
  }

  function restore() {
    clearLive();
    ctx.renderStatic();
    settleNumbers();
    resetBar();
    root.scrollTop = 0;
  }

  function settle() {
    clearLive();
    settleNumbers();
    resetBar();
    root.scrollTop = 0;
  }

  /* ---- 分镜 ---- */

  function beatVerdict() {
    const box = $("#p4-verdict");
    if (!box) return;
    const bar = $(".p4-prob-fill", box);
    const out = $(".p4-verdict-out", box);
    box.classList.add("p4-live");
    out.classList.add("is-hold");
    if (bar) bar.style.width = "0%";
    roll(box, 900);
    tween(s(900), (p) => {
      if (bar) bar.style.width = (Number(bar.dataset.w || "0") * p).toFixed(1) + "%";
    });
    at(1000, () => out.classList.remove("is-hold"));
  }

  function beatMode(mode, ms) {
    ctx.render(mode, false);
    roll(ctx.figEl, ms);
  }

  function beatTable() {
    const table = $(".p4-tbl");
    if (!table) return;
    scrollToEl(table, 24, s(560));
    table.classList.add("p4-live");
    $$("tbody tr, tfoot tr", table).forEach((tr, i) => {
      at(180 + i * 190, () => tr.classList.add("is-lit"));
    });
  }

  function beatMatrix() {
    // 矩阵在评估口径面板里：先滚回首屏，再切回留出档逐格点亮
    scrollTo(0, s(620));
    at(240, () => {
      ctx.render("holdout", false);
      roll(ctx.figEl, 700);
      const cm = $(".p4-cm");
      if (!cm) return;
      cm.classList.add("p4-live");
      $$(".p4-cm-cell", cm).forEach((cell, i) => {
        at(320 + i * 200, () => cell.classList.add("is-lit"));
      });
    });
  }

  function beatLimits() {
    const list = $(".p4-limits");
    if (!list) return;
    scrollToEl(list, 26, s(620));
    list.classList.add("p4-live");
    $$("li", list).forEach((li, i) => {
      at(240 + i * 190, () => li.classList.add("is-lit"));
    });
  }

  function end() {
    if (closed) return;
    settle(); // 自然收尾：保留当前档位，只清过程态
    closed = true;
    clearTimers();
    clearTweens();
    if (activeRun === api) activeRun = null;
    resolveDone();
  }

  /* ---- 时间轴（speed=1 时约 10.9 s） ---- */

  restore();

  at(0, () => {
    say("一枚蛋的光谱进来，一个判定出去");
    beatVerdict();
  });
  at(1700, () => {
    say("主口径：5 折交叉验证 ACC 0.915 · AUC 0.974");
    beatMode("cv", 900);
  });
  at(3050, () => {
    say("独立留出 200 枚：ACC 0.915 · AUC 0.966");
    beatMode("holdout", 900);
  });
  at(4400, () => {
    say("留一批次（真实跨批次）：ACC 0.846 · AUC 0.926");
    beatMode("lobo", 900);
  });
  at(5750, () => {
    say("四批 2400 枚 → 可孵化 2172 → 出雏 2015（92.8%）");
    beatTable();
  });
  at(7250, () => {
    say("留出集 200 枚里，漏判 9、误判 8");
    beatMatrix();
  });
  at(8600, () => {
    say("结论只覆盖这个范围：单场、单品种、D2–D7");
    beatLimits();
  });
  at(9950, () => {
    say("演示结束 · 研究验证用，非生产决策依据");
    scrollTo(0, s(700));
  });
  at(10900, end);

  return api;
}
