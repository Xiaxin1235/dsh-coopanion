# macOS 隔离测试机

此环境用于把 Electron、系统鼠标、窗口探针和安装验证放进独立 macOS 桌面，减少测试与宿主日常操作的相互影响。CPU、内存、GPU、磁盘与宿主休眠仍然共享；虚拟机结果不代替物理多屏、混合 DPI、真实键盘、能耗或用户体验验收。Windows／Linux 远程测试机尚未在本仓库配置，需分别验证。

本页维护已准备环境的操作与保留规则。`scripts/macos-vm.sh` 只管理本项目已有的两台 VM，不负责创建、安装、重置或同步源码。换机器或本机数据缺失时，先准备固定镜像、工具链和专用身份，再验证图形会话；不能因仓库中存在脚本就判断 VM 已可用。

## 身份与存放

| 项目 | 配置 |
| --- | --- |
| 虚拟化软件 | 官方 Tart 2.40.1 发布包，保留完整 `.app`；宿主 macOS 15 使用默认 NAT，不启用需要 Tahoe 的 Softnet |
| 运行文件 | `.cache/tools/tart/2.40.1/tart.app/Contents/MacOS/tart`，发布归档 SHA-256 `363e2701154a8155cbc1bb6d845430c9b42697d2a186bc49574471ca2877db46` |
| 原始镜像 | `ghcr.io/cirruslabs/macos-sequoia-base@sha256:eee659985b01e4df2a6c0754bd8d25e54969933c43fdcd4edef8bea337b3d354`，不跟随 latest 漂移 |
| VM 数据 | `.local/macos-vm/tart`；独立 `TART_HOME`，禁用自动 prune，不管理个人 `~/.tart` |
| 准备基线／测试机 | `dsh-macos15-base`／`dsh-macos15-test` |
| 准备镜像系统 | macOS 15.7.7（24G720），Apple Silicon；每轮以实际 `sw_vers` 为准 |
| 资源目标 | 单台运行，4 vCPU、8192 MiB 内存、80 GB 稀疏磁盘、1440×1080 虚拟显示；磁盘容量与实际分配分别记录 |
| 来宾工具链 | 仓库固定 Node／npm、shrinkwrap；运行时在来宾准备基线中复用，不在各阶段另复制浏览器／整套依赖 |
| 配置记录 | `.local/macos-vm/provisioning.json` 是创建／验收快照；当前运行状态用下面的 status／SSH 命令核对 |

`.local/macos-vm` 是持久 VM 数据和专用 SSH 身份，不是下载缓存，不能整目录作为缓存删除。密钥、known_hosts、VM 磁盘和本机 IP 均不提交 Git。宿主工作区不共享给来宾；测试源码通过单独导出的固定提交传入，不传宿主配置、凭据和业务存档。

## 运行

```bash
bash scripts/macos-vm.sh status
bash scripts/macos-vm.sh start        # 当前终端保持运行；不打开宿主 VM 窗口
# 在另一终端中：
bash scripts/macos-vm.sh ssh
bash scripts/macos-vm.sh exec 'sw_vers'
bash scripts/macos-vm.sh stop
```

启动入口检查本项目 Tart home 中没有其他运行中的 VM，并要求宿主可用空间至少 60 GiB；它不预留磁盘或 CPU／内存。默认目标为测试机，日常回归使用 `dsh-macos15-test`。`DSH_MACOS_VM_NAME=dsh-macos15-base` 只在明确维护准备基线时选择；基线更新后另行验证，不把测试机的临时改动写回基线。

SSH 只使用本项目密钥和 known_hosts，保持严格主机身份检查，不转发 SSH Agent，不改动 `~/.ssh/config`。首次创建通过 Guest Agent 配置独立服务器密钥和公钥准入，关闭 SSH 密码／键盘交互认证。Tart 进程启动与停止需要相同宿主执行权限；工具沙箱不能发信号时可经 SSH 在来宾执行正常关机，不修改宿主系统保护。

测试在来宾已登录、已解锁的图形会话中执行。锁屏、休眠和键鼠测试只在来宾操作；宿主保持关闭目录共享、剪贴板、音频和 USB 透传。若环境需要辅助功能权限，在来宾明确授权，不通过修改宿主权限或关闭系统保护绕过。

## 每轮源码与结果

宿主与来宾是独立 checkout，**启动不会同步宿主工作树**。在宿主仓库核对目标提交，再在已启动的来宾核对源码、系统与工具链：

```bash
git rev-parse HEAD
git status --porcelain
bash scripts/macos-vm.sh exec 'cd ~/dsh-testing/dsh-coopanion && git rev-parse HEAD && git status --porcelain && sw_vers && node --version && npm --version'
```

有未提交改动时先核对归属和保留要求。已提交的本地源码可通过 Git bundle 经专用 SSH 传入，在来宾用 `git bundle verify` 核对后 fetch、`git merge --ff-only` 更新；不需要推送到远端。未提交补丁单独传入并记录文件摘要，不能只比较 HEAD 就宣称源码相同。依赖锁或工具链变化时在来宾按[开发指南](development.md)重新准备，缓存身份与复用按[缓存管理](cache-management.md)核对；不从宿主复制 node_modules 或跨平台浏览器。

测试在来宾 `~/dsh-testing/dsh-coopanion` 执行，先构建对应源码，每轮使用全新产物目录。结果经专用 SSH 取回宿主独立 artifacts 目录，保留源码／补丁、系统、工具链与包身份。来宾旧结果不能替代宿主新提交的测试，`provisioning.json` 也不证明来宾源码仍是创建时版本。

基线准备好后停机，从基线克隆单台测试机。每轮运行应记录实际源码提交、是否有修改、工具链、镜像摘要和包摘要。正式安装仍消费同一规范 `.tgz`；源码浏览器测试、原生探针、真实 Host 安装与物理实机结果分别结算。准备基线不接入日用 Host／Apple 账号；系统休眠和显示器休眠只在来宾关闭。

## 容量与保留

镜像下载约 23.7 GiB；基线加一台轻量测试机初始实际空间预计约 30–45 GiB，准备峰值预留 50–60 GiB。虚拟磁盘上限不是立即占用；APFS 克隆共享底层块，逐目录 du 也可能重复统计共享内容。判断宿主能否继续运行以当时 `df` 为准，并保留至少约 60 GiB 空闲；低于阈值先停止新下载／新克隆，检查来源与引用。

只保留一个固定镜像、一个准备基线和一个测试克隆；运行结果取回项目独立 artifacts 目录。旧克隆的回收先确认停机、无唯一存档／未取回结果并核对名字及 Tart home，不自动删除基线、密钥或个人 VM。磁盘增长异常时先停机核对；不因目录名在 `.local` 或 `.cache` 就判断可删除。

Tart 缺失时按[官方发布包方式](https://github.com/openai/tart/blob/2.40.1/docs/quick-start.md)获取固定 2.40.1，验证上述归档摘要与应用签名并解压到指定目录。保留完整 `.app`，不只复制 CLI。该固定配置使用默认 NAT，不要求安装 Softnet 或升级宿主。

## 历史配置与验证

2026-10-22 的创建版本、源码身份、磁盘测量及验证结果见[固定报告](reports/macos-vm-20261022.md)。它记录当时状态；后续运行按本页重新核对，不将当时停机、空闲空间或测试通过视为实时事实。
