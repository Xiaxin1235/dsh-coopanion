# 开发与验证

工程入口是[文档索引](README.md)；首次贡献先了解对应行为契约，产品安装与操作见[使用指南](usage.md)。

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
npm run test:inbox-ui
npm run test:desktop
npm pack
node scripts/check-package.mjs
npm run test:install
```

依赖锁使用 `npm-shrinkwrap.json`，随安装包及源码下载提供；`npm ci` 可以直接使用它。

`npm run dev` 打开浏览器演示服务（默认 `http://127.0.0.1:4173`），`npm run demo` 启动桌面演示。演示中的任务事件是模拟的。浏览器预览和桌面版使用同一个 API 2 存储与沙箱运行时。

浏览器测试检查实际 WebGL 动画、逐字说话与嘴部同步、拖拽 / 落地、会话、聊天、换装、包导入、重启保存及脚本隔离。桌面测试验证真实 Electron 窗口、IPC、流式动画、最终回复与完整阅读、休息唤醒、实际状态栏图标和角色数据；CI 同时运行 Linux、macOS、Windows 原生窗口测试。安装测试使用官方 DSH profile loader 安装实际 `.tgz`，检查任务事件、会话导航、设置页、配置持久化和重启；`DSH_TEST_VERSION=0.2.1-alpha.1` 测试另一支持版本。

CI 窗口测试使用隔离数据和测试沙箱参数；Linux 在虚拟显示中运行。普通安装保留 Chromium sandbox、contextIsolation，关闭 Node integration。安装测试中的通知适配器、原生可见性及答复器为受控边界；完整系统实机验收和外部真实模型会话尚未验证。

## CI 与发布

CI 在 **Linux、macOS、Windows** 执行元数据检查、类型检查、单元测试、浏览器交互及真实 Electron 窗口测试，并在三平台分别验证两个 DSH 版本的实际安装。稳定 `v<major>.<minor>.<patch>` 标签派发 main 上的发布流程；全部检查通过后，用 npm OIDC 发布已验证的同一份 `.tgz`，再创建 GitHub Release，附带版本化和固定名称的插件包、示例角色、校验值、源码提交报告及当前版本说明。

npm 使用已配置的 Trusted Publisher；dshmarket 通过社区目录 PR 收录，再自动关联 npm 包。具体操作和失败重跑见 [发布说明](releasing.md)，市场条目的收录状态见 [目录 PR](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/7073)。

插件没有遥测或独立模型 API。上游代码和角色资源已固定在仓库中，不在启动时在线拉取。Electron 首次准备仍从官方发行源下载并校验；Node 24 可用 `NODE_USE_ENV_PROXY=1` 沿用已有代理变量。

## 更新首页展示素材

使用 `node scripts/capture-showcase.mjs` 录制实际浏览器演示。依赖、拍摄范围与素材说明见[首页素材](assets/README.md)。这些展示素材与正式宿主验收证据分别维护。

## 渲染与隔离

高频流式事件仅发送动画元数据，完整结果只在结果列表或已读状态变化时传输，避免长回复和多会话拖慢桌面更新。

角色脚本在 `sandbox="allow-scripts"` 的 opaque-origin iframe 中运行，只通过受控消息协议与宿主交互；没有 Node、Electron 桥、外部网络连接或顶层导航权限。本地资源服务只监听 `127.0.0.1`，桌面实例使用随机路径，API 写入要求可信页面来源。

## P1 自主陪伴验证

`test:inbox-ui` 已包含 P1 真实 API 2 日常、邀请、输入轨迹、成长、热设置和阅读回归；`test:desktop` 额外串行运行真实时间的 P1 原生点击／存档重启验证。`test:install` 在两版宿主中检查新枚举保存和原生 IPC，不要求独立运行。

短时资源对照入口 `scripts/measure-idle.mjs` 支持 `--mode companion-day`／`companion-night`，与同轮 `off` 使用相同固定种子和真实物理时钟。初始预算及基线见[P1 固定记录](evidence/p1/README.md)，最新候选和实际执行状态从[文档索引](README.md)读取；旧记录中的“最终候选”只代表对应快照。

### 隔离 Linux 长时观察

`sample-companion.mjs` 是随包提供的独立 Node 采样器，仅使用本地诊断接口与 OS 进程指标，不依赖 Electron、Playwright 或 CDP。日常使用见[使用指南](usage.md)，诊断开关和数据范围见[诊断契约](diagnostics-contract.md)。

`observe-companion.mjs` 负责受控 VM 的正式安装、启动和场景验证，将周期采样交给上述同一程序；不再注入测试专用活动／请求计数。它先核对采样器与候选包内脚本摘要一致，再按版本和产品摘要约束目标。CDP 只用于开始时的随机源、窗口及实际渲染证明，普通安装不启用。

启动前按[使用指南](usage.md#自主陪伴p1-候选功能尚未发布)确认实际 profile 的自动活动许可。VM 启动器会生成独立 profile 并配置 `roam=true`、`companionship=interactive`、`diagnostics=true`；日常 Desktop 设置不随 VM 改变。可选日常采样与两小时受控观察分别记录，按[诊断契约](diagnostics-contract.md)解释时间、缺口及结果。当前体验采用短时可见检查和自然反馈，不要求用户七天试用、填表或评分。

VM 建议 Ubuntu 24.04 x86_64、4 vCPU、固定 8 GiB 内存与 50 GiB 磁盘。按仓库固定 Node／npm 准备依赖、Electron 和 Chromium，另安装 `xvfb openbox x11-utils dbus-x11 libgtk-3-0t64 python3 procps`；Chromium 的依赖不保证包含 GTK 3。

```bash
npm install --prefix /path/to/dsh-runtime --no-audit --no-fund @deepseek-ai/dsh@0.2.0-rc.2
bash scripts/run-resource-observation.sh \
  --runtime /path/to/dsh-runtime \
  --package /path/to/frozen-candidate.tgz \
  --source-commit <候选包实际来源的完整提交> \
  --output artifacts/p1-observation-unique
```

每次使用尚不存在的输出目录，不覆盖失败记录。默认预热 20 秒、真实采样至少 7200 秒、每 5 秒一次，比较首／末 1800 秒的时间加权 RSS 均值，增量仍须 ≤20 MiB。场景为真实白天 `interactive`、种子 17、无工作占用；期间不注入输入，邀请自然忽略。另检查三类片段、邀请落盘、存档边界和请求排空。

可加 `--seconds 60 --window 20` 做短检；`fullTwoHourObservation` 仍为 false。原始采样和报告在 `sampling/` 内，安装／启动元数据及总报告在上一层。PVE／软件渲染、RSS 共享页重复、短暂子进程 CPU 漏计及环境争用须随结果披露。旧的测试页面注入观察器保留在原证据目录，不用于新候选包验收。
