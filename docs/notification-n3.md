# N3 集成验收记录

日期：2026-10-12（Asia/Shanghai）。状态：进行中；插件及 shrinkwrap 版本为 0.4.4。执行条件见 [通知计划](notification-plan.md)，实现交接见 [N1／N2 记录](notification-implementation.md)。

本聊天从 `38961d9c5332e69cb9714f33f827677971b57467` 的干净 worktree 建立 `codex/notification-acceptance`。N0 的 CI、私有原型及签名通知证据继续按 [N0 记录](notification-n0.md) 归档；本记录核对整合后的实现。

## 失败、修复与复核

| 检查 | 初次结果 | 修复及当前结果 | 证据 |
|---|---|---|---|
| macOS 原生角色重启后的右键菜单 | fail | 独立回路将失败缩小到直接加载已保存的纸星星；同步 macOS 系统指针与 CDP 指针后，原完整回归 pass | [失败日志](evidence/notification-n3/desktop-before.log)、[完整复核日志](evidence/notification-n3/desktop-after.log) |
| 提问跟踪容量与原 answerer | fail | 500 个待处理请求后，新的运行提问访问缺失的跟踪记录而抛错；容量满时保留原 answerer 调用，并记录有界诊断。真实 Cordis 装配回归 pass | [失败日志](evidence/notification-n3/request-capacity-before.log)、`tests/notification-integration.test.ts` |
| 可选投影服务晚挂载与旧会话恢复 | fail | 服务提供时投影单元尚未注册，且仅恢复 live Agent 会话；在注册回合结束后折叠所有已加载会话，continued 请求恢复回归 pass | [失败日志](evidence/notification-n3/optional-projection-before.log)、`tests/notification-integration.test.ts` |
| 实际安装后连接原生窗口 | fail | Harness 挂载完成后桌宠异步准备运行时；安装测试增加实际调试端口的就绪检查，第二候选通过该步骤 | [首次失败日志](evidence/notification-n3/install-rc2-redacted.log)；原始日志保留在本地 `.cache/n3/install-rc2.log` |
| 角色完成提醒与最终回复的 IPC 顺序 | fail | 完成提示先到时阻塞最终回复；提示自动到期后也未继续回复。按完整 session／turn／seq 让最终回复接替同事件提示，并在提示到期后继续回复。两种消息顺序与自动到期浏览器回归 pass；完整安装检查 pending | [实际安装失败](evidence/notification-n3/install-rc2-v2-redacted.log)、[浏览器失败](evidence/notification-n3/completion-order-before.log)、`tests/notification-ui.mjs` |

原生指针辅助器通过 CoreGraphics 移动系统指针，继续执行普通 Playwright 点击，检查原生 hit 回执及实际 `pointerdown`／`contextmenu`。原生窗口实现保持交接状态。修复后的日志包含重启前后右键输入链、角色保存／删除及 clean shutdown。

容量边界最多保留 500 项待处理跟踪。达到上限的新问题继续交给 Harness 原 answerer，诊断为 `request-capacity-exceeded`；释放已有请求后可继续接纳跟踪。

## 检查状态

| 范围 | 结果 | 当前证据与范围 |
|---|---|---|
| Host／Client TypeScript | pass | 两套配置；当前投影恢复修复已复核 |
| 整合单元检查 | pass | 83 项 Vitest、10 项 release-checks；6 项真实装配检查覆盖投影恢复、continued 精确结算和容量边界 |
| 版本与压缩包 | pass | 第一修复候选 `689bf8cf3561185f2c5d2df1eeebdaf39b16dfeb` 的 0.4.4 验证包 SHA-256 为 `b5df6e9d200194c5f20bf9e900ededf2a163bf27f87fa12d6f2cd0bd52dde942`，位于本 worktree `.cache/n3/package/`；第二候选 `487774306fca3adb0d652939088484385b531992` 的摘要为 `2c713072985a6433afb446b6851f30454f79599c51b09599316e6336f74da64b`，位于 `.cache/n3/package-v2/` |
| 现有角色浏览器回归 | pass | `tests/ui.mjs`，独立 Chromium 无头会话 |
| 通知浏览器回归 | pass | `tests/notification-ui.mjs`，精确身份、continued、补提醒操作、阅读／输入／拖拽、双语、显示／代次清理、完成消息顺序与提示到期后的回复续显 |
| macOS 原生完整回归 | pass | 同一路径重启后菜单、角色删除及清理通过 |
| macOS × 两版 DSH 实际安装 | pending | 正式 CLI 安装、Host／Client 装配、新字段默认值及持久化、真实领取和回执、公开测试源会话导出 |
| 整合候选远端三平台／六组安装 | pending | 使用当前提交生成的同一 Linux artifact，单独保存 CI 身份及摘要 |
| 签名 DSH 系统实机 | pending | 单实例角色／系统通道、权限、通知中心、点击、补提醒、重连／锁屏／休眠 |
| 真实模型会话 | pending | 真实提问、工具审批与回合结束 |
| 用户验收 | pending | 通过 N3 条件后记录验收人及结论 |
| N4 文档、版本和交付 | pending | 按 N3 用户验收结论继续 |

安装检查使用正式宿主与真实 NotificationClient／Host 领取路由；网页 Notification 构造器为受控适配器。其 requested／shown 证明调用链及 Host 回执接受，OS 送达状态单独保持 pending。安装报告保存两次不同提醒的完整身份、领取 token、客户端、原生 generation／visibilityRevision、回执及公开导出 header。

## 下一检查点

1. 复核当前修复的完整套件和两版实际安装，绑定新的提交及验证压缩包。
2. 将具体候选提交、PR 内容及证据交给用户审阅，按本聊天授权安排公开分支和 draft PR，再执行远端三平台／六组安装。
3. 串行安排签名 DSH 的单实例实机及真实模型会话，完成环境清理并恢复原 DSH。
4. 记录用户 N3 验收后，在本聊天继续 N4。
