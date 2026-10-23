# D1 方向工作台：暂停制作，保留复现

**2026-10-23 原路线暂停，角色一致性未通过。** 当前拆件、模型与校准继续保留供产品来源检查和失败复现；没有新的美术放行或导出授权。当前决定见[开发状态](../../../aliveness-development.md)。

[历史工作台](index.html)可切换实际网格、原设计图、叠加、原位静态拼合、慢放和逐帧。时间归零仍含默认形变；“原位静态拼合”才关闭动画及静态补偿。查看与技术通过均不证明设计一致性。

原操作说明、文件来源、许可边界及 C04–C07 过程按原字节保存在[快照](../../../archive/2026-10-aliveness/route-review-20261023/snapshots/docs/design/art-workflow/d1-directions-v1/README.md)。`source/`、`model.json`、`prepare-model.mjs` 与 `product-export.json` 等保持原位，仍被导出脚本或回归引用。没有重新整理／重绘纹理内容；历史 `selected` 字段不能代表用户已接受。

复现检查：

```bash
node docs/design/art-workflow/d1-directions-v1/inspect-atlases.mjs --check
node docs/design/art-workflow/d1-directions-v1/prepare-model.mjs --check
node scripts/export-direction-art.mjs --check
DIRECTION_EVIDENCE_DIR=artifacts/runs/<新目录> node tests/direction-art-ui.mjs
```

原生检查仅在已核对源码的 [macOS VM](../../../macos-vm-testing.md) 内串行运行。固定资源摘要见[素材台账](../../../archive/2026-10-aliveness/route-review-20261023/assets.json)，本次整理没有重跑产品或原生验收。
