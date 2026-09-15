import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { MatchDetail } from "@/components/match-detail";
import { getMatchDetail } from "@/lib/queries/match";

export const metadata: Metadata = {
  title: "比赛详情",
  description: "阿森纳单场比赛详情：赛程、比分与赛事信息。",
};

export const revalidate = 300;

export default async function FixtureDetailPage({ params }: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await params;
  const detail = await getMatchDetail(fixtureId);
  if (!detail.storedFixture && !detail.fixture) notFound();
  return <MatchDetail detail={detail} />;
}
