# 生活感早期概念与 O03 制作历史

这些叙述已被[当前开发状态](../../aliveness-development.md)和[空间样板](../../design/art-workflow/space-v1/README.md)替代。原叙述迁入本目录，补充历史标识并修正相对链接；阶段建议、默认入口、未完成项和测试数量均按形成时的状态解释。

| 归档材料 | 用途 |
|---|---|
| [第 1 期结束交接快照](stage-1-handoff/README.md) | `9ab04bc` 的原始状态／路线／资源与工作台说明，按原路径解释；含本次整理记录 |
| [第 1 期实施前开发状态](pre-space-v1-state.md) | `137a360` 的接手原文，保留当时“完整空间待实施”等叙述；相对链接按原 `docs/` 入口解释 |
| [生活感概念稿 v0.1](aliveness-concept-v0.1.md) | 保留完整体验目标；P1–P3 顺序和单议程建议已由七阶段路线及生活／工作双线方案替代 |
| [首轮美术资源试跑](art-workflow-first-run.md) | 贝壳两版生成、尺寸预览与最初的结构检查 |
| [贝壳生成需求卡](o03-generation-brief.md) | 首件素材的风格、输出和候选锚点要求 |
| [首次绑定与交互](o03-interaction-v1.md) | 早期走近拿放策略和原手型绑定 |
| [首次连续动作](o03-motion-v1.md) | 现有身体的俯身、携带和放下探针 |
| [首次美术缺口](o03-motion-art-gaps-v1.md) | 补手型前的画面依据，不能当成当前未解决问题清单 |

## 保留原路径的夹具与证据

`docs/design/art-workflow/o03-shell-v1/`、`o03-shell-interaction-v1/`、`o03-shell-motion-v1/` 中的素材、代码、模型快照、报告和画面按原路径保留。这些路径被制作来源、原始摘要和复现脚本引用，普通搜索已屏蔽；仅在追溯时用 `rg --no-ignore` 读取。相应旧文档入口只提供归档指引。

`o03-shell-hands-v1/` 的根目录报告／录像记录修正前的三图切换版本；其中“39 项通过”没有覆盖用户发现的视觉闪烁。原 O03 子故事当时的最终结果是 `continuity-fix/browser-qa-final.json` 的 44 项及 `after-pixels.json`，不代表后续源码复测；第 1 期新空间及长暂停修正后的结果从[当前状态](../../aliveness-development.md)追溯。同目录的 `before-*`、`browser-qa.json` 和 `qa-slow-timeout.json` 分别是缺陷复现、中间成功结果和慢放等待边界失败，均按原字节保留，不能作为当前失败或当前验收状态。

整理前的原始报告多数绑定基础提交 `7d55786d096552dea62ef974237d942ab03c3b2f` 和具体脏工作区文件摘要；其来源字段不改写为后来的提交。分支接手以当前状态入口、Git 历史和实际源码为准。
