# 提醒接口：N0 / protocol 1

共享定义位于 [notification-contract.ts](../src/notification-contract.ts)，网页通知适配器位于 [system-notifications.ts](../src/client/system-notifications.ts)。本阶段以这些定义作为 N1／N2 的共同输入。

## 身份与事件

提醒 id 使用 `[sessionId, turn, seq, category, stage]` 的 JSON 元组编码；请求 id 使用 `[sessionId, kind, nativeId]`。各字段保留完整值。`stage` 区分 `initial` 和 `reminder`。

类别为 `completed`、`approval`、`question`、`error`、`stopped`、`interrupted`、`blocked`、`max-tokens`。每条提醒带标题、预览、源时间和对应请求 id 列表；合并互动通过请求列表关联各自的结算状态。

审批从 `approval/asked` 与 `approval/decided` 的原生 id 配对。提问从公开 `user-questions/request` 获取运行中的提示，从 `ctx.sessionProjections.snapshot(session, ['userQuestions'])` 获取持久限时提问的 `open`、`continued` 和 `settled` 状态。具体请求由完整 `callId` 定位。

限时提问返回 pending 后，回合结束仍保持 `continued`。接收 `user-question-reply` 的 user message 后结算对应问题；补提醒按投影中的有效请求安排。阻塞请求在其答复／取消信号结算时结束等待。Host 对恢复状态进行折叠，实时事件产生新的提醒。

## 运行与领取

`NotificationRuntime` 包含阶段、运行代次 `generation`、显示状态版本 `visibilityRevision`、原生可见性、休眠状态和有界错误。

Host 按运行状态、显示状态及用户设置选择通道。系统投递需要 Host 颁发的 `DeliveryClaim`，其中包含不可推断的 token、完整提醒、客户端 id、运行代次、显示状态版本及过期时间。

| Connection 方法 | 请求 | Host 返回／行为 |
|---|---|---|
| `coopanion/notification-state` | 空对象 | `NotificationSnapshot`：protocol、运行状态及待处理请求 |
| `coopanion/notification-claim` | clientId、generation | 当前有效 `DeliveryClaim` 或 null |
| `coopanion/notification-receipt` | `DeliveryReceipt` | 验证 token、客户端、提醒及代次后记录回执 |
| `coopanion/notification-snooze` | interactionId、generation | 为当前有效请求重新安排到期时间 |

方法使用对应 `/api/coopanion/<endpoint>` 的公开 Connection 载体。请求按共享严格 schema 校验。Host 负责服务端领取令牌、单次领取、停止取消、迟到回执处理与请求结算；N1 实现这些方法，集成分支负责入口装配。

## 网页通知

`SystemNotifications` 提供 `status()`、`requestPermission()`、`deliver(claim)` 和 `dispose()`。运行时注入实际 Web Notification API、回执函数、源会话操作与时钟。

`status()` 报告网页权限，系统授权保持 `unknown`。`requestPermission()` 由启用按钮触发。`deliver()` 验证领取期限、网页权限和本客户端的 token 去重，使用提醒 id 作为通知 tag，并保持系统通知静音。

回执分为 `requested`、`shown`、`clicked`、`failed`、`unknown`。构造通知产生 requested；实际 onshow 产生 shown；实际 onclick 产生 clicked 并调用对应完整 sessionId 的会话操作；onerror 和构造失败产生 failed。回执字段完整关联原领取。OS 授权、通知中心留存及窗口激活以实机结果记录。

`dispose()` 释放事件回调和本地引用，已送达通知由 OS 管理留存。N2 按 Host 运行代次管理适配器生命周期，并接入权限说明、测试反馈及状态刷新。

## 配置与动作

`notifications` 保留现有值，新增 `systemNotifications=false`、`reminders=true`、`reminderDelayMs=600000`。提醒延迟允许 1 分钟至 24 小时。关闭提醒取消主动投递与计时，状态和结果继续随会话更新。

打开会话、确认回复已读和稍后提醒分别操作对应会话、结果和请求。查看动作保留请求的待答／待审批状态；实际结算来自 Harness 的处理结果。

## 检查

`npm run test:n0` 检查共享协议和网页适配器，并构建私有原型。`npm run test:n0:host -- --runtime <runtime-dir> --version <dsh-version>` 在实际安装的宿主包上检查公开请求、投影、审批配对和取消语义。

三平台 CI 执行共享检查并保留原型摘要；六组实际安装检查分别执行对应宿主版本的接口检查并上传报告。每份 Host 报告记录源码 commit、插件版本、包实现摘要及实际控制样本事件。
