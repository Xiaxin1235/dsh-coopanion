# M6 日常陪伴节奏：本地验收与资源观察

日期：2026-10-15。版本保持 v0.4.8，仅本地实现、验证和提交，不推送、打标签或发布。

从 M5 验收 `60a7f2e648345fb624d502d88c365ead0b7100e3` 继续。M6 已完成实现、本地功能验收和有界本机资源观察，待维护者审阅及外部验收。M5 物理多屏及混合 DPI、远端 CI、其他平台仍待验收；M3 三平台退出条件未满足。本项按用户明确要求继续独立交付，不抹去这些进入条件边界。

目标与先行共享规则见[日常节奏契约](../../daily-rhythm-contract.md)。默认关闭，白天 07:00–22:00 每 45–90 秒、夜间每 120–240 秒尝试现有词表动作；占用、用户休息和减少动态效果优先。

## 先行基线与预算

产品实现前，在保留的 M5 最终实现 `a392084f81d62b5ddcadb8c43836e453922f21a2` 的干净 checkout `.cache/m5/clean` 和原产物上测量。M5 包 SHA-256 为 `1103686729eae380b790d019cda126d90152dd809cd512fd31217def7cee9fb5`，未修改 M1–M5 证据或固定包。

[原生基线](idle-baseline.json)：macOS arm64 / Electron 44.7.0，180px 内置角色、可见、roam=true；20 秒预热后连续三段各 60 次约 1 秒采样，实际每段约 61.9 秒。Electron 全进程树 CPU 平均 **49.51% 单核**（各段 49.34 / 48.95 / 50.24），RSS 平均 **534.10 MiB**（各段 551.88 / 532.76 / 517.65）。这是当前渲染链的实测基线，不能称为低开销或长期稳定结果。

在实现前固定[资源预算](resource-budget.json)：M6 关闭相对 M5、M6 白天/夜间开启相对 M6 关闭，整组 CPU 均值增加不超过 **5 个单核百分点**，RSS 均值增加不超过 **60 MiB**；同组末段 RSS 均值比首段增长不超过 **30 MiB**。至少相同三段实时间窗口，不用加速浏览器或单次采样代替原生观察；失败先诊断并保留样本，不能事后放宽预算。

CPU 使用 ps 累计 CPU 差分，100% 为一逻辑核；包含 Electron 主进程和全部子进程，排除采样器。RSS 求和可能重复计算共享页；其他桌面负载、系统 GPU 计账和短窗口噪声仍有限制。本项预算是新增策略的增量门槛，长期待机、其他平台和物理日常使用仍待验收。

补充的[隔离测量探针](measure-isolated.mjs)只用于证据采集：读取固定包内测量脚本的模板，在临时模块中统一 M5/M6 的重载路径，通过 CDP `Input.setIgnoreInputEvents` 屏蔽输入，并记录可信输入、按下/拖拽、打开面板和 Renderer RAF 送达帧率。M5/M6 固定源码、生成文件和包字节不变；报告单独绑定模板、探针和临时生成模块 SHA-256。所有组仍预热 20 秒、至少三段 60 秒，沿用原预算；先重新记录同条件 M5 基线，再顺序观察 M6 关闭、白天和夜间。

## 执行状态

实现提交：`e45ee2e1cdb3822e30c6475159b2973d4bf43869`。先行契约与基线、纯策略、完整 Host/Client/Renderer 链路和测试在该提交内。M1–M5 实现及本地验收均保留在祖先链，旧证据与固定包逐字节未变，见[前项身份](previous-milestones.json)。

干净 checkout 为 `.cache/m6/clean`。Node 24.21.0 / npm 11.19.1 重装、类型、174 项 Vitest、12 项 Node 检查、构建和分发包通过，1 项 Linux 专用检查在 macOS 跳过。815 个 Git 源文件匹配完整实现提交，另 10 个生成文件匹配干净构建。固定包 `.cache/m6/takboo-dsh-coopanion-0.4.8.tgz`，SHA-256 为 `c96759f425d043bf2824d243cdedf1fcc584773cb7c2e1cc2538fc9e1d94106e`。

归档的 `release-notes.md` 是包检查器保存的既有 v0.4.8 说明快照，不表示本轮发布。

全部浏览器和 macOS 原生回归、同包两版正式 Host 安装、原生开/关及昼夜资源对照均通过。验收提交只补充证据、文档与状态，不修改产品实现。不能从后续验收提交重新打包后宣称得到同一摘要。

完整[机器汇总](validation.json)记录 101 份证据及其摘要。[包身份](package-verification.json)、[源码/产物内容核对](package-source-content.json)和[证据身份](evidence-identity.json)绑定完整实现提交与同一包摘要；原 `multi-display-ui.json` 未内嵌 commit，明确以同一干净 checkout 的运行上下文及文件摘要绑定，不冒称该原始报告自报了提交。实际 Host 版本、公开服务实现摘要与持久身份在两版正式报告中。

