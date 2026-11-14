// P3 光谱与建模 —— 关键日 → 输入方案 → 结构 → 消融 → 波长反查。
// 数据唯一来源：../paper-detail.js（论文细则）与 ../data.js（演示光谱曲线）；不引入任何依赖。
import { buildSample } from "../data.js";
import { SpectrumChart } from "../chart.js";
import { ABLATION, ACQUISITION, NETWORK, SCORES, SCREENING, WAVELENGTH } from "../paper-detail.js";

const C = {
  accent: "#0fa392",
  accentInk: "#0a7a6e",
  blue: "#3d7bfd",
  text: "#161b22",
  text2: "#5b6575",
  text3: "#8b94a3",
  line: "rgba(16,24,40,0.08)",
  lineStrong: "rgba(16,24,40,0.14)",
  female: "#2f8fd8",
  male: "#e2663c"
};

const n3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");
const sgn = (v) => (v > 0 ? "+" + v.toFixed(3) : v < 0 ? "−" + Math.abs(v).toFixed(3) : "—");
const commas = (v) => Number(v).toLocaleString("en-US");

/* ---------------- SVG 小工具 ---------------- */

function svgText(x, y, text, o = {}) {
  const {
    size = 11,
    fill = C.text,
    anchor = "middle",
    weight = 400,
    mono = false,
    cls = "",
    opacity = 1,
    baseline = ""
  } = o;
  const attrs = [
    "x=" + x,
    "y=" + y,
    "font-size=" + size,
    "fill=" + fill,
    "text-anchor=" + anchor,
    "font-weight=" + weight
  ].map((s) => s.replace("=", '="') + '"');
  if (baseline) attrs.push('dominant-baseline="' + baseline + '"');
  if (opacity !== 1) attrs.push('opacity="' + opacity + '"');
  if (mono) attrs.push('style="font-family:var(--mono)"');
  if (cls) attrs.push('class="' + cls + '"');
  return "<text " + attrs.join(" ") + ">" + text + "</text>";
}

function svgBox(x, y, w, h, fill, stroke, r = 9, dash = "") {
  return (
    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + fill +
    '" stroke="' + stroke + '" stroke-width="1"' + (dash ? ' stroke-dasharray="' + dash + '"' : "") + "/>"
  );
}

function svgRoot(w, h, label, body) {
  return (
    '<svg viewBox="0 0 ' + w + " " + h + '" style="display:block;width:100%;height:auto" role="img" aria-label="' +
    label + '">' + body + "</svg>"
  );
}

/* ---------------- 关键日初筛：按 AUC 排序的横向条 ---------------- */

function drawScreening(host, w) {
  const groups = [
    {
      title: "单日",
      note: "D2 / D5 单独建模",
      items: SCREENING.single.map((d) => ({ label: d.id, auc: d.auc }))
    },
    {
      title: "双日",
      note: "21 组 · 正文列 3 组",
      items: SCREENING.dual.map((d) => ({ label: d.id, auc: d.auc, best: d.id === "D2+D5" }))
    },
    {
      title: "多日",
      note: "逐日累加，AUC 未升",
      items: SCREENING.multi.map((d) => ({ label: d.id, auc: d.auc }))
    },
    {
      title: "变化量",
      note: "ΔS / R 与四支融合",
      items: SCREENING.delta
        .filter((d) => Number.isFinite(d.auc))
        .map((d) => ({ label: d.id, auc: d.auc, delta: true }))
    }
  ];
  for (const g of groups) g.items.sort((a, b) => b.auc - a.auc);

  const padT = 26;
  const headH = 25;
  const rowH = 22;
  const padB = 24;
  const labelW = Math.max(66, Math.min(116, w * 0.29));
  const valW = 46;
  const barX = labelW + 8;
  const barW = Math.max(60, w - barX - valW);
  const min = 0.5;
  const max = 1;
  const X = (v) => barX + ((v - min) / (max - min)) * barW;
  const H = padT + groups.reduce((n, g) => n + headH + g.items.length * rowH, 0) + padB;

  const parts = [];
  for (let v = 0.5; v <= 1.001; v += 0.1) {
    const x = Math.round(X(v)) + 0.5;
    parts.push(
      '<line x1="' + x + '" y1="' + (padT - 8) + '" x2="' + x + '" y2="' + (H - padB + 2) +
        '" stroke="rgba(16,24,40,0.055)" stroke-width="1"/>'
    );
    parts.push(svgText(x, 12, v.toFixed(2), { size: 9.5, fill: C.text3, mono: true, cls: "num" }));
  }
  parts.push(svgText(0, 12, "验证集 AUC", { size: 9.5, fill: C.text3, anchor: "start" }));

  let y = padT;
  for (const g of groups) {
    parts.push(svgText(0, y + 13, g.title, { size: 10.5, fill: C.text2, anchor: "start", weight: 650 }));
    parts.push(svgText(barX, y + 13, g.note, { size: 9, fill: C.text3, anchor: "start" }));
    y += headH;
    for (const it of g.items) {
      parts.push('<g class="p3-row" data-k="' + it.label + '">');
      const cy = y + rowH / 2;
      const color = it.best
        ? C.accent
        : it.delta
        ? it.label === "四支融合"
          ? C.blue
          : "rgba(61,123,253,0.42)"
        : "rgba(15,163,146,0.40)";
      if (it.best) {
        parts.push(
          '<rect x="0" y="' + y + '" width="' + w + '" height="' + rowH + '" rx="5" fill="rgba(15,163,146,0.07)" stroke="rgba(15,163,146,0.20)" stroke-width="1"/>'
        );
      }
      parts.push('<rect x="' + barX + '" y="' + (cy - 4.5) + '" width="' + barW + '" height="9" rx="4.5" fill="rgba(16,24,40,0.045)"/>');
      parts.push(
        '<rect x="' + barX + '" y="' + (cy - 4.5) + '" width="' + Math.max(3, X(it.auc) - barX) +
          '" height="9" rx="4.5" fill="' + color + '"/>'
      );
      parts.push(
        svgText(0, cy, it.label, {
          size: 11,
          fill: it.best ? C.accentInk : C.text,
          anchor: "start",
          weight: it.best ? 650 : 450,
          baseline: "middle"
        })
      );
      parts.push(
        svgText(w, cy, n3(it.auc), {
          size: it.best ? 11.5 : 10.5,
          fill: it.best ? C.accentInk : C.text2,
          anchor: "end",
          weight: it.best ? 650 : 450,
          mono: true,
          baseline: "middle",
          cls: "num"
        })
      );
      parts.push("</g>");
      y += rowH;
    }
  }
  parts.push(svgText(barX, H - 8, "0.5 = 随机水平", { size: 9, fill: C.text3, anchor: "start" }));
  host.innerHTML = svgRoot(w, H, "关键日初筛：各输入方案验证集 AUC 条形图", parts.join(""));
}

