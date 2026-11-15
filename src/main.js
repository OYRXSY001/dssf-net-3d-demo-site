import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createRig } from "./rig.js";
import { createStudio } from "./studio.js";
import { createTAA } from "./post.js";
import { SpectrumChart, drawMonitor } from "./chart.js";
import { buildSample, predict, PAPER, PAPER_REFERENCE, pct } from "./data.js";
import * as p2Module from "./screens/p2.js";
import * as p3Module from "./screens/p3.js";
import * as p4Module from "./screens/p4.js";
import { createCards } from "./cards.js";
import { createGuide } from "./guide.js";
import { createStory } from "./story.js";

const $ = (sel) => document.querySelector(sel);
const bootParams = new URLSearchParams(window.location.search);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (x) => x * x * (3 - 2 * x);
const CIRC = 2 * Math.PI * 42;

const stageEl = $("#stage");
const canvas = $("#scene");
const loading = $("#loading");
const earlyCover =
  !bootParams.has("cover") &&
  !bootParams.has("clean") &&
  !bootParams.has("step") &&
  !bootParams.has("story") &&
  !bootParams.has("flow") &&
  !bootParams.has("result") &&
  !bootParams.has("autoplay");
document.body.classList.toggle("is-cover", earlyCover);

const VIEW_COVER = { pos: new THREE.Vector3(140, 100, 194), target: new THREE.Vector3(-4, 54, 0) };
const VIEW_DEVICE = { pos: new THREE.Vector3(128, 90, 180), target: new THREE.Vector3(14, 50, 0) };

/* 竖屏时把机位拉远，保证 1200 mm 台架完整入画 */
function fitView(v) {
  const box = stageEl.getBoundingClientRect();
  const aspect = Math.max(1, box.width) / Math.max(1, box.height);
  const k = aspect >= 0.9 ? 1 : Math.min(1.65, 1 + (0.9 - aspect) * 1.15);
  return {
    pos: v.target.clone().add(v.pos.clone().sub(v.target).multiplyScalar(k)),
    target: v.target.clone()
  };
}
const START_VIEW = fitView(earlyCover ? VIEW_COVER : VIEW_DEVICE);
const fallback = $("#fallback");
const result = $("#result");
const inspector = $("#inspector");
const partCard = $("#part-card");
const perfEl = $("#perf");
const toastEl = $("#toast");
const playBtn = $("#btn-play");
const playLabel = $("#play-label");
const progress = $("#progress");
const progressbar = $("#progressbar");
const statusEl = $("#status");
const xrayBadge = $("#xray-badge");
const transportEl = $("#transport");
const captionEl = $("#stage-caption");

const SOURCE_META = {
  demo: { label: "代理模型 · 非论文权重", cls: "tag-demo" },
  model: { label: "真实模型输出", cls: "tag-model" },
  paper: { label: "论文值", cls: "tag-paper" }
};

const LEGAL_RESULT =
  "本页面为研究演示用途，仅用于技术验证与内部汇报，不构成生产、育种、商业决策或任何形式的保证。页面所示结果按来源分开展示（论文值 / 代理模型 / 真实模型），同屏不混用指标口径；“论文值”来自已发表研究条件下的结果，不代表所有批次、品种或场景下的表现。样本与条件范围：坝上长尾鸡粉壳蛋，可见–近红外透射光谱 340–1020 nm，4 个批次数据；如用于实际判定，建议结合复测与人工复核。";
const LEGAL_SCOPE = "样本：坝上长尾鸡粉壳蛋 · 可见–近红外 340–1020 nm · 4 批次。";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function sourceMeta(pred) {
  if (pred.offline) return { label: "演示推断 · 本地代理", cls: "tag-demo" };
  return SOURCE_META[pred.source] || { label: "演示", cls: "tag-demo" };
}

function paperValues(ref = PAPER_REFERENCE) {
  const hold = ref.holdout_test || PAPER.holdout;
  const lobo = ref.leave_one_batch_out || PAPER.lobo;
  const five = ref.five_fold || PAPER.cv;
  const asPct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—");
  const aucCI = hold.auc_ci95 || PAPER.holdout.aucCI;
  const loboSd = lobo.accuracy_sd ?? lobo.accuracySd;
  const fiveSd = five.auc_sd ?? five.aucSd;
  return {
    holdAcc: asPct(hold.accuracy),
    holdAuc: Number.isFinite(hold.auc) ? hold.auc.toFixed(3) : "—",
    holdAucCI: aucCI.map((v) => v.toFixed(3)).join("–"),
    holdN: hold.n || PAPER.holdout.n,
    loboAcc: asPct(lobo.accuracy),
    loboSd: Number.isFinite(loboSd) ? `±${(loboSd * 100).toFixed(1)}%` : "",
    fiveAuc: Number.isFinite(five.auc) ? five.auc.toFixed(3) : "—",
    fiveSd: Number.isFinite(fiveSd) ? `±${fiveSd.toFixed(3)}` : ""
  };
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance"
  });
} catch (err) {
  console.error(err);
  fallback.hidden = false;
  loading.classList.add("is-hidden");
  throw err;
}