## 实际验证

| 层级 | 结果与证据 |
|---|---|
| 干净重装、类型、174 项 Vitest、12 项 Node 检查、元数据、构建、API 2 角色包、分发包 | 通过；1 项 Linux 专用检查在 macOS 跳过，原始日志以 gzip 留存 |
| 22 项纯策略：时间边界、跨日/时段、时钟回退/间隙、随机源、全部占用、缺词、去重及动作释放 | 通过，`test.log.gz` |
| 6 项 M6 浏览器：legacy calm、真实 API 2 动作/复位、占用优先、热配置状态/身份/气泡计时、缺词待机、本地小时变化 | [通过](daily-rhythm-ui.json)，[截图](daily-rhythm-ui.png) |
| 原有 WebGL/物理/沙箱、中英文、通知/收件箱、11 项回复与字号、1 项多屏浏览器回归 | 通过，`ui.log.gz`、`notification-ui.log.gz`、`inbox-ui.log.gz` |
| macOS arm64 / Electron 44.7.0：日夜 API 2 动作、任务抢占坐下、真实 main/preload IPC、草稿/焦点/选择及阅读 DOM/滚动 | [通过](daily-rhythm-native.json)，[截图](daily-rhythm-native.png)；注入策略时间，物理仍实时推进 |
| M3 原生恢复、M4 字号、M5 受控工作区/几何/实际 OS 光标与 CDP 输入、拖拽中拔屏 drop 无 throw | 通过，`desktop-recovery.json`、`text-scale-native.json`、`multi-display-native.json`；仍只有一块真实显示器 |
| 同一固定包经两版官方 loader 安装，旧配置默认关闭、volatile 持久化、即时 IPC、原生及 Host 重启、中英文、M1/M2/M3 回归 | 两版通过：[rc.2](daily-rhythm-installed-0.2.0-rc.2.json) / [alpha.1](daily-rhythm-installed-0.2.1-alpha.1.json)，对应 install / goal / session / recovery 报告同包绑定 |
| 历史 character-pack.log.gz 可打包，注入 web/character-pack.js 仍拒绝 | [通过](package-negative-check.json)，保留负向语义 |
| 原生真实时间的开/关及日夜增量预算 | 通过，详见下一节；不代表长期真实待机验收 |

## 有界原生资源观察

[完整对照](resource-comparison.json)使用同一隔离探针、macOS arm64 / Apple M4 Pro / Electron 44.7.0、180px 内置角色和当前单块 P272U PRO（workArea 2048×1127 DIP，scaleFactor / DPR 2）。每组预热 20 秒；M5、M6 关闭、白天各三段 60 次约一秒采样，夜间三段各 90 次，实际每段分别约 61.8 / 92.8 秒。时钟和物理按真实时间推进，仅本地小时受控；夜间总时长覆盖最长首次等待及动作恢复。

| 同条件组 | CPU 均值（单核 %） | RSS 均值（MiB） | CPU 增量（百分点） | RSS 增量（MiB） |
|---|---:|---:|---:|---:|
| M5 基线 | 46.81 | 529.86 | — | — |
| M6 关闭（对 M5） | 46.80 | 546.05 | -0.01 | +16.19 |
| M6 白天（对关闭） | 47.45 | 536.73 | +0.65 | -9.32 |
| M6 夜间（对关闭） | 49.40 | 508.80 | +2.60 | -37.25 |

四组 Renderer RAF 送达均约 60 次/秒，可信输入均为 0，未出现按下/拖拽或打开面板。三个 M6 组末段 RSS 均值均低于首段；CPU 增量 ≤5 点、RSS 增量 ≤60 MiB、末段对首段增长 ≤30 MiB 的原预算全部通过。进入时的原始 M5 基线与预算保持原样；上表单独使用统一重载和隔离条件的 M5 对照基线，不将不同采样条件混用。

原始完整样本以 `idle-baseline-controlled.json.gz`、`idle-off.json.gz`、`idle-day.json.gz`、`idle-night.json.gz` 保存，原始与压缩字节摘要均在机器汇总。RSS/CPU 具有窗口波动，RSS 求和含共享页；这些数据只支持本机有界增量观察，不能推出普遍节能、长期无增长或其他平台性能通过。

## 配置与行为检查

默认关闭沿用原 calm 调度和上游动作去重。开启后由纯策略在空闲时选择已有词表中的 look / nod / wave / sit，夜间只选 nod / sit，坐下有限时恢复；候选同时满足 manifest 和实际 body.words，缺少 neutral、stand 或去重后无候选时保持待机。动作通过原 API 2 沙箱执行，没有重写物理系统或扩展素材。

