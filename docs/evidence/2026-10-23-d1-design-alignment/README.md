# D1 设计一致性固定证据

这是 2026-10-23 的历史证据，不是当前任务或授权。结论、源码与包身份见[报告](../../reports/d1-design-alignment-20261023.md)，[可叠加对照](compare.html)展示同脚底与全身高度下的真实网格。

- `baseline-*`：旧实际身体及修正脚底横坐标后的有效轮廓基线。
- `design-*`：用户设计按公共坐标绘制的固定对照；`user-render-*` 为用户提供的实际画面原字节。
- `final-authoring/`、`final-product/`：`50bcfec` 干净源码的浏览器截图、检查结果与源码摘要。
- `vm-authoring/`、`vm-product/`、`vm-living/`：同提交的隔离 macOS VM 结果；完整录像和其他尺寸截图保留在本轮 artifacts。
- `run-identity.json`：整体校准、重制素材、源码打包修复三个提交的边界。最后两文件增量不会改变 `50bcfec` 的角色渲染。
- `faithful-full-test*.log` 保留源码打包超时；`source-download-timing.log` 是诊断计时，不是放宽后的验收。最终全套通过日志为 `final-full-test-clean.log`。
- `faithful-inbox-ui.log`：完整 UI 通过；`verified-vm-source.log`：VM `a76f53b` 源码下载增量通过；`vm-final-state.log`：关机前源码与正常关机记录。
- `verification.json` 为最终包核验元数据，保持原字节；本证据集合另由 `EVIDENCE-SHA256SUMS` 覆盖。

完整生成提示词、所有候选、选用图、参考原图与摘要保存在制作源 `docs/design/art-workflow/d1-directions-v1/source/`；没有重写原始素材或旧报告。普通检索和安装包排除此证据目录。

本轮额外只读对照服务为 `http://127.0.0.1:4190/compare.html`（当时 PID 29701），只提供本证据目录；原 4189 制作服务未重启。服务不在时可从仓库根目录运行 `python3 -m http.server 4190 --bind 127.0.0.1 --directory docs/evidence/2026-10-23-d1-design-alignment`。先检查端口，勿覆盖其他服务；本段是复现说明，不是未来自动启动指令。
