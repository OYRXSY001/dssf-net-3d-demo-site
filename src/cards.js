/**
 * cards.js — 3D 锚定讲解卡片系统
 *
 * 卡片是 HTML，跟着 3D 锚点走：锚点世界坐标 → camera 投影 → layer 内 px，
 * 卡片用 left/top 定位，进出场 / 侧向偏移 / 指引线由 cards.css 负责。
 *
 * 用法（接线在 main.js：createCards 后交给 story.js，本模块只负责卡片本身）：
 *
 *   const cards = createCards({ layer, camera, getAnchor });
 *   cards.show({ id: "lamp", anchor: "lamp", side: "left", title: "150 W 卤钨灯",
 *                rows: [["波段", "340–1020 nm"]], chart: { kind: "source" } });
 *   // 每帧（render 之后）：
 *   cards.update();
 *
 * 布局约定：安全区 顶 96 / 左右 24 / 底 120；重叠卡片沿垂直方向错开（8px），
 * 锚点在相机背后或视口外时整张卡片隐藏（不贴边）。
 */

import { buildSample, SPECTRAL } from "./data.js";

const SAFE = { top: 96, left: 24, right: 24, bottom: 120 };
const GAP = { left: 26, right: 26, top: 24, bottom: 24 };
const STACK_GAP = 8;
const CHART_H = 62;
const SIDES = ["left", "right", "top", "bottom"];
const OPPOSITE = { left: "right", right: "left", top: "bottom", bottom: "top" };
const TONES = ["default", "accent", "warn"];

/* 固定种子：三张小图共用一份样本，保证每次刷新、每张卡片一致 */
const SAMPLE = buildSample(20261108);

const MONO = '"JetBrains Mono","Cascadia Mono","SFMono-Regular",Consolas,monospace';
const COLORS = {
  d2: "#0f9e8f",
  d5: "#3d7bfd",
  delta: "#c98a1f",
  text3: "#8b94a3",
  grid: "rgba(16,24,40,0.055)",
  axis: "rgba(16,24,40,0.10)",
  zero: "rgba(16,24,40,0.22)"
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const toNumber = (v) => (Number.isFinite(v) ? v : 0);

/* ==========================================================================
   小图：2D canvas 自绘
   ========================================================================== */

let _sourceCurve = null;

/* 光源连续谱示意：340 nm 起缓升，中段平台，末端轻微回落（不追求物理精确） */
function sourceCurve() {
  if (_sourceCurve) return _sourceCurve;
  const n = SPECTRAL.points;
  const arr = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const rise = 1 - Math.exp(-3.6 * Math.pow(t, 1.1));
    const roll = 1 - 0.1 * Math.pow(t, 3);
    arr[i] = 0.18 + 0.8 * rise * roll;
  }
  _sourceCurve = arr;
  return arr;
}

function chartSurface(canvas, height) {
  const dpr = Math.min(Math.max(1, typeof devicePixelRatio === "number" ? devicePixelRatio : 1), 2);
  const width = Math.max(96, Math.round(canvas.clientWidth || 200));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ctx: null, width };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width };
}

