# 官方内容采集

## 已实现

- `lib/providers/arsenal.ts`：服务端公开页面采集器，提取官方新闻标题、发布时间、分类、原文链接和图片；官方赛程日期、对手、赛事、主客场和比赛链接；球员姓名、位置、国籍、生日和资料链接。
- `lib/sync/arsenal.ts`：幂等写入 `OfficialNews`、`OfficialFixture` 和 `PlayerProfile`，每次运行写入 `SyncRun` 审计记录。
- `POST /api/sync/arsenal`：使用 `Authorization: Bearer <CRON_SECRET>`，请求体可选 `{ "scope": "all" | "news" | "fixtures" | "players" }`。
- `GET /api/arsenal/news`、`GET /api/arsenal/fixtures`、`GET /api/arsenal/players`：读取官方数据，并返回 `source`、规范来源 URL 和 `lastFetchedAt`。
- `PATCH /api/arsenal/fixtures/:fixtureId/score`：受保护的人工或公开报告比分录入。`source=report` 时必须提供 `sourceUrl`，不会覆盖官方赛程字段。

## 来源与合规

官方来源 URL：

- 新闻：<https://www.arsenal.com/news/all/1>
- 男足赛程：<https://www.arsenal.com/fixtures/men/fixtures>
- 男足球员：<https://www.arsenal.com/fixtures/men/players>

请求使用固定 User-Agent、15 秒超时和 Next.js 15 分钟缓存。部署前应检查 Arsenal 的 robots.txt、网站使用条款和访问频率要求；不要绕过验证码、登录墙或边缘防护。采集器遇到 HTTP 错误、客户端渲染或解析结果为 0 条时会将 `SyncRun` 标记为 `FAILED`，不会把空结果标记为成功。

## 比分录入示例

人工录入：

```http
PATCH /api/arsenal/fixtures/<fixture-id>/score
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json

{"homeScore": 2, "awayScore": 1, "source": "manual"}
```

公开报告：

```json
{"homeScore": 2, "awayScore": 1, "source": "report", "sourceUrl": "https://example.com/report"}
```

网站页面和 API 响应应同时展示来源和抓取时间；人工比分还应展示比分来源和更新时间。

## 当前环境限制

Arsenal 当前列表页将内容通过客户端 GraphQL 加载，普通服务端 HTML 可能只返回页面壳；本地验证时若返回 0 条，需在允许该官方公开接口的部署环境中运行，或由运营人员按上述比分/导入流程补录，不能将 0 条当作已完成抓取。
