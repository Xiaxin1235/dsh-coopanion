# 验收与交付证据索引

本目录保留历史证据原字节和原路径。[当前交付状态](../README.md)统一说明哪些结论后来有补充；每份报告只证明其中记录的提交、版本、包摘要和测试边界。

| 记录 | 适用范围 |
|---|---|
| [键盘跨平台修订](p1/keyboard-platforms-20261016/README.md) | 555503e 固定新包、macOS 原生与两版同包安装、Linux X11 合成键盘／仅鼠标、保守降级；Windows 原生和物理输入另验收 |
| [NPC 有限空间日常修订](p1/npc-life-20261016/README.md) | ac5938f 的独立本地包、完整回归／两宿主同包安装、输入 unknown 降级及短时资源对照；物理键盘／两小时资源／自然体验待验收 |
| [P1 自主陪伴初始记录](p1/README.md) | 固定基线与 S1–S3 历史快照；其中“最终候选”、版本 0.4.9 和未完成项只属于当时记录，不代表已发布包或当前候选 |
| [0.4.10 诊断候选安装与启动](p1/diagnostics-20261016/README.md) | 固定源码 3a93a36 与包摘要，本机／两宿主安装、新 VM 两小时及七天采样启动；不是长期验收通过 |
| [诊断候选后续核对](p1/diagnostics-followup-20261016/README.md) | 更正最初漏开 roam 的体验边界，保留原始启动记录；提供新时点配置、采样进度和远端状态 |
| [短时体验未通过／本机采样停止](p1/experience-rejected-20261016/README.md) | 用户取消七天与填表要求，本机采样提前结束；112 条原始数据保留，VM 资源观察独立继续 |
| [NPC 修订的原语能力评估](p1/npc-capability-20261016/README.md) | 当前鲸鱼与 API 2 的定点行走、按身份停止、姿态、表情和音效请求；不证明新调度、键盘感知、实际扬声器或新体验通过 |
| [v0.4.9 正式交付](releases/v0.4.9/README.md) | main／Release CI、六组安装、npm 与 Release 同包身份 |
| [M1](m1/README.md)、[M2](m2/README.md)、[M3](m3/README.md)、[M4](m4/README.md)、[M5](m5/README.md)、[M6](m6/README.md) | 六个不同实现提交上的 v0.4.8 本地测试包；均不是已发布 v0.4.8 或 v0.4.9 的分发身份 |
| [N0 说明](../archive/2026-10-notifications/notification-n0.md)、[CI 汇总](notification-n0/ci-final-summary.json) | 私有原型及单实例 macOS 系统通知实机；不能外推为后续分发包通过 |
| [N3 说明](../archive/2026-10-notifications/notification-n3.md)、[CI 汇总](notification-n3/ci-final-summary.json) | v0.4.4 通知整合候选的受控集成验收 |

M1–M6 中“尚未发布”“其他里程碑未启动”“远端 CI 未执行”均为当时结论，当前实现已纳入 v0.4.9。M2–M6 的 `release-notes.md` 是包检查器保存的既有 v0.4.8 发布说明快照，不是相应里程碑的发布声明。

历史命令中的 `/Users/jam/...`、`.cache/m*/clean`、浏览器和 runtime 路径仅用于复现原环境，换机器或复验当前版本时应重新定位。旧包、原日志和缓存可能只存在于原工作区；可移植证据以已入库文件、不可变提交及版本化 Release 附件为准。
