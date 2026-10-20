# 潮汐小院：空间与连续动作预览

单屏同地图制作预览，复用 180px 主配色角色与 40px O03。第 2 期二维运动、第 3 期连续动作及两轮花箱修正均已获用户验收。当前授权与下一阶段从[开发状态](../../../aliveness-development.md)进入；模型见[空间契约](../../living-space-contract.md)，动作见[连续动作契约](../../continuous-action-contract.md)。

## 启动

```bash
node docs/design/art-workflow/o03-shell-hands-v1/prepare-model.mjs --check
PORT=4189 node docs/design/art-workflow/preview-art-workflow.mjs
```

已有 4189 服务直接复用。布局只保存在当前页，刷新会恢复初值；保护用户未导出的布局，复现与测试另开隔离页面。根路径仍进入第 2 期页面，第 3 期使用下方显式入口。

## 第 3 期：连续动作与物件

打开[第三阶段页面](http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?stage=3)。

1. 点空地或“走到岗位”进行真实 x/y 行走。路线卡区分直达、绕行和当前模型下不可达，列出冲突对象／段号／包络。实体按完整宽度的有限地面占用绕行，内容禁区与边界按完整身体避让；立面参与纵深遮挡。
2. “坐下”后按“拿起”或“重复拿放”：从当前姿态起身，实际走近、停稳、转身，手壳稳定接触并闭合后拿起。
3. 选择“贝壳落点”编辑 X / Y，再按“放下”：持物二维行走、接触落点、张手、收手并起身。地面贝壳也有独立 x/y，待机／坐姿时可编辑；手中物件不允许外部脱离。
4. “暂停／继续”保留实际位置、姿态、开合、拥有权与提交计数。直接拖动角色先暂停，body 按同一模型检查连续拖动段，松手／取消停在最后合法根；继续从实际位置核对目标并重规划。
5. 修改实体／落点会修订几何并暂停动作；“复位动作”、数值试摆角色和“恢复样板”是显式重置。选择对象本身不重置计数。显隐区域／锚点／边界只影响查看，导出 `schema:3` 标明模式和几何。

正常速度、慢放、暂停／继续及非行走阶段逐帧均可操作。抵达与接触取实际身体和手部结果，耗时不替代成功。

### 第 3 期花箱反馈复现

- [花箱原位 `(580,528)`](http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?stage=3&layout=stage-3-feedback-20261020)：点击“走到岗位”验证绕行。
- [花箱移至 `(558,252)`，角色位于岗位](http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?stage=3&layout=stage-3-feedback-moved-20261020)：点击“拿起”，再选择落点并放下。

花箱／角色坐标读取自用户截图控件；北柱 y=18 根据 564px 门槛间隙推算，贝壳约 x=335/y=450，属于明确标注的截图重建，非用户导出的精确布局。原图、修复前失败、邻近纵深回归与最终结果见[第 3 期归档](../../../archive/2026-10-aliveness/stage-3/README.md)。

## 隔离原生与定向回归

保持服务运行，在临时 profile 打开第 3 期：

```bash
DSH_SPACE_STAGE=3 node scripts/space-desktop.mjs
```

退出自动清理，不改日用安装。地图默认可操作；开启“桌面穿透”后仅实际 body 命中范围收取输入，Escape 关闭穿透并取消／暂停。预览不连接真实 Harness，不读取其他应用，也未接入产品自主生活／工作协调。

```bash
node node_modules/vitest/vitest.mjs run tests/space-action.test.js tests/space-feedback.test.js
SPACE_EVIDENCE_DIR=artifacts/stage-3-new node tests/space-action-ui.mjs
SPACE_EVIDENCE_DIR=artifacts/stage-3-native-new node tests/space-action-ui.mjs --native
SPACE_EVIDENCE_DIR=artifacts/stage-3-feedback-new node tests/space-feedback-ui.mjs
SPACE_EVIDENCE_DIR=artifacts/stage-3-feedback-native-new node tests/space-feedback-ui.mjs --native
SPACE_EVIDENCE_DIR=artifacts/stage-3-showcase-new node tests/space-action-showcase.mjs
```

每轮使用新的输出目录，原生桌面操作串行。证据绑定实际源码 SHA-256、提交和运行时；受控 suspend、自动矩阵、物理设备与用户观感分别报告。完整工程门槛按[开发指南](../../../development.md)，NPC 变更包含 `test:inbox-ui`。

栅格 PNG 经内存位图解码并同帧合成，绘制／丢弃后释放；内部 SVG 使用可回收短 Blob URL。动态 PNG 的长 `data:` URL 会使原生调试通道积压，相关回归保留在 `tests/space-native.mjs` 与 `tests/upstream-motion.test.js`。

## 第 2 期兼容入口与历史追溯

无参数的[原空间页面](http://127.0.0.1:4189/)保留第 2 期：真实二维导航与水平 O03 拿放分开，离开操作平面后用“复位动作”返回拿放故事；导出为 `schema:2`。`node scripts/space-desktop.mjs` 打开该模式的隔离原生预览。指定[花箱 570/515 布局](http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?layout=flowerbox-570-515)可另开复现旧反馈。

旧模式定向入口为 `tests/navigation-ui.mjs`、`tests/flowerbox-detour-ui.mjs`、`tests/space-preview-ui.mjs`、`tests/space-native.mjs` 与 `tests/navigation-showcase.mjs`；均支持新的 `SPACE_EVIDENCE_DIR`。O03 像素与反向拿放另见[工作台](../o03-shell-hands-v1/README.md)。

第 1 期[固定验证总表](evidence/validation.json)与[真实样片](evidence/showcase/space-showcase.webm)、四类 SVG 的[来源表](assets/source.json)保留原字节。历史模型、验证数量和过程从[阶段归档](../../../archive/2026-10-aliveness/README.md)追溯，不覆盖后续源码或当前验收。
