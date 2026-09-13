import { notFound } from "next/navigation";

import { MatchDetail } from "@/components/match-detail";
import { getMatchDetail } from "@/lib/queries/match";

export const dynamic = "force-dynamic";

export default async function FixtureDetailPage({ params }: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await params;
  const detail = await getMatchDetail(fixtureId);
  if (!detail.storedFixture && !detail.fixture) notFound();
  return <MatchDetail detail={detail} />;
}