/* ---------------- 波长反查轴 ---------------- */

function drawWavelength(host, w) {
  const wlMin = ACQUISITION.wavelength[0];
  const wlMax = ACQUISITION.wavelength[1];
  const padL = 8;
  const padR = 8;
  const x0 = padL;
  const x1 = w - padR;
  const X = (nm) => x0 + ((nm - wlMin) / (wlMax - wlMin)) * (x1 - x0);
  const axisY = 62;
  const bandTop = 30;
  const bandH = 32;
  const H = 128;
  const wide = w >= 780;

  const parts = [];
  const bandLabel = ["594–620", "660–675"];
  WAVELENGTH.bands.forEach((band, i) => {
    const a = band[0];
    const b = band[1];
    const bx = X(a);
    const bw = Math.max(3, X(b) - bx);
    parts.push(
      '<rect x="' + bx + '" y="' + bandTop + '" width="' + bw + '" height="' + bandH +
        '" rx="3" fill="rgba(15,163,146,0.14)" stroke="rgba(15,163,146,0.38)" stroke-width="1"><title>候选波段 ' +
        a + "–" + b + ' nm</title></rect>'
    );
    if (wide) {
      parts.push(svgText(bx + bw / 2, bandTop - 7, bandLabel[i], { size: 9, fill: C.accentInk, mono: true, cls: "num" }));
    }
  });

  parts.push('<line x1="' + x0 + '" y1="' + axisY + '" x2="' + x1 + '" y2="' + axisY + '" stroke="rgba(16,24,40,0.22)" stroke-width="1"/>');

  const ticks = [340, 400, 500, 600, 700, 800, 900, 1000, 1020];
  const labeled = w >= 600 ? [340, 400, 500, 600, 700, 800, 900, 1020] : [340, 500, 700, 900, 1020];
  ticks.forEach((nm) => {
    const x = Math.round(X(nm)) + 0.5;
    parts.push('<line x1="' + x + '" y1="' + axisY + '" x2="' + x + '" y2="' + (axisY + 4) + '" stroke="rgba(16,24,40,0.22)" stroke-width="1"/>');
    if (labeled.indexOf(nm) === -1) return;
    if (nm === 340) {
      parts.push(svgText(x0 - 4, axisY + 44, String(nm), { size: 9, fill: C.text3, anchor: "start", mono: true, cls: "num" }));
    } else if (nm === 1020) {
      parts.push(svgText(x1 + 4, axisY + 44, String(nm), { size: 9, fill: C.text3, anchor: "end", mono: true, cls: "num" }));
    } else {
      parts.push(svgText(x, axisY + 44, String(nm), { size: 9, fill: C.text3, mono: true, cls: "num" }));
    }
  });
  parts.push(svgText(x1, axisY - 9, "波长 / nm", { size: 8.5, fill: C.text3, anchor: "end" }));
  parts.push(svgText(x0, 16, "候选波段（模型推导区间）", { size: 9, fill: C.text3, anchor: "start" }));

  WAVELENGTH.hot.forEach((p) => {
    parts.push('<g class="p3-hot" data-nm="' + p.nm + '">');
    const x = Math.round(X(p.nm)) + 0.5;
    const level = Math.max(p.cars, p.spa);
    const len = 6 + (level - 3) * 7;
    const solid = level >= 5;
    parts.push(
      '<line x1="' + x + '" y1="' + (axisY + 2) + '" x2="' + x + '" y2="' + (axisY + 2 + len) + '" stroke="rgba(15,163,146,' +
        (solid ? 0.9 : 0.5) + ')" stroke-width="' + (solid ? 1.4 : 1.1) + '"><title>' + p.nm + " nm · CARS " +
        p.cars + "/5 折 · SPA " + p.spa + "/5 折</title></line>"
    );
    parts.push(
      '<circle cx="' + x + '" cy="' + (axisY + 3 + len) + '" r="1.5" fill="rgba(15,163,146,' +
        (solid ? 0.9 : 0.45) + ')"/>'
    );
    parts.push("</g>");
  });

  WAVELENGTH.minor.forEach((nm) => {
    const x = Math.round(X(nm)) + 0.5;
    parts.push(
      '<line x1="' + x + '" y1="' + (axisY + 2) + '" x2="' + x + '" y2="' + (axisY + 9) +
        '" stroke="rgba(16,24,40,0.26)" stroke-width="1"><title>' + nm + " nm · 次要入选点</title></line>"
    );
    if (w >= 640) parts.push(svgText(x, axisY + 30, String(nm), { size: 8, fill: C.text3, mono: true, cls: "num" }));
  });

  host.innerHTML = svgRoot(
    w,
    H,
    "340–1020 nm 波长轴：候选波段 594–620 / 660–675 nm 与 9 个高入选频率点位",
    parts.join("")
  );
}