// 抗锯齿交给 MSAA(4x) + TAA；色调映射与 sRGB 输出都在 post.js 的最终 pass 里做
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0x081017, 1);
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();

const stageBox = () => {
  const rect = stageEl.getBoundingClientRect();
  return { w: Math.max(1, Math.round(rect.width)), h: Math.max(1, Math.round(rect.height)), rect };
};
const initialStage = stageBox();

const camera = new THREE.PerspectiveCamera(38, initialStage.w / initialStage.h, 0.1, 2600);
camera.position.copy(START_VIEW.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(START_VIEW.target);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.8;
controls.enablePan = false;
controls.minDistance = 90;
controls.maxDistance = 380;
controls.minPolarAngle = 0.32;
controls.maxPolarAngle = 1.48;
controls.minAzimuthAngle = -1.62;
controls.maxAzimuthAngle = 2.52;
controls.update();

/* ?bench=750：台架抬到真实 750 mm 台高（750/10 - 3 = 72 单位），并重调取景与阴影范围 */
const benchLift = new URLSearchParams(window.location.search).get("bench") === "750" ? 72 : 0;
if (benchLift) {
  camera.position.set(112, 152, 202);
  controls.target.set(8, 118, 0);
  controls.minDistance = 150;
  controls.maxDistance = 430;
  controls.update();
}
controls.saveState();

/* 浅灰工作室：程序化柔光箱 HDRI + 无缝背景 + 主/补/轮廓光 */
const studio = createStudio(renderer, scene, { benchLift });
const rig = createRig(scene, { benchLift });

/* 渲染管线：MSAA + 时间累积，静止时收敛到完全停渲染 */
const post = createTAA(renderer, scene, camera, { maxSamples: 32, exposure: 0.92 });
post.resize(initialStage.w, initialStage.h, window.devicePixelRatio || 1);

const state = {
  step: 1,
  sample: buildSample(20261108),
  layers: { d2: true, d5: true, delta: true },
  beam: true,
  exploded: false,
  xray: false,
  scanning: false,
  spinning: false,
  flowing: false,
  activeId: null,
  hoverId: null,
  result: null
};

// 便于演示与自动化：?seed=42&beam=0&explode=1&xray=1&autoplay=1
const params = bootParams;
const wantsCover =
  !params.has("cover") &&
  !params.has("clean") &&
  !params.has("step") &&
  !params.has("story") &&
  !params.has("flow") &&
  !params.has("result") &&
  !params.has("autoplay");
if (!wantsCover) {
  transportEl.hidden = false;
  captionEl.hidden = false;
}
if (params.has("seed")) {
  const seed = Number(params.get("seed"));
  if (Number.isFinite(seed)) state.sample = buildSample(Math.trunc(seed) || 20261108);
}
if (params.get("beam") === "0") state.beam = false;
state.mode = ["demo", "paper", "model"].includes(params.get("mode")) ? params.get("mode") : "demo";
if (params.has("clean")) document.body.classList.add("clean");
rig.setBeam(state.beam);
$("#btn-beam").setAttribute("aria-pressed", String(state.beam));

const chart = new SpectrumChart($("#chart"));
chart.setSample(state.sample);
chart.setLayers(state.layers);

const monitor = rig.monitor;
function renderMonitor(p = 1) {
  drawMonitor(monitor.ctx, 512, 320, state.sample, p);
  monitor.texture.needsUpdate = true;
}
renderMonitor(1);

/* ---------------- 热点 ---------------- */

const hotspotLayer = $("#hotspots");
rig.parts.forEach((part) => {
  if (part.hiddenHotspot) return;
  const el = document.createElement("button");
  el.type = "button";
  el.className = "hotspot";
  el.dataset.part = part.id;
  el.setAttribute("aria-label", `${part.name}：查看参数`);
  el.innerHTML = `<span class="ring"></span><span class="dot"></span><span class="label">${part.short}</span>`;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    selectPart(part.id);
  });
  el.addEventListener("pointerenter", () => hoverPart(part.id));
  el.addEventListener("pointerleave", () => hoverPart(null));
  el.addEventListener("focus", () => hoverPart(part.id));
  el.addEventListener("blur", () => hoverPart(null));
  hotspotLayer.appendChild(el);
  part.el = el;
});

const projected = new THREE.Vector3();
const annEl = $("#annotation");
let hudDirty = true;

function projectAnchor(part) {
  part.anchorNode.getWorldPosition(projected);
  projected.project(camera);
  const rect = stageEl.getBoundingClientRect();
  return {
    x: (projected.x * 0.5 + 0.5) * rect.width,
    y: (-projected.y * 0.5 + 0.5) * rect.height,
    z: projected.z
  };
}

