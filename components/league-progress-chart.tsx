"use client";

import dynamic from "next/dynamic";

import type { ProgressionPoint } from "@/lib/data/points-progression";

// ECharts 动态导入（避免 SSR 问题）——与球员详情页雷达图同一套做法
const ReactECharts = dynamic(() => import("echarts-for-react").then((mod) => mod.default), {
  ssr: false,
  loading: () => <div className="league-progress__loading">加载图表…</div>,
});

const ARSENAL_RED = "#EF0107";
const GOAL_DIFF_GREEN = "#3DD68C";
const AXIS_TEXT = "#A1AABF";

const RESULT_LABEL: Record<ProgressionPoint["result"], string> = { W: "胜", D: "平", L: "负" };

/**
 * 联赛积分走势：累计积分（主轴）+ 累计净胜球（副轴）。
 * 数据来自三源合并赛程（与「赛程」tab 同源），因此与积分榜口径一致。
 */
export function LeagueProgressChart({
  points,
  competitionLabel,
  seasonLabel: seasonText,
}: {
  points: ProgressionPoint[];
  competitionLabel: string;
  seasonLabel?: string | null;
}) {
  if (points.length < 2) {
    return (
      <div className="league-progress">
        <p className="league-progress__hint">
          {seasonText ? `${seasonText} · ` : ""}本赛季{competitionLabel}已完赛 {points.length} 场，满 2 场后绘制走势。
        </p>
      </div>
    );
  }

  const option = {
    backgroundColor: "transparent",
    grid: { left: 4, right: 4, top: 44, bottom: 4, containLabel: true },
    legend: {
      top: 6,
      icon: "roundRect",
      itemHeight: 8,
      itemWidth: 14,
      textStyle: { color: AXIS_TEXT, fontSize: 12 },
      data: ["累计积分", "累计净胜球"],
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#21212A",
      borderColor: "rgba(255,255,255,0.2)",
      textStyle: { color: "#FFFFFF", fontSize: 12 },
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as Array<{ dataIndex?: number }>;
        const point = points[list[0]?.dataIndex ?? 0];
        if (!point) return "";
        const venue = point.homeAway === "HOME" ? "主" : "客";
        const diff = point.cumulativeGoalDiff > 0 ? `+${point.cumulativeGoalDiff}` : `${point.cumulativeGoalDiff}`;
        return [
          `第 ${point.matchday} 轮 · ${venue} vs ${point.opponentName}`,
          `${point.goalsFor}-${point.goalsAgainst}　${RESULT_LABEL[point.result]}`,
          `累计积分 ${point.cumulativePoints}　累计净胜球 ${diff}`,
        ].join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: points.map((point) => `第${point.matchday}轮`),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
      axisLabel: { color: AXIS_TEXT, fontSize: 11 },
    },
    yAxis: [
      {
        type: "value",
        name: "积分",
        nameTextStyle: { color: AXIS_TEXT, fontSize: 11 },
        axisLabel: { color: AXIS_TEXT, fontSize: 11 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.07)" } },
      },
      {
        type: "value",
        name: "净胜球",
        nameTextStyle: { color: AXIS_TEXT, fontSize: 11 },
        axisLabel: { color: AXIS_TEXT, fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "累计积分",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        data: points.map((point) => point.cumulativePoints),
        lineStyle: { color: ARSENAL_RED, width: 2 },
        itemStyle: { color: ARSENAL_RED },
        areaStyle: { color: "rgba(228, 0, 43, 0.16)" },
      },
      {
        name: "累计净胜球",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        data: points.map((point) => point.cumulativeGoalDiff),
        lineStyle: { color: GOAL_DIFF_GREEN, width: 1.6, type: "dashed" },
        itemStyle: { color: GOAL_DIFF_GREEN },
      },
    ],
  };

  return (
    <div className="league-progress">
      <p className="league-progress__head">
        {seasonText ? `${seasonText} ` : ""}{competitionLabel}累计积分走势
      </p>
      <ReactECharts option={option} style={{ width: "100%", height: 300 }} opts={{ renderer: "canvas" }} />
      <p className="league-progress__note">
        已完赛 {points.length} 场 · 数据源：三源合并赛程（与积分榜同口径）
      </p>
    </div>
  );
}
