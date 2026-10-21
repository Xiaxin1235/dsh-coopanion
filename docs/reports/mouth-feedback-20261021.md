# 2026-10-21：持续开合嘴巴反馈修正

基线为 `0f50af430cf107559c9aab3c8a76ddf52083605c`，分支 `codex/aliveness-foundation`。用户报告 4173 预览嘴巴持续开合；现场 DOM 为 `mood=talking`、`mode=idle`、气泡隐藏。主页面的动画循环在 talking 状态下每 180ms 无期限调用 `body.talk()`。单独空闲 body 不复现；真实页面最小复现的最后 600ms 仍增加 4 次 talk（13 → 17）。

修正由新文本进度驱动有界口型，最近进度后 1.2 秒停止续发；实际 body 包络自然收拢。`PetModel` 只为新非空文本增量／新增完整文本块递增 `speechRevision`，重复块结算和旧帧不重复驱动。Renderer 按角色会话跟踪进度，相同快照、焦点变更、减少动态解除、隐藏或调度缺口不补播；流结束停止续发。工作／任务完成事实保留原语义，最终回复气泡继续逐字驱动口型。

## 本地验证

环境：macOS arm64、Node 24.21.0、Electron 44.7.0、Playwright 1.64.0。构建和类型检查通过；没有新版本分发包、安装、推送或发布。

| 检查 | 结果 |
|---|---|
| 原始最小复现 `node tests/mouth-ui.mjs` | 修复前失败（13 → 17），修复后通过（7 → 7），实际嘴部包络 <0.02；新进度恢复，重复快照不恢复 |
| 单元／脚本 | 完整 `npm test` 三阶段（Vitest 两个 worker）：453 项通过、1 项既有跳过，另 12 项脚本通过 |
| 完整 `node tests/ui.mjs` | 真实 WebGL、流式状态、回复逐字口型、会话／角色和新嘴部用例通过 |
| 完整 `npm run test:inbox-ui` | 通过；陪伴／记忆 UI 18 项通过 |
| 定向原生 `node tests/mouth-native.mjs` | 临时 Electron profile 的真实 IPC 和角色 iframe：同进度停止（7 → 7）、新进度恢复、流结束停止；sandbox 未改变 |
| 全套 `node tests/desktop.mjs` | 两次均在第 208 行重启后的 `#pet[data-native-hit=true]` 等待超时；未放宽阈值，未给出整套通过结论。本轮未定位该命中失败的原因，也未证明它是否在基线存在 |
| 当前用户页面 | 已刷新，实际 talking 状态停止持续开合，随后恢复空闲；截图保留在本机证据目录 |

`tests/mouth-ui.mjs` 纳入浏览器 UI 链，`tests/mouth-native.mjs` 纳入原生串行链；策略与真实模型进度分别由 `tests/live-mouth.test.js`、`tests/model.test.ts` 覆盖。未修改 rig、美术或第三方许可文件。

证据位于本机 `artifacts/mouth-feedback-20261021/`：`unit.log`、`ui.log`、`inbox.log`、`mouth-ui.log`、`native-mouth.log` 与 `native-mouth.json` 为各自结果；`native.log`、`native-final.log` 保留两轮全套原生失败。`validation.json` 绑定实际源码摘要、日志摘要及交付提交。截图分别为修正后 talking 状态的 `preview-fixed.png` 和空闲状态的 `preview-idle-fixed.png`。初始红灯数字来自本轮工具原始输出，不将它伪装成本机原始日志。

本轮通过项属于本地自动化、当前浏览器和受控原生；不推断三平台 CI、物理多屏、真实模型服务、长期资源或用户主观验收。
