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
