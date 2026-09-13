import { redirect } from "next/navigation";

/** 积分榜已合并进「球队数据」单页（Tab 切换），保留旧路径做跳转。 */
export default function StandingsRoute() {
  redirect("/team-data");
}
