# 官方宿主依赖发布缺口

> 历史快照：形成于 2026-10-16，归档于 2026-10-19。下文的候选、发布进度、未完成项和操作只描述当时记录；当前工作以用户请求和现行契约为准。

2026-10-16，发布 run [38902873948](https://github.com/takboo/dsh-coopanion/actions/runs/38902873948) attempt 3。三平台测试已通过，但六组安装均在准备官方 DSH 宿主时失败，尚未加载插件：`ETARGET: No matching version found for @deepseek-ai/schemastery@~3.18.5`。npm 与 GitHub Release job 因门禁失败而跳过。

注册表显示 `cordis-plugin-loader@1.0.6` 于 13:39:29 UTC 发布，依赖 `schemastery@~3.18.5`；`cordis@4.0.5` 于 13:40:49 UTC 发布，亦要求该范围。两版官方宿主的传递依赖范围会选到这些新版本。13:48:22 UTC 对稳定版 `schemastery@3.18.5` 的独立请求仍为 404；存在的 `3.18.5-alpha.1/alpha.2` 不满足稳定范围。

原始官方 npm 元数据／缺失版本响应按原字节保留于[原证据目录](../../evidence/releases/v0.4.10/upstream-dependency-20261016/)，固定来源、范围和阶段见 [validation.json](../../evidence/releases/v0.4.10/upstream-dependency-20261016/validation.json)，摘要见 [SHA256SUMS](../../evidence/releases/v0.4.10/upstream-dependency-20261016/SHA256SUMS)。这是带时间的外部状态记录；后续修复需要新记录，不能改写原响应。未用改依赖、替换宿主或放宽检查使发布通过。本机已安装的固定包和周末采集继续保留；标签存在不等于已发布。

## 同日恢复查询

13:51:24–25 UTC，`schemastery@3.18.5` 和 `cosmokit@1.8.6` 的官方端点均返回 200；新响应另存，不覆盖此前 404／元数据快照。已在原发布 run 中仅重跑六组失败安装及其下游步骤，复用通过的三平台测试，规范包不变。该时刻尚未完成发布；最终结果另见版本交付记录。
