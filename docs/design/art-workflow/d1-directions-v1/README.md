# D1 身体方向制作样片

本轮需求见[资源表](../../d1-direction-assets.md)，交付状态以[开发入口](../../../aliveness-development.md)为准。此目录是素材与绑定源稿，不是默认产品角色包。**正面、背面、右斜后三组已制成可操作网格样片；六方向连续转身与产品接入尚未完成。**

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

制作台提供 90／180／240px、透明格／白／深色背景、站立、空手步态、肩部重叠检查、正常／0.25 倍、暂停、逐帧和重放。左栏是现有身体的固定真实渲染参考，其余三栏是实际 `web/upstream/kit/rig.js` 网格；不会播放整张故事图片。前视眼、眉、嘴复用原分层纹理，眨眼／视线独立于身体；本轮未补齐原模型全部表情。

## 文件与来源

- `source/reference.png`：从当前原模型中性姿态直接渲染的参考，不是新增角色设计；原文件摘要在 `source/manifest.json`。
- `source/*-master-v1.png`：内置 image_gen 生成的三个母版；原字节保留。
- `source/*-atlas-v*.png`：内置 image_gen 拆件与修订；每个版本保留。选用前／后／右斜后 v2，其余 v1 为被替代候选，不能按文件名顺序自动绑定。
- `source/prompt-*.txt`：逐次完整提示词；`source/manifest.json` 记录生成输出 ID、参考链、摘要和候选状态。
- `source/atlas-regions.json`：人工划定部件区域、只读测量得到的可见边界与 UV 裁切区；`inspect-atlases.mjs` 可重新测量或检查。**不改写图像像素**。
- `prepare-model.mjs`：可编辑的部件位置、关节、层级与网格规格；生成 `model.json`。PNG 图集＋JSON 是本项目的分层等价源稿，不是可导入 Cubism 的 PSD，也不是 `.cmo3`／`.moc3` 成品。
- `figure.js`／`scene.js`：复用原网格引擎的独立制作样片；不增加新的产品身体或行为协调器。

原角色：溟月（上善无形）；DeepSeek 女仆二创：ZipZipPipe；原始生成／拆件：Pal-AI-Lab。新方向由内置 OpenAI image_gen 参考原角色制作，继承角色／商标原有权利边界；不声称 AGPL 重新授权这些纹理。完整原声明见[第三方说明](../../../../THIRD_PARTY_NOTICES.md)。新图未替换原 PNG，未加入产品分发资源。

## 制作结果与下一道门槛

结构检查覆盖 25 个身体部件；拼合检查修正了颈部／嘴部落点、尾部层级与相邻图集污染。自动检查可发现透明裁切截断、独立眨眼影响非面部区域、足底原点漂移、步态无关节位移、暂停失效和指定连接点露底；完整边缘观感仍需看实际正常／慢速画面。

当前不足：三个新方向之间的发型／衣摆投影尚不能直接插值为完整转身；左右不对称头饰不应盲目镜像；背面头发目前同一网格内变形，尚未拆出独立鳍／呆毛；持物接触、完整表情和所有配色未校准。后续先做朝向过渡和左侧修订，再接入默认产品同一身体并执行完整 UI、macOS VM 与其他平台验证。不能把本轮资源样片通过写成 D1 或 LIVE 体验完成。
