# Sprint 1 数据模型与同步

## 数据模型

| 模型 | 作用 | 关键约束 |
| --- | --- | --- |
| `Team` | 供应商球队资料 | `(provider, providerTeamId)` 唯一 |
| `Competition` | 赛事资料 | `(provider, providerCompetitionId)` 唯一 |
| `Season` | 赛事赛季和当前轮次 | `(competition, providerSeasonId)` 唯一 |
| `Fixture` | 赛程、状态和比分 | `(provider, providerMatchId)` 唯一；主客队分别关联 `Team` |
| `StandingEntry` | 赛季积分榜 | `(season, team)` 唯一；按排名建立索引 |
| `SyncRun` | 同步审计、计数和失败信息 | 按 provider、scope、时间建立索引 |

`prisma/schema.prisma` 中的供应商字段让 API-Football 和 OpenLigaDB 后续可以在不改变核心模型的情况下补充数据。首版 football-data.org 数据使用 `provider = "football-data.org"`，所有外部 ID 均保留。

## 同步接口

接口：`POST /api/sync/football-data`

请求必须携带以下任一认证头：

```text
Authorization: Bearer <CRON_SECRET>
```

或：

```text
x-cron-secret: <CRON_SECRET>
```

同步默认使用：

- `FOOTBALL_DATA_TEAM_ID`，未设置时为 `57`
- `FOOTBALL_DATA_COMPETITION`，未设置时为 `PL`
- `FOOTBALL_DATA_API_KEY`，只在服务端请求 football-data.org 时使用

同步流程会并行读取球队资料、赛事资料、球队赛程和积分榜，然后按外部 ID upsert 球队、赛事、赛季、比赛和积分榜记录。每次运行都会写入 `SyncRun`，失败时保存失败状态和错误信息，API 响应不会泄露内部错误细节。

## 本次验证

- Prisma migration：`20260912055610_sprint_1_data_model`
- 数据库状态：schema up to date
- 实际同步结果：`38` 场比赛、`20` 条积分榜记录
- 重复触发结果：仍为 `38` 场比赛、`20` 条积分榜记录，未产生重复的供应商记录

## 相关文件

- `prisma/schema.prisma`
- `prisma/migrations/20260912055610_sprint_1_data_model/migration.sql`
- `lib/providers/football-data.ts`
- `lib/prisma.ts`
- `lib/sync/football-data.ts`
- `app/api/sync/football-data/route.ts`
