# D1 美术反馈修订证据

对应[固定报告](../../reports/d1-visual-feedback-20261023.md)及实现提交 `87ca3e7`。本目录是结果追溯，不是当前任务入口。

- `before-*.png`：更改前从原制作台捕获的实际网格帧；不是用户附件的复制。
- `front.png`／`backRight.png`：固定提交的制作台中性帧；生产中性帧另存 `production-neutral.png`，由实际产品工厂绘制。
- `authoring-*.json`／`product-*.json`：浏览器与 VM 的版本、源码摘要及检查范围；`living-native.json` 是默认主页面受控事实／真实 IPC 结果。
- `source.json`：运行文件身份以及未改动原稿摘要。完整生成提示词和原图在制作源目录，候选不覆盖。
- `capture-production.mjs`：保留当时捕获脚本原字节；原执行位置为 `artifacts/runs/d1-visual-20261023/`，相对 import 按该位置解释，不从本证据目录直接执行。
- 本地视频、多尺寸截图、打包初次失败／重试日志与包在 `artifacts/runs/d1-visual-20261023/`；未将这些路径视为分发内容。`SHA256SUMS` 核对本目录固定证据。

自动化和视觉复核不代表用户认可新比例；其他平台与物理设备不由 macOS VM 代签。
