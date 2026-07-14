# 凡人残图

> 一张持续补全的《凡人修仙传》追番情报地图

凡人残图自动整理每周正片、分集解析、人物专题与公开物料，并按照集数和剧情线索归档。项目不搬运正片或创作者内容，所有入口都回到原始发布页。

新一季 **2026/6/13 起，每周六 11:00** 更新一集。
本项目自动抓取 B 站官方番剧与关注 UP 主的最新内容，通过一张可探索的古卷地图呈现本周正片、百家论道、人物行迹和物料见闻；历史内容则按「集数 × UP 主」聚合归档。

## 当前能力

- 本周残图：最新正片、解析进度、人物专题与物料入口
- 分集档案：官方剧集与常驻创作者内容矩阵
- 万象志：人物、专题、PV、合集与杂谈聚合
- 自动巡检：双源抓取、失败重试、历史快照兜底
- 历史回填：按集搜索解析视频，目标每集覆盖 10+ 位 UP，支持断点续跑
- 二创发现：每周两次集中搜索二创，并按人物志、剧情二创、趣味整活、混剪手书、音乐配音、同人创作归档
- 新内容提示：浏览器本地记录上次访问时间

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
│   ├── creations.json       # 二创搜索与分类索引（自动生成）
│   └── snapshot.json        # 抓取快照（自动生成）
└── .github/workflows/
    └── fetch.yml            # 常规定时抓取 + 周六高峰巡检
```

## 快速开始

```bash
npm install
npm run fetch        # 抓一次数据
npm run backfill     # 从最新集开始分批回填历史解析
npm run coverage     # 查看最近 20 集的 UP 覆盖率
npm run discover:creations # 刷新二创发现与分类索引
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
GitHub Actions（常规每 30 分钟，周六更新时段每 5 分钟）
    ↓ 跑 scripts/fetch-bilibili.mjs
    ↓ 写入 data/snapshot.json
    ↓ 自动 commit + push
    ↓ Vercel 检测到 push 自动重新部署
```

如果 GitHub Actions 抓取失败（B 站风控），脚本会自动重试并刷 cookie，且**保留历史快照**，单次失败不会丢数据。

### 历史解析批量回填

日常巡检只更新固定 UP 的最新投稿；历史建库由 `backfill-episodes.mjs` 独立完成：

1. 从最新集向第 1 集倒序搜索“分集解析”与“逐帧解读”
2. 精确校验标题中的集数，排除官方账号和跨集合集
3. 每集目标收录至少 12 位独立 UP，按 BV 号去重
4. 每完成一集立即保存进度，可在风控或任务超时后继续
5. 每 6 小时自动处理一小批，日常巡检会保留已发现的历史 UP，不再覆盖掉

可手动指定范围：

```bash
node scripts/backfill-episodes.mjs --from=182 --to=153 --max-episodes=10
node scripts/episode-coverage.mjs --from=182 --to=153
```

### 二创智能分类

`discover-creations.mjs` 先搜索六组二创关键词，再执行两级分类：

1. 高置信度标题规则直接归类，同时排除逐集解析、正片、预告、有声书等非目标内容
2. 配置 `OPENAI_API_KEY` 后，使用结构化输出批量复核标题、简介、UP 主与时长；模型只能选择固定分类，并返回置信度、原因和是否收录
3. 未配置密钥时自动使用规则结果，不会阻断定时更新

默认模型可通过 `OPENAI_CLASSIFIER_MODEL` 调整；低于 0.5 置信度或判定为非二创的内容不会进入页面。

### ⚠️ 建议仓库设为 Public

高频巡检会消耗较多 Actions 时长。本项目只保存公开内容的索引信息，使用公共仓库更适合当前更新方式。

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
