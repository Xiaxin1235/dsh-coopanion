# 第四阶段：工作语义、多会话与表现增强

2026-10-20 本地实现，基于 `d8a61df9a7e5ce7bdb051f9e9536dabe9afbfab2` 的未提交工作区。用户已确认原整理流程；本次完成事件覆盖、关注规则与第一轮表现增强，动作自然度仍待用户验收。没有推送、合并、标签、日用 profile 安装或发布。

## 实现与来源

`src/work-facts.ts` 复用共享 CompletionTracker，分开保存 driver／活动、严格目标、审批／问题、普通与嵌套在途工具、结果身份和反馈。`src/work-sources.ts` 管理附着 epoch，恢复历史静默，旧 Agent 闭包不能写入替代来源。模型流按逐帧递增的 revision、attemptId 和 index 校验，正文、推理、工具参数与目标正文不传给身体。

多会话共用岗位；待处理请求、未确认异常、运行工作依次关注，同级保留当前，结算后按本地接纳顺序选择。目标 active 与实际运行分开，后台完成不盖过审批。交互会话／草稿不跟随后台事件；不可观测时保留已知在途工具，只有正式结果或可信 idle 才清除；问题投影结算发出一次答复反馈。输入占用、拖动与不可观测来源可以冻结身体，解除一个原因不能解除其他暂停。暂停期间接纳事实并消费短反馈，不补播积压动作。

`kit/work-performance.js` 在原身体时钟采样，思考、组织回复、模型等待、工具参数、等待调用结果、许可／答复、恢复／取消／完成使用不同表情、视线和空闲手臂；持续状态不随 delta 重启。守候有清醒坐姿、抬眼与原地起身，审批／问题邀请回应；减少动态关闭节奏。拿放接触和拥有权仍由原执行器判断，没有新增路线、随机漫游、tick 或模型唤醒。

页面的三个组合故事和单项控制来自正式类型约束的 `src/work-preview.ts`，每次请求有独立身份、审批含完整 outcome。页面明确标为模拟 Harness 事实，**不连接真实会话或模型服务**；默认 PetModel／NotificationBroker 尚未装配该二维工作故事。正式 loader 验证证明事实适配边界，不等于完整分发包安装或真实产品多 Agent 并发验收。

## 正式 Harness 验证

使用新的临时 DSH_HOME、正式 profile loader 和受控 LLM adapter，逐一核验以下四版本。观察夹具与适配器位于隔离包，严格目标投影引用各自运行时，避免混用本仓库的 rc.2 依赖。各版本 16 类检查通过，退出码 0；包入口、夹具、适配源码和编译模块摘要分别保留。

| 宿主版本 | 证据 |
|---|---|
| 0.2.0-rc.2 | [正式 loader](../../artifacts/stage-4-semantics-20261020/accepted-hosts/host-0.2.0-rc.2.json) |
| 0.2.1-alpha.1 | [正式 loader](../../artifacts/stage-4-semantics-20261020/accepted-hosts/host-0.2.1-alpha.1.json) |
| 0.2.1-rc.1 | [正式 loader](../../artifacts/stage-4-semantics-20261020/accepted-hosts/host-0.2.1-rc.1.json) |
| 0.2.1-rc.2 | [正式 loader](../../artifacts/stage-4-semantics-20261020/accepted-hosts/host-0.2.1-rc.2.json) |

实际受控 Agent／服务覆盖驱动状态、模型流、普通工具、目标生命周期、审批四结果、阻塞提问、失败后新尝试、终止错误、输出上限与用户取消。continued 问题和嵌套工具使用正式 Session 追加／投影接口的受控结构事件验证，另验证静默恢复与替换后的旧回调；这两类结构事件不证明 PTC 工具体、外部进程或外部模型服务实际执行。

## 工程与可见回归

