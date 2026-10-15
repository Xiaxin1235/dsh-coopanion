# npm 与 dshmarket 发布

开发和 CI 固定 Node.js **24.21.0**（`.node-version`）及 npm **11.19.1**（`packageManager`）。依赖保持 `npm-shrinkwrap.json`；官方宿主包继续声明为 peers，安装包保留 AGPL 对应源码、构建脚本、锁文件及第三方声明。

npm 包名为 **`@takboo/dsh-coopanion`**，采用维护者的 scope，并以 public 发布。`npm pack` 默认产生 `takboo-dsh-coopanion-<version>.tgz`；CI 将同一文件重命名为 `dsh-coopanion-<version>.tgz`，再复制固定别名 `dsh-coopanion.tgz`，不重新打包。宿主 bundle 的模块路径及浏览器模块标识使用完整 npm 包名；配置 id 和设置 namespace 继续使用 `dsh-coopanion`。

## 自动发布

`.github/workflows/ci.yml` 在 Linux、macOS、Windows 上运行元数据、类型、单元、浏览器及真实 Electron 窗口测试，并在三平台分别验证 DSH **0.2.0-rc.2 / 0.2.1-alpha.1** 安装。Linux 构建是规范分发产物；六组安装测试消费这一份 `.tgz`。所有检查通过才允许发布。

Linux 原生和安装测试使用 Xvfb + Openbox，由 `setup-linux-display` 等待 X11 与 EWMH 窗口管理器就绪；避免无窗口管理器时 Electron 将工作区窗口宽高各约束少 1 像素。原生指针测试以 X11 根窗口为绝对坐标目标，同一次 CSS / 原生测量驱动系统鼠标与 CDP，继续检查实际鼠标坐标及完整工作区边界。

PR CI 的 `desktop-pet` artifact 用于审阅分发候选，`verification.json` 绑定实际 checkout commit、版本与包摘要。合并后的稳定标签会对标签指向的源码重新运行完整 CI，生成该次发布的 canonical 包；六组安装、npm 和 GitHub Release 继续消费该包，固定别名通过复制保留相同字节。发布审批覆盖合并、稳定标签和随后自动执行的 npm／Release 发布。

稳定标签 `v<major>.<minor>.<patch>` 的新建 push 派发 **main 上的 `release.yml`**。标签入口仅有 Actions 派发权限；npm job 才拥有 `id-token: write`，GitHub Release 使用另一个 `contents: write` job。fork、其他分支、移动或删除标签不会进入自动发布路径；预发布标签不会发布到 `latest`。

发布前验证标签是 `origin/main` 的祖先、package / shrinkwrap 版本一致、对应版本发布说明存在，然后检出不可变提交，运行完整 CI。构建并打包一次；后续安装、npm、GitHub Release 都使用同一压缩包，发布时 `--ignore-scripts`，不再次执行构建。报告记录版本、源码 commit、SHA-256 和 npm SHA-512 integrity；发布前还会重新检查标签没有移动。

发布顺序为 **完整 CI → npm → GitHub Release**。Release 包含版本化 `.tgz`、相同字节的 `dsh-coopanion.tgz`、示例角色、`SHA256SUMS`、`verification.json` 和仅当前版本的说明。固定名称供市场下载链接使用，避免 `latest/download/<带版本文件名>` 在升级后失效。

npm 接受上传后可能异步处理数分钟。发布后的 `--require-published` 校验对尚未同步的 404 每 10 秒重试，最多等待 5 分钟；已存在但字节不同、其他 HTTP 错误或等待超时仍会失败。上传前的版本检查保持单次查询，未发布版本可进入上传步骤。

发布新版本：

```bash
npm version patch --no-git-tag-version
# 更新 docs/release-notes.md 对应版本，提交并合并至 main。
npm run verify:metadata
# main 的 CI 通过后，对该发布提交创建标签。
git tag v<package.json.version>
git push origin v<package.json.version>
```

上面标签命令中的 `<package.json.version>` 替换为实际版本。手动操作选择 **Release → Run workflow → main**，提供已有标签；默认 `mode=verify` 只验证，选择 `publish` 才发布。

npm 已成功而附档失败时，优先在 7 天 artifact 保留期内重跑失败的附档 job。整个 publish job 重跑时，只有已发布版本的 integrity 与验证产物完全相同才会跳过 publish；不同字节占用同一版本会失败，必须增加版本。不要修改已经发布的标签，也不要重打包替换该版本。

## npm 认证状态

本仓库已有 npm OIDC 实际发布记录，见 [v0.4.9 交付证据](evidence/releases/v0.4.9/README.md)。日常发版沿用上述流程；认证失败时先核对实际 Trusted Publisher 设置与失败日志。包首次创建及信任绑定流程保留在[历史参考](archive/npm-bootstrap.md)。

## dshmarket 上架

[dshmarket 投稿说明](https://github.com/dsh-market/dsh-market#submit-your-plugin) 指向 [awesome-dsh-plugin 贡献规范](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)。市场只从社区目录读取条目，npm 发布本身不会完成收录。

目录提交状态见[文档索引](README.md)。投稿时核对有效 `dsh.bundle`、对应 patch、仓库公开时长、实际代码、license、双语描述和宿主 peers。为 GitHub 仓库添加 `dsh-plugin` topic；`deepseek-harness` 可帮助其他目录发现。投稿仅新增 `data/plugins/takboo__dsh-coopanion.yml`，内容从 [准备的条目](market/takboo__dsh-coopanion.yml) 复制；不要修改生成的 README，也不要手写 `npm:` 字段。

**首次正式提交前确认固定 tarball URL 返回真实可安装的包**；发布流程准备阶段可用 draft PR，产物上线后再标记 ready。目录维护者合并后，市场按成功的目录构建更新；不能把提交 PR 或 npm publish 当作已经可搜索。npm 包的 `repository` 指回本仓库，目录会自动建立映射，市场优先使用 npm，再使用预构建 Release。

截图可随后在仓库根声明 `screenshots.json`（1–8 张仓库内实际截图）；没有真实截图时不放占位图。新增版本不需要重复提交目录 PR，继续保持 npm metadata 和固定 Release URL 即可。

## dshmarket 修改记录

正式 GitHub Release 必须包含当前版本的完整修改说明，稳定标签与 npm 版本一致。`docs/release-notes.md` 是说明源，发布工作流只提取当前版本节写入 Release 正文，并随已验证压缩包附档；只上传 Markdown 附件而没有正文不能提供市场所需内容。README 的“最新修改记录”也指向正式 Release。

当前市场从社区目录的每日更新探测读取 GitHub Release 正文与提交记录（`dsh-plugin-updates`／`updates.json`）。目录条目尚未合并时，npm 发布不保证市场显示详细修改记录；合并后还需等待目录探测发布新的记录。交付时分别核对 Release 正文、npm 身份、固定下载别名，以及在线目录和更新记录，保留待同步状态。
