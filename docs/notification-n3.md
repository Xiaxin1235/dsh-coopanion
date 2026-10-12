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
| 工具单步错误的呈现 | fail | 单步工具错误原来提前进入 error 状态；修复后继续显示 thinking／active，回合实际结束为 error 才进入异常状态。回归 pass | [修复前](evidence/notification-n3/tool-error-before.log)、[修复后](evidence/notification-n3/tool-error-after.log) |
| 已请求系统通知的重启／断连点击 | fail | 桌宠重启或短暂断连原来释放已请求通知的点击回调；修复后保留完整源会话映射，迟到 shown／clicked 关联原 token／generation。回归 pass | [修复前](evidence/notification-n3/late-click-before.log)、[修复后](evidence/notification-n3/late-click-after.log) |
| 原生冷启动右键复核 | fail | 第三候选安装中仍出现缺失 pointerdown／contextmenu。独占桌面回路复现新窗口位于静止指针下时的输入缺失；修复幂等 hit 请求的原生回执，并按原生回执观察指针离开／进入，再用相同坐标点击。4 次连续冷启动及完整重启回归 pass | [安装失败](evidence/notification-n3/install-rc2-v3-redacted.log)、[独占复现](evidence/notification-n3/native-cold-before.log)、[4 次复核](evidence/notification-n3/native-cold-after.log)、[完整原生回归](evidence/notification-n3/desktop-exclusive-after.log) |

原生指针辅助器通过 CoreGraphics 移动系统指针，按原生 hit 回执观察真实离开／进入，用同一坐标执行普通 Playwright 点击，并检查实际 `pointerdown`／`contextmenu`。原生窗口对幂等 hit 请求返回实际输入状态；修复后的日志包含连续冷启动、重启前后右键输入链、角色保存／删除及 clean shutdown。

用户批准先核对活动任务，任务完成后暂时退出原 DSH，串行测试并恢复。原“优化 manual.md 表达”及 2 个 subagent 已完成，后台等待任务为 `exit code: 0`。原应用、Host 及其桌宠确认退出后完成上述独占复核，随后恢复签名应用及原 profile；当前选中的原会话已恢复。该窗口执行的是独立桌宠输入回归。

容量边界最多保留 500 项待处理跟踪。达到上限的新问题继续交给 Harness 原 answerer，诊断为 `request-capacity-exceeded`；释放已有请求后可继续接纳跟踪。

## 检查状态

| 范围 | 结果 | 当前证据与范围 |
|---|---|---|
| Host／Client TypeScript | pass | 两套配置；当前投影恢复修复已复核 |
| 整合单元检查 | pass | 85 项 Vitest、10 项 release-checks；6 项真实装配检查覆盖投影恢复、continued 精确结算和容量边界；工具错误及迟到通知点击回归通过 |
| 版本与压缩包 | pass | 第一修复候选 `689bf8cf3561185f2c5d2df1eeebdaf39b16dfeb` 的 0.4.4 验证包 SHA-256 为 `b5df6e9d200194c5f20bf9e900ededf2a163bf27f87fa12d6f2cd0bd52dde942`，位于本 worktree `.cache/n3/package/`；第二候选 `487774306fca3adb0d652939088484385b531992` 的摘要为 `2c713072985a6433afb446b6851f30454f79599c51b09599316e6336f74da64b`，位于 `.cache/n3/package-v2/` |
| 现有角色浏览器回归 | pass | `tests/ui.mjs`，独立 Chromium 无头会话 |
| 通知浏览器回归 | pass | `tests/notification-ui.mjs`，精确身份、continued、补提醒操作、阅读／输入／拖拽、双语、显示／代次清理、完成消息顺序与提示到期后的回复续显 |
| macOS 原生完整回归 | pass | 独占桌面中连续 4 次冷启动、同一路径重启后菜单、角色删除及清理通过；原 DSH 已恢复 |
| macOS × 两版 DSH 实际安装 | pending | 正式 CLI 安装、Host／Client 装配、新字段默认值及持久化、真实领取和回执、公开测试源会话导出 |
| 整合候选远端三平台／六组安装 | pending | 使用当前提交生成的同一 Linux artifact，单独保存 CI 身份及摘要 |
| 签名 DSH 系统实机 | pending | 单实例角色／系统通道、权限、通知中心、点击、补提醒、重连／锁屏／休眠 |
| 真实模型会话 | pending | 真实提问、工具审批与回合结束 |
| 用户验收 | pending | 通过 N3 条件后记录验收人及结论 |
| N4 文档、版本和交付 | pending | 按 N3 用户验收结论继续 |

安装检查使用正式宿主与真实 NotificationClient／Host 领取路由；网页 Notification 构造器为受控适配器。其 requested／shown 证明调用链及 Host 回执接受，OS 送达状态单独保持 pending。安装报告保存两次不同提醒的完整身份、领取 token、客户端、原生 generation／visibilityRevision、回执及公开导出 header。

已请求通知的回调由 DSH Client 生命周期持有，桌宠状态变化停止新的投递资格，并保留旧领取的真实回执与源会话映射。DSH Client 页面销毁或适配器容量淘汰时释放对应回调，OS 历史继续按系统策略留存；页面重载后的旧通知点击在实机验收中单独检查。

## 下一检查点

1. 复核当前修复的完整套件和两版实际安装，绑定新的提交及验证压缩包。
2. 将具体候选提交、PR 内容及证据交给用户审阅，按本聊天授权安排公开分支和 draft PR，再执行远端三平台／六组安装。
3. 串行安排签名 DSH 的单实例实机及真实模型会话，完成环境清理并恢复原 DSH。
4. 记录用户 N3 验收后，在本聊天继续 N4。
