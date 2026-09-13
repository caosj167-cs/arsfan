import { NewsPage } from "@/components/data-pages";
import { fetchGuardianNews, type GuardianNewsResult } from "@/lib/providers/guardian";
import { getOfficialNews } from "@/lib/queries/official";

export const dynamic = "force-dynamic";

export default async function NewsRoute() {
  const [officialResult, guardianResult] = await Promise.allSettled([
    getOfficialNews({ pageSize: 10 }),
    fetchGuardianNews({ pageSize: 10 }),
  ]);
  const officialNews = officialResult.status === "fulfilled" ? officialResult.value : null;
  const news: GuardianNewsResult | null = guardianResult.status === "fulfilled" ? guardianResult.value : null;
  if (officialResult.status === "rejected") console.error("Official news read failed", officialResult.reason);
  if (guardianResult.status === "rejected") console.error("Guardian news read failed", guardianResult.reason);
  return <NewsPage news={news} officialNews={officialNews} />;
}
