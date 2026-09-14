import { notFound } from "next/navigation";

import { MatchCenter } from "@/components/match-center";
import { SiteShell } from "@/components/site-shell";
import { getMatchCenter } from "@/lib/queries/matchReports";

export const dynamic = "force-dynamic";

export default async function MatchRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getMatchCenter(id);
  if (!view) notFound();

  const source = view.report
    ? `比赛数据：抓取于 ${view.report.fetchedAt.slice(0, 10)}`
    : "比赛数据：尚未抓取";

  return (
    <SiteShell active="team-data" source={source}>
      <section className="match-page">
        <MatchCenter view={view} />
      </section>
    </SiteShell>
  );
}
