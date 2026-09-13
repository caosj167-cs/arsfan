# Sprint 3 比赛详情

## 已实现

比赛详情页位于 `/fixtures/[fixtureId]`，详情数据通过服务端 API-Football provider 获取，不把 `API_FOOTBALL_KEY` 发给浏览器。

支持的 API-Football 请求：

- `/fixtures?id={fixtureId}`：比赛基本信息、状态、球场和比分
- `/fixtures/events?fixture={fixtureId}`：进球、牌、换人和其他事件
- `/fixtures/lineups?fixture={fixtureId}`：阵型、教练、首发和替补
- `/fixtures/statistics?fixture={fixtureId}`：两队统计项和值
- `/fixtures/players?fixture={fixtureId}`：球员出场、评分、进球、助攻、射门、传球等统计

## 数据流

`lib/providers/api-football.ts` 负责认证、响应 envelope 校验、供应商错误处理和字段 schema；`lib/queries/match.ts` 将响应转换为页面可消费的规范化结构；`app/api/fixtures/[fixtureId]/route.ts` 对外返回统一的 `data / meta / error` 格式；页面由 `components/match-detail.tsx` 渲染。

如果 API-Football 详情暂时不可用，但数据库中存在对应 football-data.org 比赛，页面会继续显示已存储的比分，并明确标记详情数据不可用。事件、阵容、球队统计和球员统计不会使用假数据填充。

## 验证 fixture

Sprint 0 已验证历史 fixture `1208023`（Arsenal 2-0 Wolves，2024-08-17）的详情接口字段；Sprint 3 页面可用 `/fixtures/1208023` 和 `/api/fixtures/1208023` 读取该 fixture。

数据库赛程目前以 football-data.org 外部 ID 为主，而 API-Football 使用自己的 fixture ID。详情查询会在发现数据库比赛时，按开球日期和主客队向 API-Football 做一次跨供应商解析，再读取对应详情；解析不到时保留数据库比分并展示空状态。
