import * as THREE from "three";

/**
 * 材质库 —— 写实 PBR（离线、无贴图资源，全部程序化）
 * 统一走 MeshPhysicalMaterial，靠环境光（studio.js 的柔光箱 HDRI）出金属反射。
 * 每调用一次返回新实例，方便按零件单独高亮（共享实例会串色）。
 */

const SRGB = THREE.SRGBColorSpace;
const cache = new Map();
const once = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function c2d(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d") };
}

function tex(canvas, { srgb = false, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = SRGB;
  return t;
}

/* ---------------- 程序化贴图 ---------------- */

/** 拉丝/喷砂金属：横向细纹 + 轻微脏污，做 roughnessMap / bumpMap */
function brushedMaps() {
  return once("brushed", () => {
    const rand = rng(20261110);
    const { canvas, ctx } = c2d(1024, 256);
    ctx.fillStyle = "#cfcfcf";
    ctx.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 2600; i++) {
      const y = rand() * 256;
      const x = rand() * 1024;
      const len = 24 + rand() * 380;
      const light = rand() > 0.5;
      ctx.strokeStyle = light ? "rgba(255,255,255,0.10)" : "rgba(60,60,60,0.07)";
      ctx.lineWidth = 0.6 + rand() * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + (rand() - 0.5) * 0.8);
      ctx.stroke();
    }
    // 大尺度不均匀（指纹、擦拭痕）
    for (let i = 0; i < 40; i++) {
      const g = ctx.createRadialGradient(rand() * 1024, rand() * 256, 0, rand() * 1024, rand() * 256, 40 + rand() * 160);
      g.addColorStop(0, rand() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(70,70,70,0.05)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 256);
    }
    const rough = tex(canvas, { repeat: [2, 1] });

    const b = c2d(512, 128);
    b.ctx.fillStyle = "#808080";
    b.ctx.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 1400; i++) {
      const y = rand() * 128;
      const light = rand() > 0.5;
      b.ctx.strokeStyle = light ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.14)";
      b.ctx.lineWidth = 0.7;
      b.ctx.beginPath();
      b.ctx.moveTo(rand() * 512, y);
      b.ctx.lineTo(rand() * 512, y + (rand() - 0.5) * 0.6);
      b.ctx.stroke();
    }
    const bump = tex(b.canvas, { repeat: [2, 1] });
    return { rough, bump };
  });
}

/** 喷漆件：橘皮纹 bump（细密柔和起伏） */
function paintBump() {
  return once("paint", () => {
    const rand = rng(778899);
    const { canvas, ctx } = c2d(512, 512);
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 3200; i++) {
      const r = 1.5 + rand() * 5;
      const x = rand() * 512;
      const y = rand() * 512;
      const v = rand() > 0.5 ? 255 : 0;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${v},${v},${v},0.10)`);
      g.addColorStop(1, "rgba(128,128,128,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return tex(canvas, { repeat: [3, 3] });
  });
}

/** 蛋壳：暖白底 + 低频色斑 + 细密斑点 + 气孔 bump */
function eggMaps() {
  return once("egg", () => {
    const rand = rng(31415926);
    const { canvas, ctx } = c2d(1024, 512);
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#f2e0d6");
    g.addColorStop(0.45, "#ecd4c9");
    g.addColorStop(0.78, "#e0c0b3");
    g.addColorStop(1, "#d3aa9d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    // 低频色斑（蛋壳本身的不均匀）
    for (let i = 0; i < 90; i++) {
      const x = rand() * 1024;
      const y = rand() * 512;
      const r = 20 + rand() * 120;
      const warm = rand() > 0.45;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, warm ? "rgba(196,150,132,0.055)" : "rgba(255,250,244,0.07)");
      gg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 细斑点（雀斑），低对比
    for (let i = 0; i < 2200; i++) {
      const x = rand() * 1024;
      const y = rand() * 512;
      const r = 0.5 + rand() * 1.7;
      ctx.fillStyle = `rgba(${150 + Math.floor(rand() * 40)},${112 + Math.floor(rand() * 30)},${96 + Math.floor(rand() * 30)},${0.03 + rand() * 0.07})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 极淡纵向肌理
    for (let i = 0; i < 30; i++) {
      const x = rand() * 1024;
      ctx.strokeStyle = "rgba(190,150,138,0.05)";
      ctx.lineWidth = 1 + rand() * 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 10, 170, x - 12, 330, x + 4, 512);
      ctx.stroke();
    }
    const map = tex(canvas);

    const b = c2d(1024, 512);
    b.ctx.fillStyle = "#808080";
    b.ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 26000; i++) {
      const v = rand() > 0.5 ? 255 : 0;
      b.ctx.fillStyle = `rgba(${v},${v},${v},${0.05 + rand() * 0.12})`;
      b.ctx.beginPath();
      b.ctx.arc(rand() * 1024, rand() * 512, 0.5 + rand() * 1.1, 0, Math.PI * 2);
      b.ctx.fill();
    }
    const bump = tex(b.canvas);
    return { map, bump };
  });
}

/** 台面：浅灰复合工作台面，细微麻点 + 大尺度色差 */
function tableMaps() {
  return once("table", () => {
    const rand = rng(424242);
    const { canvas, ctx } = c2d(1024, 1024);
    ctx.fillStyle = "#b5bdc7";
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 260; i++) {
      const x = rand() * 1024;
      const y = rand() * 1024;
      const r = 40 + rand() * 220;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rand() > 0.5 ? "rgba(255,255,255,0.09)" : "rgba(120,132,148,0.06)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 9000; i++) {
      const v = rand() > 0.5 ? 255 : 40;
      ctx.fillStyle = `rgba(${v},${v},${v},${0.015 + rand() * 0.035})`;
      ctx.fillRect(rand() * 1024, rand() * 1024, 1, 1);
    }
    return { map: tex(canvas, { srgb: true, repeat: [3, 2] }), bump: tex(canvas, { repeat: [3, 2] }) };
  });
}

