# 美术与动作工作流

当前默认入口为已验收第 2 期的[空间预览](space-v1/README.md)，复用用户已通过的 [O03 连续拿放工作台](o03-shell-hands-v1/README.md)。分支范围和接手顺序见[当前开发状态](../../aliveness-development.md)。原 O03 仍可由右上角链接或原路径进入；早期生成、绑定和动作叙述见[归档](../../archive/2026-10-aliveness/README.md)。

## 制作美术

| 步骤 | 交付与完成条件 |
|---|---|
| 需求卡 | 固定资源 ID、语义、风格、显示尺寸、接触锚点和需要的遮挡关系 |
| 生成／修订 | 使用内置图像工具，透明需求明确开启；保存工具原图、完整提示词和来源，每轮单独留存 |
| 结构检查 | 只读检查原图摘要、真透明、边界与候选锚点；结构通过后进入实际画面复核 |
| 放回运行环境 | 目标渲染器中验证角色比例、显示尺寸、底色、接触和遮挡；按实际画面补局部素材 |
| 交付 | 原图、规格、来源、实际预览和验证边界齐全；用户观感验收单独记录 |

本期简单空间道具直接创作为分层 SVG，源文件就是运行资产；需求、作者、许可与原始字节摘要见 [space-v1/assets/source.json](space-v1/assets/source.json)，未调用图像生成。需要复杂栅格或补手／关节时再执行上表生成流程。

当前 O03 源图规格和检查入口为 `web/props/shell/asset.json`、`hands/asset.json`、`scripts/check-hand-art.mjs`。通用 PNG 检查器是 `inspect-art-asset.mjs`，只支持非交错 8-bit RGBA，不改写像素、不验证 PNG chunk CRC；浏览器解码与视觉质量分别验证。

## 设计动作

1. 先用已有分层模型确定动作范围，列出接近、接触、提交、退出姿态及可中断点。
2. 在真实身体上完成一个可重复闭环。接触和抵达取实际绘制／移动结果，提交具有幂等身份；计时只控制节奏。
3. 按像素和画面定位缺口，再补对应手型、关节或遮挡素材。独立生成的轮廓不能只靠锚点对齐和透明混合保证连续。
4. 固定模型和物件尺度，检查正常速度、慢放、暂停、逐帧、继续与左右落点；录制真实完整过程。
5. 状态、几何、像素和用户观感分别验收。回归必须能对实际缺陷失败，保留修正前后证据与源码身份。

O03 当前用同一手部母版的连续网格开合，固定袖口，按“身体／手掌 → 贝壳 → 指尖”同帧合成。三张候选 PNG 原字节保留，当前没有在动作中切换三张手图。

## 运行与检查

```bash
node docs/design/art-workflow/o03-shell-hands-v1/prepare-model.mjs --check
node scripts/check-hand-art.mjs
node node_modules/vitest/vitest.mjs run tests/hand-art.test.js tests/prop-motion.test.js tests/prop-interaction.test.js
PORT=4189 node docs/design/art-workflow/preview-art-workflow.mjs
```

打开 `http://127.0.0.1:4189/` 进入空间样板；`o03-shell-hands-v1/continuity.html` 运行真实 WebGL 像素回归。`node tests/space-preview-ui.mjs` 复用同一服务运行空间、接触和原工作台回归。完整工程门槛按[开发指南](../../development.md)，NPC 改动包含 `test:inbox-ui`。

单个服务只监听 loopback，提供工作台及固定资源，不读取真实 Harness 正文或启用产品自主拿放。生成内容和测试输出写入新的产物位置；原始报告、截图、录像、提示词及其摘要保留原字节，历史结果不覆盖当前验收状态。
