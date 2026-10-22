# D1 方向身体产品接入证据

2026-10-22 固定验证，综合结论见[报告](../../reports/d1-direction-product-20261022.md)。原日志、JSON、PNG、录像均按源文件字节复制；`SHA256SUMS` 核验本目录载荷。不是新任务或实时环境状态。

`source.json` 绑定 `beb4179` 的源码树、宿主及 Node。浏览器方向验证同一提交；首次成功 VM 方向／生活验证为 `7f6cee4`，其产品代码与 `86813ad`、`beb4179` 相同。`package.json` 是本地包身份报告，不是发布凭据。后续 `dd971b8` 只修复原生测试输出路径，产品源文件未变。

`directions.webm` 为生产身体工厂的受控浏览器实录，包含六方向及正常／慢速片段；默认产品真实生活闭环另由 inbox UI 和 VM living 记录，不把工厂控制台当成正式 Host。`vm-directions-initial-failure.log` 保留截图间隔触发生命周期暂停的初次测试失败；修正是测试显式恢复，不改写产品超时保护。

本目录不随安装包分发，不参与普通搜索。原始工作目录为 `artifacts/runs/d1-product-20261022/`，完整 VM 输出保存在其 `vm/` 和后续独立目录中。

`vm-desktop-isolated.log` 和 `native-output-audit.json` 绑定 `dd971b8` 的完整原生回归：50 个新输出，13 个旧固定路径文件未变。产品运行代码与前述候选相同。
