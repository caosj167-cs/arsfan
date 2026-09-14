import Link from "next/link";

import { ClubBadge } from "@/components/club-badge";
import { Countdown } from "@/components/countdown";
import { clubName } from "@/lib/data/clubs";
import type { FixtureView, StandingView } from "@/lib/queries/football";
import type { HomeNewsFeed, HomeNewsItem } from "@/lib/queries/home";

type HomeDashboardProps = {
  fixtures: FixtureView[];
  standings: StandingView[];
  news: HomeNewsFeed | null;
  dataUnavailable?: boolean;
  /** 服务端时间（ISO）：用于挑出真正"下一场"，避免渲染期调用 Date.now() */
  nowIso: string;
};

const ARSENAL_PROVIDER_ID = "57";
const UPCOMING_STATUSES = ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED"];
const COMPETITION_SHORT: Record<string, string> = {
  PL: "英超",
  UCL: "欧冠",
  EL: "欧联",
  ECL: "欧协联",
  FACUP: "足总杯",
  LCUP: "联赛杯",
  "Premier League": "英超",
  "Champions League": "欧冠",
  "FA Cup": "足总杯",
  "League Cup": "联赛杯",
  "EFL Cup": "联赛杯",
};

function competitionShort(code: string | null, name: string) {
  return COMPETITION_SHORT[code ?? ""] ?? COMPETITION_SHORT[name] ?? name;
}

function teamName(team: { name: string; shortName: string | null }) {
  return clubName(team.name) || team.shortName || team.name;
}

function fmtDate(v: string) {
  return new Intl.DateTimeFormat("zh-CN", { day: "numeric", month: "numeric" }).format(new Date(v));
}
function fmtLong(v: string) {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "long", day: "numeric", month: "long" }).format(new Date(v));
}
function fmtTime(v: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v));
}

function isArsenal(f: FixtureView) {
  return f.homeTeam.providerTeamId === ARSENAL_PROVIDER_ID || f.awayTeam.providerTeamId === ARSENAL_PROVIDER_ID;
}

function resultOf(f: FixtureView): "win" | "draw" | "loss" | null {
  if (f.score.home === null || f.score.away === null) return null;
  const home = f.homeTeam.providerTeamId === ARSENAL_PROVIDER_ID;
  const own = home ? f.score.home : f.score.away;
  const opp = home ? f.score.away : f.score.home;
  return own > opp ? "win" : own === opp ? "draw" : "loss";
}

const RESULT_LABEL = { win: "胜", draw: "平", loss: "负" as const };

/* ---------------- 顶部导航 ---------------- */

const NAV = [
  { label: "首页", href: "/" },
  { label: "球队数据", href: "/team-data" },
  { label: "阵容", href: "/players" },
  { label: "新闻", href: "/news" },
];

function Header() {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header__inner">
        <Link className="brand" href="/">
          <span className="brand__crest">A</span>
          <span>
            <b>阿森纳足球俱乐部</b>
            <small>ARSENAL FOOTBALL CLUB</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="主导航">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.href === "/" ? "site-nav__active" : ""}
              aria-current={item.href === "/" ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-ops">
          <span className="header-ops__lang">中文</span>
          <button type="button" className="header-ops__icon" aria-label="搜索" title="搜索（待接入）">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 21 21" />
            </svg>
          </button>
          <button type="button" className="header-ops__icon" aria-label="通知" title="通知（待接入）">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 16V10a6 6 0 0 1 12 0v6l1.5 2H4.5z" />
              <path d="M10 20.5a2 2 0 0 0 4 0" />
            </svg>
          </button>
          <a className="btn btn--primary btn--ticket" href="https://www.arsenal.com/tickets" target="_blank" rel="noreferrer">
            购票入口
          </a>
        </div>
      </div>
    </header>
  );
}

/* ---------------- 主视觉横幅（紧凑版） ---------------- */

