# D1 方向资源：暂停与保留

**多方向美术未通过，制作与新增导出暂停。** 当前状态见[开发入口](../aliveness-development.md)。C01–C07、R01–R05、旧候选的选择字段及接入步骤只解释历史过程，不作为继续生产的授权。

原资源表、尺度、绑定与产品接入门槛保存在[原字节快照](../archive/2026-10-aliveness/route-review-20261023/snapshots/docs/design/d1-direction-assets.md)。按实际引用关系保留：

| 路径 | 保留原因 |
|---|---|
| `web/upstream/whale/directions/` | 默认产品仍加载的固定纹理、模型和来源信息；本次未回滚运行行为 |
| `docs/design/art-workflow/d1-directions-v1/` | 上述产物的输入、校准、导出检查和缺陷复现；原始 PNG／提示词／来源清单保持字节 |
| `docs/design/art-workflow/d1-turnaround-v1/` | 未锁定的多方向原画、参考与尾巴研究；没有新稿进入产品 |

逐文件摘要见[素材台账](../archive/2026-10-aliveness/route-review-20261023/assets.json)。生产中保留资源不代表美术认可；重新选择表现路线后再决定替换或退役范围。

只读一致性检查仍可使用 `node scripts/export-direction-art.mjs --check`。方向与转面制作页仅作诊断，使用方式见各自 README；原生检查遵循[macOS VM 规则](../macos-vm-testing.md)。
