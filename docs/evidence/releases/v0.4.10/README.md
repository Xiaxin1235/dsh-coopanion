# v0.4.10 交付与周末采集

2026-10-16（Asia/Shanghai）。[PR #12](https://github.com/takboo/dsh-coopanion/pull/12) 已合并；源码及标签 `v0.4.10` 固定于 `4b6a54ae575d2c61a1d06d03e674fedf29846aaf`。本页是发布后的文档补录，不改变已发布包的身份。

| 项目 | 结果 |
|---|---|
| 规范包 SHA-256 | `595901ec45660a3a707aac35eb07a8dd0ad9ffb479682f9c955f3dba648edc88` |
| npm | `@takboo/dsh-coopanion@0.4.10`，latest 已更新 |
| 主分支检查 | [38895406936](https://github.com/takboo/dsh-coopanion/actions/runs/38895406936)，10 项通过，attempt 3 |
| 发布检查 | [38902873948](https://github.com/takboo/dsh-coopanion/actions/runs/38902873948)，13 项通过，attempt 4 |
| 正式分发 | [Release](https://github.com/takboo/dsh-coopanion/releases/tag/v0.4.10)，2026-10-16 14:04:46 UTC 发布 |
| 同包核验 | 本机规范包、npm、Release 版本包、固定别名与 latest 别名逐字节一致；Release 正文与当前版本说明相等 |
| 安装身份 | 三平台 × DSH 0.2.0-rc.2／0.2.1-alpha.1，60 份报告绑定相同源码与包摘要，无兼容性豁免 |

完整结果见[交付报告](published-20261016/delivery-verification.json)、[原始规范包报告](published-20261016/verification.json)与[摘要](published-20261016/SHA256SUMS)；[60 份原始安装报告压缩包](published-20261016/installation-reports.zip)保留各报告字节。相同交付报告和压缩包也附于正式 Release，便于 CI 工件过期后核对。工件按成功 job 的开始／完成时间绑定具体 artifact ID，排除失败尝试的同名工件，六份原 ZIP 的 digest 均核验相等。

npm 来源声明可以取得，内容中的包摘要、源码提交和发布工作流已核对；未在本机验证其密码学签名。市场 PR #7073 仍 open，在线目录与更新 feed 尚无条目，不能将 npm／Release 发布说成市场已收录。

## 本机安装与采集

日用 Desktop 0.2.0-rc.2 已经官方 profile CLI 安装该规范包，全部 1232 份已安装文件与包逐字节相等；其他插件配置及既有偏好保留。普通沙箱启动，无测试调试参数或 DevTools 监听；互动陪伴、漫游、诊断保持开启。发布规范包与已经运行的本机包相同，因此未为发布重装或中断采集。

新周末任务于 10 月 16 日 20:12（Asia/Shanghai）开始，30 秒间隔、原始样本上限 128 MiB，固定截止 10 月 19 日 09:00。允许正常锁屏／休眠／唤醒，不设置防休眠或定时唤醒；如果跨过截止后才唤醒，在恢复执行后结束。休眠、注销、宿主退出产生的缺口保留，不能当作连续可活动时间。原始日用样本、配置备份和实例凭据只留本机，不进入仓库或 Release。

采集启动和持续写入已核验，完整周末结果尚未产生；原七天任务保持取消。没有要求补天数、填写评分表或重新配合物理键盘。Windows／Linux 物理输入、物理多屏／混合 DPI、自然生命周期、长期资源与主观体验仍分别验收；Windows 外部 OS 资源采样器尚未支持，诊断接口及原生回归另行结算。

## 失败与重跑边界

Windows 辅助进程在前两次发布测试中约 15 秒报告 failed；14 份隔离对照及完整前序浏览器负载后的原命令对照通过，第三次正式 Windows 测试原样通过，未改变产品、15 秒期限或断言。第三次 CI 的键盘状态只有 unknown/unavailable，不能算作物理输入可用；主分支原始报告及独立对照曾得到 idle。具体系统原因尚未定位，不能把重跑说成代码修复。诊断来源保留在 [38906810105](https://github.com/takboo/dsh-coopanion/actions/runs/38906810105) 与 `codex/windows-keyboard-startup-debug` 分支，本地 worktree 已归档。

发布 attempt 3 的六组安装在准备官方宿主时均因 `schemastery@~3.18.5` 暂不可取得而失败，尚未加载插件。上游新 loader／cordis 发布后，其依赖稳定版于 13:51 UTC 已可取得；仅重跑六组失败安装及下游步骤后，attempt 4 全部通过，规范包和依赖声明未改动。更早的 macOS 浏览器／原生卡住及 3-DIP 工作区差异，也分别保留原日志，原样重跑通过；不据此声称其系统原因已修复。
