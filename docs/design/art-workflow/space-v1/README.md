# 第 1 期：潮汐小院空间样板

这是生活感分支的单屏编辑预览。复用用户已通过的 DeepSeek 180px 角色、40px O03 和连续拿放；新增小窝、信封岗位、珊瑚花箱、门柱及手动禁区。当前没有发现支撑本期故事必须补绘的关节或手型缺口，原模型、PNG 和提示词保持原字节。

## 打开与操作

```bash
node docs/design/art-workflow/o03-shell-hands-v1/prepare-model.mjs --check
PORT=4189 node docs/design/art-workflow/preview-art-workflow.mjs
```

打开 [空间样板](http://127.0.0.1:4189/)。已有服务时复用，不再另起一个。右上角可以进入原 O03 工作台。

1. 先看左侧小窝和右侧岗位。勾选／取消“空间分区”“连接路线与身体包络”查看场景与规格。
2. 点选或下拉选择对象，拖动或输入 X/Y 摆放。角色在松手后提交编辑，贝壳和落点沿水平平面移动。角色 Y 编辑会一并设置操作平面并复位动作；选择角色本身不复位。摆放没有真实二维行走。
3. 点“将花箱移到门槛”，路线会因整个身体无法通过而阻断；“撤回花箱”恢复。花箱若移到拿放平面上，开始／续接拿放也会锁定。关掉区域图层不取消碰撞。
4. 点“重复拿放”执行一次完整闭环，可再点重复；改落点后可以反向拿放。也支持分开的拿起／放下、0.25× 慢放、暂停、继续与非行走阶段的逐帧。
5. “身体／接触锚点”显示实际脚、手和壳缘；“实体边界／遮挡次序”显示保守实体及避让扩张。人物与物件统一按深度排序，掌部／壳／指尖保持同帧。
6. “导出本次几何”保存当前布局、根和对象规格、包络、路线结果与修订号。刷新后恢复样板，不写入产品设置。

窄窗口会等比缩小画板；180px 是世界逻辑尺寸。要看接触细节可扩大浏览器或使用 O03 工作台的手部放大。

## 资源与几何

四类新素材直接制作成可编辑分层 SVG，源文件就是运行资产，没有调用图像生成。每件需求、配色、尺寸、层级、来源、许可及摘要见 [设计需求原文](assets/design-brief.txt) 和 [来源表](assets/source.json)。原有模型／贝壳／手型来源仍由原 manifest 与第三方声明负责。

详细坐标、实体与锚点、连续线段避让、遮挡及编辑限制见[生活空间契约草案](../../living-space-contract.md)。默认路线约 614px，门槛开口 302px，角色包络 200×213px，连接路线另外预留四周 12px。几何可行只表示该样板的静态空间足够，不能替代下一期 body 内真正二维运动与回执。

## 验证与真实画面

```bash
node node_modules/vitest/vitest.mjs run tests/space-geometry.test.js tests/hand-art.test.js tests/prop-motion.test.js tests/prop-interaction.test.js
node tests/space-preview-ui.mjs
npm run typecheck
npm test
npm run build
npm run test:inbox-ui
```

`space-preview-ui.mjs` 复用 4189 服务，默认写入 `artifacts/space-preview/`；可用 `SPACE_PREVIEW_URL`、`SPACE_EVIDENCE_DIR` 指定本地服务与新的输出目录。它使用隔离 Chromium，检查实体变化、编辑摆放、真实指针拖放、两轮反向拿放、暂停／逐帧、导出、窄窗口、实际身体栅格包络，再检查旧工作台的真实 WebGL 像素与 44 项动作回归。

本轮结果见 [验证记录](evidence/validation.json)、[浏览器结果](evidence/browser-qa.json)、[几何导出](evidence/exported-layout.json)、[像素结果](evidence/contact-pixels.json) 和 [旧工作台动作结果](evidence/legacy-motion.json)。最终空间检查独立运行 `--space-only`，旧工作台的像素与 44 项回归单独留存，两者的来源文件由验证记录绑定。真实画面见 [空间](evidence/space-ready.jpg)、[阻断路线](evidence/space-blocked.jpg)、[锚点](evidence/space-anchors.jpg)、[前景遮挡](evidence/space-occlusion.jpg)、[持物](evidence/space-held.jpg)、[拿放录像](evidence/space-interaction.webm)。这些是本地浏览器工程验收，新的空间观感仍待用户确认。

`evidence/initialization-failure/` 保留首次加载因原工作台长间隔安全暂停而未完成场景初始化的失败原值；现在在唯一时钟启动后显式复位并等待实际帧，再启用编辑。旧 O03 的原始报告与素材未改写。Chrome 156 的像素回读差异及原／新合成器对照见[独立诊断](evidence/pixel-readback/README.md)，检查夹具使用频繁回读上下文，保持原阈值。

本期未接入主产品自动拿放、生活／工作调度、真实二维导航、原生或安装。保留两个意图来源和未来唯一身体协调入口；后续阶段范围以用户指令为准，不合并 main、不推送、不发布。
