# 2026-10-22 项目磁盘清理结果

本报告记录该次本地清理的固定观察，不代表当前磁盘占用、产品阶段验收或后续删除授权。验证来自基线 `124ff80f44724a8067ab01f710a2bfc213981b81` 加缓存治理修改的工作树，不能当作纯基线提交的测试结果。工具用法与保留策略统一见[缓存管理](../cache-management.md)，过程和旧入口的原字节见[维护归档](../archive/2026-10-maintenance/README.md)。

## 占用与实际删除

`du -sk` 的目录统计如下（GiB = 1,048,576 KiB）：

| 目录 | 清理前 KiB | 清理后 KiB |
| --- | ---: | ---: |
| `.cache` | 9,894,100 | 3,662,220 |
| `artifacts` | 2,388,568 | 831,324 |
| `node_modules` | 457,244 | 457,244 |
| `dist` | 2,848 | 2,848 |
| `.git` | 115,696 | 115,696 |

两目录合计净减约 **7.43 GiB**。删除 22 个旧依赖、下载缓存和重复浏览器子目录，原目录统计合计约 6.76 GiB；另删除该次完善键逻辑时被新键替代的临时运行时，新增一份按最终键重建的共享宿主。npm integrity 下载缓存同盘移入共享位置继续复用，不计为空间释放。

| 删除范围（均为本项目生成内容） | 核验／恢复来源 |
| --- | --- |
| `.cache/m4/clean`、`m5/clean`、`m5/candidate-{18d3e06,86315bb}/clean`、`m6/clean` 内 `node_modules` | 保留父目录源码、Git、shrinkwrap、包和日志，可按锁重建 |
| `.cache/release-v0.4.9/linux-repro/source/node_modules` | 保留固定复现源码与锁，按原 Linux 平台重建；macOS 测试不代替原复现 |
| `.cache/m1/runtime-{rc,alpha}`、`work-semantics/runtime-0.2.1-rc.{1,2}` 内 `node_modules` | 保留四版原锁，迁入 `.cache/runtime-locks` 供共享宿主准备使用 |
| `.cache/m1/toolchain/node_modules`、`npm-cache/_npx/538786c08bcb9442/node_modules` | 两份 npm 分发 Node；锁保留，验证使用已有 mise Node 24.21.0 |
| `.cache/stage-4-doc-cleanup/npm-cache`、`living-integration-npm`、`living-feedback-npm`、`stage5c-npm-pack` 内 `_cacache` | 可重新获取的 npm 下载，日志及其他文件保留 |
| `.cache/diagnostics-playwright`、`art-resource-playwright` 内 Chromium／headless／ffmpeg | 完整目录逐文件内容、权限及符号链接与 `.cache/playwright` 保留副本一致 |

用户随后明确空间优先、不再保留旧原始产物，追加删除 212 个旧 Playwright 录像及 11 张在 Git 证据目录有相同字节副本的截图，共约 **1.49 GiB**。保留该次验证、当前桌面专项／最新反馈目录、文档直接引用的画面、报告和固定包。备份、Git bundle、含配置／存档的既有 profile、素材、提示词、许可及 Git 内固定证据均保留。

同期宿主 `df` 的 Available 从 161,565,744 KiB 降至 159,753,520 KiB，少约 1.73 GiB；**不能将目录净减宣称为宿主实际释放空间**。当时有 APFS 本地快照及其他宿主写入，未对全盘变化作单一归因，未删除／缩减快照。

## 管理改动与验证边界

共享浏览器由锁定 Playwright 的 revision／平台选择；宿主缓存键包含完整依赖锁、宿主版本、Node／ABI、平台／架构、npm 与安装输入。profile 每轮独立，原有规范包、来源提交及摘要核对继续执行。临时目录回收保护租约、活动使用者、当前运行时引用和固定保留项。

- `build`、`typecheck`、`verify:metadata` 及缓存边界回归 7 项通过；共享宿主按锁重建、DSH 0.2.1-rc.2 真实 loader 契约与重复复用检查通过。
- 49 个 Vitest 文件串行通过，518 项通过、1 项跳过；11 项 release/client 与 1 项 locale/client 独立通过。默认并行两次分别出现 diagnostics 期限和 figures 5 秒超时，未改断言或放宽时限。
- 完整 `test:inbox-ui` 在独立产物目录通过，包括 9 项生活装配；浏览器沙箱启动失败与宿主权限下的通过分别记录。
- 隔离 Electron 预览退出后临时 profile 已回收；当次回收预览及重复 apply 候选为零。这些是自动化结果，不代替物理多屏、真实模型、长期资源、其他三版完整安装矩阵或用户体验验收。

## 产物覆盖事件已结算

首次 UI 回归沿用固定输出路径，覆盖了 `artifacts` 顶层 22 个旧截图／JSON，不能称为所有原件完好。随后停止该轮运行，改用每轮独立输出目录并完成重跑；该事件不是正常清理。

追加媒体删除前，3,380 个 artifacts／docs/evidence 文件中上述 22 项摘要不一致，其余匹配；18,902 个保留缓存文件摘要一致。用户明确不再保留旧原始产物后终止恢复，无需挂载快照或进行管理员操作，没有遗留恢复任务。详细影响路径和形成时摘要从维护归档及原本机清单追溯。

本机可选日志位于 `.cache/cleanup-20261022`，可见回归位于 `artifacts/cache-cleanup-20261022`；新克隆不要求这些目录存在。一时性的清理、快照恢复与旧阶段路径不作为接手命令。
