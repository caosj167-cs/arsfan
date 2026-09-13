import Link from "next/link";
import { notFound } from "next/navigation";

import { PlayerDetail } from "@/components/player-detail";
import { SiteShell } from "@/components/site-shell";
import { getPlayerDetail, getPlayerSeasonStatBySlug, seasonLabel } from "@/lib/queries/players";

export const dynamic = "force-dynamic";

export default async function PlayerRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = getPlayerDetail(id);
  if (!player) notFound();

  const seasonStat = await getPlayerSeasonStatBySlug(id);
  const source = seasonStat
    ? `赛季统计：按场抓取（FotMob）· ${seasonLabel(seasonStat.season)}`
    : "球员属性：2026-27 评估表 · 赛季统计待同步";

  return (
    <SiteShell active="players" source={source}>
      <section className="player-page">
        <div className="data-page-heading data-page-heading--compact">
          <div>
            <p className="data-kicker">阵容 / 球员资料</p>
            <h1>
              {player.name}
              <span>。</span>
            </h1>
          </div>
          <Link href="/players" className="back-link">
            ← 返回阵容
          </Link>
        </div>
        <PlayerDetail player={player} seasonStat={seasonStat} />
      </section>
    </SiteShell>
  );
}
