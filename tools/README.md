# 开发脚本

这些脚本用于维护原型，不是应用运行所必需的。

| 脚本 | 用途 |
| --- | --- |
| `build-standalone.mjs` | 把多文件应用内联成 `dist/国博讲解手册.html`，图片转 base64 |
| `build-catalog.mjs` | 抓取国博官网 8 个单元页的展品与缩略图，生成 `catalog.js`（需要联网；优先读 `tools/cache/`） |
| `optimize-catalog-images.py` | 压缩 `assets/catalog/` 的缩略图（Pillow） |
| `mock-ai.mjs` | 在 `127.0.0.1:4174` 起一个假的 OpenAI 兼容接口，验证生成 → 预览 → 应用 |
| `test-app.mjs` | 41 项桌面端到端 UI 检查；需要 4173 服务 + Chrome CDP 9222 |
| `test-mobile.mjs` | 29 项 iPhone 视口检查（390×844 + 横屏 844×390）；同样需要 4173 + CDP 9222 |
| `cdp-shot.mjs` | 用 Chrome DevTools Protocol 给指定 URL 截图，调试响应式布局 |

## 跑 UI 测试

```powershell
# 终端 1
node server.mjs

# 终端 2：启动可调试的 Chrome（使用一次性配置目录）
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --remote-debugging-port=9222 `
  --user-data-dir="$env:TEMP\guobo-chrome" about:blank

# 终端 3
node tools/test-app.mjs
```

测试会通过 `Storage.clearDataForOrigin` 清空 `http://127.0.0.1:4173` 的本地数据，所以不要把它指向日常浏览器配置。

## 更新展品名录

```powershell
node tools/build-catalog.mjs
python tools/optimize-catalog-images.py
```

官网会对连续请求返回反爬脚本页。`tools/cache/detailN.html` 是用无头 Chrome 正常执行页面脚本后保存的 8 个单元页；`build-catalog.mjs` 会优先读缓存。图片缺失时同样可以用 Chrome 打开对应单元页重新抓取。

远古前三件（涡纹、小口尖底、陶猪）在脚本里配了单件藏品页的高清图地址；`build-catalog.mjs` 只补缺失图片，不会覆盖 `assets/catalog/` 里已有的高清图。

## 跑 AI mock

```powershell
node tools/mock-ai.mjs
# 然后在应用「设置 → 接口地址」填：
# http://127.0.0.1:4174/v1/chat/completions
# Key 随便填，模型随便填
```

## 截图

```powershell
node tools/cdp-shot.mjs "http://127.0.0.1:4173" "screenshots/home-desktop.png" 1440 1100 2400
```

需要 Chrome 已用 9222 端口启动。脚本会清空 4173 的本地数据，保证截到的是示例数据。
