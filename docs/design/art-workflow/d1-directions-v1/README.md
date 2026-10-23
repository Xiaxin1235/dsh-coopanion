# D1 身体方向制作样片

本轮需求见[资源表](../../d1-direction-assets.md)，交付状态以[开发入口](../../../aliveness-development.md)为准。此目录是素材与绑定源稿，不是默认产品角色包。正面、背面、右斜后三组是独立制作样片；生产使用范围由装配契约定义。

## 查看与复现

复用现有 loopback 制作服务并另开[制作台](http://127.0.0.1:4189/docs/design/art-workflow/d1-directions-v1/index.html)。不要刷新其他制作页中未导出的布局。服务不存在时按[通用流程](../README.md)启动。

```bash
node docs/design/art-workflow/d1-directions-v1/inspect-atlases.mjs --check
node docs/design/art-workflow/d1-directions-v1/prepare-model.mjs --check
node tests/direction-art-ui.mjs
# 以下仅在已核对源码的 macOS VM 中执行：
DSH_MACOS_VM_TEST=1 node tests/direction-art-ui.mjs --native
```

测试默认每轮创建独立目录，也可用 `DIRECTION_EVIDENCE_DIR` 指定**尚不存在**的路径。主机浏览器与 VM 原生分别运行。测试需要已准备的项目 Node、Playwright 和 Electron，不另安装新引擎。制作台不连接真实 Host，也不控制系统鼠标。

制作台提供 90／180／240px、透明格／白／深色背景、站立、空手步态、肩部重叠检查、正常／0.25 倍、暂停、逐帧和重放。左栏是现有身体的固定真实渲染参考，其余三栏是实际 `web/upstream/kit/rig.js` 网格；不会播放整张故事图片。前视眼、眉、嘴复用原分层纹理，眨眼／视线独立于身体；通过 `web/upstream/whale/front-face.js` 与产品共用眼、眉、嘴校准；制作台只演示中性表情和眨眼。

## 文件与来源

- `source/reference.png`：从当前原模型中性姿态直接渲染的参考，不是新增角色设计；原文件摘要在 `source/manifest.json`。
- `source/*-master-v1.png`：内置 image_gen 生成的三个母版；原字节保留。
- `source/*-atlas-v*.png`：内置 image_gen 拆件与修订；每个版本保留。选用前／后／右斜后 v2，其余 v1 为被替代候选，不能按文件名顺序自动绑定。
- `source/prompt-*.txt`：逐次完整提示词；`source/manifest.json` 记录生成输出 ID、参考链、摘要和候选状态。
- `source/atlas-regions.json`：人工划定部件区域、只读测量得到的可见边界与 UV 裁切区；`inspect-atlases.mjs` 可重新测量或检查。**不改写图像像素**。
- `prepare-model.mjs`：可编辑的部件位置、关节、层级与网格规格；生成 `model.json`。PNG 图集＋JSON 是本项目的分层等价源稿，不是可导入 Cubism 的 PSD，也不是 `.cmo3`／`.moc3` 成品。
- `figure.js`／`scene.js`：复用原网格引擎的独立制作样片；不增加新的产品身体或行为协调器。

原角色：溟月（上善无形）；DeepSeek 女仆二创：ZipZipPipe；原始生成／拆件：Pal-AI-Lab。新方向由内置 OpenAI image_gen 参考原角色制作，继承角色／商标原有权利边界；不声称 AGPL 重新授权这些纹理。完整原声明见[第三方说明](../../../../THIRD_PARTY_NOTICES.md)。原图均未覆盖；选用版本的原字节副本与校准数据通过 `scripts/export-direction-art.mjs` 导出到 `web/upstream/whale/directions/`，使用范围见[生活装配契约](../../living-integration-contract.md)。

## 样片的检查范围

结构检查覆盖 25 个身体部件；拼合检查修正了颈部／嘴部落点、尾部层级与相邻图集污染。自动检查可发现透明裁切截断、独立眨眼影响非面部区域、足底原点漂移、步态无关节位移、暂停失效和指定连接点露底；完整边缘观感仍需看实际正常／慢速画面。

本制作页只覆盖三组空手中性姿态，不覆盖完整表情、持物、配色或生产方向过渡。产品接入门槛统一见[资源表](../../d1-direction-assets.md)，不从制作页通过推断默认产品或 LIVE 体验完成。

## 产品导出与补件

`source/back-head-no-bow-v1.png` 与 `product-export.json` 保留 D1-C04 原始来源链。当前由 `visual-revision-v3.json` 明确选择 C05 的 `back-right-repair-v3.png`，仅取头部与尾部 UV；其余拆件仍取原 v2。右斜后侧发遮住脸颊，尾根没有额外回钩。裁切收紧时保留源像素比例和原连接框，不把尾部拉伸回旧高度。制作台和产品共用这套选择及独立蓝金结饰绑定；结饰复用原 `tex/bow.png`。`node scripts/export-direction-art.mjs --check` 校验分发 PNG、静态模型和来源摘要。生产六方向、表情及兼容检查用 `node tests/direction-product-ui.mjs`；`--native` 仅在 VM 中运行。每轮指定新的 `DIRECTION_EVIDENCE_DIR`，默认产品完整循环另由 living-integration 回归覆盖。
