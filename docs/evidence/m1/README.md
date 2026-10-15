# M1 完成语义验收

日期：2026-10-15。产品版本仍为 0.4.8，本次为本地实现，未发布。

## 正式宿主契约

检查通过官方 `dsh plugin --profile ... add <tgz>` 安装，随后从已发布 CLI 的正式 profile loader 启动。公开 Session Controller 创建会话，真实 Agent loop、目标工具、目标域、投影和自动续跑驱动执行；只有模型响应与角色/系统投递边界受控。插件装配检查在该 Host 进程内运行实际安装包的 `mountPet`，将真实已提交事件送入隔离 Context，捕获角色通知和快照。原生安装测试另覆盖真实 Electron 与 IPC。

| 契约 | DSH 0.2.0-rc.2 | DSH 0.2.1-alpha.1 |
|---|---|---|
| goal/change | kind=goal/change, version=1 | 相同 |
| 非 clear 变更 | operation, goal, roundsStarted, createdAt, updatedAt | 相同 |
| goal 完整快照 | id, revision, objective, phase, maxGoalRounds；blocked 时附 blockedReason={code,message} | 相同 |
| operation | create / edit / pause / resume / complete / block / clear | 相同 |
| phase | active / paused / blocked / complete | 相同 |
| clear 墓碑 | kind, version, operation=clear, cleared={id,revision}, clearedAt | 相同 |
| 自动续跑 user/message.source | kind=goal, goalId=完整 ID, revision=准确当前 revision, round=正整数 | 相同 |
| 公开投影 goal | {goal,roundsStarted,createdAt,updatedAt} 或 null；不含进程内 activation | 相同 |
| 第一次用户轮建目标 | tool/call → goal/change create rev1 → tool/result → completed | 相同 |
| 目标中间轮 | 自动来源 round1、round2 后都是 turn/end completed，目标仍 active | 相同 |
| 失败完成更新 | 错误 revision 的 update_goal 返回 isError，没有 goal/change | 相同 |
| 目标成功 | round3 中 goal/change complete rev2，先于最终 turn/end completed | 相同 |
| 自动轮数耗尽 | 最后 turn/end completed 后才提交 block / round-limit | 相同 |

这些事件来自正式域和循环；没有将构造事件的 Session.append 成功等同于 schema 验证。严格折叠使用宿主公开 `applyGoalProjection`，拒绝错 ID、错 revision、非连续 round 及未知 schema。原缺陷通过 `npx vitest run tests/completion.test.ts` 复现：首个 active 目标回合结束后错误得到 happy；修正后测试通过。

## 重复检查

使用仓库 `.node-version` 指定的 Node 和 `packageManager` 指定的 npm。两个运行时各自隔离安装，禁止混用宿主版本。

```sh
npm ci --ignore-scripts
npm run setup:electron
npm run typecheck
npm test
npm run build
npm run character:pack -- examples/star paper-star.zip
npm pack --ignore-scripts --pack-destination .cache/m1
npm install --prefix .cache/m1/runtime-rc --ignore-scripts --no-audit --no-fund @deepseek-ai/dsh@0.2.0-rc.2
npm install --prefix .cache/m1/runtime-alpha --ignore-scripts --no-audit --no-fund @deepseek-ai/dsh@0.2.1-alpha.1
npm run test:m1:host -- --runtime .cache/m1/runtime-rc --version 0.2.0-rc.2 --package .cache/m1/takboo-dsh-coopanion-0.4.8.tgz
npm run test:m1:host -- --runtime .cache/m1/runtime-alpha --version 0.2.1-alpha.1 --package .cache/m1/takboo-dsh-coopanion-0.4.8.tgz
npm run test:ui
npm run test:notification-ui
npm run test:inbox-ui
npm run test:desktop
DSH_TEST_VERSION=0.2.0-rc.2 DSH_TEST_RUNTIME="$PWD/.cache/m1/runtime-rc" DSH_TEST_PACKAGE="$PWD/.cache/m1/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
DSH_TEST_VERSION=0.2.1-alpha.1 DSH_TEST_RUNTIME="$PWD/.cache/m1/runtime-alpha" DSH_TEST_PACKAGE="$PWD/.cache/m1/takboo-dsh-coopanion-0.4.8.tgz" npm run test:install
```

CI 的既有三平台、两宿主安装矩阵会运行 M1 契约检查并上传 goal-host 报告。本次不推送，远端 CI 结果不在已通过范围内。

## 验证与身份

本地验收通过，待维护者审阅。源码实现提交：`df36f0dd138c48cac491a552bba3e1950dc48184`，打包时工作区干净；最终验收文档提交仅补充证据与状态，不改变实现。实际本地产物为 `.cache/m1/takboo-dsh-coopanion-0.4.8.tgz`，SHA-256：`0abff21b1a4115208322e40378e806c34ce64fc006273d2e25e18d8e6a5682f2`，尚未发布。

完整机器记录见 [validation.json](validation.json) 与 [产物验证](package-verification.json)。两版 Host 样本分别为 [0.2.0-rc.2](goal-host-0.2.0-rc.2.json)、[0.2.1-alpha.1](goal-host-0.2.1-alpha.1.json)，包含完整 goalId/revision/round、原始 seq、投影快照、角色状态、全文结果及六个宿主包实现 SHA-256。运行时完整 npm 依赖锁以 gzip 保存，解压后的原始摘要和压缩文件摘要均在 validation.json 中。

| 实际执行范围 | 结果 |
|---|---|
| Node 24.21.0 / npm 11.19.1，类型、元数据、构建、分发包 | 通过 |
| Vitest 13 文件 / 120 用例；Node 发布与 Client 构建 11 用例、locale Client 1 用例 | 通过 |
| 普通单轮、目标首轮/中间轮/终态、失败工具、错误/停止/阻塞、重复和迟到事件、历史已读恢复、多个目标、并行会话、子代理、continued 提问 | 通过 |
| 浏览器 WebGL/物理/角色 API 2/沙箱、中英文、通知/阅读优先/收件箱、reply 与 goal-progress 不庆祝 | 通过 |
| macOS arm64 原生 Electron 44.7.0：启动、隔离渲染、双向 IPC、角色持久化、关闭 | 通过 |
| 同一 .tgz 经两版官方安装命令、profile loader、真实原生窗口、设置及语言持久化、受控通知适配器、源会话导航、Host 重启与自动启动关闭 | 两版均通过，见 [rc.2](install-0.2.0-rc.2.json) / [alpha.1](install-0.2.1-alpha.1.json) |
| 远端三平台 CI / Linux 和 Windows 原生检查 | 未执行；本次不推送，仅已接入既有六组矩阵 |
| 真实模型质量 / 物理系统通知中心送达和留存 | 未执行，不由受控适配器推断 |事件样本只选择目标、来源消息、工具及回合边界，保留原始 seq 和完整身份，并非整个会话日志；完整回复另保留在 results。所有受控场景都不证明真实模型完成目标的质量，也不证明系统通知中心留存。物理 OS 通知和真实模型验收仍单独保留；没有启动 M2 至 M6。
