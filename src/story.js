import * as THREE from "three";

/* 3D 内全流程讲解：机位 + 装置状态 + 锚定卡片 + 数字人台词。
   不切屏，全程留在 P1 装置界面；卡片跟着 3D 部件走，数字人负责讲。
   由 main.js 注入 camera / controls / rig / cards / guide / setStep。 */

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

const SHOTS = {
  overview: { pos: v3(120, 86, 164), target: v3(14, 50, 0) },
  lamp: { pos: v3(27, 20, 58), target: v3(0, 13, 2) },
  path: { pos: v3(74, 54, 118), target: v3(10, 46, 0) },
  egg: { pos: v3(27, 42, 50), target: v3(1.4, 38, 1.5) },
  lens: { pos: v3(30, 73, 57), target: v3(6, 71, 2.6) },
  sensor: { pos: v3(32, 81, 60), target: v3(8, 80, 4) },
  ccd: { pos: v3(27, 92, 58), target: v3(4, 90, 3) },
  computer: { pos: v3(92, 46, 88), target: v3(42, 24, 0) },
  close: { pos: v3(140, 100, 194), target: v3(-4, 54, 0) }
};

const BEATS = [
  {
    id: "intro",
    shot: "overview",
    card: {
      id: "s-intro",
      anchor: "egg",
      side: "left",
      offsetX: -24,
      offsetY: 82,
      tag: "全流程 · 3D 讲解",
      title: "一束光，读出蛋里的差别",
      lead: "不破壳、不取样，孵化第 2–7 天透射测谱",
      rows: [
        ["样本", "坝上长尾鸡粉壳蛋 · 4 批"],
        ["光谱", "340–1020 nm · 681 点"],
        ["判定", "D2 与 D5 两日谱"]
      ]
    },
    say: "一枚正在孵化的鸡蛋，被一束连续光穿过。不破壳、不取样，只记录它吸收了哪些波长。",
    apply: (rig) => {
      rig.setExplode(false);
      rig.setXray(false);
      rig.setBeam(true);
      rig.setScan(null);
      rig.setHighlight("none");
    }
  },
  {
    id: "lamp",
    shot: "lamp",
    card: {
      id: "s-lamp",
      anchor: "lamp",
      side: "right",
      tag: "光源",
      title: "150 W 卤钨灯",
      stat: { value: "150", unit: "W", label: "连续谱光源" },
      rows: [
        ["型号", "Philips 15 V / 150 W"],
        ["谱宽", "340–1020 nm"],
        ["预热", "30 min 后光强稳定"]
      ],
      chart: { kind: "source", height: 74 }
    },
    say: "一百五十瓦卤钨灯，给出 340 到 1020 纳米的连续谱；预热三十分钟，光强才稳。",
    apply: (rig) => rig.setHighlight("lamp")
  },
  {
    id: "path",
    shot: "path",
    card: {
      id: "s-path",
      anchor: "platform",
      side: "left",
      tag: "光路",
      title: "光穿过蛋，再被收走",
      lead: "透射式：灯在下，蛋在中，镜头在上",
      rows: [
        ["镜头–蛋", "300 mm"],
        ["蛋位", "钝端朝上固定"],
        ["被挑掉的光", "就是信息"]
      ]
    },
    say: "灯在下，蛋在中，镜头在上，相距三百毫米。被蛋挑掉的那部分光，就是信息。",
    apply: (rig) => {
      rig.setBeam(true);
      rig.setHighlight("platform");
    }
  },
  {
    id: "egg",
    shot: "egg",
    card: {
      id: "s-egg",
      anchor: "egg",
      side: "right",
      tag: "吸收",
      title: "不同成分，吸收不同波段",
      lead: "雌雄胚胎的发育差别，会改写谱形",
      rows: [
        ["水 / 蛋白", "≈970 nm 强吸收"],
        ["脂类", "近红外吸收"],
        ["血红素", "可见波段"]
      ],
      tone: "accent"
    },
    say: "蛋里的水、蛋白和脂类，各自吸收不同波段；雌雄胚胎的发育差别，会改写谱形。",
    apply: (rig) => {
      rig.setXray(true);
      rig.setHighlight("egg");
    }
  },
  {
    id: "lens",
    shot: "lens",
    card: {
      id: "s-lens",
      anchor: "lens",
      side: "left",
      tag: "接收",
      title: "镜头收光",
      rows: [
        ["曝光", "890 ms × 3 帧"],
        ["单帧节拍", "2.67 s"],
        ["单蛋耗时", "12.5 s"]
      ]
    },
    say: "镜头收光，每帧曝光 890 毫秒，连拍三帧；一枚蛋十二点五秒。",
    apply: (rig) => {
      rig.setXray(false);
      rig.setHighlight("lens");
    }
  },
  {
    id: "sensor",
    shot: "sensor",
    card: {
      id: "s-sensor",
      anchor: "spectrometer",
      side: "right",
      tag: "分光",
      title: "681 个数，光变成数字",
      stat: { value: "681", unit: "点", label: "340–1020 nm · 1 nm 步长" },
      rows: [
        ["分辨率", "≈ 2.8 nm"],
        ["采样", "每 1 nm 一点"],
        ["输出", "T(λ) 强度序列"]
      ],
      chart: { kind: "spectrum", height: 78 }
    },
    say: "光谱仪把它切成 681 个点，每点 1 纳米。到这一步，光变成了数字。",
    apply: (rig) => rig.setHighlight("spectrometer")
  },
  {
    id: "correct",
    shot: "ccd",
    card: {
      id: "s-correct",
      anchor: "ccd",
      side: "left",
      tag: "校正",
      title: "电压不是透过率",
      lead: "T(λ) = (Is − Id) / (Iw − Id)",
      rows: [
        ["暗谱 Id", "关灯采集"],
        ["白谱 Iw", "空光路采集"],
        ["样品谱 Is", "透射采集"]
      ]
    },
    say: "原始读数只是电压。先采暗谱和空路白谱，扣掉灯与相机的漂移，才是透过率。",
    apply: (rig) => {
      rig.setScan(0.5);
      rig.setHighlight("ccd");
    }
  },
  {
    id: "day",
    shot: "egg",
    card: {
      id: "s-day",
      anchor: "egg",
      side: "left",
      tag: "一天",
      title: "每 12 小时一个时间点",
      rows: [
        ["频率", "每 12 h 一次"],
        ["一天", "2 个时间点"],
        ["七天", "14 点全齐才入组"]
      ]
    },
    say: "每十二小时测一次，一天两个点；七天十四个点全齐，才进数据集。",
    apply: (rig) => {
      rig.setScan(null);
      rig.setHighlight("egg");
    }
  },
  {
    id: "dual",
    shot: "overview",
    card: {
      id: "s-dual",
      anchor: "egg",
      side: "right",
      tag: "关键日",
      title: "单看一天，信号太弱",
      rows: [
        ["D5 单日", "ACC 78.0%"],
        ["D2 单日", "ACC 67.5%"],
        ["D2+D5 双日", "ACC 88.5%"]
      ],
      chart: { kind: "delta", height: 78 }
    },
    say: "单看一天信号弱：第五天也只有 78%。真正有用的是两天一起看。",
    apply: (rig) => rig.setHighlight("none")
  },
  {
    id: "delta",
    shot: "overview",
    card: {
      id: "s-delta",
      anchor: "computer",
      side: "left",
      tag: "差分谱",
      title: "ΔS = D5 − D2",
      stat: { value: "+10.5", unit: "pts", label: "相对单 D5 的准确率增益" },
      rows: [
        ["慢变成分", "被差分抵消"],
        ["快速发育", "差别被放大"],
        ["双日 AUC", "0.951"]
      ],
      tone: "accent"
    },
    say: "再看差分谱：第五天减第二天，慢变成分抵消，快速发育的差别被放大。",
    apply: (rig) => rig.setHighlight("none")
  },
  {
    id: "verdict",
    shot: "computer",
    card: {
      id: "s-verdict",
      anchor: "computer",
      side: "right",
      tag: "判定",
      title: "两天的谱，一起进网络",
      stat: { value: "91.5", unit: "%", label: "五折交叉验证准确率" },
      rows: [
        ["五折 AUC", "0.974"],
        ["200 枚留出", "91.5%"],
        ["留一批次", "84.6%"]
      ]
    },
    say: "双流网络分别看谱形和差分，输出概率。五折准确率 91.5%，换一批新蛋降到 84.6%。",
    apply: (rig) => rig.setHighlight("computer")
  },
  {
    id: "close",
    shot: "close",
    card: {
      id: "s-close",
      anchor: "egg",
      side: "left",
      tag: "边界",
      title: "研究验证，不是生产工具",
      rows: [
        ["样本", "单一品种 · 粉壳蛋"],
        ["口径", "论文条件 · 4 批数据"],
        ["下一步", "换品种需重新训练"]
      ],
      tone: "warn"
    },
    say: "不破壳、不取样，第二到第五天给出一个概率。它仍是研究验证，不是生产工具。",
    apply: (rig) => {
      rig.setHighlight("none");
      rig.setBeam(true);
      rig.setScan(null);
    }
  }
];

