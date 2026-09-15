"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { ClubBadge } from "@/components/club-badge";
import { LeaguePositionChart } from "@/components/league-progress-chart";
import { SiteShell } from "@/components/site-shell";
import { clubName } from "@/lib/data/clubs";
import type { PositionPoint } from "@/lib/data/league-position";
import type { StandingView } from "@/lib/queries/football";
import type { FixtureEntryView } from "@/lib/queries/fixtureEntries";
import { seasonLabel } from "@/lib/data/season";
import type { LeaderRow } from "@/lib/queries/players";

export type { LeaderRow };

type Props = {
  /** 合并后的 26/27 赛程 */
  entries: FixtureEntryView[];
  /** 已有「比赛中心」数据的赛程 id（这些行可点击跳转） */
  entryReportIds: string[];
  standings: StandingView[];
  lastUpdatedAt?: string | null;
  scorers: LeaderRow[];
  assisters: LeaderRow[];
  /** 真实榜单数据对应的赛季（起始年）；未命中真实数据的行为“—” */
  leaderboardSeason: number | null;
  /** 英超名次走势（逐轮，由积分榜同步时用全量联赛结果算出） */
  positionProgression: PositionPoint[];
  /** name → crest URL, built from football-data teams (arsenal.com exposes no logos) */
  crestMap: Record<string, string>;
  /** 服务端时间（ISO），用于判断“下一场”，避免在渲染期调用 Date.now() */
  nowIso: string;
};

/* ---------------- Chinese naming ---------------- */



/* ---------------- Competition labels ---------------- */

const COMPETITION_LABELS: Record<string, string> = {
  PL: "英超", "Premier League": "英超", "英格兰超级联赛": "英超",
  UCL: "欧冠", "Champions League": "欧冠", "UEFA Champions League": "欧冠",
  EL: "欧联", "Europa League": "欧联", "UEFA Europa League": "欧联",
  ECL: "欧协联", "Conference League": "欧协联",
  FACUP: "足总杯", "FA Cup": "足总杯", "Emirates FA Cup": "足总杯",
  LCUP: "联赛杯", "EFL Cup": "联赛杯", "League Cup": "联赛杯", "Carabao Cup": "联赛杯",
  CLUB_FRIENDLY: "友谊赛", Friendly: "友谊赛", "Club Friendlies": "友谊赛",
  COMMUNITY_SHIELD: "社区盾", "Community Shield": "社区盾",
  "Emirates Cup": "酋长杯",
};

function competitionLabel(value: string | null | undefined): string {
  if (!value) return "赛事";
  return COMPETITION_LABELS[value] ?? value;
}

function competitionKey(value: string | null | undefined): string {
  return competitionLabel(value);
}

function competitionClass(value: string | null | undefined): string {
  switch (competitionKey(value)) {
    case "英超": return "comp-pl";
    case "欧冠": return "comp-ucl";
    case "足总杯": return "comp-facup";
    case "联赛杯": return "comp-lcup";
    case "欧联": return "comp-el";
    case "欧协联": return "comp-ecl";
    case "社区盾": return "comp-cs";
    default: return "";
  }
}

const ARSENAL_ID = "57";

/* ---------------- Tab definitions ---------------- */

type TabId = "fixtures" | "standings" | "goals" | "assists";
const TABS: { id: TabId; label: string }[] = [
  { id: "fixtures", label: "赛程" },
  { id: "standings", label: "积分榜" },
  { id: "goals", label: "进球榜" },
  { id: "assists", label: "助攻榜" },
];

/* ---------------- Shared bits ---------------- */


/** Resolve a crest for an arsenal.com opponent name via the football-data map. */
function lookupCrest(map: Record<string, string>, name: string): string | null {
  return map[name] ?? map[name.replace(/\s+(FC|AFC|CF|SC|AC)$/i, "").trim()] ?? null;
}