function strokeCurve(ctx, arr, xAt, yAt, color, width) {
  ctx.beginPath();
  for (let i = 0; i < arr.length; i += 3) {
    const x = xAt(SPECTRAL.min + i * SPECTRAL.step);
    const y = yAt(arr[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  const last = arr.length - 1;
  ctx.lineTo(xAt(SPECTRAL.min + last * SPECTRAL.step), yAt(arr[last]));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function drawChart(canvas, kind, height) {
  const h = clamp(toNumber(height) || CHART_H, 40, 140);
  const { ctx, width: w } = chartSurface(canvas, h);
  if (!ctx) return;

  const padL = 24;
  const padR = 6;
  const padT = 8;
  const padB = 14;
  const plotX = padL;
  const plotY = padT;
  const plotW = Math.max(12, w - padL - padR);
  const plotH = Math.max(12, h - padT - padB);
  const xAt = (l) => plotX + ((l - SPECTRAL.min) / (SPECTRAL.max - SPECTRAL.min)) * plotW;
  const axisY = Math.round(plotY + plotH) + 0.5;

  /* 横向发丝网格 */
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.grid;
  for (const f of [0.25, 0.5, 0.75]) {
    const y = Math.round(plotY + plotH * f) + 0.5;
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(plotX + plotW, y);
    ctx.stroke();
  }

  /* 底部轴线 + 340 / 1020 nm 刻度 */
  ctx.strokeStyle = COLORS.axis;
  ctx.beginPath();
  ctx.moveTo(plotX, axisY);
  ctx.lineTo(plotX + plotW, axisY);
  ctx.stroke();

  ctx.font = "9px " + MONO;
  ctx.fillStyle = COLORS.text3;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(String(SPECTRAL.min), plotX, h - 3);
  ctx.textAlign = "right";
  ctx.fillText(SPECTRAL.max + " nm", plotX + plotW, h - 3);

  if (kind === "spectrum") {
    const d2 = SAMPLE.d2;
    const d5 = SAMPLE.d5;
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < d2.length; i += 4) {
      lo = Math.min(lo, d2[i], d5[i]);
      hi = Math.max(hi, d2[i], d5[i]);
    }
    lo = Math.max(0, lo - 0.04);
    hi = Math.min(1, hi + 0.04);
    const span = Math.max(1e-3, hi - lo);
    const yAt = (v) => plotY + (1 - (v - lo) / span) * plotH;

    strokeCurve(ctx, d2, xAt, yAt, COLORS.d2, 1.15);
    strokeCurve(ctx, d5, xAt, yAt, COLORS.d5, 1.15);

    /* 图例：右上角 D2 / D5 */
    ctx.font = "9px " + MONO;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    let rx = w - 4;
    for (const item of [["D5", COLORS.d5], ["D2", COLORS.d2]]) {
      const tw = ctx.measureText(item[0]).width;
      ctx.fillStyle = item[1];
      ctx.fillRect(rx - tw - 9, plotY + 2.5, 6, 1.5);
      ctx.fillStyle = COLORS.text3;
      ctx.fillText(item[0], rx, plotY + 3);
      rx -= tw + 15;
    }
    return;
  }

  if (kind === "delta") {
    const arr = SAMPLE.delta;
    let amp = 0;
    for (let i = 0; i < arr.length; i += 3) amp = Math.max(amp, Math.abs(arr[i]));
    amp = Math.max(amp * 1.15, 0.012);
    const zeroY = plotY + plotH / 2;
    const half = Math.max(4, plotH / 2 - 2);
    const yAt = (v) => zeroY - (v / amp) * half;

    /* 零线 */
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = COLORS.zero;
    ctx.beginPath();
    ctx.moveTo(plotX, Math.round(zeroY) + 0.5);
    ctx.lineTo(plotX + plotW, Math.round(zeroY) + 0.5);
    ctx.stroke();
    ctx.restore();

    /* 面积：ΔS 与零线之间 */
    ctx.beginPath();
    ctx.moveTo(xAt(SPECTRAL.min), zeroY);
    for (let i = 0; i < arr.length; i += 3) ctx.lineTo(xAt(SPECTRAL.min + i), yAt(arr[i]));
    ctx.lineTo(xAt(SPECTRAL.max), zeroY);
    ctx.closePath();
    ctx.fillStyle = "rgba(201,138,31,0.13)";
    ctx.fill();

    strokeCurve(ctx, arr, xAt, yAt, COLORS.delta, 1.15);

    ctx.font = "9px " + MONO;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.text3;
    ctx.fillText("ΔS", plotX + 1, plotY + 4);
    ctx.textAlign = "right";
    ctx.fillText("0", plotX - 4, zeroY);
    return;
  }

  /* source：平缓连续谱 + 同色淡填充 */
  const arr = sourceCurve();
  const base = plotY + plotH;
  const yAt = (v) => plotY + (1 - clamp(v, 0, 1)) * plotH;

  ctx.beginPath();
  ctx.moveTo(xAt(SPECTRAL.min), base);
  for (let i = 0; i < arr.length; i += 4) ctx.lineTo(xAt(SPECTRAL.min + i), yAt(arr[i]));
  ctx.lineTo(xAt(SPECTRAL.max), base);
  ctx.closePath();
  ctx.fillStyle = "rgba(15,163,146,0.10)";
  ctx.fill();

  strokeCurve(ctx, arr, xAt, yAt, COLORS.d2, 1.25);

  ctx.font = "9px " + MONO;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text3;
  ctx.fillText("连续谱", plotX + 1, plotY + 4);
}

/* ==========================================================================
   卡片系统
   ========================================================================== */

function signature(spec) {
  return JSON.stringify([
    spec.title == null ? "" : String(spec.title),
    spec.tag == null ? "" : String(spec.tag),
    spec.lead == null ? "" : String(spec.lead),
    spec.rows || null,
    spec.stat || null,
    spec.chart || null,
    spec.tone || "default"
  ]);
}

export function createCards({ layer, camera, getAnchor, getSize } = {}) {
  if (!layer || typeof layer.appendChild !== "function") {
    throw new TypeError("createCards({ layer })：layer 必须是已挂载的容器元素");
  }
  if (!camera) {
    throw new TypeError("createCards({ camera })：缺少 THREE 相机");
  }
  if (typeof getAnchor !== "function") {
    throw new TypeError("createCards({ getAnchor })：getAnchor(id) 必须返回世界坐标");
  }

  const entries = new Map(); /* id -> entry（当前展示中的卡片） */
  const leaving = new Map(); /* id -> { el, timer }（出场动画中的旧元素） */
  const view = { w: 1, h: 1, left: 0, top: 0, dirty: true };
  let orderSeq = 0;

  /* ---------- 容器尺寸 / 安全区 ---------- */

  function measureView() {
    const rect = layer.getBoundingClientRect();
    let w = rect.width;
    let h = rect.height;
    if (typeof getSize === "function") {
      const size = getSize();
      if (size) {
        const sw = toNumber(size.width != null ? size.width : size.w);
        const sh = toNumber(size.height != null ? size.height : size.h);
        if (sw > 0) w = sw;
        if (sh > 0) h = sh;
      }
    }
    view.w = Math.max(1, w);
    view.h = Math.max(1, h);
    view.left = rect.left;
    view.top = rect.top;
    view.dirty = false;
    for (const entry of entries.values()) entry.dirty = true;
  }

  function markViewDirty() {
    view.dirty = true;
  }

  window.addEventListener("resize", markViewDirty, { passive: true });
  window.addEventListener("orientationchange", markViewDirty, { passive: true });

  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(markViewDirty);
    resizeObserver.observe(layer);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready
      .then(() => {
        for (const entry of entries.values()) entry.dirty = true;
      })
      .catch(() => {});
  }

  /* ---------- 投影 ---------- */

  const projected = { ok: false, x: 0, y: 0, z: 0 };

  /* 世界坐标 → NDC（不依赖 THREE 的 Vector3，直接读相机矩阵） */
  function projectWorld(x, y, z) {
    const v = camera.matrixWorldInverse && camera.matrixWorldInverse.elements;
    const p = camera.projectionMatrix && camera.projectionMatrix.elements;
    if (!v || !p) {
      projected.ok = false;
      return projected;
    }
    const ex = v[0] * x + v[4] * y + v[8] * z + v[12];
    const ey = v[1] * x + v[5] * y + v[9] * z + v[13];
    const ez = v[2] * x + v[6] * y + v[10] * z + v[14];
    const cw = p[3] * ex + p[7] * ey + p[11] * ez + p[15];
    const cx = p[0] * ex + p[4] * ey + p[8] * ez + p[12];
    const cy = p[1] * ex + p[5] * ey + p[9] * ez + p[13];
    const cz = p[2] * ex + p[6] * ey + p[10] * ez + p[14];

    /* ez >= 0：锚点落在相机背后；cw <= 0：透视相机背后 */
    if (ez >= -1e-6 || cw <= 1e-6) {
      projected.ok = false;
      return projected;
    }
    const nx = cx / cw;
    const ny = cy / cw;
    const nz = cz / cw;
    projected.ok = Math.abs(nx) <= 1 && Math.abs(ny) <= 1 && nz >= -1.001 && nz <= 1.001;
    projected.x = nx;
    projected.y = ny;
    projected.z = nz;
    return projected;
  }

  /* ---------- 卡片 DOM ---------- */

  function createEntry(id) {
    const el = document.createElement("div");
    el.className = "cc-card";
    el.dataset.id = id;
    el.setAttribute("role", "note");
    el.innerHTML =
      '<div class="cc-head">' +
      '<h4 class="cc-title"></h4>' +
      '<span class="cc-tag"></span>' +
      "</div>" +
      '<p class="cc-lead"></p>' +
      '<dl class="cc-rows"></dl>' +
      '<div class="cc-stat">' +
      '<strong class="cc-stat-value"></strong>' +
      '<span class="cc-stat-unit"></span>' +
      '<em class="cc-stat-label"></em>' +
      "</div>" +
      '<div class="cc-chart"><canvas aria-hidden="true"></canvas></div>' +
      '<i class="cc-stem" aria-hidden="true"></i>';

    return {
      id,
      el,
      order: orderSeq++,
      headEl: el.querySelector(".cc-head"),
      titleEl: el.querySelector(".cc-title"),
      tagEl: el.querySelector(".cc-tag"),
      leadEl: el.querySelector(".cc-lead"),
      rowsEl: el.querySelector(".cc-rows"),
      statEl: el.querySelector(".cc-stat"),
      statValueEl: el.querySelector(".cc-stat-value"),
      statUnitEl: el.querySelector(".cc-stat-unit"),
      statLabelEl: el.querySelector(".cc-stat-label"),
      chartEl: el.querySelector(".cc-chart"),
      chartCanvas: el.querySelector(".cc-chart canvas"),
      spec: {},
      sig: "",
      anchorKey: id,
      wanted: false,
      visible: false,
      dirty: true,
      w: 236,
      h: 120,
      chartKind: "",
      chartHeight: CHART_H,
      chartDrawnW: 0,
      chartDirty: false,
      lastX: NaN,
      lastY: NaN,
      lastSide: "",
      lastStem: "",
      enterFrame: 0
    };
  }

  function renderRows(container, rows) {
    container.replaceChildren();
    for (const row of rows) {
      const line = document.createElement("div");
      line.className = "cc-row";
      const key = document.createElement("dt");
      const value = document.createElement("dd");
      key.textContent = row[0] == null ? "" : String(row[0]);
      value.textContent = row[1] == null ? "" : String(row[1]);
      line.append(key, value);
      container.append(line);
    }
  }

  function applyContent(entry, spec) {
    const el = entry.el;
    const tone = TONES.indexOf(spec.tone) >= 0 ? spec.tone : "default";
    if (el.dataset.tone !== tone) el.dataset.tone = tone;

    const title = spec.title == null ? "" : String(spec.title);
    if (entry.titleEl.textContent !== title) entry.titleEl.textContent = title;
    if (entry.titleEl.hidden !== !title) entry.titleEl.hidden = !title;

    const tag = spec.tag == null ? "" : String(spec.tag);
    if (entry.tagEl.textContent !== tag) entry.tagEl.textContent = tag;
    if (entry.tagEl.hidden !== !tag) entry.tagEl.hidden = !tag;
    const showHead = Boolean(title || tag);
    if (entry.headEl.hidden !== !showHead) entry.headEl.hidden = !showHead;

    const lead = spec.lead == null ? "" : String(spec.lead);
    if (entry.leadEl.textContent !== lead) entry.leadEl.textContent = lead;
    if (entry.leadEl.hidden !== !lead) entry.leadEl.hidden = !lead;

    const rows = Array.isArray(spec.rows)
      ? spec.rows
          .filter((row) => Array.isArray(row) && row.length)
          .map((row) => [row[0] == null ? "" : row[0], row[1] == null ? "" : row[1]])
      : [];
    const rowsKey = JSON.stringify(rows);
    if (entry.rowsKey !== rowsKey) {
      entry.rowsKey = rowsKey;
      renderRows(entry.rowsEl, rows);
    }
    if (entry.rowsEl.hidden !== !rows.length) entry.rowsEl.hidden = !rows.length;

    const stat = spec.stat && typeof spec.stat === "object" ? spec.stat : null;
    if (entry.statEl.hidden !== !stat) entry.statEl.hidden = !stat;
    if (stat) {
      const value = stat.value == null ? "" : String(stat.value);
      const unit = stat.unit == null ? "" : String(stat.unit);
      const label = stat.label == null ? "" : String(stat.label);
      if (entry.statValueEl.textContent !== value) entry.statValueEl.textContent = value;
      if (entry.statUnitEl.textContent !== unit) entry.statUnitEl.textContent = unit;
      if (entry.statLabelEl.textContent !== label) entry.statLabelEl.textContent = label;
    }

    const chart = spec.chart && spec.chart.kind ? spec.chart : null;
    if (entry.chartEl.hidden !== !chart) entry.chartEl.hidden = !chart;
    if (!chart) {
      entry.chartKind = "";
      entry.chartDirty = false;
      return;
    }
    const kind = ["source", "spectrum", "delta"].indexOf(chart.kind) >= 0 ? chart.kind : "source";
    const chartHeight = clamp(toNumber(chart.height) || CHART_H, 40, 140);
    if (entry.chartKind !== kind || entry.chartHeight !== chartHeight) {
      entry.chartKind = kind;
      entry.chartHeight = chartHeight;
      entry.chartCanvas.style.height = chartHeight + "px";
      entry.chartDirty = true;
      entry.dirty = true;
    }
  }

  function measure(entry) {
    entry.w = entry.el.offsetWidth || 236;
    entry.h = entry.el.offsetHeight || 120;
    entry.dirty = false;
    if (!entry.chartKind) return;
    const canvas = entry.chartCanvas;
    const cw = Math.round(canvas.clientWidth || 0);
    if (cw > 0 && (cw !== entry.chartDrawnW || entry.chartDirty)) {
      drawChart(canvas, entry.chartKind, entry.chartHeight);
      entry.chartDrawnW = cw;
      entry.chartDirty = false;
    }
  }

  /* ---------- 位置 / 指引线 ---------- */

  function pickSide(ax, ay, cw, ch) {
    const room = {
      left: ax - SAFE.left - GAP.left,
      right: view.w - SAFE.right - ax - GAP.right,
      top: ay - SAFE.top - GAP.top,
      bottom: view.h - SAFE.bottom - ay - GAP.bottom
    };
    const fitsH = room.left >= cw || room.right >= cw;
    const fitsV = room.top >= ch || room.bottom >= ch;
    /* 优先水平方向：卡片横向展开更贴近工程讲解卡片；放不下再竖放 */
    if (fitsH) return room.right >= room.left ? "right" : "left";
    if (fitsV) return room.bottom >= room.top ? "bottom" : "top";
    if (Math.max(room.left, room.right) >= Math.max(room.top, room.bottom)) {
      return room.right >= room.left ? "right" : "left";
    }
    return room.bottom >= room.top ? "bottom" : "top";
  }

  function place(side, ax, ay, cw, ch) {
    let x;
    let y;
    if (side === "left") {
      x = ax - GAP.left - cw;
      y = ay - ch / 2;
    } else if (side === "right") {
      x = ax + GAP.right;
      y = ay - ch / 2;
    } else if (side === "top") {
      x = ax - cw / 2;
      y = ay - GAP.top - ch;
    } else {
      x = ax - cw / 2;
      y = ay + GAP.bottom;
    }
    return {
      x: clamp(x, SAFE.left, Math.max(SAFE.left, view.w - SAFE.right - cw)),
      y: clamp(y, SAFE.top, Math.max(SAFE.top, view.h - SAFE.bottom - ch))
    };
  }

  /* clamp 之后卡片是否还在锚点的正确一侧（否则指引线会横穿卡片） */
  function faces(side, pos, ax, ay, cw, ch) {
    const eps = 1.5;
    if (side === "left") return ax <= pos.x + eps;
    if (side === "right") return ax >= pos.x + cw - eps;
    if (side === "top") return ay <= pos.y + eps;
    return ay >= pos.y + ch - eps;
  }

  function hitsX(a, b) {
    return a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1;
  }

  function setVisible(entry, on) {
    if (entry.visible === on) return;
    entry.visible = on;
    entry.el.style.visibility = on ? "visible" : "hidden";
    entry.el.style.pointerEvents = on ? "" : "none";
  }

  function applyStem(entry, item, x, y) {
    let len;
    let sx = 0;
    let sy = 0;
    if (item.side === "top" || item.side === "bottom") {
      sx = clamp(item.ax - x, 16, Math.max(16, item.w - 16));
      const edge = item.side === "top" ? y + item.h : y;
      len = item.side === "top" ? item.ay - edge : edge - item.ay;
    } else {
      sy = clamp(item.ay - y, 14, Math.max(14, item.h - 14));
      const edge = item.side === "left" ? x + item.w : x;
      len = item.side === "left" ? item.ax - edge : edge - item.ax;
    }
    if (!(len >= 7)) {
      if (entry.lastStem !== "off") {
        entry.lastStem = "off";
        entry.el.dataset.stem = "off";
      }
      return;
    }
    const key = Math.round(len) + "|" + Math.round(sx) + "|" + Math.round(sy);
    if (entry.lastStem === key) return;
    entry.lastStem = key;
    entry.el.dataset.stem = "on";
    entry.el.style.setProperty("--stem", Math.round(len) + "px");
    entry.el.style.setProperty("--stem-x", Math.round(sx) + "px");
    entry.el.style.setProperty("--stem-y", Math.round(sy) + "px");
  }

  /* ---------- 每帧更新 ---------- */

  function update() {
    if (view.dirty) measureView();
    if (!entries.size) return;
    if (typeof camera.updateMatrixWorld === "function") camera.updateMatrixWorld();
    const W = view.w;
    const H = view.h;

    /* 1 · 读：锚点投影（相机背后 / 视口外直接隐藏） */
    const items = [];
    for (const entry of entries.values()) {
      if (!entry.wanted) continue;
      if (entry.dirty) measure(entry);
      let anchor = null;
      try {
        anchor = getAnchor(entry.anchorKey);
      } catch (err) {
        anchor = null;
      }
      if (!anchor) {
        setVisible(entry, false);
        continue;
      }
      const proj = projectWorld(anchor.x, anchor.y, anchor.z);
      if (!proj.ok) {
        setVisible(entry, false);
        continue;
      }
      setVisible(entry, true);
      items.push({
        entry,
        ax: (proj.x * 0.5 + 0.5) * W,
        ay: (-proj.y * 0.5 + 0.5) * H,
        x: 0,
        y: 0,
        w: entry.w,
        h: entry.h,
        side: "",
        order: entry.order
      });
    }
    if (!items.length) return;

    /* 2 · 算：选边 → 目标位置 → 垂直错开（只做数学，不碰 DOM） */
    for (const item of items) {
      const spec = item.entry.spec;
      const cw = item.entry.w;
      const ch = item.entry.h;
      item.w = cw;
      item.h = ch;
      let side = SIDES.indexOf(spec.side) >= 0 ? spec.side : pickSide(item.ax, item.ay, cw, ch);
      let pos = place(side, item.ax, item.ay, cw, ch);
      if (!faces(side, pos, item.ax, item.ay, cw, ch)) {
        const alt = OPPOSITE[side];
        const altPos = place(alt, item.ax, item.ay, cw, ch);
        if (faces(alt, altPos, item.ax, item.ay, cw, ch)) {
          side = alt;
          pos = altPos;
        }
      }
      item.side = side;
      item.x = pos.x + (Number.isFinite(spec.offsetX) ? spec.offsetX : 0);
      item.y = pos.y + (Number.isFinite(spec.offsetY) ? spec.offsetY : 0);
    }

    /* 保持相对顺序：按目标 top 排，同高按创建顺序 */
    items.sort((a, b) => a.y - b.y || a.order - b.order);

    /* 正向：与上方卡片重叠的向下让位 */
    for (let i = 1; i < items.length; i += 1) {
      const item = items[i];
      for (let guard = 0; guard < 8; guard += 1) {
        let moved = false;
        for (let j = 0; j < i; j += 1) {
          const prev = items[j];
          if (!hitsX(item, prev)) continue;
          if (item.y < prev.y + prev.h + STACK_GAP && prev.y < item.y + item.h + STACK_GAP) {
            item.y = prev.y + prev.h + STACK_GAP;
            moved = true;
          }
        }
        if (!moved) break;
      }
    }

    /* 底部安全区：整体上移后反向松解，避免底部溢出 */
    const bottomLimit = view.h - SAFE.bottom;
    let lowest = 0;
    for (const item of items) lowest = Math.max(lowest, item.y + item.h);
    if (lowest > bottomLimit) {
      const shift = lowest - bottomLimit;
      for (const item of items) item.y -= shift;
      for (const item of items) item.y = Math.max(SAFE.top, item.y);
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const item = items[i];
        for (let guard = 0; guard < 8; guard += 1) {
          let moved = false;
          for (let j = i + 1; j < items.length; j += 1) {
            const next = items[j];
            if (!hitsX(item, next)) continue;
            if (item.y + item.h + STACK_GAP > next.y && next.y + next.h + STACK_GAP > item.y) {
              const ny = next.y - STACK_GAP - item.h;
              if (ny < item.y) {
                item.y = ny;
                moved = true;
              }
            }
          }
          if (!moved) break;
        }
        item.y = Math.max(SAFE.top, item.y);
      }
    }

    /* 极窄 / 极矮：堆叠后仍可能超出安全区，最后逐个 clamp（宁可轻微重叠也不溢出） */
    for (const item of items) {
      item.y = clamp(item.y, SAFE.top, Math.max(SAFE.top, view.h - SAFE.bottom - item.h));
    }

    /* 3 · 写：left/top + side + 指引线（值没变就不写，静止帧零样式写入） */
    for (const item of items) {
      const entry = item.entry;
      const x = Math.round(item.x);
      const y = Math.round(item.y);
      if (entry.lastX !== x) {
        entry.lastX = x;
        entry.el.style.left = x + "px";
      }
      if (entry.lastY !== y) {
        entry.lastY = y;
        entry.el.style.top = y + "px";
      }
      if (entry.lastSide !== item.side) {
        entry.lastSide = item.side;
        entry.el.dataset.side = item.side;
      }
      applyStem(entry, item, x, y);
    }
  }

  /* ---------- 对外 API ---------- */

  function show(spec) {
    if (!spec || typeof spec.id !== "string" || !spec.id) {
      throw new TypeError("cards.show(spec)：spec.id 必须是非空字符串");
    }
    const id = spec.id;

    /* 同 id 正在退场：直接抹掉残影，避免重影 */
    const ghost = leaving.get(id);
    if (ghost) {
      clearTimeout(ghost.timer);
      ghost.el.remove();
      leaving.delete(id);
    }

    let entry = entries.get(id);
    if (!entry) {
      entry = createEntry(id);
      entries.set(id, entry);
      layer.appendChild(entry.el);
      entry.el.getBoundingClientRect(); /* 先让入场起始态落地，再触发 is-in */
      entry.enterFrame = requestAnimationFrame(() => {
        entry.enterFrame = 0;
        if (entry.wanted && entries.get(id) === entry) entry.el.classList.add("is-in");
      });
    }

    entry.wanted = true;
    /* 与 update() 的 setVisible 缓存保持一致：否则首次判定"应隐藏"时会被缓存短路 */
    entry.visible = true;
    entry.el.style.visibility = "visible";
    entry.el.style.pointerEvents = "";

    const merged = Object.assign({}, entry.spec, spec);
    if (!SIDES.includes(merged.side)) merged.side = "auto";
    if (!TONES.includes(merged.tone)) merged.tone = "default";
    entry.spec = merged;
    entry.anchorKey = merged.anchor || id;

    const sig = signature(merged);
    if (sig !== entry.sig) {
      entry.sig = sig;
      applyContent(entry, merged);
      entry.dirty = true;
    }

    update();
    return id;
  }

  function hide(id) {
    const entry = entries.get(id);
    if (!entry) return;
    entries.delete(id);
    entry.wanted = false;
    entry.visible = false;
    if (entry.enterFrame) {
      cancelAnimationFrame(entry.enterFrame);
      entry.enterFrame = 0;
    }
    const el = entry.el;
    el.style.pointerEvents = "none";
    el.classList.remove("is-in");
    el.classList.add("is-out");
    const timer = setTimeout(() => {
      el.remove();
      leaving.delete(id);
    }, 200);
    leaving.set(id, { el, timer });
  }

  function hideAll() {
    for (const id of Array.from(entries.keys())) hide(id);
  }

  function has(id) {
    const entry = entries.get(id);
    return Boolean(entry && entry.wanted);
  }

  return { show, hide, hideAll, update, has };
}
