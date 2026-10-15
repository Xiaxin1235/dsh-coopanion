# M2 会话直接续接：契约与验收

日期：2026-10-15。本地验收通过，待维护者审阅；未发布，版本仍为 v0.4.8。M1 两个提交 `df36f0dd138c48cac491a552bba3e1950dc48184` / `592cd7b6536c4e714f21d8ef92d01a7030dd8493` 均保留在祖先链中。只推进 M2，未启动 M3 至 M6。

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

实现提交：`89d0fcbee7c51d0eea15ebf223b4e48fd3809a2c`。工作区干净时执行 `npm ci`、完整测试、构建和打包；最终验收提交只添加证据并更新里程碑状态，不改变实现。固定产物 `.cache/m2/takboo-dsh-coopanion-0.4.8.tgz`，SHA-256：`743ab7f4bcad0fe7785020c63bfd1c069d4b1755eb833591140286dec5219423`。两版安装使用同一份字节，未覆盖 M1 的产物或证据。

机器汇总见 [validation.json](validation.json)，实际包身份见 [package-verification.json](package-verification.json)，包内 578 个受 Git 管理的文件逐字节匹配实现提交，见[源码内容核对](package-source-content.json)；同目录 release-notes.md 是包检查器所需的既有 v0.4.8 版本记录快照，不代表已发布 M2。两版最终正式 Host 样本：[rc.2](session-host-0.2.0-rc.2.json) / [alpha.1](session-host-0.2.1-alpha.1.json)；真实 Renderer → preload → Electron main → Host → 接受回执及持久消息样本：[rc.2](session-native-0.2.0-rc.2.json) / [alpha.1](session-native-0.2.1-alpha.1.json)。四类核心报告（session-host / session-native / install / goal-host）均核对到同一完整源码提交和包 SHA-256；Host 报告记录探针源码 SHA-256、六个正式宿主包版本及实现摘要。

| 实际执行范围 | 结果 |
|---|---|
| Node 24.21.0 / npm 11.19.1，干净 npm ci、Electron 44.7.0 安装、类型、元数据、构建、API 2 角色包、分发包 | 通过 |
| Vitest 14 文件 / 129 项；发布与 Client 构建 11 项、locale Client 1 项 | 通过 |
| 浏览器 WebGL / 物理 / 角色包与沙箱、中英文切换 3 项、通知与收件箱、完整回复及发送 7 项 | 通过 |
| 快速重复点击、固定在途目标、会话独立草稿、丢失回执重试、匹配接受后清空、接受状态不被迟到失败覆盖 | 通过 |
| 冷历史列表不激活 Agent / 不调用模型，历史回复已读基线，阅读快照不被新结果替换 | 通过 |
| 正式 Host 并发同请求一次准入，已领取间隙和新准入实例重试一次，文本/时区冲突拒绝、新请求正常排队 | 两版通过 |
| 正式 Host 缺失会话、子代理、不可用模型、实际 POSIX 目录权限拒绝、竞争写句柄 | 两版通过；权限目录临时设为 000 后恢复 |
| 取消边界：prompt 开始前 AbortError，开始后返回已接受；Host 提交前取消与缺失服务 | 前者两版正式 Host 通过，后者单元检查通过 |
| 真实 macOS arm64 Electron：失败和重试回执、草稿保留、接受后清空、来源会话续接、原生角色和关闭 | 通过 |
| 实际同包的正式安装、原生冷会话发送、准确持久请求身份、完整结果阅读后继续、Host 重启及配置持久化 | [rc.2](install-0.2.0-rc.2.json) / [alpha.1](install-0.2.1-alpha.1.json) 均通过 |
| M1 目标完成语义及审批 / continued 提问独立结算回归 | 两版 [goal rc.2](goal-host-0.2.0-rc.2.json) / [goal alpha.1](goal-host-0.2.1-alpha.1.json) 和通知报告通过 |

运行时依赖锁保存为 [rc.2 gzip](runtime-lock-0.2.0-rc.2.json.gz) / [alpha.1 gzip](runtime-lock-0.2.1-alpha.1.json.gz)，原始与压缩文件 SHA-256 见 validation.json；与 M1 使用的准确运行时依赖锁一致。文件目录中的 notification-host / notification-integration / notification-source 保留本轮通知回归样本；受控通知送达不等同于物理 OS 送达。原始控制器样本刻意保留其重复消息行为；最终 M2 插件样本中的一次准入断言才是修复验证。

既有六组 CI 安装矩阵会执行 M2 Host 与原生发送检查并上传 session-host / session-native 报告。本轮不推送，远端三平台 CI、Linux/Windows 原生执行、真实模型质量及物理系统通知中心送达/留存均未验收。受控模型适配器只验证正式 Host 的生命周期、队列及持久身份，不证明真实模型的质量；本轮没有请求外部模型。