/* ---------------- 基线参数量 ---------------- */

function drawParams(host, w) {
  const rows = NETWORK.baselines;
  const maxV = Math.max.apply(null, rows.map((r) => r.params));
  const labelW = Math.max(84, Math.min(132, w * 0.36));
  const valW = 58;
  const barX = labelW + 8;
  const barW = Math.max(40, w - barX - valW);
  const rowH = 26;
  const H = rows.length * rowH + 2;
  const parts = [];
  rows.forEach((r, i) => {
    const cy = i * rowH + rowH / 2;
    const own = r.id === "DSSF-Net";
    parts.push('<rect x="' + barX + '" y="' + (cy - 5) + '" width="' + barW + '" height="10" rx="5" fill="rgba(16,24,40,0.045)"/>');
    parts.push(
      '<rect x="' + barX + '" y="' + (cy - 5) + '" width="' + Math.max(3, (r.params / maxV) * barW) +
        '" height="10" rx="5" fill="' + (own ? C.accent : "rgba(16,24,40,0.22)") + '"/>'
    );
    parts.push(
      svgText(0, cy, r.id, {
        size: 10.5,
        fill: own ? C.accentInk : C.text2,
        anchor: "start",
        weight: own ? 650 : 450,
        baseline: "middle"
      })
    );
    parts.push(
      svgText(w, cy, commas(r.params), {
        size: 10.5,
        fill: own ? C.accentInk : C.text2,
        anchor: "end",
        weight: own ? 650 : 450,
        mono: true,
        baseline: "middle",
        cls: "num"
      })
    );
  });
  host.innerHTML = svgRoot(w, H, "基线模型参数量对比（横向条）", parts.join(""));
}

/* ---------------- DSSF-Net 结构图 ---------------- */