function fmtDate(v: string) {
  return new Intl.DateTimeFormat("zh-CN", { day: "numeric", month: "numeric", weekday: "short" }).format(new Date(v));
}
function fmtMonth(v: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date(v));
}
function fmtTime(v: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v));
}
function fmtStamp(v: string | null | undefined) {
  return v ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(v)) : "页面查询时";
}

/** 分组渲染：月份标题 + 一条 1px 延伸线（设计稿 46px 高） */
function FixtureTable<T extends { id: string; kickoffAt: string }>({ rows, render }: { rows: T[]; render: (row: T) => React.ReactNode }) {
  const groups = useMemo(() => {
    const out: Record<string, T[]> = {};
    for (const row of rows) {
      const key = fmtMonth(row.kickoffAt);
      (out[key] ??= []).push(row);
    }
    return out;
  }, [rows]);

  if (!rows.length) return <p className="data-empty">暂无赛程数据，请先运行数据同步。</p>;

  return (
    <div className="fx-card">
      <div className="fx-head">
        <span>日期</span>
        <span>赛事</span>
        <span>主客</span>
        <span>对阵 · 对手</span>
        <span>比分 / 时间</span>
        <span>状态</span>
      </div>
      {Object.entries(groups).map(([label, items]) => (
        <Fragment key={label}>
          <div className="fx-month"><h2>{label}</h2><i /></div>
          {items.map((row) => render(row))}
        </Fragment>
      ))}
    </div>
  );
}

/* ---------------- Fixtures tab ---------------- */

