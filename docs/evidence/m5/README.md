# M5 多屏适配：实现与本地验证

日期：2026-10-15。产品保持 v0.4.8；从 M4 本地验收 `74fa3d0643652a1a8ff314ffa6b7e6280071c3b8` 继续。实现验证进行中，固定实现提交后的干净 checkout 检查与同包两版正式安装报告将在验收提交补齐；未推送、打标签或发布，M6 未启动。

共享坐标、原生显示器身份与状态规则见[多屏契约](../../multi-display-contract.md)。M1–M4 的实现/验收保留在祖先链中；维护者审阅、远端 CI 和其他平台仍待验收，M3 三平台退出条件未满足。用户明确授权继续 M5，因此先固定复现及原生环境后推进实现。

基线复现：[baseline-reproduction.json](baseline-reproduction.json)，重复命令 `node docs/evidence/m5/reproduce-baseline.mjs`。脚本固定读取 M4 基线源文件，核对旧水平判断及 Windows helper 原公式，再用上方竖屏/负原点混合缩放模型重放。该受控模型不证明实际 Windows 转换或物理多屏结果。

当前原生环境：macOS arm64、Electron 44.7.0，一块 P272U PRO，workArea `{x:0,y:25,width:2048,height:1127}` DIP、scaleFactor 2。原生检查同时保存实际清单、窗口和 viewport、DPR、OS 光标、CDP 点击及单块真实屏幕内的受控工作区。受控 workArea / scaleFactor / rotation 元数据由测试 screen adapter 注入，真实 BrowserWindow / Renderer / 沙箱 frame 和 OS 光标仍运行；物理 DPR 不因注入元数据变化。

验证入口：`npm test`（纯几何及原生控制器），`npm run test:inbox-ui`（不规则布局、DPR 1/1.5/2 emulation、状态与命中），`npm run test:desktop`（既有原生恢复、12 组文字组合和 M5 原生受控工作区），`npm run test:install`（两个实际 Host 的同包安装、六组字号/尺寸测量及点击）。既有三平台及两宿主六组 CI 矩阵沿用入口并上传 multi-display JSON/截图；本轮不运行远端 CI。

物理多屏、物理混合 DPI、Linux/Windows 原生、物理锁屏/睡眠、真实模型和 OS 通知中心送达/留存仍待验收。M5 交付只覆盖切屏、有效工作区恢复和面板/点击，不扩展自由跨屏漫游、抛掷或贴边休息；不启动 M6。
