# 打包后 QA 自检清单（P1+P4 内部演示版）

> 用途：打包到桌面后 2–5 分钟冒烟，确认未漏文件、未混口径。问题按 Bug 单提 Chief（标题/模块/复现/预期/实际/严重等级/截图说明）。

## 0. 结构
- [ ] 包根目录保持 `dssf-demo\`（不要把文件直接摊到桌面根），否则 importmap 相对路径会白屏。
- [ ] 必须 HTTP 启动，不能双击 `index.html`（`file://` 下 ES Module/importmap 不可用）。
- [ ] 前端必需：`index.html`、`styles.css`、`serve.mjs`、`start-demo.cmd/ps1`、`README.md`、`src\{data,chart,rig,main}.js`、`vendor\three\build\{three.module.min.js,three.core.min.js}`、`vendor\three\examples\jsm\{controls\OrbitControls.js,geometries\RoundedBoxGeometry.js,environments\RoomEnvironment.js}`。
- [ ] 若带后端：同级 `server\`，`python -m uvicorn app:app --host 127.0.0.1 --port 8000` 可启动；无后端时前端应回退“本地演示桩/后端未连接”，不白屏。

## 1. 启动
```powershell
cd "$env:USERPROFILE\Desktop\dssf-demo"
.\start-demo.cmd   # 或 node serve.mjs 5173
# 带后端：另开窗口 cd ..\server; python -m uvicorn app:app --host 127.0.0.1 --port 8000
```
- [ ] `http://127.0.0.1:5173/?seed=42&result=1` 可打开，控制台无 ESModule/Three 404。
- [ ] （有后端）`http://127.0.0.1:8000/health` 返回 `ok:true, version/model.mode`。

## 2. P1 装置
- [ ] 5/9 部件可点、参数卡更新；光路（灯→蛋→镜头→传感器）、拆解（stagger）、剖面可用；剖面有“示意图，非真实解剖/医学影像”角标；镜头显示 30 cm；旋转不翻底、缩放可用。

## 3. P4 结果与口径
- [ ] `source` 三档分明：`demo` 显示代理/非论文权重；`model` 显示模型输出；`paper`/`?mode=paper` 只展示论文值，不输出逐蛋判定标签/prob（或按契约置空）。
- [ ] 论文值同屏不混口径：91.5% 与 84.6% 同屏；AUC 0.974/0.966 分口径标注；五折/固定内测/LOBO 不混算；不得写“AI 一定对”“无损”。
- [ ] 结果卡/页脚/剖面 Legal 文案在位；术语“可见–近红外 340–1020 nm”；置信度 < 0.6 应提示“低置信，建议复测 D5”（若实现）。

## 4. 后端契约（有后端时）
- [ ] `POST /api/predict {"sample_id":"DEMO-0102"}` 200；`{"d2":[681],"d5":[681]}` 200；`?mode=paper` 返回 `source:"paper"` 且 `label/prob_*` 为空+`paper_reference`。
- [ ] CSV：合法 681 点 200；`bad_rows`→400 `csv_rows`，`bad_header`→400 `csv_header`，`bad_range`→400 `spectrum_range`。

## 5. 兼容/降级
- [ ] 无 WebGL/低端降级不白屏；390×844 结果卡/布局可用（结果卡抽屉）。
- [ ] 已知未完成（不算本版缺陷，除非 Chief 改范围）：P2/P3、CSV 上传 UI、真实模型权重、进页默认 demo/paper 的最终决策。
