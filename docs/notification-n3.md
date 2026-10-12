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
| 正式 DSH Client 模块加载 | fail | 第四候选通过原生输入与最终回复，但 Client 的外部 zod 依赖无法由 DSH 模块表提供。浏览器构建改为打入运行依赖，保留公开 Host peers 与 React 外部引用；真实构建 factory 与两版正式宿主无头 Client 安装复核 pass | [实际安装失败](evidence/notification-n3/install-rc2-v4-redacted.log)、[rc.2 复核](evidence/notification-n3/client-install-0.2.0-rc.2.json)、[alpha.1 复核](evidence/notification-n3/client-install-0.2.1-alpha.1.json) |
| 旧 PTC 提问在缓存淘汰后的回合身份 | fail | 旧 continued PTC 记录没有显式 turn，缓存淘汰后的历史回溯原来使用最新 turn；修复后从原始事件及其前一个 turn/start 恢复 turn／seq／time。超过 200 个后续调用的回归 pass | [修复前](evidence/notification-n3/ptc-restore-before.log)、[修复后](evidence/notification-n3/ptc-restore-after.log) |
| 领取与通知构造之间的请求结算 | fail | Client 原来仅复核运行状态；请求已处理或合并组成员变化时仍会构造通知。修复后逐项复核完整请求 id、源会话及有效状态，再调用 Notification；结算和组变化回归 pass | [修复前](evidence/notification-n3/settlement-before.log)、[修复后](evidence/notification-n3/settlement-after.log) |

原生指针辅助器通过 CoreGraphics 移动系统指针，按原生 hit 回执观察真实离开／进入，用同一坐标执行普通 Playwright 点击，并检查实际 `pointerdown`／`contextmenu`。原生窗口对幂等 hit 请求返回实际输入状态；修复后的日志包含连续冷启动、重启前后右键输入链、角色保存／删除及 clean shutdown。

用户批准先核对活动任务，任务完成后暂时退出原 DSH，串行测试并恢复。原活动会话及 2 个 subagent 已完成，后台等待任务为 `exit code: 0`。原应用、Host 及其桌宠确认退出后完成上述独占复核，随后恢复签名应用及原 profile；当前选中的原会话已恢复。该窗口执行的是独立桌宠输入回归。第四候选安装在 Client 激活处失败后再次恢复原 DSH，按用户请求释放鼠标和桌面，继续执行构建及无头检查。

容量边界最多保留 500 项待处理跟踪。达到上限的新问题继续交给 Harness 原 answerer，诊断为 `request-capacity-exceeded`；释放已有请求后可继续接纳跟踪。

## 检查状态

