# 凡人残图

> 凡人修仙传新一季更新追踪 · 官方剧集与解析 UP 主聚合视图

新一季 **2026/6/13 起，每周六 11:00** 更新一集。
本项目自动抓取 B 站官方番剧 + 关注 UP 主的最新解析视频，按「集数 × UP 主」聚合展示，让你一眼看到「这一集谁还没出解析」。

## 目录结构

```
fanren/
├── app/                  # Next.js 14 App Router 页面
├── components/           # React 组件
├── lib/                  # 类型 / 聚合逻辑
├── scripts/              # 抓取脚本
│   ├── fetch-bilibili.mjs   # 主入口
│   ├── wbi.mjs              # B 站 WBI 签名
│   ├── bili-cookie.mjs      # 匿名 cookie 获取
│   └── match-episode.mjs    # 标题集数提取
├── data/
│   ├── series.json          # 番剧配置
│   ├── ups.json             # UP 主名单
│   └── snapshot.json        # 抓取快照（自动生成）
└── .github/workflows/
    └── fetch.yml            # 10 分钟定时抓取
```

## 快速开始

```bash
npm install
npm run fetch        # 抓一次数据
npm run dev          # 本地预览 http://localhost:3000
```

## 配置

### 修改 UP 主名单

编辑 `data/ups.json`：

```json
[
  { "uid": "7946432", "name": "利维坦", "alias": [], "note": "" }
]
```

UID 获取方式：访问 UP 主主页 `https://space.bilibili.com/<UID>`，URL 里的数字就是。

### 修改番剧配置

编辑 `data/series.json`。`newSeasonStartEp` 是新一季的起始集号（凡人是从 177 开始，前 176 集不显示在分集追踪里）。

## 部署到 Vercel

1. 把本仓库推到 GitHub
2. Vercel 导入仓库，框架自动识别为 Next.js
3. 部署完成

无需任何环境变量。`data/snapshot.json` 直接打进静态产物。

## 自动更新机制

```
GitHub Actions（每 10 分钟）
    ↓ 跑 scripts/fetch-bilibili.mjs
    ↓ 写入 data/snapshot.json
    ↓ 自动 commit + push
    ↓ Vercel 检测到 push 自动重新部署
```

如果 GitHub Actions 抓取失败（B 站风控），脚本会自动重试并刷 cookie，且**保留历史快照**，单次失败不会丢数据。

### ⚠️ 仓库必须设为 Public

GitHub Actions 对**公共仓库完全免费、无时长限制**；私有仓库每月仅 2000 分钟，10 分钟轮询会超额。本项目数据为公开内容，建议直接 public。

## 反风控策略

B 站对 UP 主投稿接口有强风控（短时间多次请求返回 -352/-412）。已采用三层兜底：

1. **双源抓取**：`web-dynamic/v1/feed/space`（无签名）+ `space/wbi/arc/search`（带 WBI 签名）
2. **失败重试**：拉到空数据时刷新 cookie 重试，最多 3 轮
3. **增量合并**：每次抓取与上次 snapshot 合并，按 bvid 去重

## 集数识别

`match-episode.mjs` 的正则会匹配以下标题格式：

- `凡人第3集解析`
- `【凡人】EP01 深度解读`
- `凡人修仙传 E5 评论`
- `【凡人】03集精讲`

如果标题不含集数（PV / 人物志 / 闲聊），会归入「开播前预热」面板。

## 红点提示

前端用 `localStorage` 记录上次访问时间。新于该时间的视频会高亮显示 `NEW`，对应 EP 卡片右上角会有跳动的红点。

## License

MIT
