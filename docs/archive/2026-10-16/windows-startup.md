# Windows 键盘辅助进程启动对照

> 历史快照：形成于 2026-10-16，归档于 2026-10-19。下文的候选、发布进度、未完成项和操作只描述当时记录；当前工作以用户请求和现行契约为准。

2026-10-16。发布候选源于 `4b6a54ae575d2c61a1d06d03e674fedf29846aaf`，原始规范包 SHA-256 `595901ec45660a3a707aac35eb07a8dd0ad9ffb479682f9c955f3dba648edc88`。本文记录诊断，不把调试分支称为新的产品包。

正式发布 CI 的两次 Windows 原生键盘检查约在 15 秒时报告 `failed`；PR／主分支同一辅助进程此前已通过，主分支原始报告含真实 `idle`。失败原日志保留于本机，摘要与来源见版本交付记录。

隔离工作流逐步对比 PowerShell／Bash 父 shell、完全不改子命令及标准流、仅改 stderr、加入启动阶段标记、直接 Node／npm 生命周期，以及完整前序单元／浏览器回归后的启动。最后一组原命令与原标准流的启动约 2 秒首次输出，并持续得到 `idle`；其他最小对照亦通过。所有活动仅为 active／idle／unknown 枚举，不读取按键内容。原始 14 份报告见[原证据目录](../../evidence/p1/windows-startup-20261016/)，来源与逐组结果见 [validation.json](../../evidence/p1/windows-startup-20261016/validation.json)。Windows Git checkout 的 CRLF 转换另行核对，原始报告字节不改写。

**原失败的具体系统原因尚未定位。** 探针通过不能写成修复；15 秒产品启动期限、原生断言和正式包均保持原样。无界等待版本和仅 shell 版本仅用于比较，不计产品可用性。最终主分支／发布门禁与分发结果由[v0.4.10 固定交付核验](../../evidence/releases/v0.4.10/published-20261016/delivery-verification.json)和对应版本交付记录独立结算。

[probe.mjs](../../evidence/p1/windows-startup-20261016/probe.mjs) 与 [workflow.yml](../../evidence/p1/windows-startup-20261016/workflow.yml) 是固定诊断提交的源文件，不是产品运行脚本或后续执行计划。本地 worktree 已归档为可恢复快照；远端诊断分支保留用于追溯，不作为当前计划。

正式发布 CI 第三次的 Windows 测试已原样通过。其[原始键盘报告](../../evidence/p1/windows-startup-20261016/formal-third-keyboard-native.json)只有 `starting/unavailable` 和 `unknown`，`usable: false`；这是远程／服务会话允许的保守结果，不能据此宣称 Windows 物理输入可用。上文各独立对照的 `idle` 仍分别结算；Windows 本地控制台 VM 的既有虚拟键鼠证据另见 [VM 记录](../../evidence/p1/keyboard-vm-20261016)。本次发布随后在准备官方宿主时受到上游未发布依赖阻塞，尚未发布。
