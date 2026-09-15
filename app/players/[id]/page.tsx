import Link from "next/link";
import { notFound } from "next/navigation";

import { PlayerDetail } from "@/components/player-detail";
import { SiteShell } from "@/components/site-shell";
import { getPlayerDetail, getPlayerSeasonStatBySlug, seasonLabel } from "@/lib/queries/players";
import type { Metadata } from "next";
import { getPlayerById } from "@/lib/data/squad";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const player = getPlayerById(id);
  if (!player) return { title: "球员未找到" };
  return {
    title: `球员：${player.name}`,
    description: `${player.name}（${player.nameEn}）· ${player.position} · ${player.nationality}，阿森纳 2026-27 赛季球员数据。`,
  };
}

export const revalidate = 300;

export default async function PlayerRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = getPlayerDetail(id);
  if (!player) notFound();

  const seasonStat = await getPlayerSeasonStatBySlug(id);
  const source = seasonStat
    ? `赛季统计：${seasonLabel(seasonStat.season)}`
    : "球员属性：2026-27 评估表 · 赛季统计待同步";

  return (
    <SiteShell active="players" source={source}>
      <section className="player-page">
        <div className="data-page-heading data-page-heading--compact">
          <div>
            <p className="data-kicker">阵容 / 球员资料</p>
            <h1>{player.name}</h1>
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
