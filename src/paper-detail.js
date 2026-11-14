// 论文细则数据层（P2 流程 / P3 光谱 / P4 结果共用）。
// 唯一来源：文档\\论文工艺流程提取.md（Animals 2026, 16, 2796 的逐工序提取）。
// 规矩：这里只放论文写明的数字；论文没给的不补、不猜、不插值。

export const INCUBATION = {
  species: "坝上长尾鸡 · 粉壳受精蛋",
  perBatch: 600,
  batches: 4,
  tempC: [37.8, 0.1],
  rh: [60, 65],
  rhLate: [65, 70],
  turningEveryH: 2,
  stopTurningDay: 18,
  incubator: "HC-1056A 自动孵化器（Liucan，德州）",
  disinfectant: "0.005% 苯扎溴铵（5% 母液 1:1000）"
};

export const ACQUISITION = {
  mode: "透射（卤钨灯在蛋下方，相机在上方）",
  bluntEndUp: true,
  lensToEggCm: 30,
  wavelength: [340, 1020],
  stepNm: 1,
  points: 681,
  resolutionNm: 2.8,
  exposureMs: 890,
  framesPerPoint: 3,
  integrationS: 2.67,
  intervalH: 12,
  timepointsPerEgg: 14,
  secondsPerEgg: 12.5,
  batchSession: "≈2 h 20 min / 600 枚 / 2 名操作员",
  offIncubatorMin: 1,
  lampWarmupMin: 30,
  recalibrateMin: 30,
  parts: [
    { role: "相机", model: "ICL-B1620 CCD（Imperx）" },
    { role: "光谱传感器", model: "T3 微型复合光谱（道火者）" },
    { role: "镜头", model: "Z118M0736C6M（玉路发）" },
    { role: "光源", model: "150 W 卤钨灯（飞利浦）" },
    { role: "采集电脑", model: "ThinkStation P620" }
  ]
};

// 14 个采样点：D1–D7 每天 2 次（间隔 12 h）。
export const SAMPLING_POINTS = Array.from({ length: 14 }, (_, i) => ({
  index: i,
  day: Math.floor(i / 2) + 1,
  slot: i % 2 === 0 ? "上午" : "下午",
  hours: i * 12
}));

export const DAYS = [1, 2, 3, 4, 5, 6, 7];

// P9 关键日初筛：论文正文列出的方案（21 组双日只公开了 3 组数值，其余不补）。
export const SCREENING = {
  single: [
    { id: "D2", acc: 0.675, auc: 0.786, f1: 0.674, note: "单日次优" },
    { id: "D5", acc: 0.78, auc: 0.857, f1: 0.781, note: "单日最优" }
  ],
  dual: [
    { id: "D2+D5", acc: 0.885, auc: 0.951, f1: 0.886, note: "21 组双日最优" },
    { id: "D3+D5", acc: null, auc: 0.855, f1: null, note: "论文仅给 AUC" },
    { id: "D1+D5", acc: null, auc: 0.855, f1: null, note: "论文仅给 AUC" }
  ],
  multi: [
    { id: "D2+D5+D6", days: 3, acc: 0.88, auc: 0.95, f1: 0.882 },
    { id: "D2+D3+D5+D6", days: 4, acc: 0.875, auc: 0.938, f1: 0.876 },
    { id: "D1–D5", days: 5, acc: 0.87, auc: 0.92, f1: 0.871 },
    { id: "D1–D6", days: 6, acc: 0.862, auc: 0.912, f1: 0.863 },
    { id: "D1–D7", days: 7, acc: 0.855, auc: 0.905, f1: 0.856 }
  ],
  delta: [
    { id: "ΔS 单独", acc: null, auc: 0.962, f1: null },
    { id: "R 单独", acc: 0.895, auc: null, f1: 0.896 },
    { id: "四支融合", acc: null, auc: 0.965, f1: null }
  ],
  gainFromD2: { acc: 0.105, auc: 0.094, f1: 0.105 }
};

