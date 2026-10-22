# 上游调研、动作补丁与原生回归：2026-10-19

固定日期的调研和工程验证归档。当前接手从[开发状态](../../../aliveness-development.md)进入；后续取舍维护在[蓝图第 7 节](../../../design/aliveness-implementation-plan.md#7-上游借鉴人格记忆与互动节奏)，运行时来源维护在[UPSTREAM.md](../../../../web/upstream/UPSTREAM.md)。本归档不安排新任务。

## 最终交付

| 范围 | 最终状态 |
|---|---|
| 清醒坐姿 #105 | 已择取 `7b156c1e9eddb2e655b14229247453934204de53`；显式 `sit` 保持清醒，临睡坐姿、哈欠与慢眨眼按上游修正，产品仍禁用上游随机漫游 |
| 走路摆臂 #228 | 已适配 `76a1179e1e31b52020bcc63dda606f7d0950e15a`；摆臂后置于弹簧，与同侧腿反相；本地每只 authored 手臂与原持物臂保持控制权，覆盖显式二维导航 |
| 原生预览后半段超时 | 已定位并修正栅格帧长 URL 导致的 CDP 积压；剩余原生行为和新增防积压检查完成 |
| 人格、有限记忆、互动节奏 | 仅整合进后续方案，按复用、择取／适配、自研分别说明；未引入人格或模型服务 |
| 眉毛、空中接住、冬装等 | 仍为候选；最初推荐不等于最终移植范围 |

本次补丁完成工程回归，尚无新增用户观感验收。第 2 期已获确认的二维空间与绕路结果继续按[原阶段身份](../stage-2/README.md)解释，不扩大为本次补丁、真实系统休眠或正式发布的验收。

## 固定调研

[原调研全文](snapshots/docs/research/upstream-coopanion-2026-10-19.md)保持原字节，原路径为 `docs/research/upstream-coopanion-2026-10-19.md`。其中“没有修改实现”“建议第一批择取”、开放 PR 状态、最新发布和本地对照均指调研当时；实际后续交付以上表为准。快照内部相对链接按原路径解释，当前可操作链接使用本页和开发状态。

调研比较范围为本地导入基线 `d7b1a0026fed3eb1975a6e0387527d806192cdbf` 到上游 `07dfa744696f0c63292a7af1b7dfc25a09c87cc2`；Cortico 子模块固定为 `087289dfcdf262a771c573d16dbaf2392ce6764b`。开放 #251／#248 与 v0.2.4 仅是当时核对结果，后续评估需重新查询，不作为上游现状。

## 超时原因与修正证据

每帧 PNG 的长 `data:` URL 被 SVG／Image 载入后，Chromium 网络事件重复携带整段 URL，积压 CDP 命令；失败窗口有焦点且可见，采样中有等待中的 `Page.getLayoutMetrics`。修正为内存位图解码与可回收短 Blob URL，保留原 PNG 字节和合成矩阵。位图在绘制、丢弃或部分解码失败后关闭；URL 在替换、重新挂载、快照和释放时回收。

| 同一短探针 | 修正前 | 修正后 |
|---|---:|---:|
| PNG data URL 载入 | 217 | 0 |
| URL 总字符 | 55,740,407 | 10,089 |
| 单个 URL 最大字符 | 260,854 | 82 |

探针计数包含页面启动，不表示严格的每秒流量或长期资源结论。原 7 项原生检查在运行时修正后完整通过；维护脚本新增防积压断言、总期限、失败阶段、逐项耗时及清理记录。原生桌面操作串行，使用隔离 profile。

## 完整本地验证

原始结果见[verification.json](../../../evidence/2026-10-19-upstream-motion/native-regression-followup-20261019/verification.json)，根因及假设排除见[diagnosis.json](../../../evidence/2026-10-19-upstream-motion/native-regression-followup-20261019/diagnosis.json)。

| 检查 | 固定运行结果 |
|---|---|
| 单元、类型、构建与元数据 | 34 文件、290 项 Vitest 通过（1 原有跳过），12 项 Node 单元通过；含 17 项坐姿、相位、姿势控制权与 URL 生命周期回归；类型／构建／元数据通过 |
| 产品与 NPC UI | 完整 `test:ui`、`test:inbox-ui` 通过，含 16 项真实 WebGL 以及坐姿持续两分钟的受控时钟检查 |
| 二维导航与原 O03 | 导航 9 项、空间 30 项、手部像素及 44 项动作通过；持物绑定误差为 0 |
| 原生原流程 | 原 7 项行为通过；恢复后拖动、真实 macOS 光标命中及旧 API 2 水平回退完成 |
| 原生扩展流程 | 8 项通过两次，主流程分别 24.239 秒与 25.143 秒；最终脚本确认记录 PNG data URL 为 0，隔离 profile 已移除、光标已恢复 |

最终确认见[native-confirmed/native.json](../../../evidence/2026-10-19-upstream-motion/native-regression-followup-20261019/native-confirmed/native.json)和[cleanup.json](../../../evidence/2026-10-19-upstream-motion/native-regression-followup-20261019/native-confirmed/cleanup.json)。原生脚本的 120 秒期限覆盖主流程，退出清理另行有界执行；复现命令见[空间预览](../../../design/art-workflow/space-v1/README.md#隔离原生与定向回归)，动作测试入口见[开发指南](../../../development.md)。新运行使用新的输出目录。

## 源码身份与证据保存

验证发生在基础提交 `3ca1137ec01883d4e032a45d4a42aeb35e878f70` 加当时工作区改动，原报告的 `dirty:true` 保留；它不表示最终提交仍有未提交内容。产品输入摘要为 `38b250e0326b02b72eb13e312169301ecf826ce837abb4962592f9894b51291e`，并非分发包 SHA-256。关键源码／测试摘要和宿主见[source-identity.json](../../../evidence/2026-10-19-upstream-motion/native-regression-followup-20261019/source-identity.json)。文档整理后，原报告中的文档摘要仍只指整理前快照；运行时与测试身份按该文件逐项核对，最终提交从 Git 历史查询。

环境为 Node 24.21.0、npm 11.19.1、浏览器 Chromium 156.0.8078.4；实际原生为 Electron 44.7.0／Chromium 152.0.7977.130，macOS arm64、单主屏、DPR 2、2304×1296 工作环境，原生窗口 1440×1080。浏览器与 Electron 的 Chromium 版本分别记录。

[保存清单](preserved-files.json)记录 36 个文件的原路径、归档路径、字节数和 SHA-256：原调研快照、首轮不完整验证清单，以及最终验证清单及其引用的 33 份报告／日志／采样。原文件按原字节复制，最终证据目录内的相对位置保持。它们已收入 Git，可在新机器读取；内部绝对路径仍只标识原运行环境。

首轮[不完整验证](../../../evidence/2026-10-19-upstream-motion/upstream-motion-20261019/verification.json)保留 `allChecksPassed:false` 和原生只完成 4 项的结论。清单外的首轮附件当时位于本机 `artifacts/upstream-motion-20261019/`，后续截图、录像和临时调试脚本当时位于 `artifacts/native-regression-followup-20261019/`，没有收入这次保存集合；部分本地媒体后来经空间清理授权删除，历史路径不保证仍可读取。原报告里的引用不代表 GitHub 附件；维护中的回归入口是 `tests/space-native.mjs`，临时探针不是新的开发入口。

本次验证不覆盖三平台 CI／安装矩阵、Linux／Windows 原生、物理多屏／混合 DPI、真实 OS 休眠／锁屏、底层应用点击送达、长期稳定性、真实 Harness／模型会话或正式安装／发布。第 2 期早期一次原生并行失响应仍为独立、未定位的历史观察，不能用本次 CDP 根因替它补写结论。
