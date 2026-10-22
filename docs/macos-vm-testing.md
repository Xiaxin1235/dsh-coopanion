# macOS 隔离测试机

此环境用于把 Electron、系统鼠标、窗口探针和安装验证放进独立 macOS 桌面，减少测试与宿主日常操作的相互影响。CPU、内存、GPU、磁盘与宿主休眠仍然共享；虚拟机结果不代替物理多屏、混合 DPI、真实键盘、能耗或用户体验验收。Windows／Linux 远程测试机另行配置，不复用本机桌面会话。

## 身份与存放

| 项目 | 配置 |
| --- | --- |
| 虚拟化软件 | 官方 Tart 2.40.1 发布包，保留完整 `.app`；宿主 macOS 15 使用默认 NAT，不启用需要 Tahoe 的 Softnet |
| 运行文件 | `.cache/tools/tart/2.40.1/tart.app/Contents/MacOS/tart`，发布归档 SHA-256 `363e2701154a8155cbc1bb6d845430c9b42697d2a186bc49574471ca2877db46` |
| 原始镜像 | `ghcr.io/cirruslabs/macos-sequoia-base@sha256:eee659985b01e4df2a6c0754bd8d25e54969933c43fdcd4edef8bea337b3d354`，不跟随 latest 漂移 |
| VM 数据 | `.local/macos-vm/tart`；独立 `TART_HOME`，禁用自动 prune，不管理个人 `~/.tart` |
| 准备基线／测试机 | `dsh-macos15-base`／`dsh-macos15-test` |
| 来宾系统 | macOS 15.7.7（24G720），Apple Silicon 虚拟机；不等同于宿主 15.8.1 的实机验收 |
| 资源目标 | 单台运行，4 vCPU、8192 MiB 内存、80 GB 稀疏磁盘、1440×1080 虚拟显示；磁盘容量与实际分配分别记录 |
| 来宾工具链 | 仓库固定 Node／npm、shrinkwrap；运行时在来宾准备基线中复用，不在各阶段另复制浏览器／整套依赖 |
| 当前本机状态 | `.local/macos-vm/provisioning.json`，创建与验收以现场记录为准 |

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

启动入口会拒绝同时运行第二台项目 VM，也会在宿主可用空间低于 60 GiB 时拒绝启动。默认目标为测试机，可用 `DSH_MACOS_VM_NAME=dsh-macos15-base` 显式选择准备基线。SSH 只使用本项目密钥和 known_hosts，保持严格主机身份检查，不转发 SSH Agent；不会改动 `~/.ssh/config`。首次创建时通过 Guest Agent 完成来宾登录核对、独立服务器密钥和公钥准入，关闭 SSH 密码／键盘交互认证；不能把 SSH 连通当成图形桌面就绪。Tart 进程启动与停止需要相同宿主执行权限；工具沙箱不能发信号时可经 SSH 在来宾执行正常关机，不修改宿主系统保护。

测试在来宾已登录、已解锁的图形会话中执行。锁屏、休眠和键鼠测试只在来宾操作；宿主保持关闭目录共享、剪贴板、音频和 USB 透传。若环境需要辅助功能权限，在来宾明确授权，不通过修改宿主权限或关闭系统保护绕过。

入口负责启动、停止与连接，**不会自动同步宿主工作树**。当前来宾源码为 `c7a6e32`；每轮先比较宿主与来宾的 `git rev-parse HEAD`、`git status --porcelain`。本地未发布提交可用 Git bundle 经专用 SSH 传入；补丁另行传入并记录差异摘要。源码未同步时，旧来宾测试只能作为旧版本结果。

基线准备好后停机，从基线克隆单台测试机。每轮运行应记录实际源码提交、是否有修改、工具链、镜像摘要和包摘要。正式安装仍消费同一规范 `.tgz`；源码浏览器测试、原生探针、真实 Host 安装与物理实机结果分别结算。准备基线不接入日用 Host／Apple 账号；系统休眠和显示器休眠只在来宾关闭。

## 容量与保留

镜像下载约 23.7 GiB；基线加一台轻量测试机初始实际空间预计约 30–45 GiB，准备峰值预留 50–60 GiB。虚拟磁盘上限不是立即占用；APFS 克隆共享底层块，逐目录 du 也可能重复统计共享内容。判断宿主能否继续运行以当时 `df` 为准，并保留至少约 60 GiB 空闲；低于阈值先停止新下载／新克隆，检查来源与引用。

只保留一个固定镜像、一个准备基线和一个测试克隆；运行结果取回项目独立 artifacts 目录。旧克隆的回收先确认停机、无唯一存档／未取回结果并核对名字及 Tart home，不自动删除基线、密钥或个人 VM。磁盘增长异常时先停机核对；不因目录名在 `.local` 或 `.cache` 就判断可删除。

Tart 缺失时按[官方发布包方式](https://github.com/openai/tart/blob/2.40.1/docs/quick-start.md)获取固定 2.40.1，验证上述摘要并解压到指定目录。当前 Homebrew 配方强制依赖需 macOS 26 的 Softnet，不能以 Homebrew 安装失败推断 Tart 本体不支持 macOS 15；也不因此升级宿主或全局跳过依赖。

## 固定验收

2026-10-22 在该 VM 中完成构建／类型、完整 npm test、完整 inbox UI、9 项 D0 窗口探针、键盘适配器、原生陪伴指针／IPC、口型及普通沙箱冷启动检查。首次测试发现 lsof 部分匹配保护缺陷，已修正并固化为 `c7a6e32`，准备基线与测试机均同步到该版本并正常停机。资源、失败到修正的身份边界及物理实机限制见[固定报告](reports/macos-vm-20261022.md)。
