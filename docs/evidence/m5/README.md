# M5 多屏适配：本地受控验收

日期：2026-10-15。产品保持 v0.4.8。M5 已完成实现与本地受控/本机原生验收，待维护者审阅、远端 CI、其他平台及物理多屏 / 混合 DPI 验收；不将本地结果作为完整物理多屏退出条件。本轮未推送、打标签或发布，M6 未启动。M3 三平台退出条件仍未满足。

最终实现提交：`a392084f81d62b5ddcadb8c43836e453922f21a2`，包含初始实现 `18d3e06cd56fa4dac63d782aae26c3052f0cf6c2` 及拖拽恢复修复 `86315bb915d28efe2e65622f06db70ef3a0f2015`。从 M4 验收 `74fa3d0643652a1a8ff314ffa6b7e6280071c3b8` 继续；M1–M4 的实现/验收均保留在祖先链，旧证据和固定包未改动，见[前项身份](previous-milestones.json)。验收提交仅补充文档与证据。

## 行为与坐标

共享规则见[多屏契约](../../multi-display-contract.md)。一个透明窗口覆盖一块有效 workArea，按显示器 ID 保持归属；负坐标、竖屏、上下错位、任务栏条带及布局空洞不合并成活动矩形。拖拽松手由原生 DIP 光标选择目标，覆盖上下方向；托盘提供显式 **移到显示器**。移除其他屏不移动当前屏；移除当前屏后选择距旧工作区最近的有效屏，更新 workArea / scaleFactor / rotation 后重新核对实际窗口。

原生 workArea / contentBounds / 光标使用全局 DIP，角色 frame、viewport、命中与面板使用本地 CSS 坐标；按实际内容原点和 viewport 比例换算，不做全局 DIP × DPR。Windows / X11 测试物理输入使用本进程 Electron 转换，macOS 使用 CoreGraphics 逻辑点；只读测试探针仅在隔离沙箱参数与 debug port 同时开启时加载，普通安装及角色沙箱不提供该入口。

切屏及几何更新不重建 Renderer、角色 frame 或阅读 DOM，不产生 read/select/chat，保留捕获正文、滚动像素偏移、草稿、焦点/选择、在途身份和原气泡时钟。原生 revision 隔离旧几何及旧光标；resize 与 IPC 两种顺序都覆盖。拖拽中拔屏释放指针捕获，等新 bounds 到达后使用 API 2 drop，明确验证 drop 事件且没有先产生 throw。普通物理行为沿用上游，未扩展自由跨屏漫游、抛掷或贴边休息。

M1 仅正式提交目标 complete 才庆祝；M2 按目标串行准入及持久收件去重；M3 generation / visibilityRevision、隐藏恢复与完整 baseline；M4 三档文字配置和状态保持均保留。崩溃后的临时草稿及阅读位置仍会丢失，不增加跨进程持久化或自动重放。

## 复现与原生环境

| 检查点 | 原始证据与结果 |
|---|---|
| M4 水平切屏判断漏掉上方错位竖屏 | [基线复现](baseline-reproduction.json)，`screenX=500, screenY=-500` 未请求切屏 |
| 混合比例 + 负原点的旧 Windows 测试光标公式 | 同一基线样本，模型中全局原点乘 DPR 与按屏映射不同；不把模型公式作为真实 Windows 转换验收 |
| 初始 M5 实现的拖拽中拔屏 | [缺陷样本](active-drag-reproduction.json)：仍为 drag / pressing，命中区被裁到 x=420 的边缘；绑定 `18d3e06...` 及源文件摘要 |
| 相同探针对最终源码 | [修复对照](active-drag-fixed.json)，pressing=false、有效角色区域；浏览器和原生回归另断言实际 drop、无 throw |

可重复入口为 `reproduce-baseline.mjs` 和 `reproduce-active-drag.mjs`。前者固定读取 M4 基线；后者接受 checkout 路径并记录实际 commit / pet.js / 上游物理源码摘要。第一版完整源码、产物及日志保留在 `.cache/m5/candidate-18d3e06/`，不是最终验收产物。

实际原生环境：macOS arm64 / Electron 44.7.0，一块 **P272U PRO**，bounds `{x:0,y:0,width:2048,height:1152}`、workArea `{x:0,y:25,width:2048,height:1127}` DIP，scaleFactor / Renderer DPR 均为 2。完整实际清单与测量见[原生样本](multi-display-native.json)。

原生受控场景在这块真实屏幕内注入两个 workArea 子矩形及比例/旋转元数据；真实 BrowserWindow、Renderer、API 2 沙箱 frame 和 OS 光标仍运行，物理 DPR 保持 2。它验证窗口和点击调用链，不制造第二块物理屏幕。浏览器的 DPR 1/1.5/2 来自 Chromium emulation，也不等同于物理混合 DPI。点击证据由真实 OS 光标定位、原生 hit-state 与 CDP 按钮输入组成，未声称人工硬件点击。

## 固定包与重复命令

最终固定包：`.cache/m5/takboo-dsh-coopanion-0.4.8.tgz`，SHA-256：`1103686729eae380b790d019cda126d90152dd809cd512fd31217def7cee9fb5`。完整[包身份](package-verification.json)绑定上述最终实现提交；包中 724 个 Git 源文件逐字节匹配该提交，10 个生成文件匹配干净构建，见[内容核对](package-source-content.json)。release-notes.md 是包检查器保存的既有 v0.4.8 发布说明快照，不表示本轮发布。

