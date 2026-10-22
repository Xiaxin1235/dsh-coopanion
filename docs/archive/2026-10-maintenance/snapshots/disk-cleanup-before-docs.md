# 2026-10-22 项目磁盘清理

本轮仅本地修改，没有提交、推送、合并、发布或日用 Host 安装。基线 `124ff80f44724a8067ab01f710a2bfc213981b81`，分支 `codex/aliveness-foundation`，开始时工作区无修改。已核对现行入口和 D0 状态、Git worktree、Codex 聊天与项目进程；没有进行中的项目阶段验证。其他项目进程／工作区未操作。

## 占用口径

以下为本机 `du -sk` 的 KiB（每 GiB = 1,048,576 KiB），不是宿主实际释放空间。最终复核见本地审计目录的 `after-final.json`。

| 目录 | 清理前 KiB | 清理后 KiB |
| --- | ---: | ---: |
| `.cache` | 9,894,100 | 3,662,220 |
| `artifacts` | 2,388,568 | 831,324 |
| `node_modules` | 457,244 | 457,244 |
| `dist` | 2,848 | 2,848 |
| `.git` | 115,696 | 115,696 |

`.cache` 从约 9.44 GiB 降至 3.49 GiB，净减约 5.94 GiB；`artifacts` 在用户后续授权丢弃旧证据后，从约 2.28 GiB 降至约 0.79 GiB；两目录合计净减约 7.43 GiB。一次性删除清单的目录统计合计 7,091,832 KiB（约 6.76 GiB），此外删除了本轮完善键逻辑时产生并已被新键替代的运行时；新增了一份按最终键重建的共享宿主运行时。没有把同盘移动计为释放：原 npm integrity 下载缓存移入 `.cache/npm-downloads` 继续复用。

同轮 `df -k .` 的宿主 Available 从 161,565,744 KiB 变为 159,753,520 KiB，反而少约 1.73 GiB。因此本轮不能声称宿主已实际释放 6.76 GiB。APFS 存在覆盖清理前数据的 Time Machine 本地快照，且宿主有并行写入；目录删除与底层块释放不可直接等同，不能把全盘变化归因于本任务。未删除／缩减快照。

## 实际删除及恢复来源

22 项删除只落在本项目 `.cache` 下经核验的生成子目录；每项验证真实路径、父级符号链接、Git 非跟踪状态、来源锁摘要和当前使用者。完整逐路径清单见 `.cache/cleanup-20261022/deleted.json`，重做入口默认预览：`python3 .cache/cleanup-20261022/apply.py`，`--apply` 才执行，已删除目录会跳过。

| 范围 | 来源／原使用者 | 核验和恢复 |
| --- | --- | --- |
| `m4/clean`、`m5/clean`、`m5/candidate-{18d3e06,86315bb}/clean`、`m6/clean` 的 `node_modules` | 旧版本 npm ci／Electron 复现 | 父目录源码、Git、shrinkwrap、包及日志均保留；在该保留源码按锁重装及 setup:electron |
| `release-v0.4.9/linux-repro/source/node_modules` | 固定发布源码的 Linux 复现依赖 | 保留完整复现仓库及 shrinkwrap；按原平台重建，当前 macOS 依赖不能替代原 Linux 结果 |
| `m1/runtime-{rc,alpha}`、`work-semantics/runtime-0.2.1-rc.{1,2}` 的 `node_modules` | 四版已发布 DSH 契约测试 | 保留原 package-lock、清理前摘要和 `.cache/runtime-locks/<精确版本>.json`；新 `runtime:host` 可按原锁准备共享运行时 |
| `m1/toolchain/node_modules`、`npm-cache/_npx/538786c08bcb9442/node_modules` | 两份 npm 分发 Node 24.21.0 | 两处 package-lock 保留，当前使用已有 mise Node 24.21.0；可按锁重建，无全局环境修改 |
| `stage-4-doc-cleanup/npm-cache`、`living-integration-npm`、`living-feedback-npm`、`stage5c-npm-pack` 内 `_cacache` | npm pack／构建下载缓存 | 仅删内容寻址下载缓存，保留日志与其他文件；锁内 resolved／integrity 可重新获取 |
| `diagnostics-playwright`、`art-resource-playwright` 内 `chromium-1248`、`chromium_headless_shell-1248`、`ffmpeg-1013` | 各阶段的 Playwright install | 全树核对文件 SHA-256、权限和符号链接，均与保留的 `.cache/playwright` 对应完整目录一致；默认统一复用该处，按锁 setup:browser 可重建 |

首次依赖清理未删除阶段媒体；用户随后明确“以空间为主，不需要保留原始证据”，额外删除 212 个旧 Playwright 录像和 11 张在 Git 证据目录中存在相同字节副本的截图，合计 1,559,364 KiB（约 1.49 GiB）。逐文件摘要／来源与保留前缀见 `media-preview.json`、`media-deleted.json`。保护本轮结果、当前桌面专项／最新反馈目录、文档直接引用的画面。没有删除报告、提示词、素材、许可、固定包、配置或业务存档；Git 中的原始证据未变更。备份／Git bundle／合并备份全部保留；本轮未把未验证备份认定为冗余。`living-preview-20261022` 等既有 profile 内有配置、存档或布局状态，保留完整目录；没有因其进程退出就整目录删除。m2／m3 的包、锁压缩副本、脚本及证据均保留。

