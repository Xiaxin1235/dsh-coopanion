# N0 验证记录

日期：2026-10-12。状态：单实例原生验证已通过，等待修正原型及新增导出检查的 CI 复核。

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
| macOS 通知中心来源与留存 | pass | [原始截图](evidence/notification-n0/macos-notification-center.png)，来源为 DeepSeek Harness |
| 通知点击返回源会话 | pass | [单实例摘要](evidence/notification-n0/single-instance-summary.json)、[原始回执](evidence/notification-n0/single-instance-receipts.jsonl)及[源会话截图](evidence/notification-n0/macos-single-instance-click.png) |
| 源会话完整身份与原生日志导出 | pass | 公开 `sessionController.create`，导出 ZIP 中的完整 header id 与通知一致；[原始 ZIP](evidence/notification-n0/single-instance-session.zip) |
| 首轮远端三平台 CI 与六组安装检查 | pass | [CI 38204361687](https://github.com/takboo/dsh-coopanion/actions/runs/38204361687)，10 个 job 全部通过 |
| 公开创建与导出校验的六组 CI 复核 | pending | 本轮新增实际安装用例，等待最新提交的 CI |

## 远端 CI 基线

[PR #6](https://github.com/takboo/dsh-coopanion/pull/6) 的源码提交为 `7d6e1089951d601d68031f9d92d02fa792c47056`。CI 于 2026-10-12 12:46（Asia/Shanghai）完成：工作流语法、Linux／macOS／Windows 测试及三平台 × 两版 DSH 的六组实际安装检查全部通过。

CI 实际检出 PR 合并引用 `1b109668307474dc57e277bd8274a19dc15d5e5d`，其父提交包含上述 PR head；两者 Git tree 均为 `910fdde9f491464a5733ba1fe9fa57a40419cc0f`。六份宿主报告保留实际合并引用 commit、插件 v0.4.4、宿主版本、实现摘要和控制样本事件。

运行结果及安装 artifact 保留在本地 `artifacts/notification-n0/ci-38204361687/`，核对摘要见 [CI 证据摘要](evidence/notification-n0/ci-summary.json)。

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

1. 保留已通过的 PR／CI 基线和六组宿主接口及安装报告。
2. 完成本轮公开创建／导出用例的三平台 × 两版宿主 CI 复核。
3. 将通过的原型文件摘要、共享接口、原生证据及 CI commit 固定为共同基线。
4. N0 完成条件全部满足后，自动创建 N1／N2 的两个 worktree，分别开始 Host 和界面实现。
