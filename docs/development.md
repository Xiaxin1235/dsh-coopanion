# 开发与验证

先从[文档索引](README.md)阅读对应行为契约。工具链分别固定在 `.node-version` 和 `package.json#packageManager`，依赖锁为随包提供的 `npm-shrinkwrap.json`。

## 准备与验证入口

以下命令在被测系统内执行。macOS 原生窗口、键鼠、桌面探针及安装回归默认使用[隔离测试机](macos-vm-testing.md)，执行前核对来宾提交／补丁与本轮源码身份；物理实机验收单独安排。

```bash
npm ci --ignore-scripts
npm run verify:metadata
npm run setup:electron
npm run typecheck
npm test
npm run build
npm run setup:browser
npm run character:pack -- examples/star paper-star.zip
npm run test:ui
npm run test:notification-ui
npm run test:inbox-ui
npm run test:keyboard-native
npm run test:desktop
npm pack
node scripts/check-package.mjs
npm run test:install
```

缓存复用、独立证据目录、临时 profile 回收及保留策略见[缓存管理](cache-management.md)。

按改动选择检查；完整发布门槛见[发布流程](releasing.md)。Linux 原生窗口需要 X11／Xvfb 和窗口管理器，测试光标还需要 Python 3 与 libX11；浏览器及网格动画需要 Chromium WebGL。CI 的 Linux 显示准备由 `.github/actions/setup-linux-display` 完成。

`npm run dev` 打开浏览器演示（默认 `http://127.0.0.1:4173`），`npm run demo` 启动桌面演示，二者的任务事件均为模拟。首页素材的重拍见[素材说明](assets/README.md)。

生活感分支的当前范围、下一项和交付身份从[开发状态](aliveness-development.md)进入；调整空间、拖放或朝向前先读[空间与身体复核](design/space-body-review.md)。D1 首个平面切片已进入默认产品，行为与回退见生活装配契约；工作台结果不能代替默认产品及多方向身体的体验验收。[空间样板](design/art-workflow/space-v1/README.md)与[O03 工作台](design/art-workflow/o03-shell-hands-v1/README.md)维护操作和定向回归入口，[制作工作流](design/art-workflow/README.md)维护素材／连续动作验证方法。复用已有预览服务，每轮输出写新目录；原始证据保持原字节。已验收第 1–3 期的固定范围和实际结果见[阶段历史](archive/2026-10-aliveness/README.md)，当前模型与后续授权只看开发状态。`node scripts/space-desktop.mjs` 打开临时 profile 的单屏同地图预览；`tests/navigation-ui.mjs`、`tests/space-native.mjs` 与 `tests/navigation-showcase.mjs` 分别执行真实指针、受控原生与页面实录。

浏览器检查真实 API 2 动画、聊天、完整阅读、角色导入及脚本隔离；桌面检查真实 Electron 窗口、IPC、托盘和恢复；安装检查使用官方 DSH loader 安装实际 `.tgz`。用 `DSH_TEST_VERSION=<支持版本>` 选择宿主，用 `DSH_TEST_PACKAGE_DIR=<规范包目录>` 消费已有规范包及校验文件。完整平台／宿主列表以 CI 矩阵为准。

原生测试和安装使用隔离数据目录，系统桌面操作串行执行。CI 测试沙箱参数仅供隔离实例；普通安装保留 Chromium sandbox 与 contextIsolation，关闭 Node integration。测试通知适配器和模型答复器属于受控边界，不能代替通知中心实机送达或真实模型会话验收。

## 关键行为回归

5C 的最终时序、上限与许可见[回应与安静节奏](design/response-rhythm-contract.md)。`tests/response-rhythm.test.js` 验证有界策略；完整 `test:inbox-ui` 包含主页面合批与占用回归；`COMPANION_EVIDENCE_DIR=<新目录> node tests/response-rhythm-native.mjs` 在隔离 profile 验证实际时钟、真实 IPC 与指针，已纳入 `test:desktop` 串行执行。当前源码与工具链需重新绑定，不以旧报告数字代替本次测试。

消息样式的 token、层级与滚动归属见[视觉体系](design/message-visual-system.md)。`MESSAGE_EVIDENCE_DIR=<新目录> node tests/message-surfaces-ui.mjs` 执行中英文三档字号布局／实际滚动检查，并纳入 `tests/ui.mjs`；`tests/message-surfaces-native.mjs` 在临时 profile 串行检查真实 Electron。涉及阅读与气泡的改动仍包含完整 `test:inbox-ui`，不能用截图替代草稿／身份／计时回归。

