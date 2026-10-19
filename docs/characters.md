# 角色对接：Coopanion API 2

插件直接使用 [Coopanion 固定版本](../web/upstream/UPSTREAM.md) 的角色运行时和沙箱协议。新角色通过 `figure.json` API 2 对接，不使用旧 `.dshpet` 或关键帧 schema。

## 包结构与导入

```text
my-character/
  figure.json
  figure.js
  model.json       # 可选
  textures/        # 可选
  sounds/          # 可选
  README.md
  LICENSE
```

压缩为 ZIP 后从角色面板导入。清单可以位于根目录，也可以包含最多三层外包装目录；一个 ZIP 只放一个角色。相同 id 的导入更新该角色，点击使用后应用新版本。内置 `whale`、`coo` id 保留。

压缩与解压总量均不超过 128 MiB，最多 2048 项，单文件最多 16 MiB，清单最多 256 KiB。拒绝绝对路径、目录穿越、反斜线、控制字符及特殊 URL 路径。打包脚本拒绝符号链接。

```bash
npm run build
npm run character:pack -- examples/star paper-star.zip
```

## 清单

最小示例见 [examples/star/figure.json](../examples/star/figure.json)。必填版本是 `manifest: 2`、`api: 2`；id 使用小写字母、数字和连字符，最多 32 字符。`name`、`about` 为语言到文本的映射，展示优先中文，回退英文或第一个值。

`entry` 指向包内 JavaScript ES 模块，`export` 是工厂函数名。`model` 可选，指向包内 JSON，由宿主读出后传给工厂。

`vocab` 声明角色理解的表情和动作，每项有 `id`、`kind`（expression / motion）、`names`、`about`、`seconds`，可选 `lasting`。面板按词表提供动作预览；宿主只调用清单和角色实际声明支持的词。

`axes` 定义换装维度及选项，`presets` 定义各轴的组合。预设使用自身 id；自定义组合使用各轴选项 id，按 axes 顺序以 `-` 连接。选项 id 本身不能包含连字符。面板支持预设及多轴独立选择，搭配随角色选择保存。

`sounds` 将音效名映射到 `{ file, kind, volume }`，文件为 OGG / MP3 / WAV，kind 为 move / touch / face / snore。宿主加载并播放，遵循统一音效开关。`can.walk` 声明是否支持移动。

## 工厂接口

```js
export async function createMyBody(base, { model, scheme, kit, loadImage, asset, host }) {
  const figure = await createMyFigure({ model, scheme, loadImage, asset });
  return kit.createBody(host, { figure });
}
```

`base` 是该角色资源的 URL；`asset(path)` 生成包内资源 URL，`loadImage(url)` 加载可用于 WebGL 的图像。角色不能自行 `fetch()` 模型或外部数据，应使用传入的 `model`、`loadImage` 和 `asset`；包内模块之间可以相对 import。模型和音效由可信宿主读取。

`host` 提供：

- `root`：绘制根元素，覆盖活动区域。
- `bounds()`：`{ W, H, floorY, S }`，单位为屏幕像素；角色逻辑坐标在 256 单位空间内，S 为缩放。
- `start`：初始 x、朝向等。
- `emit(kind, detail)`：动作结束、抵达、触摸或模式事件。
- `sound(name, kind, ...args)`：请求宿主播放音效。

推荐复用 `kit.createBody()`，即可获得共享动作、表情、粒子、视线、说话脉冲、走动、拖拽和重力。角色负责绘制；[SVG 星星示例](../examples/star/figure.js) 展示 `figure.draw(group, face, frame)`，其中 frame 包括 `face`、`mode`、`t`、`blink`、`look`、`talk`、`gesture` 等。网格角色可使用 `kit.createRig()`；完整实现见 [原生大肥鱼](../web/upstream/whale/figure.js)。

也可实现自己的 body。必需方法是 `step(dt)`、`layout()`、`do(word)`；其余接口为可选：

```text
resize(), walk(x, run, id), stopWalk(id), pointer(type, point),
drop(point), shift(dx, dy), place(x, facing), set(state), cue(kind),
talk(), setScheme(id, {fade}), dispose()
```

`layout()` 返回位置、模式和交互区域：