export function createStory({ camera, controls, rig, cards, guide, setStep, ui, markDirty, onState }) {
  const { bar, count, dots, muteBtn, nextBtn, stopBtn, replayBtn } = ui;

  let running = false;
  let token = 0;
  let index = -1;
  let shot = null;
  let saved = null;
  const timers = new Set();

  if (dots) {
    dots.innerHTML = "";
    BEATS.forEach((b, i) => {
      const d = document.createElement("i");
      d.title = b.card.title;
      if (i === 0) d.className = "is-now";
      dots.appendChild(d);
    });
  }

  const sleep = (ms) =>
    new Promise((resolve) => {
      const entry = { resolve };
      entry.t = window.setTimeout(() => {
        timers.delete(entry);
        resolve();
      }, ms);
      timers.add(entry);
    });

  // 跳过 / 结束时必须 resolve 掉等待中的 setTimeout，只 clear 会把播放协程挂死
  function flush() {
    timers.forEach((entry) => {
      window.clearTimeout(entry.t);
      entry.resolve();
    });
    timers.clear();
  }

  function flyTo(key, dur = 0.95) {
    const to = SHOTS[key] || SHOTS.overview;
    // 竖屏时把机位拉远，否则 12 拍特写会只剩局部
    const aspect = Number(camera.aspect) || 1;
    const k = aspect >= 0.9 ? 1 : Math.min(1.75, 1 + (0.9 - aspect) * 1.25);
    const toPos = to.target.clone().add(to.pos.clone().sub(to.target).multiplyScalar(k));
    shot = {
      fromPos: camera.position.clone(),
      toPos,
      fromTarget: controls.target.clone(),
      toTarget: to.target.clone(),
      t: 0,
      dur
    };
    markDirty?.();
  }

  function paintHud(i) {
    if (count) count.textContent = String(i + 1).padStart(2, "0") + " / " + String(BEATS.length).padStart(2, "0");
    if (!dots) return;
    Array.from(dots.children).forEach((d, k) => {
      d.classList.toggle("is-done", k < i);
      d.classList.toggle("is-now", k === i);
    });
  }

  function showBar(on) {
    if (!bar) return;
    bar.hidden = !on;
    bar.classList.toggle("is-in", on);
  }

  async function doSay(text) {
    try {
      await guide.say(text);
    } catch (err) {
      await sleep(2400);
    }
  }

  async function run(my) {
    for (let i = 0; i < BEATS.length; i += 1) {
      if (my !== token) return;
      index = i;
      const b = BEATS[i];
      paintHud(i);
      b.apply?.(rig);
      if (b.shot) flyTo(b.shot);

      // 上一张卡片先退场，再上本拍卡片，避免叠成一片
      const prev = i > 0 ? BEATS[i - 1].card.id : null;
      if (prev) cards.hide(prev);
      await sleep(320);
      if (my !== token) return;
      cards.show(b.card);

      await sleep(420);
      if (my !== token) return;
      await doSay(b.say);
      if (my !== token) return;
      await sleep(560);
    }
    finish();
  }

  function finish() {
    running = false;
    controls.enabled = true;
    // 收尾：清掉最后一张卡，镜头退回讲解前的位置，留一个完整的装置全景
    cards.hideAll();
    // 演出态解除：inspector / transport / hotspots 要回来
    delete document.body.dataset.story;
    const back = saved;
    saved = null;
    if (back) {
      shot = {
        fromPos: camera.position.clone(),
        toPos: back.pos.clone(),
        fromTarget: controls.target.clone(),
        toTarget: back.target.clone(),
        t: 0,
        dur: 1.1
      };
    }
    onState?.(false);
    if (count) count.textContent = "讲解结束";
    if (dots) Array.from(dots.children).forEach((d) => d.classList.add("is-done"));
    if (nextBtn) nextBtn.hidden = true;
    if (stopBtn) stopBtn.hidden = true;
    if (replayBtn) replayBtn.hidden = false;
    if (muteBtn) muteBtn.hidden = true;
    markDirty?.();
  }

  function play() {
    if (running) return;
    running = true;
    token += 1;
    index = -1;
    saved = { pos: camera.position.clone(), target: controls.target.clone() };
    controls.enabled = false;
    setStep(1);
    document.body.dataset.story = "1";
    if (nextBtn) nextBtn.hidden = false;
    if (stopBtn) stopBtn.hidden = false;
    if (replayBtn) replayBtn.hidden = true;
    if (muteBtn) { muteBtn.hidden = false; muteBtn.textContent = guide.isMuted() ? "已静音" : "静音"; }
    showBar(true);
    onState?.(true);
    markDirty?.();
    run(token);
  }

  function stop() {
    if (!running) {
      showBar(false);
      return;
    }
    running = false;
    token += 1;
    flush();
    guide.stop();
    cards.hideAll();
    delete document.body.dataset.story;
    controls.enabled = true;
    rig.setHighlight("none");
    rig.setXray(false);
    rig.setScan(null);
    rig.setExplode(false);
    rig.setBeam(true);
    showBar(false);
    if (nextBtn) nextBtn.hidden = false;
    if (stopBtn) stopBtn.hidden = false;
    if (replayBtn) replayBtn.hidden = true;
    onState?.(false);
    // 回到讲解前的位置，避免停下时停在某个特写里
    const fromSaved = saved;
    if (fromSaved) {
      shot = {
        fromPos: camera.position.clone(),
        toPos: fromSaved.pos.clone(),
        fromTarget: controls.target.clone(),
        toTarget: fromSaved.target.clone(),
        t: 0,
        dur: 0.7
      };
      saved = null;
    }
    markDirty?.();
  }

  function update(dt) {
    if (shot) {
      shot.t += dt;
      const k = Math.min(1, shot.t / shot.dur);
      const e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(shot.fromPos, shot.toPos, e);
      controls.target.lerpVectors(shot.fromTarget, shot.toTarget, e);
      camera.lookAt(controls.target);
      markDirty?.();
      if (k >= 1) shot = null;
    }
    cards.update();
  }

  muteBtn?.addEventListener("click", () => {
    const next = !guide.isMuted();
    guide.setMuted(next);
    muteBtn.textContent = next ? "已静音" : "静音";
    muteBtn.setAttribute("aria-pressed", String(next));
  });
  nextBtn?.addEventListener("click", () => {
    // 跳到下一拍：停语音 + 放掉等待
    guide.stop();
    flush();
  });
  stopBtn?.addEventListener("click", () => stop());
  replayBtn?.addEventListener("click", () => {
    if (running) return;
    cards.hideAll();
    play();
  });

  return {
    play,
    stop,
    update,
    isRunning: () => running,
    index: () => index,
    beats: BEATS,
    el: bar
  };
}
