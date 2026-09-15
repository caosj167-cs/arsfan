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
                                        # 回填已完赛比分 + 刷新积分榜(FotMob) + 抓 FotMob 比赛中心 + 聚合球员赛季数据
GET|POST /api/cron/sync?mode=merge      → 三源合并赛程（football-data + arsenal.com + Wikipedia）
GET|POST /api/cron/sync?mode=both       → 两者都跑
```

### 数据来源分工（2026-09-15 起）

| 数据 | 来源 | 入口 |
|---|---|---|
| 积分榜 | **FotMob 联赛表抓取**（`lib/sync/fotmobStandings.ts`） | cron `refresh`/`both`；手动 `POST /api/sync/standings` |
| 进球榜/助攻榜 | **FotMob 比赛页抓取** → 聚合 | 同上（`matchReports` → `playerStats`） |
| 赛程合并 | football-data.org + arsenal.com + Wikipedia | cron `merge` |
| 比分回填 | football-data.org | cron `refresh` |

> 积分榜原先走 football-data.org 的 standings API，该源长期滞后（2026-27 赛季只到第 2 轮），
> 与 FotMob 官网口径（第 4 轮、阿森纳 12 分）不一致，故改为**与进球/助攻榜同源抓取 FotMob**。
> `syncStandingsFromFotmob()` 复用 getStandings() 读取的 competition/season，并按归一化队名把
> FotMob 行映射到既有 football-data 球队行，只 upsert StandingEntry（不新增球队、保住"阿森纳高亮"）。
> ✅ `syncFootballData()`（含手动 `POST /api/sync/football-data`）已**移除积分榜写入**（该接口返回 `standings` 恒为 0，
> 其 standings 请求只用于取赛季元数据），原来的 `syncStandingsFromProvider()` 已删除。
> 因此 **`standingEntry` 的唯一写入源是 FotMob 抓取**，不会再被旧源覆盖。

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

### 4.1 前置：代码在 GitHub 上 ✅ 已完成

仓库：`https://github.com/caosj167-cs/arsfan`（**public**），默认分支 `main`，
`.github/workflows/sync.yml` **已跟踪并推送**（`schedule` 只在默认分支生效 ✓）。

`.gitignore` 已忽略 `/node_modules`、`/.next/`、`.env*`、`/app/generated/prisma` ——
**`.env` 不会被推上去**，密钥走 Render 环境变量 + GitHub Secrets。

> 历史坑（已解决，留档）：推送 workflow 文件需要 `workflow` scope，而 **device flow 拿不到它**，
> 必须用浏览器 OAuth 流程 `gh auth login -h github.com -p https -w -s workflow -s repo -s gist -s read:org`。
> 当前 token scopes 已含 `workflow` ✓。

### 4.2 配置两个 Secret

GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret | 值 |
|---|---|
| `SYNC_BASE_URL` | Render 分配的域名，如 `https://arsenal-fan-site.onrender.com`（**不带结尾斜杠**） |
| `CRON_SECRET` | 与 Render 环境变量 `CRON_SECRET` **完全一致** |

> **⚠️ 推送工作流文件需要 `workflow` 权限**：用 `gh` 的 OAuth token（默认仅 `repo`/`gist`/`read:org`）
> 推送 `.github/workflows/*` 会被拒：
> `refusing to allow an OAuth App to create or update workflow ... without 'workflow' scope`。
> 先补权限再推：
> ```bash
> gh auth refresh -h github.com -s workflow
> ```
> 或者改用带 `workflow` scope 的 PAT；也可以直接在 GitHub 网页上新建该文件。

### 4.3 验证

```bash
# 也可以不点网页，直接命令行触发
gh workflow run sync.yml -R caosj167-cs/arsfan -f mode=both
gh run list -R caosj167-cs/arsfan --limit 3        # 看最近几条是否 success
```

确认返回 200 且 `data` 里 `merge` / `refresh` / `standings` / `matchReports` 都有数据
（`standings` 现由 FotMob 抓取提供，见第 3 节）。

> ⚠️ **`gh secret list` 目前为空** —— 不配这两个 Secret，workflow 一启动就
> `::error::缺少仓库 Secret SYNC_BASE_URL` 退出（这是历史上"每小时自动 refresh 从未成功"的真正原因）。
> 配置命令（域名已知后）：
> ```bash
> gh secret set SYNC_BASE_URL -R caosj167-cs/arsfan --body "https://<你的域名>"
> gh secret set CRON_SECRET   -R caosj167-cs/arsfan --body "<与 Render 的 CRON_SECRET 一致>"
> ```

