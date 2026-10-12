# N0 验证记录

日期：2026-10-12。状态：进行中，等待远端 CI 与单实例点击验收。

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
| 通知点击返回源会话 | pending | 双实例测试点击激活原 DSH，测试实例未收到 clicked 回执；后续单实例复核 |
| 远端三平台 CI 与六组安装检查 | pending | N0 分支的 CI 运行记录补充于此 |

## 环境与原始证据

本机 Desktop 为 0.2.0-rc.2，bundle id 为 `com.deepseek.dsh`，签名身份为 Hangzhou DeepSeek Artificial Intelligence Co., Ltd 的 Developer ID Application。网页权限为 granted，网页接口报告系统授权 unknown。使用独立 DSH_HOME、浏览器数据目录及随机 Host 端口，配置仅供本地测试的环境值，原型执行通知和会话操作。

通知中心截图 SHA-256：`df76a6dc5b8121fc21907c0334e7bfccf0918b6992a461bc29f5c0f60999c663`。原始回执与原型摘要保存在 `artifacts/notification-n0/local/`。双实例点击的观察结果与原始回执共同保留。

本次额外 Desktop、Host 和辅助进程已关闭，19221 调试端口已释放；隔离 profile、浏览器数据、原型构建目录和两套临时 DSH runtime 已清理。原 DSH 与原 Host 保持运行。

## 后续检查点

1. 提交 N0 分支，通过 PR 运行三平台 CI；保留六组宿主接口及安装报告。
2. 原 DSH 当前任务结束后，在单实例条件下复核通知中心点击、窗口激活和完整 sessionId。
3. 将通过的原型产物、共享接口及 CI commit 固定为共同基线。
4. N0 完成条件全部满足后，自动创建 N1／N2 的两个 worktree，分别开始 Host 和界面实现。
