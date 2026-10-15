# 桌面异常恢复契约（M3）

Host 的 `PetControls` 独占恢复调度。意外退出（包括没有主动关闭回执的 exit 0）及明确标记为可恢复的启动失败，最多自动重试三次，依次等待 1、3、10 秒；连续运行 60 秒后清零。休眠或锁屏中不计算稳定时间。时间参数可注入。未知错误、缺少图形环境、无效或不可执行的运行时路径直接进入 error；清理未确认成功也不启动新进程。

共享原生寿命类型位于 [desktop-lifecycle.ts](../src/desktop-lifecycle.ts)。`NativeStartError.recoverable` 明确标记启动错误；spawn 仅 EAGAIN / ENOMEM 可重试，原生初始化捕获的异常仅 EADDRINUSE / EAGAIN / ENOMEM 经 `startup-error` 消息允许重试。启动超时、未发送错误分类便异常退出属于失去原生进程的可恢复路径。主动退出回执为 `closed`，不会依赖 exit code 0 猜测用户意图。

`NotificationRuntime` 同包扩展 `recovering` 阶段、`desiredVisible`、`recoveryAttempt` 和可选 `retryAt`。`visible` 只来自本代原生回执；显示意图独立保留，隐藏恢复通过进程启动参数初始化，第一帧也不显示。恢复中不具备通知领取资格；新代必须先收到原生 visibilityRevision 才能领取或呈现提醒。旧代 action、退出、可见性和发送失败回调不能污染新代。

停止、停用和卸载同步取消等待及在途启动，随后在有界期限内清理。用户从托盘退出或关闭窗口属于主动关闭，不自动重启。手动启动/重启重置重试预算，设置页显示等待、次数和有界诊断；停止在启动及等待期间始终可用。清理失败保留错误与手动重启入口，Harness 不等待恢复完成。

新进程 ready 后 Host 下发 `init { baseline: true, options, snapshot }`（完整结果）及 `notification-state`（有效请求）。baseline 只将已有结果加入 renderer 的已展示集合，不标记已读，结果仍在收件箱；后续新结果正常呈现。恢复不重新折叠历史、不增加未读、不重发旧提醒，也不调用聊天提交或任务执行。已领取通知继续按 broker 的 generation/visibilityRevision 取消和结算，迟到的送达证据不重新派发其他通道。锁屏/休眠状态由原生回执报告；已观察的锁屏和休眠分别传入新进程，resume 不会清除锁屏，unlock 不会清除休眠。新进程在收到初始化回执前保持无投递资格。

M2 草稿、在途输入及阅读位置仍仅属于当前 renderer；进程崩溃会丢失这些临时界面状态。Host 已接受的消息留在 Harness 的持久队列，恢复不会重放输入或伪造接受回执。用户可在源会话核对后继续发送；本项不扩展跨进程草稿协议。Host 模型持有的关注会话、全文结果、未读与有效审批/提问保持不变。

验证分为可控时钟状态机、子进程 IPC、通知集成、真实 Electron 和两版正式安装。三平台 CI 复用现有矩阵；本机执行不能替代其他平台原生或远端 CI 验收。

M4 的 `textScale` 随最新完整配置传入新代 Renderer；当前 Renderer 的热字号切换保留阅读和草稿，进程恢复仍遵循上述临时状态丢失边界，见[文字契约](text-readability-contract.md)。