// P12/P17 三段验证口径（对外必须分开说，禁止混引）。
export const SCORES = {
  cv: { label: "统一 5 折 · 1400 枚", acc: 0.915, accSd: 0.015, auc: 0.974, aucSd: 0.012, f1: 0.915, f1Sd: 0.014 },
  holdout: {
    label: "固定留出 · 200 枚",
    n: 200,
    acc: 0.915,
    auc: 0.966,
    aucCI: [0.94, 0.987],
    confusion: { tn: 92, fp: 8, fn: 9, tp: 91 },
    sensitivity: 0.91,
    specificity: 0.92
  },
  lobo: { label: "留一批次 LOB · 4 轮", acc: 0.846, accSd: 0.014, auc: 0.926, aucSd: 0.012 }
};

// 顺序消融（同一 5 折，逐项加结构）。
export const ABLATION = [
  { id: "D2+D5 直接拼接", acc: 0.884, accSd: 0.021, auc: 0.951, aucSd: 0.017, precision: 0.885, precisionSd: 0.02 },
  { id: "+ 双流编码器", acc: 0.891, accSd: 0.019, auc: 0.958, aucSd: 0.015, precision: 0.893, precisionSd: 0.018 },
  { id: "+ 差谱 ΔS", acc: 0.903, accSd: 0.017, auc: 0.966, aucSd: 0.014, precision: 0.905, precisionSd: 0.016 },
  { id: "+ 变化率 R", acc: 0.909, accSd: 0.016, auc: 0.970, aucSd: 0.013, precision: 0.911, precisionSd: 0.015 },
  { id: "DSSF-Net 完整", acc: 0.915, accSd: 0.015, auc: 0.974, aucSd: 0.012, precision: 0.916, precisionSd: 0.016 }
];

export const NETWORK = {
  encoders: "3 × 残差 Conv1D 块（32/64/128 通道，核 7/5/3；Conv1D→BN→ReLU→MaxPool2）+ 1×1 卷积捷径 + 自适应全局平均池化",
  mlp: "681→256→128（ReLU + Dropout 0.3）",
  attention: "共享打分器 128→64→1 → 4 个标量 → 单个 Softmax → 加权和 z∈R¹²⁸ → FC 128→2 → Softmax",
  params: { encoders: 92416, mlps: 414976, total: 515971 },
  baselines: [
    { id: "1D-CNN", params: 36642 },
    { id: "BiLSTM", params: 135426 },
    { id: "Transformer Encoder", params: 265858 },
    { id: "DSSF-Net", params: 515971 }
  ],
  training: [
    ["框架", "Python 3.7.6 + PyTorch 1.13.1"],
    ["优化器", "Adam，lr 1e-3，wd 1e-4"],
    ["批大小", "32"],
    ["最大 epoch", "200，早停 patience 20"],
    ["Dropout", "0.3"],
    ["随机种子", "42"],
    ["学习率调度", "factor 0.5，patience 8"],
    ["阈值", "0.5 预设，不在任何评估集上优化"]
  ]
};

export const WAVELENGTH = {
  rows: [
    { id: "全谱", points: "681", acc: 0.915, auc: 0.974, f1: 0.915, sd: true },
    { id: "CARS", points: "24.0 ± 1.6（≈3.5%）", acc: 0.909, auc: 0.968, f1: 0.909, sd: true },
    { id: "SPA", points: "12.0 ± 0.7（≈1.8%）", acc: 0.9, auc: 0.961, f1: 0.9, sd: true },
    { id: "随机 k（对齐 CARS）", points: "同维数", acc: 0.874, auc: 0.928, f1: 0.873, sd: true },
    { id: "随机 k（对齐 SPA）", points: "同维数", acc: 0.852, auc: 0.906, f1: 0.851, sd: true }
  ],
  // 5 折里入选频率高的点位（CARS 次数 / SPA 次数）
  hot: [
    { nm: 594, cars: 5, spa: 4 }, { nm: 602, cars: 4, spa: 4 }, { nm: 610, cars: 5, spa: 4 },
    { nm: 615, cars: 5, spa: 5 }, { nm: 620, cars: 5, spa: 5 },
    { nm: 660, cars: 4, spa: 4 }, { nm: 668, cars: 5, spa: 5 }, { nm: 671, cars: 5, spa: 5 }, { nm: 675, cars: 4, spa: 4 }
  ],
  minor: [434, 575, 780],
  bands: [[594, 620], [660, 675]],
  focusBand: [510, 755]
};