之后每整点 :05 自动跑 `refresh`、每天 21:00 UTC 跑 `merge`；失败会在 Actions 页面标红。

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
| Runtime | Node（`NODE_VERSION=22`） |
| Build Command | **`npm ci --include=dev`** `&& npx prisma generate && npm run build` |
| Start Command | `npm run start` |
| Health Check Path | `/api/standings` |

> 🔴 **`--include=dev` 不能省**（2026-09-15 核实并修复）：**Render 构建期会设 `NODE_ENV=production`**，
> 此时 `npm ci` 会**跳过 devDependencies**。而 `typescript`、`tailwindcss`、`@tailwindcss/postcss`
> 全在 devDependencies 里 —— Tailwind v4 经 `postcss.config.mjs` 的 `@tailwindcss/postcss`
> 与 `globals.css` 的 `@import "tailwindcss"` 参与构建，缺了 `next build` 必失败。
> （Render 官方社区亦确认可直接覆盖 buildCommand。）

> **必要修复（已完成）**：Prisma 客户端输出目录 `app/generated/prisma` 被 `.gitignore` 忽略，
> 因此**必须**在构建期重新生成。已在 `package.json` 加 `"postinstall": "prisma generate"`，
> 并在 buildCommand 里也显式跑一次做双保险。否则线上会因找不到 Prisma Client 而 500。
>
> ⚠️ `prisma.config.ts` 用 `dotenv/config` + `env("DATABASE_URL")` → **构建期必须有 `DATABASE_URL`**，
> 否则 `prisma generate` 直接抛错。Render 构建时会注入环境变量 ✓。
> `dotenv` 本身**未在 package.json 声明**，目前由传递依赖 `c12`（← prisma，属 dependencies）带入；
> 若日后报找不到 `dotenv`，把它显式加进 dependencies 即可。

**创建 Blueprint 时 Render 会弹窗让你填 `sync: false` 的那几个值，务必当场填全**
（尤其 `DATABASE_URL`，否则第一次构建就会挂在 `prisma generate`）。变量清单见第 2 节；
`NEXT_PUBLIC_SITE_URL` 必须在**首次构建前**就是真实域名（`NEXT_PUBLIC_*` 会编进客户端包）。

## 6. 从本机切换到生产（按此顺序，**先验证再切换**）

数据库是**共享的 Neon**（线上与本机同一 `DATABASE_URL`）→ 部署后立即可见当前数据，**无需迁移/灌数**。

1. **预检（本机）**：`tsc --noEmit` / `eslint` / `vitest run` 全绿；工作区干净、HEAD 已推送。
   ⚠️ 本机 `next build` 结尾会被 D 盘删除护栏拦（编译/类型/静态页可过）→
   **首次完整构建的真正验证点在 Render 上**。
2. **建服务（Render 控制台，需你操作）**：New → Blueprint → 选 `caosj167-cs/arsfan`；
   弹窗里把所有 `sync: false` 的值填全（含 `DATABASE_URL`）。
3. **验证读接口**：`GET /api/standings`（应返回 20 行、Arsenal 第 1 · 12 分）、
   `GET /`（下一场伊普斯维奇带队徽）、`GET /team-data`（积分榜 + 排名走势图）、`/sitemap.xml`、`/robots.txt`。
4. **配 GitHub Secrets**（第 4.2 节命令），然后 `gh workflow run sync.yml -f mode=both` 验证 200。
5. **观察下一次定时运行**（每小时 :05）确认自动化真的在跑。
6. **切换（第 5 步通过之后才做）**：
   - **删除本机 11 条 WorkBuddy 自动化任务**（已确认存在：1 条「赛程合并 · 每日 05:00」+
     10 条「赛程结果刷新 · <日期> <对手>」一次性任务，均打 `localhost:3000`）→ 避免与 GH Actions 重复写库。
   - 停掉本机 dev server。

> 回滚：Render 里回滚到上一个 deploy；或重新启用上面那些自动化任务（本机 `DATABASE_URL` 未变，
> 随时可继续在本机同步）。

## 7. 为什么把「每场 +3h 一次性任务」换成「每小时一条」

原来的做法是为每场比赛在「开球 + 3 小时」建一条一次性任务（精确，但任务数量随赛程线性增长，
且强依赖本机）。`refresh` 逻辑本身已按「**已过开赛 + 3h 且无比分**」筛选场次，
所以改成**每小时跑一次的 `refresh`** 即可覆盖全部比赛，无需逐场建任务——
数据最多滞后约 1 小时，代价可接受。
