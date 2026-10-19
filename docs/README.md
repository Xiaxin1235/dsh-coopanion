# 文档索引

本目录维护现行产品契约与分支开发入口。安装入口见 [项目首页](../README.md)，各版本改动见 [版本记录](release-notes.md)。实际版本、依赖、命令和支持的宿主列表以 `package.json`、`npm-shrinkwrap.json` 与 `.github/workflows/` 为准。

## 按任务阅读

| 任务 | 资料 |
|---|---|
| 安装、配置、操作与升级 | [使用指南](usage.md) |
| 生活感分支接手、当前阶段与验收边界 | [当前开发状态](aliveness-development.md) |
| 开发、构建、测试与录制回归 | [开发指南](development.md) |
| 完成判断、通知身份与请求结算 | [提醒契约](notification-contract.md) |
| 会话续接、接受回执、草稿与去重 | [会话契约](session-chat-contract.md) |
| 进程退出、有限恢复与临时状态 | [恢复契约](desktop-recovery-contract.md) |
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
| 生活感规划与制作 | [设计与制作索引](design/README.md)：第 2 期已验收，现行空间契约、工作台与后续候选；当前阶段与授权只看开发状态 |
| 固定版本的资源与生命周期结果 | [观察报告](reports/README.md)：周末采集已结束、托管已禁用；0.4.10 数据不作为新版验收 |
| 早期发散、候选诊断与发布过程 | [历史说明](archive/README.md)：其中的计划、问题和进度只属于当时快照 |

已完成第 2 期的旧范围、首轮模型与固定验证已收入[阶段归档](archive/2026-10-aliveness/stage-2/README.md)，原记录中的待审阅或旧推送限制只适用于当时快照。

普通搜索覆盖现行契约、当前分支状态与当前设计文本；归档、旧场景夹具、原始报告／画面／提示词及本地产物由 `.ignore` 屏蔽。历史追溯使用 `rg --no-ignore docs/archive`，核对原始工作台证据使用 `rg --no-ignore docs/design/art-workflow`，观察结果使用 `rg --no-ignore docs/reports`。设计、归档及报告目录不随安装包分发，当前执行范围仍来自用户。

## 验证与产物身份

源码实现、自动化通过、安装成功、系统实机验收和用户体验分别报告。CI 的三平台测试及宿主安装矩阵以工作流实际结果为准；物理多屏／混合 DPI、通知中心送达、真实模型会话及长期资源表现需要对应设备和场景的记录。

正式发布使用 [GitHub Release](https://github.com/takboo/dsh-coopanion/releases) 中的版本、提交和包摘要核验；`verification.json`、`SHA256SUMS` 与版本包一起提供。本地试装包不代表该版本的正式分发产物。

仓库的 `docs/evidence/` 只保留历史原始证据，普通搜索及安装包均排除它。追溯时先读其说明并核对实际产物身份。`.cache/`、`artifacts/` 与 `dist/` 属于本机或生成内容，可能来自其他提交。
