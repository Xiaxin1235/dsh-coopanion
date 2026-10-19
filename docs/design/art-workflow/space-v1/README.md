# 潮汐小院：二维运动与空间预览

单屏同地图预览，复用 180px 主配色角色、40px O03 与连续拿放。本期及花箱绕路修正已获用户验收，当前范围见[开发状态](../../../aliveness-development.md)，模型见[空间契约](../../living-space-contract.md)。原第 1 期证据仍按原字节保留。

## 启动与操作

```bash
node docs/design/art-workflow/o03-shell-hands-v1/prepare-model.mjs --check
PORT=4189 node docs/design/art-workflow/preview-art-workflow.mjs
```

打开[本地预览](http://127.0.0.1:4189/)。已有服务直接复用；不要刷新未导出的摆放，可另开隔离页面。

1. 点选空地或“走到岗位”执行真实 x/y 行走。路线卡区分直达、替代路线与当前地面／完整禁区模型下不可达，并列冲突对象／段号／包络。实体按有限 200×32px 身体占地绕行，内容禁区与边界仍按完整 200×213px 加 12px；立面前后遮挡按地面深度排序。
2. 行走可暂停、继续和取消，连续换目标先制动再重规划。移动花箱会修订几何；运动中拒绝与当前身体重叠的摆放。恢复样板同时重置旧导航目标。
3. 实体可拖动或数值编辑。角色拖动取消旧路线，body 跟随真实指针并按实体占地／完整禁区模型检查连续扫过范围；松手在最后合法根设立水平操作平面，取消不回弹。
4. 导航期间／离开操作平面时禁用原拿放。按“复位动作”返回原故事，再执行两轮反向拿放、慢放、暂停、继续与非行走阶段逐帧。交接仍由实际接触和开合判断。
5. 显隐分区／路径、实际脚／手／壳缘和实体边界；导出带 schema 2、修订、规划与旧固定路线对照的 JSON。布局只保存在当前页；窄窗口统一缩放逻辑世界。

单屏原生入口在同一服务下运行：

```bash
node scripts/space-desktop.mjs
```

它使用临时 profile，退出清理，不改日用安装。地图默认可操作；“桌面穿透”打开后仅角色实际命中范围收取输入，Escape 退出穿透并取消导航。原生不连接 Harness，不自动生活，不读取其他应用。

截图反馈的独立复现入口：[花箱 570/515、角色 186/542、北柱 621/75](http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?layout=flowerbox-570-515)。它在新页面恢复指定布局，不刷新现有未导出编辑；点击“走到岗位”从花箱上方绕行。[阶段归档](../../../archive/2026-10-aliveness/stage-2/README.md)保留原模型遗漏与修正验证。

## 回归与新证据

```bash
node node_modules/vitest/vitest.mjs run tests/navigation.test.js tests/space-geometry.test.js tests/hand-art.test.js tests/prop-motion.test.js tests/prop-interaction.test.js
SPACE_EVIDENCE_DIR=artifacts/flowerbox-new node tests/flowerbox-detour-ui.mjs
SPACE_EVIDENCE_DIR=artifacts/stage-2-ui-new node tests/navigation-ui.mjs
SPACE_EVIDENCE_DIR=artifacts/stage-2-contact-new node tests/space-preview-ui.mjs
SPACE_EVIDENCE_DIR=artifacts/stage-2-native-new node tests/space-native.mjs
SPACE_EVIDENCE_DIR=artifacts/stage-2-showcase-new node tests/navigation-showcase.mjs
```

输出目录每次用新路径。原生桌面测试串行；浏览器录制只录隔离页面。完整工程验证包括 typecheck／build／unit／`test:inbox-ui`，新记录绑定实际源码摘要、提交和宿主版本，见[第 2 期归档](../../../archive/2026-10-aliveness/stage-2/README.md)。当前指定规格的画面与绕路已获用户验收；后续新改动仍需各自验证与观感审阅。

## 历史追溯

第 1 期最终源码 `504c7d4f899ab2afc3e027df3901ee6213e0ae23` 的[验证总表](evidence/validation.json)、[浏览器结果](evidence/final/browser-qa.json)、[接触像素](evidence/final/contact-pixels.json)、[动作回归](evidence/final/legacy-motion.json)和[36.56 秒真实样片](evidence/showcase/space-showcase.webm)原字节保留；它们不覆盖新二维运动或原生验证。

场景四类素材的[来源表](assets/source.json)保持不变。旧阶段文档与本地产物整理过程见[第 1 期交接](../../../archive/2026-10-aliveness/stage-1-handoff/README.md)。
