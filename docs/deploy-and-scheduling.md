# 部署与定时同步说明

## 1. 结论先说

**本机的 WorkBuddy 自动化任务不是生产定时方案。** 它们依赖「本机开机 + WorkBuddy 客户端常驻 +
`localhost:3000` 的 dev server 在跑」，且请求的是 `localhost` 而非线上域名。网页上线后若要自动更新数据，
必须改为**平台/外部 cron 打线上接口**。

> 唯一的「半通」情形：数据库是 **Neon 远程库**，只要线上与本机用同一个 `DATABASE_URL`，
> 本机任务写入的数据线上立刻可见（页面均为 `force-dynamic`，无 ISR 缓存）。
> 但这依然依赖本机常开，不可靠。

## 2. 部署前提

| 项 | 要求 |
|---|---|
| 运行时 | **Node 运行时**（`next build` + `next start`，或 Vercel / Render 等）。有 API Route + Prisma，**静态托管（如纯云盘/CloudStudio 静态站）跑不了** |
| 数据库 | PostgreSQL（当前为 Neon）。线上建议复用同一 Neon 库，或另建库后跑一次全量同步 |
| 构建 | `npm run build` → `npm run start`；无需 `output: export` |

### 环境变量清单（线上需配置）

| 变量 | 必需 | 说明 |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL 连接串（Neon） |
| `CRON_SECRET` | ✅ | 定时接口鉴权密钥（自行生成一串随机值） |
| `FOOTBALL_DATA_API_KEY` | ✅ | 赛程主源 football-data.org |
| `API_FOOTBALL_KEY` | ○ | 可选（免费版仅覆盖 2022–2024） |
| `NEWS_API_KEY` / `AI_SCRAPER_API_KEY` | ○ | 新闻相关；AI 摘要用 `grok-4.6`（经 YesCode） |
| `AI_SCRAPER_BASE_URL` / `AI_SCRAPER_MODEL` | ○ | 默认 `https://co-cdn.yes.vg/v1` / `grok-4.6` |
| `SEASON_START_YEAR` | ○ | 默认 `2026`（26/27 赛季） |
| `NEXT_PUBLIC_SITE_URL` | ○ | 站点根地址 |

## 3. 定时同步入口

平台 cron 一般只能发 **GET**，而 `/api/sync/fixtures` 的写操作在 POST 上，因此新增了专用入口：

```
GET|POST /api/cron/sync                 → refresh（默认）
                                        # 回填已完赛比分 + 抓 FotMob 比赛中心 + 聚合球员赛季数据
GET|POST /api/cron/sync?mode=merge      → 三源合并赛程（football-data + arsenal.com + Wikipedia）
GET|POST /api/cron/sync?mode=both       → 两者都跑
```

鉴权（任选其一，无密钥返回 401 统一信封）：

- `Authorization: Bearer <CRON_SECRET>` ← Vercel Cron 会自动带上
- `x-cron-secret: <CRON_SECRET>`

## 4. 已选定方案：GitHub Actions

> **决策（2026-09-13）**：定时同步放 **GitHub Actions**；站点托管在 **Render**。
> 不建 Render cron service（省下那 $1/月最低消费），原 `vercel.json` 已删除。

工作流已就绪：`.github/workflows/sync.yml`

- **每小时第 5 分** → `mode=refresh`（比赛结束后 ~1 小时内回填比分与球员数据）
- **每天 21:00 UTC（北京 05:00）** → `mode=merge`（合并新公布的赛程）
- 支持手动 `workflow_dispatch` 选 `refresh|merge|both`

### 4.1 前置：代码必须先在 GitHub 上（当前尚未 init）

当前项目**还不是 git 仓库**（`arsenal-fan-site` 与工作区根目录都不是）。
`schedule` 只在**默认分支**生效，所以先做：

```bash
cd arsenal-fan-site
git init -b main
git add .
git commit -m "chore: initial commit"
# 在 GitHub 上新建一个空仓库后：
git remote add origin git@github.com:<你的账号>/arsenal-fan-site.git
git push -u origin main
```

`.gitignore` 已正确忽略 `/node_modules`、`/.next/`、`.env*`、`/app/generated/prisma`——
**`.env` 不会被推上去**，密钥请改用 Render 环境变量 + GitHub Secrets。

### 4.2 配置两个 Secret

GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret | 值 |
|---|---|
| `SYNC_BASE_URL` | Render 分配的域名，如 `https://arsenal-fan-site.onrender.com`（**不带结尾斜杠**） |
| `CRON_SECRET` | 与 Render 环境变量 `CRON_SECRET` **完全一致** |

### 4.3 验证

- 仓库 → Actions → 「Arsenal 数据同步」→ Run workflow → 选 `both`，确认 200 且返回
  `merge` / `refresh` / `matchReports` 都有数据。
- 之后每整点自动跑；失败会在 Actions 页面标红。

### 4.4 其它方案（未采用，备查）

- **Render Cron Job**：按运行分钟计费（最小规格 $0.00016/分钟），但**每服务有 $1/月最低消费**；
  每小时任务实际用量约 $0.06，会被兜底到 $1/月。省心但多花 $1。
- **外部 cron 服务**（cron-job.org 等）：POST `https://<域名>/api/cron/sync?mode=refresh` + `x-cron-secret`。

> ⚠️ GitHub 会在仓库 **60 天无提交**后自动暂停 `schedule`，需到 Actions 页面点一下 Enable。

## 5. 在 Render 上部署

`render.yaml` 已就绪（只含 Web 服务，不含 cron）。用 Render 控制台 **New → Blueprint** 选本仓库即可；
也可手动建 Web Service，按下表填：

| 项 | 值 |
|---|---|
| Runtime | Node |
| Build Command | `npm ci && npx prisma generate && npm run build` |
| Start Command | `npm run start` |
| Health Check Path | `/api/standings` |

> **必要修复（已完成）**：Prisma 客户端输出目录 `app/generated/prisma` 被 `.gitignore` 忽略，
> 因此**必须**在构建期重新生成。已在 `package.json` 加 `"postinstall": "prisma generate"`，
> 并在 buildCommand 里也显式跑一次做双保险。否则线上会因找不到 Prisma Client 而 500。

部署后在 Render 面板填好环境变量（见第 2 节清单）。

## 6. 从本机切换到生产

1. 部署站点，配好环境变量（含 `CRON_SECRET`），确认 `/api/standings` 等读接口 200。
2. 手动触发一次全量：`POST https://<域名>/api/cron/sync` body `{"mode":"both"}`，
   确认返回 `merge` / `refresh` / `matchReports.aggregated` 都有数据。
3. 按第 4 节配好 GitHub Actions（推仓库 + 配 Secrets + 跑一次 workflow_dispatch）。
4. **删除本机的 11 条 WorkBuddy 自动化任务**（10 条「赛程结果刷新 · …」+ 1 条「赛程合并 · 每日 05:00」），
   避免与本机 dev server 耦合、重复写入。

## 7. 为什么把「每场 +3h 一次性任务」换成「每小时一条」

原来的做法是为每场比赛在「开球 + 3 小时」建一条一次性任务（精确，但任务数量随赛程线性增长，
且强依赖本机）。`refresh` 逻辑本身已按「**已过开赛 + 3h 且无比分**」筛选场次，
所以改成**每小时跑一次的 `refresh`** 即可覆盖全部比赛，无需逐场建任务——
数据最多滞后约 1 小时，代价可接受。
