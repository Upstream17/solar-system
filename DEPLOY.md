# 部署到 Cloudflare Pages

## 一键部署（拖拽上传，5 分钟）

1. 登录 https://dash.cloudflare.com/
2. 左侧菜单 → **Workers 和 Pages** → **Create** → **Pages** → **Upload assets**
3. 项目名：`solar-system`（将获得 `solar-system.pages.dev` 域名）
4. **把整个项目文件夹拖到上传区域**（包含 `index.html` + `src/` + `wrangler.toml`）
5. 点击 **Deploy site** → 等待 ~30 秒 → 完成

## 自动部署（GitHub 集成，推荐）

代码已推送到 GitHub: https://github.com/Upstream17/solar-system

1. Cloudflare Dashboard → **Workers 和 Pages** → **Create** → **Pages** → **Connect to Git**
2. 选择 GitHub → 授权 Cloudflare → 选 `Upstream17/solar-system` 仓库
3. 配置：
   - Project name: `solar-system`
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: （留空）
   - Build output directory: `/`
4. **Save and Deploy** → 完成后每次 `git push` 自动部署

## CLI 部署（可选）

需要 Cloudflare API Token（[创建链接](https://dash.cloudflare.com/profile/api-tokens) → "Edit Cloudflare Pages" 模板）：

```bash
export CLOUDFLARE_API_TOKEN=your_token_here
npx wrangler pages deploy . --project-name=solar-system
```

首次部署会自动创建项目。

## 验证

部署完成后访问 `https://solar-system.pages.dev/` 应该看到 3D 太阳系场景。
