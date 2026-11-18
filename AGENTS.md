# 项目约定 · 国博讲解手册

> 这是给未来接手这个项目的 DSH 会话 / 代码代理看的。改动前先读 `README.md` 和 `可行性报告.md`。

## 项目目标

给国博「古代中国」展区的讲解员，做一个单机优先的文物资料与讲解故事工作台：

- 三级结构：单元 → 文物 → 简介 / 讲解故事 / 档案 / 笔记。
- 可扩展：随时新增单元和文物，不改代码。
- AI 只起草，必须预览后应用；用颜色区分「要讲 / 不熟 / 以后讲」，不做校对状态。
- 手机网页优先，PWA 可安装、可离线。
- 数据留在本机，导出 / 导入 JSON；不引入账号和后端依赖。

不要把它做成通用 CMS、社交产品或多用户后台。它的价值是**讲解员一个人的工作流**。

## 技术底座

- 原生 HTML / CSS / JavaScript，无框架、无构建依赖。
- `app.js`：路由、渲染、状态、IndexedDB、AI、PWA 交互，全部在一个 IIFE 里。
- `seed.js`：8 个单元、13 件示例文物，`window.SEED_DATA`。
- `catalog.js`：321 件「古代中国」官网重点展品名录（含缩略图路径），`window.CATALOG_DATA`；由 `tools/build-catalog.mjs` 生成，不要手改。缩略图在 `assets/catalog/`。
- `content.js`：已备稿的简介、讲解故事和补充字段，`window.CONTENT_DATA`；key 为 `galleryId|名录名称`，可手工追加或由 Harness 批量生成。
- `server.mjs`：静态服务器 + `POST /api/ai` 代理，零依赖；会读取同目录 `.env` 里的 `DEEPSEEK_API_KEY`。
- AI 默认由浏览器直连 DeepSeek 官方；`server.mjs` 的 `/api/ai` 代理和 `.env` 仅作为公网部署时的可选方案。
- `sw.js`：离线缓存；改前端资源后必须把 `CACHE` 版本号 +1。
- `dist/国博讲解手册.html`：由 `tools/build-standalone.mjs` 生成，不要手改。
- 数据：优先 IndexedDB，localStorage 兜底；图片上传压缩成 data URL。

## 常用命令

```bash
node server.mjs                 # 本地预览 http://127.0.0.1:4173
node tools/build-standalone.mjs # 重新生成单文件版
node tools/build-catalog.mjs    # 重新抓取 321 件展品名录与缩略图（需要联网）
node --check app.js             # 语法检查
```

如果环境有 Node：

```bash
npm start
npm run build
```

UI 自动化测试需要：本地服务运行在 4173、Chrome 以 `--remote-debugging-port=9222` 启动，然后 `node tools/test-app.mjs`。测试会清空该 Chrome 配置下的数据，不要指向你的日常浏览器。

## 改动规则

1. **内容安全**：所有用户 / AI 内容进 DOM 前必须 `esc()`；URL 必须走 `safeUrl()`；不要插入未转义的 HTML。
2. **数据兼容**：`normalizeData()` 是新旧数据的兼容层。新增字段必须给默认值，不能假设旧数据有。
3. **AI 流程**：生成结果只进预览，`applyAI()` 才写回；只补齐空着的档案字段，不覆盖已有内容；写回后不改颜色标记。
4. **图片版权**：`assets/seed` 与 `assets/catalog` 的图片来自国博官网，仅限个人学习；新增图片要注明来源，公开 / 商用需授权。
5. **示例内容**：都是草稿，不把推测写成定论；不确定的写「（待核对）」。
6. **移动端验收已开始**：iPhone 390×844、横屏 844×390，华为折叠屏 800 宽；桌面 1280 / 1440 继续跑。Chromium 模拟不能替代真机 Safari / 华为浏览器，真机结果单独记。
7. **发布三件套**：改完跑语法检查 → 跑 48 项桌面 UI 测试 + 36 项手机视口测试 → 重建 `dist`，并在 `CHANGELOG.md` 记一笔。

## 目录约定

```
app.js / styles.css / index.html   应用本体
catalog.js                         321 件展品名录（生成）
content.js                         已备稿简介/故事（可追加）
stories.js                         16 篇已有故事的统一改写版
seed.js                            示例数据
server.mjs / start.cmd             本地运行
.env.example                       DeepSeek Key 配置模板
sw.js / manifest.webmanifest       PWA
assets/seed                        示例图
assets/catalog                     317 张名录图（前三件高清）
assets/icons                       PWA 图标
tools/                             构建、测试、mock、截图脚本
screenshots/                       界面截图
dist/                              生成物（单文件版）
release/                           对外压缩包
```

## 已知边界

- 单机存储，没有云同步和多设备。
- PWA 在华为浏览器上的「添加到桌面」入口取决于浏览器版本；网页本身能跑。
- 手机端验证已开始：iPhone 390×844 / 横屏、华为折叠屏 800 宽已跑 Chromium 模拟；真机 Safari、PWA 安装与离线仍需在设备上验。
- iPhone 的 Service Worker / 离线缓存需要 HTTPS；同一 Wi-Fi 的 `http://192.168.x.x:4173` 只能在线使用，添加主屏幕也不等于离线可用。
- AI 真实接口需要用户自己的 Key；仓库里的 mock 只验证流程。
- 名录只覆盖国博官网 8 个单元页列出的 321 条重点展品，不是展出的 2026 件全量；未列条目仍可手动新增。
- 名录缩略图来自国博官网，仅个人学习；大盂鼎、虢季子白盘暂无缩略图，列表用文字占位。
- 名录图大部分是 185px 展览缩略图，只适合列表；远古前三件已换成 1000px 高清图。

## 下一步优先级

1. 整合「编辑 / AI / 图片 / 排序」为一个整理工作流。
2. 首页和详情页减按钮、减层级。
3. 增加「讲解路线 / 顺序 / 每站停留时间」。
4. 再考虑录音回听、云同步、ArkTS WebView 壳。
