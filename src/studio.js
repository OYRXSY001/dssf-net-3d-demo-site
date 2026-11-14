import * as THREE from "three";

/**
 * 展台布光 —— 深色实验展厅
 * 深石墨背景 + 程序化柔光箱环境 + 主光 / 冷补光 / 青色轮廓光 + 地面光池与接触阴影。
 * 环境贴图仍然用程序化 equirect 画布生成（离线、无外部 HDRI）。
 */

function c2d(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d") };
}

/** 软边矩形光箱：先画中心亮块再用渐变擦边，避免出现硬边反射 */
function softbox(ctx, x, y, w, h, intensity, { vertical = true } = {}) {
  const g = vertical ? ctx.createLinearGradient(x, y, x, y + h) : ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, `rgba(255,255,255,0)`);
  g.addColorStop(0.18, `rgba(255,255,255,${intensity})`);
  g.addColorStop(0.82, `rgba(255,255,255,${intensity})`);
  g.addColorStop(1, `rgba(255,255,255,0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const gx = ctx.createLinearGradient(x, y, x + w, y);
  gx.addColorStop(0, "rgba(0,0,0,1)");
  gx.addColorStop(0.12, "rgba(0,0,0,0)");
  gx.addColorStop(0.88, "rgba(0,0,0,0)");
  gx.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = gx;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/** 程序化 equirect 暗影棚：顶部大光箱、左右灯条、低位暖光 */
function makeEnvTexture() {
  const W = 1024;
  const H = 512;
  const { canvas, ctx } = c2d(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, "#3a454e");
  g.addColorStop(0.22, "#232d35");
  g.addColorStop(0.48, "#141c23");
  g.addColorStop(0.68, "#0e151b");
  g.addColorStop(0.86, "#101820");
  g.addColorStop(1.0, "#161f27");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 顶部主柔光箱（正上方偏前）
  softbox(ctx, W * 0.28, H * 0.015, W * 0.44, H * 0.28, 1.0);
  // 左前灯条：金属纵向高光
  softbox(ctx, W * 0.09, H * 0.16, W * 0.07, H * 0.44, 0.95);
  // 右后灯条：冷色轮廓
  softbox(ctx, W * 0.85, H * 0.12, W * 0.065, H * 0.46, 0.85);
  // 正面低位补光
  softbox(ctx, W * 0.38, H * 0.42, W * 0.24, H * 0.20, 0.28, { vertical: false });
  // 低位暖光（卤钨灯的色温）
  const warm = ctx.createLinearGradient(0, H * 0.62, 0, H);
  warm.addColorStop(0, "rgba(255,166,92,0)");
  warm.addColorStop(1, "rgba(255,166,92,0.10)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, H * 0.62, W, H * 0.38);

  const t = new THREE.CanvasTexture(canvas);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** 背景球：冷灰蓝竖向渐变，接住地平线 */
function makeBackdrop() {
  const geo = new THREE.SphereGeometry(700, 48, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x16222c) },
      mid: { value: new THREE.Color(0x0c151c) },
      bot: { value: new THREE.Color(0x060a0e) }
    },
    vertexShader: `
      varying float vY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vY = normalize(wp.xyz - cameraPosition).y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      varying float vY;
      void main() {
        float t = clamp(vY * 1.15 + 0.5, 0.0, 1.0);
        vec3 c = t > 0.5 ? mix(mid, top, (t - 0.5) * 2.0) : mix(bot, mid, t * 2.0);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  return mesh;
}

/** 地面：深色哑光展台地面，中心有微弱光池 */
function makeFloor() {
  const { canvas, ctx } = c2d(1024, 1024);
  const g = ctx.createRadialGradient(512, 512, 0, 512, 512, 512);
  g.addColorStop(0, "#18222b");
  g.addColorStop(0.28, "#121b23");
  g.addColorStop(0.62, "#0b1218");
  g.addColorStop(1, "#080d12");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 1024);
  // 细微地面颗粒
  let seed = 90210;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 9000; i += 1) {
    const v = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.012 + rand() * 0.02})`;
    ctx.fillRect(rand() * 1024, rand() * 1024, 1, 1);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: t,
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.04,
    envMapIntensity: 0.22
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(700, 128), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.02;
  mesh.receiveShadow = true;
  return mesh;
}

/** 台架底下的接触阴影：一张径向渐变贴图，压住“悬浮感” */
function makeContactShadow() {
  const { canvas, ctx } = c2d(512, 512);
  const g = ctx.createRadialGradient(256, 256, 18, 256, 256, 256);
  g.addColorStop(0, "rgba(0,0,0,0.62)");
  g.addColorStop(0.42, "rgba(0,0,0,0.34)");
  g.addColorStop(0.76, "rgba(0,0,0,0.10)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: t,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(176, 118), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.04, 0);
  mesh.renderOrder = 1;
  return mesh;
}

/** 地面暖色光池（卤钨灯漏到台架下的余光） */
function makeLightPool() {
  const { canvas, ctx } = c2d(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,176,104,0.10)");
  g.addColorStop(0.45, "rgba(255,150,80,0.035)");
  g.addColorStop(1, "rgba(255,150,80,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: t,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.06, 2);
  mesh.renderOrder = 2;
  return mesh;
}

export function createStudio(renderer, scene, { benchLift = 0 } = {}) {
  const lift = benchLift || 0;
  const equirect = makeEnvTexture();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(equirect);
  equirect.dispose();
  pmrem.dispose();
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.62;

  const backdrop = makeBackdrop();
  scene.add(backdrop);
  const floor = makeFloor();
  scene.add(floor);

  const contact = makeContactShadow();
  contact.position.y += lift ? 0 : 0;
  scene.add(contact);
  const pool = makeLightPool();
  scene.add(pool);

  // 主光：左上前方，暖白，负责主要投影与体积
  const key = new THREE.DirectionalLight(0xfff1de, 2.85);
  key.position.set(104, 182 + lift * 0.9, 138);
  key.target.position.set(2, 42 + lift, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -140;
  key.shadow.camera.right = 140;
  key.shadow.camera.top = 180 + lift;
  key.shadow.camera.bottom = -60;
  key.shadow.camera.near = 30;
  key.shadow.camera.far = 560 + lift * 1.4;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.42;
  key.shadow.radius = 4;
  scene.add(key);
  scene.add(key.target);

  // 顶部展台聚光：在台面与地面画出光池
  const spot = new THREE.SpotLight(0xffe6ca, 0.42, 520, 0.44, 1.0, 1.5);
  spot.position.set(34, 250 + lift * 0.9, 96);
  spot.target.position.set(0, 34 + lift, 0);
  scene.add(spot);
  scene.add(spot.target);

  // 补光：右前偏冷，压低反差，不投影
  const fill = new THREE.DirectionalLight(0xbcd8f2, 0.44);
  fill.position.set(-140, 86, 118);
  fill.target.position.set(4, 40 + lift, 0);
  scene.add(fill);
  scene.add(fill.target);

  // 轮廓光：后上方，青色勾边
  const rim = new THREE.DirectionalLight(0xbfeaff, 0.95);
  rim.position.set(-74, 118 + lift * 0.9, -150);
  rim.target.position.set(2, 52 + lift, 0);
  scene.add(rim);
  scene.add(rim.target);

  // 极弱的天地补光，避免底面死黑
  const hemi = new THREE.HemisphereLight(0x5b7385, 0x05090c, 0.55);
  scene.add(hemi);

  scene.fog = new THREE.Fog(0x0a1117, 300, 1050);

  return {
    env: envRT.texture,
    backdrop,
    floor,
    lights: { key, fill, rim, spot, hemi },
    dispose() {
      envRT.dispose();
      scene.environment = null;
    }
  };
}
