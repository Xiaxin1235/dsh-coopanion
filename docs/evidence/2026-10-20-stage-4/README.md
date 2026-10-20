# 第四阶段固定证据副本

原始报告见 `docs/reports/stage-4-20261020.*` 与 `stage-4-semantics-20261020.*`，阶段解释见[归档入口](../../archive/2026-10-aliveness/stage-4/README.md)。本目录仅复制两个报告摘要表列出的 `artifacts/...` 原件，不修改其路径字段、提交、宿主或状态。

[copies.json](copies.json)给出原路径、副本相对路径与 SHA-256；[SHA256SUMS](SHA256SUMS)可从本目录执行 `shasum -a 256 -c SHA256SUMS` 校验。旧报告的 `artifacts/...` 路径在当前工作区保留，在新克隆中按本目录的同名子路径定位。原报告内部的相对链接按原位置解释。

这些是固定本地／受控运行结果，不是当前任务或用户体验验收。默认产品真实通道、真实模型服务、三平台分发、物理多屏和长期观察各需对应验证。普通搜索与安装包排除此目录，追溯使用 `rg --no-ignore docs/evidence/2026-10-20-stage-4`。
