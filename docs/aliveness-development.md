# 生活感功能：当前开发状态

生活感分支的唯一接手入口。继续使用 `codex/aliveness-foundation`；版本、依赖与命令从 `package.json`、锁文件和工作流核对，发布身份从[文档索引](README.md#验证与产物身份)进入。

## 当前授权：第 5A 期人格影响行为，本地开发与提交

2026-10-20 用户要求整理全部文档、清除接手歧义、提交，然后在新 session 开始下一阶段。按[七阶段路线](design/aliveness-implementation-plan.md#5-敏捷顺序与可见交付)进入 **5A 人格影响行为**，先完成一个可运行、可对照的小交付。整理结果已提交为 `235be43`；首版 `e4858dd` 的工程结果见[固定报告](reports/stage-5a-20261020.md)；用户随后否定其坐站、人格差异与随机移动表现。本轮按五项反馈修正，结果见[反馈报告](reports/stage-5a-feedback-20261020.md)。允许本地开发、验证与提交；推送、合并、标签、日用 profile 安装及发布分别授权。

第 5A 期从[蓝图 §7.2](design/aliveness-implementation-plan.md#72-人格影响选择情绪保留当下)与[§7.5 验收](design/aliveness-implementation-plan.md#75-小交付与验收)进入：

- 同一地图、事实输入和随机种子下，显式选择“安静／活泼”，让停留、探索或表达选择出现可辨认差异，并能查看选择理由。
- 使用已有身体／素材、二维导航和唯一生活／工作协调器；切换或回退从实际姿态与有效目标重评。先写明本期契约和参数边界，再把策略接入可操作预览，完成浏览器与隔离原生验证。
- 工作／审批／错误语义、手部接触、路径安全、固定用户尺寸、off／quiet／interactive、输入与阅读占用、邀请预算、减少动态继续按原契约。规则日常无模型调用，不读取其他应用、屏幕或键盘内容。
- 5B 有限记忆、5C 回应合批、第 6 期出门和第 7 期跨屏留作后续；本次不扩存档经历或引入模型人格。默认产品的二维生活／工作装配仍是独立接入事项。

本次进入下一阶段的授权不等于第四阶段观感已验收。第四阶段整理流程已获用户确认；增强后的情绪／守候自然度尚无明确验收记录，继续保留可回看入口；若出现回归先修复。

## 已有交付与验证边界

| 阶段 | 当前状态与权威入口 |
|---|---|
| 第 1–2 期空间与二维运动 | 指定 180px 主配色角色／40px O03、同地图二维运动与花箱绕路已验收；现行模型见[生活空间契约](design/living-space-contract.md) |
| 第 3 期连续动作与物件 | 用户已确认连续拿放及花箱／到岗拾取修正通过；行为见[连续动作契约](design/continuous-action-contract.md)，提交与固定结果见[阶段归档](archive/2026-10-aliveness/stage-3/README.md) |
| 第 4 期生活／工作双线 | 本地实现已具备独立意图、真实交接／续接、正式工作事实适配、稳定多会话关注和第一轮表情／守候增强；规则见[双线契约](design/life-work-contract.md)，来源与工程结果见[第四阶段归档](archive/2026-10-aliveness/stage-4/README.md) |
| 第 5A 期人格影响行为 | 首版观感未通过；已修正为对象关注、侧向接近、实际注视、词表表现、少坐与自然起身，并有同时间参数对照。规则见[人格行为契约](design/personality-behavior-contract.md)，结果见[反馈报告](reports/stage-5a-feedback-20261020.md)，修正后的观感仍待用户验收 |

第 4 期事实适配通过四个支持版本的正式 Harness profile loader／受控模型验证；页面仍使用明确标注的模拟事实，未接入默认产品 PetModel／NotificationBroker 的二维故事。默认产品继续按现有自主陪伴、通知和会话契约运行。受控宿主、页面模拟、真实模型服务、系统实机和主观观感分别结算。

## 操作与修改入口

| 修改内容 | 入口 |
|---|---|
| 工作事实、关注、交接、到岗、续接 | [双线协调契约](design/life-work-contract.md) |
| 几何、导航、拖动、遮挡 | [生活空间契约](design/living-space-contract.md) |
| 姿态、接触、持物与拥有权 | [连续动作契约](design/continuous-action-contract.md) |
| 第 5A 期参数、选择理由、切换与许可 | [人格行为契约](design/personality-behavior-contract.md) |
| 人格、记忆与回应的分期 | [后续蓝图 §7](design/aliveness-implementation-plan.md#7-上游借鉴人格记忆与互动节奏)；当前只实施 5A |
| 默认产品的完成／请求／会话／陪伴 | [提醒](notification-contract.md)、[会话](session-chat-contract.md)、[自主陪伴](companionship-contract.md)契约 |
| 启动、控件与定向回归 | [空间预览](design/art-workflow/space-v1/README.md)、[开发指南](development.md) |

继续复用已有 `127.0.0.1:4189` 服务；服务不在监听时按空间预览说明恢复。第 5A 期显式 `?stage=5a`，第四阶段 `?stage=4`，第三阶段 `?stage=3`，无参数为第二阶段。用户未导出的布局只在原页，测试另开隔离页面，原生操作串行并用临时 profile。

阶段快照、旧提案、固定日志与数字只在[阶段历史](archive/2026-10-aliveness/README.md)和[报告索引](reports/README.md)查阅；其中的“下一步”“未提交”“待验收”和旧限制均按形成时解释。当前 Git、远端与 CI 状态直接核对，不从快照推断。
