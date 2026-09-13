# Sprint 0 API Validation

验证日期：2026-09-12

## 结果概览

| 数据源 | 结果 | 结论 |
| --- | --- | --- |
| football-data.org | 通过 | 认证、球队、赛程和积分榜接口可用 |
| API-Football | 通过 | 认证、阿森纳球队、历史比赛及事件/阵容/球队统计/球员统计接口可用 |
| Guardian Open Platform | 通过 | 当前 `NEWS_API_KEY` 可用于 Guardian Search API |
| OpenLigaDB | 通过 | 英超比赛数据可公开读取，可作为 API-Football 的备用/交叉校验源 |

## football-data.org

- 阿森纳球队 ID：`57`
- 球队接口：`GET /v4/teams/57`，返回球队名称、徽章和地区字段
- 赛程接口：`GET /v4/teams/57/matches?status=FINISHED&limit=1`，返回比赛列表、赛事、状态、时间、主客队和比分
- 积分榜接口：`GET /v4/competitions/PL/standings`，返回赛季、榜型、排名、积分和已赛场次
- 示例比赛：API 返回了一场阿森纳的欧冠历史比赛，比分字段可正常读取

建议将其作为首版赛程、比分和积分榜的主数据源。

## API-Football

- 阿森纳球队 ID：`42`
- 本次复测 `GET /status` 返回 HTTP `200`，认证状态正常
- 免费计划不支持当前赛季查询，并提示 `Free plans do not have access to this season`
- 免费计划不支持 `last` 参数，并提示 `Free plans do not have access to the Last parameter`
- 使用 `season=2024`、英超 `league=39` 和日期范围查询时返回历史比赛；示例为 2024-08-17 Arsenal 2-0 Wolves，fixture ID 为 `1208023`
- 本次采样的历史 fixture：`1208023`、`1208032`、`1208041`；三个 fixture 的基础赛季查询均返回成功
- 事件、阵容、球队统计和球员统计接口分别为 `/fixtures/events`、`/fixtures/lineups`、`/fixtures/statistics` 和 `/fixtures/players`；三个 fixture 的四类接口均返回 HTTP `200` 且无 API 错误

### API-Football 字段样本

| 数据类别 | 实测字段 | 样本结果 |
| --- | --- | --- |
| 比赛事件 | `time`, `team`, `player`, `assist`, `type`, `detail`, `comments` | fixture `1208023` 返回 14 条事件；其他样本返回 14 和 18 条 |
| 阵容 | `team`, `coach`, `formation`, `startXI`, `substitutes` | 返回两队阵容；首发/替补球员含 `id`, `name`, `number`, `pos`, `grid` |
| 球队统计 | `team`, `statistics` | 每项统计含 `type`, `value`；球队含 `id`, `name`, `logo` |
| 球员统计 | `team`, `players` | 球员含 `id`, `name`, `photo`；统计含 `games`, `offsides`, `shots`, `goals`, `passes`, `tackles`, `duels`, `dribbles`, `fouls`, `cards`, `penalty` |

### API-Football coverage

`GET /leagues?id=39&season=2024` 返回 HTTP `200`，该赛季 coverage 明确包含：

- `fixtures.events: true`
- `fixtures.lineups: true`
- `fixtures.statistics_fixtures: true`
- `fixtures.statistics_players: true`

建模时不要假定当前赛季和实时数据一定可用，需在服务层处理套餐限制和空结果。

### API-Football 复测状态

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 凭据/状态接口 | 通过 | HTTP 200，认证状态正常 |
| 历史 fixture 基础详情 | 通过 | 已验证 fixture `1208023`、`1208032`、`1208041` |
| 比赛事件字段 | 通过 | `/fixtures/events?fixture=1208023` 返回 14 条，字段样本已记录 |
| 阵容字段 | 通过 | `/fixtures/lineups?fixture=1208023` 返回两队阵容，字段样本已记录 |
| 球队统计字段 | 通过 | `/fixtures/statistics?fixture=1208023` 返回两队统计，字段样本已记录 |
| 球员统计字段 | 通过 | `/fixtures/players?fixture=1208023` 返回两队球员统计，字段样本已记录 |

