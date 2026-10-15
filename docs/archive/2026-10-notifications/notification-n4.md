# N4 交付记录

> 历史归档：下文状态、命令、分工和“下一步”仅适用于记录时的提交与测试包，不是当前执行指令。现行入口见[文档索引](../../README.md)，当前范围见[路线图](../../roadmap.md)。

2026-10-13（Asia/Shanghai），v0.4.5 已通过 npm OIDC 和 [GitHub Release](https://github.com/takboo/dsh-coopanion/releases/tag/v0.4.5) 发布，N4 交付完成。本记录在发布后补入文档；分发源码绑定不可变标签 `v0.4.5`，提交 `4b4e9b111df3c43cd067bd1a7fdd70114879537f`。

[Release 38343263414](https://github.com/takboo/dsh-coopanion/actions/runs/38343263414) 的 13 个发布链路任务通过，包含三平台检查与两版 DSH 的六组安装。每组 7 项宿主契约、4 项已安装服务检查、2 个独立提醒及 4 个 Host 接受的回执已逐份核对，完整源会话身份与公开导出一致。

六组安装、npm 和 GitHub Release 消费同一 canonical 包。实际 npm tarball、Release 版本包、固定别名及 latest 下载逐字节一致，SHA-256 为 `d1b4795af073c08c0a7d13528f650e2c3dfcff37f0a7a1f580f3df530f33a5d4`。npm integrity 与 provenance 解码数据匹配包、源码和发布工作流；未单独验证 provenance 的密码学签名。来源及报告摘要见 [交付核对报告](https://github.com/takboo/dsh-coopanion/releases/download/v0.4.5/notification-verification.json)；原始包身份见 [verification.json](https://github.com/takboo/dsh-coopanion/releases/download/v0.4.5/verification.json)。

安装中的通知构造器、服务链路中的原生可见性与答复器为受控边界。完整系统实机验收和外部真实模型会话尚未验证。Linux 原生重启输入存在间歇 CI 失败，本次保持标签和源码不变重跑后通过，根因尚未定位；该范围继续按 [N3 验收记录](notification-n3.md) 保留。
