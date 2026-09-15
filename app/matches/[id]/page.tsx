import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { MatchCenter } from "@/components/match-center";
import { SiteShell } from "@/components/site-shell";
import { getMatchCenter } from "@/lib/queries/matchReports";

export const metadata: Metadata = {
  title: "比赛中心",
  description: "阿森纳单场比赛中心数据：比分、球员评分与赛后报告。",
};

export const revalidate = 300;

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