function netDiagram() {
  const P = [];
  const rows = [
    { y: 78, id: "D2" },
    { y: 138, id: "D5" },
    { y: 218, id: "ΔS" },
    { y: 278, id: "R" }
  ];
  const arrow = (d, accent) =>
    '<path d="' + d + '" fill="none" stroke="' + (accent ? "rgba(15,163,146,0.55)" : "rgba(16,24,40,0.30)") +
    '" stroke-width="1.1" marker-end="url(#' + (accent ? "p3-ar-a" : "p3-ar") + ')"/>';

  P.push(
    "<defs>" +
      '<marker id="p3-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="rgba(16,24,40,0.34)"/></marker>' +
      '<marker id="p3-ar-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="rgba(15,163,146,0.62)"/></marker>' +
      '<marker id="p3-ar-s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="rgba(16,24,40,0.20)"/></marker>' +
      "</defs>"
  );

  [
    [45, "输入 681 点"],
    [181, "压到 128 维"],
    [408, "共享打分"],
    [563, "单 Softmax"],
    [658, "加权和"],
    [761, "FC"],
    [850, "输出"]
  ].forEach((item) => P.push(svgText(item[0], 24, item[1], { size: 9, fill: C.text3 })));

  P.push('<g class="p3-mod" data-k="in">');
  rows.forEach((r) => {
    P.push(svgBox(12, r.y - 20, 66, 40, "#ffffff", C.lineStrong));
    P.push(svgText(45, r.y - 2, r.id, { size: 12.5, weight: 650 }));
    P.push(svgText(45, r.y + 11, "681", { size: 9.5, fill: C.text3, mono: true, cls: "num" }));
    P.push(arrow("M78 " + r.y + " H98"));
  });
  P.push("</g>");

  P.push('<g class="p3-mod" data-k="enc">');
  P.push(svgBox(100, 46, 162, 124, "rgba(15,163,146,0.05)", "rgba(15,163,146,0.30)"));
  P.push(svgText(181, 70, "残差 Conv1D 编码器", { size: 11.5, weight: 650 }));
  P.push(svgText(181, 87, "3 块 · 32 / 64 / 128 通道", { size: 9, fill: C.text3 }));
  P.push(svgText(181, 100, "核 7 / 5 / 3 · 1×1 捷径", { size: 9, fill: C.text3 }));
  P.push(svgBox(126, 108, 110, 20, "#ffffff", "rgba(15,163,146,0.30)", 10));
  P.push(svgText(181, 122, "92,416", { size: 10, fill: C.accentInk, weight: 650, mono: true, cls: "num" }));
  P.push(svgText(181, 148, "D2 / D5 共用 · 自适应 GAP", { size: 9, fill: C.text3 }));
  P.push("</g>");

  P.push('<g class="p3-mod" data-k="mlp">');
  [218, 278].forEach((cy) => {
    P.push(svgBox(100, cy - 20, 162, 40, "rgba(61,123,253,0.05)", "rgba(61,123,253,0.28)"));
    P.push(svgText(181, cy - 5, "MLP 681→256→128", { size: 10.5, weight: 650 }));
    P.push(svgText(181, cy + 9, "ReLU · Dropout 0.3", { size: 8.8, fill: C.text3 }));
  });
  P.push(
    '<text x="100" y="318" font-size="9.5" fill="' + C.text3 + '">两支 MLP 合计 <tspan style="font-family:var(--mono)" fill="' +
      C.text2 + '">414,976</tspan></text>'
  );
  P.push("</g>");

  P.push('<g class="p3-mod" data-k="proj">');
  rows.forEach((r) => {
    P.push(arrow("M262 " + r.y + " H280"));
    P.push(svgBox(282, r.y - 12, 48, 24, "#ffffff", C.line, 12));
    P.push(svgText(306, r.y + 3.5, "128", { size: 10.5, mono: true, weight: 600, cls: "num" }));
  });
  P.push("</g>");

  P.push('<g class="p3-mod" data-k="score">');
  P.push(svgBox(348, 58, 120, 242, "rgba(61,123,253,0.05)", "rgba(61,123,253,0.28)"));
  P.push(svgText(408, 172, "共享打分器", { size: 12, weight: 650 }));
  P.push(svgText(408, 190, "128 → 64 → 1", { size: 10, fill: C.text2, mono: true }));
  P.push(svgText(408, 206, "4 个标量", { size: 9, fill: C.text3 }));
  P.push("</g>");

  P.push('<g class="p3-mod" data-k="soft">');
  const subs = ["s₁", "s₂", "s₃", "s₄"];
  rows.forEach((r, i) => {
    P.push(arrow("M468 " + r.y + " H484"));
    P.push(svgBox(486, r.y - 11, 34, 22, "#ffffff", "rgba(15,163,146,0.32)", 7));
    P.push(svgText(503, r.y + 3.5, subs[i], { size: 9.5, fill: C.accentInk, mono: true }));
    P.push(arrow("M520 " + r.y + " H534", true));
  });

  P.push(svgBox(536, 58, 54, 242, "rgba(15,163,146,0.06)", "rgba(15,163,146,0.30)"));
  P.push(
    '<text x="0" y="0" font-size="10.5" font-weight="650" fill="' + C.accentInk +
      '" text-anchor="middle" transform="translate(563 179) rotate(-90)">单个 Softmax（4 个标量）</text>'
  );
  P.push("</g>");

  P.push('<g class="p3-mod" data-k="z">');
  rows.forEach((r) =>
    P.push('<line x1="590" y1="' + r.y + '" x2="600" y2="' + r.y + '" stroke="rgba(15,163,146,0.45)" stroke-width="1.1"/>')
  );
  P.push('<line x1="600" y1="78" x2="600" y2="278" stroke="rgba(15,163,146,0.45)" stroke-width="1.1"/>');
  P.push(arrow("M600 178 H608"));

  P.push(svgBox(610, 150, 96, 54, "#ffffff", C.lineStrong));
  P.push(svgText(658, 172, "Σ αᵢ · hᵢ", { size: 12, weight: 650 }));
  P.push(svgText(658, 190, "z ∈ R¹²⁸", { size: 9.5, fill: C.text2, mono: true }));
  P.push(arrow("M706 178 H718"));
  P.push(svgBox(720, 150, 82, 54, "#ffffff", C.lineStrong));
  P.push(svgText(761, 173, "FC", { size: 11.5, weight: 650 }));
  P.push(svgText(761, 190, "128 → 2", { size: 9.5, fill: C.text2, mono: true }));
  P.push(arrow("M802 178 H816"));
  P.push(svgBox(818, 150, 64, 54, "#ffffff", C.lineStrong));
  P.push(svgText(850, 173, "Softmax", { size: 10 }));
  P.push(svgText(850, 190, "2 类", { size: 9, fill: C.text3 }));
  P.push("</g>");

  P.push('<g class="p3-mod" data-k="out">');
  P.push('<path d="M882 178 H892" fill="none" stroke="rgba(16,24,40,0.30)" stroke-width="1.1"/>');
  P.push(arrow("M892 178 V161 H898"));
  P.push(arrow("M892 178 V199 H898"));
  P.push(svgBox(900, 148, 88, 26, "rgba(47,143,216,0.10)", "rgba(47,143,216,0.38)", 8));
  P.push(svgText(944, 165, "雌", { size: 11.5, fill: C.female, weight: 650 }));
  P.push(svgBox(900, 186, 88, 26, "rgba(226,102,60,0.10)", "rgba(226,102,60,0.38)", 8));
  P.push(svgText(944, 203, "雄", { size: 11.5, fill: C.male, weight: 650 }));
  P.push("</g>");

  P.push(
    '<path d="M306 304 V330 H658 V208" fill="none" stroke="rgba(16,24,40,0.18)" stroke-width="1" stroke-dasharray="3 3" marker-end="url(#p3-ar-s)"/>'
  );
  P.push(svgText(470, 344, "4 × hᵢ ∈ R¹²⁸", { size: 9, fill: C.text3, mono: true }));

  return svgRoot(
    1000,
    356,
    "DSSF-Net 结构：D2 与 D5 经共享残差 Conv1D 编码器、ΔS 与 R 经 MLP 各压到 128 维；共享打分器给出 4 个标量，单个 Softmax 归一化后加权求和为 z，FC 与 Softmax 输出雌雄两类",
    P.join("")
  );
}

/* ---------------- 屏 ---------------- */

let live = null;

