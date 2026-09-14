import Link from "next/link";

import { ClubBadge } from "@/components/club-badge";
import { clubName } from "@/lib/data/clubs";
import { normalizeCompetition } from "@/lib/data/competitions";
import type { MatchCenterView } from "@/lib/queries/matchReports";
import type { MatchLineupBlock, MatchPlayerRow } from "@/lib/providers/fotmob";

const EVENT_LABEL: Record<string, string> = {
  Goal: "进球",
  OwnGoal: "乌龙球",
  Penalty: "点球",
  MissedPenalty: "点球未进",
  Card: "牌",
  Substitution: "换人",
  AddedTime: "补时",
  Half: "半场",
};

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "full", timeStyle: "short" }).format(new Date(iso));
}

function playerFlags(p: MatchPlayerRow) {
  const flags: string[] = [];
  if (p.goals > 0) flags.push(`⚽${p.goals > 1 ? p.goals : ""}`);
  if (p.assists > 0) flags.push(`A${p.assists > 1 ? p.assists : ""}`);
  if (p.yellowCards > 0) flags.push("🟨");
  if (p.redCards > 0) flags.push("🟥");
  return flags.join(" ");
}

function LineupBlock({ block, tone }: { block: MatchLineupBlock; tone: "home" | "away" }) {
  return (
    <div className="mc-team">
      <h3 className={tone}>
        {clubName(block.name)}
        <span className="mc-fmt">{block.formation ?? "阵型未知"}{block.coach ? ` · 主帅 ${block.coach}` : ""}</span>
      </h3>
      {block.starters.map((p) => (
        <div className="mc-pl" key={`${p.playerId}-${p.name}`}>
          <span className="mc-pl__name">
            <b>{p.shirtNumber ?? "-"}</b> {p.name}
            {p.position ? <span className="mc-pos">{p.position}</span> : null}
            {p.captain ? <span className="mc-cap">C</span> : null}
            {p.subOutMinute !== null ? <span className="mc-sub">{p.subOutMinute}&apos;↓</span> : null}
          </span>
          <span className="mc-pl__flag">{playerFlags(p)}</span>
        </div>
      ))}
      {block.subs.length ? (
        <p className="mc-subs">
          替补：{block.subs.map((p) => `${p.shirtNumber ?? "-"} ${p.name}${p.subInMinute !== null ? `（${p.subInMinute}&apos;）` : ""}${p.rating !== null ? ` ${p.rating}` : ""}`).join(" · ")}
        </p>
      ) : null}
      {block.unavailable.length ? (
        <p className="mc-unavail">
          未登场/缺阵：{block.unavailable.map((u) => `${u.name}${u.reason ? `（${u.reason}）` : ""}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

export function MatchCenter({ view }: { view: MatchCenterView }) {
  const { entry, report } = view;
  const comp = normalizeCompetition(entry.competition);

  if (!report) {
    return (
      <div className="mc-empty">
        <h2>比赛中心</h2>
        <p>
          {clubName(entry.opponentName)}（{entry.homeAway === "HOME" ? "主场" : "客场"}）· {comp.name}
          {entry.homeScore !== null && entry.awayScore !== null ? ` · ${entry.homeScore}-${entry.awayScore}` : ""}
        </p>
        <p className="mc-empty__note">
          该场详细数据（阵容 / 统计 / 评分 / 事件）尚未抓取。抓取源为 FotMob；缺失时留空，不做编造。
          可运行 <code>POST /api/sync/match-reports</code>（body: action=entry, entryId={entry.id}）触发抓取。
        </p>
        <Link href="/team-data" className="back-link">
          ← 返回球队数据
        </Link>
      </div>
    );
  }

  const p = report.payload;
  const home = p.teams.home;
  const away = p.teams.away;
  const homeStatsPlayers = [...p.lineups.home.starters, ...p.lineups.home.subs].filter((x) => x.rating !== null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const awayStatsPlayers = [...p.lineups.away.starters, ...p.lineups.away.subs].filter((x) => x.rating !== null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  return (
    <div className="mc">
      <header className="mc-head">
        <p className="mc-kicker">
          {comp.name}
          {p.round ? ` · 第 ${p.round} 轮` : ""}
          {home.scoreHalfTime !== null && away.scoreHalfTime !== null ? ` · 半场 ${home.scoreHalfTime}-${away.scoreHalfTime}` : ""}
        </p>
        <div className="mc-score">
          <span className="mc-score__team">
            <ClubBadge name={home.name} size={32} />
            {clubName(home.name)}
          </span>
          <span className="mc-score__num">
            <b>{home.score ?? "-"}</b>
            <i>:</i>
            <b>{away.score ?? "-"}</b>
          </span>
          <span className="mc-score__team mc-score__team--away">
            {clubName(away.name)}
            <ClubBadge name={away.name} size={32} />
          </span>
        </div>
        <div className="mc-facts">
          <span>🗓 {fmtDateTime(p.kickoffAt ?? entry.kickoffAt)}</span>
          {p.venue ? <span>🏟 {p.venue}{p.city ? `（${p.city}）` : ""}</span> : null}
          {p.referee ? <span>👤 主裁 {p.referee}</span> : null}
        </div>
      </header>

      <section>
        <h2>一、球队数据对比</h2>
        {p.teamStats.length ? (
          <table className="mc-table">
            <thead>
              <tr>
                <th className="mc-metric">指标</th>
                <th className="mc-h">{clubName(home.name)}</th>
                <th className="mc-a">{clubName(away.name)}</th>
              </tr>
            </thead>
            <tbody>
              {p.teamStats.map((s, i) => (
                // 用下标参与 key：FotMob 的指标会跨分组重复（如 Defensive actions、Top speed），
                // 仅用 key+metric 会触发 React「duplicate key」告警
                <tr key={`${i}-${s.key}`}>
                  <td className="mc-metric">{s.metric}</td>
                  <td className={s.highlight === "home" ? "mc-h mc-strong" : "mc-h"}>{s.home ?? "-"}</td>
                  <td className={s.highlight === "away" ? "mc-a mc-strong" : "mc-a"}>{s.away ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="data-empty">该场球队统计缺失。</p>
        )}
      </section>

      <section>
        <h2>二、双方阵容</h2>
        <div className="mc-lineups">
          <LineupBlock block={p.lineups.home} tone="home" />
          <LineupBlock block={p.lineups.away} tone="away" />
        </div>
      </section>

      <section>
        <h2>三、比赛事件时间线</h2>
        {p.events.length ? (
          <div className="mc-tl">
            {p.events.map((e, i) => (
              <div className="mc-tl__row" key={`${e.minute}-${i}`}>
                <span className="mc-tl__min">
                  {e.minute ?? "-"}&apos;{e.minuteExtra ? `+${e.minuteExtra}` : ""}
                </span>
                <span className={`mc-tl__ev mc-tl__ev--${e.side}`}>
                  {EVENT_LABEL[e.type] ?? e.type}
                  {e.detail ? ` · ${e.detail}` : ""}
                  {e.player ? ` — ${e.player}` : ""}
                  {e.scoreAfter ? `（${e.scoreAfter}）` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="data-empty">该场事件数据缺失。</p>
        )}
      </section>

      <section>
        <h2>四、球员评分（FotMob 赛后评分，满分 10）</h2>
        <div className="mc-lineups">
          <div className="mc-team">
            <h3 className="home">{clubName(home.name)}</h3>
            {homeStatsPlayers.map((x) => (
              <div className="mc-pl" key={`h-${x.playerId}-${x.name}`}>
                <span className="mc-pl__name">
                  <b>{x.shirtNumber ?? "-"}</b> {x.name}
                  {x.position ? <span className="mc-pos">{x.position}</span> : null}
                  {playerFlags(x) ? <span className="mc-flag-inline">{playerFlags(x)}</span> : null}
                </span>
                <b>{x.rating?.toFixed(1)}</b>
              </div>
            ))}
          </div>
          <div className="mc-team">
            <h3 className="away">{clubName(away.name)}</h3>
            {awayStatsPlayers.map((x) => (
              <div className="mc-pl" key={`a-${x.playerId}-${x.name}`}>
                <span className="mc-pl__name">
                  <b>{x.shirtNumber ?? "-"}</b> {x.name}
                  {x.position ? <span className="mc-pos">{x.position}</span> : null}
                  {playerFlags(x) ? <span className="mc-flag-inline">{playerFlags(x)}</span> : null}
                </span>
                <b>{x.rating?.toFixed(1)}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mc-src">
        <b>数据来源：</b>FotMob 比赛页（抓取时间 {fmtDateTime(report.fetchedAt)}，matchId {report.fotmobMatchId}）。
        {p.missing.length ? ` 缺失字段：${p.missing.join("、")}（留空，未编造）。` : " 全部字段均来自数据源，无编造。"}
      </div>
      <Link href="/team-data" className="back-link">
        ← 返回球队数据
      </Link>
    </div>
  );
}