右键设置使用同一视觉体系的设置组件表。`MENU_EVIDENCE_DIR=<新目录> node tests/menu-surfaces-ui.mjs` 覆盖两种窗口、中英文、三档字号、折叠／展开、16 条记忆、空态／受控只读、禁用样式、键盘可达性及字号更新保留节点／焦点；已纳入 `tests/ui.mjs`。`tests/menu-surfaces-native.mjs` 用临时 profile 的真实存档与 IPC 验六组原生结构，纳入 `tests/desktop.mjs`；真实指针操作与记忆纠正／删除仍用 `tests/companionship-native.mjs`，各原生入口串行运行。

持续开合嘴巴的回归为 `tests/live-mouth.test.js`、`tests/model.test.ts` 与 `node tests/mouth-ui.mjs`（也纳入 `tests/ui.mjs`）：实际 API 2 iframe 必须在无新输出后停止收到 talk，渲染包络收拢；新内容进度恢复口型，重复快照不续播。`MOUTH_EVIDENCE_DIR=<新目录> node tests/mouth-native.mjs` 在临时 Electron profile 验证相同进度停止、新进度恢复与流结束停止，并纳入 `tests/desktop.mjs` 串行链。`speechRevision` 只传递单调进度，不带流式正文；工作状态与最终回复完成判断不依赖它。

第 5B 期在默认产品主页面的右键菜单 → 相处记忆操作，见[记忆契约](design/companion-memory-contract.md)。先 `npm run build`；存档定向测试为 `tests/companion-memory.test.ts`、`tests/companion-client.test.js`、`tests/companion-http.test.ts` 与 `tests/companionship.test.js`；真实 UI 纳入完整 `test:inbox-ui`。`COMPANION_EVIDENCE_DIR=<新目录> node tests/companionship-native.mjs` 串行使用隔离 profile 验证真实 IPC 与跨重启查看／纠正／删除。此入口与 `?stage=5a` 二维制作预览分别运行。

第 5A 期使用 `?stage=5a`／`DSH_SPACE_STAGE=5a`。参数及准入见[人格行为契约](design/personality-behavior-contract.md)，运行前仍准备 `prepare-stage4.mjs` 的共享事实模块。策略为 `tests/personality.test.js`、`tests/personality-feedback.test.js` 与 `tests/personality-controls.test.js`（参数控件旧帧回写）；`tests/personality-ui.mjs` 用公共控件对照同种子及同时间参数的安静／活泼、对象关注、实际 rig 表情／点头、真实起立／抵达、途中切换、占用／减少动态、回退、审批优先、障碍编辑及生命周期，`--native` 使用临时 profile。每次指定新的 `SPACE_EVIDENCE_DIR`，并执行既有导航／连续动作／生活工作回归和完整 `test:inbox-ui`。

第 4 期先运行 `node docs/design/art-workflow/space-v1/prepare-stage4.mjs`，显式 `?stage=4` 或 `DSH_SPACE_STAGE=4 node scripts/space-desktop.mjs`；事实／策略测试为 `tests/work-facts.test.ts`、`tests/life-work.test.js`，完整可见闭环为 `tests/life-work-ui.mjs`（`--native` 使用隔离 profile）。模拟事实与真实宿主分别结算；原生测试串行，每轮使用新 `SPACE_EVIDENCE_DIR`。

第四阶段事件／多会话增量检查使用 `tests/work-facts.test.ts`、`tests/life-work.test.js`、`tests/work-performance.test.js` 与 `tests/work-semantics-ui.mjs`。正式 loader 的 `tests/work-host-contract.mjs` 对每个支持宿主使用其自己的目标投影包；`--output` 指向新的证据目录，临时 profile 自动清理。运行与边界见[工作语义验证](reports/stage-4-semantics-20261020.md)。

