# 空间与身体复核前的文档快照

本目录保存 `2737a3ebae40bd1028628aa5cf4e602a362ecb0d` 中以下文档的原始字节。2026-10-22 用户继续体验后指出默认产品仍局限底部、拖高仍下落、只有左右朝向，与 main 的体验差异有限。快照中“装配已完成”和“下一步体验循环”等描述属于反馈前状态，不能作为当前空间验收或实施权限。

| 原路径 | 原字节副本 | SHA-256 |
|---|---|---|
| `docs/aliveness-development.md` | [旧开发状态](snapshots/aliveness-development.md) | `dfc088b9897843c0240af7febe52d3b4e2277c2bfab122f82a251aab0deece1d` |
| `docs/design/aliveness-implementation-plan.md` | [旧路线](snapshots/aliveness-implementation-plan.md) | `0248b4a8c09c53efac6962c449c63b88e975ea2128a66b0de1f06119bc4a8634` |
| `docs/design/aliveness-art-assets.md` | [旧素材入口](snapshots/aliveness-art-assets.md) | `8b3457e63b4e166393d194355eed5f9661904673d360002a8242ef4ed527586e` |
| `docs/design/living-integration-contract.md` | [旧装配契约](snapshots/living-integration-contract.md) | `382f9df7ab29d3cbff50e9092f91fdb20c9ea7409b971073f41b8f9388664024` |

副本相对链接按原路径解释，不修订内部链接或旧授权。默认搜索通过 `.ignore` 屏蔽归档，检索使用 `rg --no-ignore docs/archive/2026-10-aliveness/space-body-review`；这些快照不随安装包分发。

本次整理盘点全部受版本管理的 Markdown，更新现行入口、路线、使用说明与有关契约，删除现行文本中的过时下一步、旧会话授权和未核验的进程状态，保留固定报告、画面、来源和许可。无需销毁有追溯价值的原文件；本地产物与运行中的制作环境保持原状。

当前任务、基线和验收只看[开发状态](../../../aliveness-development.md)；最新问题与待实施目标见[复核](../../../design/space-body-review.md)。本次仅整理文档并本地提交，不修改产品行为、不重跑功能矩阵，不推送、合并或发布。

## 本次文档检查

整理前清单覆盖 140 份受版本管理的 Markdown；检查 41 份现行文档与维护索引的 360 个本地链接及 19 个 Markdown 锚点，均有效。旧快照内部链接按原路径解释，固定报告与原始证据不改写。

1,438 份既有原始证据、固定报告、素材／制作文件及来源声明摘要保持不变；以上四份新归档逐字节匹配基线提交。普通搜索仍排除归档／报告／证据，当前开发入口和问题复核可检索。npm dry-run 确认设计、归档、报告和证据目录不进入包；本次没有生成分发包、构建或安装。`git diff --check` 通过。
