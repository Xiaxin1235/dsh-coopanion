# 接手入口

开始仓库工作时先读 [docs/README.md](docs/README.md)，按任务读取对应契约。版本、依赖和命令以 `package.json`、`npm-shrinkwrap.json` 及 `.github/workflows/` 为准，当前执行范围来自用户。

- 产品行为变更同步实现、测试和使用说明；完成语义由 `src/completion.ts` 共享判断，会话接受回执与任务完成分别结算。
- 浏览器回复、收件箱、字号、多屏或 NPC 日常的变更包含 `test:inbox-ui`。原生窗口和安装使用隔离 profile，系统桌面操作串行执行。自动化矩阵与物理实机验收分别报告。
- 诊断和资源观察按 [诊断契约](docs/diagnostics-contract.md) 解释有效时间、缺口和报告状态；进程存活本身不证明自主活动可用。
- 发布前读 [发布流程](docs/releasing.md)，保持同一分发包贯穿安装、npm 和 Release；本地构建或安装成功分别记录，不能代替发布成功。
- 生活感功能接手、继续实施或调整范围，先读 [当前开发状态](docs/aliveness-development.md)；后续在 `codex/aliveness-foundation` 开发，合并主分支或发布以用户后续指令为准。
- 设计讨论从 [设计草稿](docs/design/README.md)进入；追溯旧讨论和采样结果分别查 [归档](docs/archive/README.md)与 [观察报告](docs/reports/README.md)。这些目录按需显式检索，方案、历史阶段与固定版本结果各按其状态解释。
- `docs/evidence/` 只用于追溯提交、复现旧问题或核对原始证据；先读其 [说明](docs/evidence/README.md)，用 `rg --no-ignore docs/evidence` 显式检索。报告、日志、截图、摘要及第三方许可保留原字节，新验证绑定实际提交、宿主版本和包摘要。
- `.cache/`、`artifacts/`、`dist/` 和 `node_modules/` 是本机或生成内容，使用前核对来源与实际源码。