export function mount(root) {
  if (root && root.__p3api) return root.__p3api;
  const sample = buildSample();
  const acq = ACQUISITION;
  const cv = SCORES.cv;
  const hold = SCORES.holdout;
  const lobo = SCORES.lobo;

  const ablBase = ABLATION[0];
  const ablMax = ABLATION[ABLATION.length - 1].auc - ablBase.auc;
  const ablRows = ABLATION.map((row, i) => {
    const gain = row.auc - ablBase.auc;
    const final = i === ABLATION.length - 1;
    return (
      '<tr class="p3-abl-row' + (final ? " is-final is-active" : "") + '" data-i="' + i + '">' +
      '<td><span class="p3-step num">' + i + "</span>" + row.id + "</td>" +
      '<td class="num">' + n3(row.acc) + '<span class="p3-sd">±' + row.accSd.toFixed(3) + "</span></td>" +
      '<td class="num">' + n3(row.auc) + '<span class="p3-sd">±' + row.aucSd.toFixed(3) + "</span></td>" +
      '<td class="p3-col-gain"><div class="p3-gaincell">' +
      '<span class="num">' + (i === 0 ? "—" : sgn(gain)) + "</span>" +
      '<span class="p3-track"><span style="width:' + (i === 0 ? 0 : (gain / ablMax) * 100) + '%"></span></span>' +
      "</div></td></tr>"
    );
  }).join("");

  const wlBase = WAVELENGTH.rows[0].auc;
  const wlRows = WAVELENGTH.rows
    .map((r, i) => {
      const m = /^(.*?)（(.*?)）$/.exec(String(r.points));
      const main = m ? m[1] : String(r.points);
      const sub = m ? m[2] : "";
      const numeric = /^[\d.\s±]+$/.test(main);
      const delta = r.auc - wlBase;
      return (
        "<tr" + (i === 0 ? ' class="is-active"' : "") + ">" +
        "<td>" + r.id + (i === 0 ? ' <span class="tag is-quiet p3-tag-inline">定稿</span>' : "") + "</td>" +
        '<td class="p3-points">' +
        (numeric ? '<span class="p3-pts num">' + main + "</span>" : '<span class="p3-pts">' + main + "</span>") +
        (sub ? '<span class="p3-pts-sub num">' + sub + "</span>" : "") +
        "</td>" +
        '<td class="num">' + n3(r.acc) + "</td>" +
        '<td class="num">' + n3(r.auc) + (i === 0 ? "" : '<span class="p3-delta num">' + sgn(delta) + "</span>") + "</td>" +
        "</tr>"
      );
    })
    .join("");

  root.innerHTML =
    '<div class="screen-inner p3">' +
    '<header class="screen-head">' +
    '<p class="eyebrow">P3 · 光谱与建模</p>' +
    "<h2>先定关键日，再定模型结构</h2>" +
    '<p class="lead">21 组双日全组合里 <b>D2+D5</b> 最优；变化量特征把 AUC 推到 <b>0.965</b>；结构定稿后再做波长反查。</p>' +
    '<p class="p3-index">' +
    "<span><em>01</em>光谱</span><i></i>" +
    "<span><em>02</em>关键日初筛</span><i></i>" +
    "<span><em>03</em>结构</span><i></i>" +
    "<span><em>04</em>消融</span><i></i>" +
    "<span><em>05</em>波长反查</span>" +
    "</p>" +
    "</header>" +
    '<div class="screen-grid p3-flow">' +

    /* 行 1：光谱 + 单日初筛 */
    '<div class="screen-grid grid-2 p3-row1">' +
    '<section class="panel p3-spec">' +
    '<div class="panel-head">' +
    '<div class="p3-ph"><h3>透射光谱 T(λ)</h3>' +
    "<p><span class=\"num\">" + acq.wavelength[0] + "–" + acq.wavelength[1] + "</span> nm · <span class=\"num\">" +
    acq.points + "</span> 点 · 步长 <span class=\"num\">" + acq.stepNm +
    "</span> nm · 实际分辨率 ≈ <span class=\"num\">" + acq.resolutionNm + "</span> nm</p></div>" +
    '<div class="layer-row p3-layers" role="group" aria-label="曲线图层">' +
    '<button class="layer is-on" data-layer="d2" aria-pressed="true"><i></i>D2</button>' +
    '<button class="layer is-on" data-layer="d5" aria-pressed="true"><i></i>D5</button>' +
    '<button class="layer is-on" data-layer="delta" aria-pressed="true"><i></i>ΔS</button>' +
    "</div></div>" +
    '<div class="p3-chart"><canvas id="p3-spectrum" aria-label="D2 与 D5 透射光谱曲线，以及差谱 ΔS"></canvas></div>' +
    '<div class="legend p3-legend">' +
    '<span><i class="line" style="background:#0f9e8f"></i>D2 实线</span>' +
    '<span><i class="line" style="background:repeating-linear-gradient(90deg,#3d7bfd 0 4px,transparent 4px 7px)"></i>D5 虚线</span>' +
    '<span><i class="line" style="background:#c98a1f"></i>ΔS = D5 − D2</span>' +
    '<span><i style="background:rgba(201,138,31,0.18);border:1px solid rgba(201,138,31,0.45)"></i>差值量级 ±0.01</span>' +
    "</div>" +
    '<p class="p3-cap"><b>图注</b>同一枚示例蛋的 D2 / D5 透射谱与差值，由演示数据生成，仅示意谱形与差值量级。<b>界面演示曲线，非实测</b>，不是论文原始光谱。</p>' +
    "</section>" +

    '<section class="panel p3-single">' +
    '<div class="panel-head"><div class="p3-ph"><h3>单日初筛</h3><p>固定 SVM 流程 · 验证集 ACC / AUC</p></div><span class="tag">D5 最优</span></div>' +
    '<div class="p3-day-list">' +
    '<div class="p3-day"><div class="p3-day-id"><b>D2</b><span>单日次优</span></div>' +
    '<div class="p3-day-metrics"><div><em>ACC</em><b class="num">' + n3(SCREENING.single[0].acc) +
    '</b></div><div><em>AUC</em><b class="num">' + n3(SCREENING.single[0].auc) + "</b></div></div></div>" +
    '<div class="p3-day is-best"><div class="p3-day-id"><b>D5<span class="p3-dot" aria-hidden="true"></span></b><span>单日最优</span></div>' +
    '<div class="p3-day-metrics"><div><em>ACC</em><b class="num">' + n3(SCREENING.single[1].acc) +
    '</b></div><div><em>AUC</em><b class="num">' + n3(SCREENING.single[1].auc) + "</b></div></div></div>" +
    "</div>" +
    '<div class="p3-merge">' +
    '<div class="p3-merge-head"><span class="p3-merge-kicker">合入 D2 后</span><b>D2 + D5</b><span class="tag p3-tag-inline">双日最优</span></div>' +
    '<div class="p3-merge-metrics"><div><em>ACC</em><b class="num">' + n3(SCREENING.dual[0].acc) +
    '</b></div><div><em>AUC</em><b class="num">' + n3(SCREENING.dual[0].auc) + "</b></div></div>" +
    '<p class="p3-merge-cap">AUC · 单日 → 双日</p>' +
    '<div class="p3-mini-bar"><span>D5-only</span><i><b style="width:' +
    (((SCREENING.single[1].auc - 0.5) / 0.5) * 100).toFixed(1) + '%"></b></i><em class="num">' +
    n3(SCREENING.single[1].auc) + "</em></div>" +
    '<div class="p3-mini-bar is-accent"><span>D2+D5</span><i><b style="width:' +
    (((SCREENING.dual[0].auc - 0.5) / 0.5) * 100).toFixed(1) + '%"></b></i><em class="num">' +
    n3(SCREENING.dual[0].auc) + "</em></div>" +
    "</div>" +
    '<div class="p3-gain">' +
    '<p class="p3-gain-head">加 D2 相对 D5-only</p>' +
    '<div class="p3-gain-row"><span>ACC</span><b class="num">+' + SCREENING.gainFromD2.acc.toFixed(3) + '</b><i class="p3-gain-vs">' +
    n3(SCREENING.single[1].acc) + " → " + n3(SCREENING.dual[0].acc) + "</i></div>" +
    '<div class="p3-gain-row"><span>AUC</span><b class="num">+' + SCREENING.gainFromD2.auc.toFixed(3) + '</b><i class="p3-gain-vs">' +
    n3(SCREENING.single[1].auc) + " → " + n3(SCREENING.dual[0].auc) + "</i></div>" +
    '<p class="p3-gain-note">固定 SVM 流程，两组同一划分、仅输入日不同；ACC / AUC 均为验证集。</p>' +
    "</div></section>" +
    "</div>" +

    /* 关键日初筛条形图 */
    '<section class="panel p3-screening">' +
    '<div class="panel-head">' +
    '<div class="p3-ph"><h3>关键日初筛 · 验证集 AUC</h3><p>同一流程逐组训练；组内按 AUC 降序，分组为单日 / 双日 / 多日 / 变化量</p></div>' +
    '<span class="tag is-blue">D2+D5 0.951</span></div>' +
    '<div class="p3-bars" id="p3-bars"></div>' +
    '<div class="legend p3-legend">' +
    '<span><i style="background:#0fa392"></i>D2+D5（入选）</span>' +
    '<span><i style="background:rgba(15,163,146,0.40)"></i>关键日与多日组合</span>' +
    '<span><i style="background:#3d7bfd"></i>变化量特征</span>' +
    "</div>" +
    '<p class="footnote">横轴自 <b>0.5</b>（随机水平）起，条长按 AUC 线性映射。论文正文只列出 21 组双日中的代表性组合（D2+D5 <span class="num">0.951</span>、D3+D5 <span class="num">0.855</span>、D1+D5 <span class="num">0.855</span>），<b>未列出的组合不补数</b>；R 单独仅报 ACC <span class="num">0.895</span>，未给 AUC，故不入图。</p>' +
    "</section>" +

    /* 结构 */
    '<section class="panel p3-net">' +
    '<div class="panel-head">' +
    '<div class="p3-ph"><h3>DSSF-Net 结构</h3><p>四支输入 → 压到 128 维 → 共享打分器 → 单个 Softmax → 加权和 → 二分类</p></div>' +
    '<span class="tag"><span class="num">515,971</span>&nbsp;参数</span></div>' +
    '<div class="p3-svg-wrap">' + netDiagram() + "</div>" +
    '<div class="p3-net-meta">' +
    "<div>" +
    '<p class="p3-mini-title">参数量拆分</p>' +
    '<div class="p3-paramsplit">' +
    "<div><span>残差 Conv1D 编码器 ×1（D2 / D5 共用）</span><b class=\"num\">92,416</b></div>" +
    '<div><span>MLP ×2（ΔS / R）</span><b class="num">414,976</b></div>' +
    '<div class="is-total"><span>合计</span><b class="num">515,971</b></div>' +
    "</div>" +
    '<p class="p3-mini-note">前三项合计 <span class="num">507,392</span>，其余为共享打分器与分类头。</p>' +
    "</div>" +
    "<div>" +
    '<p class="p3-mini-title">基线参数量对比</p>' +
    '<div class="p3-params" id="p3-params"></div>' +
    "</div>" +
    "</div>" +
    '<p class="p3-cap"><b>读法</b>D2 / D5 各 <span class="num">681</span> 点经残差 Conv1D 编码器压到 <span class="num">128</span> 维；ΔS（差谱）与 R（变化率）各经 <span class="num">681→256→128</span> 的 MLP。四支同级表示进入共享打分器，<b>Softmax 只在 4 个标量之间归一化</b>——这是注意力加权，不是四分类；加权和为 z 后由 FC 输出两类。</p>' +
    "</section>" +

    /* 消融 */
    '<section class="panel p3-abl">' +
    '<div class="panel-head"><div class="p3-ph"><h3>顺序消融</h3><p>同一 5 折划分逐项加结构，括号内为标准差</p></div><span class="tag is-quiet">ABLATION</span></div>' +
    '<table class="tbl p3-abl-tbl"><thead><tr><th>结构</th><th>ACC</th><th>AUC</th><th class="p3-col-gain">相对直接拼接</th></tr></thead>' +
    "<tbody>" + ablRows + "</tbody></table>" +
    '<p class="p3-abl-conc">相对直接拼接 <b class="num">ACC +' + (ABLATION[4].acc - ablBase.acc).toFixed(3) +
    '</b>、<b class="num">AUC +' + (ABLATION[4].auc - ablBase.auc).toFixed(3) +
    '</b>；其中 ΔS 一步 AUC <span class="num">0.951 → 0.966</span>（<span class="num">+0.015</span>），是单个环节里最大的一次增量。</p>' +
    "</section>" +

    /* 波长反查 */
    '<section class="panel p3-wl">' +
    '<div class="panel-head"><div class="p3-ph"><h3>波长反查</h3><p>在定稿结构与同一 5 折下，用 CARS / SPA 反查被模型偏好的波段</p></div><span class="tag is-warn">候选区间 · 非吸收峰</span></div>' +
    '<div class="p3-wl-axis" id="p3-wl"></div>' +
    '<div class="legend p3-legend">' +
    '<span><i style="background:rgba(15,163,146,0.18);border:1px solid rgba(15,163,146,0.45)"></i>候选波段 594–620 / 660–675 nm</span>' +
    '<span><i class="line" style="background:#0fa392"></i>9 个高入选点位（竖线长度 = 入选折数）</span>' +
    '<span><i class="line" style="background:rgba(16,24,40,0.26)"></i>次要点位</span>' +
    "</div>" +
    '<p class="p3-hotlist"><b>高入选点位</b><span class="num">' + WAVELENGTH.hot.map(function (h) { return h.nm; }).join(" · ") +
    '</span><span class="p3-hotlist-u"> nm，入选折数 4–5</span></p>' +
    '<table class="tbl p3-wl-tbl"><thead><tr><th>口径</th><th>保留点数</th><th>ACC</th><th>AUC</th></tr></thead>' +
    "<tbody>" + wlRows + "</tbody></table>" +
    '<p class="footnote"><b>最终模型仍用全谱（681 点）。</b>候选波段是模型推导区间，<b>不是吸收峰，也不是生物学机制结论</b>；采样步长 1 nm，但实际分辨率 ≈ 2.8 nm，区间边界不宜按单点解读；AUC 列右侧灰色数字为相对全谱的差值。同维数随机点位（AUC <span class="num">0.928</span> / <span class="num">0.906</span>）低于 CARS / SPA，说明增益不只在降维本身。</p>' +
    "</section>" +

    '<p class="caveat p3-cav"><span class="num">' + n3(cv.auc) + "</span> 是五折 AUC，不是准确率；留出集 <span class=\"num\">" +
    n3(hold.acc) + " / " + n3(hold.auc) + "</span>（" + hold.n + " 枚）、跨批次 <span class=\"num\">" +
    n3(lobo.acc) + " / " + n3(lobo.auc) + "</span>（4 轮）不可与它混引。参数量未做匹配对照，性能提升不能完全归因于结构本身。</p>" +

    "</div></div>";

  const q = (sel) => root.querySelector(sel);
  const chart = new SpectrumChart(q("#p3-spectrum"));
  chart.setSample(sample);

  const layers = { d2: true, d5: true, delta: true };
  q(".p3-layers").addEventListener("click", (ev) => {
    const btn = ev.target.closest(".layer");
    if (!btn) return;
    const key = btn.dataset.layer;
    if (!(key in layers)) return;
    const onCount = Object.values(layers).filter(Boolean).length;
    if (layers[key] && onCount <= 1) return;
    layers[key] = !layers[key];
    btn.classList.toggle("is-on", layers[key]);
    btn.setAttribute("aria-pressed", String(layers[key]));
    chart.setLayers({ [key]: layers[key] });
  });

  const applyLayers = (next) => {
    Object.keys(layers).forEach((k) => {
      if (k in next) layers[k] = !!next[k];
    });
    chart.setLayers({ d2: layers.d2, d5: layers.d5, delta: layers.delta });
    root.querySelectorAll(".layer").forEach((btn) => {
      const on = !!layers[btn.dataset.layer];
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  };

  const measured = [
    { el: q("#p3-bars"), draw: drawScreening },
    { el: q("#p3-wl"), draw: drawWavelength },
    { el: q("#p3-params"), draw: drawParams }
  ];

  const fitAll = () => {
    for (const item of measured) {
      const wpx = Math.round(item.el.clientWidth);
      if (wpx > 80) item.draw(item.el, wpx);
    }
  };

  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      fitAll();
    });
  };

  const ro = new ResizeObserver(schedule);
  ro.observe(root);
  fitAll();

  live = { root, chart, applyLayers, fitAll };

  const api = {
    enter() {
      chart.resize();
      fitAll();
      ro.observe(root);
    },
    leave() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
    }
  };
  root.__p3api = api;
  return api;
}

