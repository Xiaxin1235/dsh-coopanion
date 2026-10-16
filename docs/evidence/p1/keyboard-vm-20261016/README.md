# Linux／Windows 键盘活动 VM 原生验证

日期：2026-10-16（Asia/Shanghai）。用户授权自行使用 VM 验证，本轮在 JAM `svc-jam-pve` 的独立临时克隆完成，随后回收。未修改基础设施仓库、宿主网络、旧 VM 300 的配置／采样、日用 Desktop 或模板。

## 固定候选

- 源码 `555503ef54e1375b084a6bc34d9472e9726658be`，版本 `0.4.10`，仅本地，未推送／发布。
- 同一包 SHA-256：`f459a7c8715bf892d9b0649521bc26a9d29befddc09950d89319d43e0fc48d34`。
- productDigest：`0fce0e1dda0c36f58307d037fd0b8d7fed6582cfc50d6731b320fcf249cd336a`。两份正式 VM 报告均为该提交、dirty=false。
- 包、481 份产品输入和源码的既有逐字节绑定见[前次记录](../keyboard-platforms-20261016/README.md)。本轮使用其原始包，不重打包、不改产品源码。

## 环境与范围

| 系统 | 临时来宾 | 执行方式 |
|---|---|---|
| Ubuntu 24.04.5 LTS x64，内核 6.8.0-142 | 303，coop-linux-test；9400 链接克隆；2 vCPU／4 GiB、标准虚拟显示器 | 实际 Xorg :0／Openbox、原生 Electron；QMP 注入虚拟键鼠，经内核和 XI2 到辅助进程 |
| Windows 11 Pro x64，10.0.26300 | 304，coop-win-test；9300 链接克隆及独立 vTPM；4 vCPU／8 GiB | 本地控制台 devops 会话（Explorer session 1），Interactive／Limited token 任务运行原生 Electron；QMP 注入虚拟键鼠到 Raw Input |

工具链均为 Node 24.21.0／npm 11.19.1，Electron 按包的锁定依赖安装。Node 下载以官方 SHASUMS 校验；Windows 校验见 [node-win-checksum.json](node-win-checksum.json)。所有角色感知、时钟、几何和实际身体移动均按产品运行，没有受控枚举或时钟覆盖。原生探针沿用仓库测试方式的 `--no-sandbox` 和专用 profile；系统 sandbox 与正式 Host 加载不属于这次验收。

Windows 不用 SSH 的非交互会话或 RDP 作为正向输入验收：通过新 VM 的一次性控制台自动登录建立会话，任务以普通交互 token 运行。一次性密码在 VM 内生成，未输出或导出；登录后清除 AutoAdminLogon 和 DefaultPassword，见[清理回执](windows-autologin-cleanup.json)、[控制台状态](windows-console-state-1.json)与[最终状态](windows-final-state.txt)。所有配置只用于本轮临时来宾。

## 结果

| 检查 | Linux | Windows |
|---|---|---|
| 类型检查 | 通过 | 通过 |
| Vitest | 230 通过 | 222 通过、8 项平台跳过 |
| Node 检查 | 12 通过 | 12 通过 |
| 原生 helper | XI2 枚举可用；开发树前测另存 | Windows PowerShell／C# 原生编译、注册、持续枚举及关闭通过，[报告](windows-keyboard-native.json) |
| 实际虚拟键盘 | typing 阶段 13 个 active 样本，NPC input 退让 | typing 阶段 12 个 active 样本，NPC input 退让 |
| 短暂停键／再次输入 | 3 秒短暂停顿不恢复走动；再次输入重置等待 | 相同场景通过 |
| 仅虚拟鼠标 | 排除预设的前 3 秒尾随键盘窗口后，64 个 idle、0 active、0 unknown | 同窗口后 63 个 idle、0 active、0 unknown |
| 稳定空闲恢复 | 自然经历 resume／prepare／outbound／observe／return，结束时仍在返回 | 自然经历 resume／prepare／outbound／observe／return／home，完成返回 |

正式原始报告：[Linux](linux-result.json)、[Windows](windows-result.json)。完整注入／观察日志：[Linux](linux-qmp-package-npc.log)、[Windows](windows-qmp-console.log)；Windows 原进程日志另存 [windows-vm-raw.log](windows-vm-raw.log)。输入只有脚本定义的固定测试事件，观察端只采集枚举、阶段、原因和计数，不采集真实按键内容或其他应用内容。

### 保留的尝试与身份边界

- [Windows 首轮原输出](setup-windows.log)有一项 figures 源码导出测试超过默认 5000ms；未改源码，[定向原样重跑及完整重跑](windows-validation-retry.log)通过。首轮失败不删除，不推定其原因。
- Node 检查中的客户端构建会重写 dist/build-info；导出包没有 Git 元数据，生成 commit=null／dirty=null。[Linux 前测](linux-rebuilt-preflight.json)仅作功能预飞，不作固定分发包验收。
- 随后从同一 tgz 还原 dist 和 web/markdown-runtime.js，再由正式探针显式断言完整提交和 dirty=false。Linux [正式报告](linux-result.json)及 Windows 报告使用还原后的原包构建产物；源产品输入未修改。
- [harness/](harness/)保存当时实际使用的探针、注入和环境脚本，仅用于追溯。脚本内的 VMID、别名、路径、一次性登录和资源配额属于本轮实验，不能作为其他机器或下一轮的默认操作指令。

## 回收与限制

[回收报告](cleanup-vms.json)确认 303／304 配置及 local-lvm 卷均已删除，Windows 专用 snippets 已删除，共享 Ubuntu owner 公钥文件保留。300／302 仍运行，9300／9400 仍停止；[现场列表](host-after-cleanup.txt)独立确认。DHCP 租约只读查询因未有已知主机键而拒绝，见 [原错误](dhcp-leases-after.stderr)，没有放宽 SSH 校验或修改网关；不宣称已核实租约即时释放。

本轮证明 VM 来宾的原生 API、进程、IPC、实际窗口／身体、虚拟键鼠输入及日常退让／恢复。物理设备、跨应用／安全输入的完整矩阵、真实锁屏／休眠／RDP、Wayland compositor、物理多屏／DPI、完整资源预算、长期体验和正式 DSH Host 三平台安装矩阵仍分别待验收。远端 CI 未执行。

汇总见 [summary.json](summary.json)。`SHA256SUMS` 覆盖原始报告、日志和脚本；README 是可追加的索引，不纳入原始清单。
