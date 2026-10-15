# N3 集成验收记录

> 历史归档：下文状态、命令、分工和“下一步”仅适用于记录时的提交与测试包，不是当前执行指令。现行入口见[文档索引](../../README.md)，当前范围见[路线图](../../roadmap.md)。

2026-10-13（Asia/Shanghai），N3 已完成。用户在本聊天确认“接受本轮集成范围，关闭 N3”。本轮验收覆盖可重复的集成验证；完整系统实机验收和外部真实模型会话留作后续验证，尚未通过。插件及 shrinkwrap 版本保持 0.4.4，N4 尚未开始。

## 已验证候选

- 源码：`83885647932a7c38d4c3c8c2796c82af0d95fa6f`，分支 `codex/notification-acceptance`，[draft PR #7](https://github.com/takboo/dsh-coopanion/pull/7)。
- [CI 38336752506](https://github.com/takboo/dsh-coopanion/actions/runs/38336752506)：10 个任务全部通过，包括三平台检查及 Linux／macOS／Windows × DSH 0.2.0-rc.2／0.2.1-alpha.1 六组正式安装。
- 实际 checkout：`bc6e73ac70d6981a01cd4f4b22bd5d98b7b5a9ce`，与候选源码的 Git tree 均为 `5bc516ec3f0c0203d86bf533c7795771967cf048`。
- canonical 包与固定别名 SHA-256：`d95d0c73ad5f6c27245fcc66bb54e046226d93ff1674b0fee235020777c6b0af`；包报告、对应源码和 SHA256SUMS 均已核对。

## 验收结果

| 范围 | 结果 |
|---|---|
| 类型、单元与构建 | 两套 TypeScript、88 项 Vitest、11 项发布及构建加载检查、元数据检查通过 |
| 浏览器与原生角色 | 三平台角色／通知界面、真实 Electron 窗口、输入、显示回执、重启及角色持久化检查通过 |
| 六组正式安装 | 正式 CLI 安装、Host／Client 加载、配置持久化及重启恢复、正常退出通过；未使用兼容性豁免 |
| 已安装插件与公开服务 | 每组 7 项宿主接口及 4 项服务链路检查通过：审批结算、限时提问 continued／稍后提醒／完整身份续答、提问取消及清理 |
| 通知投递与源会话 | 每组 2 个不同提醒身份、4 个 Host 接受的 requested／shown 回执通过；公开导出 header 与完整源会话 id 一致 |

本轮修正了提问观察器与既有 Harness 答复器的注册顺序，观察后继续委托原答复器处理；原生测试按实际显示回执检查状态，并追踪走动角色的位置取得真实 hit 回执后再点击。

六组安装中的 Web Notification 构造器为受控适配器；服务链路用例中的原生可见性和答复器为受控边界。报告没有将这些结果计作完整 OS 送达或外部模型验证。历史 N0 证据见 [N0 记录](notification-n0.md)，此前 N3 记录保留在 Git 历史中。
