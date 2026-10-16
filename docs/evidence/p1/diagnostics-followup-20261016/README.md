# 诊断候选配置纠正与状态复核

日期：2026-10-16（Asia/Shanghai）。本记录补充[13:40 的候选安装与启动记录](../diagnostics-20261016/README.md)，保留原文件、原摘要和原路径。

## 自主陪伴有效时间的更正

七天采样于 13:38:49 启动时，虽然本机已开启 interactive 和 diagnostics，但遗漏 `roam` 总许可；当时自动活动与邀请不可用。采样器可以继续记录资源，因此“进程运行／mode=interactive”不能证明自主陪伴已经生效。

用户询问开关后，后续只读核对确认配置已为 `roam=true`、`dailyRhythm=false`（配置缺省，按 schema 默认）、`companionship=interactive`、`diagnostics=true`。见[配置及真实诊断摘要](local-configuration-check.json)，记录包含确切核对时间、配置原字节摘要、实际包版本／构建身份及已发生的活动计数，不保存其他配置或接口凭证。

**这次核对不确定 roam 的确切启用时间。** 原始采样启动前缀保留为资源记录，不能当作自主行为／邀请有效体验；10 月 23 日 13:38:49 的原截止时间也不能自动证明七天体验足额。P1-J 仍须核对本人有效使用天数、至少三天各 30 分钟无任务后台场景及最后三天评分；不足时另建补充记录，不覆盖原数据或伪造起点。

## 正在运行的两条记录

| 文件 | 解释 |
|---|---|
| [本机采样参数](local-metadata.json) | 每 30 秒采样、固定三份脚本摘要；与候选包及 VM 相同 |
| [本机进度快照](local-progress.json) | 只证明其中 measuredAt 时点已经产生样本与活动，不证明七天完成 |
| [本机控制进程快照](local-controller-check.json) | 原墙钟截止和进程身份；reason=running 是文件捕获时的状态，接手时重新核对 |
| [VM 进度快照](vm-progress.json) | 新包两小时观察仍在运行，最终报告尚未产生；预期 15:34 后结束 |
| [远端交付核对](remote-delivery-check.json) | 最新 GitHub Release 仍 v0.4.9，市场 PR 仍 open，旧 d17029d CI 为 failure |
| [候选 CI 查询](candidate-ci-check.json) | 源码 3a93a36 的远端工作流记录为零，不能继承旧包矩阵结论 |
| [文档整理检查](documentation-checks.json) | Markdown 链接／锚点、元数据及既有文件字节完整性检查 |

本轮只整理文档并做只读核对，没有修改产品、安装包、开关、进程或试用截止时间。VM 控制器独立 profile 的 `roam=true` 已在启动器源码固定，不受日常 Desktop 最初漏开的影响；两个环境分别验收。

当前产品来源仍为 `3a93a369bfa72f53941bd8a5c45c3cdd6ca58e07`，包 SHA-256 仍为 `56d55538d0f30e0f677e4ff0748fa23991990434724ff7371c48a01cfa476ec1`。本目录数据以 `sha256.json` 固定；后续结果继续新增记录。
