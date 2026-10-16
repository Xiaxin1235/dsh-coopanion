# P1 有限空间 NPC 日常：本地实现与候选验证

日期：2026-10-16（Asia/Shanghai）。这是新行为的独立记录；未推送、未发布，未更新日用 Desktop 安装，不启动 P2 或新美术线。用户主观体验尚未验收。

## 固定身份

- 实现提交：`ac5938fd0b7bbdf1b716a023a48cab3c6004e77a`，起点 `76f9616f2fd1e233870d46bf827a85db3344f1fc`。
- 本地包：`.cache/p1-npc-20261016/candidate-ac5938f/takboo-dsh-coopanion-0.4.10.tgz`，版本仍为未发布的 0.4.10。
- SHA-256：`7bae84f1b152dbf42f21b5b1916e6b9376357d9c02b8e230892119d9bfd7e673`。
- 产品摘要：`7f37561778c271da996b94ae8ab3d129c29041548b4c766f86eef922c6feeff9`。包内 build-info 为上述源码、`dirty=false`；479 份产品输入逐字节匹配该提交，重新计算的产品摘要一致，见 [source-binding.json](source-binding.json)、[verification.json](verification.json)。
- 环境：macOS 15.8.1 / arm64，Node 24.21.0、npm 11.19.1、Electron 44.7.0；真实 Host 安装为 DSH 0.2.0-rc.2 和 0.2.1-alpha.1，消费同一压缩包。

缓存路径仅定位这台机器上的候选；摘要与提交是身份依据。后续证据／索引提交不改变此包，不再重新打包。

## 已实现与已通过

行为以[陪伴契约](../../../companionship-contract.md)为准：相对 workArea 的小窝／活动段，准备、受控慢走、真实 arrived 后观察、返回短坐，忙碌退让并保留意图；输入未知／活跃时停止探索与邀请，必要时收拢，稳定空闲后再评估。只取消自己的非零代际 walkId，保留既有工作、通知、阅读、输入及手动操作优先级。

| 检查 | 本轮结果与证据 |
|---|---|
| 元数据、类型、单测 | 类型通过；Vitest 222 通过、1 项既有平台跳过，另 12 项 Node 检查通过；[类型](typecheck.log)、[单测](unit.log) |
| 完整收件箱 | `test:inbox-ui` 通过；含 12 项陪伴／NPC 用例、既有全文、草稿、焦点／选择、在途身份、未读、字号、多屏与旧节奏；[原始日志](inbox-ui.log) |
| 一般界面／通知 | `test:ui` 与 `test:notification-ui` 通过；[固定源码界面复核](general-ui-source.log)、[固定源码通知复核](notification-ui-source.log) |
| 串行原生 | `test:desktop` 通过，包括 M3 恢复、M5、M6、显式互动、新 NPC 和诊断；[原始日志](desktop.log) |
| 同包原生 NPC | 直接从固定包解出的 main/web 运行，真实身体行走、停止、到达、观察、返回及 IPC 通过；[报告](npc-life-native.json)、[日志](package-native.log) |
| 两版 Host 同包安装 | 正式 plugin 命令／profile loader、设置写入、原生重开、Host 重启、M2 续接、M3 恢复等通过；[rc.2](install-rc.log)、[alpha.1](install-alpha.log)、两份 `install-*.json` |
| 小窝设置 | 两版真实设置页保存 npcHome=0.20、npcRange=0.25，保留草稿／选区／frame；原生重开后值仍为 20%／25%；写入及断言入口见固定提交 `tests/install.mjs` |
| 缺失能力 | 真实纸星星 fixture 使用其较少词表并显式限制 can.walk=false，验证不强发 look／sit／dance，不调用移动；未将示例原包描述为不能行走 |
| 源与历史保护 | 旧证据、归档、固定上游在起点与实现提交的 Git tree 完全相同；旧包 56d55538… 仍在原缓存且摘要未变，见 [保护记录](preserved-originals.json) |

工程行为用例控制时间／粗粒度输入，不控制角色的真实物理步进和行走回执。它们证明调度与降级，不证明跨应用物理打字。启动还增加了原生几何回执与视口一致后才建立小窝的回归；退出模式时释放自有持续坐姿，不重建角色 frame。

开发期失败原日志保留在 `attempts/`。有限轨迹确认原生系统指针与 CDP 指针分离时，鼠标进入路径会正确停止；NPC 原生循环用例因此先同步停放两个指针。rc.2 首次安装在后段 M2 原生命中等待超时，未修改源码或包，重新创建隔离 profile 复跑通过；未删除该次失败记录。

## 短时资源观察

同一包、180px 鲸鱼；每组预热 20 秒，再采样两段各约 10 秒，真实时间、不加速帧。受控组仅将键盘枚举固定为 idle；实际原生键盘辅助进程仍计入进程树。所有运行均已退出，不留下后台采样器。

| 场景 | 平均 CPU（100%=单核） | 平均进程树 RSS | 实际观察 |
|---|---:|---:|---|
| 旧模式 baseline | 45.29% | 565.24 MiB | NPC disabled |
| 新模式、本机实际输入 | 22.64% | 470.18 MiB | keyboard unknown，yield |
| 新模式、受控 idle | 33.70% | 474.34 MiB | prepare／outbound／observe／return |

原始数据：[baseline.json](baseline.json)、[actual-input.json](actual-input.json)、[controlled-idle.json](controlled-idle.json)、[日志](resources.log)。这些是短时对照，**未按原 3×60 秒预算验收，也未做新包两小时观察**。RSS 可重复计算共享页，软件渲染与其他桌面负载影响 CPU；不据此宣称耗电、长期稳定或性能预算通过。

## 尚未完成的边界

- 本机实际 CoreGraphics 权限／活动为 **unknown**，已验证保守安静；真实跨应用键盘、授权归属、连续输入与短暂停顿仍需物理验证。Linux／Windows／普通浏览器目前也为 unknown，不声称已实现准确打字检测。
- 原生循环用例使用受控输入；真实鼠标避让、物理多屏／混合 DPI、锁屏／休眠与其他平台分别验收。
- 新包两小时资源、完整冻结预算及用户短时自然体验仍待完成；不恢复七天试用、填表、旧采样器或旧 VM 任务，也不把旧 VM 结果算作 NPC 验证。
- 未运行新候选远端三平台 CI／六组安装，未推送／发布。旧日用安装仍代表用户已反馈无感的旧行为。

`validation.json` 汇总结算范围；`SHA256SUMS` 固定本目录记录字节。

可从仓库运行 `python3 docs/evidence/p1/npc-life-20261016/verify-source.py <候选包路径>`，重新检查包摘要、构建身份与 479 份产品输入。最终核对有 905 份既有证据／归档／上游文件与起点逐字节相同，仅两份证据索引另加新记录入口。
