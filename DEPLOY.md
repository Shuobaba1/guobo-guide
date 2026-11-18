# 用 GitHub Pages 上线（0.8.0）

目标：把项目发布成一个公开的 GitHub 仓库，用 GitHub Pages 提供 HTTPS 地址，然后在 iPhone Safari 里“添加到主屏幕”。装好之后电脑可以关机，日常在国博离线使用。

> 这篇是给仓库所有者看的操作步骤，不需要改代码。

## 0. 发布前检查

- 电脑上开 VPN，保证能登录 GitHub、推送仓库。
- 确认 `.env` 不在待提交文件里。它包含你的 DeepSeek Key，`.gitignore` 已经排除；**如果 GitHub Desktop 左侧出现 `.env`，不要勾选，先停下来检查**。
- `release/` 里的压缩包已被忽略，不会上传；`dist/` 会一起上传（约 5.6 MB），方便别人直接下载单文件版。
- 本仓库包含国博官网图片。公开仓库等于公开再分发这些图片；如果介意版权，先把 `assets/seed/`、`assets/catalog/`、`screenshots/` 从仓库中移除，或改用私有部署。代码本身是 MIT，图片不在 MIT 范围内，详见 `NOTICE.md`。

## 1. 安装 GitHub Desktop

没有 git 也可以，GitHub Desktop 自带 git：

1. 打开 <https://desktop.github.com/> 下载 Windows 版；
2. 安装后登录 GitHub 账号（VPN 保持开启）；
3. 如果还没有账号，先在 <https://github.com/signup> 注册。

## 2. 把项目变成一个本地仓库

1. GitHub Desktop → **File → Add local repository**；
2. 选择这个文件夹：`C:\Users\Yshuo\Desktop\Chinese National Musuem Project`；
3. 如果提示 “not a Git repository”，点 **create a repository**：
   - Name：`guobo-guide`
   - Description：`国博「古代中国」讲解员随身手册 · 离线优先 PWA`
   - Local path：保持当前文件夹
   - 不要勾 “Initialize with README”（项目里已经有 README）
   - 点 **Create repository**。

## 3. 第一次提交

1. 左侧 **Changes** 会列出所有文件；
2. 确认列表里**没有 `.env`**；
3. 底部 Summary 填：`v0.8.0 卡片菜单、3 秒撤销与长按修复`；
4. 点 **Commit to main**。

## 4. 发布到 GitHub

1. 点右上角 **Publish repository**；
2. 取消勾选 **Keep this code private**（免费 GitHub Pages 需要公开仓库）；
3. 点 **Publish repository**；
4. 等待推送完成。项目约 20–25 MB，VPN 慢的话可能要几分钟。

## 5. 打开 GitHub Pages

仓库里已经带了 `.github/workflows/pages.yml`，用 GitHub Actions 部署，避免旧版 Pages 构建卡住。

1. 在浏览器打开你的仓库：`https://github.com/你的用户名/guobo-guide`；
2. **Settings → Pages**；
3. **Build and deployment → Source** 选 **GitHub Actions**；
4. 打开 **Actions → Deploy static site to Pages**，确认最近一次是绿色；
5. 等 1 分钟，刷新 Pages 页面，会显示：

```
https://你的用户名.github.io/guobo-guide/
```

如果 Source 里没有 GitHub Actions，先确认 `.github/workflows/pages.yml` 已经提交到 `main`。

第一次打开如果 404，先等一会儿；仍然是 404 就检查：

- 仓库根目录有没有 `index.html`；
- Actions 里 `Deploy static site to Pages` 有没有失败；
- 仓库是不是 Public；
- Pages 的 Source 是不是 **GitHub Actions**。

## 6. iPhone 安装

1. iPhone 和电脑不需要同一 Wi-Fi，能上网即可；
2. Safari 打开 `https://你的用户名.github.io/guobo-guide/`；
   - 如果 `github.io` 打不开，iPhone 也开 VPN 再试；
3. 点底部 **分享 → 添加到主屏幕**；
4. 从主屏幕打开一次，等页面和图片缓存完；
5. 打开飞行模式，确认还能打开、还能添加文物；
6. 设置 → AI 起草 → 用 DeepSeek 官方 → 填 Key → 保存 → 测试连接。

**AI 时把 VPN 关掉。** DeepSeek 是国内服务，直连即可；VPN 可能让请求绕路或失败。

## 7. 以后更新

1. 本地改完，GitHub Desktop 里 Commit；
2. 点 **Push origin**；
3. GitHub Pages 会自动重新发布；
4. iPhone 上把 App 关掉重开，或刷新两次，让新的 service worker 生效。

如果改了前端资源，记得把 `sw.js` 的 `CACHE` 版本号 +1；当前是 `guobo-guide-v23`。

## 8. 打一个 v0.8.0 Release（可选）

1. 仓库首页 → 右侧 **Releases → Create a new release**；
2. Tag：`v0.8.0`；
3. Title：`0.8.0 卡片菜单与长按修复`；
4. 上传 `release/国博讲解手册-原型-v0.8.0.zip`；
5. Publish release。

## 常见问题

**手机能开网页，但添加主屏幕后打不开？**
先确认第一次是在 Safari 里打开、并且完整加载过；GitHub Pages 必须 HTTPS。还不行就删除主屏幕图标，重新添加。

**iPhone 上 AI 报网络错误？**
先关 VPN，再确认 Safari 能打开 `https://api.deepseek.com`（不需要登录）。Key 填在设置里，不在 `.env`。

**电脑关机后还能用吗？**
装好并缓存后可以。GitHub Pages 只在首次安装和更新时需要；日常添加、编辑、复习都在手机本地。

**数据和电脑同步吗？**
不同步。手机和电脑各自一份，用设置里的导出/导入 JSON 迁移。

**公开仓库会不会泄露 Key？**
不会，Key 只在你手机浏览器的设置里；`.env` 被 `.gitignore` 排除，不要手动上传。
