# 第 1 期：潮汐小院空间样板

单屏编辑预览，复用 180px 主配色角色、40px O03 和连续拿放；新增小窝、信封岗位、珊瑚花箱、门柱与手动内容禁区。阶段状态见[开发入口](../../../aliveness-development.md)，下一项见[第 2 期执行范围](../../aliveness-stage-2.md)。

## 打开与操作

```bash
node docs/design/art-workflow/o03-shell-hands-v1/prepare-model.mjs --check
PORT=4189 node docs/design/art-workflow/preview-art-workflow.mjs
```

打开[本地预览](http://127.0.0.1:4189/)，复用已有服务与页面布局，右上角可进入原 O03。

1. 图层勾选显示分区、固定连接路线、实际脚／手／壳缘与保守边界。
2. 点选／下拉选择对象，拖动或输入 X/Y。角色松手提交位置并复位动作；角色 Y 同步水平操作平面。编辑没有二维行走，选择角色本身不复位。
3. “将花箱移到门槛”演示固定路线冲突，“撤回花箱”恢复。实体隐藏或图层关闭不会取消碰撞。花箱与水平拿放扫过范围冲突时，开始／续接锁定。
4. “重复拿放”执行完整闭环；可改落点反向重复，使用分段拿起／放下、慢放、暂停、继续与非行走阶段逐帧。
5. “导出本次几何”保存当前布局、锚点、包络、判定和修订号。布局只在当前页保留，刷新恢复样板。窄窗口等比缩放；180px 是世界逻辑尺寸。

## 几何判定的适用范围

详细规格见[空间草案](../../living-space-contract.md)。当前仅对固定折线做完整保守矩形包络检查，没有搜索替代路线；“不可通过”应理解为当前路线冲突。实体矩形包含透明留边与阴影，角色包络也比实际轮廓保守，因此不能用该反馈断言实际外形无法经过或整个空间不可达。用户花箱 `(508,261)` 的复现与修订要求见第 2 期文档。

编辑摆放、静态路线与已有水平拿放分别成立，均不代表真正 x/y 导航。绘制单元按深度排序，内部掌部／壳／指尖同帧合成；新增四类素材是直接创作的分层 SVG，需求与来源见[原始需求](assets/design-brief.txt)、[来源表](assets/source.json)。

## 验证与追溯

```bash
node node_modules/vitest/vitest.mjs run tests/space-geometry.test.js tests/hand-art.test.js tests/prop-motion.test.js tests/prop-interaction.test.js
SPACE_EVIDENCE_DIR=artifacts/space-preview-new node tests/space-preview-ui.mjs
```

浏览器检查复用 4189，使用隔离 Chromium；包含空间编辑、真实拖放、两轮拿放、长暂停、导出、实际栅格包络以及旧 O03 像素／44 项动作。每轮指定新输出目录，完整工程检查见[开发指南](../../../development.md)。

第 1 期最终源码 `504c7d4f899ab2afc3e027df3901ee6213e0ae23` 的[验证总表](evidence/validation.json)、[浏览器结果](evidence/final/browser-qa.json)、[接触像素](evidence/final/contact-pixels.json)、[动作回归](evidence/final/legacy-motion.json)和[36.56 秒真实样片](evidence/showcase/space-showcase.webm)保留原字节。总表说明完整产品检查与后续私有工作台复测的边界；本期没有原生、安装、CI 矩阵或物理多屏验收。

初始化、像素回读与长暂停的过程记录按原路径保留在 `evidence/`，仅追溯时读取。[交接前说明](../../../archive/2026-10-aliveness/stage-1-handoff/README.md)保存当时叙述，不能覆盖当前状态。
