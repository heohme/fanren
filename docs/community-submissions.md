# 九国盟投稿系统

九国盟采用“静态站点 + Cloudflare Pages Functions + D1”的结构。公开举荐默认只需填写 UP 名称，或粘贴一个 B 站 UP 主页、视频链接；标题、UP 名、集数和分类由审核时补齐，管理员审核通过后才会进入道友推荐榜。

## 数据流

```text
投稿表单
  → 自动判断 UP 名称、UP 主页或视频链接
  → Turnstile 服务端验证
  → Pages Function 校验、限流与去重
  → D1 submissions 待审核
  → /admin/submissions 审核
  → community_items 正式内容
  → /api/community 对外展示
```

## 数据表

迁移文件位于 `migrations/0001_community.sql`，包含：

- `submissions`：保存原始投稿、查询凭证哈希和审核状态。
- `submission_events`：保存每一步审核轨迹。
- `community_items`：仅保存可以公开展示的审核结果。
- `submission_rate_limits`：保存按小时轮换的匿名限流键，不保存原始 IP。

## API

公开接口：

- `POST /api/submissions`：提交推荐或纠错。
- `GET /api/submissions/:id/status?token=...`：凭投稿编号和查询凭证查看进度。
- `GET /api/community`：读取已经审核通过的公开内容。

审核接口：

- `GET /api/admin/submissions?status=pending`
- `POST /api/admin/submissions/:id/approve`
- `POST /api/admin/submissions/:id/reject`
- `POST /api/admin/submissions/:id/duplicate`

审核接口必须由 Cloudflare Access 保护。`ADMIN_API_TOKEN` 只用于本地开发或紧急恢复，不建议作为日常生产登录方式。

## Cloudflare 上线配置

### 1. 创建 D1

在 Cloudflare 控制台创建名为 `fanren-community` 的 D1 数据库，然后在 Pages 项目中添加绑定：

```text
变量名：COMMUNITY_DB
资源：fanren-community
```

也可使用 Node.js 22 和 Wrangler 4：

```bash
npx wrangler@4 d1 create fanren-community
npx wrangler@4 d1 execute fanren-community --remote --file=migrations/0001_community.sql
```

### 2. 创建 Turnstile

创建一个仅允许 `fanrenmap.pages.dev` 的 Turnstile 小组件，然后配置：

- Pages 构建变量：`NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- Pages Functions 密钥：`TURNSTILE_SECRET_KEY`

前端 site key 可以公开，secret key 只能以加密密钥形式保存。

### 3. 配置运行变量

生产环境变量：

```text
PUBLIC_HOSTNAME=fanrenmap.pages.dev
ADMIN_EMAILS=管理员邮箱
RATE_LIMIT_PER_HOUR=5
```

生产环境密钥：

```text
TURNSTILE_SECRET_KEY=Turnstile Secret Key
RATE_LIMIT_SALT=至少 32 位随机字符串
```

不要在生产环境设置 `ALLOW_INSECURE_LOCAL=true`。

### 4. 保护审核后台

在 Cloudflare Zero Trust → Access 中建立只允许管理员邮箱访问的应用路径：

```text
fanrenmap.pages.dev/admin/*
fanrenmap.pages.dev/api/admin/*
```

两个路径都要保护：只保护页面、不保护 API 仍然会暴露审核操作。

### 5. 应用迁移

首次上线前执行 `migrations/0001_community.sql`。以后每次表结构变化都新增迁移文件，不要直接修改已经上线的历史迁移。

## 本地开发

复制 `wrangler.example.jsonc` 为 `wrangler.jsonc`，本地可使用 `database_id: "local"` 和测试变量。

```bash
npm run build
npx wrangler@4 d1 execute COMMUNITY_DB --local --file=migrations/0001_community.sql
npx wrangler@4 pages dev out --port 4174
```

本地可以配置：

```text
ALLOW_INSECURE_LOCAL=true
ADMIN_API_TOKEN=fanren-local-admin
RATE_LIMIT_SALT=fanren-local-rate-limit
RATE_LIMIT_PER_HOUR=20
```

打开：

- 投稿前台：`http://127.0.0.1:4174/` → 九国盟
- 审核后台：`http://127.0.0.1:4174/admin/submissions/`

## 隐私与安全约定

- 不使用 Canvas、WebGL、字体列表等强浏览器指纹。
- 原始 IP 不写入数据库；限流只保存带轮换盐值的哈希。
- 联系方式为可选字段，仅管理员接口可读取。
- 公开接口不会返回联系方式、查询凭证、内部备注或审核人员。
- 投稿内容不支持 HTML 和文件上传。
- 投稿不会自动公开，必须经过人工审核。
- 查询凭证只保存 SHA-256 哈希，数据库中没有可直接使用的明文凭证。

## 审核建议

1. 检查链接是否属于投稿人描述的 UP 或作品。
2. 补齐或修正标题、UP 名、集数和分类；轻量投稿不会要求访客填写这些字段。
3. 检查是否已被自动抓取或已有相同投稿。
4. 公开回复只写给投稿人看的说明；内部备注不要包含在公开回复中。
5. 通过后到“道友推荐”确认展示结果。