任务、后台工作、成功庆祝、异常、待办、阅读/面板、回复/通知、输入草稿/发送、按下/拖拽/物理占用、悬停、休息、隐藏/休眠和减少动态效果均优先。动作释放后复用当前 Host 神态，物理占用中推迟复位，用户选择的睡眠不会被旧动作叫醒；占用结束重新等待完整间隔。跨日与系统本地小时变化、时段边界、时钟回退和长调度间隙均受控重放，不补播错过的动作。

热偏好只更新策略和 controls，保持当前角色 frame、阅读 DOM/捕获正文/滚动偏移、草稿/焦点/选择、在途请求身份及原气泡计时，不产生 read/select/chat 或额外通知。配置沿 Harness volatile、完整 configure、真实 main/preload IPC 即时同步并在原生及 Host 重启后保持；启动握手期间的新配置也会进入最新完整 baseline，避免旧启动参数覆盖。

M1 正式 complete 才庆祝、M2 串行准入/持久去重和接受边界、M3 generation/visibilityRevision/隐藏恢复/停止取消、M4 字号与状态保持、M5 几何/revision/拖拽拔屏 drop 无 throw 均通过原回归。进程崩溃后临时草稿与阅读位置仍会丢失，不扩展自动重放。

## 重复命令

在上述固定实现的干净 checkout 中运行，`ORIGINAL_REPO` 指向原仓库。macOS Chrome / Electron / Host 回环端口在沙箱外执行。

```sh
export ORIGINAL_REPO=/Users/jam/Documents/codespace/personal-projects/dsh-coopanion
export PATH="$ORIGINAL_REPO/.cache/m1/toolchain/node_modules/node/bin:$ORIGINAL_REPO/.cache/toolchain/node_modules/.bin:$PATH"
export npm_config_cache="$ORIGINAL_REPO/.cache/npm-cache"
export CHROMIUM_PATH="/Users/jam/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
npm ci --ignore-scripts
npm run setup:electron
npm run typecheck
npm test
npm run verify:metadata
npm run build
npm run character:pack -- examples/star paper-star.zip
npm pack --ignore-scripts --pack-destination ..
node scripts/check-package.mjs ../takboo-dsh-coopanion-0.4.8.tgz --write-report
npm run test:ui
npm run test:notification-ui
npm run test:inbox-ui
npm run test:desktop
DSH_TEST_VERSION=0.2.0-rc.2 DSH_TEST_RUNTIME="$ORIGINAL_REPO/.cache/m1/runtime-rc" DSH_TEST_PACKAGE="$ORIGINAL_REPO/.cache/m6/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
DSH_TEST_VERSION=0.2.1-alpha.1 DSH_TEST_RUNTIME="$ORIGINAL_REPO/.cache/m1/runtime-alpha" DSH_TEST_PACKAGE="$ORIGINAL_REPO/.cache/m6/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
# Stop other automated browser/native workloads before these real-time observations.
export M6_RESOURCE_PROBE="$ORIGINAL_REPO/docs/evidence/m6/measure-isolated.mjs"
node "$M6_RESOURCE_PROBE" --checkout "$ORIGINAL_REPO/.cache/m5/clean" --template "$PWD/scripts/measure-idle.mjs" --mode baseline --rounds 3 --seconds 60 --output ../idle-baseline-controlled.json
node "$M6_RESOURCE_PROBE" --checkout "$PWD" --mode off --rounds 3 --seconds 60 --output ../idle-off.json
node "$M6_RESOURCE_PROBE" --checkout "$PWD" --mode day --rounds 3 --seconds 60 --output ../idle-day.json
node "$M6_RESOURCE_PROBE" --checkout "$PWD" --mode night --rounds 3 --seconds 90 --output ../idle-night.json
```

M5 基线采样使用同一脚本，`--checkout "$ORIGINAL_REPO/.cache/m5/clean" --mode baseline --rounds 3 --seconds 60`；先核对该 checkout、生成文件及原固定包摘要，不能对 M5 证据或产物做改动。两版 runtime 的实际版本与 peer 在正式检查中再次核对。

## 尚未验收

维护者审阅、远端三平台 CI、Linux/Windows 原生、长期真实待机/日常体验、物理多屏/混合 DPI、物理锁屏/睡眠、真实模型和物理系统通知中心送达/留存仍待验收。浏览器与独立原生策略检查只注入策略时间和随机源，角色 frame 与物理按真实时间推进；资源检查使用完整真实时间，开/关对照仅固定本地小时。两者不能替代长期使用或其他平台。

既有三平台测试与两版 Host 六组安装矩阵保留，M6 策略、界面、原生和正式安装已接入同一入口并上传报告；资源测量是有界本机观察，不作为噪声较大的远端性能阈值。M3 跨平台、M5 物理退出条件继续保留。本轮未推送、打标签或发布。
