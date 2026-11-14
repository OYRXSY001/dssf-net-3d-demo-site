# DSSF-Net 演示 · 运行与部署（运维交付）

> 适用版本：首版 `dssf-demo`（P1 装置 + 结果闭环）。前端已可独立运行；后端推理/mock 由 Backend 提供后按本文契约接入。  
> 口径约束：结果 `source` 必须分开（`paper` / `demo` / `model`），同屏不混用；对外只用论文值。

## 1. 现状与边界

- 前端：纯静态（ES Module + importmap，Three.js 在 `vendor/three/`）。**不能 `file://` 打开**，必须 HTTP。
- 前端一键启动：`start-demo.cmd` / `start-demo.ps1` / `serve.mjs`（默认 `127.0.0.1:5173`）。
- 真实/Mock 推理：接入点在 [`src/data.js`](src/data.js) 的 `predict()`（见 [README.md](README.md) 第 3 节）。当前返回 `source: "demo"` 的演示桩。
- 本文提供：联调端口约定、CORS/反代模板、前后端一键启动脚本、发布/回滚/自检清单。后端未落地前，`start-all` 只起前端。

## 2. 本地联调（推荐端口）

| 组件 | 默认地址 | 说明 |
|---|---|---|
| 前端静态 | `http://127.0.0.1:5173` | `serve.mjs` / `start-demo.cmd` |
| 后端 API（建议） | `http://127.0.0.1:8000` | Backend 确认后更新；健康检查 `GET /health` |

### 2.1 前端

```powershell
# 在本目录（dssf-demo）下执行
cd .
node serve.mjs 5173
# 或双击 start-demo.cmd
```

### 2.2 后端（已交付，固定值见 [server/README.md](../server/README.md)）

- 目录：`..\server`（相对 `dssf-demo`，即包内 `server\`）
- 启动：`python -m uvicorn app:app --host 127.0.0.1 --port 8000`
- 健康：`GET /health` → `{"ok":true,"version":"0.1.0","model":{...}}`
- `POST /api/predict` 入参支持 `{"d2":[681],"d5":[681]}` 或 `{"sample_id":"DEMO-0102"}`（也支持纯数字）；已有 `GET /api/samples`。
- 默认 `source:"demo"`；`?mode=paper` 返回 `source:"paper"` 且 `label/prob_*` 为 `null`，并给 `paper_reference`（论文值不与逐蛋判定混用）。CORS 当前为 `*`，内网仍建议同源反代。

约定最小契约（与前端 `predict()` 对齐）：

- `GET /health` → `200 {"ok":true}`
- `POST /api/predict`
  - 入参（二选一，以 Backend 最终文档为准）：`{"d2":[681 numbers],"d5":[681 numbers]}` 或 `{"sample_id":"..."}`（681 点，340–1020 nm，步长 1 nm）
  - 出参：
    ```json
    {
      "prob_male": 0.21,
      "prob_female": 0.79,
      "confidence": 0.79,
      "label": "female",
      "source": "paper|demo|model",
      "note": "..."
    }
    ```
  - 规则：真实模型未接入时返回 `source:"paper"` 或 `source:"demo"` 并明确 `note`；论文值口径固定（91.5% / AUC 0.974 / 固定内测集 0.966），**不得在同一响应/页面混用口径**。
- （可选）`GET /api/samples` → 内置示例，便于无 CSV 演示。

开发期 CORS（后端侧）：允许 `Origin: http://127.0.0.1:5173`，方法 `GET,POST,OPTIONS`，头 `Content-Type`。生产/内网优先用 Nginx 同源反代，避免暴露端口与 CORS。

## 3. 前后端一键启动（`start-all`）

已提供 [`start-all.ps1`](start-all.ps1) / [`start-all.cmd`](start-all.cmd)。后端未配置时仅启动前端。

