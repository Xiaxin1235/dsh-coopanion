# 生活感功能：当前开发状态

生活感分支唯一接手入口。先读[文档索引](README.md)，在 `codex/aliveness-foundation` 工作；执行范围来自用户最新指令，历史“下一步”不构成任务。版本、依赖与命令以 package、shrinkwrap 和工作流为准。

## 当前交付与任务

本分支增量尚未发布。D1 主配色方向身体已接入默认产品，原接入身份见[产品接入报告](reports/d1-direction-product-20261022.md)。2026-10-23 用户指出正面比例、斜后尾钩和露脸问题；最新实现 `87ca3e7` 统一制作台／产品五官校准，并替换斜后头／尾。修订前后画面、固定验证和本地包身份见[美术反馈报告](reports/d1-visual-feedback-20261023.md)。用户随后明确指出设计与实际身体仍不一致；本轮重新校准整体绑定并加入设计叠加对照，正在完成固定验证。此前局部修订与工程接入通过不代表本次设计一致性验收。

| 层次 | 当前交付 | 剩余边界 |
|---|---|---|
| 默认产品平面空间 | `669b27c`：平面拖放、当前支撑上的跳跃／阴影、运行期二维停靠与跨区域返回；行为见[装配契约](design/living-integration-contract.md)，固定验证见[D1 报告](reports/d1-plane-20261022.md) | 停靠尚未跨重启持久化；无真实窗口附着或遮挡 |
| D1 方向身体 | 主配色六方向已接入同一生产身体；真实位移驱动朝向，停止／关注回正面，复用完整表情，独立结饰修订；兼容行为见[装配契约](design/living-integration-contract.md) | 工程接入与回归已完成；坐卧／拿放／手势与其他配色使用原校准模型；用户观感、其他平台原生未结算 |
| 生活／工作／人格／记忆／回应 | 默认产品复用第 4–5C 期共享模块；按各现行契约运行 | 工程接通不等于整体自然度通过 |
| D0 原生窗口探针 | `124ff80`：三平台采集工具和同场景 CI 入口；[固定报告](reports/desktop-environment-d0-20261022.md)记录 macOS 结果 | Windows／X11 未运行；原生 Wayland 覆盖层及资源预算未冻结。D2／D3 窗口互动受其门槛约束 |

方向资源、制作与完成条件见[资源表](design/d1-direction-assets.md)；完整可见验收见[空间与身体复核](design/space-body-review.md)。原 `2737a3e` 用户反馈是问题基线，不能当成新提交仍有相同行为的证明。跨平台路线继续沿用[桌面互动方案](design/desktop-environment-plan.md)，共用身体／导航／协调器，由平台 Adapter 提供事实；第 6／7 期仍为后续候选。

## 验证与运行边界

浏览器验证真实渲染、导航、接触与存档，输入／工作事实受控。macOS 原生操作在[隔离测试机](macos-vm-testing.md)串行运行，现场核对来宾源码和工具链；固定报告与 provisioning 记录不是实时状态。Windows、X11、原生 Wayland、物理多屏／键鼠、真实 Host、长期资源和用户体验分别结算，不用 macOS VM 代签。Linux CI 的 Xvfb＋Openbox 只覆盖其 X11 场景；unknown 输入不代表正向能力可用。

独立产品预览不连接 Harness；正式插件工作元数据经 WorkSources 进入。产品环境信号不含按键正文、桌面截图或前台窗口内容；D0 探针只读取测试所需窗口身份、几何和堆叠元数据。

启动与检查按[开发指南](development.md)。复用 4189 制作服务前核对监听者，保留可能有未导出布局的页面。`.cache/`、`artifacts/`、`dist/` 不作为源码证明；`.local/macos-vm/` 是持久磁盘与身份，按保留规则维护。此前清理与 VM 配置已结束，没有遗留恢复任务。

## 历史入口

[方向制作交付快照](archive/2026-10-aliveness/direction-authoring/README.md)、[阶段历史](archive/2026-10-aliveness/README.md)及[维护归档](archive/2026-10-maintenance/README.md)保留当时的授权与结论；[报告](reports/README.md)和[原始证据](evidence/README.md)按固定身份追溯。第 1–3 期指定工作台的用户验收不外推到默认产品。
