import { SiteShell } from "@/components/site-shell";
import type { GuardianNewsResult, NewsArticle } from "@/lib/providers/guardian";
import type { getOfficialNews } from "@/lib/queries/official";

type OfficialNewsResult = Awaited<ReturnType<typeof getOfficialNews>>;

type DisplayNewsArticle = Pick<NewsArticle, "id" | "title" | "summary" | "publishedAt" | "sourceUrl" | "imageUrl"> & {
  category: string;
  source: string;
  fetchedAt?: string;
};

function date(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(value));
}

function stamp(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
    : "页面查询时";
}

function NewsImage({ article, className = "" }: { article: DisplayNewsArticle; className?: string }) {
  return (
    <div className={`news-image ${className}`}>
      {article.imageUrl ? <img src={article.imageUrl} alt="" loading="lazy" /> : <span>ARSENAL<br />NEWS</span>}
    </div>
  );
}

function NewsCard({ article, featured = false }: { article: DisplayNewsArticle; featured?: boolean }) {
  return (
    <a className={`news-card ${featured ? "news-card--featured" : ""}`} href={article.sourceUrl} target="_blank" rel="noreferrer">
      <NewsImage article={article} />
      <div className="news-card__body">
        <div className="news-card__meta">{article.category} <span>{date(article.publishedAt)}</span></div>
        <h2>{article.title}</h2>
        {article.summary ? <p>{article.summary}</p> : null}
        <span className="news-card__arrow">↗</span>
      </div>
    </a>
  );
}

export function NewsPage({ news, officialNews }: { news: GuardianNewsResult | null; officialNews?: OfficialNewsResult | null }) {
  const officialArticles = officialNews?.articles ?? [];
  const articles: DisplayNewsArticle[] = officialArticles.length ? officialArticles : (news?.articles ?? []);
  const source = officialArticles.length ? "阿森纳官网" : "The Guardian";
  const lastFetchedAt = officialArticles.length ? officialNews?.lastFetchedAt : news?.lastUpdatedAt;
  const lead = articles[0];

  return (
    <SiteShell active="news" source={`新闻来源：${source} · 足球数据：Football-Data.org`}>
      <section className="news-page">
        <div className="news-page__heading">
          <div>
            <p className="data-kicker">阿森纳 / 新闻中心</p>
            <h1>枪迷的<em>每日简报</em></h1>
            <p className="data-page-desc">从赛场到训练场，汇集围绕阿森纳的最新报道与观点。</p>
          </div>
          <div className="news-page__intro">
            <span>{source}</span>
            <p>已收录 {articles.length || 0} 条报道</p>
          </div>
        </div>

        {lead ? <NewsCard article={lead} featured /> : <p className="data-empty">新闻暂时不可用。</p>}

        <div className="news-grid">
          {articles.slice(1).map((article) => <NewsCard article={article} key={article.id} />)}
        </div>

        {articles.length ? (
          <div className="news-page__footer">
            已收录 {articles.length.toLocaleString("zh-CN")} 条新闻 <span>·</span> 来源：{source} <span>·</span> 抓取时间：{stamp(lastFetchedAt)}
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}
