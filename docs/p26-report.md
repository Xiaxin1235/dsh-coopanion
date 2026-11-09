# P26 舞台接口与桌宠暂离

Coopanion fork 0.6.0 本地候选。实现位于 `whaledot-local`，供 WhaleMaid 1.6 按 [舞台协议](stage-protocol.md)接入。

## 查证和取舍

| 查证项 | 结论与出处 |
| --- | --- |
| 角色渲染 | `createWhaleBody` 将 `createWhaleFigure` 交给上游 body kit。桌宠与角色设置预览通过 `loadBody` 各自建立一个沙箱角色实例。舞台复用 `createWhaleFigure`、原始贴图、模型及表情参数，直接驱动绘制。普通 Chromium 实测通过。见 [figure.js](../web/upstream/whale/figure.js)、[body-host.js](../web/upstream/body-host.js) 和 [pet.js](../web/pet.js)。 |
| 投递与授权 | 原桌宠由 [figure-server.ts](../src/figure-server.ts) 的回环服务投递，远程 Harness 页面无法使用该地址。DSH 0.2.1-rc.3 和 0.2.2-rc.1 的 Connection 类型支持精确 GET、HEAD 和 POST 路由，载体在请求分发前校验 Host、Origin 与认证。[舞台路由](../src/stage-host.ts) 再校验 owner。见 [DSH Connection](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/connection/README.md)。 |
| iframe 与客户端组件 | 可选客户端组件能共享页面与模块加载，少一次 iframe 文档加载，但与嵌入方处于同一页面权限域。选用透明 iframe，CSP 保持不透明源，只有受限消息跨边界。预先合成单文档可避免沙箱内的认证子资源问题。首帧后最多每秒绘制 30 帧，隐藏和减少动态效果时停止持续绘制。见 [舞台渲染](../web/stage/index.js)、[构建](../scripts/build.mjs) 和 [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)。 |
| 桌宠显示控制 | `desiredVisible` 仍由显示、隐藏等原有命令维护。暂离是独立的内存状态，第一条响应流触发小跳与隐藏，最后一条断开时按当前显示意愿恢复。DSH HTTP bridge 的响应连接关闭会中止请求。见 [宿主控制](../src/controls.ts)、[桌面窗口](../desktop/main.cjs) 和 [舞台路由](../src/stage-host.ts)。 |

## 截图与动作

| 动作 | 实现 | 本机截图 |
| --- | --- | --- |
| 行走 | 原地步态，双腿交替抬落，位置及镜像由舞台变换控制 | `artifacts/p26-stage/walk.png` |
| 坐姿工作 | 现有坐姿下身、双手小幅交替动作、低头及眨眼 | `artifacts/p26-stage/sit-work.png` |
| 睡姿 | 现有闭眼表情、放松坐姿和缓慢呼吸 | `artifacts/p26-stage/sleep.png` |

三个 PNG 为 Chromium 实际渲染的透明截图，保存在本机验收目录。角色贴图、缩略图和默认桌宠行为沿用现有版本。

## 验收边界

舞台固定使用内置默认大肥鱼，需要浏览器 WebGL。失败通过 `render-failed` 回报，嵌入方负责回退。舞台文档约 1.72 MB。原生暂离按连接存续，反向代理需要允许流式响应以及向 Harness 传播连接关闭。自定义角色若无小跳动作则只暂时隐藏。
