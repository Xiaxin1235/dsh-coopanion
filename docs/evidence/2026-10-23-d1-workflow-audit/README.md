# D1 工作流复核原始证据

固定基线：ddc318ec3f71eddc1daa316ed3ef3dce4b4e7e0c；实际渲染与资产摘要见 diagnosis.json。此轮是缺陷复现，退出码 1 是预期失败，不能当作通过报告。当前使用范围见 ../../aliveness-development.md。

- current.png：当前制作台同一 WebGL、t=0 的斜后拼合。
- noAnimation.png：清空全部变形状态后，遮挡仍错误。
- tailInFront.png：只将尾巴 z 从 1 改为 8；仅诊断候选，没有导出到产品。
- reference.png：用户原设计按共同脚底／高度显示。
- front.png、back.png：同一时刻的实际正面／正背面。
- reproduce-tail.mjs：真实渲染的定点复现；读取 4189 制作服务，在新目录保存证据后断言尾柄可见。候选通过不证明造型、尾根绑定或整体身份通过。

复现（先按制作说明启动 4189 服务；输出目录必须不存在）：

```bash
node docs/evidence/2026-10-23-d1-workflow-audit/reproduce-tail.mjs artifacts/runs/d1-tail-new-run
```

原始图、日志与摘要保留原字节；后续运行使用新目录。
