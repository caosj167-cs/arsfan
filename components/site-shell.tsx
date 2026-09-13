import Link from "next/link";

export type SiteSection = "home" | "team-data" | "players" | "news";

const NAV: { id: SiteSection; label: string; href: string }[] = [
  { id: "home", label: "首页", href: "/" },
  { id: "team-data", label: "球队数据", href: "/team-data" },
  { id: "players", label: "阵容", href: "/players" },
  { id: "news", label: "新闻", href: "/news" },
];

export function SiteHeader({ active }: { active?: SiteSection }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/">
          <span className="brand__crest">A</span>
          <span>
            <b>阿森纳</b>
            <small>球迷数据中心</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="主导航">
          {NAV.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={active === item.id ? "site-nav__active" : ""}
              aria-current={active === item.id ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="header-season">
          2026 / 27 <i>&#8964;</i>
        </span>
      </div>
    </header>
  );
}

export function SiteFooter({ source }: { source?: string }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <span>阿森纳球迷数据中心</span>
        <span>{source ?? "足球数据：Football-Data.org · 新闻：The Guardian"}</span>
        <span>数据仅供参考</span>
      </div>
    </footer>
  );
}

export function SiteShell({
  active,
  source,
  children,
}: {
  active?: SiteSection;
  source?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="data-shell">
      <SiteHeader active={active} />
      <main className="data-main">{children}</main>
      <SiteFooter source={source} />
    </div>
  );
}
