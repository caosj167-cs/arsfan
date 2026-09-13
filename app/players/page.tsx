import { SiteShell } from "@/components/site-shell";
import { SquadPage } from "@/components/squad-page";
import { getRealStatsBySlug, getSquadData, resolveSeason, seasonLabel } from "@/lib/queries/players";

export const dynamic = "force-dynamic";

export default async function SquadRoute() {
  const data = getSquadData();
  const realStats = await getRealStatsBySlug();
  const hasReal = Object.keys(realStats).length > 0;
  const season = await resolveSeason();
  const source = hasReal
    ? `球员属性：2026-27 评估表 · 赛季统计：按场抓取（FotMob）${seasonLabel(season)}`
    : "球员属性：2026-27 评估表 · 赛季统计待同步";

  return (
    <SiteShell active="players" source={source}>
      <section className="squad-page">
        <div className="data-page-heading data-page-heading--compact">
          <div>
            <p className="data-kicker">阿森纳 / 一线队</p>
            <h1>
              阵容<span>。</span>
            </h1>
            <p className="data-page-desc">
              2026-27 赛季一线队名单，点击球衣或列表查看球员资料与能力图。
              {hasReal ? `（出场/进球/评分为 FotMob ${seasonLabel(season)} 抓取聚合，未命中显示“—”）` : ""}
            </p>
          </div>
          <div className="data-filter">
            <span>{hasReal ? `${seasonLabel(season)} 赛季` : "2026-27 赛季"}</span>
            <b>&#8964;</b>
          </div>
        </div>
        <SquadPage
          formation={data.formation}
          goalkeepers={data.goalkeepers}
          defenders={data.defenders}
          midfielders={data.midfielders}
          forwards={data.forwards}
          realStats={realStats}
        />
      </section>
    </SiteShell>
  );
}
