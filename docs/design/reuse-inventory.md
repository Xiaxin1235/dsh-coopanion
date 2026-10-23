# 本周成果与复用边界

状态：2026-10-23 路线暂停时的盘点，源码基线 `b2793fee8dd04483a30bcc19c36bc12575ac7995`。本页是后续讨论的输入，不是实施队列；当前决定只看[开发状态](../aliveness-development.md)。本轮不改产品行为，也不因路线暂停删除仍被运行时或验证工具使用的代码。

## 与角色美术相对独立的成果

| 成果 | 实现入口 | 可保留的价值与边界 |
|---|---|---|
| 工作事实与完成结算 | [work-facts.ts](../../src/work-facts.ts)、[work-sources.ts](../../src/work-sources.ts)、[completion.ts](../../src/completion.ts) | 真实工作阶段、来源身份和完成语义；可供不同角色表现消费，不把播放完成当作任务完成 |
| 二维导航 | [navigation.js](../../web/upstream/kit/navigation.js)、[导航测试](../../tests/navigation.test.js) | 路径、加减速、真实抵达、几何修订和取消；新形象仍要重新标定包络及脚底 |
| 平面放置 | [desktop-plane.js](../../web/upstream/kit/desktop-plane.js)、[装配契约](living-integration-contract.md) | 平面位置与跳跃高度分离、合法放置、临时停靠；不包含窗口附着或持久化 |
| 生活与工作交接 | [life-work.js](../../web/upstream/kit/life-work.js)、[living-routine.js](../../web/upstream/kit/living-routine.js) | 独立意图、唯一身体控制者、占用和恢复；已有策略的自然度仍需重新审视 |
| 人格、可信记忆与回应 | [personality.js](../../web/upstream/kit/personality.js)、[记忆契约](companion-memory-contract.md)、[response-rhythm.js](../../web/response-rhythm.js) | 有限偏好、存档代次／撤销、即时反应与稍后表达；保持现有许可及预算边界 |
| 输入与生命周期因果 | [生活装配契约](living-integration-contract.md)、[默认产品回归](../../tests/living-integration-ui.mjs) | 拖动、键鼠接近、隐藏／休眠、工作接管；来源 unknown 时保守暂停 |
| 跨平台能力探针 | [probe-desktop-environment.mjs](../../scripts/probe-desktop-environment.mjs)、[探针测试](../../tests/desktop-environment-probe.test.js) | 能力、时间、不可用状态和平台差异可复用；探针不是已上线的窗口互动 |
| 隔离验证与缓存治理 | [macOS VM](../macos-vm-testing.md)、[缓存规则](../cache-management.md)、[local-cache.mjs](../../scripts/lib/local-cache.mjs) | 固定源码、私有 profile、可恢复运行时、独立产物和保守回收；不代替三平台或用户验收 |

## 有明显模型依赖的成果

| 成果 | 实现入口 | 复用条件 |
|---|---|---|
| 连续拿放与接触提交 | [space-action.js](../../web/upstream/kit/space-action.js)、[prop-motion.js](../../web/prop-motion.js)、[连续动作契约](continuous-action-contract.md) | 操作身份、阶段与幂等提交可借鉴；手掌／指尖遮挡、关节和接触几何依赖当前鲸鱼与贝壳，不是任意 GIF 的通用持物能力 |
| 朝向选择 | [direction.js](../../web/upstream/whale/direction.js)、[测试](../../tests/direction.test.js) | 位移驱动、滞后与停稳关注的思路可保留；方向数量、切换和美术映射需随新路线重定 |
| 方向网格与脸部适配 | [directional-rig.js](../../web/upstream/whale/directional-rig.js)、[front-face.js](../../web/upstream/whale/front-face.js) | 固定图集及校准的实现留作复现；不是被接受的通用角色制作方案 |
| 静态拼合、来源与导出检查 | [方向工作台](art-workflow/d1-directions-v1/README.md)、[导出检查](../../scripts/export-direction-art.mjs) | 关闭动画与补偿、保留原图坐标和字节、核验生产副本；不能自动判断身份和审美 |
| 简单空间 SVG 与 O03 素材 | [素材入口](aliveness-art-assets.md) | 有可编辑来源和明确尺度；可按新体验选择，不要求恢复常驻家具或频繁搬贝壳 |

## 已暴露的制作限制

- 独立重绘多个方向、重绘拆件图集和用静态形变补偿源稿差异，使身份、体量、连接和遮挡不断变化。候选更多不代表产能稳定。
- 同一画板、同一提示词、颜色采样、轮廓重合度与页面测试均不能证明是同一个角色。几何代理仅用于旁证时，也不能约束最终生成图。
- 原画坐标拆层与无动画拼合是有价值的质量方法，但当前缺少可稳定交付的多方向母版和可控修稿能力；方法说明不是能力证明。
- 现有共享空间／任务代码不必随美术路线全部丢弃。换表现方式时仍须验证实时回应、打断、脚底位置、物件状态和资源成本。

## 待讨论的选项，均未选定

| 选项 | 可能降低的成本 | 尚未解决的取舍 |
|---|---|---|
| 复用上游分层角色，收敛方向和动作范围 | 少量新增美术，复用已有表情和连续变形 | 接受现成造型与镜像转向，不能冒充完整全方向身体 |
| 复用同一角色的预制透明动画片段 | 将复杂动作集中在有限素材库 | 来源许可、片段衔接、即时打断、解码与内存；精确接触和新增动作仍有成本 |
| 新原画或统一三维制作源 | 有机会建立更完整的角色控制 | 目前缺少稳定制作能力；没有选定工具、产能或验收切片，不启动模型制作 |

前一轮调研固定于 Coopanion `3dd0892c2d70a026253ab980af392302b88ff8b1` 与 dsh-pet `48007b64ac0bebb2e97ac88344aed62de8399dd4`：Coopanion 的[角色说明](https://github.com/Pal-AI-Lab/Coopanion/blob/3dd0892c2d70a026253ab980af392302b88ff8b1/packages/cortico-world-desktop-pet/examples/whale/README.md)描述斜侧面、镜像与共用几何；dsh-pet 的[制作说明](https://github.com/PC2005-cloud/dsh-pet/blob/48007b64ac0bebb2e97ac88344aed62de8399dd4/README.md)描述透明 WebM、GIF 预览、豆包源视频与 Premiere 手工抠像，以及素材非商用／署名约定。这些说明不证明全自动产出率；没有移植其代码、视频或素材，继续使用前需重新核对实际版本与许可。

## 素材与验证如何找回

[暂停归档](../archive/2026-10-aliveness/route-review-20261023/README.md)提供原入口快照、原位保留素材的逐文件摘要和本地重复产物删除映射。原始报告、日志、来源清单、提示词、参考图与失败稿保留原字节。D1 的旧 `selected`、`reviewCandidate`、R01–R05 和“下一步”只解释当时过程，不代表当前认可或执行授权。