function placeAnnotation() {
  if (annEl.hidden || !state.activeId) return;
  const part = rig.parts.find((p) => p.id === state.activeId);
  if (!part) return;
  const { x, y } = projectAnchor(part);
  const w = stageEl.clientWidth;
  const h = stageEl.clientHeight;
  const cardH = annEl.offsetHeight || 132;
  const topSafe = 56;
  // 锚点太靠上时把卡片翻到热点下方，避免钻到展台标题底下
  const below = y - cardH - 30 < topSafe;
  annEl.classList.toggle("is-below", below);
  annEl.style.left = `${clamp(x, 150, w - 150)}px`;
  annEl.style.top = below
    ? `${clamp(y, topSafe + 8, h - cardH - 110)}px`
    : `${clamp(y, topSafe + cardH + 30, h - 92)}px`;
}

function updateHotspots() {
  const w = stageEl.clientWidth;
  const h = stageEl.clientHeight;
  if (!w || !h) return;
  rig.parts.forEach((part) => {
    if (!part.el) return;
    const { x, y, z } = projectAnchor(part);
    const visible = z < 1 && z > -1 && x > -24 && x < w + 24 && y > 0 && y < h - 8;
    if (!visible) {
      part.el.style.display = "none";
      return;
    }
    part.el.style.display = "block";
    part.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    part.el.classList.toggle("flip", x > w - 210);
  });
  placeAnnotation();
}

/* ---------------- 部件卡片 ---------------- */

const pathCard = `
  <div class="part-head">
    <span class="part-index">00</span>
    <div><h3>暗箱内 · 透射光路</h3><p>Inside the dark box · egg intact</p></div>
  </div>
  <ol class="path">
    <li><b>卤钨灯</b><span>150 W · 预热 30 min</span></li>
    <li><b>种蛋</b><span>钝端朝上 · 不破壳</span></li>
    <li><b>可调焦镜头</b><span>镜头–蛋 300 mm</span></li>
    <li><b>光谱相机</b><span>340–1020 nm · 681 点</span></li>
    <li><b>采集计算机</b><span>3 连测平均 · 12.5 s/枚</span></li>
  </ol>
  <p class="note">实机为全封闭遮光暗箱；画面为暗箱剖开 / 拆解示意。点击部件查看论文参数。</p>
`;
partCard.innerHTML = pathCard;

function renderPartCard(part) {
  const specs = part.specs
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("");
  partCard.innerHTML = `
    <div class="part-head">
      <span class="part-index">${String(part.index).padStart(2, "0")}</span>
      <div><h3>${part.name}</h3><p>${part.en}</p></div>
    </div>
    <dl class="specs">${specs}</dl>
    <p class="note">${part.note}</p>
  `;
}

function refreshHighlights() {
  const active = new Set([state.activeId, state.hoverId].filter(Boolean));
  rig.parts.forEach((p) => rig.setHighlight(p.id, active.has(p.id)));
  rig.setRuler(state.activeId === "lens" || state.hoverId === "lens");
}

function renderAnnotation(part) {
  if (!part) {
    annEl.classList.remove("is-in");
    annEl.hidden = true;
    return;
  }
  annEl.innerHTML = `
    <div class="annotation-head">
      <span class="annotation-index">${String(part.index).padStart(2, "0")}</span>
      <div><b>${part.name}</b><span class="annotation-sub">${part.en}</span></div>
    </div>
    <dl class="annotation-specs">
      ${part.specs
        .slice(0, 2)
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
        .join("")}
    </dl>
    <button class="annotation-link" type="button">查看全部参数</button>
    <span class="annotation-stem" aria-hidden="true"></span>
  `;
  annEl.hidden = false;
  requestAnimationFrame(() => annEl.classList.add("is-in"));
  annEl.querySelector(".annotation-link").addEventListener("click", () => {
    inspector.classList.add("is-open");
    toast("完整参数已同步到右侧面板");
  });
}

function selectPart(id) {
  state.activeId = id;
  rig.parts.forEach((p) => p.el?.classList.toggle("is-active", p.id === id));
  const part = rig.parts.find((p) => p.id === id);
  if (part) {
    renderPartCard(part);
    renderAnnotation(part);
    rig.setAllClosed();
    rig.setOpen(id, true);
    if (window.innerWidth <= 980) inspector.classList.add("is-open");
  }
  hudDirty = true;
  refreshHighlights();
}

function clearSelection() {
  state.activeId = null;
  rig.parts.forEach((p) => p.el?.classList.remove("is-active"));
  partCard.innerHTML = pathCard;
  renderAnnotation(null);
  rig.setAllClosed();
  hudDirty = true;
  refreshHighlights();
}

function hoverPart(id) {
  if (state.hoverId === id) return;
  state.hoverId = id;
  refreshHighlights();
}

/* ---------------- 拾取 ---------------- */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPoint = null;

function pickAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(rig.pickables, false);
  for (const hit of hits) {
    let obj = hit.object;
    while (obj && !obj.userData.partId) obj = obj.parent;
    if (obj) return obj.userData.partId;
  }
  return null;
}

