# O03 连续拿放工作台

指定主配色／180px 角色与 40px 贝壳的 O03 效果已获用户确认。确认身份与当前阶段以[开发入口](../../../aliveness-development.md)为准；原素材和报告原字节保留。

## 打开与操作

```bash
node docs/design/art-workflow/o03-shell-hands-v1/prepare-model.mjs --check
PORT=4189 node docs/design/art-workflow/preview-art-workflow.mjs
```

复用已有 4189 服务，打开[O03 工作台](http://127.0.0.1:4189/docs/design/art-workflow/o03-shell-hands-v1/index.html)。根路径默认进入[空间样板](../space-v1/README.md)。

支持完整／分段拿放、0.25× 慢放、暂停续接、非行走阶段逐帧、六个姿势与地面贝壳拖动。“新手型”可在待机或试摆关闭以比较原模型；“专注预览”同时显示完整舞台与同帧手部放大。“运行闭环验收”覆盖三轮左右落点、接触与打断续接，第三轮慢放；等待时限随速度放宽，接触／闭合／稳定帧条件保持原值。

## 当前实现与边界

`grip.png` 为唯一动作母版，以连续网格变形展开／收拢手指，袖口与抓握点固定。同一源图由互补多边形拆为掌部／指尖；工作台等待同帧图像就绪后按“身体／掌部 → 贝壳 → 指尖”一次性合成。拥有权交接改变绑定坐标；实际稳定接触和开合达到门槛才提交拿起／放下。

三张候选原图、提示词及锚点由[素材 manifest](../../../../web/props/shell/hands/asset.json)追溯；`frontRect` 是旧矩形窗口字段，当前使用 `handSurfaceModel()`。原角色、PNG 与许可未改写。本工作台保留水平轻物件夹放；[第 3 期空间预览](../space-v1/README.md#第-3-期连续动作与物件)已复用此接触能力完成指定规格的二维接近与持物导航，仍不提供完整指骨／肘膝或任意高度抓握。制作选项不改变默认产品角色工厂。

## 验证入口与证据身份

```bash
node scripts/check-hand-art.mjs web/props/shell/hands/asset.json
node node_modules/vitest/vitest.mjs run tests/hand-art.test.js tests/prop-motion.test.js tests/prop-interaction.test.js
```

打开[实际 WebGL 像素回归](http://127.0.0.1:4189/docs/design/art-workflow/o03-shell-hands-v1/continuity.html)检查袖口不透明、固定像素、指尖运动／遮挡及相同姿势的拥有权切换；完整空间浏览器检查还覆盖长暂停后首次继续。

| 记录 | 适用身份 |
|---|---|
| [第 3 期归档](../../../archive/2026-10-aliveness/stage-3/README.md) | 已验收连续动作、持物导航与反馈修正；原始工程报告及固定源码摘要按各自身份解释 |
| [第 2 期归档](../../../archive/2026-10-aliveness/stage-2/README.md) | 已验收二维空间与花箱修正后的 O03 像素、44 项动作与长暂停回归，按最终修正提交解释 |
| [第 1 期空间验证](../space-v1/evidence/validation.json)与其 `final/` | 第 1 期固定源码的像素、44 项动作与长暂停复测，不覆盖后续运动源码 |
| [原 O03 验证](continuity-fix/validation.json)、[原样片](continuity-fix/shell-loop-fixed.webm) | 当时已验收子故事的固定快照，基础提交／脏工作区摘要按原记录解释 |
| 根目录旧报告与 `continuity-fix/before-*` 等 | 三图切换缺陷与中间诊断，属于历史复现，不能作为当前失败或最终通过 |

像素回读和暂停修正过程分别见[回读诊断](../space-v1/evidence/pixel-readback/README.md)、[长暂停诊断](../space-v1/evidence/long-pause/README.md)。过程叙述已入[交接归档](../../../archive/2026-10-aliveness/stage-1-handoff/README.md)。新增验证写新目录；本地浏览器结果不替代原生、其他角色／尺寸或用户观感验收。
