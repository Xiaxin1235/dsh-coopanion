# M2 会话直接续接：契约与验收

日期：2026-10-15。实现完成，最终干净源码包的验收报告待补充；未发布，版本仍为 v0.4.8。M1 两个提交 `df36f0dd138c48cac491a552bba3e1950dc48184` / `592cd7b6536c4e714f21d8ef92d01a7030dd8493` 均保留在祖先链中。只推进 M2，未启动 M3 至 M6。

产品行为与精确协议见[会话续接契约](../../session-chat-contract.md)。固定参考仅用于思路定位：[dsh-orb e5611a1b905091a48e32e25d183ef6ef9517d4ab，orb.ts L682](https://github.com/mini-yifan/dsh-orb-cordis/blob/e5611a1b905091a48e32e25d183ef6ef9517d4ab/packages/host/src/orb.ts#L682)。实现按两个支持版本的公开控制器和实际行为完成，没有引入其 Computer Use 或替代会话回退。

## 首个检查点与版本对照

[原始 rc.2 样本](controller-0.2.0-rc.2.json)、[原始 alpha.1 样本](controller-0.2.1-alpha.1.json) 使用 M1 同一实际包加载，仅由新探针调用正式公开服务；保存的[原始探针](controller-probe.mjs)不是该 M1 包自带代码。样本 sourceCommit / archiveSha256 指向 M1 基线，不能用作 M2 实现产物身份。宿主六个包的版本及实际实现 SHA-256 在每份样本中。

| 核验项 | DSH 0.2.0-rc.2 | DSH 0.2.1-alpha.1 |
|---|---|---|
| 冷普通会话恢复 | Agent 和 Session 均已分离，再由 prompt 恢复 | 相同 |
| 请求身份及文本 | 完整 requestId 写入 source.rpcId；换行、Unicode 文本及时区一致 | 相同 |
| 接受回执 | `{ accepted: true }`，表示进入收件队列 | 相同 |
| 已领取间隙重试 | 同请求形成 2 个不同 message.id | 相同 |
| 并发相同请求 | 同请求形成 2 个不同 message.id | 相同 |
| 不存在目标 | session/not-found | 相同 |
| 竞争写句柄 | session/writer-held | 相同 |
| 无效时区 | session/invalid-time-zone | 相同 |
| 准入前取消 | AbortError；无接受回执 | 相同 |

“写入一次”按唯一 message.id 计算；同一消息在 inbox 的移动、领取以及 user/message 中出现不计为多条消息。原始样本包含完整事件，能复核准确的请求 ID 与消息 ID。竞争写句柄测试在同一进程内使用独立正式持久句柄，验证宿主拒绝语义；不把它描述为第二个独立操作系统进程的测试。

## 重复命令

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
mkdir -p .cache/m2
npm pack --ignore-scripts --pack-destination .cache/m2
node scripts/check-package.mjs .cache/m2/takboo-dsh-coopanion-0.4.8.tgz --write-report
npm run test:ui
npm run test:notification-ui
npm run test:inbox-ui
npm run test:desktop
npm run test:m2:host -- --verify-plugin --runtime .cache/m1/runtime-rc --version 0.2.0-rc.2 --package .cache/m2/takboo-dsh-coopanion-0.4.8.tgz
npm run test:m2:host -- --verify-plugin --runtime .cache/m1/runtime-alpha --version 0.2.1-alpha.1 --package .cache/m2/takboo-dsh-coopanion-0.4.8.tgz
DSH_TEST_VERSION=0.2.0-rc.2 DSH_TEST_RUNTIME="$PWD/.cache/m1/runtime-rc" DSH_TEST_PACKAGE="$PWD/.cache/m2/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
DSH_TEST_VERSION=0.2.1-alpha.1 DSH_TEST_RUNTIME="$PWD/.cache/m1/runtime-alpha" DSH_TEST_PACKAGE="$PWD/.cache/m2/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
```

两个 runtime 必须分别安装准确的 `@deepseek-ai/dsh@0.2.0-rc.2` / `@deepseek-ai/dsh@0.2.1-alpha.1`，入口会复核实际版本。macOS 原生 Electron、Chrome 和 Host 端口在沙箱外运行。`--write-report` 要求干净且已提交的 checkout。若要仅重现首个检查点，可加 `--probe docs/evidence/m2/controller-probe.mjs` 并去掉 `--verify-plugin`；它仍直接调用正式控制器，将如实记录原生去重缺口。

## 验收范围

待最终产物复验后，在此补充完整源码提交、实际包摘要、两版宿主和原生 IPC 样本，以及运行时锁文件。实现过程已通过相关回归、浏览器发送场景、真实 macOS Electron IPC 和 rc.2 安装；它们不替代最终包的身份核对。

既有六组 CI 安装矩阵会执行 M2 Host 与原生发送检查并上传 session-host / session-native 报告。本轮不推送，远端三平台 CI、Linux/Windows 原生执行、真实模型质量及物理系统通知中心送达/留存均未验收。受控模型适配器只验证正式 Host 的生命周期、队列及持久身份，不证明真实模型的质量；本轮没有请求外部模型。
