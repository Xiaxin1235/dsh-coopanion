# 2026-10-18：裸包名安装回退到 0.4.10

核对时间：2026-10-18 10:20（Asia/Shanghai）。仓库检查点 `ae6e2ad9b2565ecd603b3fbc79288b73a2f8290d`；产品仍为已发布的 v0.4.12，源码 `015ef3a792e9db17897d5ceed611106d78aedabd`，规范包 SHA-256 `5abd4079a114e1314e869dd65f15614b5eb57857727e5ab3ec654cf83290dab3`。本次只纠正安装说明和入口验证范围，不重新打包或发布同版本。

## 症状与原因

用户在「插件 → 添加插件」中输入 `@takboo/dsh-coopanion`。详情展示 0.4.12，pnpm 实际安装 0.4.10，DSH 0.2.1-rc.2 拒绝旧声明并回滚。fresh npm metadata 的 `latest` 是 0.4.12；页面展示和安装解析使用的版本可以不同。

本机 Desktop 自带 pnpm 11.28.5。[pnpm 11 默认](https://pnpm.io/blog/releases/11.0)的 `minimumReleaseAge` 为 1440 分钟（24 小时），`minimumReleaseAgeStrict` 为 false。0.4.12 在 2026-10-17 14:08:30.037 UTC 发布，在 10 月 18 日 14:08:30.037 UTC 前仍处于默认等待期。本机未显式设置等待时长；既有精确例外覆盖至 0.4.10，尚不包含 0.4.12。默认版本过滤、显式版本例外与 trust policy 的区别见 [pnpm 供应链保护说明](https://pnpm.io/supply-chain-security)。

因此，在此次环境中，裸包名选择 0.4.10；DSH 随后正确拒绝它。对精确 `@takboo/dsh-coopanion@0.4.12` 的请求会解析新版，并由 pnpm 记录仅该版本的 `minimumReleaseAgeExclude`。没有添加 DSH 不兼容版本豁免，也没有修改全局等待时长。

## 可复现信号与对照

使用同一个实际 pnpm 11.28.5，复制当时 profile 的 workspace 配置到隔离目录，初始依赖为空且没有 lockfile。除对照中明示的变量外，保留相同配置、npm registry 和工具链。

| 场景 | 实际结果 | 原始证据 |
|---|---|---|
| 裸包名，干净目录 | 0.4.10 | [首次日志](unversioned-run.log)、[lockfile](pnpm-cases/unversioned/pnpm-lock.yaml) |
| 裸包名，另一干净目录 | 再次选择 0.4.10 | [重复日志](repeat-unversioned.log)、[lockfile](pnpm-cases/repeat-unversioned/pnpm-lock.yaml) |
| 只把请求改为 `@takboo/dsh-coopanion@0.4.12` | 0.4.12；自动增加精确发布时间例外 | [日志](explicit-version.log)、[修改后的配置](pnpm-cases/explicit-version/pnpm-workspace.yaml) |
| 裸包名，只把隔离目录的等待时长设为 0 | 0.4.12 | [诊断对照日志](age-zero.log)；仅用于因果核对 |
| 真实 DSH rc.2 安装命令，裸包名 | 安装 0.4.10 后拒绝，exit 1，回滚依赖 | [日志](cli-unversioned.log) |
| 真实 DSH rc.2 安装命令，精确版本 | 安装 0.4.12，exit 0，bundle 注册成功，无兼容性豁免 | [日志](cli-explicit.log)、[profile manifest](host-cases/cli-explicit/package.json) |

实际先运行的反馈命令形如：

```text
node <Desktop 自带 pnpm>/bin/pnpm.cjs --dir <隔离目录> add @takboo/dsh-coopanion --lockfile-only --ignore-scripts <隔离 cache/store 参数>
```

随后对实际 lockfile 断言版本为 0.4.12，得到 `Wrong package selected: expected 0.4.12, got 0.4.10`。改为精确版本后相同版本断言通过。真实宿主命令为 `plugin --profile repro add <包名或精确版本> --ignore-scripts`；[宿主调用夹具](host-cli.mjs)原字节保留，调用已发布 rc.2 的公共 `runCli()`，并传入 Desktop 自带 pnpm。这些文件只记录当时的诊断路径，不要求后续复用其本机绝对路径。

假设依次为发布时间保护、registry 元数据差异、独立信任策略。对照只更改发布时间参数或精确版本就消除回退；实际 registry 始终是 `https://registry.npmjs.org/`。空目录重复也排除了旧 profile lockfile 是必要条件。`--lockfile-only` 对照不安装产品，而真实宿主两组另外验证了安装后的兼容检查和回滚路径。

## 安装核验与边界

[安装结果](installation-results.json)记录最终断言：精确版本的 1238 个包文件与既有规范包逐字节一致，安装的 integrity 与本次 fresh [npm metadata](npm-packument.json)一致，且无需 DSH 风险豁免。本机日用 profile 的 package、lockfile、workspace、patch 和兼容性文件摘要在诊断前后相同。

本次安装使用 `--ignore-scripts`，未启动桌宠或操作日用界面；不把这里的解析／安装验证扩充为新的 GUI、原生窗口或长期采样验收。原 v0.4.12 的三平台十二组固定压缩包安装结果仍保留于[原发布记录](../releases/v0.4.12/README.md)，但它们没有覆盖发布后首日的裸包名解析。使用指南与项目首页现推荐精确版本，发布流程增加了该入口的核对要求。

[原字节清单](raw-index.json)绑定全部原始输入、输出和摘要。没有删除用户缓存、安装日用包、授予旧版兼容性豁免或更改已发布标签。裸包名的负向复现绑定上述发布时间窗口，保护期结束后不能继续据此断言它仍应选旧版。
