# M4 文字可读性：本地验收

日期：2026-10-15。版本保持 v0.4.8。M4 已完成实现与本地验收，待维护者审阅；远端 CI 和其他平台原生验收未执行。M5/M6 未启动，本轮未推送、打标签或发布。

实现提交：`b3b4050bbda02343afd94d3a91c9adf9557c7213`；从 M3 验收提交 `2312cabbf989f38ae3f6a82c542347942b746875` 继续，M1/M2/M3 实现与验收都保留在祖先链中。实现提交包含共享配置、Host/Client/Renderer、测试和契约；本验收提交补充证据与准确状态。

## 行为与边界

完整规则见[文字可读性契约](../../text-readability-contract.md)。`textScale` 使用 `1`、`1.25`、`1.5`，默认 100%；Harness 设置持久化，立即经原生 IPC 同步到当前 Renderer，独立于角色 90–240 尺寸。回复气泡、提醒、收件箱、阅读及聊天主要文字随之缩放；代码和表格保留必要横向滚动，面板按新尺寸重新测量并夹入当前工作区，未读入口按实际大小定位。

热切换只更新文字样式和测量，不替换阅读 DOM、捕获正文、草稿或在途请求；不改变关注会话，不新增已读或发送，也不延长原气泡驻留时间。阅读保留滚动像素偏移，换行后同一偏移可能对应不同文本行。进程崩溃后的临时草稿与阅读位置仍会丢失；不扩展 M2/M3 的跨进程状态或重放语义。角色 API 2、沙箱、M1 完成判定、M2 去重和审批/提问独立结算均保留。工作区仍用现有模型，本项未启动 M5 的多屏几何重构。

## 固定产物与重复命令

固定包：`.cache/m4/takboo-dsh-coopanion-0.4.8.tgz`，SHA-256：`c2c1655a4fd102d0c4e2bf8fd2e00e9600fe0ba48763d9184889592eeec8fed7`。包身份见 [package-verification.json](package-verification.json)。在实现提交的干净本地 clone 中重装、测试、构建、打包；两个正式宿主使用同一份字节。包中 647 个 Git 管理文件与该提交逐字节相符，10 个生成文件与干净构建相符，见[源码与产物核对](package-source-content.json)。release-notes.md 是包检查器保存的既有 v0.4.8 发布说明快照，不代表本轮已发布。

```sh
# 在实现提交的干净 checkout 中运行；工具链与 runtime 路径指向原仓库。
export PATH="$ORIGINAL_REPO/.cache/m1/toolchain/node_modules/node/bin:$ORIGINAL_REPO/.cache/toolchain/node_modules/.bin:$PATH"
export npm_config_cache="$ORIGINAL_REPO/.cache/npm-cache"
export CHROMIUM_PATH="/Users/jam/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
node --version
npm --version
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
DSH_TEST_VERSION=0.2.0-rc.2 DSH_TEST_RUNTIME="$ORIGINAL_REPO/.cache/m1/runtime-rc" DSH_TEST_PACKAGE="$ORIGINAL_REPO/.cache/m4/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
DSH_TEST_VERSION=0.2.1-alpha.1 DSH_TEST_RUNTIME="$ORIGINAL_REPO/.cache/m1/runtime-alpha" DSH_TEST_PACKAGE="$ORIGINAL_REPO/.cache/m4/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
```

本轮 `ORIGINAL_REPO=/Users/jam/Documents/codespace/personal-projects/dsh-coopanion`，干净 checkout 为 `.cache/m4/clean`。先核验实际 runtime 版本，再复用隔离运行时；正式安装还会核验所用宿主 peer 版本。macOS GUI 和 Host 回环端口在沙箱外运行。验收文档提交后重现该包需检出上述实现提交，不能从验收提交重新打包后宣称摘要相同。

## 实际验证

| 范围 | 实际结果 |
|---|---|
| Node 24.21.0 / npm 11.19.1；干净 npm ci、Electron 44.7.0、类型、元数据、构建、API 2 角色包、分发包 | 通过 |
| Vitest 15 文件：144 通过、1 跳过；Node 发布与 Client 检查 12 项 | 通过；跳过项是仅 Linux 的无图形环境检查，本机为 macOS |
| 320×640 浏览器：中英文、三档 × 90/240，阅读/收件箱/聊天、长正文、代码与表格滚动、面板稳定 | 通过；[中文样本](text-scale-zh-CN.json)、[英文样本](text-scale-en-US.json)，对应 12 张阅读截图及聊天/收件箱截图 |
| 阅读中新增结果、捕获 DOM 与正文、140px 滚动偏移、无额外 read/select/chat、快速切换、草稿/选择/焦点、键盘发送、在途接受身份、原气泡计时 | 通过，见 `inbox-ui.log.gz` 中三项 M4 检查；原有八项回复与续接检查也通过 |
| 既有浏览器动画/角色/沙箱/物理、中英文本地化、通知与收件箱回归 | 通过，见对应原始日志 |
| macOS arm64 真实 Electron：12 组字号/尺寸/语言、当前工作区定位、捕获正文、120px 滚动偏移、草稿 | 通过，见[原生测量](text-scale-native.json)和[截图](text-scale-native.png) |
| M3 真实主进程 SIGKILL、隐藏/显示恢复、状态基线、不重放、停止/卸载取消；M1/M2 既有原生 IPC | 通过，见 `desktop.log.gz` 与 [desktop-recovery.json](desktop-recovery.json) |
| 同一固定包经官方 loader 安装，旧配置默认、三档 × 两种尺寸、即时同步、当前草稿、原生重启、完整 Host 重启和中英文设置 | DSH `0.2.0-rc.2` 与 `0.2.1-alpha.1` 均通过，见 [rc.2 文字样本](text-scale-installed-0.2.0-rc.2.json) / [alpha.1 文字样本](text-scale-installed-0.2.1-alpha.1.json)及对应 install / goal-host / session-host / session-native 报告 |
| 分发包规则 | 允许历史 `character-pack.log.gz` 证据；注入 `web/character-pack.js` 旧源码仍拒绝，见[负向检查](package-negative-check.json) |

机器汇总、所有归档文件摘要与原始日志摘要见 [validation.json](validation.json)。日志以 gzip 保存，原始字节与 gzip SHA-256 分别记录；两版实际依赖锁原样压缩留存。正式安装报告中的完整 sourceCommit 和 archiveSha256 均核对到上述实现和固定包。M1/M2/M3 目录与产物未覆盖。

## 尚未验收

远端三平台 CI、Linux/Windows 原生窗口、物理混合 DPI / 多显示器、物理锁屏/睡眠、真实模型和物理 OS 通知中心送达/留存未执行。现有三平台测试和两版宿主六组安装矩阵已沿用相同入口并上传 M4 JSON/截图，但未运行远端矩阵。M3 三平台退出条件仍未满足。M4 的本地验收只覆盖本机 macOS、受控工作区及上述正式 Host，不能代替其他平台或 M5 多屏验收。
