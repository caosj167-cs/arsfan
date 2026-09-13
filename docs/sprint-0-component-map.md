# Sprint 0 SVG Component Map

来源：`D:\studay\arsenal-hub\arsenal-page-layouts.svg`

目标：把版式提案拆成可实现的页面边界、数据依赖和首版优先级。组件名称采用 PascalCase，后续可按页面目录组织；本文件不规定最终视觉实现细节。

## 页面与组件

| 页面 | 版式职责 | 页面组件 | 主要数据依赖 | 优先级 |
| --- | --- | --- | --- | --- |
| 首页 | 情绪入口与数据摘要 | `SiteHeader`, `NextMatchHero`, `SignalCardGrid`, `FormCard`, `TablePositionCard`, `NewsDeskCard`, `LatestNewsList`, `RecentResults`, `SeasonSnapshot` | football-data.org 赛程/比分/积分榜；Guardian 新闻；缓存状态 | P0 |
| 新闻页 | 编辑部式信息流 | `NewsHeader`, `NewsFilters`, `FeaturedStory`, `NewsList`, `NewsCard`, `SourceBadge`, `Pagination` 或 `LoadMore` | Guardian Search API；来源、时间、摘要、分页元数据 | P0 |
| 赛程页 | 按时间浏览并快速筛选 | `FixturesHeader`, `SeasonSelect`, `CompetitionFilter`, `MonthFilter`, `HomeAwayFilter`, `FixtureTimeline`, `FixtureRow`, `MatchStatusBadge` | football-data.org 赛程；API-Football 补充赛事信息；OpenLigaDB 交叉校验比分 | P0 |
| 比赛详情页 | 先结论、后证据 | `MatchStatusHeader`, `ScoreHero`, `MatchSnapshot`, `StatComparison`, `EventsTimeline`, `Lineups`, `Substitutions`, `TeamStatistics`, `ShotMap`, `PassMap`, `EditorsReview` | API-Football fixture、events、lineups、statistics、players；OpenLigaDB 比分校验 | P1 |
| 球员详情页 | 身份卡与赛季指标 | `PlayerIdentityCard`, `RoleBadge`, `MetricGrid`, `FormTrend`, `RecentMatches` | API-Football 球员资料、赛季统计和比赛统计 | P1 |
| 赛季分析页 | 趋势图与编辑结论 | `AnalysisHeader`, `InsightCard`, `PointsTrendChart`, `GoalsTrendChart`, `FormRun`, `HomeAwayComparison`, `ScheduleDifficulty`, `PlayerContributionTable` | football-data.org 赛程/积分榜；API-Football 球员和球队统计；本地聚合计算 | P1 |

## 公共组件与状态

这些组件跨页面复用，建议先建立在 `components/ui` 或等价的共享目录中：

- `SiteHeader`：主导航、当前页面状态和移动端菜单入口。
- `SourceBadge`：显示 `Football-Data.org`、`API-Football`、`OpenLigaDB` 或 `The Guardian`，避免混淆数据来源。
- `MatchStatusBadge`：统一显示未开始、进行中、完场、延期和取消。
- `LoadingState`、`EmptyState`、`ErrorState`：处理供应商限流、无数据和降级数据。
- `LastUpdated`：展示数据更新时间、缓存状态和必要的来源声明。

## 数据边界

1. 页面组件只消费站内的规范化数据，不直接拼接第三方 API 响应。
2. 赛程、比分和积分榜首版以 football-data.org 为主；OpenLigaDB 只做备用或比分交叉校验。
3. 比赛事件、阵容和球员统计依赖 API-Football；在供应商凭据未修复前，相关 UI 必须支持空状态，不应使用示例数据冒充实况。
4. 新闻卡片只展示 Guardian 返回的标题、摘要、时间和原文链接，不复制全文。
5. 所有页面都应能表达 `source`、`lastUpdatedAt`、`stale` 和 `error` 等数据质量状态。

## 实现顺序

- P0：`SiteHeader`、首页摘要、新闻列表、赛程时间轴、来源/更新时间/错误状态。
- P1：比赛详情、球员详情、赛季分析及图表。
- P2：`EditorsReview`、高级筛选、射门图和传球图的精细交互。
