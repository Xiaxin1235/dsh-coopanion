# 第 2 期验证记录

2026-10-19，`codex/aliveness-foundation` 已完成本期实现与本地验证。导航主体提交 `11995b2`，最终运行源码为 `6c022de3b9543de5a1c7a34145708cc6aa8e2e25`；随后仅提交文档、证据索引与测试清理修正。未合并 main、推送、安装或发布，包版本仍为 0.4.13。

## 身份与复现

完整元数据和证据摘要见[验证清单](stage-2-validation.json)。运行源码清单为本地 [source-manifest.json](../../artifacts/stage-2-final/source-manifest.json)，覆盖实际提供的 474 个运行文件（含生成 O03 模型）；验证后逐文件复核无变化。规范清单 SHA-256 为 `21d5490e59c8fc5649445b4dbb0fd9abb5152cf9bc19188bfbe6847e308eb9aa`。这是源码／预览身份，不是 npm 分发包。

工具链 Node 24.21.0、npm 11.19.1。浏览器 Chromium 156.0.8078.4；原生 Electron 44.7.0／Chromium 152.0.7977.130，macOS arm64，单显示器 2048×1152、scaleFactor 2。原生窗口 1440×1080，实际 contentBounds／OS 光标用于 DIP 换算，未以 DPR 乘全局原点。

复现命令见[空间预览](art-workflow/space-v1/README.md)，每次输出使用新目录。原生实例使用临时 profile，桌面操作串行；用户日用安装和既有未导出预览未被刷新或重置。

## 实际结果

| 检查 | 结果与新证据 |
|---|---|
| 定向几何／规划／连续运动／旧身份／手部／接触 | 44 项通过；[日志](../../artifacts/stage-2-final/targeted.log) |
| typecheck、build、verify:metadata | 通过；[类型](../../artifacts/stage-2-final/typecheck.log)、[构建](../../artifacts/stage-2-final/build.log)、[元数据](../../artifacts/stage-2-final/metadata.log) |
| npm test | Vitest 270 通过／1 原有跳过，Node release/client 11 项及 locale-client 1 项通过；[日志](../../artifacts/stage-2-final/unit.log) |
| 二维浏览器实际指针 | 9 场景通过：花箱反馈、绕路、真实到达一次、长暂停、移动中障碍修订、换目标、拖动取消、全通道阻断、禁区目标；[结果](../../artifacts/stage-2-final/navigation/navigation-ui.json) |
| 同地图原拿放 | 30 项通过，含两轮反向、长暂停、逐帧、真实拖动、导出与栅格包络；[结果](../../artifacts/stage-2-final/contact/browser-qa.json) |
| 原 O03 WebGL 与动作 | 接触像素通过；不透明腕部最低 alpha 254（要求 248），cuff／owner 差异 0；旧 44 项动作通过；[像素](../../artifacts/stage-2-final/contact/contact-pixels.json)、[动作](../../artifacts/stage-2-final/contact/legacy-motion.json) |
| 完整 test:inbox-ui | 通过：首个 inbox 用例及后续 42 项，覆盖会话／字号／多屏自动化／NPC／陪伴；[日志](../../artifacts/stage-2-final/inbox.log) |
| 隔离原生单屏 | 7 项通过并正常退出；[结果](../../artifacts/stage-2-final/native-pass/native.json)、[日志](../../artifacts/stage-2-final/native-pass.log)。第二次单独重复也通过并正常退出；[重复结果](../../artifacts/stage-2-final/native-repeat/native.json) |

## 同地图交付与画面检查

继续复用 [4189 预览](http://127.0.0.1:4189/)。[43.16 秒真实页面录像](../../artifacts/stage-2-final/showcase/navigation-showcase.webm)由 Chromium 实时录制，无动画替代或合成位移；包含 `(508,261)`、直路受阻后的实际绕行、行走中改变花箱、暂停后首次继续。[录制状态](../../artifacts/stage-2-final/showcase/showcase.json)保留实际操作和最终帧。

检查了过程帧与最终画面：x/y 根与气泡／命中同源，移动中提示已与状态对齐；掌部、贝壳、指尖仍为同帧合成。未为本期新增美术，沿用原角色、贝壳及场景 SVG。现有腰腿结构满足本期站立行走，但未验收任意坐卧／关节／持物二维导航。本期视频和空间观感仍待用户审阅，不能由工程通过代替用户接受。

## 未完成尝试与限制

- 保留了一次 `11995b2` 原生并行验证未完成记录：[原始观察摘要](../../artifacts/stage-2-11995b2/native-unresponsive.json)。当时主进程 CPU 103.6%，DevTools WebSocket 连接 30 秒超时，结束了该测试的已确认 PID。并行浏览器工作是同时观察，**原因未确定**；后续相同功能断言单独运行通过，不称该失响应已被修复，也不作为长期可靠性证明。
- 编辑回归曾读取角色已更新、贝壳仍在初始化的中间态；测试改为等待编辑解锁，再保留原贝壳位置断言。原失败输出和正式复测均保留。原生测试的退出计时器现有界且成功关闭后取消，避免测试访问已失效句柄。
- 原生挂起通过受控 powerMonitor 事件验证；OS 光标实际移动到测量点，并核对原生 ignore-mouse 切换。未声称底层其他应用收到真实点击，未读取其他应用内容。
- 未执行 CI 三平台、Linux／Windows 原生、物理多屏／混合 DPI、实际系统锁屏／休眠、正式安装／发布或长期资源验收。主产品生活／工作调度、人格、出门、自动工作区、跨屏均留待用户后续范围。
- 第 1 期与 O03 历史报告、模型、许可、图片和原视频保持原字节；它们没有被本记录覆盖或追认。