## 后续管理改动

使用与策略见[缓存管理](../cache-management.md)。浏览器下载统一复用锁定 revision／平台；宿主缓存键纳入完整锁、精确宿主、Node／ABI、平台／架构、npm 及安装配置／编译输入。插件仍用原规范分发包在独立 profile 安装，既有包／提交／摘要身份断言未移除。

安装验证、空间预览、首页截图及资源观察采用有租约的私有临时目录；正常结束和异常回收，预览取消会传给 Electron 并在退出后回收。强制中断残留通过显式 `cache:clean` 处理：默认预览，超过 24 小时的已退出临时任务和超过 30 天的未引用运行时才可能成为候选；活动使用者、当前选择引用及 `.cache/keep.json` 固定项受保护，未知目录不扫描删除。Windows／进程检查不可用时保守保留。运行时预算 4 GiB、下载缓存预算 1 GiB 是审查阈值，不是强制删除配额；原始证据和备份不自动过期。

## 原始产物覆盖事件与后续授权

首次宿主 UI 回归前未隔离既有脚本的固定输出路径，导致 `artifacts` 顶层 **22 个旧截图／JSON 被本轮测试结果覆盖**。这是本轮操作失误，不能报告为原始证据全部完好。随后停止该轮测试，为 inbox 矩阵改为默认每轮 UUID 目录，并用新目录重跑；没有把这次覆盖包装成清理。

清理前已记录 3,380 个 artifacts／docs/evidence 文件的 SHA-256，在追加媒体删除前复核 22 项不一致；其余匹配。`docs/evidence` 和阶段子目录未出现不一致。另核对 18,902 个保留缓存文件，摘要全部一致。已在仓库及保留缓存中检索匹配副本，未找到上述旧文件对应原字节。

已有 `com.apple.TimeMachine.2026-10-22-133829.local` 快照早于覆盖；尚未读取，不能宣称其副本完整。普通只读挂载被 macOS 拒绝，非交互 sudo 提示需要密码，需用户在本机完成管理员认证，无需向代理提供密码。

用户随后明确以空间优先、不需要保留原始证据，已停止恢复；不再需要管理员挂载，没有待办恢复项。临时空挂载目录已移除；快照及其保留策略未修改。

受影响路径（完整旧摘要见 `protected-before.json`）：

- `artifacts/text-scale-chat-en-US.png`
- `artifacts/home-marker-drag.json`
- `artifacts/npc-life-observe.png`
- `artifacts/inbox-narrow.png`
- `artifacts/text-scale-chat-zh-CN.png`
- `artifacts/session-inbox.png`
- `artifacts/multi-display-ui.json`
- `artifacts/npc-drag-edge-off-10.json`
- `artifacts/npc-drag-initial.json`
- `artifacts/reply-markdown.png`
- `artifacts/reply-markdown-narrow.png`
- `artifacts/npc-drag-edge-off-990.json`
- `artifacts/npc-drag-size.json`
- `artifacts/text-scale-zh-CN-90-1.png`
- `artifacts/npc-drag-edge-quiet-10.json`
- `artifacts/text-scale-inbox-en-US.png`
- `artifacts/text-scale-zh-CN-240-1.png`
- `artifacts/multi-display-reader.png`
- `artifacts/text-scale-inbox-zh-CN.png`
- `artifacts/companionship-invitation.png`
- `artifacts/npc-drag-edge-quiet-990.json`
- `artifacts/npc-drag-intent.json`

## 验证

验证使用已有 Node 24.21.0；共享宿主准备使用项目保留的 npm 11.19.1。结果与原始日志在 `.cache/cleanup-20261022`，新可见结果在 `artifacts/cache-cleanup-20261022`。

- 7 项缓存测试通过：越界／符号链接、活动所有者及残留使用者、固定保留、运行时引用、预览不写入、重复执行和真实键输入变化；纳入 npm test。
- `build`、`typecheck`、`verify:metadata`、`git diff --check` 通过。
- 49 个 Vitest 文件串行通过，518 项通过／1 项跳过。默认并行两次分别遇到 diagnostics 期限与 figures 5 秒超时；保留失败日志，没有放宽超时或改断言。11 项 release/client 与 1 项 locale/client 独立通过。
- DSH 0.2.1-rc.2 完整锁重建成功，真实公开 Host loader 工作语义契约通过；复用两次路径、核心包 inode／mtime 保持，且没有遗留临时目录。其他三版的锁保留，未重跑四版完整安装矩阵。
- 浏览器 setup 再次运行无需下载。完整 `npm run test:inbox-ui` 在独立目录通过，覆盖全部矩阵（包括 9 项生活装配）；macOS 沙箱内首轮启动被终止，最终使用隔离 profile 在宿主权限下完成。
- 隔离 Electron 空间预览启动／取消后 profile 已删除；这只是自动化生命周期检查，不等于物理多屏、真实模型、长期资源或用户体验验收。
- 项目清理入口预览、apply 及重复调用安全，当前候选为零。
