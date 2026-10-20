# 潮汐小院：空间与连续动作预览

单屏同地图制作预览，复用 180px 主配色角色与 40px O03。第 2 期二维运动、第 3 期连续动作及两轮花箱修正均已获用户验收。当前授权与下一阶段从[开发状态](../../../aliveness-development.md)进入；模型见[空间契约](../../living-space-contract.md)，动作见[连续动作契约](../../continuous-action-contract.md)。

## 启动

先用 `curl -I http://127.0.0.1:4189/` 或端口监听确认已有服务；HTTP 302 为根路径跳转，页面应返回 200。服务不存在时在独立、保持运行的终端启动下列命令；临时命令结束不代表服务仍在。

```bash
node docs/design/art-workflow/o03-shell-hands-v1/prepare-model.mjs --check
PORT=4189 node docs/design/art-workflow/preview-art-workflow.mjs
```

已有 4189 服务直接复用。布局只保存在当前页，刷新会恢复初值；保护用户未导出的布局，复现与测试另开隔离页面。根路径仍进入第 2 期页面，第 3／4／5A 期各用显式入口。

## 第 5A 期：同地图的人格行为对照

复用现有服务，先执行 `node docs/design/art-workflow/space-v1/prepare-stage4.mjs`，另开[第 5A 期页面](http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?stage=5a)。不刷新原有未导出布局。隔离原生入口为 `DSH_SPACE_STAGE=5a node scripts/space-desktop.mjs`。

1. 默认 off、移动未许可、输入 unknown。“开始人格日常”仍需把模式改为 quiet 或 interactive、许可移动、将模拟粗粒度输入设为 idle。
2. 保持种子 7，先选安静并开始：站着细看贝壳。另开相同新页面选活泼、输入相同许可：沿真实导航到花箱侧前方，转向并查看细节；观察完成后有一次点头，不自动坐下。两页起点、地图和事实相同。也可各开新页，在各自页面把停留下界设为 12 秒、移动概率设为 0.95 后开始对照，目标、站位与表情仍不同。
3. 展开“参数与选择依据”，查看对象身份、注视点、可达站位、替代对象与评分、实际观察结果及理由。可分别修改两组参数；切换保留修改，“恢复本组参数”仅清除当前组覆盖。“模拟未知版本回退”会回到安静 v1，保留种子、序号和有效修改。
4. 在坐姿或探索途中切换，观察从当前姿态安全退出、用当前根重新选择；不复位身体或拿放计数。输入 active／unknown、占用、关闭模式或移动许可会停下；拖动、Escape、布局变化和生命周期暂停仍须“继续”。
5. 展开“工作事实与占用（模拟）”，注入审批／工作。原唯一协调器立即关注、取消探索并真实到岗；off 只限制可选日常，不吞工作请求。结算审批后驱动可能仍在运行，可用“普通回复”结束该轮；只有工作需求真正解除才重评日常。
6. “减少动态”只保留中性原地停留；缺能力或缺词保守降级。对象要在真实到达、转向和注视后才算看过，刚看过的对象不立即重复来回，移动花箱后会重评新位置；偏好对象的观察站位受阻时改选可达对象，全部受阻则中性停留，不记成看过。无新邀请、台词、成长、相处存档或模型调用。“停止日常”安全退出，不删除实际物件。日常开启时手动拿放由协调器独占，可先停止再“开始整理”。

```bash
node node_modules/vitest/vitest.mjs run tests/personality.test.js tests/personality-feedback.test.js tests/personality-controls.test.js tests/life-work.test.js tests/space-action.test.js tests/navigation.test.js
SPACE_EVIDENCE_DIR=artifacts/stage-5a-browser-new node tests/personality-ui.mjs
SPACE_EVIDENCE_DIR=artifacts/stage-5a-native-new node tests/personality-ui.mjs --native
```

每轮新建证据目录；原生操作串行，临时 profile 退出清理。完整边界见[人格行为契约](../../personality-behavior-contract.md)，当前交付结果见[反馈修正报告](../../../reports/stage-5a-feedback-20261020.md)，首版与原字节证据从[5A 阶段历史](../../../archive/2026-10-aliveness/stage-5a/README.md)追溯。本页参数只在运行页保留，刷新不恢复布局、参数或执行进度；不扩展 5B 存档。

## 第 4 期：生活／工作双线

首次准备共享事实模块，再另开[第四阶段页面](http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?stage=4)：

```bash
node docs/design/art-workflow/space-v1/prepare-stage4.mjs
DSH_SPACE_STAGE=4 node scripts/space-desktop.mjs
```

第二条是可选的临时 profile 原生入口；浏览器仍复用 4189 服务。新事实模块来自共享 CompletionTracker；页面醒目标注“模拟 Harness 事实”，不连接真实宿主。

