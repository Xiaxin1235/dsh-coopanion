# 验收与交付证据索引

本目录保留历史证据原字节和原路径。[当前交付状态](../README.md)统一说明哪些结论后来有补充；每份报告只证明其中记录的提交、版本、包摘要和测试边界。

| 记录 | 适用范围 |
|---|---|
| [v0.4.9 正式交付](releases/v0.4.9/README.md) | main／Release CI、六组安装、npm 与 Release 同包身份 |
| [M1](m1/README.md)、[M2](m2/README.md)、[M3](m3/README.md)、[M4](m4/README.md)、[M5](m5/README.md)、[M6](m6/README.md) | 六个不同实现提交上的 v0.4.8 本地测试包；均不是已发布 v0.4.8 或 v0.4.9 的分发身份 |
| [N0 说明](../archive/2026-10-notifications/notification-n0.md)、[CI 汇总](notification-n0/ci-final-summary.json) | 私有原型及单实例 macOS 系统通知实机；不能外推为后续分发包通过 |
| [N3 说明](../archive/2026-10-notifications/notification-n3.md)、[CI 汇总](notification-n3/ci-final-summary.json) | v0.4.4 通知整合候选的受控集成验收 |

M1–M6 中“尚未发布”“其他里程碑未启动”“远端 CI 未执行”均为当时结论，当前实现已纳入 v0.4.9。M2–M6 的 `release-notes.md` 是包检查器保存的既有 v0.4.8 发布说明快照，不是相应里程碑的发布声明。

历史命令中的 `/Users/jam/...`、`.cache/m*/clean`、浏览器和 runtime 路径仅用于复现原环境，换机器或复验当前版本时应重新定位。旧包、原日志和缓存可能只存在于原工作区；可移植证据以已入库文件、不可变提交及版本化 Release 附件为准。
