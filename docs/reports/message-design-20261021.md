# 2026-10-21：消息气泡与阅读视觉重设计

基线 `9777579833052f3110ece8ad5f8421d4a63c3073`，分支 `codex/aliveness-foundation`。用户反馈气泡的滚动条、输出框与人物不协调，要求统一视觉语言与设计体系。

## 已实现

现行规则见[消息视觉体系](../design/message-visual-system.md)，样式集中于 `web/message-surfaces.css`。气泡将来源／关闭、正文、操作分为三层，全文沿用同一张便笺；轨道在内层且距外框至少 8px。细深蓝轮廓、奶白纸面、角色配色衍生的动作色、圆角、轻阴影与焦点规则共同用于阅读、未读入口和其他面板。尾部恢复指向人物锚点。

保留原文字、按钮 id 和所有工作／会话／计时逻辑；没有修改 `pet.js`、人物 rig 或素材。当前预览已呈现实作，视觉结果仍待用户体验确认。

## 实际检查

环境：macOS arm64、Node 24.21.0、Electron 44.7.0、Playwright 1.64.0；没有依赖或版本变更。

| 检查 | 本轮结果 |
|---|---|
| 构建／类型 | `npm run build`、`npm run typecheck` 通过 |
| 消息表面浏览器矩阵 | `tests/message-surfaces-ui.mjs` 中英文 × 100%／125%／150% 共 6 组通过：320×640、无横向溢出、轨道内缩、键盘正文滚动、标题与操作固定 |
| 原字号回归 | `tests/text-scale-ui.mjs` 3 项通过，包含中英文、两种角色极值、三档字号、捕获正文／滚动、代码／表格、草稿／选区／在途身份与原驻留时间 |
| 完整浏览器 UI | `node tests/ui.mjs` 通过，包括真实 WebGL、回复／口型、聊天与角色；串行新增的消息矩阵也通过 |
| 完整 inbox | `npm run test:inbox-ui` 通过；陪伴／记忆 18 项通过 |
| 定向原生 | `tests/message-surfaces-native.mjs` 六组通过：临时 profile、真实样式加载、语言／字号 IPC、键盘滚动和标题／操作保持 |
| 包文件清单 | `npm pack --dry-run --json --ignore-scripts` 包含新样式；`check-package.mjs` 已要求其存在。这是文件清单检查，不是构建分发包／安装／发布 |

新浏览器／原生检查分别接入既有 `tests/ui.mjs` 和 `tests/desktop.mjs`。本轮没有重跑全套原生；上一轮重启后原生命中超时的限制仍见[嘴部反馈记录](mouth-feedback-20261021.md)，不能用本轮定向通过覆盖该限制。物理多屏、其他平台、CI、真实模型与长期资源没有新增结论。

## 本机证据

目录为 `artifacts/message-design-20261021/`。`layout/` 和 `browser/` 保存中英文三档字号截图与 `checks.json`，`native/` 保存隔离原生六组截图与结果；`ui.log`、`inbox.log`、`text-scale.log`、`native.log`、`typecheck.log` 是对应执行日志。用户原图按原字节保存为 `before-user.png`；当前页面的气泡／全文实作截图在同目录。`validation.json` 绑定最终源码、日志摘要与交付提交。

本轮为本地实现、文档与提交，不推送、合并或发布。没有将自动化通过写成主观观感验收。