```sh
# ORIGINAL_REPO 指向原仓库；在最终实现提交的干净 checkout 中执行。
export PATH="$ORIGINAL_REPO/.cache/m1/toolchain/node_modules/node/bin:$ORIGINAL_REPO/.cache/toolchain/node_modules/.bin:$PATH"
export npm_config_cache="$ORIGINAL_REPO/.cache/npm-cache"
export CHROMIUM_PATH="/Users/jam/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
node --version
npm --version
npm ci --ignore-scripts
npm run setup:electron
npm run typecheck
npm test
npm run verify:metadata
npm run build
npm run character:pack -- examples/star paper-star.zip
npm pack --ignore-scripts --pack-destination ..
node scripts/check-package.mjs ../takboo-dsh-coopanion-0.4.8.tgz --write-report
npm run test:ui
npm run test:notification-ui
npm run test:inbox-ui
npm run test:desktop
DSH_TEST_VERSION=0.2.0-rc.2 DSH_TEST_RUNTIME="$ORIGINAL_REPO/.cache/m1/runtime-rc" DSH_TEST_PACKAGE="$ORIGINAL_REPO/.cache/m5/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
DSH_TEST_VERSION=0.2.1-alpha.1 DSH_TEST_RUNTIME="$ORIGINAL_REPO/.cache/m1/runtime-alpha" DSH_TEST_PACKAGE="$ORIGINAL_REPO/.cache/m5/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
node docs/evidence/m5/reproduce-active-drag.mjs . ../active-drag-fixed.json
```

本轮 `ORIGINAL_REPO=/Users/jam/Documents/codespace/personal-projects/dsh-coopanion`，最终干净 checkout 为 `.cache/m5/clean`。两版 runtime 的实际版本先核对，正式安装再次检查相关 peer。macOS Chrome / Electron / Host 回环端口在沙箱外运行。验收提交后重现固定包需检出最终实现提交，不能从验收提交重新打包后宣称摘要相同。

## 实际验证

| 层级 | 结果 |
|---|---|
| Node 24.21.0 / npm 11.19.1，干净重装、Electron 44.7.0、类型、元数据、构建、角色包及分发包 | 通过 |
| 16 文件 / 150 项 Vitest、12 项 Node 检查 | 通过；1 项 Linux 专用检查在 macOS 跳过 |
| 6 项共享几何/注入原生控制器：负坐标、竖屏、错位、条带/空洞、最近恢复、当前身份、拔屏、缩放/旋转和 cursor revision | 通过，`test.log.gz` |
| 浏览器受控布局、DPR 1/1.5/2、IPC/resize 两种顺序、角色及面板可用、旧消息拒绝、上下切屏、拖拽中拔屏 | [通过](multi-display-ui.json)，[阅读截图](multi-display-reader.png) |
| 当前阅读 DOM / 捕获正文 / 120px 偏移、角色 frame、草稿、焦点/选择、固定在途身份、无额外 read/select/chat | 通过，M5 样本及原有 M4 状态回归；全部回复/发送/字号浏览器检查共 12 项 |
| 既有 WebGL / 物理 / API 2 角色与沙箱、中英文、通知、收件箱和原气泡时钟 | 通过，相关原始日志 |
| macOS 实际屏清单 / 工作区 / viewport、12 组字号×角色尺寸×语言的 OS 光标/CDP 点击 | [通过](text-scale-native.json)，[截图](text-scale-native.png) |
| macOS 两个受控原生工作区、同 ID 度量变化、隐藏切屏、普通拔屏及拖拽中拔屏、drop 无 throw | [通过](multi-display-native.json)，[截图](multi-display-native.png)；物理屏始终只有一块 |
| M3 SIGKILL 隐藏/显示恢复、有效请求和最新结果基线、停止/卸载取消；原 M1/M2 IPC | 通过，[恢复样本](desktop-recovery.json) |
| 同一固定包经两版正式 loader 安装，六组字号/尺寸的原生定位与点击、持久化、原生/Host 重启 | 两版均通过：[rc.2](multi-display-installed-0.2.0-rc.2.json) / [alpha.1](multi-display-installed-0.2.1-alpha.1.json)，以及对应 install / text-scale / goal-host / session-host / session-native / desktop-recovery 报告 |
| 历史 character-pack.log.gz 可打包，注入 web/character-pack.js 仍拒绝 | [通过](package-negative-check.json)，保留 M4 负向语义 |

机器汇总、全部文件与原始/压缩日志摘要见 [validation.json](validation.json)。[身份核对](evidence-identity.json)区分历史复现源码与最终验收源码，正式安装关键报告均核对到同一完整提交及同一包摘要。两版 runtime 原始依赖锁以 gzip 留存。

稳定性观察：最终包首次 rc.2 安装在重新启动原生视图后的双击会话入口超时，见[失败身份](native-input-failure.json)及 `native-input-failure.redacted.log.gz`。随后[8 次隔离原生启动](native-input-startup-loop.json)和同包完整安装重跑均通过。根因未确认，没有据此修改产品或放宽断言；该瞬态原生输入风险仍需后续观察。包含临时 Host 认证参数的原日志仅在本地诊断目录保存，仓库归档已脱敏。

## 尚未验收

维护者审阅、远端三平台 CI、Linux/Windows 原生窗口和物理混合 DPI 转换/点击、物理多显示器切换/拔屏、物理锁屏/睡眠、真实模型和物理系统通知中心送达/留存均未执行。Windows/X11 的转换代码已接入原生测试，不能由 macOS 结果推断其通过；Wayland 的光标查询/转换没有本轮支持声明。

既有三平台测试与两版 Host 六组安装矩阵保留，新增几何及 M5 JSON/截图上传已接入；本轮没有推送或运行远端矩阵。M3 跨平台退出条件保留待验收，M5 也只标记本地受控及本机原生通过，需在物理多屏/DPI 环境验证已确定布局后再确认完整退出条件。M6 未启动。
