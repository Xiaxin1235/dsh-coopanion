# 生活感功能：当前开发状态

生活感分支的唯一接手入口。继续使用 `codex/aliveness-foundation`；版本、依赖与命令从 `package.json`、锁文件和工作流核对，发布身份从[文档索引](README.md#验证与产物身份)进入。

## 当前任务：文档收口与分支同步

2026-10-20 用户要求整理全部文档、清除接手歧义，然后提交并推送 GitHub。沿用当前分支；本次同步包含已有本地交付和文档整理。后续功能阶段仍按用户实际指令选择，历史“新 session 开始下一阶段”不自动启动 5B／5C，也不代表第四阶段或 5A 观感已验收。

## 当前实现：第 5A 期反馈修正已提交，观感待验收

交付提交为 `178437b8ca3ee3c47879c852c4f6a9fd95c99c28`，规则见[人格行为契约](design/personality-behavior-contract.md)，固定工程结果见[反馈报告](reports/stage-5a-feedback-20261020.md)。首版被否定的表现和旧授权已移入[5A 阶段历史](archive/2026-10-aliveness/stage-5a/README.md)。

- 已实现对象关注、侧向接近、实际注视、既有表情／点头、普通观察少坐与独立起身；同地图、事实、种子及相同时间参数下可对照安静／活泼的目标和表现。
- 浏览器与隔离原生各 28 项通过；完整单元／脚本、类型、inbox、连续动作、工作表现与双线故事结果按固定报告分别解释。这些是 `178437b` 交付的本地验证，不是本次文档整理新跑的功能验收。
- 第四阶段整理流程已获确认；增强后的情绪／守候自然度及 5A 修正后的观感均待用户验收。默认产品二维装配、5B 有限记忆、5C 回应合批、第 6 期出门和第 7 期跨屏仍是独立后续事项。

## 已有交付与验证边界

| 阶段 | 当前状态与权威入口 |
|---|---|
| 第 1–2 期空间与二维运动 | 指定 180px 主配色角色／40px O03、同地图二维运动与花箱绕路已验收；现行模型见[生活空间契约](design/living-space-contract.md) |
| 第 3 期连续动作与物件 | 用户已确认连续拿放及花箱／到岗拾取修正通过；行为见[连续动作契约](design/continuous-action-contract.md)，提交与固定结果见[阶段归档](archive/2026-10-aliveness/stage-3/README.md) |
| 第 4 期生活／工作双线 | 本地实现已具备独立意图、真实交接／续接、正式工作事实适配、稳定多会话关注和第一轮表情／守候增强；规则见[双线契约](design/life-work-contract.md)，来源与工程结果见[第四阶段归档](archive/2026-10-aliveness/stage-4/README.md) |
| 第 5A 期人格影响行为 | `178437b` 已交付反馈修正；现行规则见[人格行为契约](design/personality-behavior-contract.md)，源码身份、固定报告和原始证据从[阶段入口](archive/2026-10-aliveness/stage-5a/README.md)查阅；修正后的观感仍待用户验收 |

第 4 期事实适配通过四个支持版本的正式 Harness profile loader／受控模型验证；页面仍使用明确标注的模拟事实，未接入默认产品 PetModel／NotificationBroker 的二维故事。默认产品继续按现有自主陪伴、通知和会话契约运行。受控宿主、页面模拟、真实模型服务、系统实机和主观观感分别结算。

## 操作与修改入口

| 修改内容 | 入口 |
|---|---|
| 工作事实、关注、交接、到岗、续接 | [双线协调契约](design/life-work-contract.md) |
| 几何、导航、拖动、遮挡 | [生活空间契约](design/living-space-contract.md) |
| 姿态、接触、持物与拥有权 | [连续动作契约](design/continuous-action-contract.md) |
| 第 5A 期参数、选择理由、切换与许可 | [人格行为契约](design/personality-behavior-contract.md) |
| 人格、记忆与回应的分期 | [后续蓝图 §7](design/aliveness-implementation-plan.md#7-上游借鉴人格记忆与互动节奏)；5B／5C 为候选，不自动实施 |
| 默认产品的完成／请求／会话／陪伴 | [提醒](notification-contract.md)、[会话](session-chat-contract.md)、[自主陪伴](companionship-contract.md)契约 |
| 启动、控件与定向回归 | [空间预览](design/art-workflow/space-v1/README.md)、[开发指南](development.md) |

继续复用已有 `127.0.0.1:4189` 服务；服务不在监听时按空间预览说明恢复。第 5A 期显式 `?stage=5a`，第四阶段 `?stage=4`，第三阶段 `?stage=3`，无参数为第二阶段。用户未导出的布局只在原页，测试另开隔离页面，原生操作串行并用临时 profile。

阶段快照、旧提案、固定日志与数字只在[阶段历史](archive/2026-10-aliveness/README.md)和[报告索引](reports/README.md)查阅；其中的“下一步”“未提交”“待验收”和旧限制均按形成时解释。当前 Git、远端与 CI 状态直接核对，不从快照推断。
