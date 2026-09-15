import { HomeDashboard } from "@/components/home-dashboard";
import { getHomeData } from "@/lib/queries/home";

export const revalidate = 300;

export default async function Home() {
  const data = await getHomeData();
  return <HomeDashboard {...data} nowIso={new Date().toISOString()} />;
}