canvas.addEventListener("pointerdown", (e) => {
  downPoint = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("pointerup", (e) => {
  if (!downPoint) return;
  const moved = Math.hypot(e.clientX - downPoint.x, e.clientY - downPoint.y);
  downPoint = null;
  /* 讲解演出中不响应拾取：镜头在飞，误点会把浮层和讲解卡叠在一起 */
  if (state.flowing || moved > 6) return;
  const id = pickAt(e.clientX, e.clientY);
  if (id) selectPart(id);
  else clearSelection();
});

canvas.addEventListener("pointermove", (e) => {
  if (e.buttons || state.flowing) return;
  const id = pickAt(e.clientX, e.clientY);
  hoverPart(id);
  canvas.style.cursor = id ? "pointer" : "grab";
});

canvas.addEventListener("pointerleave", () => hoverPart(null));

/* ---------------- 结果 ---------------- */

let resultTimer = 0;

function closeResult() {
  result.classList.remove("is-in");
  window.clearTimeout(resultTimer);
  resultTimer = window.setTimeout(() => {
    result.hidden = true;
    document.body.classList.remove("has-result");
  }, 240);
}

function mountResult(html) {
  window.clearTimeout(resultTimer);
  result.innerHTML = html;
  result.hidden = false;
  document.body.classList.add("has-result");
  result.classList.remove("is-in");
  requestAnimationFrame(() => result.classList.add("is-in"));
  $("#result-close")?.addEventListener("click", closeResult);
}

function showResult(pred) {
  if (!Number.isFinite(pred.pMale)) {
    showPaperResult(pred);
    return;
  }
  state.result = pred;
  const pMale = pred.pMale;
  const male = pMale >= 0.5;
  const confidence = Math.max(pMale, 1 - pMale);
  const color = male ? "#FF8A5B" : "#4CC9F0";
  const cm = PAPER.holdout.confusion;
  const meta = sourceMeta(pred);
  const pv = paperValues(pred.paper);
  const note = pred.note ? `<p class="source-note">${esc(pred.note)}</p>` : "";

  window.clearTimeout(resultTimer);
  mountResult(`
    <div class="result-head">
      <div class="result-title">
        <p class="eyebrow">DSSF-Net · D2 + D5 + ΔS + R · 逐蛋判定</p>
        <h3>判定结果</h3>
      </div>
      <div class="result-tools">
        <span class="tag ${meta.cls}">${meta.label}</span>
        <button class="icon-btn" id="result-close" aria-label="关闭结果">×</button>
      </div>
    </div>
    <div class="result-body">
      <div class="verdict">
        <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="ring-track" cx="50" cy="50" r="42"></circle>
          <circle class="ring-value" cx="50" cy="50" r="42"
            style="stroke:${color};stroke-dasharray:${CIRC.toFixed(2)};stroke-dashoffset:${CIRC.toFixed(2)}"></circle>
        </svg>
        <div class="verdict-text">
          <p class="eyebrow">P(雄性) ${(pMale * 100).toFixed(1)}%</p>
          <strong style="color:${color}">${male ? "雄性" : "雌性"}</strong>
          <span class="confidence">${pred.source === "model" ? "置信度" : "代理分数"} ${(confidence * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div class="metrics-block">
        <p class="metrics-label">论文汇总口径 · 非本次代理模型</p>
        <dl class="result-metrics">
          <div><dt>准确率</dt><dd>${pv.holdAcc}</dd></div>
          <div><dt>AUC</dt><dd>${pv.holdAuc}</dd></div>
          <div><dt>灵敏度</dt><dd>91.0%</dd></div>
          <div><dt>特异度</dt><dd>92.0%</dd></div>
        </dl>
      </div>
      <div class="cm" aria-label="固定内测集混淆矩阵">
        <span class="head"></span><span class="head">预雌</span><span class="head">预雄</span>
        <span class="head">实雌</span><span class="ok">${cm.tn}</span><span class="bad">${cm.fp}</span>
        <span class="head">实雄</span><span class="bad">${cm.fn}</span><span class="ok">${cm.tp}</span>
      </div>
    </div>
    <div class="result-wide">
      <span>跨批次平均（4 批留一）</span>
      <strong>${pv.loboAcc}</strong>
      <em>论文值</em>
    </div>
    <div class="result-foot">
      <div class="result-notes">
        ${note}
        <details class="legal-details">
          <summary>口径与边界</summary>
          <p class="legal">${LEGAL_RESULT}</p>
          <p class="legal">${LEGAL_SCOPE}</p>
        </details>
      </div>
      <button class="btn small" id="btn-new-egg">换一枚蛋</button>
    </div>
  `);

  requestAnimationFrame(() => {
    const ring = result.querySelector(".ring-value");
    requestAnimationFrame(() => {
      if (ring) ring.style.strokeDashoffset = String(CIRC * (1 - confidence));
    });
  });

  $("#btn-new-egg")?.addEventListener("click", newEgg);
}

function showPaperResult(pred) {
  state.result = pred;
  const meta = sourceMeta(pred);
  const pv = paperValues(pred.paper);
  window.clearTimeout(resultTimer);
  mountResult(`
    <div class="result-head">
      <div class="result-title">
        <p class="eyebrow">论文值 · 非逐蛋判定 · 三套口径分开</p>
        <h3>论文口径</h3>
      </div>
      <div class="result-tools">
        <span class="tag ${meta.cls}">${meta.label}</span>
        <button class="icon-btn" id="result-close" aria-label="关闭结果">×</button>
      </div>
    </div>
    <div class="paper-body">
      <div class="paper-metric"><span>固定内测集准确率</span><strong>${pv.holdAcc}</strong><em>n = ${pv.holdN}</em></div>
      <div class="paper-metric"><span>跨批次平均</span><strong>${pv.loboAcc}</strong><em>4 批留一 ${pv.loboSd}</em></div>
      <div class="paper-metric"><span>AUC（固定内测）</span><strong>${pv.holdAuc}</strong><em>95% CI ${pv.holdAucCI}</em></div>
      <div class="paper-metric"><span>AUC（五折）</span><strong>${pv.fiveAuc}</strong><em>${pv.fiveSd}</em></div>
    </div>
    <p class="paper-note">${esc(pred.note || "模型未接入：按规范不输出逐蛋判定，仅展示论文口径。")}</p>
    <div class="result-foot">
      <div class="result-notes">
        <details class="legal-details">
          <summary>口径与边界</summary>
          <p class="legal">${LEGAL_RESULT}</p>
          <p class="legal">${LEGAL_SCOPE}</p>
        </details>
      </div>
    </div>
  `);
}

function newEgg() {
  state.sample = buildSample(Math.floor(Math.random() * 1e9));
  state.result = null;
  chart.setSample(state.sample);
  chart.setProgress(1);
  renderMonitor(1);
  closeResult();
  playLabel.textContent = "播放采集";
  statusEl.textContent = "已换一枚蛋 · 点击播放，复现一次 2.67 s 透射采集";
  progress.style.width = "0%";
  progressbar.setAttribute("aria-valuenow", "0");
}

/* ---------------- 采集流程 ---------------- */

const waitFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function runScan() {
  if (state.scanning) return;
  state.scanning = true;
  playBtn.disabled = true;
  chart.setProgress(0);
  renderMonitor(0);
  rig.setScan(0);
  statusEl.textContent = "白 / 暗参考校正…";

  const t0 = performance.now();
  const duration = 3000;
  while (true) {
    await waitFrame();
    const raw = Math.min(1, (performance.now() - t0) / duration);
    const acq = smooth(clamp((raw - 0.16) / 0.66, 0, 1));
    chart.setProgress(acq);
    renderMonitor(acq);
    rig.setScan(acq);
    progress.style.width = `${(raw * 100).toFixed(1)}%`;
    progressbar.setAttribute("aria-valuenow", String(Math.round(raw * 100)));

    if (raw < 0.16) statusEl.textContent = "白 / 暗参考校正…";
    else if (raw < 0.82) statusEl.textContent = "采集 D2 / D5 · 890 ms × 3…";
    else if (raw < 1) statusEl.textContent = "光谱平均与 ΔS 构建…";
    if (raw >= 1) break;
  }

  rig.setScan(null);
  statusEl.textContent = "DSSF-Net 推理中…";
  const pred = await predict(state.sample, { mode: state.mode, delay: params.has("fast") ? 0 : 420 });
  if (pred.source === "paper" || !Number.isFinite(pred.pMale)) {
    showPaperResult(pred);
    statusEl.textContent = "完成 · 论文值：固定内测集 91.5% / 跨批次 84.6%";
  } else {
    showResult(pred);
    statusEl.textContent = `完成 · ${sourceMeta(pred).label} · P(雄) = ${pct(pred.pMale)}`;
  }

  chart.setProgress(1);
  renderMonitor(1);
  state.scanning = false;
  playBtn.disabled = false;
  playLabel.textContent = "重新采集";
  progress.style.width = "100%";
  window.setTimeout(() => {
    if (state.scanning) return;
    progress.style.width = "0%";
    progressbar.setAttribute("aria-valuenow", "0");
  }, 900);
}

/* ---------------- 旋转演示 ---------------- */

let spin = null;

function startSpin() {
  if (spin) return;
  const target = controls.target.clone();
  const offset = camera.position.clone().sub(target);
  const radius = Math.max(offset.length(), 0.001);
  spin = {
    target,
    radius,
    phi: Math.acos(THREE.MathUtils.clamp(offset.y / radius, -1, 1)),
    from: Math.atan2(offset.x, offset.z),
    t: 0,
    dur: 2.8,
    turn: Math.PI * 2
  };
  state.spinning = true;
  controls.enabled = false;
  toggleButton($("#btn-spin"), true);
  hudDirty = true;
}

function stopSpin() {
  spin = null;
  state.spinning = false;
  controls.enabled = true;
  toggleButton($("#btn-spin"), false);
}

function updateSpin(dt) {
  spin.t += dt;
  const k = Math.min(1, spin.t / spin.dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const theta = spin.from - spin.turn * e;
  const sinPhi = Math.sin(spin.phi);
  camera.position.set(
    spin.target.x + spin.radius * sinPhi * Math.sin(theta),
    spin.target.y + spin.radius * Math.cos(spin.phi),
    spin.target.z + spin.radius * sinPhi * Math.cos(theta)
  );
  camera.lookAt(spin.target);
  hudDirty = true;
  if (k >= 1) {
    stopSpin();
    controls.update();
  }
}

/* ---------------- UI 事件 ---------------- */

function toast(text, ms = 2200) {
  toastEl.textContent = text;
  toastEl.classList.add("is-on");
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => toastEl.classList.remove("is-on"), ms);
}

function toggleButton(btn, on) {
  btn.setAttribute("aria-pressed", String(on));
}

$("#btn-beam").addEventListener("click", (e) => {
  state.beam = !state.beam;
  rig.setBeam(state.beam);
  toggleButton(e.currentTarget, state.beam);
});

$("#btn-explode").addEventListener("click", (e) => {
  state.exploded = !state.exploded;
  rig.setExplode(state.exploded);
  toggleButton(e.currentTarget, state.exploded);
  dollyTo(state.exploded ? 1.3 : 1 / 1.3);
  if (state.exploded) {
    state.activeId = null;
    refreshHighlights();
  }
});

$("#btn-xray").addEventListener("click", (e) => {
  state.xray = !state.xray;
  rig.setXray(state.xray);
  toggleButton(e.currentTarget, state.xray);
  xrayBadge.hidden = !state.xray;
  focusEgg(state.xray && !state.exploded);
  if (state.xray) toast("剖面为示意：非真实解剖/医学影像，仅用于说明光路与结构位置");
});

$("#btn-spin").addEventListener("click", () => {
  if (spin) stopSpin();
  else startSpin();
});

$("#btn-reset").addEventListener("click", () => {
  stopSpin();
  rig.setAllClosed();
  clearSelection();
  controls.reset();
});

$("#btn-inspector").addEventListener("click", () => {
  inspector.classList.toggle("is-open");
});

/* ---------------- 分屏：P1 装置 / P2 流程 / P3 光谱 / P4 结果 ---------------- */

const SCREENS = { 2: p2Module.mount, 3: p3Module.mount, 4: p4Module.mount };
const mountedScreens = new Map();
const stepButtons = Array.from(document.querySelectorAll(".step"));

function mountScreen(n) {
  if (mountedScreens.has(n)) return mountedScreens.get(n);
  const el = document.getElementById(`screen-${n}`);
  const api = (SCREENS[n] && SCREENS[n](el)) || {};
  mountedScreens.set(n, api);
  return api;
}

/** 离开装置屏：收起所有 3D 侧的状态，避免回来时残留 */
function leaveDeviceView() {
  stopSpin();
  rig.setAllClosed();
  clearSelection();
  closeResult();
  inspector.classList.remove("is-open");
}

function setStep(n) {
  const next = clamp(Math.round(n), 1, 4);
  const prev = state.step;
  if (next === prev) return;
  if (next !== 1) enterStage();
  state.step = next;
  document.body.dataset.step = String(next);
  stepButtons.forEach((btn) => {
    const on = Number(btn.dataset.step) === next;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-current", on ? "step" : "false");
  });
  for (const key of [2, 3, 4]) document.getElementById(`screen-${key}`).hidden = key !== next;
  if (next === 1) {
    mountedScreens.get(prev)?.leave?.();
    post.markDirty();
    hudDirty = true;
  } else {
    if (prev === 1) leaveDeviceView();
    mountScreen(next).enter?.();
  }
}

stepButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (story && story.isRunning()) story.stop();
    setStep(Number(btn.dataset.step));
  });
});

