# 本地缓存与临时产物

仅管理本仓库生成内容；不触碰全局 npm／Playwright／Electron 缓存、其他工作区、日用 Host、凭据、Git 历史。原始证据按当前用户授权单独核验，清理器不会自动删除。旧 `.cache` 同时有备份和报告，不能整目录删除。

## 运行时复用

- `npm run setup:browser` 安装 shrinkwrap 所锁定 Playwright 的 Chromium；Linux CI 用 `npm run setup:browser -- --with-deps`。浏览器测试、截图及采样统一经 `scripts/lib/playwright.mjs` 默认使用 `.cache/playwright`，由 Playwright 的浏览器 revision／平台选择目录。允许显式 `PLAYWRIGHT_BROWSERS_PATH`、既有 `CHROMIUM_PATH` 覆盖；不要向每个阶段复制浏览器。浏览器升级后先验证新 revision，再人工核对旧 revision 的使用者与引用；清理器不自动删除浏览器。
- `npm run runtime:host -- --version 0.2.1-rc.2` 准备共享宿主运行时。首次解析精确宿主版本并保留 `.cache/runtime-locks/<版本>.json`；此后 `npm ci` 消费完整锁，npm 下载统一存入 `.cache/npm-downloads`。也可用 `--lock <保留的 package-lock.json>` 显式复现。刷新依赖应先保留旧锁及其摘要，再提供新锁，不能悄悄重解析历史环境。
- 运行时目录键包含宿主版本、完整锁摘要、Node 版本／ABI、平台／架构、npm 版本、影响安装的 npm 配置和编译环境。源码／包摘要不放进宿主运行时键，因为插件仍由每次隔离 profile 的真实 loader 安装；规范 `.tgz`、校验和、来源提交的现有核对继续执行。共享目录只用于执行宿主，不在其中安装插件或修改依赖。
- `npm run test:install` 默认复用运行时，每次新建 `.cache/tmp/install-<UUID>` 的 home、profile 和存档；`DSH_TEST_RUNTIME_LOCK` 可指定锁，`DSH_TEST_RUNTIME` 可继续提供外部预备运行时。显式外部运行时由调用者管理生命周期，不纳入本清理器。

锁文件保证恢复输入身份，缓存命中不代表安装／功能测试通过。新宿主、Node、平台及 npm 安装策略仍需实际验证；本机结果不代替三平台与真实模型矩阵。

## 临时目录与证据

安装、空间桌面预览、首页截图和 Linux 资源观察使用 `.cache/tmp/<用途>-<UUID>`；租约记录父进程、创建时间和共享运行时引用。正常结束与异常抛出走清理；预览的取消信号转交 Electron，退出后清理。硬终止可能留下目录，由下次显式回收检查。资源观察的包、日志、采样、摘要、截图仍写在指定的新输出目录，安装 profile／依赖工作区结束后删除。Xvfb 启动日志仍按观察脚本独立保留，用于失败诊断。

`test:inbox-ui` 各入口默认把新截图／JSON 写到 `artifacts/runs/<时间>-<UUID>`，不会覆盖顶层旧结果；可指定 `DSH_TEST_ARTIFACTS=<本轮新目录>` 汇总，生活／陪伴专用 `LIVING_EVIDENCE_DIR`、`COMPANION_EVIDENCE_DIR` 仍优先。显式输出目录由调用者保证全新。其他定向验证仍按各自已有证据参数指定新目录；截图、录像、报告、提示词、素材与许可不自动到期删除。

## 可预览回收与保留策略

```bash
npm run cache:clean                 # 只预览
npm run cache:clean -- --apply       # 每项删除前重新核对租约／引用／固定保留
npm run test:cache                  # 边界和保留回归
```

自动候选仅限具有本工具有效元数据的 `.cache/tmp`、`.cache/runtimes`。未知／旧目录不会因名称或年龄成为候选。临时目录至少保留 24 小时，且所有者必须已退出、没有活动使用者；运行时最后使用超过 30 天，且没有租约、当前选择引用或固定保留才可回收。`.cache/runtime-refs` 保留每个宿主版本／平台／架构当前选定的运行时；旧键可过期，完整依赖锁始终保留用于重建。

`.cache/keep.json` 可写相对路径数组，如 `["tmp/待诊断目录", "runtimes/固定键"]`，会同时保护其父子关系。损坏元数据、符号链接边界或无法可靠检查进程时保守拒绝清理。Unix 同时检查命令行路径与打开文件／工作目录，以保护父进程已死的残留浏览器；Windows 当前不自动判定闲置，保留候选直至人工核验。支持的回收操作重复执行安全，不跟随内部符号链接删除外部目标。

容量规划：当前浏览器完整 Chromium＋headless＋ffmpeg 一套约 0.6 GiB；四个支持宿主通常各约 0.5–0.9 GiB，运行时建议预算 4 GiB、npm 下载缓存建议预算 1 GiB。超过预算先预览和审查引用，不为满足容量强删当前选定运行时或证据。每次阶段结束／取消后按需运行回收；没有后台定时删除。原始阶段证据、备份和固定分发包无自动保留期限，需要单独核对完整副本及恢复用途后再清理。

固定清理结果与验证边界见[2026-10-22 清理报告](reports/disk-cleanup-20261022.md)。该次用户授权丢弃部分旧本地产物，已完成且不形成后续任务；本页只维护现行工具用法与默认保留策略。