| 检查 | 本轮结果 | 证据 |
|---|---|---|
| 全部单元与 Node 检查 | 367 项 Vitest 通过、1 原有跳过；12 项 Node 通过；原断言与超时不变，最终串行执行测试文件 | [日志](../../artifacts/stage-4-semantics-20261020/verified-unit.log) |
| 类型／构建／元数据 | 通过 | [类型](../../artifacts/stage-4-semantics-20261020/verified-typecheck.log)、[构建](../../artifacts/stage-4-semantics-20261020/verified-build.log)、[元数据](../../artifacts/stage-4-semantics-20261020/verified-metadata.log) |
| 完整 test:inbox-ui | 通过：收件箱、回复、字号、多屏、NPC／陪伴原断言保留 | [日志](../../artifacts/stage-4-semantics-20261020/inbox-ui.log) |
| 新多会话／表现／不可观测场景 | Chromium 18 项、隔离 Electron 18 项通过 | [浏览器](../../artifacts/stage-4-semantics-20261020/accepted-semantics-browser/semantics.json)、[原生](../../artifacts/stage-4-semantics-20261020/verified-semantics-native/semantics.json) |
| 完整第四阶段交接故事 | Chromium 40 项、隔离 Electron 22 项通过 | [浏览器](../../artifacts/stage-4-semantics-20261020/accepted-browser/life-work.json)、[原生](../../artifacts/stage-4-semantics-20261020/accepted-native/life-work.json)、[清理](../../artifacts/stage-4-semantics-20261020/accepted-native/cleanup.json) |
| 无参数第二阶段导航 | Chromium 9 项通过 | [结果](../../artifacts/stage-4-semantics-20261020/final-navigation/navigation-ui.json) |
| 第三阶段连续动作 | Chromium 31 项、隔离 Electron 32 项通过 | [浏览器](../../artifacts/stage-4-semantics-20261020/final-stage3-browser/actions.json)、[原生](../../artifacts/stage-4-semantics-20261020/delivery-stage3-native/actions.json) |
| 花箱／到岗拾取反馈 | 浏览器与隔离 Electron 各 8 项通过 | [浏览器](../../artifacts/stage-4-semantics-20261020/final-feedback-browser/feedback.json)、[原生日志](../../artifacts/stage-4-semantics-20261020/feedback-native.log) |

最终第四阶段的两类浏览器／原生验证使用同一消费源码摘要：`77029add9849a385fff051d03feeb2f7b09d0847d9527f6a303df68874ee488e`。完整文件摘要和报告摘要见[验证清单](stage-4-semantics-20261020.json)。Node 为 24.21.0；Chromium 为 156.0.8078.4；Electron 为 44.7.0、内置 Chromium 152.0.7977.130。原生在 macOS 单屏 DPR 2、临时 profile 中串行执行，使用受控生命周期事件。

可见证据：[思考](../../artifacts/stage-4-semantics-20261020/accepted-semantics-browser/02-thinking.png)、[组织回复](../../artifacts/stage-4-semantics-20261020/accepted-semantics-browser/03-composing.png)、[坐姿等待调用](../../artifacts/stage-4-semantics-20261020/accepted-semantics-browser/04a-seated.png)、[原地起身](../../artifacts/stage-4-semantics-20261020/accepted-semantics-browser/04b-standing.png)、[continued 问题](../../artifacts/stage-4-semantics-20261020/accepted-semantics-browser/05-continued.png)。[完整交接实录](../../artifacts/stage-4-semantics-20261020/accepted-browser/story.webm)来自隔离页面，未录桌面其他应用。

## 过程与验收边界

所有新增验证写入 `artifacts/stage-4-semantics-20261020/`，原交付报告、证据、素材与许可未改。`host-attempt-*`、`semantics-browser-attempt-*`、`final-*` 等保留过程身份，只有上表指定文件作为本次结果。此前 `final-*` 中的第四阶段结果早于不可观测来源保护，不能替代上表的最终结果。目录名 accepted 不表示用户已验收观感。

正式 loader 先后暴露了模拟未覆盖的逐帧 revision 规则、受控审批 answerer 的装配顺序，以及完整 profile 投影要求真实 request header 的问题；均已修正，保留失败记录。部分启动出现开发 HMR 文件监听上限警告，核心正式服务和上述夹具仍通过；本轮不验证 HMR。沙箱中的诊断子进程首次失败，受控本机复验通过；多浏览器并行期间，既有资源服务测试有一次 5 秒超时，未改断言／超时，最终逐文件串行重跑全部通过。冻结版本的一次原生来源重连场景被既有 lifecycle 安全门暂停，保留失败状态，后续在无并行宿主／工程任务时单独复验 18 项通过；没有关闭该安全门。

自动结果证明事件分类、源身份、状态保持、坐站／导航／接触和受控原生行为，不等于动作自然度已获用户接受。默认产品真实通道装配、真实模型质量与多 Agent 并发、三平台安装／CI、物理多屏／混合 DPI、真实系统休眠／锁屏、长期资源仍需各自验证。本轮没有新分发包，也未启动第五阶段人格／记忆。