```js
{
  x, facing, mode, busy, moving, pressing, cursor,
  box: {x, y, w, h},
  hit: [{x, y, r}],
  bubble: {x, y},
  side: {x, y, reach}
}
```

宿主校验区域大小和位置，仅在 box 与命中圆内接收角色点击；气泡跟随 `bubble`。角色移动和拖拽由 body 负责，宿主不再维护另一套运动轨道。

## 分支二维能力（显式选择）

生活感分支的空间预览使用可选 `navigation-2d-v1`，不提高 API 2 版本，也不从 `can.walk` 推断二维能力。body 返回 `capabilities:['navigation-2d-v1']`，frame 在 ready 握手中报告，宿主仅在能力存在时转发 `navigate`。共享 kit 只有显式 `navigation:true` 才启用；默认工厂保持旧水平移动。

```js
body.navigate({ id, generation, model, target: {x, y} });
body.cancelNavigation('cancel');
// 仅用于明确的编辑／拖动，不产生 arrived：
body.place2d({x, y});
```

`model` 包含 `revision,width,height,body:{left,right,top,bottom},margin,obstacles:[{id,x,y,w,h,kind}]`，可选 `groundBody:{left,right,top,bottom}`。仅显式标定为 `kind:ground-solid` 的实体采用有限地面占用；其余实体、禁区和世界边界保持完整 `body`。缺少 `groundBody` 时保持原全身模型。`layout` 增加实际根 `y` 和有界 `navigation` 状态，原 box／hit／bubble 同源。事件为 `navigation-arrived`／`navigation-interrupted`，包含 `{id,generation,revision,x,y,by}`；与旧水平 `{walkId,x}` 的 arrived 分开。调用方必须核对三元身份，不能由路程计时合成到达。

旧角色没有 capability 时 `navigate` 返回 false，调用方保留水平回退。二维角色的旧 `walk(x,run,id)` 仍可用，并中断当前二维路线；显式动作、指针和几何调整也中断导航。标定、规划精度和限制见[空间契约](design/living-space-contract.md)。二维能力当前只由私有空间工厂启用，未变更已发布自主陪伴的默认行为。

## Harness 状态映射

| Harness 状态 | 请求的角色词 | 附加状态 |
|---|---|---|
| 待机 | neutral | 可进行闲时活动 |
| 思考 | thinking | thinking=true |
| 生成 / 工具工作 | determined | expression=determined，生成时嘴部脉冲 |
| 等待确认 | worried | expression=worried，停止闲时活动 |
| 已提交目标完成 | happy | 2.5 秒后回待机 |
| 普通回合／目标中间轮回复 | neutral | 保留全文及未读，不触发成功庆祝 |
| 出错 | sad | expression=sad，停止闲时活动 |
| 用户休息 | sleep | 唤醒时 stand |

共享 kit 支持可选 `set({ expression })`（kit 表情名或 null）来保持任务神态，不重复触发表情音效；独立实现的 API 2 body 可处理或忽略该扩展。流式片段只驱动嘴部，最终回复用于说话和阅读。事件互动提示独立呈现审批、提问和各类回合结束，提供源会话与待处理列表入口。

未声明的词不会调用。拖动或空中动作结束后再应用待处理的任务表情。逐字显示每个非标点字符时调用 `body.talk()`，共享 kit 将其转换为嘴部脉冲；配合 Web Audio 合成音效，不是 TTS。点击、换装及动作预览不会发模型消息。

## 提醒动作与回退

角色显示时，每次事件互动按下表从左到右选择清单与 body 都支持的第一个词。若没有可用词，保留文字提示和待处理入口。持续任务神态仍按上表设置。

| 事件 | 候选词（按优先级） | 提示／入口 |
|---|---|---|
| 已提交目标完成 | happy → wave → neutral | 当前最终回复优先进入阅读气泡；其他目标完成可显示互动提示 |
| 普通回合／目标中间轮回复 | 无庆祝动作 | 保留阅读气泡及未读，文案见[提醒契约](notification-contract.md) |
| 审批 | worried → thinking → neutral | 下一步需要你确认；返回源会话处理 |
| AI 提问 | curious → thinking → worried → neutral | 问题预览及待处理列表 |
| 回合出错 | sad → worried → neutral | 返回源会话查看详情 |
| 用户停止（aborted） | nod → neutral | 先停在这里，随时继续 |
| 中断（interrupted） | confused → worried → neutral | 这段任务中断了，陪你回去看看 |
| 阻塞／输出上限 | worried → thinking → neutral | 查看下一步如何继续 |
| 待处理请求补提醒 | wave → worried → neutral | 刚才那件事，还等你看看；同一会话同时到期时显示数量 |