function Hero({ arsenalStanding }: { arsenalStanding: StandingView | null }) {
  const stats = [
    { value: arsenalStanding ? `第 ${arsenalStanding.position} 位` : "-", label: "联赛排名" },
    { value: arsenalStanding ? `${arsenalStanding.playedGames} 轮` : "-", label: "已赛场次" },
    { value: arsenalStanding ? `${arsenalStanding.goalsFor} 球` : "-", label: "联赛进球" },
  ];
  return (
    <section className="home-hero">
      <div className="home-hero__media" aria-hidden="true" />
      <div className="home-hero__inner">
        <div className="home-hero__copy">
          <p className="home-hero__tag">2026/27 赛季 · 英格兰超级联赛</p>
          <h1 className="home-hero__title">永不屈服的北伦敦红色</h1>
          <p className="home-hero__desc">
            从海布里到酋长球场，汇集一线队赛程、赛季数据、阵容与新闻资讯。
          </p>
          <div className="home-hero__actions">
            <Link className="btn btn--primary" href="/team-data">
              查看完整赛程
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h13M12.5 6.5 18.5 12l-6 5.5" />
              </svg>
            </Link>
            <a className="btn btn--ghost" href="https://www.arsenal.com/tickets" target="_blank" rel="noreferrer">
              购买主场球票
            </a>
          </div>
        </div>
        <div className="home-hero__stats">
          {stats.map((s) => (
            <div key={s.label}>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 下一场比赛（横排紧凑） ---------------- */

function NextMatch({ fixture }: { fixture: FixtureView | null }) {
  if (!fixture) {
    return (
      <section className="home-next">
        <div className="home-next__card home-next__card--empty">
          <p className="home-next__round">下一场比赛</p>
          <h2>暂无已同步的赛程</h2>
          <p className="home-next__empty">请先运行足球数据同步。</p>
          <Link className="btn btn--primary btn--sm" href="/team-data">查看完整赛程</Link>
        </div>
      </section>
    );
  }

  const arsenalHome = fixture.homeTeam.providerTeamId === ARSENAL_PROVIDER_ID;
  const arsenal = arsenalHome ? fixture.homeTeam : fixture.awayTeam;
  const opponent = arsenalHome ? fixture.awayTeam : fixture.homeTeam;
  const comp = competitionShort(fixture.competition.code, fixture.competition.name);

  return (
    <section className="home-next">
      <div className="home-next__head">
        <span className="home-next__round">
          下一场{fixture.matchday ? ` · ${comp}第 ${fixture.matchday} 轮` : ` · ${comp}`}
        </span>
        <span>{fmtLong(fixture.kickoffAt)} · {fmtTime(fixture.kickoffAt)}</span>
      </div>
      <div className="home-next__card">
        <div className="home-next__teams">
          <div className="home-next__team">
            <ClubBadge name={arsenal.name} crest={arsenal.crest} size={32} />
            <b>{teamName(arsenal)}</b>
          </div>
          <span className="home-next__vs">VS</span>
          <div className="home-next__team home-next__team--away">
            <ClubBadge name={opponent.name} crest={opponent.crest} size={32} />
            <b>{teamName(opponent)}</b>
          </div>
        </div>
        <div className="home-next__cd">
          <Countdown target={fixture.kickoffAt} />
        </div>
        <span className="home-next__venue">{arsenalHome ? "酋长球场" : "客场"}</span>
        <a className="btn btn--primary btn--sm" href="https://www.arsenal.com/tickets" target="_blank" rel="noreferrer">
          购票
        </a>
      </div>
    </section>
  );
}

/* ---------------- 区块标题行 ---------------- */

function SectionHead({ title, note, href, cta }: { title: string; note: string; href?: string; cta?: string }) {
  return (
    <div className="home-head">
      <div>
        <h2>{title}</h2>
        <span>{note}</span>
      </div>
      {href && cta ? (
        <Link className="home-head__link" href={href}>
          {cta}
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}

/* ---------------- 近期战绩（紧凑） ---------------- */

function RecentForm({ fixtures }: { fixtures: FixtureView[] }) {
  const results = fixtures.filter((f) => f.status === "FINISHED" && isArsenal(f)).slice(-5).reverse();
  return (
    <section className="home-section home-section--tight">
      <SectionHead title="近期战绩" note="最近 5 场" href="/team-data" cta="全部比赛" />
      {results.length ? (
        <div className="result-row">
          {results.map((f) => {
            const r = resultOf(f) ?? "draw";
            const arsenalHome = f.homeTeam.providerTeamId === ARSENAL_PROVIDER_ID;
            const opp = arsenalHome ? f.awayTeam : f.homeTeam;
            return (
              <div key={f.id} className="result-card">
                <span className={`result-card__badge result-card__badge--${r}`}>{RESULT_LABEL[r]}</span>
                <div className="result-card__body">
                  <span className="result-card__opp">
                    <ClubBadge name={opp.name} crest={opp.crest} size={18} />
                    <b>{teamName(opp)}</b>
                  </span>
                  <span className="result-card__sub">
                    <strong>{f.score.home} - {f.score.away}</strong>
                    <span>{fmtDate(f.kickoffAt)}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="data-empty">暂无已结束的比赛。</p>
      )}
    </section>
  );
}

/* ---------------- 积分榜摘要（紧凑） ---------------- */

function StandingsSummary({ standings, matchday }: { standings: StandingView[]; matchday: number | null }) {
  return (
    <section className="home-section home-section--tight">
      <SectionHead
        title="英超积分榜"
        note={`第 ${matchday ?? "-"} 轮`}
        href="/team-data"
        cta="完整榜单"
      />
      <div className="home-table">
        <div className="home-table__head">
          <span>#</span><span>球队</span><span>场</span><span>净胜球</span><span>分</span>
        </div>
        {standings.length ? (
          standings.slice(0, 6).map((row) => {
            const arsenal = row.team.providerTeamId === ARSENAL_PROVIDER_ID;
            return (
              <div key={row.team.id} className={`home-table__row${arsenal ? " home-table__row--arsenal" : ""}`}>
                <span className="home-table__pos">{row.position}</span>
                <span className="home-table__team">
                  <ClubBadge name={row.team.name} crest={row.team.crest} size={26} />
                  <b>{teamName(row.team)}</b>
                </span>
                <span>{row.playedGames}</span>
                <span className="home-table__gd">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</span>
                <strong>{row.points}</strong>
              </div>
            );
          })
        ) : (
          <p className="data-empty">积分榜尚未同步。</p>
        )}
      </div>
    </section>
  );
}

/* ---------------- 焦点新闻（列表流） ---------------- */

function NewsItemRow({ item }: { item: HomeNewsItem }) {
  return (
    <a className="news-list-item" href={item.sourceUrl} target="_blank" rel="noreferrer">
      <span className={`news-tag${item.isAi ? " news-tag--ai" : ""}`}>{item.sourceLabel}</span>
      <div className="news-list-item__body">
        <b>{item.title}</b>
        <span>{item.summary ?? ""}</span>
      </div>
      <span className="news-list-item__time">{fmtDate(item.publishedAt)}</span>
    </a>
  );
}

function FocusNews({ items }: { items: HomeNewsItem[] }) {
  if (!items.length) {
    return (
      <section className="home-section home-section--tight">
        <SectionHead title="焦点新闻" note="最新动态" href="/news" cta="更多" />
        <p className="data-empty">新闻暂时不可用。</p>
      </section>
    );
  }
  return (
    <section className="home-section home-section--tight">
      <SectionHead title="焦点新闻" note="最新动态" href="/news" cta="更多" />
      <div className="news-list">
        {items.slice(0, 5).map((item) => (
          <NewsItemRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

/* ---------------- 数据快捷入口（2×2 紧凑） ---------------- */

/**
 * 入口图标：统一 20×20 栅格、1.6 描边、currentColor 取色。
 * 颜色不再写死 hex，改为引用已存在的色板 token（见 ENTRIES.accent）。
 */
const ICON_PROPS = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** 完整赛程：日历 + 行 */
function IconSchedule() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2.5" y="4.5" width="15" height="13" />
      <path d="M2.5 8.5h15" />
      <path d="M6.5 2.5v4M13.5 2.5v4" />
      <path d="M5.5 12h5M5.5 14.8h8" />
    </svg>
  );
}

/** 积分榜：领奖台 */
function IconStandings() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M2.5 17.5h15" />
      <rect x="2.5" y="10.5" width="4.5" height="7" />
      <rect x="7.75" y="6.5" width="4.5" height="11" />
      <rect x="13" y="9" width="4.5" height="8.5" />
    </svg>
  );
}

/** 进球榜：靶心 */
function IconGoals() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="10" cy="10" r="7.5" />
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 10h0" strokeWidth={2.4} />
    </svg>
  );
}

/** 助攻榜：传递（两节点连线） */
function IconAssists() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="4.5" cy="15.5" r="2.6" />
      <circle cx="15.5" cy="4.5" r="2.6" />
      <path d="M6.4 13.6 13.6 6.4" />
    </svg>
  );
}

const ENTRIES = [
  { title: "完整赛程", note: "英超 / 欧冠 / 杯赛", href: "/team-data", accent: "var(--comp-ucl-fg)", icon: <IconSchedule /> },
  { title: "积分榜", note: "排名与净胜球", href: "/team-data", accent: "var(--gold)", icon: <IconStandings /> },
  { title: "进球榜", note: "射手排行", href: "/team-data", accent: "var(--accent-link)", icon: <IconGoals /> },
  { title: "助攻榜", note: "助攻数据", href: "/team-data", accent: "var(--comp-pl-fg)", icon: <IconAssists /> },
];

function QuickEntries() {
  return (
    <section className="home-section home-section--tight">
      <SectionHead title="数据中心" note="快速跳转" />
      <div className="entry-grid">
        {ENTRIES.map((e) => (
          <Link key={e.title} className="entry-card entry-card--compact" href={e.href}>
            <span className="entry-card__icon" style={{ color: e.accent }} aria-hidden="true">
              {e.icon}
            </span>
            <b>{e.title}</b>
            <span>{e.note}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------------- 极简底栏 ---------------- */

function MiniFooter() {
  return (
    <footer className="home-mini-footer">
      <span>&copy; 2026 阿森纳球迷中心 &middot; 由球迷社区维护</span>
    </footer>
  );
}

/* ---------------- 页面 ---------------- */

export function HomeDashboard({ fixtures, standings, news, dataUnavailable = false, nowIso }: HomeDashboardProps) {
  const now = new Date(nowIso).getTime();
  const upcoming = fixtures.filter((f) => UPCOMING_STATUSES.includes(f.status));
  const nextFixture = upcoming.find((f) => new Date(f.kickoffAt).getTime() > now) ?? upcoming[0] ?? null;
  const arsenalStanding = standings.find((row) => row.team.providerTeamId === ARSENAL_PROVIDER_ID) ?? null;
  const matchday = fixtures
    .filter((f) => isArsenal(f) && f.matchday !== null)
    .reduce<number | null>((max, f) => (max === null || (f.matchday as number) > max ? f.matchday : max), null);

  return (
    <div className="dashboard-shell">
      <Header />
      <main className="dashboard-main">
        {dataUnavailable ? (
          <div className="dashboard-notice">部分实时数据暂时不可用，当前显示已缓存或空状态。</div>
        ) : null}
        <Hero arsenalStanding={arsenalStanding} />
        <div className="home-grid">
          <div className="home-grid__main">
            <NextMatch fixture={nextFixture} />
            <RecentForm fixtures={fixtures} />
            <StandingsSummary standings={standings} matchday={matchday} />
          </div>
          <div className="home-grid__side">
            <FocusNews items={news?.items ?? []} />
            <QuickEntries />
          </div>
        </div>
      </main>
      <MiniFooter />
    </div>
  );
}
