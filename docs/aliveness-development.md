# 生活感功能：当前开发状态

这是生活感功能分支的接手入口。已发布产品行为仍按[现行契约](README.md)解释；本文件负责分支范围、已验收成果和后续入口。

## 分支与范围

- 持续开发分支：`codex/aliveness-foundation`。用户要求暂不合并 `main`，合并或发布另由后续指令决定。
- 当前成果：隔离浏览器中的 O03 贝壳美术与可重复拿放工作台。2026-10-19 用户确认修正后的效果“通过”。
- 已验收范围：DeepSeek 主配色、180px 角色、40px 贝壳的接近站稳、俯身接触、握紧抬起、携带、落地松手、收手起身；包含慢放、暂停、逐帧与续接。
- 尚未实施：完整空间样板、真正 x/y 导航、障碍避让、生活／工作双线协调、主产品自动拿放与原生桌面拿放。这次动作探针不代表七阶段路线的前三期整体完成。

## 接手顺序

| 任务 | 入口 |
|---|---|
| 复现当前效果、修改手部或接触 | [当前 O03 工作台](design/art-workflow/o03-shell-hands-v1/README.md) |
| 制作下一个素材、复用动作工作流 | [美术与动作工作流](design/art-workflow/README.md) |
| 决定后续故事和里程碑 | [七阶段实施路线](design/aliveness-implementation-plan.md) |
| 确定需要补什么美术 | [资源需求与交付状态](design/aliveness-art-assets.md) |
| 追溯旧方案、旧画面或已替代的结论 | [本轮归档索引](archive/2026-10-aliveness/README.md) |

## 当前实现与验证

已验收实现保存于功能提交 `ef9e319fadc82cd1f91687981e68990080da56d7`。本次文档整理不再修改该提交的运行时代码、测试或素材；整理核对见[归档与完整性记录](archive/2026-10-aliveness/cleanup-verification.json)。

`web/prop-interaction.js` 与 `web/prop-motion.js` 保存操作策略和动作状态；`web/upstream/whale/hand-art.js` 提供连续手部网格；`whale/figure.js` 的能力由制作工厂显式启用。工作台将同帧身体／掌部、贝壳与指尖统一合成，避免换图透明下降和拥有权交接的遮挡跳变。

贝壳与手部原图、标定和来源位于 `web/props/shell/`。当前只用 `hands/grip.png` 作连续开合母版；伸手／松手原图保留作候选对照。原角色模型和贴图保持原字节。

验收采用[44 项动作检查](design/art-workflow/o03-shell-hands-v1/continuity-fix/browser-qa-final.json)、[真实 WebGL 像素检查](design/art-workflow/o03-shell-hands-v1/continuity-fix/after-pixels.json)和[正常速度样片](design/art-workflow/o03-shell-hands-v1/continuity-fix/shell-loop-fixed.webm)。[当时的验证记录](design/art-workflow/o03-shell-hands-v1/continuity-fix/validation.json)绑定整理前的基础提交及脏工作区摘要，原字节保留；不能把其中的提交字段当成本分支最终提交。

2026-10-19 的该实现完整检查已通过 `npm test`（252 项 Vitest、1 项跳过、12 项 Node 检查）、类型检查、构建和完整 `test:inbox-ui`。三平台 CI、安装矩阵、物理多屏与主产品接入需要后续对应验证。

## 本地工作台

从仓库根目录，使用[开发指南](development.md)规定的工具链：

```bash
node docs/design/art-workflow/o03-shell-hands-v1/prepare-model.mjs --check
PORT=4189 node docs/design/art-workflow/preview-art-workflow.mjs
```

打开 `http://127.0.0.1:4189/`。不指定 `PORT` 时脚本默认 4186；这里显式使用 4189，与本轮演示一致。只保留一个预览服务，旧轮次页面由同一服务按原路径提供。像素回归入口是同目录的 `continuity.html`。

## 后续边界

下一步候选是把已有角色和 O03 放入有小窝、岗位与连接路径的空间样板，再进入真实二维运动；具体实施范围来自用户下一次指令。生活线与工作线保留各自意图，最终经唯一身体协调入口交接。

新增行为同步实现、测试、契约和说明；NPC 相关变更包含完整 `test:inbox-ui`。视觉连续性使用真实帧和可失败的像素检查，几何／状态通过与用户观感分别结算。原生及安装使用隔离 profile，系统桌面操作串行执行。
