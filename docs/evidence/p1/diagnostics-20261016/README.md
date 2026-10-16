# 0.4.10 本地诊断候选与采样启动记录

核对时间：2026-10-16 13:40（Asia/Shanghai）。这是候选安装及采样启动证据；两小时和七天结果尚未完成。

## 固定身份

- 源码：`3a93a369bfa72f53941bd8a5c45c3cdd6ca58e07`，本地分支 `codex/p1-local-diagnostics`。
- 包：`@takboo/dsh-coopanion@0.4.10`；SHA-256 `56d55538d0f30e0f677e4ff0748fa23991990434724ff7371c48a01cfa476ec1`。构建产品摘要为 `0aa015b2080da47056915b57b7c5ad28434d72b4bf9652c007ca0409962d3596`。
- [候选核验](candidate-verification.json)、[构建身份](build-info.json)和两个安装报告均指向这个包。后续文档提交不会重新打包或改变候选身份。
- [本机采样器摘要](local-sampler-metadata.json)与 [VM 采样器摘要](vm-two-hour-start-metadata.json)的三份脚本相同，来自包内源码；采样器只依赖 Node 内置模块。

## 已完成验证

本机 macOS 类型检查、211 项单测（另有 1 项平台跳过）、12 项 Node 兼容检查、浏览器／通知／收件箱／P1 UI 和原生回归通过；原生检查包含默认关闭、鉴权读取、热切不丢草稿、只读不改存档和独立采样器分段。Linux 候选源码 212 项单测通过。日志摘要及通过范围见 [验证清单](validation.json)；原始日志仍保存在本机忽略目录。

正式发布宿主的真实 profile loader 与同一包通过：[DSH 0.2.0-rc.2](installed-rc2.json)、[DSH 0.2.1-alpha.1](installed-alpha1.json)。报告分别核对版本／包／源码身份、默认关闭、设置热同步、草稿保持且不进入摘要、关闭后撤下接口。

用户日常 Desktop 0.2.0-rc.2 通过插件管理器安装并重启加载，显示 v0.4.10 Running；[1042 个包内文件逐字节一致](local-daily-files.json)。[真实进程诊断](local-daily-install.json)确认版本、构建身份、interactive 模式，且未使用 `--no-sandbox` 或调试端口。用户明确选择开启互动陪伴和本地诊断，界面分别显示 Interactive、on、Saved。

第一次更新被宿主 pnpm 的 minimumReleaseAge 校验拒绝：初始锁文件仍指向旧版 0.4.9，校验其发布时间，安装失败留下模块文件与锁文件不一致。原始 profile、失败锁文件均已私下备份；仅删除旧版 importer／package／snapshot 后由同一 Desktop 安装器重新生成锁文件并成功安装。没有放宽年龄策略；[其他直接依赖的规格及锁定解析、策略文件均保持原值](local-profile-update.json)。更新后须重启宿主，避免新 Client 与旧内存模块混用。

## VM 观察

Linux PVE VM 使用真实时间、互动模式、固定 RNG 17、内置角色、Xvfb／Openbox 和 SwiftShader。控制器仅在启动时用 CDP 固定场景及检查可见渲染，周期数据全部由独立采样器读取产品接口和 `/proc`；不等价于真实 GPU 能耗。

同包 60 秒短测通过：[场景身份](vm-smoke-metadata.json)、[原始摘要](vm-smoke-summary.json)。20 秒首／末窗口 RSS 均值差约 14.05 MiB，请求排空；它不是两小时资源验收。

新两小时任务于 **13:33:50** 开始采样，预计 **15:33:51** 后结束。独立会话启动并经 SSH 断开／重连确认继续运行；每 5 秒采样，首／末窗口各 1800 秒。远端目录为 `~/dsh-p1-lab/results/diagnostics-two-hour-01`，最终入口 `summary.json` 和 `sampling/summary.json`；启动身份见 [metadata](vm-two-hour-start-metadata.json)，交接时点状态见 [progress](vm-two-hour-progress-at-handoff.json)。此处快照不可冒充最终报告。

旧包 d17029d 的观察已在 46 分钟提前停止，原始证据保留在 [旧记录](../vm-20261016/README.md)，不拼接进新包结果。

## 本机七天被动采样

按用户选择于 **10 月 16 日 13:38:49** 启动，墙钟截止 **10 月 23 日 13:38:49**。每 30 秒采样，日志上限 128 MiB，首／末窗口 1800 秒；采样脚本从固定候选包提取，明确绑定日常实例和版本／产品摘要。轻量独立控制进程负责墙钟截止，避免系统休眠延长试用期限。见 [启动记录](local-seven-day-launch.json)、[采样参数与脚本摘要](local-sampler-metadata.json)。

原始记录保存在本机 `artifacts/p1-local-seven-day-20261016/`，每分钟更新 `progress.json`，结束生成 `summary.json`；外层 `.control.json` 记录墙钟截止与进程结束。它不抢焦点、不输入、不截图、不防休眠、不上传数据。应用关闭／诊断关闭／重启或休眠缺口分段；更换候选身份会停止并要求重新建立记录。系统重启后不会自动恢复，须用新输出目录重新启动采样。

本机另有 `artifacts/p1-vm-20261016/seven-day-diary.csv` 空白记录表及试用说明，评分必须由用户填写。至少三天各有 30 分钟无任务后台场景，能举出三类自主行为及一项相处后变化；最后三天日常感 ≥4/5、打扰 ≤2/5 才符合 P1-J，自动采样不能替代这些判断。

## 待验收边界

新的三平台／两版宿主远端 CI 未运行；原 d17029d 的 macOS CI 失败已有本机修正与回归，不能写成远端通过。Windows 命名管道及资源采样、物理多屏／锁屏／休眠、通知中心送达仍保留各自验证边界。两小时资源、七天体验尚待最终记录，P2 尚未开始；没有推送、发布 npm 或 GitHub Release。

本目录 JSON 原始字节由 `sha256.json` 固定；后续结果使用新文件补充。