function FixturesTab({ entries, entryReportIds, crestMap, nowIso }: Pick<Props, "entries" | "entryReportIds" | "crestMap" | "nowIso">) {
  const reportIds = useMemo(() => new Set(entryReportIds), [entryReportIds]);
  const now = useMemo(() => new Date(nowIso).getTime(), [nowIso]);
  const options = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(competitionKey(e.competition));
    return ["全部", ...Array.from(set)];
  }, [entries]);

  const [filter, setFilter] = useState("全部");

  const dataRows = useMemo(
    () => entries.filter((e) => filter === "全部" || competitionKey(e.competition) === filter),
    [entries, filter]
  );

  const total = entries.length;
  const shown = dataRows.length;

  // 下一场 = 第一条开赛时间仍在未来、且尚无终场比分的比赛（设计稿把这一行整行高亮）
  // nowIso 由服务端注入，保证渲染纯函数化、且不受客户端时钟漂移影响
  const nextId = useMemo(() => {
    const upcoming = entries.find((e) => e.homeScore === null && new Date(e.kickoffAt).getTime() > now);
    return (upcoming ?? entries.find((e) => e.homeScore === null))?.id ?? null;
  }, [entries, now]);

  return (
    <>
      <div className="fixtures-toolbar">
        {options.length > 1 ? (
          <div className="filter-chips" role="group" aria-label="赛事筛选">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={filter === option}
                className={`filter-chip ${filter === option ? "filter-chip--active" : ""}${
                  option === "全部" ? "" : " " + competitionClass(option)
                }`}
                onClick={() => setFilter(option)}
              >
                {option === "全部" ? "全部赛事" : option}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <span className="fixtures-toolbar__note">
          26/27 赛季 · 共 {total} 场
          {shown !== total ? ` · 已筛选 ${shown} / ${total} 场` : ""}
        </span>
      </div>

      <FixtureTable
        rows={dataRows}
        render={(e) => {
          const isNext = e.id === nextId;
          // 未开赛一律不算「已完赛」：即便数据里带了比分（历史脏数据），
          // 只要开球时间还没到就不展示比分与胜负
          const done = e.homeScore !== null && e.awayScore !== null && new Date(e.kickoffAt).getTime() <= now;
          const result = !done
            ? null
            : e.homeAway === "HOME"
              ? e.homeScore! > e.awayScore! ? "win" : e.homeScore === e.awayScore ? "draw" : "loss"
              : e.awayScore! > e.homeScore! ? "win" : e.homeScore === e.awayScore ? "draw" : "loss";
          const tone = isNext ? "next" : (result ?? "upcoming");
          const label = isNext ? "下一场" : result === "win" ? "胜" : result === "draw" ? "平" : result === "loss" ? "负" : "未开始";
          const clickable = done && reportIds.has(e.id);
          const rowClass = `fx-row${isNext ? " fx-row--next" : ""}${clickable ? " fx-row--link" : ""}`;
          const cells = (
            <>
              <span className={`fx-date${isNext ? " fx-date--next" : ""}`}>{fmtDate(e.kickoffAt)}</span>
              <span className={`fx-comp ${competitionClass(e.competition)}`}>{competitionLabel(e.competition)}</span>
              <span className="fx-venue">{e.homeAway === "HOME" ? "主" : "客"}</span>
              <span className="fx-opponent">
                <ClubBadge name={e.opponentName} crest={e.opponentCrest ?? lookupCrest(crestMap, e.opponentName)} size={32} />
                <b>{clubName(e.opponentName)}</b>
              </span>
              <span className={`fx-score${done ? "" : " fx-score--pending"}`}>
                {done ? `${e.homeScore} - ${e.awayScore}` : fmtTime(e.kickoffAt)}
              </span>
              <span className={`fx-status fx-status--${tone}`}>
                {label}
                {clickable ? <i className="fx-mc-arrow" title="进入比赛中心">›</i> : null}
              </span>
            </>
          );
          return clickable ? (
            <Link key={e.id} href={`/matches/${e.id}`} className={rowClass} title="点击进入比赛中心">
              {cells}
            </Link>
          ) : (
            <div key={e.id} className={rowClass}>
              {cells}
            </div>
          );
        }}
      />
    </>
  );
}

/* ---------------- Standings tab ---------------- */

function StandingsTab({ standings, positionProgression }: Pick<Props, "standings" | "positionProgression">) {
  return (
    <>
      <div className="standings-toolbar">
        <p className="data-kicker">2026-27 赛季 <b>&rsaquo;</b></p>
        <div className="standings-select"><span>&#9679;</span> 英超积分榜 <b>&#8964;</b></div>
      </div>
      <div className="standings-table">
        <div className="standing-head">
          <span>排名</span><span>球队</span><span>已赛</span><span>胜</span><span>平</span><span>负</span><span>净胜</span><span>积分</span>
        </div>
        {standings.length ? standings.map((row) => {
          const arsenal = row.team.providerTeamId === ARSENAL_ID;
          const zone = row.position <= 4 ? "top" : row.position >= 18 ? "bottom" : row.position <= 7 ? "europe" : "";
          return (
            <div key={row.team.id} className={`standing-row standing-row--${zone} ${arsenal ? "standing-row--arsenal" : ""}`}>
              <span className="standing-row__position">{row.position}</span>
              <span className="standing-row__team"><ClubBadge name={row.team.name} crest={row.team.crest} size={32} /><b>{clubName(row.team.name)}</b></span>
              <span>{row.playedGames}</span><span>{row.won}</span><span>{row.drawn}</span><span>{row.lost}</span>
              <span>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</span>
              <strong>{row.points}</strong>
            </div>
          );
        }) : <p className="data-empty">暂无积分榜，请先运行数据同步。</p>}
      </div>
      <div className="standing-note">
        <span><i className="zone-key zone-key--top" />欧冠资格区</span>
        <span><i className="zone-key zone-key--europe" />欧战资格区</span>
        <span><i className="zone-key zone-key--bottom" />降级区</span>
      </div>
      <LeaguePositionChart points={positionProgression} competitionLabel="英超" />
    </>
  );
}

/* ---------------- Leaderboard tabs ---------------- */

const POSITION_NAMES: Record<string, string> = {
  GK: "门将", CB: "中卫", RB: "右后卫", LB: "左后卫", DM: "后腰", CM: "中场",
  AM: "前腰", RW: "右边锋", LW: "左边锋", ST: "中锋",
};

function LeaderTable({
  rows,
  metric,
  season,
}: {
  rows: LeaderRow[];
  metric: "goals" | "assists";
  season: number | null;
}) {
  const label = metric === "goals" ? "进球" : "助攻";
  const live = rows.some((row) => row.hasLiveStats);
  const seasonText = live && season != null ? `${seasonLabel(season)} 赛季` : "2026-27 赛季";
  return (
    <>
      <div className="standings-toolbar">
        <p className="data-kicker">{seasonText} <b>&rsaquo;</b></p>
        <div className="standings-select"><span>&#9679;</span> 阿森纳队内{label}榜 <b>&#8964;</b></div>
      </div>
      <div className="leader-table">
        <div className="leader-table__head">
          <span>排名</span><span>球员</span><span>位置</span><span>出场</span><span>{label}</span><span>场均评分</span>
        </div>
        {rows.map((row, index) => {
          const value = metric === "goals" ? row.goals : row.assists;
          const shown = row.hasLiveStats && value !== null ? value : "—";
          return (
            <Link key={row.id} href={`/players/${row.id}`} className={`leader-table__row ${index === 0 ? "leader-table__row--top" : ""}`}>
              <span className="leader-table__rank">{index + 1}</span>
              <span className="leader-table__player">
                <span className="leader-table__num">{row.number}</span>
                <b>{row.name}</b>
              </span>
              <span>{POSITION_NAMES[row.position] ?? row.position}</span>
              <span>{row.hasLiveStats && row.appearances !== null ? row.appearances : "—"}</span>
              <strong>{shown}</strong>
              <span>{row.hasLiveStats && row.rating !== null ? row.rating.toFixed(2) : "—"}</span>
            </Link>
          );
        })}
      </div>
      {!live ? (
        <div className="leader-placeholder">
          <b>{label}数据待补充</b>
          <p>尚未同步到本季球员{label}数据，暂以 &mdash; 占位。</p>
        </div>
      ) : null}
    </>
  );
}

/* ---------------- Page ---------------- */

export function TeamDataPage(props: Props) {
  const [tab, setTab] = useState<TabId>("fixtures");
  const switchTab = useCallback((id: TabId) => setTab(id), []);

  const fixtureCount = props.entries.length;

  const competitions = useMemo(() => {
    const set = new Set<string>();
    for (const entry of props.entries) set.add(competitionLabel(entry.competition));
    return Array.from(set);
  }, [props.entries]);

  return (
    <SiteShell active="team-data" source="">
      <section className="data-page">
        <div className="data-page-heading">
          <div>
            <p className="data-kicker">2026/27 赛季 · 男足一线队</p>
            <h1>球队数据</h1>
            <p className="data-page-desc">赛程、积分榜、进球榜与助攻榜在同一页面切换查看，数据在每场比赛结束后更新。</p>
          </div>
          <span className="data-page-heading__meta">数据更新于 {fmtStamp(props.lastUpdatedAt)}</span>
        </div>

        <nav className="tab-nav" aria-label="数据分类">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab-btn ${tab === t.id ? "tab-btn--active" : ""}`}
              aria-pressed={tab === t.id}
              onClick={() => switchTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          <span className="tab-nav__meta">
            共 {fixtureCount} 场比赛 · 覆盖{competitions.length ? competitions.join("、") : "英超、欧冠、联赛杯与足总杯"}
          </span>
        </nav>

        {tab === "fixtures" ? <FixturesTab entries={props.entries} entryReportIds={props.entryReportIds} crestMap={props.crestMap} nowIso={props.nowIso} /> : null}
        {tab === "standings" ? <StandingsTab standings={props.standings} positionProgression={props.positionProgression} /> : null}
        {tab === "goals" ? <LeaderTable rows={props.scorers} metric="goals" season={props.leaderboardSeason} /> : null}
        {tab === "assists" ? <LeaderTable rows={props.assisters} metric="assists" season={props.leaderboardSeason} /> : null}
      </section>
    </SiteShell>
  );
}
