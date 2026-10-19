# Chrome 156 的 2D 像素回读差异

原始 `before.json` / `before.jpg` 是最终矩阵中的失败记录：腕部 alpha254、袖口0变化，只有 `ownerChangedPixels:3`。该字段原实现逐通道字节计数，不能把它解释为3个完整像素。

`differential.json` 在完整 Chrome 156.0.8078.4、1280×1000 下逐个改变一项：当前合成器和 `137a360` 原始合成器都得到3个字节差；为频繁读取的临时2D画布提前指定 `willReadFrequently:true` 后为0，指尖仍实际参与画面，WebGL手部 alpha254。旧/新合成器对照排除了本期可选高度参数的影响。该现象与具体绘制／回读后端相关；单独 Headless Shell 和本机内嵌浏览器当时为0，不能推广到所有浏览器。

`baseline-composition.js`、`baseline-continuity.js` 是基础提交的原始源字节。`probe.mjs` 是当时的原始临时探针，保留捕获时本机路径；不再改写它。可移植重放使用 `replay.mjs`，通过隔离浏览器的请求替换载入冻结夹具，不修改真实文件。先启动4189服务，再运行：

```bash
node docs/design/art-workflow/space-v1/evidence/pixel-readback/replay.mjs
```

当前修改只针对像素检查临时画布的回读上下文，仍要求相同拥有权姿势0字节差、腕部alpha≥248、袖口0变化和实际指尖运动。不修改生产画布、素材、动作或原始报告，也不放宽阈值。
