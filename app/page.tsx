import { HomeDashboard } from "@/components/home-dashboard";
import { getHomeData } from "@/lib/queries/home";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "首页",
  description: "阿森纳赛程、近期战绩、积分榜与俱乐部新闻速览。",
};

export const revalidate = 300;

export default async function Home() {
  const data = await getHomeData();
  return <HomeDashboard {...data} nowIso={new Date().toISOString()} />;
}
