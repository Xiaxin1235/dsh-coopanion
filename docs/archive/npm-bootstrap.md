# npm 首次认证流程（历史参考）

> 仅用于包尚未创建或重新建立发布信任的场景；本仓库已有 OIDC 发布记录。日常发版见[发布流程](../releasing.md)，当前交付状态见[文档索引](../README.md)。

以下步骤用于 npm 包尚不存在时的首次启用。包创建且 Trusted Publisher 已验证后，后续版本只需提交版本更新、合并至 main 并推送稳定标签。发布状态以 [Release 工作流记录](https://github.com/takboo/dsh-coopanion/actions/workflows/release.yml) 和 npm registry 为准。

npm 要求包已存在才能绑定 Trusted Publisher，见 [npm trust 前置条件](https://docs.npmjs.com/cli/v11/commands/npm-trust/)。首次需要维护者使用自己的 npm 账号登录及完成 2FA，并发布完整 CI 通过的真实包；不要创建占位包。

1. 合并发布流程到 main，创建版本一致的稳定标签。首次 npm job 会因没有认证失败，完整验证产物仍保留在该 Release run 的 `desktop-pet` artifact 中。
2. 从该 run 下载 `desktop-pet`，在解压目录运行 `sha256sum --check SHA256SUMS`（macOS 可用 `shasum -a 256 -c SHA256SUMS`）。使用已验证的 `dsh-coopanion-<version>.tgz`，不要重新 pack。
3. 维护者执行 `npm login --registry https://registry.npmjs.org`，再执行 `npm publish /absolute/path/dsh-coopanion-<version>.tgz --access public --tag latest --ignore-scripts --registry https://registry.npmjs.org`，完成 npm 自己的身份校验。
4. 在 [包设置](https://www.npmjs.com/package/@takboo/dsh-coopanion/access) → Trusted Publishers 配置 GitHub Actions：owner **takboo**，repository **dsh-coopanion**，workflow **release.yml**，environment 留空，允许 **direct npm publish**。也可在登录后执行：

   ```bash
   npm trust github @takboo/dsh-coopanion --repo takboo/dsh-coopanion --file release.yml --allow-publish
   ```

5. 重跑首次失败的 job，确认 npm identity 匹配后继续附档。这个 job 会跳过已有的相同版本上传，因此不能证明 OIDC 已验证。再更新 package / shrinkwrap 版本和发布说明，合并至 main 并推送下一版本的稳定标签，确认 npm 上传步骤实际执行、registry integrity 与报告一致，并生成 provenance。新配置需在 **2 天内**首次成功使用，否则应在下次发版前重新配置，见 [npm 官方说明](https://docs.npmjs.com/trusted-publishers/)。OIDC 发布公开仓库 / 公开包时自动生成 provenance；不需要长期 `NPM_TOKEN`。
