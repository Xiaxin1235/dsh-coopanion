# N0 验证记录

> 历史归档：下文状态、命令、分工和“下一步”仅适用于记录时的提交与测试包，不是当前执行指令。现行入口见[文档索引](../../README.md)，当前范围见[路线图](../../roadmap.md)。

日期：2026-10-12。状态：N0 已完成；共同实现基线为 `213becb0eec6a23ede0768cee36d01933c83bbab`。

插件及锁文件版本保持 v0.4.4。N0 使用工作区内的私有原型与 CI artifact 进行验证。

## 已完成检查

| 检查 | 结果 | 证据 |
|---|---|---|
| 共享协议、默认值、严格请求与完整身份 | pass | `tests/notification-contract.test.ts` |
| 网页通知权限、过期领取、token 去重、显示／点击回执、失败及释放 | pass | 同一单元文件，共 4 项 |
| 类型、现有单元及发布流程回归 | pass | 本地类型检查，35 项 Vitest 与 10 项 release-checks |
| DSH 0.2.0-rc.2 / 0.2.1-alpha.1 公开请求与投影 | pass | `tests/notification-host-contract.mjs`；本地 `artifacts/notification-n0/local/notification-host-*.json` |
| 正式插件机制安装私有原型 | pass | 独立 Desktop profile 的官方 CLI 安装结果 |
| 签名 DSH 内网页通知请求与显示 | pass | 本地 `artifacts/notification-n0/local/native-receipts.jsonl` 中的 `dsh-app:`、protocol 1、requested 与 shown |
| macOS 通知中心来源与留存 | pass | [原始截图](../../evidence/notification-n0/macos-notification-center.png)，来源为 DeepSeek Harness |
| 通知点击返回源会话 | pass | [单实例摘要](../../evidence/notification-n0/single-instance-summary.json)、[原始回执](../../evidence/notification-n0/single-instance-receipts.jsonl)及[源会话截图](../../evidence/notification-n0/macos-single-instance-click.png) |
| 源会话完整身份与原生日志导出 | pass | 公开 `sessionController.create`，导出 ZIP 中的完整 header id 与通知一致；[原始 ZIP](../../evidence/notification-n0/single-instance-session.zip) |
| 首轮远端三平台 CI 与六组安装检查 | pass | [CI 38204361687](https://github.com/takboo/dsh-coopanion/actions/runs/38204361687)，10 个 job 全部通过 |
| 公开创建与导出校验的六组 CI 复核 | pass | [CI 38211824330](https://github.com/takboo/dsh-coopanion/actions/runs/38211824330)，10 个 job 全部通过；[最终核对摘要](../../evidence/notification-n0/ci-final-summary.json) |

## 远端 CI 基线

最终实现提交为 `213becb0eec6a23ede0768cee36d01933c83bbab`，CI 38211824330 于 2026-10-12 14:30（Asia/Shanghai）全部通过。实际检出合并引用为 `c1069d8c2e7193374993a8d30bf0e96a6d3d5b03`，父提交包含实现提交，两者 Git tree 同为 `7448cbec4c81b78de90871acf4a3a765f35d8ecb`。

下载并核对六份宿主接口报告及六份公开创建／导出报告：每组七项接口检查通过，插件版本均为 0.4.4；导出 header id 与各自通知源会话的完整 id 一致。macOS CI 私有原型的四份文件 SHA-256 与单实例原生验证产物全部一致。原始报告保留实际 checkout 身份，核对结果及报告摘要见 [最终 CI 证据](../../evidence/notification-n0/ci-final-summary.json)，下载产物位于本地 `artifacts/notification-n0/ci-38211824330/`。

以下首轮记录继续保留，用于追溯检查进展。

[PR #6](https://github.com/takboo/dsh-coopanion/pull/6) 的源码提交为 `7d6e1089951d601d68031f9d92d02fa792c47056`。CI 于 2026-10-12 12:46（Asia/Shanghai）完成：工作流语法、Linux／macOS／Windows 测试及三平台 × 两版 DSH 的六组实际安装检查全部通过。

CI 实际检出 PR 合并引用 `1b109668307474dc57e277bd8274a19dc15d5e5d`，其父提交包含上述 PR head；两者 Git tree 均为 `910fdde9f491464a5733ba1fe9fa57a40419cc0f`。六份宿主报告保留实际合并引用 commit、插件 v0.4.4、宿主版本、实现摘要和控制样本事件。

运行结果及安装 artifact 保留在本地 `artifacts/notification-n0/ci-38204361687/`，核对摘要见 [CI 证据摘要](../../evidence/notification-n0/ci-summary.json)。

原 DSH 任务已完成。用户明确批准停止剩余开发服务器并暂时退出原实例；进程与端口确认退出后进行单实例测试，完成后恢复原 DSH。

## 单实例原生验证

最终源会话为 `notification-n0-1791783570096`，通过公开 `sessionController.create` 创建。同一 token `n0-1791783570111` 依次收到 requested、shown、clicked；测试界面聚焦并选中 notification-n0 会话。原生菜单导出 `dsh-session-notification-n0-1791783570096.zip`，ZIP 的 session header id 与提醒中的完整身份一致。

初次内存会话已验证窗口返回，但其导出为 HTTP 404。原型随后使用公开会话创建接口，完成持久化 header、通知点击和原生导出核对；原始回执继续保留。双实例点击未回到源窗口的历史结果同样保留。

原生摘要记录实际应用版本、OS 版本、原型文件摘要、单 token 回执链、原始截图／回执摘要和 ZIP 身份核对。对应 CI 安装用例调用同一原型，验证公开创建及 `/api/session.export` 返回的完整 header id。

## 环境与原始证据

本机 Desktop 为 0.2.0-rc.2，bundle id 为 `com.deepseek.dsh`，签名身份为 Hangzhou DeepSeek Artificial Intelligence Co., Ltd 的 Developer ID Application。网页权限为 granted，网页接口报告系统授权 unknown。使用独立 DSH_HOME、浏览器数据目录及随机 Host 端口，配置仅供本地测试的环境值，原型执行通知和会话操作。

通知中心截图 SHA-256：`df76a6dc5b8121fc21907c0334e7bfccf0918b6992a461bc29f5c0f60999c663`。原始回执与原型摘要保存在 `artifacts/notification-n0/local/`。双实例点击的观察结果与原始回执共同保留。

本次额外 Desktop、Host 和辅助进程已关闭，19221 调试端口已释放；隔离 profile、浏览器数据、原型构建目录和两套临时 DSH runtime 已清理。原 DSH 与原 Host 保持运行。

## 后续检查点

1. N1／N2 从共同实现提交 `213becb0eec6a23ede0768cee36d01933c83bbab` 创建两个 managed worktree，按计划文件归属并行实现 Host 与界面／角色。
2. 每条实现线提供局部检查和可审阅提交；集成负责人接入共享入口、配置及原生窗口消息。
3. N3 对整合产物进行完整自动检查和系统实机验收，并记录真实模型会话与用户验收结果。
