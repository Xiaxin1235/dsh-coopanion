# O03 手型、连续开合与遮挡

2026-10-19 用户已确认指定尺寸／配色下的工作台效果通过，分支接手见[当前状态](../../../aliveness-development.md)。

当前方案已将三张独立手型的透明切换改成单一手部网格的连续变形，并统一贝壳拿起／放下时的绘制层。上一轮素材原图、提示词、截图和测试记录保留；上一轮几何／状态检查通过不代表视觉验收通过。

## 打开与操作

```bash
node docs/design/art-workflow/o03-shell-hands-v1/prepare-model.mjs --check
PORT=4189 node docs/design/art-workflow/preview-art-workflow.mjs
```

服务默认进入[空间样板](../space-v1/README.md)；打开[O03 工作台](http://127.0.0.1:4189/docs/design/art-workflow/o03-shell-hands-v1/index.html)。角色 180px、贝壳 40px、DeepSeek 配色。支持完整／分段拿放、0.25× 慢放、暂停续接、前进一帧、六个姿势与拖动地面贝壳。“新手型”可在待机或试摆时关闭，比较原模型。“专注预览”让舞台、操作和同帧细节放大同时显示。

“运行闭环验收”执行三轮左右落点、打断续接与接触检查；第三轮在 0.25× 下检查闭合暂停、逐帧推进和松手暂停。慢放等待上限随速度放宽至 60 秒，接触、闭合、稳定帧和拥有权条件不变。

[当前正常速度样片](continuity-fix/shell-loop-fixed.webm)为真实操作捕获，原始帧间隔、阶段和摘要见 [capture.json](continuity-fix/capture.json)。[上一轮录像](shell-hands-loop.webm)仅供追溯缺陷。

## 修正依据与实现

用户指出手型切换穿模、闪烁后，最小用例使用实际 WebGL 渲染器与原始 PNG，在握紧到一半时复现腕部 alpha 从约 254 降到 190；见[失败报告](continuity-fix/before-pixels.json)。两张图的权重相加为 1，经过 source-over 合成仍会透出背景；独立生成的袖口／手掌轮廓也不能靠两个锚点完全重合。原有地面 SVG 与角色内部持物层的交接又会改变遮挡顺序。

当前实现：

- `grip.png` 作唯一动作母版，24×32 网格围绕透明夹持空隙连续展开／收拢手指；袖口、腕点与虚拟抓握点固定。姿势权重驱动形变，两层表面 alpha 始终为 1。待机、伸手、握持、松手、收势不换图。
- 同一原图按源像素多边形分成互补掌部／指尖表面，每个像素只进入一个表面，消除原先矩形复制窗口的重复轮廓。分层纹理只在运行时创建，磁盘 PNG 原字节保留。
- 隔离工作台拿到同帧真实身体／掌部与前景指尖图像及其矩阵，待两者都解码后，在同一画布按“身体／掌部 → 贝壳 → 指尖”一次性绘制。地面／手中共用同一个物件绘制层；交接只改变绑定坐标。细节放大直接复制该合成结果。
- 物件仍需真实稳定接触，且实际网格闭合／张开达到原门槛，才提交拿起／释放。暂停冻结形变时钟，逐帧推进后仍保持暂停。

这是一只轻物件的夹放动作；当前变形不提供完整指骨、独立肘关节或任意物件抓握能力。新选项仅由明确的制作工厂启用，默认产品工厂保持原模型。

## 原始素材与制作记录

| 原图 | 来源与当前用途 |
|---|---|
| [reach.png](../../../../web/props/shell/hands/reach.png) | [提示词](prompt-reach.txt)；伸手候选轮廓，保留对照 |
| [grip.png](../../../../web/props/shell/hands/grip.png) | [提示词](prompt-grip.txt)；当前连续变形母版 |
| [release.png](../../../../web/props/shell/hands/release.png) | [提示词](prompt-release.txt)；松手候选轮廓，保留对照 |

三张由内置 image_gen 编辑原角色手部参考生成，均为 1254×1254 RGBA。源图摘要、原标定与完整提示词位于 [asset.json](../../../../web/props/shell/hands/asset.json)。原有 `frontRect` 属于上一轮矩形窗口方案，当前使用 `handSurfaceModel()` 的互补多边形。原角色模型、全部角色贴图和贝壳 PNG 没有改写；署名见[第三方说明](../../../../THIRD_PARTY_NOTICES.md)。抓握仍在壳缘 `(0.5,0.05)`，动作规划与实测接触使用同一位置。

## 验证入口与边界

打开[像素回归](http://127.0.0.1:4189/docs/design/art-workflow/o03-shell-hands-v1/continuity.html)，点击“检查实际 WebGL 手部像素”。该用例与角色工厂共用真实网格定义、形变、源像素分层和工作台合成函数，验证四种切换阶段的腕部不透明度、袖口像素固定、手指确实运动、前景指尖实际参与画面，以及相同姿势下拥有权切换的像素一致性。[修正后报告](continuity-fix/after-pixels.json)记录实际结果；最早失败脚本保存在 `continuity-fix/before-test.js` 作为旧路径复现。

`tests/hand-art.test.js` 包含 9 项：原 PNG 与锚点、真实源像素完整且互补、连续网格不翻折／袖口固定／锚点固定、暂停和实际拿放门槛。另有 9 项动作与 8 项物件交互测试。

```bash
node scripts/check-hand-art.mjs web/props/shell/hands/asset.json
node node_modules/vitest/vitest.mjs run tests/hand-art.test.js tests/prop-motion.test.js tests/prop-interaction.test.js
node docs/design/art-workflow/o03-shell-hands-v1/prepare-model.mjs --check
npm run typecheck
npm run build
npm test
npm run test:inbox-ui
```

整理前的验证身份、完整测试结果与文件摘要见 [validation.json](continuity-fix/validation.json)，实际浏览器动作结果见 [browser-qa-final.json](continuity-fix/browser-qa-final.json)。本次仅验证指定尺寸／配色的本地浏览器工作台；自动化指标与画面复核分别记录，不能替代用户观感验收、原生桌面、多屏或其他角色验证。

原记录不改写其基础提交及脏工作区来源；最终提交与分支状态从当前接手入口核对。

上一轮 [validation.json](validation.json)、[39 项状态检查](browser-qa-final.json)、[关键姿势](key-poses.json)、[原／新手型对照](comparison.json)均按原字节保留，属于修正前的实现快照。

后续空间样板回归补充：新版 Chrome 的 GPU 2D 回读可在相同合成输入下产生少量通道字节差；像素检查的临时画布已预设 `willReadFrequently:true`，WebGL 手部与全部原阈值不变。原始报告不改写，新对照与复测见[空间样板像素记录](../space-v1/evidence/pixel-readback/README.md)。

空间样片补录还覆盖了长暂停：制作工厂暂停时保持 dt=0 的安全心跳，防止首次继续被陈旧 `lastAt` 吞掉。动作时间、手型、拥有权及实际接触门槛不变；修复前后实际帧见[长暂停回归](../space-v1/evidence/long-pause/README.md)。
