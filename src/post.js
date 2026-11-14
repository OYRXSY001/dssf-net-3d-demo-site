import * as THREE from "three";

/**
 * 渲染管线：4xMSAA 场景 RT → 子像素抖动 + 时间累积（TAA）→ ACES 色调映射 + sRGB 输出。
 * 场景静止时累积到 maxSamples 后完全停止渲染（0 GPU 占用），任何相机移动/动画都会重置。
 * 注意：素材材质全部按线性空间写入 RT，色调映射只在最终 pass 做一次，所以 renderer.toneMapping 必须保持 NoToneMapping。
 */

const QUAD_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const ACCUM_FRAG = `
  uniform sampler2D tScene;
  uniform sampler2D tPrev;
  uniform float uWeight;
  varying vec2 vUv;
  void main() {
    vec3 s = texture2D(tScene, vUv).rgb;
    vec3 p = texture2D(tPrev, vUv).rgb;
    gl_FragColor = vec4(mix(p, s, uWeight), 1.0);
  }
`;

const PRESENT_FRAG = `
  uniform sampler2D tAccum;
  uniform float uExposure;
  varying vec2 vUv;
  vec3 aces(vec3 x) {
    const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }
  vec3 lin2srgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  }
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    vec3 c = texture2D(tAccum, vUv).rgb * uExposure;
    c = aces(c);
    c = lin2srgb(c);
    // 1/255 抖动，只为消除大面积渐变天空的色带，肉眼不可见
    c += (hash(vUv * 1024.0) - 0.5) / 255.0;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const HALTON2 = [0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875, 0.0625, 0.5625, 0.3125, 0.8125, 0.1875, 0.6875, 0.4375, 0.9375, 0.03125];
const HALTON3 = [0.3333, 0.6667, 0.1111, 0.4444, 0.7778, 0.2222, 0.5556, 0.8889, 0.037, 0.3704, 0.7037, 0.1481, 0.4815, 0.8148, 0.2593, 0.5926];

export function createTAA(renderer, scene, camera, { maxSamples = 32, exposure = 1.0 } = {}) {
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);

  const sceneRT = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    samples: 4,
    depthBuffer: true,
    stencilBuffer: false
  });
  sceneRT.texture.colorSpace = THREE.LinearSRGBColorSpace;

  const rtOpts = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    samples: 0,
    depthBuffer: false,
    stencilBuffer: false
  };
  let accumA = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  let accumB = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  accumA.texture.colorSpace = THREE.LinearSRGBColorSpace;
  accumB.texture.colorSpace = THREE.LinearSRGBColorSpace;

  const accumMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: ACCUM_FRAG,
    uniforms: {
      tScene: { value: sceneRT.texture },
      tPrev: { value: sceneRT.texture },
      uWeight: { value: 1 }
    },
    depthTest: false,
    depthWrite: false
  });

  const presentMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: PRESENT_FRAG,
    uniforms: {
      tAccum: { value: accumA.texture },
      uExposure: { value: exposure }
    },
    depthTest: false,
    depthWrite: false
  });

  const quad = new THREE.Mesh(quadGeo, accumMat);
  quad.frustumCulled = false;
  quadScene.add(quad);

  let width = 1;
  let height = 1;
  let dpr = 1;
  let samples = 0;
  let maxPixelRatio = 2;
  let pixelBudget = 4.2e6;

  const size = new THREE.Vector2();
  const stats = { triangles: 0, calls: 0 };

  function resize(cssW, cssH, devicePixelRatio) {
    width = Math.max(1, Math.floor(cssW));
    height = Math.max(1, Math.floor(cssH));
    dpr = Math.min(devicePixelRatio || 1, maxPixelRatio);
    while (width * dpr * height * dpr > pixelBudget && dpr > 1) dpr -= 0.1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, Math.round(size.x));
    const h = Math.max(1, Math.round(size.y));
    sceneRT.setSize(w, h);
    accumA.setSize(w, h);
    accumB.setSize(w, h);
    samples = 0;
  }

  function markDirty() {
    samples = 0;
  }

  function render(needsReset) {
    if (needsReset) samples = 0;
    if (samples >= maxSamples) return false;

    // 子像素抖动
    const total = samples;
    const jx = HALTON2[total % HALTON2.length] - 0.5;
    const jy = HALTON3[total % HALTON3.length] - 0.5;
    camera.setViewOffset(width, height, jx, jy, width, height);

    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);
    stats.triangles = renderer.info.render.triangles;
    stats.calls = renderer.info.render.calls;

    camera.clearViewOffset();

    // 累积
    const prev = samples === 0 ? sceneRT.texture : accumA.texture;
    accumMat.uniforms.tScene.value = sceneRT.texture;
    accumMat.uniforms.tPrev.value = prev;
    accumMat.uniforms.uWeight.value = samples === 0 ? 1 : 1 / (samples + 1);
    quad.material = accumMat;
    renderer.setRenderTarget(accumB);
    renderer.render(quadScene, quadCam);

    // 输出
    presentMat.uniforms.tAccum.value = accumB.texture;
    quad.material = presentMat;
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);

    const tmp = accumA;
    accumA = accumB;
    accumB = tmp;
    samples++;
    return true;
  }

  return {
    resize,
    render,
    markDirty,
    stats,
    get samples() {
      return samples;
    },
    get converged() {
      return samples >= maxSamples;
    },
    set exposure(v) {
      presentMat.uniforms.uExposure.value = v;
      samples = 0;
    },
    get exposure() {
      return presentMat.uniforms.uExposure.value;
    },
    get pixelRatio() {
      return dpr;
    },
    dispose() {
      sceneRT.dispose();
      accumA.dispose();
      accumB.dispose();
      accumMat.dispose();
      presentMat.dispose();
      quadGeo.dispose();
    }
  };
}
