# 文档索引

本目录维护现行产品契约与分支开发入口。安装入口见 [项目首页](../README.md)，各版本改动见 [版本记录](release-notes.md)。实际版本、依赖、命令和支持的宿主列表以 `package.json`、`npm-shrinkwrap.json` 与 `.github/workflows/` 为准。

## 按任务阅读

| 任务 | 资料 |
|---|---|
| 安装、配置、操作与升级 | [使用指南](usage.md) |
| 生活感分支接手、当前阶段与验收边界 | [当前开发状态](aliveness-development.md) |
| 默认产品空间／身体缺口、下一步建议与可见验收 | [空间与身体复核](design/space-body-review.md) |
| 真实桌面互动规划、平台 Adapter 与三平台／Wayland 验收 | [跨平台桌面互动方案](design/desktop-environment-plan.md)：现有路线专项，实施进度看开发状态 |
| 默认产品自主生活、阶段装配与回退 | [生活装配契约](design/living-integration-contract.md) |
| 第 5C 期回应合批与安静节奏 | [回应契约](design/response-rhythm-contract.md) |
| 第 5B 期相处记忆、查看／纠正／删除 | [有限记忆契约](design/companion-memory-contract.md) |
| 第 5A 期安静／活泼、参数与行为选择 | [人格行为契约](design/personality-behavior-contract.md) |
| 第 4 期生活／工作交接与事实适配 | [双线协调契约](design/life-work-contract.md) |
| 第 3 期连续动作与物件预览 | [连续动作契约](design/continuous-action-contract.md) |
| 开发、构建、测试与录制回归 | [开发指南](development.md) |
| 项目缓存、隔离环境与预览回收 | [缓存管理](cache-management.md) |
| macOS 虚拟桌面、SSH 与原生测试隔离 | [macOS 测试机](macos-vm-testing.md) |
| 完成判断、通知身份与请求结算 | [提醒契约](notification-contract.md) |
| 会话续接、接受回执、草稿与去重 | [会话契约](session-chat-contract.md) |
| 进程退出、有限恢复与临时状态 | [恢复契约](desktop-recovery-contract.md) |
| 消息气泡、全文与右键设置视觉体系 | [消息视觉体系](design/message-visual-system.md) |
| 字号、阅读与输入状态保持 | [文字契约](text-readability-contract.md) |
| 显示器归属、坐标与拖放切屏 | [多屏契约](multi-display-contract.md) |
| NPC 日常、小窝、邀请与关系存档 | [自主陪伴契约](companionship-contract.md) |
| 本地诊断、采样与资源报告 | [诊断契约](diagnostics-contract.md) |
| 角色制作、API 2 与动作回退 | [角色接口](characters.md) |
| 同包安装验证、npm 与 GitHub Release | [发布流程](releasing.md) |
| 首页展示素材的来源与重拍 | [素材说明](assets/README.md) |
| 源码、素材与依赖许可 | [第三方声明](../THIRD_PARTY_NOTICES.md)、[上游版本](../web/upstream/UPSTREAM.md) |

## 设计与历史查阅

| 需要查阅的内容 | 入口与适用范围 |
|---|---|
| 生活感规划与制作 | [设计与制作索引](design/README.md)：现行空间／动作／双线／人格／记忆／视觉契约及空间身体复核；阶段状态和授权只看开发入口 |
| 上游借鉴与已选补丁 | [蓝图第 7 节](design/aliveness-implementation-plan.md#7-上游借鉴人格记忆与互动节奏)维护后续取舍；[固定调研与回归归档](archive/2026-10-aliveness/upstream-motion/README.md)区分当时建议、已移植两项和原生超时修正 |
| 固定源码验证与资源／生命周期结果 | [固定报告](reports/README.md)：按固定源码区分 5A／5B 首版与反馈修正；旧报告不是当前执行指令 |
| 早期发散、候选诊断与发布过程 | [历史说明](archive/README.md)：其中的计划、问题和进度只属于当时快照 |

前期阶段与默认装配的旧范围、提案、失败模型、反馈修正与固定验证从[阶段历史](archive/2026-10-aliveness/README.md)追溯。默认产品已开始交付平面空间切片，多方向身体与整体体验仍待验收；基线问题及完整目标见[空间与身体复核](design/space-body-review.md)，后续路线与平台能力门槛见[跨平台桌面互动方案](design/desktop-environment-plan.md)。当前交付与用户验收看[开发状态](aliveness-development.md)，执行范围来自用户最新指令；原始报告中的待验收、旧下一步和推送限制均属于当时快照。

普通搜索覆盖现行契约、分支交付状态、规划范围和运行源码；归档、历史版本说明、旧场景夹具、原始报告／画面／提示词及本地产物由 `.ignore` 屏蔽。历史追溯使用 `rg --no-ignore docs/archive`，核对原始工作台证据使用 `rg --no-ignore docs/design/art-workflow`，观察结果使用 `rg --no-ignore docs/reports`，发布历史使用 `rg --no-ignore docs/release-notes.md`。设计、归档及报告目录不随安装包分发。

## 验证与产物身份

源码实现、自动化通过、安装成功、系统实机验收和用户体验分别报告。CI 的三平台测试及宿主安装矩阵以工作流实际结果为准；物理多屏／混合 DPI、通知中心送达、真实模型会话及长期资源表现需要对应设备和场景的记录。

正式发布使用 [GitHub Release](https://github.com/takboo/dsh-coopanion/releases) 中的版本、提交和包摘要核验；`verification.json`、`SHA256SUMS` 与版本包一起提供。本地试装包不代表该版本的正式分发产物。

仓库的 `docs/evidence/` 只保留历史原始证据，普通搜索及安装包均排除它。追溯时先读其说明并核对实际产物身份。`.cache/`、`artifacts/` 与 `dist/` 属于本机或生成内容，可能来自其他提交；`.local/macos-vm/` 是持久 VM 数据与专用身份，按测试机保留规则维护。本机进程、磁盘余量和来宾源码均需现场核对，固定报告及 provisioning 记录不是实时状态。

## 文档维护边界

执行范围以用户最新指令为准。开发入口维护最新基线、已知限制和按任务进入的操作指引；已结束的授权／过程／测试数量归入历史，不延续为当前任务。现行契约描述最终行为，蓝图维护目标与门槛，固定结果保留在报告；各页不互相复制验收结论。新阶段区分计划、实施和用户验收，进入下一阶段不等于上一阶段主观验收。

原始报告、截图、日志、素材来源、许可和固定快照保留字节；用索引解释被后续修正的旧结论，不改写原记录。整理时检查当前链接、默认搜索可见性和快照摘要。使用指南跟随源码分支，分支未发布增量须显式标明，版本号和本地测试不能代替发布结论。
