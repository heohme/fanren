# 行为统计

Cloudflare Web Analytics 继续负责 Visits、Page Views 与 Core Web Vitals；站内关键行为写入现有 `COMMUNITY_DB` D1 数据库。两套统计互补，避免用虚拟网址伪装用户行为。

## 已记录事件

- `realm_open`：展开正道、魔道或天道盟。
- `realm_locked_click`：点击尚未开放的九国盟。
- `creator_open`：进入某位 UP 主归档。
- `video_open`：打开站内 B 站播放器或前往外部观看。
- `onboarding_start / step / complete / skip`：新用户指引漏斗。
- `analysis_mode / content_filter`：解析模式和内容筛选。
- `share_link_copy`：复制 UP 主专属入口。

事件只保存随机的单次浏览会话编号、公开内容 ID/标题、设备大类、国家/地区和来源标签，不保存原始 IP、Cookie、联系方式或浏览器指纹。

## 部署

代码发布前先执行新增迁移：

```bash
npx wrangler@4 d1 execute fanren-community --remote --file=migrations/0002_analytics.sql
```

部署完成后访问：

```text
https://fanrenmap.pages.dev/admin/analytics/
```

该页面与投稿后台共用 Cloudflare Access 保护范围；本地调试时也可以填写 `ADMIN_API_TOKEN`。

## 渠道标记

Cloudflare Web Analytics 不记录 UTM 查询参数。站内统计支持两个简短参数：

```text
https://fanrenmap.pages.dev/?f=xhs
https://fanrenmap.pages.dev/?f=bilibili
```

带参数进入后，本次浏览产生的关键行为会归入对应来源；不带参数时使用浏览器提供的来源域名，来源被平台隐藏时显示 `direct`。

## 公开链接参数

公开页面统一使用短参数：

- `f`：来源渠道，例如 `?f=xhs`、`?f=bilibili`
- `m`：访问模式，例如 `?m=admin`
- `e`：剧集，例如 `?e=184`
- `up`：UP 主快捷入口
- `bv`：B 站视频 BV 号

旧参数 `from`、`src`、`utm_source`、`mode`、`episode` 仍可读取，页面生成的新链接只使用短参数。
