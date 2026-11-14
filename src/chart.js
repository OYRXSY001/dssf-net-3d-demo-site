import { SPECTRAL } from "./data.js";

const C = {
  d2: "#0f9e8f",
  d5: "#3d7bfd",
  delta: "#c98a1f",
  grid: "rgba(16,24,40,0.07)",
  gridStrong: "rgba(16,24,40,0.14)",
  axis: "#8b94a3",
  text: "#5b6575"
};

const MONO = '"JetBrains Mono","Cascadia Mono",Consolas,monospace';

export class SpectrumChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sample = null;
    this.layers = { d2: true, d5: true, delta: true };
    this.progress = 1;
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas);
    this.resize();
  }

  setSample(sample) {
    this.sample = sample;
    this.draw();
  }

  setLayers(layers) {
    this.layers = { ...this.layers, ...layers };
    this.draw();
  }

  setProgress(progress) {
    this.progress = progress;
    this.draw();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(10, rect.width);
    this.h = Math.max(10, rect.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  draw() {
    const { ctx, w, h, sample } = this;
    if (!ctx || !w || !h) return;
    ctx.clearRect(0, 0, w, h);
    if (!sample) return;

    const padL = 34;
    const padR = 6;
    const padT = 8;
    const axisH = 16;
    const gap = 8;
    const showDelta = this.layers.delta;
    const deltaH = showDelta ? 40 : 0;
    const mainH = Math.max(50, h - padT - 4 - axisH - (showDelta ? deltaH + gap : 0));
    const plot = { x: padL, y: padT, w: w - padL - padR, h: mainH };

    const X = (l) => plot.x + ((l - SPECTRAL.min) / (SPECTRAL.max - SPECTRAL.min)) * plot.w;
    const Y = (t) => plot.y + (1 - t) * plot.h;

    ctx.font = `10px ${MONO}`;
    ctx.lineWidth = 1;

    // 主图网格
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
      const y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = v === 0 ? C.gridStrong : C.grid;
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.w, y);
      ctx.stroke();
    });

    // 波长刻度
    [400, 600, 800, 1000].forEach((l) => {
      const x = Math.round(X(l)) + 0.5;
      ctx.strokeStyle = C.grid;
      ctx.beginPath();
      ctx.moveTo(x, plot.y);
      ctx.lineTo(x, plot.y + plot.h);
      ctx.stroke();
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.x, plot.y - 2, plot.w, plot.h + 4);
    ctx.clip();

    if (this.layers.d2) this._curve(ctx, sample.d2, X, Y, C.d2, 1.6, null);
    if (this.layers.d5) this._curve(ctx, sample.d5, X, Y, C.d5, 1.5, [5, 4]);
    this._head(ctx, sample, X, Y);

    ctx.restore();

    // Y 轴标签
    ctx.fillStyle = C.axis;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    [1, 0.5, 0].forEach((v) => ctx.fillText(v.toFixed(1), plot.x - 6, Y(v)));

    // X 轴标签
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const labelY = showDelta ? h - 12 : h - 12;
    [400, 600, 800, 1000].forEach((l) => ctx.fillText(String(l), X(l), labelY));

    if (!showDelta) return;

    // ΔS 子图
    const dTop = plot.y + plot.h + gap;
    const zero = dTop + deltaH / 2;
    let maxAbs = 0.012;
    for (let i = 0; i < sample.delta.length; i += 1) maxAbs = Math.max(maxAbs, Math.abs(sample.delta[i]));
    maxAbs *= 1.15;
    const dY = (v) => zero - (v / maxAbs) * (deltaH / 2 - 3);

    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = "rgba(16,24,40,0.16)";
    ctx.beginPath();
    ctx.moveTo(plot.x, Math.round(zero) + 0.5);
    ctx.lineTo(plot.x + plot.w, Math.round(zero) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    const n = Math.max(2, Math.round(sample.delta.length * this.progress));
    ctx.beginPath();
    ctx.moveTo(X(SPECTRAL.min), zero);
    for (let i = 0; i < n; i += 1) ctx.lineTo(X(SPECTRAL.min + i), dY(sample.delta[i]));
    ctx.lineTo(X(SPECTRAL.min + n - 1), zero);
    ctx.closePath();
    ctx.fillStyle = "rgba(201,138,31,0.14)";
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const x = X(SPECTRAL.min + i);
      const y = dY(sample.delta[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = C.delta;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = C.axis;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("ΔS", plot.x - 6, dTop - 1);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("+", plot.x - 6, dTop + 6);
    ctx.fillText("−", plot.x - 6, dTop + deltaH - 6);
  }

  _curve(ctx, values, X, Y, color, width, dash) {
    const n = Math.max(2, Math.round(values.length * this.progress));
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const x = X(SPECTRAL.min + i);
      const y = Y(values[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (dash) ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }

  _head(ctx, sample, X, Y) {
    if (this.progress >= 1) return;
    const i = Math.max(0, Math.min(sample.d2.length - 1, Math.round((sample.d2.length - 1) * this.progress)));
    const x = X(SPECTRAL.min + i);
    const y = Y(sample.d2[i]);
    ctx.save();
    ctx.shadowColor = C.d2;
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// 3D 采集计算机屏幕贴图（512×320）
export function drawMonitor(ctx, W, H, sample, progress = 1) {
  const s = W / 512;
  ctx.save();
  ctx.scale(s, s);
  const w = 512;
  const h = 320;

  ctx.fillStyle = "#070d1b";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(53,224,200,0.9)";
  ctx.fillRect(0, 0, 3, h);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e8f1ff";
  ctx.font = `600 19px ${MONO}`;
  ctx.fillText("TRANSMITTANCE  T(λ)", 20, 32);

  ctx.fillStyle = "#7f8ea8";
  ctx.font = `10px ${MONO}`;
  ctx.fillText("VIS–NIR · 340–1020 nm · 681 pts · 1 nm step", 20, 50);

  const p = { x: 46, y: 70, w: 440, h: 180 };
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = Math.round(p.y + (p.h / 4) * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(p.x, y);
    ctx.lineTo(p.x + p.w, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 4; i += 1) {
    const x = Math.round(p.x + (p.w / 4) * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, p.y);
    ctx.lineTo(x, p.y + p.h);
    ctx.stroke();
  }

  const X = (l) => p.x + ((l - 340) / 680) * p.w;
  const Y = (t) => p.y + (1 - t) * p.h;

  const drawCurve = (values, color, dash, width) => {
    const n = Math.max(2, Math.round(values.length * progress));
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const x = X(340 + i);
      const y = Y(values[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (dash) ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(p.x, p.y, p.w, p.h);
  ctx.clip();
  drawCurve(sample.d5, "#4C9AFF", [6, 5], 1.6);
  drawCurve(sample.d2, "#35E0C8", null, 1.8);
  if (progress < 1) {
    const i = Math.round(680 * progress);
    const x = X(340 + i);
    ctx.save();
    ctx.shadowColor = "#35E0C8";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#d8fff9";
    ctx.beginPath();
    ctx.arc(x, Y(sample.d2[i]), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(53,224,200,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, p.y);
    ctx.lineTo(x, p.y + p.h);
    ctx.stroke();
  }
  ctx.restore();

  // 轴标签
  ctx.fillStyle = "#6C7A93";
  ctx.font = `9px ${MONO}`;
  [400, 600, 800, 1000].forEach((l) => {
    ctx.textAlign = "center";
    ctx.fillText(String(l), X(l), p.y + p.h + 14);
  });
  ctx.textAlign = "right";
  ctx.fillText("1.0", p.x - 6, p.y + 4);
  ctx.fillText("0.0", p.x - 6, p.y + p.h + 4);

  // 图例与状态
  ctx.textAlign = "left";
  ctx.fillStyle = "#35E0C8";
  ctx.fillRect(20, 282, 14, 2);
  ctx.fillStyle = "#A8B3C7";
  ctx.font = `10px ${MONO}`;
  ctx.fillText("D2", 42, 287);
  ctx.fillStyle = "#4C9AFF";
  ctx.fillRect(74, 282, 14, 2);
  ctx.fillStyle = "#A8B3C7";
  ctx.fillText("D5", 96, 287);
  ctx.fillStyle = "#FFC857";
  ctx.fillRect(128, 282, 14, 2);
  ctx.fillStyle = "#A8B3C7";
  ctx.fillText("ΔS", 150, 287);

  ctx.fillStyle = "#6C7A93";
  ctx.font = `9px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText("EXPOSURE 890 ms × 3", 490, 287);

  // 状态灯
  ctx.fillStyle = progress >= 1 ? "#35E0C8" : "#FFC857";
  ctx.beginPath();
  ctx.arc(490, 28, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6C7A93";
  ctx.font = `9px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(progress >= 1 ? "IDLE" : "ACQUIRING", 480, 31);

  ctx.restore();
}
