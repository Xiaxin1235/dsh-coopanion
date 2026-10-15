# 多屏几何契约（M5）

支持 DSH 0.2.0-rc.2 / 0.2.1-alpha.1。一个透明原生窗口只覆盖一块显示器的 workArea；不使用所有屏幕的包围矩形，任务栏、菜单栏、负坐标、上下错位与工作区空洞不成为角色活动区域。保留 API 2 角色 frame、现有物理系统及脚本沙箱。

## 坐标与原生归属

Electron 44 的 `screen.getAllDisplays().workArea`、`getCursorScreenPoint()`、`BrowserWindow.setBounds/getContentBounds` 均以桌面全局 DIP 为单位。Renderer viewport、角色 bounds / layout / hit、指针 clientX/Y、面板锚点均以窗口本地 CSS 像素为单位。默认页面缩放 1 下，一 DIP 对应一 CSS 像素；`scaleFactor` / `devicePixelRatio` 表示栅格比例，不再次乘到窗口或角色坐标上。原生 cursor 减去**实际 contentBounds** 的原点后按 viewport 与 contentBounds 尺寸比换算，避免使用 DOM screen.availLeft 或全局 DIP × DPR。

Windows 的物理输入工具必须使用 Electron `screen.dipToScreenPoint`，不能把多屏全局 DIP 原点乘目标屏比例；macOS CoreGraphics 光标使用逻辑全局点；Linux X11 输入应按 Electron 转换（Wayland 的光标查询/转换能力未声明支持）。隔离测试 profile 只有同时启用测试沙箱参数与 debug port 时才加载只读坐标探针，preload 通过额外启动参数开放测试测量；普通安装及角色 frame 均没有该入口。不添加强制设备缩放参数。混合 DPI 的真实转换和点击必须另列原生实测，受控比例不能代替物理显示器。

原生归属记录完整显示器 ID。布局变化优先保留仍存在的当前 ID；移除当前屏后，从旧工作区中心选择最近有效 workArea，同距保持稳定。新增、移除其他屏不移动当前窗口；workArea / bounds / scaleFactor / rotation 更新重新核对当前屏与实际内容矩形。任务栏条带与布局空洞按到各 workArea 的距离选择，不能按所有屏幕包围盒命中。

拖拽松手发出本地 `move-display`，主进程从真实原生光标选择目标，覆盖左右、上下与错位屏。托盘提供按显示器标签及 ID 的显式切屏入口，隐藏时切屏不改变显示意图；不依赖拖拽跨过空洞。显示器 ID 只在本进程保留，不新增持久配置。自由跨屏漫游、抛掷与贴边休息不在本项范围。

## 跨层消息与状态

Main → Renderer 使用同包消息 `display-changed { revision, displayId, workArea, contentBounds, scaleFactor }`；revision 在本代单调增加，初始化完成后补发最新状态。`cursor { x, y, revision }` 中 x/y 是该 contentBounds 内的 DIP，只有匹配 revision 的消息参与命中测试。Renderer 依据实际 viewport 做本地换算，丢弃旧几何和旧 cursor；不复用变更前的 stationary cursor / hit-state。

窗口 resize 与显示消息可先后到达。只用当前实际 viewport 更新角色 bounds，角色异步返回新 frame 后重置面板锚点；跨屏按先前水平比例放回新工作区地面，当前屏缩放或工作区调整只夹入新 bounds，不启动新角色。几何变化打断正在拖拽的角色时，释放本地指针捕获，等新 bounds 到达后用 API 2 的 drop 直接安全落地，不先 pointer(cancel) 生成 throw；避免上游 place 在 drag 下被忽略而留下屏外命中区。已经松手的空中角色沿原物理系统在新 bounds 内落地，不扩展跨屏抛掷。面板按实际尺寸夹入 viewport，保留文字三档和长代码/表格的滚动。

切屏与布局变化只更新几何，不重建 Renderer、角色 frame 或正文，不调用内容 render；保留捕获阅读 DOM/正文、滚动像素偏移、草稿、焦点/选择、在途请求身份与气泡时钟，不增加 read/select/chat。不改变 M1 完成语义、M2 准入去重、M3 generation/visibilityRevision 和恢复基线、M4 文字配置；崩溃后的临时状态丢失边界保持。

## 验证边界

实施基线与进入条件保留在 [M5 历史记录](evidence/m5/README.md)。后续发布 CI 状态见[文档索引](README.md)；物理多屏及混合 DPI 仍需独立验收。

进入复现见 [baseline-reproduction.json](evidence/m5/baseline-reproduction.json)：上方竖屏松手未触发旧水平判断；混合缩放负原点暴露旧 Windows 测试光标的全局乘比错误。当时原生验证环境为 macOS arm64 / Electron 44.7.0，实际 screen 清单与 DPR 在原生报告中记录；物理多屏和混合 DPI 尚无验收证据。

纯几何及原生控制器注入布局测试在 `npm test` 中运行；浏览器覆盖不规则布局、混合 DPR、状态保持与命中；原生/正式安装入口核对当前实际 screen、窗口、viewport、文字放大后点击及布局更新。三平台和两宿主六组 CI 矩阵沿用这些入口。Electron 坐标定义参见[官方 screen 文档](https://www.electronjs.org/docs/latest/api/screen)，并已与本地 Electron 44.7.0 声明及本机测量核对。完整提交、包摘要、执行范围与剩余边界见 [M5 证据](evidence/m5/README.md)。