// P15 产量与平衡（每批入孵 600）。
export const BATCHES = [
  { id: "B1", infertile: 60, dead: 30, unhatched: 10, hatched: 500, fertile: 540, hatchRate: 0.926, malePre: 241, femalePre: 254, droppedSpectrum: 3, droppedLabel: 2 },
  { id: "B2", infertile: 54, dead: 27, unhatched: 12, hatched: 507, fertile: 546, hatchRate: 0.929, malePre: 261, femalePre: 243, droppedSpectrum: 2, droppedLabel: 1 },
  { id: "B3", infertile: 66, dead: 33, unhatched: 11, hatched: 490, fertile: 534, hatchRate: 0.918, malePre: 235, femalePre: 250, droppedSpectrum: 3, droppedLabel: 2 },
  { id: "B4", infertile: 48, dead: 25, unhatched: 9, hatched: 518, fertile: 552, hatchRate: 0.938, malePre: 266, femalePre: 249, droppedSpectrum: 2, droppedLabel: 1 }
];

export const GATES = [
  { id: "G1", name: "关键日", when: "初筛 · 固定 SVM 验证集 AUC", verdict: "单日 D5 最优；21 组双日 D2+D5 最优（0.951）；继续加天无增益", value: "D2 + D5" },
  { id: "G2", name: "输入方案", when: "初筛 · 变化量是否带来增量", verdict: "D2 + D5 + ΔS + R 四支融合（0.965），判定时点仍在 D5", value: "4 支" },
  { id: "G3", name: "模型定稿", when: "5 折 + 内评集 ACC/AUC/F1", verdict: "DSSF-Net 胜出后冻结结构与超参，1400 枚全量重训", value: "DSSF-Net" },
  { id: "G4", name: "泛化确认", when: "200 枚留出 + 4 轮留一批次", verdict: "留出 0.915 / 0.966；跨批 0.846 / 0.926", value: "只评一次" }
];

export const LEAK_RULES = [
  "蛋号级划分：同蛋多日谱与派生特征永远同侧",
  "μ/σ 只来自训练侧（训练集或训练折）",
  "留出集与外部批次不参与任何选择：日、特征、超参、早停、阈值、模型",
  "阈值 0.5 预设，不在任何评估集上优化",
  "外部批次每轮只在模型定稿后评一次"
];

export const LIMITS = [
  "无同期场区数据、无孵化器对照、无“少操作”对照组，孵化率不能证明测量操作无影响。",
  "仅坝上长尾鸡粉壳蛋；未跨品种、跨壳色、跨孵化场、跨设备验证。",
  "测量顺序与箱内位置未随机化：单次采集 2.3 h，首末蛋存在发育时间差与仪器漂移。",
  "未做参数量匹配对照，性能提升不能完全归因于特征表示与融合结构。",
  "候选波段是模型推导区间，不是生物学机制结论；采样 1 nm 但实际分辨率≈2.8 nm。",
  "商业应用前仍需跨品种、壳色、孵化场、设备的系统验证。"
];

// 展示用：把 0.974 永远标成“五折 AUC”。
export const METRIC_NOTES = {
  auc: "0.974 是五折 AUC，不是准确率；留出集准确率 0.915、跨批次 0.846 不可与它混引。",
  band: "594–620 / 660–675 nm 是模型推导的候选区间，不是吸收峰或生物学机制。",
  hatch: "无同期场区与对照组数据，孵化率不能用于声称操作对胚胎无影响。"
};
