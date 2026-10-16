# P1 Linux PVE 虚拟机长时观察

日期：2026-10-16（Asia/Shanghai）。状态：**旧包正式 Host 安装／采样短检通过；原两小时观察因换包提前停止，未完成验收**。本记录追加到原 P1 证据之后，不改写 S1–S3 的原始报告。

## 身份与环境

- 产品来源：`d17029d59de7d8f4e17b092f0cb2d7b50ee3ebc0`。VM 从该提交构建一次，本轮不修改产品运行源码。
- 新的本地测试包 SHA-256：`8337f876c2b3af8ee05cf40e67ecc3e71c0fed0d45da515c327cbf6dbc7edc6c`。版本字段仍为 0.4.9；不是已发布 v0.4.9 的分发包，也不是旧 S3 的原包。
- `candidate-source-check.json` 核对当前源码、已安装测试包和原 S3 的 27 个运行／构建输入、10 个测试文件，37 项摘要全部相同。旧 S3 的 `baseCommit`／`committed: false` 保持原意，不能替代本轮来源提交。
- 实际宿主：发布的 DSH `0.2.0-rc.2`，真实 CLI 安装及 profile loader，无兼容豁免。Node 24.21.0、npm 11.19.1、Electron 44.7.0。
- Ubuntu 24.04.5 x86_64、4 vCPU、约 7.8 GiB 内存、48 GiB 根盘；guest 检测为 KVM，PVE 平台由用户提供。宿主物理资源预留／气球配置未经独立核验。
- Xvfb＋Openbox，1200×800、24 位色；实际 WebGL 为 ANGLE／SwiftShader。使用既有隔离测试配置，允许软件渲染并关闭 Chromium 进程沙箱；不代表普通安装沙箱或实物 GPU 验收。

环境原文见 `environment-during-run.txt`。观察程序独立于冻结包，三个脚本摘要写入各次元数据。新增观察器回归后，本机 `npm test` 为 202 项 Vitest 通过、1 项既有跳过及 12 项 Node 检查通过。VM 冻结产品原套件为 197 项通过、1 项既有跳过及 12 项 Node 检查通过，类型与元数据检查通过。

## 短检

`smoke-metadata.json`、`smoke-samples.ndjson`、`smoke-summary.json` 为远端 `smoke-05` 原始字节。真实运行 60 秒，窗口 20 秒，仅验证安装、原生窗口、采集和结束清理链路。`fullTwoHourObservation: false`，没有邀请／三类片段覆盖，不能算长时验收。请求排空，失败和页面错误为零，steal／swap 为零。

前四次启动检查没有正式资源样本，失败报告、安装日志及人工停止原因保留在远端 `smoke-01` 至 `smoke-04`。观察器已补齐 pnpm 搜索路径、异步原生启动等待、显式 Electron 准备及可执行版本检查；VM 补齐 GTK 3。没有通过延长超时替代缺失系统库的修复。

## 正式观察：two-hour-01

- 采样开始：`2026-10-16T04:36:59.325Z`，即北京时间 12:36:59；预计约 14:37 结束，实际以输出为准。
- `long-start-metadata.json` 为启动时固定元数据。首分钟采样正常，请求排空；尚无长时资源、邀请或完整活动覆盖结论。
- 白天 `interactive`、内置鲸鱼 180px、无会话／工作占用、种子 17；预热 20 秒、真实采样至少 7200 秒、每 5 秒一次。采样中不注入用户操作，邀请自然忽略，不快进时间。
- 指标为 Electron 进程树 RSS／CPU，另列含 DSH 宿主的进程树。首／末半小时 RSS 使用时间加权均值，增量门槛仍为 20 MiB。
- 另检查三类片段与邀请实际覆盖、存档／去重边界、请求排空、页面错误，保留 Renderer 堆／DOM／监听器、CPU steal、内存压力与交换记录。有限计数不证明所有内部队列或定时器。
- VM 中脱离 SSH 的有限时长进程运行，结束后生成 `summary.json` 并清理该次桌面及宿主。150 分钟是异常停止期限。

远端本轮目录：`/home/ubuntu/dsh-p1-lab/results/two-hour-01`。每分钟更新 `progress.json`，结束查看 `summary.json`，异常查看 `failure.json` 及启动日志。最终原始文件取回、摘要复核和环境审阅后，再追加验收结论。路径只描述本次环境。

原始 Host 日志可能含测试临时访问 URL，保留在忽略的测试目录，不将未脱敏日志收入版本库。`SHA256SUMS` 固定本目录当前原始输入；后续结果另增文件和摘要，不覆盖旧字节。

## 尚未覆盖

仅覆盖一台 Linux VM、一版宿主及一个真实时间空闲场景，不替代其他宿主／平台、真实 GPU 功耗、物理锁屏／休眠、多屏或七天实用。P2 进入条件不变。

2026-10-16 查询，[提交 d17029d 的远端 CI](https://github.com/takboo/dsh-coopanion/actions/runs/38760225382) 仍为 failure：Linux／Windows 测试通过，macOS 三项 P1 UI 失败，安装矩阵跳过。原索引的“远端尚未运行”是提交前状态。

## 换包停止记录

2026-10-16 13:23，按用户要求切换最新诊断候选包与独立采样器，提前停止旧观察。原始部分样本、停止原因与报告分别见 old-run-partial-samples.ndjson、old-run-stop.json 和 old-run-partial-summary.json，摘要见 old-run-partial-SHA256SUMS。报告为 incomplete，fullTwoHourObservation 为 false，不计入两小时通过；原始观察器源码另存 observer-v1/ 并与启动元数据的三个摘要逐项匹配。新候选包必须使用新的目录重新计时。
