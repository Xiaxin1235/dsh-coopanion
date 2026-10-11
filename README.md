# DeepSeek 大肥鱼 · dsh-coopanion

给 [DeepSeek Harness Desktop](https://github.com/deepseek-ai/deepseek-harness) 加一只桌面伙伴。她会陪你工作，在任务完成、出错或需要确认时提醒你；双击角色，可以向已打开的 Harness 会话发送消息。

**v0.4.2 使用 Coopanion 的原生动画与角色运行时，组合程序采用 AGPL-3.0-or-later。** 大肥鱼的网格变形、弹簧动作、动态五官、物理拖拽和八套配色直接复用上游固定版本。角色贴图保留独立权利声明，见 [第三方声明](THIRD_PARTY_NOTICES.md) 和 [上游版本记录](web/upstream/UPSTREAM.md)。

## 功能

- 原生 WebGL 网格动画、眨眼与视线、动态嘴部、头发 / 鳍 / 尾巴的弹簧动作。
- 上游动作和表情：走路、跑步、跳跃、挥手、鞠躬、跳舞、坐下、睡眠等；拖拽、抛掷与落地由同一物理系统处理。
- 最终回复使用描边气泡，短预览在最多约 3 秒内显示；可立即显示、展开完整阅读和返回源会话。嘴部同步与合成音效可关闭，不是 TTS。
- `figure.json` API 2 ZIP 角色包导入、动画预览、配色 / 多轴换装、切换、删除；角色和搭配在重启后保留。
- 透明、无边框、置顶桌宠；空白区域点击穿透。点击互动、双击聊天、右键菜单、闲时活动、休息和显示 / 隐藏。
- 角色周围不显示常驻操作按钮或名称标签；仅有待查看回复或确认 / 异常时出现小信封。聊天面板中点击当前会话可切换对话。
- Harness 原生 **Settings → 桌宠** 页面：运行状态、启动 / 重启 / 关闭、显示 / 隐藏、角色管理及实时保存的偏好设置。
- 实时思考 / 生成 / 工具工作 / 等待确认 / 完成 / 出错动画；状态与流式片段只驱动动作、神态和嘴部，不进入气泡。任务完成后才展示已确认的最终回复，完成表情 2.5 秒后回到待机。
- 会话以真实提问、项目路径、时间和有效短编号区分，支持搜索及键盘切换；旧会话从公开历史恢复提问。
- 菜单与聊天使用角色风格的描边卡片，颜色跟随换装；摸头、叫醒、拖拽等互动使用上游身体事件。
- macOS 状态栏采用随系统明暗变化的角色模板图标与状态小图形，不显示状态文字；悬停和菜单保留会话、任务、未读及设置详情，与桌面共用状态判断和持久偏好。
- 聊天输入通过 `Agent.followup()` 进入 Harness 的持久会话，使用其现有模型、工具和权限。互动和换装不会自动发起模型请求。
- 菜单提供 **源码 · AGPL**，包含对应源代码、上游运行时、构建脚本和依赖锁文件。

桌宠不作出审批，也不单独收集 API Key。聊天始终发给明确选中的关注会话，新建会话和后台任务不会自动切换目标。关注会话进行中时优先展示它的动作；空闲时用动作反映后台工作或确认 / 异常。状态栏图形优先提示任一会话的确认 / 异常，菜单显示详情。

后台最终回复进入未读列表，确认 / 异常优先排序；点击会话可读回复或回到 Harness 处理。正在阅读的回复不会被新结果替换，阅读器可前后翻看同一会话的结果。保留本次 Harness 运行内最近 200 份完整结果，优先淘汰已读；重启后原始对话仍由 Harness 保存。

气泡展示或自动收起不会标记已读；主动展开阅读、关闭回复或通过该回复回到源会话时，才确认这一份结果，避免人在别处工作时漏掉已自动显示的回复。

高频流式事件仅发送动画元数据，完整结果只在结果列表或已读状态变化时传输，避免长回复和多会话拖慢桌面更新。

角色脚本在 `sandbox="allow-scripts"` 的 opaque-origin iframe 中运行，只通过受控消息协议与宿主交互；没有 Node、Electron 桥、外部网络连接或顶层导航权限。本地资源服务只监听 `127.0.0.1`，桌面实例使用随机路径，API 写入要求可信页面来源。

## 破坏式更新

v0.4.0 移除了旧 Canvas 关键帧引擎、`dsh-character` v1 协议、`.dshpet` 包、旧 schema 和转换工具。旧角色不能直接加载，也不提供旧引擎兼容模式；需要重新制作或导入 API 2 包。

桌面版改用独立数据目录 `figures-v2`，旧角色选择恢复为内置大肥鱼。旧 `characters` 数据不会被读取；不再需要时可自行删除。Harness 的会话与配置不受角色数据重置影响。

## 安装到 Desktop

支持 **DSH 0.2.0-rc.2 和 0.2.1-alpha.1**；其他版本未声明兼容。

1. 下载对应 [Release](https://github.com/takboo/dsh-coopanion/releases) 的 `.tgz`，或按下面步骤构建 `dsh-coopanion-0.4.2.tgz`。本分支的修改不代表该版本已经发布。
2. 在 Harness 侧边栏 **插件** 页安装压缩包的绝对路径，启用 `dsh-coopanion`。
3. 完全退出再重新打开 Harness。首次启动时会下载并校验 Electron 44 运行时。
4. 打开一段 Harness 会话，双击角色聊天，或从 **Settings → 桌宠** 管理角色。

也可使用 Desktop 自带的 CLI。先启动 Desktop 一次初始化 profile，完全退出应用，再执行：

```bash
dsh plugin --profile desktop add /absolute/path/dsh-coopanion-0.4.2.tgz
```

npm 安装的 dsh 不能管理 Desktop 所拥有的 profile。Desktop 完全退出后执行包管理命令，再重新打开应用。

## 开发与验证

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
npm run test:desktop
npm pack
node scripts/check-package.mjs
npm run test:install
```

依赖锁使用 `npm-shrinkwrap.json`，随安装包及源码下载提供；`npm ci` 可以直接使用它。

`npm run dev` 打开浏览器演示服务（默认 `http://127.0.0.1:4173`），`npm run demo` 启动桌面演示。演示中的任务事件是模拟的。浏览器预览和桌面版使用同一个 API 2 存储与沙箱运行时。

浏览器测试检查实际 WebGL 动画、逐字说话与嘴部同步、拖拽 / 落地、会话、聊天、换装、包导入、重启保存及脚本隔离。桌面测试验证真实 Electron 窗口、IPC、流式动画、最终回复与完整阅读、休息唤醒、实际状态栏图标和角色数据；CI 同时运行 Linux、macOS、Windows 原生窗口测试。安装测试使用官方 DSH profile loader 安装实际 `.tgz`，检查任务事件、会话导航、设置页、配置持久化和重启；`DSH_TEST_VERSION=0.2.1-alpha.1` 测试另一支持版本。

窗口测试只在虚拟显示中使用测试沙箱参数与软件 WebGL。普通安装保留 Chromium sandbox、contextIsolation，关闭 Node integration。macOS / Windows 的实机窗口、系统通知和真实模型聊天仍需验收。

## 新角色

右键角色 → **换个模样** → **导入角色包**，选择包含 `figure.json` 的 API 2 ZIP。预览、试播动作、选择配色或搭配，再点击 **使用角色**。删除正在使用的自定义角色会恢复内置大肥鱼。

`examples/star` 是基于上游 `kit.createBody()` 的最小 SVG 角色，具备共享动作、表情、说话和拖拽。复制目录、修改 id 和素材后打包：

```bash
npm run character:pack -- examples/star paper-star.zip
```

完整工厂接口、资源规则、动作映射及换装说明见 [角色对接文档](docs/characters.md)。内置大肥鱼的 `web/upstream/whale/figure.json` / `model.json` / `figure.js` 展示网格角色的完整实现。内置角色的 id 为 `whale`。

## 配置与会话

**Settings → 桌宠** 沿用 Harness 的主题、中英文与系统语言设置。可控制随 Harness 启动、闲时活动、任务通知、角色尺寸（90–240）和气泡时长（2–60 秒）；数值按 Enter 或离开输入框保存。

```yaml
- id: dsh-coopanion
  config:
    autoStart: true
    size: 180
    roam: true
    notifications: true
    bubbleDurationMs: 12000
    # electronPath: /absolute/path/to/electron
```

气泡只展示已完成任务的最终回复；时长从逐字显示完成后计时，鼠标停留或键盘聚焦时暂停收起。超过 180 字的回复展示按句子截取的开头（不做模型摘要），可展开完整阅读；原文保留且不截断，完整阅读器不会自动关闭。减少动态效果时禁用闲时活动与逐字显示，保留直接拖动及落地。

桌宠仅展示已加载的顶层会话，忽略子代理；新会话自动成为当前对话。未加载的历史会话需先在 Harness 中打开。桌面版通过公开的 `dsh://open` 协议唤回 Harness。多个本机客户端同时连接时，返回请求由首先领取的客户端处理。

## CI 与发布

CI 在 **Linux、macOS、Windows** 执行元数据检查、类型检查、单元测试、浏览器交互及真实 Electron 窗口测试，并在三平台分别验证两个 DSH 版本的实际安装。稳定 `v<major>.<minor>.<patch>` 标签派发 main 上的发布流程；全部检查通过后，用 npm OIDC 发布已验证的同一份 `.tgz`，再创建 GitHub Release，附带版本化和固定名称的插件包、示例角色、校验值、源码提交报告及当前版本说明。

首次 npm 包创建和 Trusted Publisher 绑定需要维护者认证；dshmarket 通过社区目录 PR 收录，再自动关联 npm 包。具体操作、首次启用和失败重跑见 [发布说明](docs/releasing.md)。本分支的流程配置不代表 npm 发布或市场收录已经完成。

插件没有遥测或独立模型 API。上游代码和角色资源已固定在仓库中，不在启动时在线拉取。Electron 首次准备仍从官方发行源下载并校验；Node 24 可用 `NODE_USE_ENV_PROXY=1` 沿用已有代理变量。