/* 3D 内全流程讲解：不切屏，卡片跟着装置走，数字人配音讲解 */
const storyCards = createCards({
  layer: $("#story-layer"),
  camera,
  getAnchor: (id) => {
    const part = rig.parts.find((p) => p.id === id);
    return part ? part.anchorNode.getWorldPosition(new THREE.Vector3()) : null;
  }
});

const guide = createGuide({ root: $("#guide-root") });

/* 讲解声音：固定晓晓（预生成 mp3，离线可用）；系统音色只作兜底。 */
const guideQuery = new URLSearchParams(window.location.search);
if (guideQuery.has("rate")) guide.setRate(guideQuery.get("rate"));
if (guideQuery.has("pitch")) guide.setPitch(guideQuery.get("pitch"));

async function loadVoiceBank() {
  try {
    const res = await fetch(new URL("audio/manifest.json", document.baseURI), { cache: "no-cache" });
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data && data.voices) ? data.voices : [];
    const xiaoxiao = list.find((v) => v.id === "xiaoxiao") || list[0];
    if (!xiaoxiao) return;
    guide.setAudioVoices([xiaoxiao], "");
    guide.setVoice("audio:" + xiaoxiao.id);
  } catch {
    /* 没有音轨也能跑：退回系统中文音色 / 字幕 */
  }
}
loadVoiceBank();