提示等待输入、阅读、拖拽及当前动作结束后呈现；减少动态效果时保留提示和状态，跳过提醒动作。打开或收起提示不会决定审批、回答问题或把最终回复标记已读。请求处理状态由 Harness 同步，已结算请求不会再次呈现排队提示。

## 隔离与许可

角色模块仅在 opaque-origin iframe 中执行，不具备外部网络、Node、Electron 桥或访问父页面 DOM 的权限。宿主只提供包资源、模型、边界和有限消息接口。原生 IPC 只接受主页面调用。

应用与上游代码采用 AGPL-3.0-or-later。角色作者应在清单和 LICENSE 中注明自己的代码与素材许可；应用许可不改变独立素材的权利。大肥鱼贴图在上游 AGPL 授权之外，完整声明见 [第三方说明](../THIRD_PARTY_NOTICES.md)。

[自主陪伴](companionship-contract.md)按词表组合有限日常，宿主负责动机、邀请和成长；角色包不持有这些权限。抚摸成长需要可信页面验证的真实轨迹，角色自行上报 touch 或预览动作不计入关系。当前任务神态／提醒动作仍优先。

NPC 日常复用水平定点 `walk`、按身份 `stopWalk`、姿态、表情与合成音效；输入感知和调度由可信宿主管理。缺词或无移动能力的角色按其清单和 body 能力降级，详见[自主陪伴契约](companionship-contract.md)。

## 可选物件绑定验证

内置鲸鱼的 figure 工厂可由显式 body factory 提供 `gripProp`（纹理、UV、局部矩形、手部／抓握／落地锚点）及 `gripPose()`。物件在同一 armFar 变形链中绘制，前袖口层覆盖其前景；`figure.gripFrame` 只读返回实际变形后的手部、物件抓握点、地面锚点及三角矩形坐标。未提供选项时不加载物件，也不更改默认角色行为。

这是固定鲸鱼渲染器的可选制作接口，不是 API 2 的通用持物或二维移动声明。[当前 O03 工作台](design/art-workflow/o03-shell-hands-v1/README.md)负责动作准入、拥有权和接触检查；主产品的日常、关系与任务结算没有启用此物件。物件 PNG 与使用规格位于 `web/props/shell/`，素材来源及未覆盖的验收范围由该场景记录。

固定鲸鱼还可由显式制作工厂提供 `motionPose()`：腰角、下沉量、两臂角度、视线、脚底固定权重与物件倾角。它在现有网格上连续调姿，物件通过手部子变形链补偿倾角，抓握点仍与实际手部绑定；`gripFrame` 额外报告姿势、实际朝向和脚底投影。默认工厂未启用这些字段，角色包协议没有扩充。[当前动作工作台](design/art-workflow/o03-shell-hands-v1/README.md)保存配置、慢放／逐帧入口及美术限制。

显式 `handArt` 提供手部原图和源像素腕点／接触点。当前使用握持原图的单一连续网格；`motionPose().hands` 是姿势权重，驱动手指开合，保持袖口和表面透明度固定。掌部与前景指尖的纹理像素互补，避免重复轮廓。`gripFrame.handArt` 报告姿势权重、实际闭合量、表面 alpha、腕部／接触误差与层级。制作时可选 `handDetail` 重用同一实际绘制帧；隔离工作台同时传入 `externalProp`、`raster` 和 `handDetail` 时，返回同帧的身体与前景指尖图像及其矩阵，由宿主将两者与物件一次性合成，地面／持物保持同一遮挡次序。这些选项未用于默认产品工厂，不进入产品诊断。资源与验证见[手型工作记录](design/art-workflow/o03-shell-hands-v1/README.md)。
