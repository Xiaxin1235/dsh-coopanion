# 生活感功能：当前开发状态

这是生活感功能分支的接手入口。已发布产品行为仍按[现行契约](README.md)解释；本文件负责分支范围、交付和验收边界。

## 分支与范围

- 持续开发分支：`codex/aliveness-foundation`。用户要求暂不合并 `main`、不推送、不发布。
- 当前交付：第 1 期 [潮汐小院空间样板](design/art-workflow/space-v1/README.md)。单屏小窝／生活区、信封岗位、连接路线、门槛、花箱和手动内容禁区，可摆放、显隐分区、查看身体／接触锚点与遮挡、导出几何，并在同一场景重复已有拿放。
- 角色／动作基础：`ef9e319fadc82cd1f91687981e68990080da56d7` 的 O03 子故事已于 2026-10-19 获用户确认“通过”。这项确认不自动涵盖新的空间样板；本期工程验证与空间观感分别记录。
- 第 1 期静态几何与对象规格已形成，默认连接路线按完整身体包络通过。编辑摆放、静态路线证明和已有水平拿放都不代表真实 x/y 导航。
- 尚未实施：真正二维运动／动态避让、完整动作衔接、生活／工作双线协调与调度、人格／出门、主产品及原生桌面自主拿放。

## 接手顺序

| 任务 | 入口 |
|---|---|
| 操作本期空间预览、查看新画面与验证 | [空间样板工作台](design/art-workflow/space-v1/README.md) |
| 下一期二维运动的坐标、包络、实体和锚点 | [生活空间契约草案](design/living-space-contract.md) |
| 复现已通过的手部与连续拿放 | [O03 工作台](design/art-workflow/o03-shell-hands-v1/README.md) |
| 制作素材、检查真实接触与动作连续性 | [美术与动作工作流](design/art-workflow/README.md) |
| 里程碑与完整资源需求 | [七阶段路线](design/aliveness-implementation-plan.md)、[资源表](design/aliveness-art-assets.md) |
| 追溯本期前的接手叙述 | [第 1 期实施前快照](archive/2026-10-aliveness/pre-space-v1-state.md)（137a360，内容与相对链接按当时入口解释） |

## 实现与验证边界

新空间编辑与纯几何模块位于 `docs/design/art-workflow/space-v1/`，不加载生产 NPC 调度器、不读取 Harness 或其他应用内容。四类新增素材是直接创作的分层 SVG，原始需求、来源与 SHA-256 齐全；现有分层角色足够支撑本期，没有新增手图或关节。原角色模型、全部贴图、贝壳与候选手图保持原字节。

运行时仍复用 `web/prop-motion.js`、`web/prop-interaction.js`、`whale/hand-art.js` 和已有制作工厂。合成器只新增可选画布高度，默认保持旧 390px；新场景 660px 内仍将同帧身体／掌部、贝壳和指尖统一绘制。拥有权交接不换独立物件层。

工程结果、源文件身份与真实画面见[本期验证](design/art-workflow/space-v1/evidence/validation.json)。本轮包含几何／资源／接触定向检查、实际浏览器交互、原 O03 像素与动作回归，以及类型检查、构建、完整单元与 `test:inbox-ui`。新空间观感待用户确认；三平台 CI、安装、原生及物理多屏不在本期验证范围。

原 O03 的 [44 项动作记录](design/art-workflow/o03-shell-hands-v1/continuity-fix/browser-qa-final.json)、[像素记录](design/art-workflow/o03-shell-hands-v1/continuity-fix/after-pixels.json)、[样片](design/art-workflow/o03-shell-hands-v1/continuity-fix/shell-loop-fixed.webm)按原字节保留，只说明当时已验收的子故事；不把旧报告来源提交改写成本期提交。

## 本地唯一预览服务

从仓库根目录，按[开发指南](development.md)准备工具链：

```bash
node docs/design/art-workflow/o03-shell-hands-v1/prepare-model.mjs --check
PORT=4189 node docs/design/art-workflow/preview-art-workflow.mjs
```

打开 `http://127.0.0.1:4189/`，默认进入空间样板。右上角返回 O03；旧路径和 `continuity.html` 继续由同一服务提供。不指定 `PORT` 时默认 4186；当前演示只保留 4189 一个服务。

## 下一期边界

第 2 期应在同一地图内实现 body 真正 x/y 运动、全路径避让、转向制动、到达／中断身份、几何更新和命中一致性，并按路线要求验证隔离原生单屏。不能把本期 `place`／平面编辑或画板缩放升级描述为导航。

生活和工作保留各自意图、未来共用唯一身体协调入口；业务完成继续由 `src/completion.ts` 判断，会话接受回执与完成分别结算。没有提前实现调度、人格和出门系统。

新增行为同步实现、测试和说明，NPC 相关变更包含完整 `test:inbox-ui`。视觉连续性、几何／状态与用户观感分别验收。原生及安装如后续需要，使用隔离 profile，系统桌面操作串行执行。
