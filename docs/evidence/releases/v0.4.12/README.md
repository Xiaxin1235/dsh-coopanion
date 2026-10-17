# v0.4.12：DSH 0.2.1-rc.1／rc.2 兼容与交付

2026-10-17（Asia/Shanghai）。发布源码及标签 `v0.4.12` 固定于 `015ef3a792e9db17897d5ceed611106d78aedabd`。[PR #13](https://github.com/takboo/dsh-coopanion/pull/13)、[PR #14](https://github.com/takboo/dsh-coopanion/pull/14)、[PR #15](https://github.com/takboo/dsh-coopanion/pull/15)、[PR #16](https://github.com/takboo/dsh-coopanion/pull/16) 和 [PR #17](https://github.com/takboo/dsh-coopanion/pull/17) 已合并。验证工作流另由 [PR #18](https://github.com/takboo/dsh-coopanion/pull/18) 增加进程日志与时限。产品源码与验证工作流提交分别记录。本页在发布后补录；后续文档提交不改变该包身份。

## 兼容性结论

旧 v0.4.10 的宿主 peers 只列出 0.2.0-rc.2 和 0.2.1-alpha.1，实际 rc.1／rc.2 宿主均拒绝加载，不能仅凭 API 形状推断可用。v0.4.12 在 `engines.dsh` 和全部宿主 peers 中显式列出四个精确版本；实际官方 loader 均接受，不使用风险豁免，未验证的 0.2.1-rc.3 仍被拒绝。完整判断及宿主实现摘要保留于 [compatibility-final.json](compatibility-final.json)。用户最初所称 rc1 的官方版本号为 `0.2.1-rc.1`。

新宿主将设置入口移至账号菜单，安装验证及使用指南已适配；继续覆盖中英文切换和偏好持久化。Windows 关闭诊断时发现描述文件可能在读取前撤销或进入待删除状态，现对 `EPERM` 有限重读，文件已消失时按接口不可用处理；持续权限错误和无效数据仍抛错。新增故障注入验证重试上限、非 Windows 权限错误、无效 JSON 和失效进程边界。

另外修复两处测试自身的竞争：M3 恢复夹具等待真实 `agent.whenIdle()` 后再建立测试审批，受控挂起前一回复验证接受回执与任务完成不同；原生生命周期测试通过正常 IPC 退出并断言退出码，给 Windows 文件释放有限清理重试。没有因此修改产品回合完成语义或降低断言。

## 分发身份与验证

| 项目 | 结果 |
|---|---|
| 规范包 SHA-256 | `5abd4079a114e1314e869dd65f15614b5eb57857727e5ab3ec654cf83290dab3` |
| npm | `@takboo/dsh-coopanion@0.4.12`，latest 已核验为 0.4.12 |
| 主分支检查 | [39031172723](https://github.com/takboo/dsh-coopanion/actions/runs/39031172723)，16 项通过，attempt 1 |
| 发布检查 | [39037489562](https://github.com/takboo/dsh-coopanion/actions/runs/39037489562)，19 项通过，attempt 2 |
| 工作流提交回归 | [39037483272](https://github.com/takboo/dsh-coopanion/actions/runs/39037483272)，16 项通过，attempt 3；独立于发布源码的 main 检查 |
| 验证工作流提交 | `ea732bda167d04e0d3a80cec67c7196928fcc24f`（main 工作流；产品源码仍为标签提交） |
| 正式分发 | [Release](https://github.com/takboo/dsh-coopanion/releases/tag/v0.4.12)，2026-10-17T14:08:57Z 发布 |
| 同包核验 | 主分支规范包、发布规范包、npm、Release 版本包、固定别名及 latest 别名逐字节一致；Release 正文与当前版本说明相等 |
| 安装身份 | Linux／macOS／Windows × DSH 0.2.0-rc.2／0.2.1-alpha.1／0.2.1-rc.1／0.2.1-rc.2，12 组安装、144 份原始报告 |

原始 [verification.json](verification.json)、[SHA256SUMS](SHA256SUMS)、[公网核验](publication.json)、[npm metadata](npm-metadata.json)、[npm dist-tags](npm-dist-tags.json)、[GitHub Release metadata](github-release.json) 及两次 CI 的完整结果保留于本目录。十二份安装工件 ZIP 的摘要均与 GitHub API 返回值一致；[工件来源](artifact-origin.json)以成功 job 的起止时间绑定工件 ID，原始报告不取自失败尝试。

[报告清单](report-index.json)记录十二组安装的原始报告、来源路径、字节数和 SHA-256。报告按原字节保存，安装报告绑定上述源码、宿主、插件版本及同一压缩包摘要，均无风险豁免且正常退出。

## 失败尝试与修正

本轮保留失败来源并分别结算：

- [39022428577](https://github.com/takboo/dsh-coopanion/actions/runs/39022428577)：慢速 Windows 上前一回复仍在运行，旧夹具注入下一审批回合，出现会话持久日志损坏。通过真实 rc.2 controller／agent／persistence 的受控复现确认，修复夹具排序后同场景通过。
- [39024106518](https://github.com/takboo/dsh-coopanion/actions/runs/39024106518)：Windows 原生键盘辅助进程首次启动超时，原样重跑后通过，不能称为已修复其系统原因；后续诊断读取 `EPERM` 则有独立修复和故障注入验证。
- [39025859560](https://github.com/takboo/dsh-coopanion/actions/runs/39025859560)：Windows 原生生命周期功能断言已通过，强制退出后 SQLite journal 清理出现 `EBUSY`，改用正常 IPC 退出并在本机四组生命周期情景复验后通过。
- v0.4.11 主分支 [39026767478](https://github.com/takboo/dsh-coopanion/actions/runs/39026767478) attempt 1 的 Windows alpha.1 导航与 rc.1 中文校验提示分别超时；attempt 2 原样重跑这两组后成功，源码和规范包未改变，未宣称其系统原因已修复。

v0.4.11 标签保留在 `5111ab950fad82f66adf75b0b1c927bce79e3ae1`，其规范包 SHA-256 为 `78e1917ee9af7236d8c73368542364af15b9b9021bb771e4bcc282c1273638e4`，未上传 npm／GitHub Release，另有[公网查询记录](v0411-publication-status.json)。首次发布 macOS 原生步骤在输出互动陪伴成功后停滞，运行约 6 分 48 秒后主动取消以取得日志；第二次在浏览器戳触互动用例报出 idle/play 断言。独立复测原测试 20 次，失败 9 次；记录证明失败时角色正处于上游随机跳跃的 air 状态，产品按契约拒绝。PR #17 固定两条真实物理分支；空中仍拒绝、落地允许、短暂表情允许、工作中断不计成长。修正后 20 轮／40 项检查全部通过，本机完整收件箱回归也通过；[复现摘要](poke-reproduction.json)与[原字节日志及测试快照](poke-reproduction.zip)保留本机诊断边界，不冒充最终规范包安装。原包／标签未改写，v0.4.12 独立形成规范包和发布结果。首次原生停滞未因此宣称修复，最终发布重跑情况以 release-ci.json 为准。

v0.4.12 的初次发布运行 [39032547372](https://github.com/takboo/dsh-coopanion/actions/runs/39032547372) 中，Linux／Windows 完整检查通过，macOS 两次在互动陪伴成功后、NPC 用例完成前停滞，分别主动取消并保留 [attempt 1](release-ci-attempt1.json)／[attempt 2](release-ci-attempt2.json)。本机两组单独 NPC、远端十次陪伴交接、四次恢复交接和两组完整前置负载的诊断均通过；实际 runner 已关闭显示休眠，未证明保持唤醒或端口切换是修复。诊断详情和原字节阶段片段见 [native-diagnosis/index.json](native-diagnosis/index.json)；一次早期完整诊断在多屏拖拽超时，未进入 NPC 用例，不计目标结果。

[PR #18](https://github.com/takboo/dsh-coopanion/pull/18) 仅给正式原生步骤增加 `pw:browser` 进程日志与六分钟时限，保留原命令及断言。新的发布运行 [39037489562](https://github.com/takboo/dsh-coopanion/actions/runs/39037489562) 使用 main 工作流提交 `ea732bda167d04e0d3a80cec67c7196928fcc24f`，实际检出的产品源码仍是标签 `015ef3a792e9db17897d5ceed611106d78aedabd`；最终 attempt 2 的全部 19 项检查通过。发布包继续与原源码的 main 规范包逐字节一致。工作流日志改进与系统原因定位分别结算，不能据此宣称已修复原生停滞的系统原因。

新运行 attempt 1 的 macOS／DSH 0.2.1-rc.2 安装检查在读取原生窗口几何时得到高度 677 DIP、同次实际工作区高度 674 DIP，未通过精确相等断言。[失败摘要](release-macos-rc2-failure-summary.json)绑定下载工件 ID／ZIP 摘要、产品源码和包摘要；[原始 attempt 1 结果](release-39037489562-attempt1.json)保留该失败。最终重跑沿用同一包与原断言；未把重跑成功写成该几何差异的原因已修复。

工作流提交的 main 回归另在 Linux 原生菜单点击等待超时，首次结果见 [workflow-main-attempt1.json](workflow-main-attempt1.json)。第二次运行的 Windows／rc.2 安装在等待「第二会话」导航可见时超时，结果见 [workflow-main-attempt2.json](workflow-main-attempt2.json)。最终 attempt 3 原样重跑 Windows／rc.2 后，16 项检查全部通过，见 [workflow-main-ci.json](workflow-main-ci.json)；同样不把重跑通过等同于这两次超时的系统原因已经定位。它的源码是工作流提交，生成的候选不是本版分发身份；本版始终由标签源码和上述规范包摘要标识。

## 验收边界与既有日用环境

三平台 CI 包含类型、单元、浏览器、收件箱、原生窗口、键盘适配，以及四版官方宿主的真实安装、设置、任务、冷会话续接、通知、重启恢复、字号、多屏布局、陪伴与诊断检查。模型回复和部分服务事件由受控夹具提供；这些检查不替代外部真实模型、物理多屏／混合 DPI、系统通知中心投递、物理输入和长期自然体验验收。

本轮未升级或重装既有日用 Desktop，未调整 v0.4.10 的周末采集配置、截止时间或采样进程。10 月 16 日的采集启动记录仍只证明其原时点；本轮没有重新核对存活状态或结算周末结果。自主陪伴仍为默认关闭的 P1 试用功能，原七天试用／填表要求保持取消。

社区目录 [PR #7073](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/7073) 已于 2026-10-17 07:27:33 UTC 合并；在线 `plugins.json` 已包含插件及固定 Release 下载地址。本次核验时 npm 映射和详细更新记录的状态见 [market-status.json](market-status.json)，不能把本次 npm／Release 发布等同于目录更新信息已经同步。
