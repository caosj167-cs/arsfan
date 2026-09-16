import Link from "next/link";

import { ClubBadge } from "@/components/club-badge";
import { SiteShell } from "@/components/site-shell";
import { formatBeijing } from "@/lib/datetime";
import { clubName } from "@/lib/data/clubs";
import type { MatchDetailView } from "@/lib/queries/match";

function date(value: string) {
  return formatBeijing(value, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function time(value: string) {
  return formatBeijing(value, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function display(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function TeamMark({ name }: { name: string }) {
  return <ClubBadge name={name} size={46} />;
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return <div className="detail-section-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{detail ? <span>{detail}</span> : null}</div>;
}

function ScoreHero({ detail }: { detail: MatchDetailView }) {
  const fixture = detail.fixture;
  const stored = detail.storedFixture;
  const home = fixture?.homeTeam ?? stored?.homeTeam;
  const away = fixture?.awayTeam ?? stored?.awayTeam;
  const score = fixture?.score ?? stored?.score;
  if (!home || !away) return <div className="detail-empty">暂无比赛摘要。</div>;
  const status = fixture?.statusLabel ?? stored?.status ?? "比赛中心";
  return <section className="score-hero"><div className="score-hero__status"><span>{status.toUpperCase()}</span><span>{fixture?.round ?? `Fixture ${detail.requestedId}`}</span></div><div className="score-hero__teams"><div><TeamMark name={home.name} /><strong>{clubName(home.name)}</strong></div><div className="score-hero__score"><b>{display(score?.home)}</b><span>-</span><b>{display(score?.away)}</b></div><div><TeamMark name={away.name} /><strong>{clubName(away.name)}</strong></div></div><div className="score-hero__meta"><span>{fixture ? date(fixture.kickoffAt) : stored ? date(stored.kickoffAt) : "-"}</span><span>{fixture ? time(fixture.kickoffAt) : ""}{fixture?.venue?.name ? ` · ${fixture.venue.name}` : ""}</span></div></section>;
}

function MatchSnapshot({ detail }: { detail: MatchDetailView }) {
  const fixture = detail.fixture;
  const stored = detail.storedFixture;
  const score = fixture?.score ?? stored?.score;
  const stats = detail.teamStatistics;
  const getStat = (label: string) => stats.map((team) => team.statistics.find((item) => item.type.toLowerCase() === label.toLowerCase())?.value ?? "-").join(" / ");
  return <section className="match-snapshot"><SectionTitle eyebrow="比赛概览" title="关键数据。" detail={detail.apiFootballAvailable ? "API-FOOTBALL" : "已存结果"} /><div className="snapshot-metrics"><div><span>全场比分</span><strong>{display(score?.home)} - {display(score?.away)}</strong></div><div><span>半场比分</span><strong>{display(score?.halfTimeHome)} - {display(score?.halfTimeAway)}</strong></div><div><span>比赛事件</span><strong>{detail.events.length || "-"}</strong></div><div><span>首发阵容</span><strong>{detail.lineups.length ? "两队" : "-"}</strong></div></div><div className="stat-strip">{[["Ball Possession", "控球率"], ["Total Shots", "射门次数"], ["Shots on Goal", "射正次数"], ["Corner Kicks", "角球"]].map(([label, title]) => <div key={label}><span>{title}</span><b>{getStat(label)}</b></div>)}</div></section>;
}

function EventsTimeline({ detail }: { detail: MatchDetailView }) {
  return <section className="detail-panel"><SectionTitle eyebrow="比赛时间线" title="比赛事件。" detail={`${detail.events.length} 条事件`} />{detail.events.length ? <div className="events-list">{detail.events.map((event, index) => <div className="event-row" key={`${event.minute}-${event.type}-${index}`}><span className="event-row__minute">{`${event.minute}'`}{event.extraMinute ? `+${event.extraMinute}` : ""}</span><span className={`event-icon event-icon--${event.type.toLowerCase()}`}>{event.type === "Goal" ? "●" : event.type === "Card" ? "■" : "↔"}</span><div><strong>{event.player.name ?? (event.type === "Goal" ? "进球" : event.type === "Card" ? "牌面" : "换人")}</strong><p>{event.detail ?? event.type}{event.assist.name ? ` · 助攻：${event.assist.name}` : ""}{event.comments ? ` · ${event.comments}` : ""}</p></div><span className="event-row__team">{clubName(event.team.name)}</span></div>)}</div> : <div className="detail-empty">这场比赛暂无事件数据。</div>}</section>;
}

function Lineups({ detail }: { detail: MatchDetailView }) {
  return <section className="detail-panel"><SectionTitle eyebrow="球队阵容" title="出场名单。" detail={detail.lineups.length ? "首发 + 替补" : "暂无数据"} /><div className="lineups-grid">{detail.lineups.length ? detail.lineups.map((lineup) => <div className="lineup-card" key={lineup.team.id}><div className="lineup-card__head"><TeamMark name={lineup.team.name} /><div><h3>{clubName(lineup.team.name)}</h3><p>{lineup.formation ?? "阵型未知"} · {lineup.coach.name ?? "教练未知"}</p></div></div><h4>首发阵容</h4><ol>{lineup.startXI.map((player) => <li key={`${player.id}-${player.name}`}><span>{display(player.number)}</span>{player.name}<small>{player.pos ?? "-"}</small></li>)}</ol><h4>替补球员</h4><ol className="substitutes">{lineup.substitutes.slice(0, 7).map((player) => <li key={`${player.id}-${player.name}`}><span>{display(player.number)}</span>{player.name}<small>{player.pos ?? "-"}</small></li>)}</ol></div>) : <div className="detail-empty">这场比赛暂无阵容数据。</div>}</div></section>;
}

function TeamStatistics({ detail }: { detail: MatchDetailView }) {
  return <section className="detail-panel"><SectionTitle eyebrow="球队数据" title="比赛统计。" detail={detail.teamStatistics.length ? "API-FOOTBALL" : "暂无数据"} /><div className="team-stats-grid">{detail.teamStatistics.length ? detail.teamStatistics.map((team) => <div className="team-stats-card" key={team.team.id}><div className="team-stats-card__head"><TeamMark name={team.team.name} /><strong>{clubName(team.team.name)}</strong></div>{team.statistics.map((stat) => <div className="team-stat-row" key={stat.type}><span>{stat.type}</span><b>{display(stat.value)}</b></div>)}</div>) : <div className="detail-empty">这场比赛暂无球队统计数据。</div>}</div></section>;
}

function PlayerStatistics({ detail }: { detail: MatchDetailView }) {
  const rows = detail.playerStats.flatMap((team) => team.players.map((row) => ({ ...row, team: team.team.name })));
  return <section className="detail-panel"><SectionTitle eyebrow="球员表现" title="关键球员。" detail={rows.length ? `${rows.length} 名球员` : "暂无数据"} />{rows.length ? <div className="player-stats-table"><div className="player-stats-table__head"><span>球员</span><span>分钟</span><span>评分</span><span>进球</span><span>助攻</span><span>射门</span></div>{rows.slice(0, 18).map((row) => { const stats = row.statistics; return <div className="player-stats-table__row" key={`${row.team}-${row.player.id}`}><span><b>{row.player.name ?? "未知球员"}</b><small>{row.team}</small></span><span>{display(stats?.games?.minutes)}</span><span>{display(stats?.games?.rating)}</span><span>{display(stats?.goals?.total)}</span><span>{display(stats?.goals?.assists)}</span><span>{display(stats?.shots?.total)}</span></div>; })}</div> : <div className="detail-empty">这场比赛暂无球员统计数据。</div>}</section>;
}

export function MatchDetail({ detail }: { detail: MatchDetailView }) {
  return <SiteShell active="team-data" source="足球数据：Football-Data.org · 详情：API-Football"><div className="detail-page"><Link className="back-link" href="/team-data">← 返回球队数据</Link><div className="detail-page__heading"><p className="eyebrow">比赛中心 / {detail.requestedId}</p><h1>阅读这场<br /><em>比赛。</em></h1><p>从比分开始，查看比赛背后的证据：事件、阵容和球员表现。</p></div>{!detail.apiFootballAvailable ? <div className="notice-bar">API-Football 暂时没有返回详情，以下显示 Football-Data.org 已保存的比赛结果。</div> : null}<ScoreHero detail={detail} /><MatchSnapshot detail={detail} /><div className="detail-two-column"><EventsTimeline detail={detail} /><Lineups detail={detail} /></div><TeamStatistics detail={detail} /><PlayerStatistics detail={detail} /></div></SiteShell>;
}
