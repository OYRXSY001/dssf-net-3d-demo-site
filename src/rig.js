import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createMaterials } from "./materials.js";

export const ACCENT = 0x0f9e8f;

const C = {
  accent: 0x0f9e8f,
  accentSoft: 0x35c9b4,
  metal: 0xaeb8c7,
  warm: 0xffb36b,
  graphite: 0x3b4149
};

const M = createMaterials();

/* 冷蓝色相统一压成中性石墨/铝灰：浅色影棚里配件带蓝味会显得像示意图 */
function neutral(color) {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const deg = hsl.h * 360;
  if (deg > 168 && deg < 272 && hsl.s > 0.04) {
    hsl.s *= 0.14;
    return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
  }
  return c;
}

/* ---------------- 基础工具 ---------------- */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function rbox(w, h, d, r = 0.3) {
  return new RoundedBoxGeometry(w, h, d, 2, Math.max(0.02, Math.min(r, Math.min(w, h, d) / 2 - 0.02)));
}

function cyl(rt, rb, h, seg = 40, open = false) {
  return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
}

function mesh(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function flat(m) {
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

const matMetal = (color = 0xaeb8c7, roughness = 0.34, metalness = 0.88) =>
  M.metal({ color: neutral(color), roughness: Math.min(0.82, roughness * 1.04), metalness });

const matPlastic = (color = 0xdde5f0, roughness = 0.48) =>
  M.paint({ color: neutral(color), roughness: Math.min(0.78, roughness * 0.8) });

const matDark = (color = 0x18202f, roughness = 0.45, metalness = 0.55) =>
  M.darkMetal({ color: neutral(color), roughness: Math.min(0.9, roughness * 1.12), metalness });

function canvasTexture(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------------- 程序化贴图 ---------------- */

function makeEggTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#f3ded6");
    g.addColorStop(0.5, "#eccfc6");
    g.addColorStop(1, "#dfb8ad");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    let s = 1234567;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < 3200; i += 1) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 0.5 + rnd() * 3.4;
      const a = 0.06 + rnd() * 0.14;
      ctx.fillStyle = `rgba(${110 + (rnd() * 50) | 0},${74 + (rnd() * 36) | 0},${64 + (rnd() * 30) | 0},${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 蛋壳纵向细纹
    for (let i = 0; i < 26; i += 1) {
      const x = rnd() * w;
      ctx.strokeStyle = `rgba(150,110,100,${0.02 + rnd() * 0.04})`;
      ctx.lineWidth = 0.6 + rnd() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, rnd() * h * 0.4);
      ctx.bezierCurveTo(x + 18, h * 0.4, x - 22, h * 0.7, x + 6, h);
      ctx.stroke();
    }
  });
}

function makePanelTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#070d13";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(53,224,200,0.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.fillStyle = "#eaf4f9";
    ctx.font = '600 27px "Noto Sans SC", "Segoe UI", sans-serif';
    ctx.fillText("T3 光谱引擎", 24, 46);
    ctx.fillStyle = "rgba(53,224,200,0.8)";
    ctx.fillRect(24, 58, 46, 3);
    ctx.fillStyle = "#6c7a93";
    ctx.font = '12px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("340–1020 nm · 681 CH · Δλ 1 nm", 24, 82);

    // 光谱条
    const g = ctx.createLinearGradient(24, 0, w - 24, 0);
    g.addColorStop(0, "#3b2a6b");
    g.addColorStop(0.2, "#3d6bff");
    g.addColorStop(0.38, "#22c9d8");
    g.addColorStop(0.56, "#54d66b");
    g.addColorStop(0.72, "#e8cf49");
    g.addColorStop(0.86, "#e8873e");
    g.addColorStop(1, "#c94242");
    ctx.fillStyle = g;
    ctx.fillRect(24, 104, w - 48, 10);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    for (let x = 24; x < w - 24; x += 14) ctx.fillRect(x, 114, 1, 5);

    // 谱线
    ctx.strokeStyle = "rgba(225,245,250,0.82)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 24; x <= w - 24; x += 3) {
      const t = (x - 24) / (w - 48);
      const y = 178 - Math.sin(t * Math.PI) * 34 - Math.sin(t * 17) * 3;
      if (x === 24) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "#5c6b7d";
    ctx.font = '10px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("T(λ) LIVE  ·  ICL-B1620 CCD  ·  T3 COMPOUND SENSOR", 24, h - 20);
  });
}

function makeIncubatorTexture() {
  return canvasTexture(512, 640, (ctx, w, h) => {
    // 深色内腔 + 暖光
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#121a20");
    bg.addColorStop(0.45, "#1a2127");
    bg.addColorStop(1, "#0a1014");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h * 0.52, 30, w / 2, h * 0.52, w * 0.86);
    glow.addColorStop(0, "rgba(255,173,98,0.34)");
    glow.addColorStop(0.5, "rgba(255,150,76,0.12)");
    glow.addColorStop(1, "rgba(255,150,76,0.02)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // 三条托盘 + 蛋
    const rows = [232, 366, 500];
    rows.forEach((y, r) => {
      // 托盘
      const shelf = ctx.createLinearGradient(0, y - 10, 0, y + 14);
      shelf.addColorStop(0, "rgba(210,225,234,0.30)");
      shelf.addColorStop(1, "rgba(120,140,154,0.16)");
      ctx.fillStyle = shelf;
      ctx.fillRect(30, y + 2, w - 60, 9);
      ctx.strokeStyle = "rgba(235,247,252,0.22)";
      ctx.lineWidth = 1;
      ctx.strokeRect(30, y + 2, w - 60, 9);
      for (let c = 0; c < 4; c += 1) {
        const x = 100 + c * 104 + (r % 2) * 10;
        const ry = 34;
        const rx = 23;
        const eg = ctx.createRadialGradient(x - 6, y - 12, 2, x, y - 6, ry + 8);
        eg.addColorStop(0, "rgba(250,231,201,0.9)");
        eg.addColorStop(0.55, "rgba(220,180,138,0.78)");
        eg.addColorStop(1, "rgba(132,96,68,0.6)");
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.ellipse(x, y - 20, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,236,210,0.34)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // 蛋的高光
        ctx.fillStyle = "rgba(255,246,230,0.26)";
        ctx.beginPath();
        ctx.ellipse(x - 7, y - 30, 5, 7, -0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 顶部数字屏
    ctx.fillStyle = "rgba(6,12,16,0.9)";
    ctx.fillRect(150, 40, 212, 62);
    ctx.strokeStyle = "rgba(53,224,200,0.42)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(150, 40, 212, 62);
    ctx.fillStyle = "#5cebd7";
    ctx.font = '600 30px "JetBrains Mono", Consolas, monospace';
    ctx.textAlign = "center";
    ctx.fillText("37.8°C", 256, 78);
    ctx.fillStyle = "rgba(214,234,245,0.6)";
    ctx.font = '12px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("60–65 %RH · D1–D7", 256, 96);
    ctx.textAlign = "left";

    // 整体压暗，避免正面像一块发光的白板
    ctx.fillStyle = "rgba(6,12,16,0.30)";
    ctx.fillRect(0, 0, w, h);

    // 玻璃反光
    const glass = ctx.createLinearGradient(0, 0, w, h);
    glass.addColorStop(0, "rgba(255,255,255,0.10)");
    glass.addColorStop(0.32, "rgba(255,255,255,0.02)");
    glass.addColorStop(0.55, "rgba(255,255,255,0.00)");
    glass.addColorStop(0.78, "rgba(255,255,255,0.05)");
    glass.addColorStop(1, "rgba(255,255,255,0.00)");
    ctx.fillStyle = glass;
    ctx.fillRect(0, 0, w, h);

    // 四角压暗
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.36)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  });
}

function makeEmitterTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, "#fffdf6");
    g.addColorStop(0.45, "#fff3dc");
    g.addColorStop(0.78, "#ffd9a8");
    g.addColorStop(1, "#c9945c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120,82,42,0.18)";
    ctx.lineWidth = 1;
    [0.24, 0.42, 0.6, 0.78].forEach((r) => {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.5 * r, 0, Math.PI * 2);
      ctx.stroke();
    });
    // 细密的扩散纹
    ctx.strokeStyle = "rgba(120,82,42,0.10)";
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * 14, h / 2 + Math.sin(a) * 14);
      ctx.lineTo(w / 2 + Math.cos(a) * w * 0.46, h / 2 + Math.sin(a) * w * 0.46);
      ctx.stroke();
    }
  });
}

function makeGlowTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,255,255,0.5)");
    g.addColorStop(0.55, "rgba(255,255,255,0.14)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/* ---------------- 装置 ---------------- */

export function createRig(scene, options = {}) {
  const benchLift = Number(options.benchLift) || 0;
  const root = new THREE.Group();
  root.name = "spectral-rig";
  if (benchLift) root.position.y = benchLift;
  scene.add(root);

  const parts = [];
  const pickables = [];
  const glowTex = makeGlowTexture();

  function makePart(meta) {
    const group = new THREE.Group();
    group.name = meta.id;
    root.add(group);
    const anchorNode = new THREE.Object3D();
    anchorNode.position.set(meta.anchor[0], meta.anchor[1], meta.anchor[2]);
    group.add(anchorNode);
    const part = {
      ...meta,
      group,
      anchorNode,
      materials: [],
      meshes: [],
      offsetY: 0,
      baseY: 0,
      anchor: new THREE.Vector3(meta.anchor[0], meta.anchor[1], meta.anchor[2]),
      el: null
    };
    parts.push(part);
    return part;
  }

  /* 台面（非交互）：深色工作台 + 铝制包边 + 铭牌 + 调平脚 */
  const bench = new THREE.Group();
  bench.name = "bench";
  root.add(bench);

  const table = mesh(rbox(120, 2.6, 75, 1.0), matMetal(0x8c98a5, 0.42, 0.55));
  table.position.y = 1.7;
  table.castShadow = true;
  table.receiveShadow = true;
  bench.add(table);

  const benchTopTex = canvasTexture(1024, 640, (ctx, w, h) => {
    ctx.fillStyle = "#323f4b";
    ctx.fillRect(0, 0, w, h);
    let seed = 8128;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 3600; i += 1) {
      const v = rand() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgba(${v},${v},${v},${0.02 + rand() * 0.035})`;
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 1.4, 1 + rand() * 1.4);
    }
    for (let i = 0; i < 16; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 40 + rand() * 160;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rand() > 0.5 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.05)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  const benchTopMat = new THREE.MeshPhysicalMaterial({
    map: benchTopTex,
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.14,
    clearcoat: 0.22,
    clearcoatRoughness: 0.52,
    envMapIntensity: 0.38
  });
  const benchTop = mesh(rbox(116.4, 0.32, 71.4, 0.4), benchTopMat);
  benchTop.position.y = 3.06;
  benchTop.receiveShadow = true;
  bench.add(benchTop);

  const benchBand = mesh(rbox(121.2, 0.55, 76.2, 0.9), matMetal(0xb7c2cc, 0.3, 0.86));
  benchBand.position.y = 2.36;
  benchBand.castShadow = true;
  benchBand.receiveShadow = true;
  bench.add(benchBand);

  // 台架铭牌
  const plateTex = canvasTexture(1024, 144, (ctx, w, h) => {
    ctx.fillStyle = "#0c141b";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = "#e9f2f7";
    ctx.font = '600 44px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("DSSF-NET", 40, 70);
    ctx.fillStyle = "#35e0c8";
    ctx.fillRect(40, 88, 74, 5);
    ctx.fillStyle = "rgba(214,234,245,0.62)";
    ctx.font = '22px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("VIS–NIR TRANSMISSION SPECTROSCOPY · 340–1020 nm", 40, 122);
  });
  const benchPlate = flat(new THREE.Mesh(new THREE.PlaneGeometry(34, 4.76), new THREE.MeshBasicMaterial({ map: plateTex })));
  benchPlate.position.set(-38, 1.7, 38.12);
  bench.add(benchPlate);

  // 调平脚
  const footMat = matDark(0x111820, 0.55, 0.35);
  for (const sx of [-52, 52]) {
    for (const sz of [-31, 31]) {
      const foot = mesh(cyl(2.4, 2.8, 0.9, 24), footMat);
      foot.position.set(sx, 0.45, sz);
      foot.castShadow = false;
      foot.receiveShadow = true;
      bench.add(foot);
    }
  }

  /* 台架立柱：仅在抬到真实 750 mm 台高时出现（世界坐标，1 单位 = 10 mm） */
  if (benchLift > 0) {
    const legMat = matMetal(0x3a465b, 0.42, 0.75);
    const legGeo = new THREE.BoxGeometry(4, benchLift, 4);
    const legs = new THREE.InstancedMesh(legGeo, legMat, 4);
    const legDummy = new THREE.Object3D();
    const inset = new THREE.Vector3(52, 0, 30);
    let li = 0;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        legDummy.position.set(sx * inset.x, benchLift / 2, sz * inset.z);
        legDummy.rotation.set(0, 0, 0);
        legDummy.updateMatrix();
        legs.setMatrixAt(li, legDummy.matrix);
        li += 1;
      }
    }
    legs.instanceMatrix.needsUpdate = true;
    legs.castShadow = false;
    legs.receiveShadow = true;
    legs.name = "bench-legs";
    scene.add(legs);
  }

  /* 光学模块支架（结构件，非交互）：立柱 + 悬臂 + 底座，避免镜头/相机悬空（对照设计图 2） */
  const standMat = matMetal(0x6c7784, 0.36, 0.9);
  const standPost = mesh(rbox(3.4, 92, 3.4, 0.4), standMat);
  standPost.position.set(0, 49, -16);
  standPost.castShadow = true;
  standPost.receiveShadow = true;
  root.add(standPost);

  const standArm = mesh(rbox(2.6, 3, 10.5, 0.35), standMat);
  standArm.position.set(0, 84, -10.75);
  standArm.castShadow = true;
  standArm.receiveShadow = true;
  root.add(standArm);

  // 立柱侧面的刻度条与品牌牌
  const scaleTex = canvasTexture(256, 1024, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(10,18,24,0.92)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(214,238,248,0.32)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 60; i += 1) {
      const y = 20 + i * 16;
      const long = i % 5 === 0;
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(long ? 100 : 70, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(214,238,248,0.55)";
    ctx.font = '18px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("mm", 30, h - 26);
  });
  const scaleStrip = flat(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 54), new THREE.MeshBasicMaterial({ map: scaleTex, transparent: true })));
  scaleStrip.position.set(1.78, 49, -14.27);
  scaleStrip.rotation.y = Math.PI / 2;
  root.add(scaleStrip);

  const standBrandTex = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(10,18,24,0.94)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(235,246,252,0.86)";
    ctx.font = '600 34px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("DSSF · OPTICAL", 20, 52);
    ctx.fillStyle = "rgba(53,224,200,0.9)";
    ctx.fillRect(20, 66, 48, 3);
    ctx.fillStyle = "rgba(190,212,224,0.55)";
    ctx.font = '18px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("VIS–NIR TRANSMISSION RIG", 20, 100);
  });
  const standBrand = flat(new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), new THREE.MeshBasicMaterial({ map: standBrandTex })));
  standBrand.position.set(0, 58, -14.28);
  root.add(standBrand);

  const standBase = mesh(rbox(13, 2.4, 13, 0.5), matDark(0x1a2438, 0.5, 0.5));
  standBase.position.set(0, 4.2, -17);
  standBase.castShadow = false;
  standBase.receiveShadow = true;
  root.add(standBase);

  /* 1 · 卤钨灯 */
  const lampPart = makePart({
    id: "lamp",
    name: "150 W 卤钨灯",
    en: "Halogen light source · Philips",
    short: "卤钨灯",
    anchor: [0, 12.5, 9.4],
    explodeY: -4,
    specs: [
      ["型号", "Philips 15 V / 150 W"],
      ["位置", "蛋下方 · 透射照明"],
      ["预热", "30 min"],
      ["复校", "每 30 min"]
    ],
    note: "卤钨灯输出漂移会直接进入 T(λ)，因此先预热再做白 / 暗参考。"
  });

  const lampBase = mesh(cyl(9.2, 9.6, 2.4, 32), matDark(0x1a2438, 0.5, 0.5));
  lampBase.position.y = 4.2;
  lampPart.group.add(lampBase);

  /* 灯罩是唯一可动件：打开时整段外壳下沉，露出内部灯丝腔，光路起点不动 */
  const lampShell = new THREE.Group();
  lampPart.group.add(lampShell);

  const lampBody = mesh(cyl(8, 8, 7.6, 32), matMetal(0x2b364b, 0.38, 0.86));
  lampBody.position.y = 9.2;
  lampShell.add(lampBody);

  const filamentMat = M.emissive({ color: 0xffcf96, intensity: 2.0 });
  filamentMat.userData.noHighlight = true;
  const filament = flat(new THREE.Mesh(cyl(3.1, 3.1, 4.6, 32, true), filamentMat));
  filament.material.transparent = true;
  filament.material.opacity = 0.55;
  filament.position.y = 10.9;
  lampPart.group.add(filament);

  const lampTop = mesh(cyl(8.6, 8.6, 0.8, 32), matMetal(0x9aa7ba, 0.28, 0.95));
  lampTop.position.y = 13.2;
  lampPart.group.add(lampTop);

  const emitterMat = new THREE.MeshBasicMaterial({ map: makeEmitterTexture(), toneMapped: true });
  emitterMat.userData.noHighlight = true;
  const emitter = mesh(cyl(7, 7, 0.3, 48), emitterMat);
  emitter.position.y = 13.7;
  lampPart.group.add(emitter);

  const vents = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.55, 5.4, 0.55),
    matDark(0x0d1524, 0.55, 0.4),
    24
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 8.02, 9.1, Math.sin(a) * 8.02);
    dummy.rotation.set(0, Math.PI / 2 - a, 0);
    dummy.updateMatrix();
    vents.setMatrixAt(i, dummy.matrix);
  }
  vents.instanceMatrix.needsUpdate = true;
  vents.castShadow = false;
  vents.receiveShadow = true;
  lampShell.add(vents);

  const lampGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffd2a0,
      transparent: true,
      opacity: 0.42,
      blending: THREE.NormalBlending,
      depthWrite: false
    })
  );
  lampGlow.scale.set(20, 20, 1);
  lampGlow.position.set(0, 14.2, 0);
  lampPart.group.add(lampGlow);

  const lampLight = new THREE.PointLight(0xffb36b, 140, 110, 2);
  lampLight.position.set(0, 17, 0);
  lampPart.group.add(lampLight);

  /* 2 · 蛋托 + 样品平台 */
  const platformPart = makePart({
    id: "platform",
    name: "蛋托 + 样品平台",
    en: "Three-point egg cradle & sample stage",
    short: "蛋托 / 平台",
    anchor: [6.6, 34.6, 6.6],
    explodeY: 2,
    specs: [
      ["平台", "200 × 200 × 90 mm"],
      ["台架", "1200 × 750 mm"],
      ["定位", "三点定位 · 铝合金"],
      ["光程", "镜头–蛋 300 mm"]
    ],
    note: "平台中心开孔让光路穿过；三点装夹保证蛋位重复性。"
  });

  const plateShape = (() => {
    const w = 22;
    const d = 22;
    const r = 1.2;
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 + r, -d / 2);
    sh.lineTo(w / 2 - r, -d / 2);
    sh.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    sh.lineTo(w / 2, d / 2 - r);
    sh.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    sh.lineTo(-w / 2 + r, d / 2);
    sh.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    sh.lineTo(-w / 2, -d / 2 + r);
    sh.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 5.6, 0, Math.PI * 2, true);
    sh.holes.push(hole);
    return sh;
  })();

  const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
    depth: 2.2,
    bevelEnabled: true,
    bevelThickness: 0.18,
    bevelSize: 0.2,
    bevelSegments: 3,
    curveSegments: 48
  });
  plateGeo.rotateX(-Math.PI / 2);
  const plate = mesh(plateGeo, matMetal(0x46525e, 0.38, 0.68));
  plate.position.y = 31.45;
  plate.castShadow = true;
  plate.receiveShadow = true;
  platformPart.group.add(plate);

  // 台面四周的铝制包边
  for (const [dx, dz, w, d] of [[0, -11, 22, 0.5], [0, 11, 22, 0.5], [-11, 0, 0.5, 21], [11, 0, 0.5, 21]]) {
    const edge = mesh(rbox(w, 0.32, d, 0.1), matMetal(0xaab6c1, 0.3, 0.88));
    edge.position.set(dx, 33.72, dz);
    platformPart.group.add(edge);
  }

  // 深色阳极氧化台面
  const plateFace = flat(
    new THREE.Mesh(
      new THREE.RingGeometry(5.62, 10.82, 72),
      new THREE.MeshPhysicalMaterial({
        color: 0x131b22,
        roughness: 0.58,
        metalness: 0.32,
        clearcoat: 0.24,
        clearcoatRoughness: 0.52,
        envMapIntensity: 0.5,
        side: THREE.DoubleSide
      })
    )
  );
  plateFace.rotation.x = -Math.PI / 2;
  plateFace.position.y = 33.68;
  platformPart.group.add(plateFace);

  // 刻度和定位环
  const stageTickMat = new THREE.MeshBasicMaterial({ color: 0x9fb4c4, transparent: true, opacity: 0.5 });
  const stageTickGeo = new THREE.BoxGeometry(0.1, 0.03, 0.42);
  const ticks = new THREE.InstancedMesh(stageTickGeo, stageTickMat, 36);
  for (let i = 0; i < 36; i += 1) {
    const a = (i / 36) * Math.PI * 2;
    const r = i % 3 === 0 ? 6.25 : 6.4;
    dummy.position.set(Math.cos(a) * r, 33.7, Math.sin(a) * r);
    dummy.rotation.set(0, -a, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    ticks.setMatrixAt(i, dummy.matrix);
  }
  ticks.instanceMatrix.needsUpdate = true;
  ticks.castShadow = false;
  platformPart.group.add(ticks);

  const holeRing = flat(
    new THREE.Mesh(
      new THREE.TorusGeometry(5.64, 0.06, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x35e0c8, transparent: true, opacity: 0.55 })
    )
  );
  holeRing.rotation.x = Math.PI / 2;
  holeRing.position.y = 33.72;
  platformPart.group.add(holeRing);

  // 孔内深色衬底：给蛋一个暗背景
  const holeWell = mesh(
    new THREE.CylinderGeometry(5.8, 5.8, 0.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x0b1218, roughness: 0.9, metalness: 0.1 })
  );
  holeWell.position.y = 31.2;
  platformPart.group.add(holeWell);

  // 蛋托橡胶圈
  const eggGasket = mesh(
    new THREE.TorusGeometry(1.3, 0.22, 12, 40),
    M.rubber(0x2b323a)
  );
  eggGasket.rotation.x = Math.PI / 2;
  eggGasket.position.y = 34.35;
  platformPart.group.add(eggGasket);

  // 四根立柱 + 底部横梁 + 安装脚
  const legMat = matMetal(0x77828e, 0.32, 0.9);
  const postPositions = [
    [-8.8, -8.8],
    [8.8, -8.8],
    [-8.8, 8.8],
    [8.8, 8.8]
  ];
  const longPosts = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 20.4, 1.1), legMat, 4);
  const shortPosts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.85, 7.6, 0.85), legMat, 4);
  postPositions.forEach(([x, z], i) => {
    dummy.position.set(x, 13.5, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    longPosts.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 27.8, z);
    dummy.updateMatrix();
    shortPosts.setMatrixAt(i, dummy.matrix);
  });
  longPosts.instanceMatrix.needsUpdate = true;
  shortPosts.instanceMatrix.needsUpdate = true;
  longPosts.castShadow = true;
  shortPosts.castShadow = true;
  platformPart.group.add(longPosts, shortPosts);

  const stageFootMat = matDark(0x151d25, 0.5, 0.42);
  for (const [x, z] of postPositions) {
    const foot = mesh(rbox(2.4, 0.5, 2.4, 0.2), stageFootMat);
    foot.position.set(x, 3.28, z);
    foot.castShadow = false;
    foot.receiveShadow = true;
    platformPart.group.add(foot);
    const bolt = mesh(cyl(0.3, 0.3, 0.35, 12), matMetal(0xaab6c2, 0.3, 0.9));
    bolt.position.set(x, 3.6, z);
    platformPart.group.add(bolt);
  }

  // 角撑：让平台看起来是装出来的，而不是四根棍
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const brace = mesh(rbox(0.38, 4.2, 0.38, 0.1), matMetal(0x5b6772, 0.4, 0.78));
    brace.position.set(sx * 7.1, 30.6, sz * 8.8);
    brace.rotation.z = sx * 0.62;
    brace.rotation.x = sz * 0.18;
    platformPart.group.add(brace);
  }

  // 下框：四根横梁，不挡中心光路
  for (const [x, z, w, d] of [[0, -8.8, 18.4, 0.4], [0, 8.8, 18.4, 0.4], [-8.8, 0, 0.4, 18.4], [8.8, 0, 0.4, 18.4]]) {
    const beam = mesh(rbox(w, 0.5, d, 0.15), matMetal(0x5f6b78, 0.38, 0.82));
    beam.position.set(x, 23.4, z);
    beam.castShadow = false;
    platformPart.group.add(beam);
  }

  // 三点定位蛋托：径向夹爪 + 青色调节轮
  const cradleMat = matMetal(0x9aa7b4, 0.26, 0.95);
  const padMat = M.rubber({ color: 0x2b323a, roughness: 0.88 });
  const knobMat = matMetal(0x0f9e8f, 0.32, 0.7);
  const cradleSlides = [];
  [Math.PI / 2, (Math.PI * 7) / 6, (Math.PI * 11) / 6].forEach((angle) => {
    const bracket = new THREE.Group();
    const slide = new THREE.Group();
    const stem = mesh(rbox(0.55, 5.0, 0.55, 0.2), cradleMat);
    stem.position.set(3.0, 35.7, 0);
    const arm = mesh(rbox(1.0, 0.42, 0.5, 0.15), cradleMat);
    arm.position.set(2.55, 36.35, 0);
    const pad = mesh(rbox(0.34, 1.0, 0.92, 0.12), padMat);
    pad.position.set(2.08, 36.35, 0);
    const knob = mesh(cyl(0.62, 0.62, 0.38, 18), knobMat);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(3.95, 35.5, 0);
    slide.add(stem, arm, pad, knob);
    bracket.add(slide);
    bracket.rotation.y = -angle;
    platformPart.group.add(bracket);
    cradleSlides.push(slide);
  });

  // 水平仪和铭牌
  const bubble = mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.16, 20),
    new THREE.MeshStandardMaterial({
      color: 0x35e0c8,
      emissive: 0x0f9e8f,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.72,
      roughness: 0.2
    })
  );
  bubble.position.set(8.2, 33.78, 8.2);
  platformPart.group.add(bubble);

  const stageTex = canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = "#111920";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(223,239,247,0.82)";
    ctx.font = '600 26px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("SAMPLE STAGE", 18, 40);
    ctx.fillStyle = "rgba(53,224,200,0.9)";
    ctx.fillRect(18, 52, 42, 3);
    ctx.fillStyle = "rgba(190,212,224,0.5)";
    ctx.font = '16px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("200 × 200 × 90 mm · Z-ADJUST", 18, 78);
  });
  const stagePlate = flat(new THREE.Mesh(new THREE.PlaneGeometry(9.6, 1.8), new THREE.MeshBasicMaterial({ map: stageTex })));
  stagePlate.position.set(0, 32.3, 11.16);
  platformPart.group.add(stagePlate);

  /* 3 · 种蛋 */
  const eggPart = makePart({
    id: "egg",
    name: "种蛋（粉壳）",
    en: "Pink-shelled hatching egg",
    short: "种蛋",
    anchor: [1.4, 39.6, 1.5],
    explodeY: 8,
    specs: [
      ["蛋径", "∅40–50 mm"],
      ["姿态", "钝端朝上 · 尖端朝下"],
      ["品种", "坝上长尾鸡 · 粉壳"],
      ["测量", "透射 · 不破壳"]
    ],
    note: "真实测量只用透射强度；蛋壳纹理由程序生成，不贴真实照片。"
  });

  const eggHeight = 6.4;
  const eggPoints = [];
  for (let i = 0; i <= 28; i += 1) {
    const t = i / 28;
    const y = -eggHeight / 2 + eggHeight * t;
    const s = Math.pow(Math.sin(Math.PI * t), 0.78) * (1 + 0.16 * (t - 0.5));
    eggPoints.push(new THREE.Vector2(Math.max(0.001, 2.25 * s), y));
  }
  const eggGeo = new THREE.LatheGeometry(eggPoints, 32);

  const eggMat = M.eggShell();
  eggMat.userData.noHighlight = true; // 蛋壳不用自发光表达选中，保持写实

  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

  /* 蛋整体装在一个可抬升的组里：选中种蛋时抬离蛋托，光路仍在穿过 */
  const eggLift = new THREE.Group();
  eggLift.position.y = 36.8;
  eggPart.group.add(eggLift);

  const egg = mesh(eggGeo, eggMat);
  eggLift.add(egg);

  const inner = new THREE.Group();
  inner.visible = false;
  eggLift.add(inner);

  // 蛋内散射光：透射照明透过蛋壳后回来的暖光，强度跟随光路
  const eggLight = new THREE.PointLight(0xffd0ae, 5, 18, 2);
  eggLight.position.y = 0.2;
  eggLift.add(eggLight);

  const innerMats = [];
  const addInner = (geo, color, opacity, pos, scale, emissive = 0x000000, emissiveIntensity = 0) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      transparent: true,
      opacity,
      emissive,
      emissiveIntensity,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    m.userData.noHighlight = true;
    const o = flat(new THREE.Mesh(geo, m));
    o.position.set(...pos);
    o.scale.set(...scale);
    inner.add(o);
    innerMats.push({ mat: m, base: opacity });
    return o;
  };
  addInner(new THREE.SphereGeometry(1.25, 20, 14), 0xf0a24a, 0.82, [0, -0.35, 0], [1, 1.08, 1], 0x6b3210, 0.25);
  addInner(new THREE.SphereGeometry(0.96, 16, 10), 0xffffff, 0.28, [0, 2.35, 0], [0.95, 0.46, 0.95]);
  addInner(new THREE.SphereGeometry(0.18, 10, 8), 0xff8a5b, 0.95, [0.3, 1.2, 0.18], [1, 1, 1], 0xff5c3d, 0.6);

  /* 种蛋托盘（非交互道具，填充台面并提示样本量） */
  const tray = new THREE.Group();
  const trayBase = mesh(rbox(18, 0.7, 11, 0.4), matMetal(0x5b6772, 0.4, 0.7));
  trayBase.position.set(-44, 3.55, 15.5);
  trayBase.castShadow = true;
  trayBase.receiveShadow = true;
  tray.add(trayBase);
  for (const [dx, dz, w, d] of [[0, -5.1, 18, 0.4], [0, 5.1, 18, 0.4], [-8.6, 0, 0.4, 10.6], [8.6, 0, 0.4, 10.6]]) {
    const rim = mesh(rbox(w, 1.0, d, 0.18), matMetal(0x77828c, 0.38, 0.8));
    rim.position.set(-44 + dx, 4.0, 15.5 + dz);
    tray.add(rim);
  }
  const trayEggMat = M.eggShell();
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const te = mesh(new THREE.SphereGeometry(1.9, 22, 16), trayEggMat);
      te.scale.set(1, 1.3, 1);
      te.position.set(-49.5 + c * 5.5 + (r % 2) * 1.2, 5.6, 13.6 + r * 4.0);
      te.castShadow = true;
      tray.add(te);
    }
  }
  root.add(tray);

  /* 4 · 可调焦镜头 */
  const lensPart = makePart({
    id: "lens",
    name: "可调焦镜头",
    en: "Adjustable-focus lens · Z118M0736C6M",
    short: "可调焦镜头",
    anchor: [4.9, 72.6, 2.6],
    explodeY: 11,
    specs: [
      ["型号", "Z118M0736C6M"],
      ["厂商", "Yulufa（泉州）"],
      ["镜头–蛋距", "300 mm"],
      ["曝光", "890 ms"]
    ],
    note: "可调焦镜头把透过种蛋的光耦合进上方光谱相机。"
  });

  // 遮光罩：向下张开，挡住环境杂光
  const lensHood = mesh(new THREE.CylinderGeometry(4.1, 5.4, 2.2, 48, 1, true), matDark(0x1a232c, 0.46, 0.45));
  lensHood.position.y = 69.0;
  lensHood.castShadow = true;
  lensPart.group.add(lensHood);

  const lensBottom = mesh(cyl(4.0, 4.25, 1.3, 48), matMetal(0x303b46, 0.38, 0.8));
  lensBottom.position.y = 70.3;
  lensPart.group.add(lensBottom);

  const barrel = mesh(cyl(3.9, 4.0, 5.6, 48), matMetal(0xb3bec9, 0.3, 0.92));
  barrel.position.y = 73.3;
  barrel.castShadow = true;
  lensPart.group.add(barrel);

  // 三道环形槽
  [71.5, 73.3, 75.1].forEach((y, i) => {
    const groove = mesh(new THREE.TorusGeometry(4.02, 0.09, 8, 48), matDark(0x202a34, 0.5, 0.55));
    groove.rotation.x = Math.PI / 2;
    groove.position.y = y;
    lensPart.group.add(groove);
  });

  // 滚花对焦环
  const knurl = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.3, 1.9, 0.5),
    matDark(0x222c36, 0.48, 0.55),
    56
  );
  for (let i = 0; i < 56; i += 1) {
    const a = (i / 56) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 4.18, 72.25, Math.sin(a) * 4.18);
    dummy.rotation.set(0, Math.PI / 2 - a, 0);
    dummy.updateMatrix();
    knurl.setMatrixAt(i, dummy.matrix);
  }
  knurl.instanceMatrix.needsUpdate = true;
  knurl.castShadow = false;
  lensPart.group.add(knurl);

  const lensGlass = M.glass({ color: 0xdff4ff, opacity: 0.4 });
  lensGlass.userData.noHighlight = true;
  const glass = flat(new THREE.Mesh(cyl(3.15, 3.15, 0.35, 48), lensGlass));
  glass.position.y = 69.35;
  lensPart.group.add(glass);

  const lensRim = mesh(cyl(3.5, 3.5, 0.2, 48), matMetal(0x99e8dc, 0.24, 0.8));
  lensRim.position.y = 69.18;
  lensPart.group.add(lensRim);

  const lensTop = mesh(cyl(4.35, 4.05, 1.6, 48), matMetal(0x303b46, 0.36, 0.85));
  lensTop.position.y = 76.2;
  lensTop.castShadow = true;
  lensPart.group.add(lensTop);

  const lensAccent = flat(
    new THREE.Mesh(
      new THREE.TorusGeometry(4.08, 0.05, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x35e0c8, transparent: true, opacity: 0.7 })
    )
  );
  lensAccent.rotation.x = Math.PI / 2;
  lensAccent.position.y = 75.55;
  lensPart.group.add(lensAccent);

  // 锁紧螺钉
  [0.6, 2.7, 4.8].forEach((a) => {
    const screw = mesh(cyl(0.18, 0.18, 0.35, 10), matMetal(0xc7d2dc, 0.3, 0.9));
    screw.rotation.z = Math.PI / 2;
    screw.position.set(Math.cos(a) * 4.05, 73.4, Math.sin(a) * 4.05);
    lensPart.group.add(screw);
  });

  /* 5 · 光谱相机（T3 传感器） */
  const sensorPart = makePart({
    id: "spectrometer",
    name: "光谱相机 · T3 传感器",
    en: "Spectral camera · T3 compound sensor",
    short: "光谱相机",
    anchor: [7.2, 82.6, 6.5],
    explodeY: 14,
    specs: [
      ["传感器", "T3 微型复合光谱"],
      ["波段", "340–1020 nm"],
      ["采样", "1 nm · 681 点"],
      ["分辨率", "≈2.8 nm"]
    ],
    note: "681 个波长点全部进入模型；论文未做平滑、SNV 或 MSC。"
  });

  const body = mesh(rbox(23, 14, 12, 0.7), matPlastic(0xdde5ec, 0.4, 0.35));
  body.position.y = 84.0;
  body.castShadow = true;
  body.receiveShadow = true;
  sensorPart.group.add(body);

  // 前面板整体可外移，露出探测器腔
  const frontPanel = new THREE.Group();
  sensorPart.group.add(frontPanel);

  const bezel = mesh(rbox(18.5, 10.2, 0.7, 0.35), matDark(0x0e161e, 0.48, 0.4));
  bezel.position.set(0, 84.0, 6.05);
  frontPanel.add(bezel);

  const panelTex = makePanelTexture();
  const panel = flat(new THREE.Mesh(new THREE.PlaneGeometry(16.6, 8.4), M.screen(panelTex)));
  panel.position.set(0, 84.0, 6.43);
  frontPanel.add(panel);

  // 状态灯带
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x8affd9,
    emissive: C.accent,
    emissiveIntensity: 2.4,
    roughness: 0.4
  });
  ledMat.userData.noHighlight = true;
  const led = flat(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.1), ledMat));
  led.position.set(6.4, 79.6, 6.45);
  frontPanel.add(led);

  const handle = mesh(rbox(12.5, 1.4, 2.4, 0.35), matMetal(0x37424d, 0.4, 0.75));
  handle.position.set(0, 91.5, -0.8);
  handle.castShadow = true;
  sensorPart.group.add(handle);

  // 侧面散热槽
  for (let i = 0; i < 6; i += 1) {
    const vent = flat(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 7.8), new THREE.MeshBasicMaterial({ color: 0x111a22 })));
    vent.rotation.y = Math.PI / 2;
    vent.position.set(-11.53, 84, -3.2 + i * 1.35);
    sensorPart.group.add(vent);
  }

  // 铭牌
  const badgeTex = canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = "#0d151d";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(235,246,252,0.9)";
    ctx.font = '600 30px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("ICL-B1620", 18, 42);
    ctx.fillStyle = "rgba(53,224,200,0.9)";
    ctx.fillRect(18, 54, 40, 3);
    ctx.fillStyle = "rgba(190,212,224,0.55)";
    ctx.font = '16px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("SPECTRAL CAMERA · T3", 18, 80);
  });
  const badge = flat(new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.4), new THREE.MeshBasicMaterial({ map: badgeTex })));
  badge.position.set(-4.8, 79.6, 6.42);
  frontPanel.add(badge);

  // 前面板四角螺钉 + 背部线缆接头
  for (const [sx, sy] of [[-8.4, 3.6], [8.4, 3.6], [-8.4, -3.6], [8.4, -3.6]]) {
    const screw = mesh(cyl(0.3, 0.3, 0.22, 12), matMetal(0xc3ced8, 0.3, 0.9));
    screw.rotation.x = Math.PI / 2;
    screw.position.set(sx, 84 + sy, 6.45);
    frontPanel.add(screw);
  }
  const gland = mesh(cyl(0.9, 0.9, 1.4, 16), matDark(0x111a22, 0.55, 0.3));
  gland.rotation.x = Math.PI / 2;
  gland.position.set(7.6, 84.2, -6.4);
  sensorPart.group.add(gland);

  const mount = mesh(cyl(3.3, 3.5, 2.4, 40), matMetal(0x37424d, 0.4, 0.8));
  mount.position.y = 76.2;
  mount.castShadow = true;
  sensorPart.group.add(mount);

  /* 6 · CCD 相机 */
  const ccdPart = makePart({
    id: "ccd",
    name: "ICL-B1620 CCD 相机",
    en: "ICL-B1620 CCD camera · Imperx",
    short: "CCD 相机",
    anchor: [3.2, 93.5, 4.6],
    explodeY: 16,
    specs: [
      ["型号", "ICL-B1620"],
      ["厂商", "Imperx"],
      ["采集", "3 连测 × 890 ms"],
      ["积分", "2.67 s / 蛋"]
    ],
    note: "三次连续光谱先平均，再对同日两次测量做平均。"
  });

  const ccdHead = new THREE.Group();
  ccdPart.group.add(ccdHead);

  const ccdBody = mesh(rbox(7.4, 4.8, 7, 0.4), matPlastic(0xcfd8e6, 0.5));
  ccdBody.position.set(0, 93.3, -1.2);
  ccdHead.add(ccdBody);

  const ccdLens = mesh(cyl(2.1, 2.1, 2.4, 32), matDark(0x1a2233, 0.42, 0.6));
  ccdLens.rotation.x = Math.PI / 2;
  ccdLens.position.set(0, 93.3, 3.4);
  ccdHead.add(ccdLens);

  const ccdGlass = flat(new THREE.Mesh(cyl(1.65, 1.65, 0.2, 32), lensGlass.clone()));
  ccdGlass.rotation.x = Math.PI / 2;
  ccdGlass.position.set(0, 93.3, 4.62);
  ccdHead.add(ccdGlass);

  const ccdBadge = mesh(rbox(3.6, 0.6, 0.4, 0.12), matDark(0x2a3448, 0.5, 0.4));
  ccdBadge.position.set(0, 95.6, -1.4);
  ccdHead.add(ccdBadge);

  /* 7 · 数据采集计算机 */
  const pcPart = makePart({
    id: "computer",
    name: "数据采集计算机",
    en: "Data acquisition computer · ThinkStation P620",
    short: "采集计算机",
    anchor: [40, 31, 0],
    explodeY: 5,
    specs: [
      ["型号", "ThinkStation P620"],
      ["厂商", "Lenovo"],
      ["单枚耗时", "≈12.5 s（含上下料）"],
      ["节律", "每 12 h · D1–D7"]
    ],
    note: "数据落盘后按蛋号纵向关联；D1–D7 共 14 个采样时间点。"
  });

  const monitorCanvas = document.createElement("canvas");
  monitorCanvas.width = 640;
  monitorCanvas.height = 400;
  const monitorCtx = monitorCanvas.getContext("2d");
  const monitorTex = new THREE.CanvasTexture(monitorCanvas);
  monitorTex.colorSpace = THREE.SRGBColorSpace;
  monitorTex.anisotropy = 8;

  const monitorHead = new THREE.Group();
  monitorHead.position.set(40, 20.4, -3);
  monitorHead.rotation.y = -0.26;
  pcPart.group.add(monitorHead);

  const monitorBezel = mesh(rbox(30, 18.8, 1.15, 0.5), matDark(0x0d141c, 0.52, 0.32));
  monitorBezel.castShadow = true;
  monitorHead.add(monitorBezel);

  const monitorScreen = flat(
    new THREE.Mesh(new THREE.PlaneGeometry(28.4, 17.1), M.screen(monitorTex))
  );
  monitorScreen.position.set(0, 0, 0.61);
  monitorHead.add(monitorScreen);

  // 屏幕下沿的品牌条
  const monitorChin = mesh(rbox(9, 0.55, 0.2, 0.08), matMetal(0x78838e, 0.4, 0.7));
  monitorChin.position.set(0, -8.7, 0.6);
  monitorHead.add(monitorChin);

  // 显示器支架：VESA 板 + 立柱 + 底座
  const vesa = mesh(rbox(4.2, 4.2, 0.5, 0.2), matDark(0x1a232c, 0.5, 0.4));
  vesa.position.set(40, 11.2, -4.2);
  pcPart.group.add(vesa);

  const monitorArm = mesh(rbox(2.1, 8.6, 1.4, 0.3), matMetal(0x3f4b57, 0.38, 0.8));
  monitorArm.position.set(40, 7.4, -4.6);
  monitorArm.castShadow = true;
  pcPart.group.add(monitorArm);

  const monitorBase = mesh(rbox(13, 0.65, 8.4, 0.4), matMetal(0x2d3843, 0.42, 0.75));
  monitorBase.position.set(40, 3.4, -3.2);
  monitorBase.castShadow = true;
  pcPart.group.add(monitorBase);

  // 塔式工作站
  const tower = mesh(rbox(12, 30, 24, 0.55), matDark(0x1d2730, 0.62, 0.25));
  tower.position.set(53, 18, -4);
  tower.castShadow = true;
  pcPart.group.add(tower);

  // 前面板：网孔 + 光驱缝 + 电源键
  const ventTex = canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = "#141c24";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(230,242,249,0.10)";
    for (let y = 8; y < h; y += 9) {
      for (let x = 8; x < w; x += 9) {
        ctx.beginPath();
        ctx.arc(x + (y % 18 === 8 ? 0 : 4), y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(6,12,16,0.8)";
    ctx.fillRect(18, 24, w - 36, 18);
    ctx.fillStyle = "rgba(53,224,200,0.7)";
    ctx.fillRect(18, 46, 34, 2);
  });
  const towerFront = flat(new THREE.Mesh(new THREE.PlaneGeometry(10.4, 22), new THREE.MeshStandardMaterial({
    map: ventTex,
    roughness: 0.62,
    metalness: 0.25
  })));
  towerFront.position.set(53, 19.4, 8.03);
  pcPart.group.add(towerFront);

  const powerMat = new THREE.MeshStandardMaterial({
    color: 0x8affd9,
    emissive: C.accent,
    emissiveIntensity: 2,
    roughness: 0.5
  });
  powerMat.userData.noHighlight = true;
  const power = flat(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 18), powerMat));
  power.rotation.x = Math.PI / 2;
  power.position.set(48.6, 28.2, 8.08);
  pcPart.group.add(power);

  const pcBadgeTex = canvasTexture(512, 96, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(232,243,249,0.86)";
    ctx.font = '600 34px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("ThinkStation", 10, 46);
    ctx.fillStyle = "rgba(53,224,200,0.8)";
    ctx.fillRect(10, 58, 62, 3);
    ctx.fillStyle = "rgba(190,212,224,0.5)";
    ctx.font = '17px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("P620 · ACQUISITION", 10, 84);
  });
  const pcBadge = flat(new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.35), new THREE.MeshBasicMaterial({ map: pcBadgeTex, transparent: true })));
  pcBadge.position.set(53, 5.2, 8.06);
  pcPart.group.add(pcBadge);

  // 键盘：键位用贴图表现，避免几百个几何体
  const keyTex = canvasTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = "#111820";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    for (let r = 0; r < 5; r += 1) {
      for (let c = 0; c < 15; c += 1) {
        ctx.strokeRect(12 + c * 32.6, 12 + r * 33, 28, 27);
      }
    }
    ctx.fillRect(150, 178, 190, 8);
  });
  const keyboard = mesh(rbox(17, 0.65, 6.4, 0.25), matDark(0x0d141a, 0.6, 0.3));
  keyboard.position.set(39, 3.35, 8.5);
  keyboard.castShadow = true;
  pcPart.group.add(keyboard);
  const keyTop = flat(new THREE.Mesh(new THREE.PlaneGeometry(16.2, 5.7), new THREE.MeshStandardMaterial({
    map: keyTex,
    roughness: 0.7,
    metalness: 0.15
  })));
  keyTop.rotation.x = -Math.PI / 2;
  keyTop.position.set(39, 3.7, 8.5);
  pcPart.group.add(keyTop);

  const mouse = mesh(rbox(1.8, 0.55, 3.2, 0.55), matDark(0x141c24, 0.55, 0.3));
  mouse.position.set(49.5, 3.35, 8.4);
  pcPart.group.add(mouse);

  // 显示器到主机的线缆
  const monitorCable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(48.6, 11.2, -4.4),
    new THREE.Vector3(50.4, 9.2, -8),
    new THREE.Vector3(52.2, 8.4, -10),
    new THREE.Vector3(53, 12, -10.4)
  ]);
  const mc = flat(mesh(new THREE.TubeGeometry(monitorCable, 28, 0.16, 5, false), matDark(0x080d12, 0.62, 0.18)));
  pcPart.group.add(mc);

  /* 8 · 白 / 暗参考 */
  const refsPart = makePart({
    id: "refs",
    name: "白 / 暗参考",
    en: "White & dark reference",
    short: "白 / 暗参考",
    anchor: [-24, 9.2, 13.6],
    explodeY: 1,
    specs: [
      ["组成", "白参考板 + 暗挡板"],
      ["时机", "每次采集序列前"],
      ["复校", "每 30 min"],
      ["公式", "T=(Is−Id)/(Iw−Id)"]
    ],
    note: "白 / 暗参考把原始响应归一为相对透射率，量纲为 1。"
  });

  const rackMat = matMetal(0x6d7985, 0.36, 0.82);
  const refBase = mesh(rbox(11, 0.6, 8.2, 0.3), matDark(0x1a232c, 0.52, 0.4));
  refBase.position.set(-24, 3.4, 13);
  refBase.castShadow = true;
  refBase.receiveShadow = true;
  refsPart.group.add(refBase);

  [-3.1, 3.1].forEach((dz) => {
    const post = mesh(rbox(0.6, 6.6, 0.6, 0.15), rackMat);
    post.position.set(-24, 6.8, 13 + dz);
    post.castShadow = true;
    refsPart.group.add(post);
  });
  const rackBar = mesh(rbox(0.55, 0.55, 7, 0.15), rackMat);
  rackBar.position.set(-24, 10.0, 13);
  refsPart.group.add(rackBar);

  // 白参考板：带十字准星
  const whiteTex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#f2f4f3";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(12,28,40,0.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.strokeStyle = "rgba(15,163,146,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, 60); ctx.lineTo(w / 2, h - 60);
    ctx.moveTo(60, h / 2); ctx.lineTo(w - 60, h / 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(15,163,146,0.5)";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(12,28,40,0.5)";
    ctx.font = '600 22px "JetBrains Mono", Consolas, monospace';
    ctx.textAlign = "center";
    ctx.fillText("WHITE REF · 99%", w / 2, h - 44);
  });
  const whitePlate = mesh(rbox(7.2, 0.32, 7.2, 0.12), new THREE.MeshPhysicalMaterial({
    map: whiteTex,
    roughness: 0.62,
    metalness: 0.0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.7
  }));
  whitePlate.position.set(-26.0, 8.2, 13.2);
  whitePlate.rotation.x = -0.34;
  whitePlate.castShadow = true;
  refsPart.group.add(whitePlate);

  const darkPlate = mesh(rbox(7.2, 0.32, 7.2, 0.12), M.rubber({ color: 0x161c22, roughness: 0.94 }));
  darkPlate.position.set(-21.6, 8.2, 13.2);
  darkPlate.rotation.x = -0.34;
  darkPlate.castShadow = true;
  refsPart.group.add(darkPlate);

  const refLabelTex = canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = "#111920";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(235,246,252,0.86)";
    ctx.font = '600 26px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("WHITE / DARK REF", 16, 38);
    ctx.fillStyle = "rgba(53,224,200,0.9)";
    ctx.fillRect(16, 50, 38, 3);
    ctx.fillStyle = "rgba(190,212,224,0.5)";
    ctx.font = '16px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("RE-CALIBRATE EVERY 30 min", 16, 78);
  });
  const refLabel = flat(new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.4), new THREE.MeshBasicMaterial({ map: refLabelTex })));
  refLabel.position.set(-24, 3.75, 17.15);
  refLabel.rotation.x = -0.18;
  refsPart.group.add(refLabel);

  /* 9 · 孵化器（台面左后，背景示意） */
  const incubatorPart = makePart({
    id: "incubator",
    name: "孵化器（背景）",
    en: "Incubator · background",
    short: "孵化器",
    hiddenHotspot: true,
    anchor: [-42, 24, -10.5],
    explodeY: 0,
    specs: [
      ["温度", "37.8 ℃"],
      ["翻蛋", "每 2 h"],
      ["落盘", "D18"],
      ["角色", "背景示意 · 不参与测量"]
    ],
    note: "示意图；论文未设同期孵化对照，不能据此推断对孵化率无影响。"
  });

  const incBody = mesh(rbox(26, 30, 20, 0.8), matDark(0x1b242c, 0.52, 0.32));
  incBody.position.set(-42, 18, -24);
  incBody.castShadow = true;
  incBody.receiveShadow = true;
  incubatorPart.group.add(incBody);

  // 白色顶盖，和深色箱体分层
  const incTop = mesh(rbox(26.6, 2.2, 20.6, 0.6), matDark(0x2a3540, 0.5, 0.4));
  incTop.position.set(-42, 33.6, -24);
  incTop.castShadow = true;
  incubatorPart.group.add(incTop);

  // 前门（可整体外移）
  const incDoor = new THREE.Group();
  incubatorPart.group.add(incDoor);

  const incFront = flat(
    new THREE.Mesh(
      new THREE.PlaneGeometry(21.4, 24.6),
      new THREE.MeshStandardMaterial({
        map: makeIncubatorTexture(),
        emissive: 0xffffff,
        emissiveMap: makeIncubatorTexture(),
        color: 0x6d7b86,
        emissiveIntensity: 0.18,
        roughness: 0.6,
        metalness: 0.05
      })
    )
  );
  incFront.position.set(-42, 18.4, -13.88);
  incDoor.add(incFront);

  const incGlass = flat(
    new THREE.Mesh(
      new THREE.PlaneGeometry(21.4, 24.6),
      new THREE.MeshPhysicalMaterial({
        color: 0x13212b,
        transparent: true,
        opacity: 0.34,
        roughness: 0.05,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        envMapIntensity: 1.5,
        depthWrite: false
      })
    )
  );
  incGlass.position.set(-42, 18.4, -13.8);
  incDoor.add(incGlass);

  // 玻璃上的斜向反光，提示这是一扇门而不是屏幕
  const incStreakTex = canvasTexture(256, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.38, "rgba(255,255,255,0.10)");
    g.addColorStop(0.46, "rgba(255,255,255,0.28)");
    g.addColorStop(0.54, "rgba(255,255,255,0.10)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const incStreak = flat(new THREE.Mesh(new THREE.PlaneGeometry(21.4, 24.6), new THREE.MeshBasicMaterial({
    map: incStreakTex,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })));
  incStreak.position.set(-42, 18.4, -13.74);
  incDoor.add(incStreak);

  // 门框
  const frameMat = matMetal(0x9aa6b2, 0.32, 0.85);
  const frame = [
    [0, 12.6, 22.4, 0.6, 0],
    [0, -12.6, 22.4, 0.6, 0],
    [-11.1, 0, 0.6, 25.4, 0],
    [11.1, 0, 0.6, 25.4, 0]
  ];
  frame.forEach(([dx, dy, w, h]) => {
    const bar = mesh(rbox(w, h, 0.55, 0.18), frameMat);
    bar.position.set(-42 + dx, 18.5 + dy, -13.82);
    incDoor.add(bar);
  });

  const incHandle = mesh(rbox(1.1, 7.2, 0.75, 0.28), matMetal(0xb6c2cd, 0.28, 0.9));
  incHandle.position.set(-31.2, 18.5, -13.35);
  incDoor.add(incHandle);

  const incLabelTex = canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = "#111920";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(235,246,252,0.9)";
    ctx.font = '600 28px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("SETTER · D1–D7", 18, 40);
    ctx.fillStyle = "rgba(53,224,200,0.9)";
    ctx.fillRect(18, 52, 42, 3);
    ctx.fillStyle = "rgba(190,212,224,0.55)";
    ctx.font = '17px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("37.8 °C  ·  60–65 %RH  ·  TURN 2 h", 18, 80);
  });
  const incLabel = flat(new THREE.Mesh(new THREE.PlaneGeometry(12, 2.25), new THREE.MeshBasicMaterial({ map: incLabelTex })));
  incLabel.position.set(-42, 30.9, -13.82);
  incubatorPart.group.add(incLabel);

  const incLight = new THREE.PointLight(0xffa85e, 14, 34, 2);
  incLight.position.set(-42, 22, -18);
  incubatorPart.group.add(incLight);

  /* 线缆（装饰） */
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(10.6, 84.2, -4.6),
    new THREE.Vector3(11.4, 80.5, -9.5),
    new THREE.Vector3(7.2, 66, -12.8),
    new THREE.Vector3(4.6, 46, -13.2),
    new THREE.Vector3(4.2, 26, -13.6),
    new THREE.Vector3(8.5, 9.5, -17.5),
    new THREE.Vector3(23, 6.4, -23.5),
    new THREE.Vector3(41, 7.2, -21.5),
    new THREE.Vector3(50.6, 12, -16.2),
    new THREE.Vector3(53, 22, -15.6)
  ]);
  const cable = flat(
    mesh(new THREE.TubeGeometry(cableCurve, 72, 0.24, 6, false), matDark(0x080d13, 0.6, 0.2))
  );
  cable.castShadow = false;
  root.add(cable);

  // 线缆夹：把线固定在立柱侧后方
  [62, 44, 27].forEach((y, i) => {
    const clip = mesh(rbox(1.6, 0.6, 1.1, 0.2), matDark(0x151d25, 0.5, 0.5));
    clip.position.set(5.6, y, -13.7 + i * 0.1);
    root.add(clip);
  });

  /* 10 · 遮光暗箱（剖开 / 拆解示意）
     实机采集时整条光路封闭在暗箱内：相机在上、种蛋居中、卤钨灯在下，箱内无外部光。
     3D 只保留后墙与左墙，前 / 右两面剖开，顶盖落座，便于看清内部光路。 */
  const enclosurePart = makePart({
    id: "enclosure",
    name: "遮光暗箱",
    en: "Light-tight dark box · cutaway view",
    short: "遮光暗箱",
    anchor: [19.6, 98, -18.2],
    explodeY: 0,
    specs: [
      ["结构", "全封闭遮光暗箱"],
      ["相机", "顶部 · 同轴采集"],
      ["种蛋", "中部 · 钝端朝上"],
      ["光源", "底部 · 150 W 卤钨灯"],
      ["环境", "采集时无外部光"]
    ],
    note: "实机采集时箱门关闭，箱内只有卤钨灯照明；画面为暗箱剖开 / 拆解示意，便于看清内部光路。"
  });

  const boxWallMat = matDark(0x161f28, 0.78, 0.16);
  const boxSideMat = matDark(0x18222c, 0.76, 0.18);
  const boxTrimMat = matMetal(0x5a6b78, 0.4, 0.72);
  const boxInnerMat = matDark(0x0b1117, 0.82, 0.12);
  // 大面积墙板不参与整体发光，选中时只让金属框线亮起
  boxWallMat.userData.noHighlight = true;
  boxSideMat.userData.noHighlight = true;
  boxInnerMat.userData.noHighlight = true;

  // 后墙 / 左墙均为实心哑光黑：黑箱不透明，只在前 / 右两面剖开
  const boxBack = mesh(rbox(40, 100, 1.1, 0.22), boxWallMat);
  boxBack.position.set(0, 54, -18.55);
  boxBack.castShadow = false;
  boxBack.receiveShadow = true;
  enclosurePart.group.add(boxBack);

  const boxLeft = mesh(rbox(1.1, 100, 34, 0.22), boxSideMat);
  boxLeft.position.set(-19.95, 54, -1.3);
  boxLeft.castShadow = false;
  boxLeft.receiveShadow = true;
  enclosurePart.group.add(boxLeft);

  // 四角立柱 + 顶部框架：把“箱”的轮廓勾出来
  const boxPosts = [
    [-19.95, 15.6],
    [-19.95, -18.55],
    [19.95, 15.6],
    [19.95, -18.55]
  ];
  boxPosts.forEach(([x, z]) => {
    const post = mesh(rbox(1.5, 100, 1.5, 0.18), boxTrimMat);
    post.position.set(x, 54, z);
    post.castShadow = false;
    post.receiveShadow = true;
    enclosurePart.group.add(post);
  });

  [15.6, -18.55].forEach((z) => {
    const beam = mesh(rbox(40, 1.5, 1.5, 0.16), boxTrimMat);
    beam.position.set(0, 104, z);
    beam.castShadow = false;
    enclosurePart.group.add(beam);
  });
  [-19.95, 19.95].forEach((x) => {
    const beam = mesh(rbox(1.5, 1.5, 35.6, 0.16), boxTrimMat);
    beam.position.set(x, 104, -1.45);
    beam.castShadow = false;
    enclosurePart.group.add(beam);
  });

  // 底座边框：交代暗箱落在台面上的范围
  [15.6, -18.55].forEach((z) => {
    const beam = mesh(rbox(40, 1.2, 1.2, 0.14), boxTrimMat);
    beam.position.set(0, 3.95, z);
    beam.castShadow = false;
    enclosurePart.group.add(beam);
  });
  [-19.95, 19.95].forEach((x) => {
    const beam = mesh(rbox(1.2, 1.2, 35.6, 0.14), boxTrimMat);
    beam.position.set(x, 3.95, -1.45);
    beam.castShadow = false;
    enclosurePart.group.add(beam);
  });

  // 顶盖：落在箱体上，用后铰链 / 前锁扣 / 密封条交代“这是一只真实的盖子”
  const boxLid = new THREE.Group();
  enclosurePart.group.add(boxLid);

  const lidPanel = mesh(rbox(42, 1.6, 37, 0.3), boxWallMat);
  lidPanel.castShadow = false;
  lidPanel.receiveShadow = true;
  boxLid.add(lidPanel);

  const lidInner = mesh(rbox(38, 0.5, 33, 0.2), boxInnerMat);
  lidInner.position.set(0, -1.05, 0);
  lidInner.castShadow = false;
  boxLid.add(lidInner);

  const lidHandle = mesh(rbox(10, 1.1, 2.4, 0.3), boxTrimMat);
  lidHandle.position.set(0, 1.3, 0);
  lidHandle.castShadow = false;
  boxLid.add(lidHandle);

  boxLid.position.set(0, 105.6, -1.45);

  // 密封条 + 后铰链 + 前锁扣：顶盖落座后不再悬空
  const lidGasket = mesh(rbox(40.4, 0.16, 34.4, 0.06), boxInnerMat);
  lidGasket.position.set(0, 104.8, -1.45);
  lidGasket.castShadow = false;
  enclosurePart.group.add(lidGasket);

  [-12, 12].forEach((x) => {
    const hinge = mesh(rbox(2.6, 1.2, 1.6, 0.2), boxTrimMat);
    hinge.position.set(x, 105.2, -18.9);
    hinge.castShadow = false;
    enclosurePart.group.add(hinge);

    const latch = mesh(rbox(2.2, 1.5, 1.1, 0.16), boxTrimMat);
    latch.position.set(x, 104.7, 16.7);
    latch.castShadow = false;
    enclosurePart.group.add(latch);
  });

  // 盖沿金属包边，坐落后仍能把顶盖从箱体上分辨出来
  [17.08, -19.98].forEach((z) => {
    const bar = mesh(rbox(42.2, 0.55, 0.55, 0.12), boxTrimMat);
    bar.position.set(0, 105.45, z);
    bar.castShadow = false;
    enclosurePart.group.add(bar);
  });
  [-21.08, 21.08].forEach((x) => {
    const bar = mesh(rbox(0.55, 0.55, 37.1, 0.12), boxTrimMat);
    bar.position.set(x, 105.45, -1.45);
    bar.castShadow = false;
    enclosurePart.group.add(bar);
  });

  // 前上沿的铭牌：暗箱的身份与“采集时全封闭”
  const boxLabelTex = canvasTexture(1024, 160, (ctx, w, h) => {
    ctx.fillStyle = "#0b1218";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120,160,178,0.26)";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = "rgba(53,224,200,0.9)";
    ctx.fillRect(30, 30, 8, 100);
    ctx.fillStyle = "#e9f2f7";
    ctx.font = '600 72px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("DARK BOX", 62, 76);
    ctx.fillStyle = "rgba(214,238,248,0.78)";
    ctx.font = '42px "Noto Sans SC", sans-serif';
    ctx.fillText("遮光暗箱 · 采集时全封闭", 62, 128);
    ctx.fillStyle = "rgba(214,238,248,0.42)";
    ctx.font = '20px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("NO AMBIENT LIGHT", w - 260, 128);
  });
  const boxLabel = flat(
    new THREE.Mesh(
      new THREE.PlaneGeometry(28, 4.4),
      new THREE.MeshBasicMaterial({ map: boxLabelTex, toneMapped: false })
    )
  );
  boxLabel.position.set(0, 101.4, 15.72);
  enclosurePart.group.add(boxLabel);

  const boxLabelBar = mesh(rbox(28, 0.7, 0.5, 0.12), boxTrimMat);
  boxLabelBar.position.set(0, 103.95, 15.55);
  boxLabelBar.castShadow = false;
  enclosurePart.group.add(boxLabelBar);

  // 暗箱内侧的极细灯带：把箱体轮廓从深色背景里勾出来
  const boxLedMat = new THREE.MeshBasicMaterial({
    color: 0x35e0c8,
    transparent: true,
    opacity: 0.42,
    toneMapped: false
  });
  boxLedMat.userData.noHighlight = true;
  const boxLed = flat(new THREE.Mesh(new THREE.BoxGeometry(34, 0.1, 0.1), boxLedMat));
  boxLed.position.set(0, 100.6, -17.92);
  enclosurePart.group.add(boxLed);

  const boxStatus = flat(new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), boxLedMat));
  boxStatus.position.set(19.95, 96, 15.72);
  enclosurePart.group.add(boxStatus);

  /* 光路 */
  const beamGroup = new THREE.Group();
  beamGroup.name = "beam";
  root.add(beamGroup);

  const beamGeo = new THREE.CylinderGeometry(3.05, 5.2, 56, 40, 8, true);

  const coneMat = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1 },
      uWarm: { value: new THREE.Color(0xf0b57e) },
      uCool: { value: new THREE.Color(0xffe6c4) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uWarm;
      uniform vec3 uCool;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float edge = 1.0 - abs(dot(normalize(vNormal), normalize(vViewDir)));
        float a = 0.06 + 0.27 * pow(edge, 2.0) + 0.11 * (1.0 - edge);
        a *= smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.86, 1.0, vUv.y));
        vec3 col = mix(uWarm, uCool, smoothstep(0.05, 0.95, vUv.y));
        gl_FragColor = vec4(col, a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    toneMapped: false
  });
  const cone = flat(new THREE.Mesh(beamGeo, coneMat));
  cone.position.y = 42;
  cone.renderOrder = 3;
  beamGroup.add(cone);

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffe0b8,
    transparent: true,
    opacity: 0.24,
    blending: THREE.NormalBlending,
    depthWrite: false
  });
  const core = flat(new THREE.Mesh(cyl(1.15, 1.15, 56, 20), coreMat));
  core.position.y = 42;
  core.renderOrder = 3;
  beamGroup.add(core);

  const lineMats = [];
  [-1.5, 0, 1.5].forEach((x) => {
    const m = new THREE.MeshBasicMaterial({
      color: 0xa9743f,
      transparent: true,
      opacity: 0.36,
      blending: THREE.NormalBlending,
      depthWrite: false
    });
    const line = flat(new THREE.Mesh(cyl(0.05, 0.05, 54, 8), m));
    line.position.set(x, 42, 0);
    line.renderOrder = 4;
    beamGroup.add(line);
    lineMats.push({ mat: m, base: 0.42 });
  });

  const lampGlow2 = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffd2a0,
      transparent: true,
      opacity: 0.34,
      blending: THREE.NormalBlending,
      depthWrite: false
    })
  );
  lampGlow2.scale.set(12, 12, 1);
  lampGlow2.position.set(0, 14, 0);
  beamGroup.add(lampGlow2);

  const lensGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xdceeff,
      transparent: true,
      opacity: 0.24,
      blending: THREE.NormalBlending,
      depthWrite: false
    })
  );
  lensGlow.scale.set(9, 9, 1);
  lensGlow.position.set(0, 70.4, 0);
  beamGroup.add(lensGlow);

  const scanRing = flat(
    new THREE.Mesh(
      new THREE.TorusGeometry(2.75, 0.07, 8, 32),
      new THREE.MeshBasicMaterial({
        color: 0x0f9e8f,
        transparent: true,
        opacity: 0.9,
        depthWrite: false
      })
    )
  );
  scanRing.rotation.x = Math.PI / 2;
  scanRing.position.set(0, 33, 0);
  scanRing.visible = false;
  root.add(scanRing);

  /* 300 mm 标尺（选中镜头时出现） */
  const rulerGroup = new THREE.Group();
  rulerGroup.visible = false;
  root.add(rulerGroup);

  const rulerMat = new THREE.LineDashedMaterial({
    color: 0x2b7d8c,
    dashSize: 1.1,
    gapSize: 0.85,
    transparent: true,
    opacity: 0.8
  });
  const rulerLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(6.4, 40, 2.4),
      new THREE.Vector3(6.4, 70.0, 2.4)
    ]),
    rulerMat
  );
  rulerLine.computeLineDistances();
  rulerGroup.add(rulerLine);

  const tickMat = new THREE.LineBasicMaterial({ color: 0x2b7d8c, transparent: true, opacity: 0.65 });
  [40, 70.0].forEach((y) => {
    const tick = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(5.5, y, 2.4),
        new THREE.Vector3(7.3, y, 2.4)
      ]),
      tickMat
    );
    rulerGroup.add(tick);
  });

  const rulerTex = canvasTexture(256, 112, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.93)";
    ctx.fillRect(6, 10, w - 12, h - 20);
    ctx.strokeStyle = "rgba(24,40,56,0.16)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6, 10, w - 12, h - 20);
    ctx.textAlign = "center";
    ctx.fillStyle = "#1d2a33";
    ctx.font = '600 42px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("300 mm", w / 2, 60);
    ctx.fillStyle = "#6a7a86";
    ctx.font = '15px "JetBrains Mono", Consolas, monospace';
    ctx.fillText("LENS – EGG", w / 2, 86);
  });
  const rulerSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: rulerTex, transparent: true, opacity: 0.94, depthTest: false })
  );
  rulerSprite.scale.set(9.2, 4, 1);
  rulerSprite.position.set(9.4, 55.0, 2.4);
  rulerSprite.renderOrder = 6;
  rulerGroup.add(rulerSprite);

  /* 收尾：注册可拾取对象与材质 */
  parts.forEach((part, index) => {
    part.index = index + 1;
    part.group.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.partId = part.id;
      part.meshes.push(o);
      pickables.push(o);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        part.materials.push(m);
        if (m.emissive && !m.userData.noHighlight && m.userData.baseEmissive === undefined) {
          m.userData.baseEmissive = m.emissive.getHex();
          m.userData.baseEmissiveIntensity = m.emissiveIntensity;
        }
      });
    });
    part.materials = [...new Set(part.materials)];
  });

  /* 孵化器是落地设备，未按 1450 mm 实体建模：抬台取景时不入画，也不参与拾取 */
  if (benchLift) {
    incubatorPart.group.visible = false;
    const incIndex = parts.indexOf(incubatorPart);
    if (incIndex >= 0) parts.splice(incIndex, 1);
    for (let k = pickables.length - 1; k >= 0; k -= 1) {
      if (pickables[k].userData.partId === "incubator") pickables.splice(k, 1);
    }
  }

  // 地面展台定位环
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x2b7d8c,
    transparent: true,
    opacity: 0.30,
    depthWrite: false
  });
  const floorRing = new THREE.Mesh(new THREE.TorusGeometry(88, 0.07, 6, 160), ringMat);
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = 0.045;
  root.add(floorRing);

  // 阴影 pass 只保留光学主件，工位/孵化器/平台支撑不投影，控制三角面上限
  const noShadow = new Set(["incubator", "refs"]);
  parts.forEach((part) => {
    if (!noShadow.has(part.id)) return;
    part.group.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
  });
  table.castShadow = false;

  /* 交互状态 */
  let beamOn = true;
  let beamLevel = 1;
  let xrayOn = false;
  let xrayLevel = 0;
  let explodeOn = false;
  let scanProgress = null;
  let lastAnimating = false;

  /* 缓动：ease-out cubic，0.45 s；同一属性上的新目标会顶掉旧目标 */
  const tweens = [];
  function tween(obj, key, to, dur = 0.45, delay = 0) {
    for (let i = tweens.length - 1; i >= 0; i -= 1) {
      if (tweens[i].obj === obj && tweens[i].key === key) tweens.splice(i, 1);
    }
    tweens.push({ obj, key, from: obj[key], to, dur, t: -delay });
  }

  const openState = new Map();
  parts.forEach((part) => openState.set(part.id, { level: 0, applied: 0 }));

  /* 局部开合：一个 0→1 行程驱动多个可动件，行程内全部 ease-out */
  const OPENERS = {
    lamp(l) {
      lampShell.position.y = -2.6 * l;
      filament.material.opacity = 0.16 + 0.44 * l;
    },
    platform(l) {
      cradleSlides.forEach((s) => {
        s.position.x = 2.2 * l;
      });
    },
    egg(l) {
      eggLift.position.y = 36.8 + 2.4 * l;
    },
    lens(l) {
      knurl.rotation.y = 0.95 * l;
      glass.position.y = 70.55 - 0.55 * l;
      lensBottom.position.y = 70.0 - 0.3 * l;
    },
    spectrometer(l) {
      frontPanel.position.z = 3.1 * l;
    },
    ccd(l) {
      ccdHead.position.z = -2.8 * l;
      ccdHead.position.y = -0.25 * l;
      ccdHead.rotation.x = -0.1 * l;
    },
    computer(l) {
      monitorHead.rotation.y = -0.26 + 0.18 * l;
      monitorHead.rotation.x = -0.05 * l;
    },
    refs(l) {
      whitePlate.position.y = 8.2 + 1.3 * l;
      whitePlate.position.x = -26.0 - 0.6 * l;
      whitePlate.rotation.x = -0.34 - 0.7 * l;
    },
    incubator(l) {
      incDoor.position.z = 2.2 * l;
      incHandle.position.x = -31.2 - 0.8 * l;
    }
  };

  function setOpen(id, on) {
    const st = openState.get(id);
    if (!st) return;
    tween(st, "level", on ? 1 : 0, 0.45);
  }

  function setAllClosed() {
    openState.forEach((st) => {
      if (st.level > 0.001) tween(st, "level", 0, 0.45);
    });
  }

  function setRuler(on) {
    rulerGroup.visible = on;
  }

  const beamMats = [
    { mat: coneMat, base: 1 },
    { mat: coreMat, base: 0.09 },
    ...lineMats
  ];
  beamMats.push({ mat: lampGlow2.material, base: 0.4 });
  beamMats.push({ mat: lensGlow.material, base: 0.32 });

  const tmpEggPos = new THREE.Vector3();
  const tmpCutDir = new THREE.Vector3();

  function setBeam(on) {
    beamOn = on;
  }

  function setXray(on) {
    xrayOn = on;
    xrayLevel = on ? 1 : 0;
    inner.visible = on;
    innerMats.forEach(({ mat, base }) => {
      mat.opacity = on ? base : 0;
      // 内腔同样被剖面切掉，否则卵黄会鼓出切面之外
      mat.clippingPlanes = on ? [cutPlane] : [];
      mat.needsUpdate = true;
    });
    eggMat.transparent = false;
    eggMat.opacity = 1;
    eggMat.clippingPlanes = on ? [cutPlane] : [];
    eggMat.needsUpdate = true;
  }

  function setExplode(on) {
    explodeOn = on;
    if (on) {
      beamLevel = 0;
      beamGroup.visible = false;
    }
    parts.forEach((part, i) => {
      if (!part.explodeY) return;
      tween(part, "offsetY", on ? part.explodeY : 0, 0.5, on ? i * 0.04 : 0);
    });
  }

  function setScan(progress) {
    scanProgress = progress;
    const show = progress !== null && !explodeOn;
    scanRing.visible = show;
    if (show) {
      scanRing.position.y = 33.3 + progress * 6.4;
      const s = 0.92 + 0.14 * Math.sin(progress * Math.PI);
      scanRing.scale.setScalar(s);
    }
  }

  function setHighlight(id, on) {
    parts.forEach((part) => {
      const active = on === undefined ? part.id === id : on === true && part.id === id;
      part.materials.forEach((m) => {
        if (!m.emissive || m.userData.noHighlight) return;
        m.userData.highlight = active ? 1 : 0;
      });
    });
  }

  const tmpHighlight = new THREE.Color(C.accentSoft);

  function update(dt, t, camera) {
    // 缓动推进
    for (let i = tweens.length - 1; i >= 0; i -= 1) {
      const w = tweens[i];
      w.t += dt;
      if (w.t < 0) continue;
      const k = Math.min(1, w.t / w.dur);
      const e = 1 - Math.pow(1 - k, 3);
      w.obj[w.key] = w.from + (w.to - w.from) * e;
      if (k >= 1) tweens.splice(i, 1);
    }

    // 局部开合行程
    openState.forEach((st, id) => {
      const fn = OPENERS[id];
      if (!fn) return;
      if (st.level === st.applied) return;
      fn(st.level);
      st.applied = st.level;
    });

    // 拆解 / 合拢
    parts.forEach((part) => {
      part.group.position.y = part.baseY + part.offsetY;
    });

    // 选中高亮：统一淡入淡出，避免上一个零件残留发光
    let highlightMoving = false;
    parts.forEach((part) => {
      part.materials.forEach((m) => {
        if (!m.emissive || m.userData.noHighlight) return;
        const target = m.userData.highlight ? 0.12 : (m.userData.baseEmissiveIntensity ?? 0);
        const cur = m.emissiveIntensity;
        if (m.userData.highlight) m.emissive.copy(tmpHighlight);
        else if (Math.abs(target - cur) < 0.01) m.emissive.setHex(m.userData.baseEmissive ?? 0x000000);
        if (Math.abs(target - cur) < 0.004) {
          if (cur !== target) m.emissiveIntensity = target;
          return;
        }
        m.emissiveIntensity = cur + (target - cur) * (1 - Math.exp(-dt * 12));
        highlightMoving = true;
      });
    });

    // 光路淡入淡出
    const beamTarget = beamOn && !explodeOn ? 1 : 0;
    beamLevel += (beamTarget - beamLevel) * (1 - Math.exp(-dt * 7));
    if (Math.abs(beamTarget - beamLevel) < 0.003) beamLevel = beamTarget;
    const pulse = scanProgress !== null ? 1 + 0.12 * Math.sin(t * 9) : 1;
    beamGroup.visible = beamLevel > 0.012;
    beamMats.forEach(({ mat, base }) => {
      if (mat.uniforms?.uOpacity) mat.uniforms.uOpacity.value = base * beamLevel * pulse;
      else mat.opacity = base * beamLevel * pulse;
    });
    eggLight.intensity = 1.4 + 4.2 * beamLevel;

    // 剖面：裁切面始终朝向相机并穿过蛋心（蛋抬起后仍然正确）
    if (xrayOn && camera) {
      egg.getWorldPosition(tmpEggPos);
      tmpCutDir.copy(camera.position).sub(tmpEggPos);
      tmpCutDir.y = 0;
      if (tmpCutDir.lengthSq() < 0.0001) tmpCutDir.set(0, 0, 1);
      tmpCutDir.normalize().negate();
      cutPlane.normal.copy(tmpCutDir);
      cutPlane.constant = -cutPlane.normal.dot(tmpEggPos);
    }

    // 剖面内部结构
    xrayLevel += ((xrayOn ? 1 : 0) - xrayLevel) * (1 - Math.exp(-dt * 8));
    if (Math.abs((xrayOn ? 1 : 0) - xrayLevel) < 0.003) xrayLevel = xrayOn ? 1 : 0;
    inner.visible = xrayLevel > 0.02;
    innerMats.forEach(({ mat, base }) => {
      mat.opacity = base * xrayLevel;
    });

    // 扫描环呼吸
    if (scanRing.visible) {
      scanRing.material.opacity = 0.55 + 0.3 * Math.sin(t * 6);
    }
    if (explodeOn) scanRing.visible = false;

    lastAnimating =
      tweens.length > 0 ||
      highlightMoving ||
      Math.abs(beamTarget - beamLevel) > 0.002 ||
      Math.abs((xrayOn ? 1 : 0) - xrayLevel) > 0.002 ||
      scanProgress !== null;
  }

  return {
    root,
    benchLift,
    parts,
    pickables,
    monitor: { canvas: monitorCanvas, ctx: monitorCtx, texture: monitorTex },
    setHighlight,
    setBeam,
    setXray,
    setExplode,
    setScan,
    setRuler,
    setOpen,
    setAllClosed,
    isAnimating: () => lastAnimating,
    update
  };
}
