# 接手入口

开始仓库工作时先读 [docs/README.md](docs/README.md)，按任务读取其中的现行契约。版本、依赖和可执行命令以 `package.json`、`npm-shrinkwrap.json` 及 `.github/workflows/` 为准。

- 产品行为变更先核对对应契约，再同步实现、测试和使用说明；完成语义由 `src/completion.ts` 共享判断，会话接受回执与任务完成分别结算。
- `docs/archive/` 和 `docs/evidence/` 是历史资料。只在追溯提交、复现旧问题或核对证据时读取；其中的“下一步”、分工、阶段范围和本机绝对路径只描述当时环境。当前任务范围来自用户，本地缓存和旧会话记忆需与当前源码及文档索引复核。
- 原始报告、日志、截图、摘要及第三方许可保留原字节。新增验证使用新的记录，绑定实际提交、宿主版本和包摘要；对后续结果的说明写入索引或新记录。
- 普通检索由 `.ignore` 隔离历史资料；追溯时使用 `rg --no-ignore docs/archive docs/evidence`。`.cache/`、`artifacts/`、`dist/`、`node_modules/` 是本机或生成内容，不作为当前计划或状态来源。
- 验证按改动选择现有入口；涉及浏览器回复、收件箱、字号、多屏或日常节奏时包含 `test:inbox-ui`。原生窗口和正式安装使用隔离 profile，系统桌面操作串行执行。CI 的三平台与两版宿主矩阵、物理实机验收分别报告。
- 发布操作前读 [docs/releasing.md](docs/releasing.md)，保持同一分发包贯穿安装、npm 和 Release。新的文档整理或本地构建不改变已发布产物身份。