const story = createStory({
  camera,
  controls,
  rig,
  cards: storyCards,
  guide,
  setStep,
  ui: {
    bar: $("#story-bar"),
    count: $("#story-count"),
    dots: $("#story-dots"),
    muteBtn: $("#story-mute"),
    nextBtn: $("#story-next"),
    stopBtn: $("#story-stop"),
    replayBtn: $("#story-replay")
  },
  markDirty: () => {
    hudDirty = true;
    post.markDirty();
  },
  onState: (on) => {
    if (on) {
      enterStage();
      closeResult();
    }
    state.flowing = on;
    document.body.classList.toggle("is-story", on);
    $("#btn-flow").setAttribute("aria-pressed", String(on));
  }
});

/* 封面 → 装置：收起封面，右侧参数栏与底部播放条入场 */
function enterStage() {
  if (!document.body.classList.contains("is-cover")) return;
  document.body.classList.remove("is-cover");
  transportEl.hidden = false;
  captionEl.hidden = false;
  flyTo(fitView(VIEW_DEVICE).pos, VIEW_DEVICE.target, 1.05);
  onResize();
  window.setTimeout(() => {
    onResize();
    controls.saveState();
    post.markDirty();
  }, 640);
  hudDirty = true;
}

$("#btn-enter")?.addEventListener("click", () => {
  enterStage();
  toast("已进入装置 · 点击任意部件查看论文参数", 2600);
});
$("#btn-cover-story")?.addEventListener("click", () => {
  enterStage();
  window.setTimeout(() => story.play(), 1180);
});

