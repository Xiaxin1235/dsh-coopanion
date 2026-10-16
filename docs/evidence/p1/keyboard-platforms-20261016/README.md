# 键盘活动跨平台修订（仅本地候选）

日期：2026-10-16，macOS 15.8.1／arm64，Electron 44.7.0；Linux 检查为本机 Docker 的 amd64 Debian／Xvfb（arm64 宿主上模拟执行）及原生 ARM64 Ubuntu／Xvfb；不属于物理 Linux 桌面。

## 固定身份

- 源码：`555503ef54e1375b084a6bc34d9472e9726658be`，本地提交，未推送。
- 版本：`0.4.10`，未发布。包：当时工作区 `.cache/p1-keyboard-20261016/candidate-555503e/takboo-dsh-coopanion-0.4.10.tgz`。
- SHA-256：`f459a7c8715bf892d9b0649521bc26a9d29befddc09950d89319d43e0fc48d34`。
- productDigest：`0fce0e1dda0c36f58307d037fd0b8d7fed6582cfc50d6731b320fcf249cd336a`，dirty=false。481 份产品输入逐字节匹配提交，见 [source-binding.json](source-binding.json)、[build-info.json](build-info.json) 和 [verification.json](verification.json)。
- 日用旧包与前次 NPC 包均未替换；旧七天采样和旧 VM 任务未恢复或修改。临时 Linux 验证容器已删除。

## 原因与实现

旧 macOS helper 在监听授权 false 时直接 unknown，未调用可返回有效值的聚合时间接口；最小回归先失败，修复后通过。持续原生探针另复现旧 `NSAutoreleasePool` 被 JXA 桥接 retain 导致异常退出，改用 C 标准输出后持续运行通过。监听权限不是这个聚合接口的前置门槛，不请求额外权限。

Windows 源码注册仅键盘 Raw Input 到消息窗口，只更新聚合活动时间，不读取消息 payload；Linux 以 Python 标准库 ctypes 订阅 XI2.1 键盘事件类别，不取 cookie 内容。Wayland 环境与 XWAYLAND 扩展、无 DISPLAY、依赖／接口不可用保守 unknown；Windows 非交互／远程会话保守 unknown。协议只允许固定状态，兼容 Windows CRLF，输出过长／非法即终止；启动 15 秒无响应停止、2.5 秒失鲜 unknown，旧进程回包隔离，失败不轮询重启。

不读取按键码、组合键、文本、设备身份或其他应用内容，也不将综合空闲当成键盘空闲。完整边界见[契约](../../../companionship-contract.md)。

## 验证结算

| 检查 | 结果与边界 |
|---|---|
| metadata／类型 | 通过 |
| 单测 | 229 通过，1 项平台跳过；另 12 项 Node 检查。原输出 [unit.log](unit.log) |
| 收件箱全入口 | 全部通过，覆盖回复／阅读／草稿、字号、多屏、节奏和 12 项陪伴／NPC 用例；开发树执行，相关产品文件与提交相同 |
| 串行原生全入口 | 通过，覆盖恢复、几何、日常、陪伴、NPC 与诊断；随后对固定包重跑 NPC 原生定向用例 |
| 固定包 macOS helper | starting→available，有 active／idle；[报告](package-macos-keyboard.json)。自然活动枚举不自动等同于按步骤物理验收 |
| 固定包 NPC 原生 | 实际键盘 idle／macos／available，受控感知下真实行走抵达／返回、保留目标、稳定恢复和热设置通过；[报告](package-macos-npc.json)，[原日志](package-macos-npc.log) |
| 固定包 Linux X11 | helper 可用；XTest 合成键盘→active→idle，持续鼠标移动／点击保持 idle；[报告](package-linux-keyboard.json)。另以[ARM64 同包 helper](package-linux-arm64-helper.log)复验通过；不是物理键盘或 GPU 资源验收 |
| 两版 Host 同包安装 | [0.2.0-rc.2](install-0.2.0-rc.2.json)、[0.2.1-alpha.1](install-0.2.1-alpha.1.json) 均通过，报告包摘要完全一致；原日志分别保留 |
| Windows | 后端源码、选择／协议／失败回归和三平台 CI 探针已接入；本轮没有 Windows 原生运行或物理输入证据，远端 CI 未执行 |
| 人工输入 | 先前聊天提示条件未成立，见[无效尝试说明](invalid-attempts/README.md)；已准备可见开始按钮／倒计时面板；本次存档时尚未收到开始信号，人工复验待完成，不将旧尝试判为通过或接口失败 |
| 历史保护 | 新记录建立前，955 份历史 evidence／archive／upstream／第三方声明文件逐字节不变，[报告](protected-bytes.json)；随后只更新 evidence 索引以链接本记录 |

命令入口来自仓库配置：`typecheck`、`npm test`、`test:inbox-ui`、`test:desktop`、`test:keyboard-native`、两版 `test:install`。Linux 合成输入仅在隔离 Xvfb 中启用 `DSH_KEYBOARD_TEST_X11_INPUT=1`。本轮可见人工探针脚本按原字节保留为 [初次面板](physical-panel-probe.mjs)和[聚焦面板](physical-panel-focused-probe.mjs)，它的绝对／相对路径只描述当时工作区，不作为换机执行入口。

未做远端三平台 CI、Windows 实机、各平台锁屏／休眠／远程输入完整验收、完整资源预算、两小时新包采样或自然体验验收；不发布、不推送、不改日用 Desktop，不重启旧长期采样。后续先完成各平台物理输入与自然恢复，再做资源与体验门槛。