报告不记录 key 值。后续仍需在套餐升级或赛季切换时重新检查 coverage，因为免费计划对当前赛季和部分查询参数存在限制。

## OpenLigaDB

- OpenLigaDB 无需 API Key，接口格式为 `/getmatchdata/{leagueShortcut}/{leagueSeason}`
- 当前英超可用标识为 `pl`，例如 `GET /getmatchdata/pl/2026`
- 返回比赛 ID、开球时间、联赛、主客队、完赛状态、最终比分和进球字段
- 已新增 `lib/providers/openligadb.ts`
- OpenLigaDB 不替换 API-Football；API-Football 仍保留为阵容、事件和球员表现的主要供应商
- 比赛同步时可用 OpenLigaDB 比对主客队和最终比分，发现差异后记录为数据质量告警

## Guardian Open Platform 新闻接口

- `NEWS_API_KEY` 使用 Guardian Open Platform Search API 验证成功
- 请求形式：`GET https://content.guardianapis.com/search`
- 查询参数可使用 `q`、`api-key`、`page-size`、`show-fields`
- 返回 `status`、`total`、`currentPage`、`pages` 和 `results`
- 文章字段包含 `id`、`sectionName`、`webPublicationDate`、`webTitle`、`webUrl`、`apiUrl` 和 `fields.trailText`
- 当前示例结果为 Football 分类，具备原文 URL、发布时间和摘要字段
- `NEWS_API_KEY` 这个变量名可以暂时保留，但代码中必须使用 Guardian endpoint，不能调用 NewsAPI.org

## 授权、限流与缓存策略

| 数据源 | 授权/使用约束 | 已知限流或套餐规则 | 首版缓存策略 |
| --- | --- | --- | --- |
| football-data.org | API key 放在服务端请求头；产品需显示 Football-Data.org 来源声明 | 免费注册客户端约约 10 requests/minute | 赛程、比分 15 分钟；积分榜 15 分钟；供应商失败时返回最近成功数据 |
| API-Football | API key 仅放在服务端请求头；不得暴露给浏览器 | 免费计划约 100 requests/day；当前赛季、`last` 或详情覆盖受套餐/授权影响 | 比赛详情 15 分钟；历史数据可延长；按 fixture ID 缓存，避免重复消耗配额 |
| OpenLigaDB | 无 key；正式产品需核对 ODbL 署名和使用要求 | 公共服务，需避免高频轮询 | 比赛列表 15 分钟；只作为备用或交叉校验，不覆盖主数据 |
| The Guardian | `NEWS_API_KEY` 服务端使用；当前开发者 key 为非商业用途 | 约 1 request/second、500 requests/day | 当前实现 15 分钟内存缓存；失败时降级到最近成功数据 |

授权和限流结论：第三方请求必须经服务端 provider 层，使用规范化响应、超时和错误码；页面不能直接携带 API key。缓存命中、过期和 stale 状态应通过统一元数据向 UI 暴露。

## 下一步

1. 用 Guardian 的 `section=football`、`q=Arsenal` 和时间范围参数收窄新闻结果。
2. 根据已完成的 [sprint-0-component-map.md](D:/studay/arsenal-hub/arsenal-fan-site/docs/sprint-0-component-map.md) 建立 Prisma schema，并先实现 football-data.org 的球队、赛程、积分榜同步。
3. 在服务层为 API-Football 详情数据实现按 fixture 的规范化映射、缓存、限流退避和空结果处理。

## Sprint 0 验收结论

Sprint 0 验收通过。足球主数据供应商、阿森纳球队 ID、历史比赛和四类 API-Football 详情字段均已验证；授权、限流、缓存和数据降级边界已记录；SVG 六个核心页面已拆解为组件清单。API-Football 保留为比赛详情主供应商，OpenLigaDB 仅作为备用/交叉校验源。