$("#btn-flow").addEventListener("click", () => {
  if (story.isRunning()) {
    story.stop();
    return;
  }
  if (document.body.classList.contains("is-cover")) {
    enterStage();
    window.setTimeout(() => story.play(), 1180);
  } else {
    story.play();
  }
});

$("#btn-placard-play")?.addEventListener("click", () => {
  if (story.isRunning()) story.stop();
  else story.play();
});

const flowPlacard = $("#flow-placard");
const placardCollapse = $("#btn-placard-collapse");

placardCollapse?.addEventListener("click", (event) => {
  event.stopPropagation();
  const collapsed = flowPlacard.classList.toggle("is-collapsed");
  placardCollapse.setAttribute("aria-expanded", String(!collapsed));
  placardCollapse.setAttribute("aria-label", collapsed ? "展开全流程提示牌" : "收回全流程提示牌");
  placardCollapse.title = collapsed ? "展开" : "收回";
});

flowPlacard?.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  if (flowPlacard.classList.contains("is-collapsed")) return;
  if (story.isRunning()) story.stop();
  else story.play();
});

document.querySelectorAll(".layer").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.layer;
    state.layers[key] = !state.layers[key];
    chart.setLayers({ [key]: state.layers[key] });
    btn.classList.toggle("is-on", state.layers[key]);
  });
});

playBtn.addEventListener("click", () => {
  runScan();
});

document.addEventListener("keydown", (e) => {
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  // 全流程演示：F 播放/停止，演出中 Esc 结束，数字键先停演出再切屏
  if (e.key === "f" || e.key === "F") {
    e.preventDefault();
    if (story.isRunning()) story.stop();
    else story.play();
    return;
  }
  if (state.flowing) {
    if (e.key === "Escape") { e.preventDefault(); story.stop(); return; }
    if (!/^[1-4]$/.test(e.key)) return;
    story.stop();
  }
  // 分屏只保留 1–4 切换键；装置屏的快捷键不外溢到 P2–P4
  if (state.step !== 1 && !/^[1-4]$/.test(e.key)) return;
  if (e.code === "Space") {
    e.preventDefault();
    runScan();
  } else if (e.key === "r" || e.key === "R") {
    controls.reset();
  } else if (e.key === "e" || e.key === "E") {
    $("#btn-explode").click();
  } else if (e.key === "b" || e.key === "B") {
    $("#btn-beam").click();
  } else if (e.key === "x" || e.key === "X") {
    $("#btn-xray").click();
  } else if (e.key === "s" || e.key === "S") {
    $("#btn-spin").click();
  } else if (/^[1-4]$/.test(e.key)) {
    setStep(Number(e.key));
  } else if (e.key === "Escape") {
    closeResult();
    inspector.classList.remove("is-open");
    if (state.activeId) clearSelection();
  }
});

canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  toast("WebGL 上下文丢失，请刷新页面", 5000);
});

/* ---------------- 机位飞行（拆解拉远 / 剖面聚焦） ---------------- */

let shot = null;
let focusSaved = null;
const eggPoint = new THREE.Vector3();

function flyTo(toPos, toTarget, dur = 0.55) {
  shot = {
    fromPos: camera.position.clone(),
    toPos: toPos.clone(),
    fromTarget: controls.target.clone(),
    toTarget: toTarget.clone(),
    t: 0,
    dur
  };
  hudDirty = true;
}

function updateShot(dt) {
  if (!shot) return;
  shot.t += dt;
  const k = Math.min(1, shot.t / shot.dur);
  const e = 1 - Math.pow(1 - k, 3);
  camera.position.lerpVectors(shot.fromPos, shot.toPos, e);
  controls.target.lerpVectors(shot.fromTarget, shot.toTarget, e);
  hudDirty = true;
  if (k >= 1) {
    shot = null;
    controls.update();
  }
}

/** 沿当前视线推/拉机位（factor > 1 拉远，< 1 推近） */
function dollyTo(factor, dur = 0.55) {
  const to = controls.target.clone().add(camera.position.clone().sub(controls.target).multiplyScalar(factor));
  flyTo(to, controls.target.clone(), dur);
}

