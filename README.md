# DeepSeek 大肥鱼 · dsh-coopanion

给 [DeepSeek Harness Desktop](https://github.com/deepseek-ai/deepseek-harness) 加一只桌面伙伴。她会陪你工作，在回复生成、目标完成、出错或需要确认时提醒你；双击角色，可以继续选中的 Harness 普通会话，包括尚未打开的历史会话。

**v0.4.8 使用 Coopanion 的原生动画与角色运行时，组合程序采用 AGPL-3.0-or-later。** 大肥鱼的网格变形、弹簧动作、动态五官、物理拖拽和八套配色直接复用上游固定版本。角色贴图保留独立权利声明，见 [第三方声明](THIRD_PARTY_NOTICES.md) 和 [上游版本记录](web/upstream/UPSTREAM.md)。

本次更新统一桌宠与 Harness 的中英文语言，覆盖桌面菜单、聊天、收件箱、角色面板和原生托盘；切换立即生效，回复原文与当前配色保持不变。查看 [最新修改记录](https://github.com/takboo/dsh-coopanion/releases/latest) 或 [完整版本记录](docs/release-notes.md)。

当前工作分支包含 M1 完成语义、M2 会话直接续接、M3 桌面异常恢复、M4 文字可读性和 M5 多屏适配，尚未发布；宿主契约与验证范围见 [M1 验收记录](docs/evidence/m1/README.md)、[M2 验收记录](docs/evidence/m2/README.md)、[M3 本地验收](docs/evidence/m3/README.md)及 [M4 本地验收](docs/evidence/m4/README.md)；文字配置与状态规则见[文字契约](docs/text-readability-contract.md)，多屏坐标与验证边界见[多屏契约](docs/multi-display-contract.md)及 [M5 记录](docs/evidence/m5/README.md)。

## 功能

- 原生 WebGL 网格动画、眨眼与视线、动态嘴部、头发 / 鳍 / 尾巴的弹簧动作。
- 上游动作和表情：走路、跑步、跳跃、挥手、鞠躬、跳舞、坐下、睡眠等；拖拽、抛掷与落地由同一物理系统处理。
- 最终回复使用描边气泡，短预览在最多约 3 秒内显示；可立即显示、展开完整阅读和返回源会话。嘴部同步与合成音效可关闭，不是 TTS。
- `figure.json` API 2 ZIP 角色包导入、动画预览、配色 / 多轴换装、切换、删除；角色和搭配在重启后保留。
- 支持拖拽松手切换到原生鼠标所在显示器，也可从托盘 **移到显示器** 选择；拔掉当前屏后回到有效工作区，其他屏变化保持当前位置，阅读和草稿在当前窗口保留。物理多屏 / 混合 DPI 仍待实机验收，受控与本机结果见 M5 记录。
- 透明、无边框、置顶桌宠；空白区域点击穿透。点击互动、双击聊天、右键菜单、闲时活动、休息和显示 / 隐藏。
- 角色周围不显示常驻操作按钮或名称标签；有未读回复、待处理审批 / 提问或异常时出现小信封。聊天面板中点击当前会话可切换对话。
- Harness 原生 **Settings → 桌宠** 页面：运行状态、启动 / 重启 / 关闭、显示 / 隐藏、角色管理及实时保存的偏好设置。
- 实时思考 / 生成 / 工具工作动画；完成、审批、AI 提问、出错和各类停止通过角色表情与互动提示呈现。流式片段驱动嘴部，最终回复独立进入阅读气泡；只有已提交目标完成才庆祝，约 2.5 秒后回到待机。普通回合和目标中间轮保留全文及未读，提示“本轮回复已生成”；目标继续、暂停和阻塞分别呈现。
- 角色显示时由角色提醒；运行中隐藏角色时，可由 Harness 发送系统通知并点击返回源会话。系统通知默认关闭，设置页提供权限申请、测试通知和送达回执。
- 审批与 AI 提问的待处理列表、默认 10 分钟后的一次自动补提醒及“稍后提醒”；同一会话同时到期的请求合并提示。
- 会话以真实提问、项目路径、时间和有效短编号区分，支持搜索及键盘切换；旧会话从公开历史恢复提问。
- 菜单与聊天使用角色风格的描边卡片，颜色跟随换装；摸头、叫醒、拖拽等互动使用上游身体事件。
- macOS 状态栏采用随系统明暗变化的角色模板图标与状态小图形，不显示状态文字；悬停和菜单保留会话、任务、未读及设置详情，与桌面共用状态判断和持久偏好。
- 聊天输入通过正式 `sessionController.prompt`（`mode: queue`） 进入 Harness 的持久会话，使用其现有模型、工具和权限。互动和换装不会自动发起模型请求。
- 菜单提供 **源码 · AGPL**，包含对应源代码、上游运行时、构建脚本和依赖锁文件。

桌宠不作出审批，也不单独收集 API Key。聊天始终发给明确选中的关注会话，新建会话和后台任务不会自动切换目标。关注会话进行中时优先展示它的动作；空闲时用动作反映后台工作或确认 / 异常。状态栏图形优先提示任一会话的确认 / 异常，菜单显示详情。

信封直接打开回复与待办收件箱：同一会话的多个未读回合合并展示最新回复，未读数量按会话计算。只有一份回复时展开全文；多份回复显示摘要和各自的 **继续对话 ↗**（在桌宠输入框继续来源会话），审批、提问及异常提供 **去处理 ↗**。全文支持 Markdown 标题、粗体、列表、表格和代码块。阅读不会切换正在聊天的会话；收件箱阅读器可连续读不同会话的结果，并返回收件箱查看新内容。正在阅读的回复不会被新结果替换。保留最近 200 份完整结果，优先淘汰已读；只有本次 Harness 运行中实时完成的回复计入未读，打开历史会话或重启 Harness 不会把旧回复重新标为未读。重启后原始对话仍由 Harness 保存；任务动画根据当前 Agent 的运行状态恢复。

回复气泡展示或自动收起、查看收件箱摘要及收起收件箱均不会标记已读；主动展开阅读、关闭单份回复气泡或通过该回复回到源会话时，确认展示时合并的未读回合。阅读期间新到的回合继续保留未读，旧回合的完整结果仍可通过历史导航查看。审批与 AI 提问由 Harness 的实际答复、决定或取消结果结算；查看、收起互动提示或打开源会话均不会代替处理请求。

高频流式事件仅发送动画元数据，完整结果只在结果列表或已读状态变化时传输，避免长回复和多会话拖慢桌面更新。

角色脚本在 `sandbox="allow-scripts"` 的 opaque-origin iframe 中运行，只通过受控消息协议与宿主交互；没有 Node、Electron 桥、外部网络连接或顶层导航权限。本地资源服务只监听 `127.0.0.1`，桌面实例使用随机路径，API 写入要求可信页面来源。

## 破坏式更新

v0.4.0 移除了旧 Canvas 关键帧引擎、`dsh-character` v1 协议、`.dshpet` 包、旧 schema 和转换工具。旧角色不能直接加载，也不提供旧引擎兼容模式；需要重新制作或导入 API 2 包。

桌面版改用独立数据目录 `figures-v2`，旧角色选择恢复为内置大肥鱼。旧 `characters` 数据不会被读取；不再需要时可自行删除。Harness 的会话与配置不受角色数据重置影响。

## 安装到 Desktop

支持 **DSH 0.2.0-rc.2 和 0.2.1-alpha.1**；其他版本未声明兼容。

1. 下载对应 [Release](https://github.com/takboo/dsh-coopanion/releases) 的 `dsh-coopanion-0.4.8.tgz`，或按下面步骤构建 `takboo-dsh-coopanion-0.4.8.tgz`。npm 包名为 `@takboo/dsh-coopanion`；本地 `npm pack` 的文件名包含 scope。
2. 在 Harness 侧边栏 **插件** 页安装压缩包的绝对路径，启用 `dsh-coopanion`。
3. 完全退出再重新打开 Harness。首次启动时会下载并校验 Electron 44 运行时。
4. 打开一段 Harness 会话，双击角色聊天，或从 **Settings → 桌宠** 管理角色。

也可使用 Desktop 自带的 CLI。先启动 Desktop 一次初始化 profile，完全退出应用，再执行：

```bash
dsh plugin --profile desktop add /absolute/path/dsh-coopanion-0.4.8.tgz
```

npm 安装的 dsh 不能管理 Desktop 所拥有的 profile。Desktop 完全退出后执行包管理命令，再重新打开应用。

## 开发与验证

后续改进的范围、实施顺序与验收条件见[桌面伙伴改进路线图](docs/roadmap.md)。

通知阶段及交付状态见 [通知执行计划](docs/notification-plan.md)，本轮集成验收范围见 [N3 验收记录](docs/notification-n3.md)。

开发工具链固定 Node.js 24.21.0 和 npm 11.19.1。Electron 支持 Windows、macOS、Linux；Linux 的窗口测试需要 X11 / XWayland 或 Xvfb，以及 Python 3 和 libX11，用于同步原生鼠标位置。原生网格需要 Chromium 的 WebGL 支持。

```bash
npm ci --ignore-scripts
npm run verify:metadata
npm run setup:electron
npm run typecheck
npm test
npm run build
npm run character:pack -- examples/star paper-star.zip
npm run test:ui
npm run test:notification-ui
npm run test:desktop
npm pack
node scripts/check-package.mjs
npm run test:install
```

依赖锁使用 `npm-shrinkwrap.json`，随安装包及源码下载提供；`npm ci` 可以直接使用它。

`npm run dev` 打开浏览器演示服务（默认 `http://127.0.0.1:4173`），`npm run demo` 启动桌面演示。演示中的任务事件是模拟的。浏览器预览和桌面版使用同一个 API 2 存储与沙箱运行时。

浏览器测试检查实际 WebGL 动画、逐字说话与嘴部同步、拖拽 / 落地、会话、聊天、换装、包导入、重启保存及脚本隔离。桌面测试验证真实 Electron 窗口、IPC、流式动画、最终回复与完整阅读、休息唤醒、实际状态栏图标和角色数据；CI 同时运行 Linux、macOS、Windows 原生窗口测试。安装测试使用官方 DSH profile loader 安装实际 `.tgz`，检查任务事件、会话导航、设置页、配置持久化和重启；`DSH_TEST_VERSION=0.2.1-alpha.1` 测试另一支持版本。

CI 窗口测试使用隔离数据和测试沙箱参数；Linux 在虚拟显示中运行。普通安装保留 Chromium sandbox、contextIsolation，关闭 Node integration。安装测试中的通知适配器、原生可见性及答复器为受控边界；完整系统实机验收和外部真实模型会话尚未验证。

## 新角色

右键角色 → **换个模样** → **导入角色包**，选择包含 `figure.json` 的 API 2 ZIP。预览、试播动作、选择配色或搭配，再点击 **使用角色**。删除正在使用的自定义角色会恢复内置大肥鱼。

`examples/star` 是基于上游 `kit.createBody()` 的最小 SVG 角色，具备共享动作、表情、说话和拖拽。复制目录、修改 id 和素材后打包：

```bash
npm run character:pack -- examples/star paper-star.zip
```

完整工厂接口、资源规则、动作映射及换装说明见 [角色对接文档](docs/characters.md)。内置大肥鱼的 `web/upstream/whale/figure.json` / `model.json` / `figure.js` 展示网格角色的完整实现。内置角色的 id 为 `whale`。

## 配置与会话

**Settings → 桌宠** 沿用 Harness 的主题、中英文与系统语言设置。可控制随 Harness 启动、闲时活动、任务通知、系统通知、待处理请求补提醒、等待时间、角色尺寸（90–240）、文字大小（100% / 125% / 150%）和气泡时长（2–60 秒）；数值按 Enter 或离开输入框保存。文字大小选择后立即保存并同步到当前桌宠，独立于角色尺寸，保留当前阅读、草稿与在途发送；旧配置默认 100%。

**日常陪伴节奏** 默认关闭，旧配置沿用原有闲时动作。开启闲时走动及此偏好后，按系统本地时间在 07:00–22:00 每 45–90 秒尝试现有轻动作，夜间每 2–4 分钟仅轻点头或坐下；缺少动作时保持待机。任务、待办、阅读、输入、拖拽、用户休息及减少动态效果始终优先，占用解除后重新等待，动作结束恢复当前神态。偏好立即同步并持久保存，不增加模型请求或通知，详见[日常节奏契约](docs/daily-rhythm-contract.md)及[本地验证边界](docs/evidence/m6/README.md)。

桌宠意外退出后按 1、3、10 秒间隔最多自动恢复三次，连续稳定运行 60 秒后清零。设置页显示恢复次数和诊断，可随时关闭或在失败后手动重启；主动关闭不触发恢复。隐藏的角色恢复后仍隐藏，关注会话、完整结果、未读和有效待办保留，旧结果不再次主动提醒。窗口内草稿与阅读位置会随进程退出丢失，恢复不会重发聊天或任务。缺少图形环境、无效运行时路径或未确认清理的进程直接反馈错误，详见[恢复契约](docs/desktop-recovery-contract.md)。

```yaml
- id: dsh-coopanion
  config:
    autoStart: true
    size: 180
    roam: true
    dailyRhythm: false
    notifications: true
    systemNotifications: false
    reminders: true
    reminderDelayMs: 600000
    bubbleDurationMs: 12000
    # electronPath: /absolute/path/to/electron
```

最终回复气泡与事件互动提示分别显示。回复气泡时长从逐字显示完成后计时，鼠标停留或键盘聚焦时暂停收起；互动提示收起后，未处理的审批和提问仍保留在小信封列表。超过 180 字的回复展示按句子截取的开头（不做模型摘要），可展开完整阅读；原文保留且不截断，完整阅读器不会自动关闭。减少动态效果时禁用闲时活动与逐字显示，保留直接拖动及落地。

桌宠展示普通顶层会话，忽略子代理；首次可用会话成为当前对话，之后保持用户选中的关注会话。启动时从正式列表恢复最近最多 100 个普通会话，冷会话无需先在 Harness 中打开即可续接。发送中保留草稿，收到“已进入收件队列”回执后才清空；失败可重试，同一次提交复用请求 ID。切换关注会话不会改变在途消息的目标；会话缺失、其他进程占用、权限限制或模型不可用会明确反馈。接受不代表任务完成。详见[会话续接契约](docs/session-chat-contract.md)。桌面版通过公开的 `dsh://open` 协议唤回 Harness。多个本机客户端同时连接时，返回请求由首先领取的客户端处理。

## 提醒与系统通知

开启任务通知后，角色显示时用动作、表情和互动提示提醒；输入、阅读或拖拽期间先排队，结束后再呈现。最终回复与未读列表独立保留。审批／提问可预览内容、返回源会话或选择“稍后提醒”；限时提问标记“仍可回答”时，回合结束后仍可处理。

补提醒默认开启，等待时间可设为 1–1440 分钟。新的待处理请求自动补提醒一次；“稍后提醒”按当前等待时间重新计时。处理、取消或销毁会话后撤销该请求的计时。历史恢复保留待处理入口，不重放旧提醒。关闭任务通知会停止主动提醒，保留会话状态和未读回复。

系统通知默认关闭。在 **Settings → 桌宠 → 提醒与通知** 开启后，点击 **申请／刷新权限**，隐藏运行中的角色，再发送 **测试系统通知**。Desktop 使用 DeepSeek Harness 的应用身份，本机 `dsh web` 使用浏览器身份；点击通知请求打开源会话。角色关闭、启动中、失败或锁屏／休眠期间暂停主动投递。

网页权限“允许”、已请求和收到显示回执分别表示不同步骤；系统送达需在通知中心核对，并点击检查源会话。macOS 在 **系统设置 → 通知 → DeepSeek Harness** 管理授权；Windows 在 **设置 → 系统 → 通知**，Linux 在桌面通知设置中管理。权限或客户端不可用时，待处理入口仍保留；恢复显示不会补发旧系统通知。

## CI 与发布

CI 在 **Linux、macOS、Windows** 执行元数据检查、类型检查、单元测试、浏览器交互及真实 Electron 窗口测试，并在三平台分别验证两个 DSH 版本的实际安装。稳定 `v<major>.<minor>.<patch>` 标签派发 main 上的发布流程；全部检查通过后，用 npm OIDC 发布已验证的同一份 `.tgz`，再创建 GitHub Release，附带版本化和固定名称的插件包、示例角色、校验值、源码提交报告及当前版本说明。

首次 npm 包创建和 Trusted Publisher 绑定需要维护者认证；dshmarket 通过社区目录 PR 收录，再自动关联 npm 包。具体操作、首次启用和失败重跑见 [发布说明](docs/releasing.md)，市场条目的收录状态见 [目录 PR](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/7073)。

插件没有遥测或独立模型 API。上游代码和角色资源已固定在仓库中，不在启动时在线拉取。Electron 首次准备仍从官方发行源下载并校验；Node 24 可用 `NODE_USE_ENV_PROXY=1` 沿用已有代理变量。