第 3 期定向检查见[空间预览](design/art-workflow/space-v1/README.md#第-3-期连续动作与物件)。`tests/space-action-ui.mjs --native` 与其他原生测试串行执行，自动创建／清理临时 profile；`DSH_SPACE_STAGE=3 node scripts/space-desktop.mjs` 打开同一显式模式。源码身份由 `tests/space-source-identity.mjs` 记录，新证据目录不能覆盖已有结果。

| 改动 | 检查入口与范围 |
|---|---|
| 完成、通知与请求结算 | `npm test`、`test:n0`、`test:notification-ui`；宿主接口检查由安装入口执行 |
| 聊天、收件箱、字号、多屏、NPC 日常 | `test:inbox-ui`；会话与字号浏览器用例串行，初始化失败保留有界状态、控制台与截图 |
| 清醒坐姿与鲸鱼摆臂 | `tests/upstream-motion.test.js` 检查坐睡边界、手腿相位与姿势拥有权；`test:ui` 包含真实 WebGL 的 `tests/upstream-motion-ui.mjs`，可用 `UPSTREAM_MOTION_EVIDENCE_DIR` 指定新的截图／结果目录；同时跑 `test:inbox-ui`、空间导航与 O03 接触回归 |
| 原生空间栅格与调试通道 | `tests/space-native.mjs` 检查 7 项原生行为及动态 PNG URL 积压；记录逐项耗时，120 秒总期限，失败绑定阶段，结束恢复光标和清理 profile；`upstream-motion.test.js` 检查栅格 URL 的释放／重新挂载 |
| NPC 配置 | `tests/npc-controls-ui.mjs`：关闭许可、quiet／interactive、热切状态保持与禁用上游随机漫游 |
| 异常查看与尺寸 | `tests/attention-size-ui.mjs`：通用异常回执、新修订、审批／提问与固定角色尺寸 |
| 拖放与小窝 | `tests/npc-drag-ui.mjs`：真实指针轨迹、两侧边缘、区域外停留、旧路线取消、按住及释放后小窝锚点 |
| 自主循环与互动存档 | `tests/npc-life.test.js`、`tests/npc-life-native.mjs`、`tests/companionship-ui.mjs`、`tests/companionship-native.mjs` |
| 原生冷启动 | `tests/lifecycle-startup-native.mjs`：受控 unknown／locked 与实际系统状态分别检查 |

原生 NPC 用例控制时钟、粗粒度输入和鼠标感知；身体移动及 arrived／interrupted 保持真实。受控循环通过与物理输入、自然体验分别报告。

小窝回归支持录制隔离页面，不录桌面其他窗口或音频：

```bash
DSH_HOME_MARKER_VIDEO=/absolute/path/drag.webm \
DSH_HOME_MARKER_TRACE=/absolute/path/drag.json \
node --test --test-name-pattern="home marker" tests/npc-drag-ui.mjs
```

默认不录视频。断言同时检查按住、拖动及松手后的锚点，并覆盖大尺寸及两端小窝设置。

## D0 真实桌面窗口探针

`npm run probe:desktop-environment` 在新临时 profile 启动两个无边框测试窗口，检查 OS 枚举、平面定位、移动／缩放时身份保持、重叠顺序、隐藏／恢复、关闭及成功空快照。输出为新的 `artifacts/desktop-environment-<时间>/report.json`；可用 `-- --output <尚不存在的目录>` 指定位置。探针不连接正式 Host、不接入产品身体、不操作其他应用窗口，不申请新权限或写入日用配置。

各辅助进程只输出目标测试进程的临时窗口 ID、几何与前后关系，不输出窗口标题、应用名称或内容。Windows 使用系统 PowerShell／DWM，macOS 使用系统 JXA／CoreGraphics，X11 使用 Python 3／libX11／EWMH。结果绑定源码摘要、提交、Electron、平台会话、显示布局及普通／测试 sandbox 状态。单次辅助采集限 5 秒、64 KiB、64 个测试窗口；完整探针限 90 秒，每项最多 3 次同步采样。这是测试工具上限，尚未确定生产采样频率或资源预算。

`available` 且通过全部几何断言才报告 `passed`；partial、unsupported、空图形会话和进程失败均以非零退出并保存结果。原生 Wayland／Xwayland 明确返回 unsupported，本工具不以 X11 子集替代全桌面；其覆盖层定位／穿透仍待单独探针。三平台 CI 在原生测试后串行运行本探针；Linux 仅在 CI 中允许显式 `DSH_DESKTOP_PROBE_NO_SANDBOX=1`，其结果不证明普通 sandbox 安装可用。

该切片只验证主显示器上的测试无边框窗口。装饰边框、跨应用、透明覆盖层、穿透、全屏／工作区、物理输入、多屏混合 DPI、权限撤销、生命周期恢复与资源仍分别待验。键盘枚举与系统初始锁屏状态记录在独立字段，其观测可用不等于物理输入验收。协议、失败、容量和坐标回归为 `tests/desktop-environment-probe.test.js`，纳入 `npm test`；专项状态看[开发入口](aliveness-development.md)。

## 键盘与生命周期

`test:keyboard-native` 启动当前系统的真实辅助进程，检查固定枚举、停用和清理，报告写入 `artifacts/keyboard-activity-native.json`。macOS 与可用 X11 需取得 active／idle；不支持的会话保守 unknown。Linux CI 在隔离 Xvfb 中设置 `DSH_KEYBOARD_TEST_X11_INPUT=1`，用 XTest 验证键盘触发、仅鼠标不触发和恢复 idle；日常会话不使用这个注入开关。

macOS 可在已解锁桌面运行普通沙箱探针：

```bash
DSH_LIFECYCLE_NATIVE_REAL=1 DSH_LIFECYCLE_EXPECT_STATE=unlocked \
node tests/lifecycle-startup-native.mjs
```

它要求真实初态已知、未挂起且键盘适配器 available。锁屏场景使用 `DSH_LIFECYCLE_EXPECT_STATE=locked`，在实际锁屏环境单独执行；探针不改变锁屏状态。物理键盘、跨应用、锁屏／休眠、远程会话与平台资源分别验证。

## 资源与诊断

先按[使用指南](usage.md#自主陪伴)核对开关，再按[诊断契约](diagnostics-contract.md)解释时长、缺口和报告状态。独立采样器 `scripts/sample-companion.mjs` 使用本地诊断接口及 OS 指标，不操作窗口、不读取聊天正文、不启动模型。

`scripts/measure-idle.mjs` 支持 `off`、`npc-day`、`npc-night` 的同机短时对照，使用固定随机种子与真实时间；`npc-controlled` 强制粗粒度 keyboard=idle，只用于区分输入阻塞。短测不能作为两小时或其他平台资源结论。

受控 Linux 观察使用 `scripts/run-resource-observation.sh`；按脚本参数提供隔离 DSH runtime、冻结包、完整来源提交和尚不存在的输出目录：

```bash
bash scripts/run-resource-observation.sh \
  --runtime /path/to/dsh-runtime \
  --package /path/to/frozen-package.tgz \
  --source-commit <包实际来源的完整提交> \
  --output artifacts/resource-observation-unique
```

VM 需图形依赖、Xvfb、Openbox、Python 3、procps 及固定工具链。观察器核对包内采样脚本，使用独立 profile，设置 `roam=true`、`companionship=interactive`、`diagnostics=true`；开始时用 CDP 证明渲染并设置随机源，周期采样交给同一独立采样器。默认预热 20 秒、采样至少 7200 秒、每 5 秒一次，首末各 1800 秒时间加权 RSS 增量 ≤20 MiB；NPC 覆盖、邀请落盘、存档与队列边界另行检查。`--seconds 60 --window 20` 仅做短检。

## 运行时与隔离

高频事件只发送动画元数据，完整结果在结果或已读状态变化时传输。角色脚本运行于 `sandbox="allow-scripts"` 的 opaque-origin iframe，仅通过有限协议交互；没有 Node、Electron 桥、外部网络或顶层导航权限。本地资源服务只监听 `127.0.0.1`，原生实例使用随机路径，写入校验可信页面来源。

上游代码和资源固定在仓库，不在启动时在线拉取；Electron 首次准备仍下载并校验运行时。插件不收集遥测，也不提供独立模型 API。许可及对应源码要求见[第三方声明](../THIRD_PARTY_NOTICES.md)。

默认产品生活装配使用 `web/upstream/kit/living-body.js` 共享身体与 `living-routine.js` 有限目标策略；原工作台重导出同一工厂。`test:inbox-ui` 包含 `tests/living-integration-ui.mjs` 的真实导航／接触、工作／互动交接、输入／热切／草稿、90–240px 与持物拖放回归；`test:desktop` 串行包含 `living-integration-native.mjs`。浏览器用受控输入和元数据，原生用真实 IPC／系统输入枚举、隔离存档；真实日用 Host／物理键盘／多屏和用户观感分别验收。旧简单日常用显式 `livingSpace:false` 回归。

`tests/living-feedback.test.js` 与 `tests/desktop-life.test.js` 覆盖动作显示节奏、空手站立、访问 token／几何、环境交接／输入冷却和有界系统恢复。原生装配记录显示／身体帧比例；受控工作恢复显式覆盖输入枚举，另存真实键盘适配器观察。`tests/living-integration-ui.mjs` 另覆盖三种尺寸的平面拖放、取消、跳跃中缩放、阴影、二维返回及显示器事件顺序；`tests/living-integration-native.mjs` 在 VM 验证默认产品放置、跳跃中改尺寸和返回。多方向身体仍未实现。文档整理检查链接、检索与身份；脚本或运行时入口变更执行对应回归，固定结果从[报告索引](reports/README.md)追溯。
