# 2026-10-20 第 3 期固定验证

本目录保存连续动作预览的一次固定本地验证，不作为后续源码或正式发布结论。当前进度与授权见[开发入口](../../aliveness-development.md)，运行规则见[连续动作契约](../../design/continuous-action-contract.md)。

`browser.json` 与 `native.json` 记录本次工作区 base commit、实际源文件／素材 SHA-256 与运行时；报告中的 base commit 是拉取后的 `9ef7755`，不是声称测试了未修改的该提交。实现与证据一起提交后，应逐项将报告哈希与实现提交中的 blob 核对。`verification.json` 记录综合检查和本机录像位置，`SHA256SUMS` 校验原始记录字节。

- `before-mirror-fix.json`：从另一侧接近时，抓握点已接触但贝壳角点跳约 40px 的失败；它属于修正前源码。修正保留地面纹理朝向，最终交接仍要求 <1.5px。
- `native-gap-under-load.json`：多路 WebGL／工程检查负载下，独立原生路线遇到 >1 秒心跳间隙后保守暂停。后续最终原生矩阵单独执行；通过不代表已修复所有系统长帧或长期资源问题。
- `native-cleanup.json`：仅记录最终隔离 profile 清理。测试使用受控 powerMonitor suspend，没有执行真实系统休眠或锁屏。

截图和页面录像留在本机 `artifacts/stage-3-delivery-*`，不随此目录或安装包分发。原始失败、成功 JSON 与日志均保留原字节；本地工程通过不等于用户观感验收、其他物件／角色通用能力、真实 Harness 交接、跨平台／物理多屏或发布成功。