/** 剖面时把机位收到蛋上，否则蛋只有 30 多像素，看不进气室与卵黄 */
function focusEgg(on, dur = 0.6) {
  if (on) {
    const egg = rig.parts.find((p) => p.id === "egg");
    if (!egg) return;
    egg.anchorNode.getWorldPosition(eggPoint);
    eggPoint.y -= 0.4;
    if (!focusSaved) focusSaved = { pos: camera.position.clone(), target: controls.target.clone() };
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = Math.max(52, Math.min(camera.position.distanceTo(controls.target) * 0.31, 70));
    flyTo(eggPoint.clone().add(dir.multiplyScalar(dist)), eggPoint.clone(), dur);
  } else if (focusSaved) {
    flyTo(focusSaved.pos, focusSaved.target, dur);
    focusSaved = null;
  }
}

/* ---------------- 渲染循环 ---------------- */

let last = performance.now();
let frames = 0;
let acc = 0;
const lastCamPos = new THREE.Vector3(1e9, 1e9, 1e9);
const lastCamQuat = new THREE.Quaternion();

function tick(now) {
  requestAnimationFrame(tick);
  // 停在 P2/P3/P4 时完全跳过 3D：不更新、不渲染，省下整条 GPU 管线
  if (state.step !== 1) {
    last = now;
    return;
  }
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;

  if (spin) updateSpin(dt);
  else if (!state.flowing) {
    controls.update();
    updateShot(dt);
  }

  rig.update(dt, t, camera);
  story.update(dt);

  const moved = !lastCamPos.equals(camera.position) || !lastCamQuat.equals(camera.quaternion);
  if (moved) {
    lastCamPos.copy(camera.position);
    lastCamQuat.copy(camera.quaternion);
    hudDirty = true;
  }
  const animating = rig.isAnimating();
  if (moved || animating || hudDirty) {
    updateHotspots();
    hudDirty = false;
  }
  // 静止且累积收敛后 post.render 直接返回，GPU 零开销
  post.render(moved || animating);

  frames += 1;
  acc += dt;
  if (acc >= 0.5) {
    const fps = frames / acc;
    const { triangles, calls } = post.stats;
    const taa = post.converged ? `TAA ${post.samples}/32 已收敛` : `TAA ${post.samples}/32`;
    perfEl.textContent = `${fps.toFixed(0)} fps · ${(triangles / 1000).toFixed(1)}k tris · ${calls} calls · ${taa}`;
    frames = 0;
    acc = 0;
  }

}

let resizeRaf = 0;
function onResize() {
  const { w, h } = stageBox();
  if (w < 2 || h < 2) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  post.resize(w, h, window.devicePixelRatio || 1);
  post.markDirty();
  hudDirty = true;
}

function scheduleResize() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    onResize();
  });
}

window.addEventListener("resize", scheduleResize);
if (typeof ResizeObserver === "function") {
  const ro = new ResizeObserver(scheduleResize);
  ro.observe(stageEl);
}

post.render(true);
{
  const { triangles, calls } = post.stats;
  perfEl.textContent = `ready · ${(triangles / 1000).toFixed(1)}k tris · ${calls} calls · TAA ${post.samples}/32`;
}
document.body.dataset.step = "1";
if (params.has("step")) setStep(Number(params.get("step")) || 1);
requestAnimationFrame(tick);
window.setTimeout(() => {
  loading.classList.add("is-hidden");
  window.setTimeout(() => loading.remove(), 900);
}, 420);

if (params.has("explode")) $("#btn-explode").click();
if (params.has("xray")) $("#btn-xray").click();
if (params.has("select")) selectPart(params.get("select"));
if (params.has("result")) {
  predict(state.sample, { mode: state.mode, delay: 0 }).then((pred) => {
    if (pred.source === "paper" || !Number.isFinite(pred.pMale)) showPaperResult(pred);
    else showResult(pred);
  });
}
if (params.has("spin")) window.setTimeout(() => startSpin(), 600);
if (params.has("autoplay")) window.setTimeout(() => runScan(), 700);
if (params.has("story") || params.has("flow")) window.setTimeout(() => story.play(), 900);
if (params.has("diag")) {
  const box = (el) => {
    const b = el.getBoundingClientRect();
    return `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)}x${Math.round(b.height)}`;
  };
  perfEl.textContent = `vw=${window.innerWidth} dpr=${window.devicePixelRatio} topbar=${box($(".topbar"))} brand=${box($(".brand"))} actions=${box($(".actions"))} steps=${getComputedStyle($(".steps")).display}`;
}

// 便于 QA/自动化读取实测值
window.__demo = {
  state,
  rig,
  studio,
  post,
  scene,
  camera,
  controls,
  renderer,
  chart,
  paper: PAPER,
  runScan,
  showResult,
  newEgg,
  selectPart,
  clearSelection,
  startSpin,
  stopSpin,
  setStep,
  story,
  cards: storyCards,
  guide,
  screens: mountedScreens
};