| 范围 | 结果 | 当前证据与范围 |
|---|---|---|
| Host／Client TypeScript | pass | 两套配置；当前投影恢复修复已复核 |
| 整合单元检查 | pass | 87 项 Vitest、10 项 release-checks；6 项真实装配检查覆盖投影恢复、continued 精确结算和容量边界；工具错误、迟到通知点击、旧 PTC 回溯及投递前结算回归通过 |
| Client 构建 factory | pass | 构建真实 dist/client.js，在仅提供公开 peers／React seed 的模块载体中激活；旧包复现缺失 zod，修复包激活成功 |
| 版本与压缩包 | pass | 第一修复候选 `689bf8cf3561185f2c5d2df1eeebdaf39b16dfeb` 的 0.4.4 验证包 SHA-256 为 `b5df6e9d200194c5f20bf9e900ededf2a163bf27f87fa12d6f2cd0bd52dde942`，位于本 worktree `.cache/n3/package/`；第二候选 `487774306fca3adb0d652939088484385b531992` 的摘要为 `2c713072985a6433afb446b6851f30454f79599c51b09599316e6336f74da64b`，位于 `.cache/n3/package-v2/` |
| 现有角色浏览器回归 | pass | `tests/ui.mjs`，独立 Chromium 无头会话 |
| 通知浏览器回归 | pass | `tests/notification-ui.mjs`，精确身份、continued、补提醒操作、阅读／输入／拖拽、双语、显示／代次清理、完成消息顺序与提示到期后的回复续显 |
| macOS 原生完整回归 | pass | 独占桌面中连续 4 次冷启动、同一路径重启后菜单、角色删除及清理通过；原 DSH 已恢复 |
| 两版正式安装的无头 Client | pass | 同一 `e148a7f4aed5e2976d6d140e1980b60a94125d85` 压缩包；实际 CLI 安装、Client 激活、旧 notifications=false 保留、新默认值与配置落盘；autoStart=false，无原生窗口 |
| macOS × 两版 DSH 实际安装 | pass | 远端 macOS runner 正式 CLI 安装、Host／Client 装配、新字段持久化与重启恢复、真实领取／回执、公开测试源会话导出；网页通知为受控适配器 |
| 整合候选远端三平台／六组安装 | pass | [CI 38231668864](https://github.com/takboo/dsh-coopanion/actions/runs/38231668864) 的 10 个任务全部通过，六组消费同一 Linux artifact；[逐份核对摘要](evidence/notification-n3/ci-final-summary.json) |
| 签名 DSH 系统实机 | pending | 单实例角色／系统通道、权限、通知中心、点击、补提醒、重连／锁屏／休眠 |
| 真实模型会话 | pending | 真实提问、工具审批与回合结束 |
| 用户验收 | pending | 通过 N3 条件后记录验收人及结论 |
| N4 文档、版本和交付 | pending | 按 N3 用户验收结论继续 |

完整安装用例使用正式宿主与真实 NotificationClient／Host 领取路由，网页 Notification 构造器为受控适配器。六份安装报告中，每组 7 项宿主接口检查、2 次不同提醒身份、4 个 accepted 的 requested／shown 回执和公开导出 header 均匹配，配置重启恢复和正常清理通过；OS 送达状态独立保持 pending。

两版 Client 安装验证使用候选 `e148a7f4aed5e2976d6d140e1980b60a94125d85`，验证包位于 `.cache/n3/package-v5/`，SHA-256 为 `3191af1443f4fdda688e60cdf43db6bc5768618a7792188ae40a0e24c82a69eb`，见 [校验报告](evidence/notification-n3/local-verification.json)。报告绑定这同一包，临时 Host、无头浏览器及 profile 均已清理。其 nativeWindow／osDelivery 字段保持 pending。后续身份／结算修复与最终 CI 产物分别记录新的提交和摘要。

已请求通知的回调由 DSH Client 生命周期持有，桌宠状态变化停止新的投递资格，并保留旧领取的真实回执与源会话映射。DSH Client 页面销毁或适配器容量淘汰时释放对应回调，OS 历史继续按系统策略留存；页面重载后的旧通知点击在实机验收中单独检查。

## 整合 CI 与实机候选

用户已批准公开推送 `codex/notification-acceptance` 的通知整合代码、CI、文档及证据，并创建／维护 draft PR。当前 [PR #7](https://github.com/takboo/dsh-coopanion/pull/7) 的实现 head 为 `6daf803c6910e0a6ed3041a1607acbc3577e2f0c`。

CI 38231668864 的实际 checkout 为 `5e7ba660f1f9c124bf47c37afc860bfd3227e534`，父提交包含上述 head；二者 Git tree 同为 `7c8fa28888c9de20d1e34b7564ec7db05e0b92e9`。Linux 包和固定别名的 SHA-256 均为 `74217559b37ee37d85a98c07a0d6ec225fb0630559ac067a05c188c4f0c93694`，与本地 `.cache/n3/package-v6/` 字节一致。canonical 包、示例、报告与版本说明的 SHA256SUMS 全部通过；[CI 校验报告](evidence/notification-n3/ci-verification.json) 保留实际 checkout 身份。

签名实机候选消费这一 canonical 包。本机为 macOS 15.8.1（24H32），DSH Desktop 0.2.0-rc.2，bundle id 为 `com.deepseek.dsh`，Developer ID Application 为 Hangzhou DeepSeek Artificial Intelligence Co., Ltd，TeamIdentifier 为 `NAN929V4UM`。同包已在隔离 CLI profile 正式安装，并准备为 Desktop 提供该 profile；签名应用接管与实际加载尚待实机确认，原 profile 保持正常。

## 下一检查点

1. 串行安排签名 DSH 的单实例实机，核对角色／系统通道、原生 requested／shown／clicked、通知中心及源会话导出。
2. 补充真实审批／提问、continued、补提醒／snooze、阅读／输入保护、重连及环境状态，并执行真实模型会话。
3. 关闭自建 Desktop／Host／辅助进程，释放端口和隔离数据并恢复原 DSH，记录用户 N3 验收。
4. 用户验收通过后，在本聊天继续 N4。