```powershell
# 仅前端
.\start-all.ps1

# 前端 + 后端（在 dssf-demo 目录运行，使用包内相对路径）
.\start-all.ps1 -BackendDir "..\server" -BackendCmd "python -m uvicorn app:app --host 127.0.0.1 --port 8000"
# 或设置环境变量后直接运行
$env:DSSF_BACKEND_DIR="..\server"
$env:DSSF_BACKEND_CMD="python -m uvicorn app:app --host 127.0.0.1 --port 8000"
.\start-all.ps1
```

> `BackendCmd` 由 Backend 最终确认；脚本不猜测 Python/Node/conda 环境。启动后自检 `http://127.0.0.1:5173/` 与 `http://127.0.0.1:8000/health`。

## 4. 内网/演示发布（Nginx 同源反代）

适用：同一台机器或内网演示，前端 `/`，API `/api/`、`/health` 反代后端。模板见 [`nginx.demo.conf`](nginx.demo.conf)。

要点：
- `root` 指向 `dssf-demo/`（发布时用拷贝出的 release 目录，不要直接指向开发工作区的可变路径，除非单机演示）。
- 静态资源带缓存；`index.html` 不长缓存，便于回滚/更新。
- `/api/` 与 `/health` 代理到 `127.0.0.1:8000`（按实际端口改）。
- **必须包含 `vendor/three/build` 与实际用到的 addon**（ESM importmap 依赖路径），不要只拷 `src/` + `index.html`。
- **必须包含 `audio/`（讲解音轨 + `manifest.json`）**，且静态服务要返回 `audio/mpeg`；缺 `audio/` 时讲解会自动退到系统 TTS 或纯字幕（能跑但没那个女声）。
- 若启用 HTTPS，对外域名/证书由实际环境决定；本项目首版以内部演示为主。

## 5. 发布与回滚

### 发布（静态优先）
1. 确认 `source` 切换策略：未接真实模型 → `paper`/`demo`；接入后切 `model`，保留切回开关（配置或后端返回）。
2. 生成 release 目录（示例名 `dssf-demo_YYYYMMDD-HHMM`）：包含 `index.html`、`styles.css`、`src/`、`audio/`、`serve.mjs`、`vendor/three/build`、`vendor/three/examples/jsm` 中**实际引用的** addon（当前至少 3 个，以上线前 `index.html`/importmap 为准）。
3. 冒烟：`GET /` 200；`?seed=42&result=1` 出结果卡；`GET /health`（如有后端）200；浏览器控制台无报错。
4. Nginx 切 `root`/reload，或替换静态目录（原子切换：新目录就绪 → 改软链/配置 → reload）。

### 回滚
- **前端**：切回上一个 release 目录 + Nginx reload。`index.html` 不长缓存可加速生效；若已对 `index.html` 设缓存，发布时用 `?v=` 或文件名策略（首版未强制，单机演示手动刷新即可）。
- **后端**：切回上一版本进程/镜像；或临时将 `predict` 返回 `source:"paper"` 并给论文值，前端展示不混口径。
- **紧急止血**：后端不可用时，前端 `predict()` 保持 `demo` 桩（当前行为）或改为纯论文展示；不要让页面静默失败。

## 6. 自检清单（演示前 2 分钟）

- [ ] `http://127.0.0.1:5173/` 可打开，装置与结果卡正常（`?seed=42&result=1`）。
- [ ] 控制台无报错；ESM/Three 路径正常（非 `file://`）。
- [ ] （有后端）`/health` 200；`/api/predict` 返回含 `source`，口径不混用。
- [ ] 免责声明/示意图角标/页脚已按 Legal 文案落地（发布前核对）。
- [ ] 无 WebGL 时降级页可见，不白屏。

## 7. 待 Backend 确认后补齐

- 后端目录、启动命令、监听端口、`/api/predict` 入参字段最终版。
- 是否需要 `docker-compose.demo.yml`（前端 Nginx + 后端）及镜像基础环境（Python/conda/模型权重路径、μ/σ）。
- 真实模型 `source:"model"` 的权重加载与回滚开关（Chief 已确认：权重未提供则保持 paper/demo）。

---
*Ops 交付。业务逻辑/模型/前端交互缺陷分别找 Backend/Frontend；本文档随契约更新。*
