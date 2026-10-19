# Coopanion 上游动画运行时调研，2026-10-19

## 调研身份与结论

本次查阅时间为 **2026-10-19，Asia/Shanghai（UTC+8）；首次在线核对为 20:27:58**。只做官方源码、提交、PR 与发布记录调研，以及临时目录里的差异／补丁模拟；没有修改动画实现，没有运行原生桌面，没有提交、推送或发布。

| 身份 | 固定值与来源 |
|---|---|
| 上游仓库 | [Pal-AI-Lab/Coopanion](https://github.com/Pal-AI-Lab/Coopanion)，默认分支 `main` |
| 本地评估基线 | `codex/aliveness-foundation`，`3ca1137ec01883d4e032a45d4a42aeb35e878f70`；评估开始时工作区干净 |
| 本仓库导入基线 | `d7b1a0026fed3eb1975a6e0387527d806192cdbf`，提交时间 2026-10-09 12:21:55（上海），见 [UPSTREAM.md](../../web/upstream/UPSTREAM.md) 与[上游提交](https://github.com/Pal-AI-Lab/Coopanion/commit/d7b1a0026fed3eb1975a6e0387527d806192cdbf) |
| 本次抓取的上游 HEAD | `07dfa744696f0c63292a7af1b7dfc25a09c87cc2`，2026-10-19 09:24:50（上海）；[最后一笔仅改 README 网站链接](https://github.com/Pal-AI-Lab/Coopanion/commit/07dfa744696f0c63292a7af1b7dfc25a09c87cc2) |
| 最新正式发布 | [v0.2.4](https://github.com/Pal-AI-Lab/Coopanion/releases/tag/v0.2.4)，tag 指向 `ff30069db35cd96ce57be6f034fc8b5057f24075`，发布时间 2026-10-18 05:02:56（上海），不是 prerelease |
| 比较范围 | 基线到上述 HEAD 共 96 笔提交；重点为 `packages/cortico-world-desktop-pet/web/` 的 `kit/rig.js`、`kit/body.js`、`whale/figure.js`、`body-host.js`、`figure-frame.js`、`sound.js`，并查角色模型、宿主与开放 PR |

**结论：有值得择取的动作修复和角色表现改进，但没有底层 rig 渲染器换代。** 上游 `kit/rig.js` 从基线到 HEAD 字节未变；近期有效变化主要在身体行为、鲸鱼 figure 映射、换装、光晕合成与宿主交互。[固定范围比较](https://github.com/Pal-AI-Lab/Coopanion/compare/d7b1a0026fed3eb1975a6e0387527d806192cdbf...07dfa744696f0c63292a7af1b7dfc25a09c87cc2)

建议第一批择取 **#105 清醒坐姿、#152 空中接住、#107 眉毛表现、#228 摆臂相位**；其中摆臂需手工适配本地持物与 authored motion。冬装和窗口攀爬分别作为后续外观项目、空间模型研究处理，不建议整体覆盖 `web/upstream/`。

## 已合入的真正动画与交互变化

下表项目均已进入上述 `main`，PR 状态通过 GitHub API 重新核对。代码链接固定到本次 HEAD；行号为该固定版本。

| 变化 | 提交、代码证据与学习价值 | 本地吸收判断 |
|---|---|---|
| 走路时同侧手腿反向摆动 | [#228 / `76a1179`](https://github.com/Pal-AI-Lab/Coopanion/commit/76a1179e1e31b52020bcc63dda606f7d0950e15a)，10 月 17 日上海时间。步态约 2.1 Hz，原先经过约 1.2 Hz 手臂弹簧后相位滞后；现在把周期摆臂放在弹簧输出之后，并按跑步、挥手、发抖和固定双臂表情抑制摆动。[figure.js L593–615](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/whale/figure.js#L593-L615) | 优先吸收原理。我们手工 `motionPose` 和持物手臂必须优先；不能在已经指定的拿取／握持姿态上再叠加走路摆臂。它修的是 figure 参数合成次序，并未新增关节或 IK。 |
| 坐着保持清醒，临睡才渐困 | [#105 / `7b156c1`](https://github.com/Pal-AI-Lab/Coopanion/commit/7b156c1e9eddb2e655b14229247453934204de53)。显式 `sit` 带 `willSleep:false`；自主坐下预先决定会不会睡，结束前才收眼，打哈欠与慢眨眼也作了调整。[body.js L53–59](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/kit/body.js#L53-L59)、[L420–429](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/kit/body.js#L420-L429) | 范围小，适合改善观察／休息姿态。只移植坐姿语义，保留我们的宿主 NPC 日常调度；不会因为吸收这个修复就恢复上游随机漫游。 |
| 鲸鱼眉毛独立抬压、旋转、弯曲与翻弯 | [#107 / `3fb9f8f`](https://github.com/Pal-AI-Lab/Coopanion/commit/3fb9f8f780bc337d921bf5fd8befc317258d7915)。近远眉拆成独立 deformer；情绪决定整体高度、倾角、弧度和收拢，难过等表情交叉淡入翻转眉形；说话开头和中途偶尔扬眉，并有情绪专属缓动速度。[部件构造 L140–161](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/whale/figure.js#L140-L161)、[参数表与状态 L479–510](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/whale/figure.js#L479-L510) | 表情收益明显，新增形变仍使用原 rig。适合择取，需验证本地 `stateExpression` 的任务脸与对白口型。 |
| 下落／被抛出时立即接住 | [#152 / `d8901a3`](https://github.com/Pal-AI-Lab/Coopanion/commit/d8901a34053f767860aa45f1c8ffd598ec348324)。将抓取收敛到 `grab()`；空中命中后 pointer down 立刻进入 drag，无须先移动超过拖拽阈值。[body.js L704–731](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/kit/body.js#L704-L731) | 小修复可移植；需对接本地导航取消、输入回执和落地归属。属于输入／物理状态衔接，并不是新动作资产。 |
| 鲸鱼冬装及挂件钟摆 | [#156 / `4619fd8`](https://github.com/Pal-AI-Lab/Coopanion/commit/4619fd8feb01b7e983265b964012d7e6a48f774b)。`model.outfits` 提供不同部件清单和 pivot 覆写，打扮使用 `<scheme>-<outfit>`；裸配色 id 仍回退女仆装。毛球、围巾受父级旋转变化、转脸、步态驱动摆动；跨服装销毁重建 rig，直接切换，同服装内仍可渐变配色。[加载／布局 L93–125](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/whale/figure.js#L93-L125)、[换装 L411–435](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/whale/figure.js#L411-L435)、[钟摆 L700–717](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/whale/figure.js#L700-L717) | 这是新服装及次级运动，不是新角色。可学习数据驱动 outfit 与父级运动响应；本地已有 prop、手部 artwork 和接触校准，整套移植工作量明显大于小补丁。 |
| 外装鲸鱼包复用宿主 kit | [#129 / `bcef992`](https://github.com/Pal-AI-Lab/Coopanion/commit/bcef992bf963668511332b6d9839d964f0787d5c)。`createWhaleFigure` 从 `opts.kit?.createRig` 取渲染器，仅独立导入时动态回退 `../kit/rig.js`，解决外装包旁边没有 kit 目录的问题。[figure.js L82–83](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/whale/figure.js#L82-L83) | 可独立择取的包可移植性修复，不需引入 Steam、创意工坊或 Cortico 服务。 |

## 性能、声音与宿主：有价值，但要认清生效条件

| 变化 | 一手证据 | 对我们的意义 |
|---|---|---|
| 光晕只模糊角色附近 | [#109 / `cc60773`](https://github.com/Pal-AI-Lab/Coopanion/commit/cc6077393ae57892d5259180cc2e57e2f209f40e)，后有 [#133 / `15db493`](https://github.com/Pal-AI-Lab/Coopanion/commit/15db4930fd84c4553ae169e117476227a35e9d0a) 的 reach 参数。用 `.figure-clip` 缩小 drop-shadow 区域，iframe 保持舞台坐标。[haloRect](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/body-host.js#L71-L84)、[setHalo](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/body-host.js#L180-L195) | 原理值得保留：屏幕级滤镜通常比角色局部滤镜贵。上游提交报告 M2 Retina 鲸鱼静止 GPU 合计 39.6%→10.3%，属于上游作者环境的数据。本地搜索目前只有 `setHalo` 定义，没有产品调用；不能宣称移植就给我们直接降耗。 |
| 宿主隐藏时关闭新音效 | [#143 / `4457a26`](https://github.com/Pal-AI-Lab/Coopanion/commit/4457a26cd694cf46949dc16ffc98b983be96f62c)。新增 `shown` 与 `setShown(v)`，`ready()` 同时检查宿主可见性和 `document.hidden`，处理 Electron 不节流页面但窗口已隐藏的情形。[sound.js L20–28](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/sound.js#L20-L28)、[L142–148](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/sound.js#L142-L148) | 接口补丁小，但必须有宿主可见性调用才生效；还须保持本地暂停、恢复和音效分类。它是播放门控，不是音频合成引擎更新。 |
| OBS 按绘制帧截图并按原时刻显示 | [#154 / `73bddff`](https://github.com/Pal-AI-Lab/Coopanion/commit/73bddffacbc167b716c8c3c8ab9c10f5decdf1d2)。从独立 33 ms 截图定时器改为绘制通知，限制最多 3 帧截图在途，帧带绘制时刻；展示端按该时刻排队。[上游说明](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/README.md#obs-画面) | 可借鉴录制和展示时钟对齐、限制在途工作的方法；这是导出链路，不应算 rig 帧率升级，也不能替代我们的 native 验收。 |
| 窗口覆盖任务栏，允许角色画到地面以下 | [#127 / `5fc421f`](https://github.com/Pal-AI-Lab/Coopanion/commit/5fc421ff5f94abc32d8d8183359776f1cb80b073) | Windows 宿主几何策略，原逻辑地面仍是工作区底边，窗口延伸并离屏幕底部留 3 DIP；不构成平面二维导航或膝关节能力。 |
| 点击穿透按区域和租约决定 | [#131 / `62d3088`](https://github.com/Pal-AI-Lab/Coopanion/commit/62d3088388b80875c15decb5feb3526e3d24fe19)、[mouse-lease.cjs](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/host/mouse-lease.cjs) | 是宿主输入治理，可参考异步页面命中与原生鼠标状态的租约模型；本地已有自己的窗口与输入契约，不适合直接替换。 |

## 尚未合入的方案

**截至本次实时 API 查询，开放 PR 为 #251 与 #248。** web 工具读取的 GitHub 列表存在两天缓存，曾显示旧 #222、#219；后用 `gh api` 重新核对：#222 已关闭且未合入，#219 已合入。以下状态以实时 API 为准。[官方 PR API](https://api.github.com/repos/Pal-AI-Lab/Coopanion/pulls?state=open&per_page=100)

### #251 窗口顶边站立与攀爬

[PR #251](https://github.com/Pal-AI-Lab/Coopanion/pull/251) 于 2026-10-18 创建，**open、非 draft、未合入**；本次固定 head 为 `9bf3841b6a403183e8a449d8896745f9b47f7c9b`，base 为 v0.2.4 的 `ff30069...`。

- Windows 宿主每 700 ms 读取顶层窗口，按 z 序裁掉被前窗遮住的顶边；只向页面发送变化后的 `{x0,x1,y}` 台沿列表。其他系统返回空列表。[windows.cjs](https://github.com/Pal-AI-Lab/Coopanion/blob/9bf3841b6a403183e8a449d8896745f9b47f7c9b/packages/cortico-world-desktop-pet/host/windows.cjs)、[宿主读取逻辑](https://github.com/Pal-AI-Lab/Coopanion/blob/9bf3841b6a403183e8a449d8896745f9b47f7c9b/packages/cortico-world-desktop-pet/host/electron-main.cjs#L378-L390)
- 新增独立 45 行 `perch.js`，用 `groundAt`、`climbTarget`、`mountX` 处理承托面、攀爬目标和登顶位置；身体增加失去支撑坠落、落到下方台沿、自主走向侧边后攀爬、从窗顶离开等模式。[perch.js](https://github.com/Pal-AI-Lab/Coopanion/blob/9bf3841b6a403183e8a449d8896745f9b47f7c9b/packages/cortico-world-desktop-pet/web/kit/perch.js)、[body.js](https://github.com/Pal-AI-Lab/Coopanion/blob/9bf3841b6a403183e8a449d8896745f9b47f7c9b/packages/cortico-world-desktop-pet/web/kit/body.js)
- PR 自述限制是只支持 Windows，只能由地面向上爬，没有 `pet_climb` 指令，攀爬复用走路蹬腿，figure 可自行识别 `mode === 'climb'`；没有专门的手脚攀附姿态。作者报告的自动化通过不能代替本仓库或三平台实机验证。[PR 正文](https://github.com/Pal-AI-Lab/Coopanion/pull/251)
- 代码层另有边界：`climbTarget` 排除角色 x 已在台沿投影内部的候选，测试也明确期待此时返回 null。因此“在窗口正下方先走出来再爬”不应理解为已经有一条主动规划的保证路径；需要与自主漫游过程一起验证。[perch.js L26–36](https://github.com/Pal-AI-Lab/Coopanion/blob/9bf3841b6a403183e8a449d8896745f9b47f7c9b/packages/cortico-world-desktop-pet/web/kit/perch.js#L26-L36)、[测试 L22–29](https://github.com/Pal-AI-Lab/Coopanion/blob/9bf3841b6a403183e8a449d8896745f9b47f7c9b/tests/pet-perch.test.js#L22-L29)

可学习的是“支撑面随环境消失→失去支撑→重新落地”的状态模型，以及系统窗口源和纯几何 helper 的分离。这是**横向平台、重力与攀爬**；我们的第二期是**完整身体在平面地图中的二维绕障**。两者不是互相替换的功能。直接合并会争用 `pet.fy`、resize、模式、阴影和拖放；若以后采用，应先定义支撑面身份、更新版本、宿主权限与本地导航的边界。

### #248 气泡速度

[PR #248](https://github.com/Pal-AI-Lab/Coopanion/pull/248) 于 2026-10-18 创建，**open、未合入**；固定 head `5122558a68d9b40825f89760d5c6b1b95003adf0`。新增 0.5–2 倍速度，文字打出与停留时间按同一倍率缩放，估时回执也同步；动作前 0.45 秒停顿不变。作者说明开发版用过，没有在打包版真机点击验收。[PR 与 diff](https://github.com/Pal-AI-Lab/Coopanion/pull/248/files)

我们已有自适应 typewriter 与完整回复阅读语义，适合学习“预估和实际共用时长策略”，不宜直接覆盖 `web/speech.js`。它属于对白节奏，未改变动画 rig。

## 兼容方法与不能误报的项目

- **API 2 兼容承诺在导入基线已经存在。** 它不是这十天新加的能力。值得继续学习的是冻结旧角色包夹具，用真实的 ready、报词、出帧、手势、换装、walk 回执验证契约；上游 JSDOM 合约测试可作为我们真实浏览器矩阵外的兼容门槛。[基线承诺](https://github.com/Pal-AI-Lab/Coopanion/blob/d7b1a0026fed3eb1975a6e0387527d806192cdbf/packages/cortico-world-desktop-pet/README.md#L211-L228)、[HEAD 合约测试](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/tests/figure-frame-contract.test.js)
- Coo 新增灯／杯／铸／心／冬五套配色，是现有角色的 palette 与 persona 入口；本次范围没有发现新内置角色。[`fd24136`](https://github.com/Pal-AI-Lab/Coopanion/commit/fd24136)、[Coo palette](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/coo/coo.js#L58-L64)
- Coo 表情包导出 [#240](https://github.com/Pal-AI-Lab/Coopanion/pull/240) 曾合入，但在发布 v0.2.4 前被 [#246](https://github.com/Pal-AI-Lab/Coopanion/pull/246) 撤回；不能列成当前可用能力。右键“扩展页面”也已由 [#233](https://github.com/Pal-AI-Lab/Coopanion/pull/233) 撤回。
- `figure-frame.js` 的近期差异主要是报错国际化与可选 `language` init 字段；`sound.js` 主要是可见性门控。v0.2.4 的多显示器电脑操作、气泡字号和便携安装大多是宿主／产品功能，不能统称为动画引擎更新。[v0.2.4 发布记录](https://github.com/Pal-AI-Lab/Coopanion/releases/tag/v0.2.4)

## 本地合并接缝与推荐顺序

本地静态比较显示 `kit/rig.js` 基线、本地、上游 HEAD 三者相同；本地 `sound.js` 与基线相同，鲸鱼 model／manifest 仍为基线。`kit/body.js` 已有导航和持久任务表情，`whale/figure.js` 已有 `gripProp`、`motionPose`、`handArt`；宿主 frame 协议已有 `navigation-2d-v1`。本地扩展记录见 [UPSTREAM.md](../../web/upstream/UPSTREAM.md)，产品边界见[当前开发状态](../aliveness-development.md)。

在 `/private/tmp` 的三方合并模拟中，整体升级到 HEAD：`body.js` 为 0 个文本冲突，`figure.js` 为 4 个，`body-host.js` 为 1 个，`figure-frame.js` 为 1 个。单项补丁检查：#105 与 #152 的 body 补丁能通过直接 apply 检查；#107 直接应用失败但三方为 0 冲突；#228 直接应用失败且三方有 2 个冲突，接缝正是本地手臂覆写；#109 三方有 1 个冲突。**这只证明文本层情况，不证明行为兼容，也没有应用到生产文件。**

另用 Node 直接执行 #251 固定 head 的纯几何模块：台沿为 `{x0:100,x1:500,y:200}`、脚底 `y:600` 时，`x:300` 的正下方场景返回 `null`；`x:50` 返回左侧攀爬目标；移除台沿后 `groundAt` 返回地面 `600`。这只核对 helper 的实际分支，不是完整自主攀爬或 Windows 实机验收。

1. 小修复批次：#105、#152、#107，以及独立的 kit 注入改动；保留本地调度、导航、角色与输入契约。
2. 步态批次：#228 的周期合成后置，明确 authored pose／持物对手臂的优先权；验证行走、跑步、转向、挥手、拿取、握持的组合。
3. 生命周期与性能按实际调用评估：声音门控需要接宿主可见性；光晕尚无本地产品调用，先不承诺收益。
4. 冬装作为独立适配：必须保住重新建 part tree 后的 prop／手部注入，重新校准腕点、接触点、层级与脚底占地；核对旧 scheme 持久化、preset thumb 回退、贴图预载内存和许可说明。
5. #251 先研究支撑面模型；等待上游合入不等于我们就可直接合入，仍须先与平面导航、宿主窗口来源和多平台边界协调。

若执行以上任何产品行为改动，仍需同步实现、测试与使用说明；涉及本仓库规定的交互／NPC 日常范围，包含 `test:inbox-ui`。自动化矩阵与物理实机应分别报告。本报告没有宣称任何移植已通过本地运行验证。

## 复核方法与限制

- 官方 web 打开仓库、README、releases、PR 列表，满足在线核实；Git clone 固定 main 与导入 SHA，使用 `git log`、`git diff`、`git show` 核实具体文件、提交和 tag。官方 GitHub API 经 `gh api` 核实最新默认分支、正式发布和 PR 状态；匿名 REST 请求曾遭限额，认证后的只读 API 正常。
- 临时只读上游仓库：`/private/tmp/coopanion-upstream-20261019`；导出核心文本：`/private/tmp/coopanion-upstream-core-20261019/{d7b1a00,07dfa74}/`；PR API 快照：`/private/tmp/coopanion-upstream-api-20261019/`；#251 patch：`/private/tmp/coopanion-pr-251-20261019.patch`。这些临时文件用于本次复核，不是发布证据。
- 报告中的“已合入”指上游状态，“候选”是本地适配判断；作者自报测试和性能数值未在我们环境重现。未启动 upstream 应用、未安装依赖、未做长期资源采样；不涉及上游私有分支或不可见提案。
- 本地对比与合并模拟位于 `/private/tmp/coopanion-integration-assessment-20261019/`，其中 `base/`、`head/`、`local/` 为固定文件副本，`merge-preview/` 和 `patches/` 为模拟输出。补丁检查使用 `git apply --check -p4`，三方检查使用 `git merge-file -p`，均未写回仓库运行时。


## 生活感设计与实现补充

本节针对“上游有没有类似生活化的设计思路和实现”继续核查。2026-10-19 再次在线打开官方 README，并通过 GitHub API 核对 `main` 仍为 `07dfa744696f0c63292a7af1b7dfc25a09c87cc2`。本次还读取该提交钉住的 **Cortico 子模块 `087289dfcdf262a771c573d16dbaf2392ce6764b`**，避免把 Cortico 最新版本误当成 Coopanion 正在使用的版本。[子模块身份](https://github.com/Pal-AI-Lab/Coopanion/tree/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/vendor/cortico)

**有，而且已经形成“人格与记忆、事件唤醒、独立身体反射”三部分；它更侧重一个能持续相处的自主角色。** 但这些部分中既有模型提示词，也有强制执行的运行时。不能把“性格写着喜欢打盹”直接视为身体具有对应的精力、作息或日程系统，也不能把“心跳入口存在”视为默认在主动聊天。

| 对应思路 | 已实现的触发与边界 | 基线／近期身份及一手证据 |
|---|---|---|
| 1. 有自己的性格，允许安静 | Coo 的自述明确写“不是随叫随到的问答机器”，无人理会时可待着、散步、打盹，有话才说；winter 更少言，heart 更活泼。这些是放进模型前缀的角色策略。身体的随机 `decide()` 不读取 persona id、性格文本或关系资料；身体策略直接受 `roam: free/calm/off` 等参数控制。人格可能经模型调用 `pet_set`、`pet_act` 间接影响它，并没有自动映射“安静人格→少走动”的统一性格参数。 | 这种自述和可自改 CONSTITUTION 的思路在导入基线已经存在；近期 [#209 / `fd24136`](https://github.com/Pal-AI-Lab/Coopanion/commit/fd24136) 增加六种起始人设与引导选择。固定源码：[Coo 自述](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/core/seed/persona/coo.zh.md)、[winter](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/core/seed/persona/winter.zh.md)、[body 的 decide](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/kit/body.js#L323-L334)；[基线自述](https://github.com/Pal-AI-Lab/Coopanion/blob/d7b1a0026fed3eb1975a6e0387527d806192cdbf/core/seed/CONSTITUTION.md)。 |
| 2. 角色可修改自己，保留共同塑造的性格 | `CONSTITUTION.md` 是工作区文件，可由模型文件工具修改，下一次 session／前缀重建生效。应用只会替换与出厂文本完全相同的自述；已经由人或角色修改的自述，换语言时不覆盖。它让性格能长期保留，但没有把每次修改都自动转成身体行为参数。 | “可自改”原先已有；#209 的人设选择与 `personaOf` 精确识别出厂文本是近期扩展。[seed.ts 的 personaOf/applyPersona/followLanguage](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/core/seed.ts#L145-L168)。 |
| 3. 长期了解使用者，记忆有层次 | `PARTNER.md` 全文进入系统前缀，`partner/` 放细节、故事和长记录，按需读取；提示词要求精炼、合并或删除过时信息。每次成功的工作区写工具调用都会串行提交 Git，`blobs/` 不进历史；没有 Git 仍写文件。它是文件型长期记忆，是否记录、如何归纳由模型决定；不是运行时自动算出的好感度或关系阶段。 | Coo 专属 Persona 与逐次版本记录来自近期 #209；[#214 / `6055d64`](https://github.com/Pal-AI-Lab/Coopanion/commit/6055d6438031a4d12fd734d578bcdf96a0698728) 增加常驻精炼要求及旧文件归并。[core/persona.ts](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/core/persona.ts)。 |
| 4. 自主醒来，稍后记得回来 | 有两条独立路径：可配置的 Cormini 基线心跳，以及角色主动设置的持久 `alarm_set`。**默认 `tick.intervalMinutes = null`，基线模型心跳关闭**；Coopanion 继承默认配置，没有替它设定非空间隔。启用后，心跳按配置等待，两拍间没有外部活动就指数退避，最多基准的 8 倍；外部活动将退避计数复位。闹钟到时以 `flush` 内部事件唤醒，存于 `alarms.json`，应用关闭时错过的到下次启动补送，支持每天重复。运行时保证的是事件和唤醒；是否开口、说什么仍由模型决定。 | 导入基线已经接入 Cormini，并已有持久闹钟；近期主要改造 Persona 包装和语言，并非新发明唤醒。当前准确机制：[Coopanion build 与 tick 接线](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/core/companion.ts#L488-L513)、[固定 Cortico 默认值](https://github.com/Pal-AI-Lab/Cortico/blob/087289dfcdf262a771c573d16dbaf2392ce6764b/bots/cormini/index.ts#L66-L77)、[Heartbeat](https://github.com/Pal-AI-Lab/Cortico/blob/087289dfcdf262a771c573d16dbaf2392ce6764b/bots/cormini/persona/heartbeat.ts)、[alarms.ts](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/core/alarms.ts)、[NoticeWorld 到期投递](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/core/notice.ts#L417-L422)。本节未追溯心跳内部退避算法的首次引入版本。 |
| 5. 触摸先有反射，再积累成交流 | 戳、摸、拖拽等由身体立即产生表情／动作；事件稍后交给模型，环境提示词明确提醒“已经做完，不必再演一遍”。同种触摸在 2.5 秒内合批计数；只让配置选中的种类立即唤醒，其他 `piggyback` 到下一次；一次触摸已唤醒后，本轮结束前的后续触摸先积累，避免每次都开一轮。`pet_set` 的禁止／默认／任意／自定义权限在运行时判定，需要同意的设置等待确认结果。 | 反射、合批、回合内限制、`pet_quiet` 基线已有；近期 [#106 / `b3f21c9`](https://github.com/Pal-AI-Lab/Coopanion/commit/b3f21c9) 扩展为四档回应与自主配置权限。[world.ts onTouch/flushTouch](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/src/world.ts#L1155-L1197)、[权限配置](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/src/config.ts#L68-L100)、[提示词](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/src/ENV_PROMPT.md)。 |
| 6. 没模型也会眨眼、张望、漫游、休息 | kit 有本地状态机与概率权重，自主选择走、跑、张望、跳、坐、表情和等待；外部命令、倾听、拖拽等优先。坐下可能睡一小段后醒来，这些不依赖每次调用模型。`pet_quiet` 临时覆盖声音／漫游，到时恢复，用户改设置会结束该覆盖。**“夜间／白天”当前是黑白外观主题；没在这套身体逻辑里发现按真实时间运行的完整昼夜作息、需求条或精力循环。** | 本地动作状态机和 quiet 基线已有；#105 是近期坐姿清醒修正，见上文。[body.js](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/web/kit/body.js#L323-L435)、[quiet 运行时](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/src/world.ts#L1739-L1763)、[外观主题说明](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/README.md)。 |
| 7. 被打断后知道发生了什么，跨上下文保留意图 | `pet_walk_to` 有操作 id、完成／中断回执，收到调用 abort 就发 `walk-stop`，报告停下的位置；模型上下文交接有文件、handoff 笔记和提示词，提醒把尚在跟进／尚想做的事落盘，交接后自然继续。前者是真正的动作取消协议，后者是模型级记忆与续接；没有因此得到“拿到一半的物件姿势与所有权原子恢复”的保证。 | walk 中断与 Cormini 交接基线已有；近期 Coo 专属 `pressureNote`、`handoffNoteLines` 增强了提示与语言表达。[walkTo](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/src/world.ts#L1662-L1701)、[Coo Persona 交接](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/core/persona.ts)。 |
| 8. 把桌面看成可居住空间，但物件日常还不是同类能力 | 主分支仍沿当前屏幕底边横向行走。开放 #251 才提出 Windows 窗口顶边承托、失去支撑掉落与自主攀爬，尚未合入；它与本地平面二维绕障的空间模型不同。在核对的桌宠工具、kit 和 figure 中，没发现对应我们“物件所有权、拿取／握持／释放接触、站点间连续事务”的现成通用协议。对白脚本可以排动作，但不等于具备物件任务状态机。 | 横向 walk/action 工具基线已有；窗口环境属于未合入方案，身份见上文 #251。[当前工具／动作契约](https://github.com/Pal-AI-Lab/Coopanion/blob/07dfa744696f0c63292a7af1b7dfc25a09c87cc2/packages/cortico-world-desktop-pet/src/ENV_PROMPT.md)、[PR #251 固定 head 的支撑 helper](https://github.com/Pal-AI-Lab/Coopanion/blob/9bf3841b6a403183e8a449d8896745f9b47f7c9b/packages/cortico-world-desktop-pet/web/kit/perch.js)。 |

与本地进度的对照需要区分已实现和蓝图：

| 本地范围 | 当前身份与上游的对应 |
|---|---|
| NPC 小窝日常、精力／兴致、任务退让、邀请和关系存档 | 已有规则实现，日常不调用模型；与上游本地身体活动、触摸回应有重合，但行为目标和存档语义不同。见[自主陪伴契约](../companionship-contract.md)。 |
| 二维空间、绕障与 O03 接触样板 | 第二期已验收；二维导航与 O03 拿放仍分开，当前没有持物二维行走。上游 #251 的平台承托也不等同于此平面空间模型。见[开发状态](../aliveness-development.md)。 |
| 连续动作与物件、完整生活／工作交接、人格与更多生活选择 | 属于后续候选，不能作为本地已经完成的能力来比较。上游人格和记忆可作后续参考；本次查到的上游协议也没有直接提供我们蓝图里的接触提交、身体拥有权和物件中断恢复闭环。见[后续蓝图](../design/aliveness-implementation-plan.md)。 |

对我们最有参考价值的是：把“身体当场反应”和“角色稍后理解”分开；让触摸在合适的时间合批进入交流；把长期人物画像和事件细节分层；为主动行为设置明确唤醒来源、静默与成本退避；为模型续接同时保留原意、回执与真实发生结果。以上是可学习的架构方法，不代表本仓库已接入上游整个人格或模型服务。性格、日程和自主说话需要结合我们已有规则日常与本次授权另定范围。