/* ---------------- 自动演出（外部调用，v0.5 起不再自动触发） ---------------- */

export function autoplay(opts) {
  const o = opts || {};
  const speed = Number(o.speed) > 0 ? Number(o.speed) : 1;
  const caption = typeof o.caption === "function" ? o.caption : function () {};
  const s = function (ms) { return ms / speed; };

  if (!live) {
    const host = typeof document !== "undefined" ? document.getElementById("screen-3") : null;
    if (host && !host.querySelector(".screen-inner")) {
      const api = mount(host);
      api.enter();
    }
  }

  const state = live;
  const root = state ? state.root : null;
  const chart = state ? state.chart : null;
  const q = function (sel) { return root ? root.querySelector(sel) : null; };
  const qa = function (sel) {
    return root ? Array.prototype.slice.call(root.querySelectorAll(sel)) : [];
  };

  let stopped = false;
  let settled = false;
  let resolveDone;
  const done = new Promise(function (r) { resolveDone = r; });
  const timers = new Set();
  const releases = new Set();

  const settle = function () {
    if (settled) return;
    settled = true;
    resolveDone();
  };

  const wait = function (ms) {
    return new Promise(function (res) {
      const release = function () { releases.delete(release); res(); };
      releases.add(release);
      const id = setTimeout(function () { timers.delete(id); release(); }, Math.max(0, s(ms)));
      timers.add(id);
    });
  };

  const tween = function (ms, fn) {
    return new Promise(function (res) {
      const dur = Math.max(16, s(ms));
      const t0 = performance.now();
      const release = function () { releases.delete(release); res(); };
      releases.add(release);
      let id = 0;
      const step = function () {
        if (stopped) { release(); return; }
        const p = Math.min(1, (performance.now() - t0) / dur);
        fn(p);
        if (p < 1) { id = setTimeout(step, 16); timers.add(id); }
        else { timers.delete(id); release(); }
      };
      fn(0);
      id = setTimeout(step, 16);
      timers.add(id);
    });
  };

  const reset = function () {
    timers.forEach(function (id) { clearTimeout(id); });
    timers.clear();
    const open = Array.prototype.slice.call(releases);
    releases.clear();
    open.forEach(function (fn) { try { fn(); } catch (e) { /* noop */ } });
    if (root) {
      root.classList.remove("p3-play", "p3-dim");
      qa(".p3-wipe").forEach(function (el) { el.classList.remove("p3-wipe"); });
      qa(".p3-lit").forEach(function (el) { el.classList.remove("p3-lit"); });
      qa(".p3-spot").forEach(function (el) { el.classList.remove("p3-spot"); });
    }
    if (state && state.applyLayers) state.applyLayers({ d2: true, d5: true, delta: true });
    if (chart) {
      chart.setProgress(1);
      if (chart.resize) chart.resize();
    }
  };

  const stop = function () {
    if (stopped) { settle(); return; }
    stopped = true;
    reset();
    settle();
  };

  const spot = function (key) {
    qa(".p3-row").forEach(function (row) {
      row.classList.toggle("p3-spot", row.getAttribute("data-k") === key);
    });
  };

  const lit = function (sel, key) {
    qa(sel).forEach(function (el) {
      if (!key || el.getAttribute("data-k") === key) el.classList.add("p3-lit");
    });
  };

  let lastCaption = null;
  const say = function (text) {
    if (stopped || text === lastCaption) return;
    lastCaption = text;
    caption(text);
  };

  const run = async function () {
    if (!state || !chart) { settle(); return; }
    if (chart.resize) chart.resize();
    if (state.fitAll) state.fitAll();
    root.classList.add("p3-play");
    if (state.applyLayers) state.applyLayers({ d2: true, d5: true, delta: true });
    chart.setProgress(1);
    await wait(140);

    if (stopped) return;
    say("单蛋谱 T(λ)：340–1020 nm，1 nm 步长，681 点");
    if (state.applyLayers) state.applyLayers({ d2: true, d5: false, delta: false });
    chart.setProgress(0);
    await tween(1100, function (p) { chart.setProgress(p); });

    if (stopped) return;
    say("同一枚蛋 D5 再采一次 —— 两次之差就是 ΔS");
    if (state.applyLayers) state.applyLayers({ d2: true, d5: true, delta: false });
    chart.setProgress(0);
    await tween(900, function (p) { chart.setProgress(p); });
    if (stopped) return;
    if (state.applyLayers) state.applyLayers({ d2: true, d5: true, delta: true });
    chart.setProgress(0);
    await tween(900, function (p) { chart.setProgress(p); });

    if (stopped) return;
    say("单日初筛：D5 最强（AUC 0.857），D2 次之（0.786）");
    const bars = q("#p3-bars svg");
    if (bars) bars.classList.add("p3-wipe");
    await wait(1000);
    if (stopped) return;
    root.classList.add("p3-dim");
    spot("D5");
    await wait(1100);

    if (stopped) return;
    say("双日 D2+D5 把 AUC 顶到 0.951，比 D5 单日高 0.094");
    spot("D2+D5");
    await wait(1100);
    if (stopped) return;
    root.classList.remove("p3-dim");
    qa(".p3-row").forEach(function (row) { row.classList.remove("p3-spot"); });

    say("DSSF-Net：双流各 3 个残差块 → 128 维，ΔS 与 R 走 MLP，打分器加权融合");
    const mods = ["in", "enc", "mlp", "proj", "score", "soft", "z", "out"];
    for (let i = 0; i < mods.length; i++) {
      if (stopped) return;
      lit(".p3-mod", mods[i]);
      await wait(300);
    }
    await wait(300);

    if (stopped) return;
    say("消融逐项加回：0.884 → 0.891 → 0.903 → 0.909 → 0.915");
    const rows = qa(".p3-abl-row");
    for (let i = 0; i < rows.length; i++) {
      if (stopped) return;
      rows[i].classList.add("p3-lit");
      await wait(470);
    }
    await wait(260);

    if (stopped) return;
    say("CARS / SPA 反查收到 594–620 与 660–675 nm；正式模型仍用全谱");
    const hots = qa(".p3-hot");
    for (let i = 0; i < hots.length; i++) {
      if (stopped) return;
      hots[i].classList.add("p3-lit");
      await wait(120);
    }
    await wait(420);

    if (stopped) return;
    reset();
    settle();
  };

  run();

  return { done: done, stop: stop };
}