1. 按“开始整理”，在拿起、持物或放下期间按“工作开始”。工作关注立即呈现，未提交拿起先收手，已持物先真实放稳，再沿同一导航器到岗。
2. “发送已接受”不会完成任务，“回合结束 · 目标未完成”只保留目标状态，Agent 已 idle 且无未决请求／异常时可返回生活，“目标完成”仅在共享严格判断后解除该会话的工作。到岗用实际位置／速度／回执判断，随后按当前活动清醒守候；同一模型／工具等待稳定 35 秒才坐下，不按周期反复起立，真实活动变化或请求安全起身。
3. 切到会话 B 提出问题／审批，再完成 A：仍守候 B。异常确认不答复问题，只有独立的结算输入能解除对应请求。“普通回复”在无目标时结束该回合，在目标 active 时仍为推进。
4. 工作解除后检查原贝壳与目标，未整理完则返回续接；若贝壳已在落点则结束，不重播拿放。临时放稳的落点不覆盖原生活目标。
5. 暂停、Escape、实际拖动、修改几何和生命周期保留拥有权／计数；按“继续”从现状检查。交接超时会停下并说明，不伪造放下或到岗。“取消生活目标”只取消原目标，工作事实和实际物件保留。

“布局与接触检查”可以展开编辑落点／物件和查看边界。故事运行中手动拿放和点地路线交由协调器独占；待机仍可使用原有控制。完整规则见[双线契约](../../life-work-contract.md)，本地工程结果与用户验收分别见[开发状态](../../../aliveness-development.md)。

```bash
node node_modules/vitest/vitest.mjs run tests/work-facts.test.ts tests/life-work.test.js tests/space-action.test.js
SPACE_EVIDENCE_DIR=artifacts/stage-4-browser-new node tests/life-work-ui.mjs
SPACE_EVIDENCE_DIR=artifacts/stage-4-native-new node tests/life-work-ui.mjs --native
```

每轮使用新的目录，原生串行。浏览器完整故事输出 `story.webm`、各里程碑截图和 `life-work.json`；报告含实际来源摘要、运行时及模拟／真实边界。重建共享模块后新页面生效，不刷新用户留有布局的页面。首次原生隐藏／长加载可能触发生命周期保护，先显式“继续”，不会自动编造生活意图。

### 工作语义、多会话与守候

第四阶段现在提供 A／B／C 独立来源、思考／输出／工具等待与单个返回、重试、完整审批 outcome、open／continued 问题、输出上限与取消。每次请求有独立身份；“发送已接受”仍不改变完成或请求。三个组合故事显式重建模拟来源，原子替换事实，不复位生活目标；可分别观察 A 工具／B 审批／C 完成、双流输出、active 目标与 continued 问题。

交互会话与身体关注分别显示；选中 C 不会把身体从 B 的审批抢走。模拟草稿按会话保存，聚焦时暂停身体，后台状态继续更新；离开后重评。减少动态关闭空闲视线／手臂节奏及可选坐站。工具守候仅在持续等待时坐下、低频抬眼；新活动才起身，不周期反复坐站或假报进度。审批与问题以站立邀请回应；期间的工具失败、重试和部分审批结算不会打断当前邀请，被抑制的短反馈也不在请求解除后补播。情绪幅度与节奏仍需主观验收。

继续复用 4189 服务；为查看更新请另开页面，不刷新持有未导出布局的原页。执行 `node docs/design/art-workflow/space-v1/prepare-stage4.mjs` 准备同源模块。新增定向检查：

```sh
node tests/work-semantics-ui.mjs
node tests/work-semantics-ui.mjs --native
node tests/work-host-contract.mjs --runtime <隔离运行时目录> --version <支持版本> --output <新证据目录>
```

loader 检查使用临时 DSH_HOME 和受控模型，加载事实适配观察夹具，不安装日用插件。四支持版本逐一核验其自身包版本与摘要。运行时准备与实际证据见[新增报告](../../../reports/stage-4-semantics-20261020.md)，它不等于真实模型服务、分发包安装或用户体验验收。

“来源不可观测”保留请求并暂停身体；“重新核对驱动”恢复模拟可观测性后从实际姿态重评，不把断开误作完成或空闲。

## 第 3 期：连续动作与物件

打开[第三阶段页面](http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?stage=3)。

