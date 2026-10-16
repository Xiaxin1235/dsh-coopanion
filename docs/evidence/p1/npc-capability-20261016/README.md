# NPC 日常修订：现有原语与素材能力检查

日期：2026-10-16。评估对应源码树 `a1c1b43b3427bf9391d00b42dae0da45a021837f`，内置上游固定导入仍为 `d7b1a0026fed3eb1975a6e0387527d806192cdbf`。本轮只有能力评估与[方案文档](../../../npc-daily-life-plan.md)，没有修改运行代码或候选包。

## 素材核对

[清单与源码摘要](inventory.json)直接读取本地文件：鲸鱼声明 19 个 expression、18 个 motion、walk 能力和 8 套配色；sounds 为空。声音由已有 Web Audio 合成支持，不能把空 sounds 理解成完全没有声音，也不能说已经有独立录音素材。

鲸鱼模型提供身体、服饰和脸部图层；没有可独立交互的窝、床、玩具、食物或家具系统。`paper-star` 是可切换角色示例，声明较少词，不等于鲸鱼的手持物件。小窝锚点和轻量标记、空间约束、键盘活动适配与意图恢复均待宿主实现。

## 隔离运行检查

[最终报告](report.json)、[探针源码](probe.mjs)及[原始输出](probe.log)绑定实际源码文件摘要。Node 24.21.0、实际 API 2 opaque iframe、headless Chromium／WebGL；使用独立临时数据目录，未接触日常 Desktop 或 VM。

检查通过：

- 定点 `walk(x,false,id)` 实际抵达目标，收到对应 `arrived`。
- 不匹配的 stop ID 不会取消移动；匹配 ID 停止后位置稳定。
- look 完成、sit／stand、sleep／唤醒与 turn 朝向切换有效。
- 持续 thinking 表情跨过短表情超时仍呈现；happy 表情进入实际绘制。
- 收到 step、look、happy 等音效请求；未连接扬声器播放。

首次探针误用仅纸星星示例提供的 `data-face` 属性来读取鲸鱼，超时；[原探针](initial-probe.mjs)、[失败原始日志](initial-probe.log)保留。修订仅在测试 HTTP 响应层为鲸鱼 draw 附加只读 `data-probe-face` 属性，观察真实 frame.face，不改变动作、物理或绘制决策；产品文件未修改。首次执行使用系统默认 Node 26.11.1，最终检查使用 Desktop 的固定 Node 24.21.0。

这些通过项证明基础能力可用于原型，不证明新 NPC 日常循环已经实现、全部表情视觉可辨、跨平台键盘可用、原生避让不会遮挡，或用户已感到“活”。当前候选的体验未通过结论保持。

原始文件由 `sha256.json` 固定。下一轮实现须另建场景和验收记录，旧候选两小时资源观察不能替代新调度的资源验证。
