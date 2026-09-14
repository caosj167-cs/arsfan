"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { SquadPlayer } from "@/lib/data/squad";
import { getOutfieldAttrs } from "@/lib/data/squad";
import { PLAYER_FINANCE } from "@/lib/data/player-finance";
import { getPlayerPhoto } from "@/lib/data/player-photos";
import { seasonLabel } from "@/lib/data/season";
import { SEASON_STAT_COLUMNS, statCell } from "@/lib/data/player-metrics";
import type { PlayerSeasonStatView } from "@/lib/queries/players";

// ECharts 动态导入（避免 SSR 问题）
const ReactECharts = dynamic(() => import("echarts-for-react").then((mod) => mod.default), {
  ssr: false,
  loading: () => <div className="radar-loading">加载图表…</div>,
});

type PlayerDetailProps = {
  player: SquadPlayer;
  /** 真实赛季统计（比赛数据聚合落库）。为 null 时页面显示"暂无数据"，不展示占位数 */
  seasonStat?: PlayerSeasonStatView | null;
};

const TABS = ["属性", "数据", "位置和角色"] as const;
type TabKey = (typeof TABS)[number];

// ---- 主组件 ----

export function PlayerDetail({ player, seasonStat = null }: PlayerDetailProps) {
  const [tab, setTab] = useState<TabKey>("属性");
  const gk = player.position === "GK";
  const attrs = gk ? null : (getOutfieldAttrs(player) ?? null);
  const finance = PLAYER_FINANCE[player.id];

  return (
    <div className="player-detail">
      {/* 顶部绿色信息卡 */}
      <header className="player-header">
        <div className="player-header__photo">
          <Image
            src={getPlayerPhoto(player.id)}
            alt={player.name}
            width={88}
            height={88}
            className="player-header__img"
          />
        </div>
        <div className="player-header__info">
          <h1>{player.name}</h1>
          <p className="player-header__meta">
            <span className="squad-badge">阿森纳</span>
            {player.birthDate && (
              <span>{player.birthDate} ({calcAge(player.birthDate)}岁)</span>
            )}
            {player.height && <span>{player.height}cm</span>}
            {player.weight && <span>{player.weight}kg</span>}
            <span>{player.nationality}</span>
          </p>
        </div>
        <div className="player-header__right">
          {finance ? (
            <>
              <div className="player-header__value">
                <span className="player-value-range">€{finance.marketValue}m</span>
                <span className="player-value-label">身价</span>
              </div>
              <div className="player-header__contract">
                <p>合同到期：{finance.contractUntil}</p>
                <p>周薪：£{finance.weeklyWage.toLocaleString("en-GB")}</p>
                <p>年薪：£{finance.annualSalary}m</p>
              </div>
              {finance.note && <p className="player-finance-note">{finance.note}</p>}
            </>
          ) : (
            <>
              <div className="player-header__value">
                <span className="player-value-range">待补充</span>
              </div>
              <div className="player-header__contract">
                <p>合同截止：待补充</p>
                <p>周薪：待补充</p>
                <p>年薪：待补充</p>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Tab 栏 */}
      <nav className="player-tabs" aria-label="球员详情标签页">
        {TABS.map((t) => (
          <button
            key={t}
            className={`player-tab ${tab === t ? "player-tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* Tab 内容 */}
      <div className="player-body">
        {tab === "属性" && attrs && <AttributesTab player={player} attrs={attrs} />}
        {tab === "属性" && !attrs && <GkAttributesTab player={player} />}
        {tab === "数据" && <StatsTab seasonStat={seasonStat} />}
        {tab === "位置和角色" && <PositionTab player={player} />}
      </div>
    </div>
  );
}

// ---- 属性 Tab（场上球员） ----

function AttributesTab({ player, attrs }: { player: SquadPlayer; attrs: NonNullable<ReturnType<typeof getOutfieldAttrs>> }) {
  const rows = [
    ["防守", attrs.defense], ["身体", attrs.physical], ["速度", attrs.pace],
    ["视野", attrs.vision], ["进攻", attrs.attack], ["技术", attrs.technique],
    ["制空", attrs.aerial], ["精神", attrs.mental],
  ] as const;

  return (
    <div className="attrs-layout">
      <div className="attrs-bars">
        {rows.map(([label, value]) => (
          <AttrBar key={label} label={label} value={value} />
        ))}
      </div>
      <div className="attrs-radar">
        <RadarChart player={player} />
      </div>
    </div>
  );
}

// ---- 属性 Tab（门将） ----

function GkAttributesTab({ player }: { player: SquadPlayer }) {
  const a = player.attributes as import("@/lib/data/squad").GoalkeeperAttributes;
  const rows = [
    ["扑救", a.saving], ["覆盖", a.coverage], ["反应", a.reflexes],
    ["出球", a.distribution], ["神扑", a.spectacular], ["脚下", a.feet],
    ["制空", a.aerial], ["指挥", a.command],
  ] as const;

  return (
    <div className="attrs-layout">
      <div className="attrs-bars">
        {rows.map(([label, value]) => (
          <AttrBar key={label} label={label} value={value} />
        ))}
      </div>
      <div className="attrs-radar">
        <GkRadarChart player={player} />
      </div>
    </div>
  );
}

// ---- 数据 Tab ----

function StatsTab({ seasonStat }: { seasonStat: PlayerSeasonStatView | null }) {
  if (!seasonStat) {
    return <p className="data-empty">赛季统计暂无数据。</p>;
  }
  const s = seasonStat;
  return (
    <>
      <p className="stats-source">
        更新于 {s.lastSyncedAt.slice(0, 10)}
      </p>
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              <th>赛季</th>
              {SEASON_STAT_COLUMNS.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{seasonLabel(s.season)}</td>
              {SEASON_STAT_COLUMNS.map((column) => (
                <td key={column.key} className={column.emphasis ? "stat-emph" : undefined}>
                  {statCell(column, s)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---- 位置和角色 Tab ----

function PositionTab({ player }: { player: SquadPlayer }) {
  // 简化的位置热力图——用固定点位展示可打位置
  const posMap: Record<string, { x: number; y: number }[]> = {
    ST: [{ x: 50, y: 12 }],
    RW: [{ x: 78, y: 28 }],
    LW: [{ x: 22, y: 28 }],
    AM: [{ x: 50, y: 32 }, { x: 72, y: 30 }, { x: 28, y: 30 }],
    CM: [{ x: 65, y: 48 }, { x: 35, y: 48 }, { x: 50, y: 50 }],
    DM: [{ x: 70, y: 52 }, { x: 30, y: 52 }, { x: 50, y: 54 }],
    RB: [{ x: 83, y: 75 }],
    LB: [{ x: 17, y: 75 }],
    CB: [{ x: 62, y: 77 }, { x: 38, y: 77 }],
    GK: [{ x: 50, y: 92 }],
  };

  const bestPos = player.positions[0];
  const dots = player.positions.flatMap((pos) => posMap[pos] ?? []);

  return (
    <div className="position-layout">
      <div className="position-pitch">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pos-pitch-svg">
          <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" rx="1" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.12)" strokeWidth="0.35" />
          <circle cx="50" cy="50" r="9" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.35" />
          <rect x="28" y="0" width="44" height="16.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.35" />
          <rect x="28" y="83.5" width="44" height="16.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.35" />
          {dots.map((d, i) => (
            <circle
              key={i}
              cx={d.x} cy={d.y}
              r={i === 0 ? 2.5 : 1.8}
              fill={i === 0 ? "#EF0107" : "#5D90A8"}
              opacity={i === 0 ? 1 : 0.65}
              stroke={i === 0 ? "#fff" : "none"}
              strokeWidth="0.4"
            />
          ))}
        </svg>
      </div>
      <div className="position-info">
        <p className="position-best">
          最佳角色是 <strong>{positionLabel(bestPos)}</strong>
        </p>
        <p className="position-desc">{positionDesc(bestPos)}</p>
        <div className="position-list">
          <span>可打位置：</span>
          {player.positions.map((p) => (
            <span key={p} className={`pos-tag ${p === bestPos ? "pos-tag--best" : ""}`}>
              {positionLabel(p)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- 雷达图组件（ECharts） ----

function RadarChart({ player, compact }: { player: SquadPlayer; compact?: boolean }) {
  const attrs = getOutfieldAttrs(player);
  if (!attrs) return null;

  const indicators = [
    { name: "防守", max: 20 },
    { name: "身体", max: 20 },
    { name: "速度", max: 20 },
    { name: "视野", max: 20 },
    { name: "进攻", max: 20 },
    { name: "技术", max: 20 },
    { name: "制空", max: 20 },
    { name: "精神", max: 20 },
  ];

  const values = [
    attrs.defense, attrs.physical, attrs.pace,
    attrs.vision, attrs.attack, attrs.technique,
    attrs.aerial, attrs.mental,
  ];

  const option = {
    backgroundColor: "transparent",
    radar: {
      indicator: indicators,
      shape: "polygon",
      axisName: { color: "#A1AABF", fontSize: compact ? 11 : 13 },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.09)" } },
      splitArea: { areaStyle: { color: ["#1A1F2E", "#161C28"] } },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.09)" } },
    },
    series: [{
      type: "radar",
      data: [{
        value: values,
        name: player.nameEn,
        areaStyle: { color: "rgba(239, 1, 7, 0.22)" },
        lineStyle: { color: "#EF0107", width: 1.8 },
        itemStyle: { color: "#EF0107" },
      }],
    }],
    tooltip: {
      trigger: "item",
      formatter: (params: { data: { value: number[] } }) => {
        const v = params.data.value;
        const names = indicators.map((i) => i.name);
        return names.map((n, i) => `${n}: ${v[i]}`).join("<br/>");
      },
    },
  };

  return <ReactECharts option={option} style={{ width: "100%", height: compact ? 260 : 380 }} opts={{ renderer: "canvas" }} />;
}

/** 门将雷达图（8 维：扑救/覆盖/反应/出球/神扑/脚下/制空/指挥） */
function GkRadarChart({ player }: { player: SquadPlayer }) {
  const a = player.attributes as import("@/lib/data/squad").GoalkeeperAttributes;

  const indicators = [
    { name: "扑救", max: 20 }, { name: "覆盖", max: 20 },
    { name: "反应", max: 20 }, { name: "出球", max: 20 },
    { name: "神扑", max: 20 }, { name: "脚下", max: 20 },
    { name: "制空", max: 20 }, { name: "指挥", max: 20 },
  ];
  const values = [a.saving, a.coverage, a.reflexes, a.distribution, a.spectacular, a.feet, a.aerial, a.command];

  const option = {
    backgroundColor: "transparent",
    radar: {
      indicator: indicators,
      shape: "polygon",
      axisName: { color: "#A1AABF", fontSize: 12 },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.09)" } },
      splitArea: { areaStyle: { color: ["#1A1F2E", "#161C28"] } },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.09)" } },
    },
    series: [{
      type: "radar",
      data: [{
        value: values,
        name: player.nameEn,
        areaStyle: { color: "rgba(93, 144, 168, 0.22)" },
        lineStyle: { color: "#5D90A8", width: 1.8 },
        itemStyle: { color: "#5D90A8" },
      }],
    }],
  };

  return <ReactECharts option={option} style={{ width: "100%", height: 380 }} opts={{ renderer: "canvas" }} />;
}

// ---- 共享 UI 原子组件 ----

function AttrBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="attr-bar">
      <span className="attr-bar__label">{label}</span>
      <div className="attr-bar__track">
        <div className="attr-bar__fill" style={{ width: `${(value / 20) * 100}%` }} />
      </div>
      <span className="attr-bar__value">{value}</span>
    </div>
  );
}

// ---- 工具函数 ----

function calcAge(birthDate: string): number {
  const [d, m, y] = birthDate.split("/").map(Number);
  const birth = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

function positionLabel(pos: string): string {
  const map: Record<string, string> = {
    GK: "GK", CB: "D (C)", RB: "D (R)", LB: "D (L)",
    DM: "DM", CM: "CM", AM: "AM",
    RW: "AM (R)", LW: "AM (L)", ST: "ST (C)", W: "W",
  };
  return map[pos] ?? pos;
}

function positionDesc(pos: string): string {
  const map: Record<string, string> = {
    ST: "中锋 — 内切型终结者",
    RW: "右边锋 — 内切型边锋",
    LW: "左边锋 — 速度型边锋",
    AM: "前腰 — 组织核心",
    CM: "中场 — 全能中場",
    DM: "后腰 — 防守屏障",
    RB: "右后卫 — 攻守兼备",
    LB: "左后卫 — 叠瓦助攻",
    CB: "中后卫 — 后防核心",
    GK: "门将 — 最后一道防线",
  };
  return map[pos] ?? "";
}
