"use client";

import dynamic from "next/dynamic";

import type { PositionPoint } from "@/lib/data/league-position";

// ECharts 动态导入（避免 SSR 问题）——与球员详情页雷达图同一套做法
const ReactECharts = dynamic(() => import("echarts-for-react").then((mod) => mod.default), {
  ssr: false,
  loading: () => <div className="league-progress__loading">加载图表…</div>,
});

const ARSENAL_RED = "#EF0107";
const AXIS_TEXT = "#A1AABF";

/**
 * 联赛名次走势图（默认英超）：纵轴为名次（**反向**，第 1 名在顶部），横轴为轮次。
 * 名次由「全部联赛场次的结果」逐轮推算（只看阿森纳自己的赛程算不出排名）。
 */
export function LeaguePositionChart({
  points,
  competitionLabel,
}: {
  points: PositionPoint[];
  competitionLabel: string;
}) {
  if (!points.length) {
    return (
      <div className="league-progress">
        <p className="league-progress__head">{competitionLabel}排名走势</p>
        <p className="league-progress__hint">暂无排名走势数据，请先运行一次积分榜同步。</p>
      </div>
    );
  }

  const positions = points.map((point) => point.position);
  // 纵轴范围：1 → 比最差名次再放宽一点（最多到 20），既保证 1 在顶部又留出可读空间
  const axisMax = Math.min(20, Math.max(3, Math.max(...positions) + 1));

  const option = {
    backgroundColor: "transparent",
    grid: { left: 4, right: 20, top: 16, bottom: 4, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#21212A",
      borderColor: "rgba(255,255,255,0.2)",
      textStyle: { color: "#FFFFFF", fontSize: 12 },
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as Array<{ dataIndex?: number }>;
        const point = points[list[0]?.dataIndex ?? 0];
        if (!point) return "";
        const diff = point.goalDifference > 0 ? `+${point.goalDifference}` : `${point.goalDifference}`;
        return [
          `第 ${point.round} 轮结束`,
          `名次 第 ${point.position} 名　积分 ${point.points}`,
          `战绩 ${point.won}胜${point.drawn}平${point.lost}负　净胜球 ${diff}`,
        ].join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: points.map((point) => `第${point.round}轮`),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
      axisLabel: { color: AXIS_TEXT, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      // 反向：名次越小越靠上（第 1 名在顶部）
      inverse: true,
      min: 1,
      max: axisMax,
      interval: 1,
      name: "名次",
      nameTextStyle: { color: AXIS_TEXT, fontSize: 11 },
      axisLabel: { color: AXIS_TEXT, fontSize: 11, formatter: "{value}" },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.07)" } },
    },
    series: [
      {
        name: "名次",
        type: "line",
        smooth: false,
        symbol: "circle",
        symbolSize: 9,
        data: points.map((point) => point.position),
        lineStyle: { color: ARSENAL_RED, width: 2 },
        itemStyle: { color: ARSENAL_RED, borderColor: "#0E0E12", borderWidth: 1 },
        label: {
          show: true,
          position: "bottom",
          distance: 6,
          color: AXIS_TEXT,
          fontSize: 11,
          formatter: (params: { value?: number }) => (params.value ? `第${params.value}` : ""),
        },
      },
    ],
  };

  return (
    <div className="league-progress">
      <p className="league-progress__head">{competitionLabel}排名走势</p>
      <ReactECharts option={option} style={{ width: "100%", height: 280 }} opts={{ renderer: "canvas" }} />
      <p className="league-progress__note">
        已完赛 {points.length} 轮 · 名次由全部联赛结果逐轮推算（与积分榜同口径）
      </p>
    </div>
  );
}
