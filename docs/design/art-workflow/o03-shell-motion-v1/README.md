# O03 贝壳：动作设计工作流与可操作样片

状态：现有分层模型下的单屏水平拿放闭环已实现，支持重复拿放、慢放、暂停续接、逐帧推进和独立试摆。主产品自主生活与二维导航尚未接入。前两轮[美术制作](../o03-shell-v1/brief.md)与[物件绑定](../o03-shell-interaction-v1/README.md)记录保留原字节。

## 打开与操作

```bash
node docs/design/art-workflow/o03-shell-motion-v1/prepare-model.mjs --check
PORT=4188 node docs/design/art-workflow/preview-art-workflow.mjs
```

打开[动作工作台](http://127.0.0.1:4188/)。角色固定 180px，贝壳固定 40px，使用 DeepSeek 配色；不读取实际工作内容，不修改日常 profile。

实际操作录制：[10.63 秒完整拿放样片](shell-loop.webm)。录制仅来自隔离浏览器页，包含全部动作阶段；[capture.json](capture.json)记录原始截图时间与摘要，按捕获间隔编码，没有生成补间图。视频解码与播放结果见 [video-playback.json](video-playback.json)。

- “完整拿放”：走近、拿起、携带到指定位置、放下并站稳，结束后可再次操作。
- “拿起／带走并放下”：可分开操作，持物时可改变放置位置；落点支持左右两侧。
- “暂停／继续”：冻结身体与动作时钟、保留拥有权；行走恢复使用新 walkId。
- 0.25×／0.5×／1×：身体与姿势时钟一起减速。“前进一帧”用于暂停的非行走动作，每次推进 1/60 秒动作时间。
- 六个关键姿势：使用真实模型试摆，不增加拿放计数；重置后回到交互。地面贝壳可用真实指针左右拖动，按钮支持键盘。

## 制作工作流

1. **检查模型能力**：肩、腰、颈、视线、腿部网格与袖口遮挡已有基础；独立肘、膝、手指关节尚不存在。原角色模型与贴图保持原字节。
2. **试摆关键姿势**：站稳 → 看向 → 俯身接触 → 接触持有 → 持物站立 → 松手收手；用实际网格投影检查手部、物件和脚底。
3. **连接与调时**：平滑插值连接关键姿势，加入视线先行、接触停顿、起身携带、落地停顿、松手、收手和起身。用慢放及逐帧检查衔接。
4. **重复操作**：同一贝壳在不同左右落点完成三轮拿放，包含俯身与携带中断；缺失接触或抵达时不提交拿放。
5. **按画面补资源**：根据[美术缺口](art-gaps.md)决定局部手型、手臂或遮挡素材。本轮没有生成新美术图。

| 阶段 | 动作与最短时长，1× | 接续条件 |
|---|---|---|
| 接近 | 原生 walk；收步 0.36s | 当前 ID 的真实 arrived、实际位置及朝向稳定 |
| 观察与伸手 | 向下看 0.30s；俯身伸手 0.85s | 手到抓握点 ≤1.5px，连续四帧稳定 |
| 抓住与起身 | 接触停顿 0.22s；起身 0.78s | 保持接触后转移拥有权；物件与手共用变形链 |
| 携带 | 持物停留 0.48s；原生 walk | 持物臂保持姿势，另一只手自然摆动 |
| 放低与松手 | 收步 0.36s；放低 0.90s；落地停顿 0.20s | 物件地面锚点距地 ≤1.5px，连续四帧稳定 |
| 收势 | 松手停顿 0.18s；收手 0.34s；起身 0.72s | 物件留在释放位置，手先离开，身体再起身 |

时间用于节奏，不能代替接触。俯身使用腰部 20° 与约 7.81 模型单位的下沉（当前尺寸约 5.49px），不切换坐地裙摆；下沉时压缩现有腿部网格并固定脚底，不宣称实现独立膝关节。接触时贝壳保持直立，起身后逐渐倾斜 12°，释放保留实际绘制矩形。

## 制作入口

| 文件 | 用途 |
|---|---|
| [motion-profile.json](../../../../web/props/shell/motion-profile.json) | 关键姿势、视线及各段时长，动作调整的主要入口 |
| [prop-motion.js](../../../../web/prop-motion.js) | 插值、回执／接触门槛、拥有权与中断代次 |
| [figure.js](figure.js) | 隔离 body adapter，驱动真实身体、慢放、逐帧与测量 |
| [固定鲸鱼渲染器](../../../../web/upstream/whale/figure.js) | 可选 motionPose，现有网格俯身、脚底固定和物件倾角补偿 |
| [scene-model.json](scene-model.json) | 角色模型、贝壳及动作配置快照 |
| [key-poses.json](key-poses.json) | 六个试摆姿势的实际投影、拥有权与计数 |

修改动作配置后运行不带 `--check` 的 `prepare-model.mjs` 更新快照，再检查关键姿势、闭环与回归。默认产品工厂未提供 motionPose；任务、关系与生活调度没有启用此动作。

## 验证与画面

[validation.json](validation.json)记录执行环境、源码／资源摘要与检查状态。[browser-qa.json](browser-qa.json)保留三轮真实闭环的阶段样本、事件和测量；自动通过不替代用户对观感的评审。

- 三轮闭环通过 30 项检查：俯身／携带打断、续接、逐帧推进、左右落点、13 个动作阶段、接触、脚底与拥有权。
- 实际观察 1731 个身体帧：物件拥有权切换最大跳变约 0.694px，站定动作手部最大单帧位移约 1.474px；持物绑定误差 0，脚底最大离地误差约 0.000016px，全程坐地系数为 0。
- 9 项定向测试覆盖错误／过期回执、缺失接触、姿势连续、中断恢复、重复拿放、超时、代次与不计分试摆；原物件策略的 8 项测试继续运行。
- 手动操作另行通过 0.25× 键盘拿起、持物暂停冻结和实际指针拖动；见 `keyboard-slow-pickup.json`、`pause-freeze.json` 与 `pointer-drag.json`。姿势试摆未增加拿放计数。
- 完整 `npm test` 通过 243 项 Vitest（另 1 项跳过）及 12 项 Node 检查；类型检查、构建及完整 `test:inbox-ui` 均通过。上一轮物件交互场景复验 13 项通过，记录在 `previous-prop-regression.json`。

关键姿势截图：[俯身接触](screenshots/pose-contact.jpg)、[接触持有](screenshots/pose-contactHeld.jpg)、[持物站立](screenshots/pose-carry.jpg)、[收手](screenshots/pose-retract.jpg)。试摆画面与[实际闭环验收截图](screenshots/loop-passed.jpg)分别保存。

```bash
node node_modules/vitest/vitest.mjs run tests/prop-motion.test.js tests/prop-interaction.test.js
node docs/design/art-workflow/o03-shell-motion-v1/prepare-model.mjs --check
npm run typecheck
npm run build
npm test
npm run test:inbox-ui
```

## 范围

单个贝壳、固定配色／尺寸的浏览器水平场景。未验证原生桌面、物理多屏、任意二维寻路、其他角色或所有尺寸；没有发布、安装或修改日常 profile。PNG 与角色贴图没有重绘，抓握细节仍受现有分层美术限制。