1. 点空地或“走到岗位”进行真实 x/y 行走。路线卡区分直达、绕行和当前模型下不可达，列出冲突对象／段号／包络。实体按完整宽度的有限地面占用绕行，内容禁区与边界按完整身体避让；立面参与纵深遮挡。
2. “坐下”后按“拿起”或“重复拿放”：从当前姿态起身，实际走近、停稳、转身，手壳稳定接触并闭合后拿起。
3. 选择“贝壳落点”编辑 X / Y，再按“放下”：持物二维行走、接触落点、张手、收手并起身。地面贝壳也有独立 x/y，待机／坐姿时可编辑；手中物件不允许外部脱离。
4. “暂停／继续”保留实际位置、姿态、开合、拥有权与提交计数。直接拖动角色先暂停，body 按同一模型检查连续拖动段，松手／取消停在最后合法根；继续从实际位置核对目标并重规划。
5. 修改实体／落点会修订几何并暂停动作；“复位动作”、数值试摆角色和“恢复样板”是显式重置。选择对象本身不重置计数。显隐区域／锚点／边界只影响查看，导出 `schema:3` 标明模式和几何。

正常速度、慢放、暂停／继续及非行走阶段逐帧均可操作。抵达与接触取实际身体和手部结果，耗时不替代成功。

### 第 3 期花箱反馈复现

- [花箱原位 `(580,528)`](http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?stage=3&layout=stage-3-feedback-20261020)：点击“走到岗位”验证绕行。
- [花箱移至 `(558,252)`，角色位于岗位](http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?stage=3&layout=stage-3-feedback-moved-20261020)：点击“拿起”，再选择落点并放下。

花箱／角色坐标读取自用户截图控件；北柱 y=18 根据 564px 门槛间隙推算，贝壳约 x=335/y=450，属于明确标注的截图重建，非用户导出的精确布局。原图、修复前失败、邻近纵深回归与最终结果见[第 3 期归档](../../../archive/2026-10-aliveness/stage-3/README.md)。

## 隔离原生与定向回归

保持服务运行，在临时 profile 打开第 3 期：

```bash
DSH_SPACE_STAGE=3 node scripts/space-desktop.mjs
```

退出自动清理，不改日用安装。地图默认可操作；开启“桌面穿透”后仅实际 body 命中范围收取输入，Escape 关闭穿透并取消／暂停。预览不连接真实 Harness，不读取其他应用；第 4 期的模拟协调独立于产品自主陪伴。

```bash
node node_modules/vitest/vitest.mjs run tests/space-action.test.js tests/space-feedback.test.js
SPACE_EVIDENCE_DIR=artifacts/stage-3-new node tests/space-action-ui.mjs
SPACE_EVIDENCE_DIR=artifacts/stage-3-native-new node tests/space-action-ui.mjs --native
SPACE_EVIDENCE_DIR=artifacts/stage-3-feedback-new node tests/space-feedback-ui.mjs
SPACE_EVIDENCE_DIR=artifacts/stage-3-feedback-native-new node tests/space-feedback-ui.mjs --native
SPACE_EVIDENCE_DIR=artifacts/stage-3-showcase-new node tests/space-action-showcase.mjs
```

每轮使用新的输出目录，原生桌面操作串行。证据绑定实际源码 SHA-256、提交和运行时；受控 suspend、自动矩阵、物理设备与用户观感分别报告。完整工程门槛按[开发指南](../../../development.md)，NPC 变更包含 `test:inbox-ui`。

栅格 PNG 经内存位图解码并同帧合成，绘制／丢弃后释放；内部 SVG 使用可回收短 Blob URL。动态 PNG 的长 `data:` URL 会使原生调试通道积压，相关回归保留在 `tests/space-native.mjs` 与 `tests/upstream-motion.test.js`。

## 第 2 期兼容入口与历史追溯

无参数的[原空间页面](http://127.0.0.1:4189/)保留第 2 期：真实二维导航与水平 O03 拿放分开，离开操作平面后用“复位动作”返回拿放故事；导出为 `schema:2`。`node scripts/space-desktop.mjs` 打开该模式的隔离原生预览。指定[花箱 570/515 布局](http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?layout=flowerbox-570-515)可另开复现旧反馈。

旧模式定向入口为 `tests/navigation-ui.mjs`、`tests/flowerbox-detour-ui.mjs`、`tests/space-preview-ui.mjs`、`tests/space-native.mjs` 与 `tests/navigation-showcase.mjs`；均支持新的 `SPACE_EVIDENCE_DIR`。O03 像素与反向拿放另见[工作台](../o03-shell-hands-v1/README.md)。

第 1 期[固定验证总表](evidence/validation.json)与[真实样片](evidence/showcase/space-showcase.webm)、四类 SVG 的[来源表](assets/source.json)保留原字节。历史模型、验证数量和过程从[阶段归档](../../../archive/2026-10-aliveness/README.md)追溯，不覆盖后续源码或当前验收。
