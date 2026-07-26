# 凡人残图

> 一张持续补全的《凡人修仙传》追番情报地图

## 版本更新

- [V1.1：UP 名录、推荐模式、已看记录与加载优化](docs/updates/2026-07-19-v1.1.md)

凡人残图自动整理每周正片、分集解析、人物专题与公开物料，并按照集数和剧情线索归档。项目不搬运正片或创作者内容，所有入口都回到原始发布页。

新一季 **2026/6/13 起，每周六 11:00** 更新一集。
本项目自动抓取 B 站官方番剧与关注 UP 主的最新内容，通过一张可探索的古卷地图呈现本周正片、百家论道、人物行迹和物料见闻；历史内容则按「集数 × UP 主」聚合归档。

## 当前能力

- 本周残图：最新正片、解析进度、人物专题与物料入口
- 分集档案：官方剧集与常驻创作者内容矩阵
- 万象志：人物、专题、PV、合集与杂谈聚合
- 自动巡检：双源抓取、失败重试、历史快照兜底
- 历史回填：按集搜索解析视频，目标每集覆盖 10+ 位 UP，支持断点续跑
- 二创发现：每天两次检索近期内容、每周一次回查历史热门，并按人物志、剧情二创、趣味整活、混剪手书、音乐配音、同人创作归档
- 统一内容池：官方物料、逐集解析、人物专题、Reaction 与二创按 BV 号去重，各模块只负责筛选和展示
- 新内容提示：浏览器本地记录上次访问时间
- 道友共建：推荐 UP、作品或纠错补档，经过审核后进入九国盟推荐榜
- 投稿审核：D1 保存投稿与审核轨迹，Turnstile 防刷，Cloudflare Access 保护后台

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
│   ├── discovery-raw.json   # 二创原始候选层（自动生成）
│   ├── classification.json  # 模型分类缓存（自动生成）
│   ├── creation-metrics.json # 播放与互动指标（自动生成）
│   ├── discovery-review.json # 待人工复核内容（自动生成）
│   ├── creations.json       # 审核策略通过的发布层（自动生成）
│   └── snapshot.json        # 抓取快照（自动生成）
├── functions/             # Cloudflare Pages Functions 投稿与审核 API
├── migrations/            # D1 数据库迁移
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
  { "uid": "7946432", "name": "利维坦", "tier": "core", "alias": [], "note": "" }
]
```

UID 获取方式：访问 UP 主主页 `https://space.bilibili.com/<UID>`，URL 里的数字就是。
`tier` 使用 `core` 或 `standard`，分别对应每 30 分钟和每小时更新。

### 修改番剧配置

编辑 `data/series.json`。`newSeasonStartEp` 是新一季的起始集号（凡人是从 177 开始，前 176 集不显示在分集追踪里）。

## 部署到 Cloudflare Pages

项目当前部署在 [fanrenmap.pages.dev](https://fanrenmap.pages.dev/)，构建完成后会生成 `out/` 目录。

在 Cloudflare Pages 中连接本仓库并使用以下配置：

- Node.js：20.x
- 安装命令：`npm ci`
- 构建命令：`npm run build`
- 输出目录：`out`
- 主分支：`main`
- 环境变量：`NEXT_PUBLIC_SITE_URL=https://fanrenmap.pages.dev`

开启自动部署后，后续推送到 `main` 会自动更新 Pages 版本。也可以先在本地验证：

```bash
npm run build
```

## 部署到 Vercel（备用）

1. 把本仓库推到 GitHub
2. Vercel 导入仓库，框架自动识别为 Next.js
3. 部署完成

无需任何环境变量。`data/snapshot.json` 直接打进静态产物。

## 自动更新机制

```
GitHub Actions（普通白名单每小时、核心 UP 每 30 分钟、周六官方剧集每 10 分钟）
    ↓ 跑 scripts/fetch-bilibili.mjs
    ↓ 写入 data/snapshot.json
    ↓ 自动 commit + push
    ↓ Cloudflare Pages 检测到 push 自动重新部署
```

如果 GitHub Actions 抓取失败（B 站风控），脚本会自动重试并刷 cookie，且**保留历史快照**，单次失败不会丢数据。

## 九国盟投稿系统

投稿系统需要额外配置 Cloudflare D1、Turnstile 和 Access。完整接口、数据表、本地开发与上线步骤见 [九国盟投稿系统文档](docs/community-submissions.md)。

抓取任务按范围分为三档：`official` 只检查官方剧集，`core` 只更新 `data/ups.json` 中标记为核心的 UP，`all` 更新全部配置白名单。历史回填发现的其他 UP 只保留在快照中，不参与定时空间轮询。

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

`discover-creations.mjs` 使用 12 组关键词发现内容，并将“搜索、模型判断、发布决策”拆成相互独立的阶段：

1. **候选层**：合并近期搜索、历史回查和旧发布数据，保留首次发现时间、来源关键词与检索模式。
2. **分类层**：先用规则排除逐集解析、正片、预告、有声书等明显非目标内容，再由火山方舟豆包模型判断相关性、内容性质、原创程度、活动标签、作者潜力与风险标记。
3. **指标层**：为重点候选补充播放、点赞、投币、收藏、评论和弹幕，并保存历史采样，用于计算增长速度和互动表现。
4. **发布层**：独立策略综合原创性、增长速度、互动率、新鲜度、新作者与活动因素；高置信内容进入 `creations.json`，边界内容进入 `discovery-review.json`，模型不会直接决定首页发布。

GitHub Actions Secret 使用 `ARK_API_KEY`，默认模型为 `doubao-seed-2-0-mini-260428`，可通过 `ARK_CLASSIFIER_MODEL` 调整；接口地址也可通过 `ARK_API_URL` 覆盖。分类结果按 BV 号和协议版本缓存，日常运行通常只消耗新增候选的 Token。未配置密钥时，本地运行会复用已有缓存并跳过无法分类的新候选；线上任务设置了 `REQUIRE_CREATION_MODEL=1`，密钥缺失时会明确失败，避免静默产出不完整数据。

自动调度使用北京时间：

- 每天 09:40、19:40 执行 `fresh`，按发布时间检索近期内容。
- 每周一 10:40 执行 `history`，按综合热度回查历史内容。
- 也可以在 GitHub Actions 中手动选择 `fresh` 或 `history`。

### 统一内容池与模块视图

构建时会把 `snapshot.json` 中的官方剧集和 UP 投稿，与 `creations.json` 中通过策略的二创合并成统一内容池。同一 BV 号只保留一条标准记录，并统一补充：

- 内容形态：本集解析、剧情杂谈、改编讨论、人物赏析、设定考据、Reaction、剧情二创、趣味整活、混剪手书、音乐配音、同人创作。
- 剧情关联：集数、人物与 AI 声明标签。
- 发现来源：官方番剧、常驻 UP、分集搜索或二创发现。
- 推荐信息：推荐分、推荐通道、推荐理由和互动指标。

页面仍然按需加载轻量视图，避免一次下载完整资料库：

- **正道**只读取官方正片、预告和物料。
- **魔道**读取全部解析与二创档案，并提供集数、UP、人物和类型筛选。
- **正道盟**从同一内容池挑选本集热议、新人发现、沧海遗珠和关联旧作，不再维护独立内容来源。

### ⚠️ 建议仓库设为 Public

分层巡检会持续消耗 Actions 时长。本项目只保存公开内容的索引信息，使用公共仓库更适合当前更新方式。

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
