import { HomeDashboard } from "@/components/home-dashboard";
import { getHomeData } from "@/lib/queries/home";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getHomeData();
  return <HomeDashboard {...data} nowIso={new Date().toISOString()} />;
}