/** 屏幕：把深色画布当自发光贴图（不做照明采样） */
function screenMaterial(map, { emissive = 1.15 } = {}) {
  return new THREE.MeshBasicMaterial({ map, toneMapped: true, color: new THREE.Color(emissive, emissive, emissive) });
}

/* ---------------- 材质工厂 ---------------- */

export function createMaterials() {
  const brushed = brushedMaps();
  const paint = paintBump();
  const egg = eggMaps();
  const table = tableMaps();

  const base = (color, roughness, metalness) => new THREE.Color(color);

  return {
    /** 阳极氧化铝 / 喷砂不锈钢 */
    metal({ color = 0x9aa4b2, roughness = 0.38, metalness = 1.0, brushedMap = true, repeat = [2, 1] } = {}) {
      const m = new THREE.MeshPhysicalMaterial({
        color: base(color),
        metalness,
        roughness,
        envMapIntensity: 1.15
      });
      if (brushedMap && metalness > 0.5) {
        m.roughnessMap = brushed.rough.clone();
        m.roughnessMap.needsUpdate = true;
        m.roughnessMap.repeat.set(repeat[0], repeat[1]);
        m.bumpMap = brushed.bump.clone();
        m.bumpMap.needsUpdate = true;
        m.bumpMap.repeat.set(repeat[0], repeat[1]);
        m.bumpScale = 0.012;
        m.roughness = roughness * 1.12;
      }
      return m;
    },

    /** 深色石墨件（底座、支架） */
    darkMetal({ color = 0x2b3038, roughness = 0.46, metalness = 0.82 } = {}) {
      const m = new THREE.MeshPhysicalMaterial({
        color: base(color),
        metalness,
        roughness,
        envMapIntensity: 1.0
      });
      m.roughnessMap = brushed.rough.clone();
      m.roughnessMap.repeat.set(2, 1);
      m.roughnessMap.needsUpdate = true;
      m.bumpMap = brushed.bump.clone();
      m.bumpMap.repeat.set(2, 1);
      m.bumpMap.needsUpdate = true;
      m.bumpScale = 0.016;
      return m;
    },

    /** 喷涂白/浅灰外壳：清漆 + 橘皮 */
    paint({ color = 0xe9edf1, roughness = 0.34, clearcoat = 0.5, clearcoatRoughness = 0.28 } = {}) {
      const m = new THREE.MeshPhysicalMaterial({
        color: base(color),
        metalness: 0.0,
        roughness,
        clearcoat,
        clearcoatRoughness,
        envMapIntensity: 0.85
      });
      m.bumpMap = paint.clone();
      m.bumpMap.needsUpdate = true;
      m.bumpMap.repeat.set(3, 3);
      m.bumpScale = 0.006;
      return m;
    },

    /** 线性低密度聚乙烯内衬 / 橡胶垫 */
    rubber({ color = 0x3a3f47, roughness = 0.82 } = {}) {
      return new THREE.MeshPhysicalMaterial({
        color: base(color),
        metalness: 0.0,
        roughness,
        clearcoat: 0.12,
        clearcoatRoughness: 0.8,
        envMapIntensity: 0.7
      });
    },

    /** 光学玻璃（真实折射太重，用高反射 + 低不透明做镜片观感） */
    glass({ color = 0xdff0ff, opacity = 0.26 } = {}) {
      return new THREE.MeshPhysicalMaterial({
        color: base(color),
        metalness: 0.0,
        roughness: 0.035,
        transparent: true,
        opacity,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        ior: 1.52,
        envMapIntensity: 2.3,
        depthWrite: false
      });
    },

    /** 蛋壳：次表面散射（sheen 模拟透出的软组织反光）+ 气孔 bump */
    eggShell() {
      const m = new THREE.MeshPhysicalMaterial({
        map: egg.map,
        bumpMap: egg.bump,
        bumpScale: 0.0045,
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.0,
        clearcoat: 0.2,
        clearcoatRoughness: 0.55,
        sheen: 0.38,
        sheenRoughness: 0.65,
        sheenColor: new THREE.Color(0xffc9b6),
        ior: 1.42,
        specularIntensity: 0.6,
        envMapIntensity: 0.75,
        side: THREE.DoubleSide
      });
      return m;
    },

    /** 工作台面 */
    tableSurface() {
      const m = new THREE.MeshPhysicalMaterial({
        map: table.map,
        bumpMap: table.bump,
        bumpScale: 0.004,
        roughness: 0.55,
        metalness: 0.0,
        clearcoat: 0.1,
        clearcoatRoughness: 0.6,
        envMapIntensity: 0.9
      });
      return m;
    },

    /** 灯、指示灯、屏下发光 */
    emissive({ color = 0xfff2dc, intensity = 3.2 } = {}) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: intensity,
        roughness: 0.4,
        metalness: 0.0,
        toneMapped: true
      });
    },

    screen(map) {
      return screenMaterial(map);
    },

    /** 屏幕玻璃罩：黑玻璃 */
    screenGlass() {
      return new THREE.MeshPhysicalMaterial({
        color: 0x0b0f16,
        metalness: 0.35,
        roughness: 0.06,
        transparent: true,
        opacity: 0.9,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 1.6
      });
    }
  };
}
