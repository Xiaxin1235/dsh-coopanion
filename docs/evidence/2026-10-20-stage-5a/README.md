# 第 5A 期固定证据副本

这些是既有本机原件的逐字节副本，没有重新运行功能测试。来源分别为首版 `e4858ddc39ddae04b774abe48356d9b8643fbe86` 与反馈修正 `178437b8ca3ee3c47879c852c4f6a9fd95c99c28`；交付差异、工程结果和待验边界见[阶段历史](../../archive/2026-10-aliveness/stage-5a/README.md)。当前执行范围只看[开发状态](../../aliveness-development.md)。

[清单](manifest.json)记录 32 份原件的 `originalPath`、相对本目录的 `preservedPath`、字节数和 SHA-256。复制时保留原 `artifacts/...` 子路径，固定报告、日志、失败和源码身份字段均不回写。报告内的 base commit 与工作区来源摘要仍按当时含义解释；不是本次文档整理提交的功能验收。

| 查阅目标 | 副本入口 |
|---|---|
| 反馈修正最终浏览器 | [28 项报告](artifacts/stage-5a-feedback-browser-20261020-05/personality.json)、[安静同参数截图](artifacts/stage-5a-feedback-browser-20261020-05/equal-quiet.png)、[活泼同参数截图](artifacts/stage-5a-feedback-browser-20261020-05/equal-lively.png)、[故事样片](artifacts/stage-5a-feedback-browser-20261020-05/story.webm)、[安静样片](artifacts/stage-5a-feedback-browser-20261020-05/quiet.webm) |
| 反馈修正隔离原生 | [28 项报告](artifacts/stage-5a-feedback-native-20261020-03/personality.json)、[profile 清理](artifacts/stage-5a-feedback-native-20261020-03/cleanup.json)、[安静截图](artifacts/stage-5a-feedback-native-20261020-03/equal-quiet.png)、[活泼截图](artifacts/stage-5a-feedback-native-20261020-03/equal-lively.png) |
| 反馈修正其余检查 | [连续动作](artifacts/stage-5a-feedback-actions-20261020-01/actions.json)、[工作表现](artifacts/stage-5a-feedback-semantics-20261020-02/semantics.json)、[完整双线](artifacts/stage-5a-feedback-life-work-20261020-02/life-work.json)、[汇总及交付来源](artifacts/stage-5a-feedback-validation-20261020/manifest.json) |
| 被否定首版的工程身份 | [浏览器](artifacts/stage-5a-browser-20261020-05/personality.json)、[原生](artifacts/stage-5a-native-20261020-03/personality.json)、[验证清单](artifacts/stage-5a-validation-20261020/manifest.json)；这些通过数不表示体验获认可 |
| 选定失败与复跑边界 | [首版原生生命周期中断](artifacts/stage-5a-native-20261020-02/failure.json)、[参数旧帧回写](artifacts/stage-5a-feedback-native-20261020-02/failure.json)、[工具在途的错误测试预期](artifacts/stage-5a-feedback-semantics-20261020-01/failure.json)、[并发运行的完整测试超时日志](artifacts/stage-5a-feedback-validation-20261020/npm-test-concurrent-timeout.log) |

仅选取可追溯固定报告与反馈问题的材料；未复制全部中间录像、截图和测试目录，它们仍由本机 `artifacts/` 保留并屏蔽普通搜索。新验证使用新目录，不写入这些副本。默认产品装配、实机、真实模型、长期资源与用户自然度验收均不能由这些受控结果代替。
