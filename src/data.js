// 数据层：光谱曲线、论文指标、推理适配。
// 默认连本机 mock 服务；服务不可用时回退本地演示桩，并在结果卡明确标注。
export const SPECTRAL = { min: 340, max: 1020, step: 1, points: 681 };

// 论文 Animals 2026, 16, 2796 的三套口径，分开存放，禁止混用。
export const PAPER = {
  holdout: {
    n: 200,
    accuracy: 0.915,
    accuracyCI: [0.868, 0.946],
    auc: 0.966,
    aucCI: [0.94, 0.987],
    sensitivity: 0.91,
    specificity: 0.92,
    ppv: 0.919,
    npv: 0.911,
    confusion: { tn: 92, fp: 8, fn: 9, tp: 91 }
  },
  cv: { accuracy: 0.915, accuracySd: 0.015, auc: 0.974, aucSd: 0.012 },
  lobo: { accuracy: 0.846, accuracySd: 0.014, auc: 0.926, aucSd: 0.012 },
  configurations: [
    { name: "D5-only", accuracy: 0.79, auc: 0.865 },
    { name: "D2 + D5", accuracy: 0.875, auc: 0.943 },
    { name: "D2 + D5 + ΔS + R（非注意力融合）", accuracy: 0.905, auc: 0.96 },
    { name: "Full DSSF-Net（stage-aware attention）", accuracy: 0.915, auc: 0.966 }
  ]
};

export const PAPER_REFERENCE = {
  five_fold: { accuracy: PAPER.cv.accuracy, accuracy_sd: PAPER.cv.accuracySd, auc: PAPER.cv.auc, auc_sd: PAPER.cv.aucSd },
  holdout_test: {
    accuracy: PAPER.holdout.accuracy,
    accuracy_ci95: PAPER.holdout.accuracyCI,
    auc: PAPER.holdout.auc,
    auc_ci95: PAPER.holdout.aucCI,
    n: PAPER.holdout.n
  },
  leave_one_batch_out: {
    accuracy: PAPER.lobo.accuracy,
    accuracy_sd: PAPER.lobo.accuracySd,
    auc: PAPER.lobo.auc,
    auc_sd: PAPER.lobo.aucSd
  }
};

// 本机开发直连 8000；同源部署（nginx 反代）走相对路径；?api= 可覆盖。
const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
const API_OVERRIDE = params?.get("api");
export const API_ORIGIN = API_OVERRIDE
  ? API_OVERRIDE.replace(/\/+$/, "")
  : typeof window !== "undefined" &&
    (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")
  ? "http://127.0.0.1:8000"
  : "";

let _wl = null;
export function wavelengths() {
  if (!_wl) {
    _wl = new Float32Array(SPECTRAL.points);
    for (let i = 0; i < SPECTRAL.points; i += 1) _wl[i] = SPECTRAL.min + i * SPECTRAL.step;
  }
  return _wl;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const gauss = (x, mu, sigma) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
const fract = (x) => x - Math.floor(x);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 形状按论文 Figure 1 的透射谱示意：400 nm 起升，600–750 nm 平台，950 nm 附近水吸收下凹，末端滚降。
function spectrum(day, sex, seed) {
  const wl = wavelengths();
  const out = new Float32Array(wl.length);
  const rand = mulberry32(seed ^ (day * 0x9e3779b1));
  const dayBias = day >= 5 ? 1 : -1;
  const sexBias = sex === "female" ? 1 : -1;

  for (let i = 0; i < wl.length; i += 1) {
    const l = wl[i];
    let t = 0.015;
    t += 0.42 / (1 + Math.exp(-(l - 405) / 26));
    t += 0.34 * gauss(l, 610, 95);
    t += 0.26 * gauss(l, 735, 120);
    t += 0.12 * gauss(l, 870, 70);
    t -= 0.1 * gauss(l, 950, 45);
    t -= 0.1 / (1 + Math.exp(-(l - 1000) / 18));
    t += dayBias * (0.01 * gauss(l, 650, 90) - 0.007 * gauss(l, 520, 55));
    t += sexBias * 0.006 * gauss(l, 665, 80);
    t += (rand() - 0.5) * 0.005;
    t += 0.0012 * Math.sin(l / 9 + seed * 0.01);
    out[i] = clamp(t, 0.02, 0.98);
  }
  return out;
}

export function buildSample(seed = 20261108) {
  const sex = seed % 2 === 0 ? "female" : "male";
  const d2 = spectrum(2, sex, seed);
  const d5 = spectrum(5, sex, seed);
  const delta = new Float32Array(d2.length);
  for (let i = 0; i < d2.length; i += 1) delta[i] = d5[i] - d2[i];
  return { seed, sex, d2, d5, delta };
}

function localPredict(sample, mode, err) {
  if (mode === "paper") {
    return {
      pMale: null,
      pFemale: null,
      confidence: null,
      label: null,
      source: "paper",
      note: "后端未连接：按规范只展示论文值，不输出逐蛋判定。",
      paper: PAPER_REFERENCE,
      offline: true
    };
  }
  // 演示桩：用 seed 派生一个稳定的“模型分数”，标签与曲线一致，准确率约 93%。
  const r = fract(Math.sin(sample.seed * 12.9898) * 43758.5453);
  const correct = r < 0.93;
  const isMale = sample.sex === "male" ? correct : !correct;
  const strength = 0.18 + r * 0.24;
  const pMale = isMale ? 0.5 + strength : 0.5 - strength;
  const reason = err?.name === "AbortError" ? "请求超时" : "服务不可用";
  return {
    pMale: clamp(pMale, 0.04, 0.96),
    pFemale: 1 - clamp(pMale, 0.04, 0.96),
    confidence: Math.max(pMale, 1 - pMale),
    label: pMale >= 0.5 ? "male" : "female",
    source: "demo",
    note: `本地演示桩（后端未连接）：仅用于界面演示，非论文权重。`,
    paper: PAPER_REFERENCE,
    offline: true
  };
}

/**
 * 调后端推理。失败时回退本地演示桩，返回值结构保持一致。
 * @param {ReturnType<typeof buildSample>} sample
 * @param {{ mode?: "demo"|"model"|"paper", delay?: number }} options
 */
export async function predict(sample, options = {}) {
  const { mode = "demo", delay = 0 } = options;
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`${API_ORIGIN}/api/predict?mode=${encodeURIComponent(mode)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        d2: Array.from(sample.d2),
        d5: Array.from(sample.d5)
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      pMale: Number.isFinite(data.prob_male) ? data.prob_male : null,
      pFemale: Number.isFinite(data.prob_female) ? data.prob_female : null,
      confidence: Number.isFinite(data.confidence) ? data.confidence : null,
      label: data.label || null,
      source: data.source || mode,
      note: data.note || "",
      paper: data.paper_reference || PAPER_REFERENCE,
      eggId: data.egg_id || null,
      offline: false
    };
  } catch (err) {
    return localPredict(sample, mode, err);
  } finally {
    clearTimeout(timer);
  }
}

export const pct = (v, digits = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : "—");
