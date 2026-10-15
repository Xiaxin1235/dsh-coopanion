# M3 桌面异常恢复：本地验收

日期：2026-10-15。版本仍为 v0.4.8，未推送、打标签或发布。M3 已实现并完成本地验收，待维护者审阅；三平台原生退出条件仍待 Linux / Windows 执行。M4 至 M6 未启动。

实现提交：`15abf97f3b3522c648f7bd8b69f9e095f3a3c664`。从本地 M2 验收提交 `7b6b987d51b52c614b8c1acd81650acb483c042e` 继续，M2 实现 `89d0fcbee7c51d0eea15ebf223b4e48fd3809a2c` 及 M1 实现/验收均保留在祖先链中。实现、测试与契约在一个提交内，最终验收提交仅补充证据与状态。

## 行为与边界

共享寿命类型和错误分类见 [desktop-lifecycle.ts](../../../src/desktop-lifecycle.ts)，完整规则见[恢复契约](../../desktop-recovery-contract.md)。Host 按 1、3、10 秒最多自动恢复三次；连续稳定运行 60 秒后清零，锁屏/休眠打断稳定计时。意外退出及明确可恢复错误才重试，确定性错误和未确认清理直接终止。停止、停用与卸载同步取消等待/在途启动；保留手动重启入口及最多 600 字符诊断。

显示意图与原生回执分别保存。隐藏意图在创建原生窗口前传入，新代收到自己的 visibilityRevision 后才具备通知资格。Host 下发最新关注会话、全文、未读和有效请求；已有结果用 baseline 恢复为收件箱内容，不再主动说一遍，不标记已读。旧进程消息和发送回调不能污染新代，旧领取只记录迟到证据，不重新换通道投递。M1 完成判断、审批/提问独立结算以及 M2 固定请求身份、持久去重均保留。

草稿、输入提交状态及阅读位置仍只属于当前 renderer，进程退出会丢失。已接受输入仍在 Harness 的持久队列，恢复不重放输入、不调用模型、不伪造接受回执。Host 完整重启的历史基线沿用既有规则；M3 的状态保留指同一 Host 内的原生进程恢复。

## 固定产物与重复命令

固定包：`.cache/m3/takboo-dsh-coopanion-0.4.8.tgz`，SHA-256：`076e0904f19d0ce1931a89e46698538a236005197f004eb669772cf1b9b528d9`。干净实现提交上重装依赖、执行完整测试和构建后打包；两个正式宿主安装同一份字节。包中 602 个 Git 管理文件逐字节匹配该实现提交，另 10 个生成文件匹配干净构建，见[内容核对](package-source-content.json)。[包身份](package-verification.json)绑定完整源码提交；release-notes.md 是包检查器需要的既有 v0.4.8 记录快照，不代表本轮已发布。

```sh
export PATH="$PWD/.cache/m1/toolchain/node_modules/node/bin:$PWD/.cache/toolchain/node_modules/.bin:$PATH"
export npm_config_cache="$PWD/.cache/npm-cache"
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
mkdir -p .cache/m3
npm pack --ignore-scripts --pack-destination .cache/m3
node scripts/check-package.mjs .cache/m3/takboo-dsh-coopanion-0.4.8.tgz --write-report
npm run test:ui
npm run test:notification-ui
npm run test:inbox-ui
npm run test:desktop
DSH_TEST_VERSION=0.2.0-rc.2 DSH_TEST_RUNTIME="$PWD/.cache/m1/runtime-rc" DSH_TEST_PACKAGE="$PWD/.cache/m3/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
DSH_TEST_VERSION=0.2.1-alpha.1 DSH_TEST_RUNTIME="$PWD/.cache/m1/runtime-alpha" DSH_TEST_PACKAGE="$PWD/.cache/m3/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
```

先核对两个 runtime 中实际 `@deepseek-ai/dsh` 版本，分别必须为 `0.2.0-rc.2` / `0.2.1-alpha.1`。正式安装入口再次核对每个相关宿主包版本。macOS GUI 和 Host 回环端口在沙箱外执行。`--write-report` 需要 checkout 干净且 HEAD 等于实现提交；验收文档提交后重现该包，应检出实现提交。原生检查临时 bundle 同一 Host 源码到 dist/recovery-test.js，结束后删除，不扩展产品公共 API。

## 实际验证

| 层级 | 实际结果 |
|---|---|
| Node 24.21.0 / npm 11.19.1；干净 npm ci、Electron 44.7.0、类型、元数据、构建、API 2 角色包与分发包 | 通过 |
| Vitest 14 文件：142 通过、1 跳过；Node 发布/Client 构建 11 项、locale Client 1 项 | 通过；跳过项是仅 Linux 的无图形环境检查，本机为 macOS |
| 可控时钟：默认 1/3/10 秒、连续失败与反复短运行上限、60 秒稳定重置、锁屏/休眠中断稳定时间 | 通过 |
| 停止/卸载取消退避和在途启动、排队启动取消、迟到代次、启动与清理期限、未知/明确/巨大错误诊断 | 通过 |
| Host 通知集成：恢复期间无资格、新代需新回执、旧领取迟到证据不换通道、审批独立结算、全文/关注/未读保留 | 通过 |
| 浏览器 WebGL/物理/角色 API 2/沙箱、中英文 3 项、通知与收件箱、完整回复和发送 8 项 | 通过，包含恢复 baseline 不说旧回复也不确认已读 |
| macOS arm64 真实 Electron 主进程 SIGKILL：隐藏无可见回执、显示恢复、完整结果和请求、无输入重放、退避中停止和卸载 | 通过；[原始运行事件](desktop-recovery.json)，原生测试注入间隔 100/300/1000 ms，生产默认间隔由可控时钟及正式安装验证 |
| 同包正式 Host 安装、M1/M2 契约及真实 Renderer → IPC → Host 回归、原生崩溃恢复 | 两个完整宿主版本通过，见 [rc.2 恢复](desktop-recovery-0.2.0-rc.2.json) / [alpha.1 恢复](desktop-recovery-0.2.1-alpha.1.json) 与对应 install / session-native / goal-host / session-host 报告 |

正式安装的 M3 探针在受控打开的审计回合内调用真正的 `approval.request`，由测试答复器保持待处理；原生崩溃后验证同一完整 approvalId 仍为 open，最后由原服务的取消信号产生结算。它没有自动审批，也没有把 Renderer 快照当作实际处理成功。实际主进程 PID 来自 CDP SystemInfo，SIGKILL 后继续通过正式 Host 的公开 Connection 读取状态；持久 M2 message.id 列表在恢复前后完全一致。两版保持默认 1 秒首次退避。

机器汇总与每份样本摘要见 [validation.json](validation.json)。原始命令日志以 .log.gz 保存，解压字节和压缩文件摘要均记录在汇总中。notification-* 样本保留本轮通知契约和受控适配器回归；运行时原始 npm 依赖锁分别压缩保存，原始及 gzip SHA-256 均在汇总中。各类带身份报告核对到同一实现提交和包摘要；先前 M1/M2 目录与产物未覆盖。

## 尚未验收

远端三平台 CI、Linux/Windows 原生进程恢复、物理 OS 锁屏/睡眠后恢复、真实模型质量和物理系统通知中心送达/留存未执行。锁屏/休眠目前覆盖可控生命周期、通知再领取和跨进程已观察状态传递，不代表物理电源事件已验收。既有三平台测试与两版宿主六组安装矩阵已接入相同恢复入口并配置报告上传，远端矩阵尚未运行。维护者应完成外部平台验收后再确认路线图的三平台退出条件。本轮没有发布或启动 M4 至 M6。
