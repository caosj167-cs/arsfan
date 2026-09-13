"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

import type { SquadPlayer, FormationSlot } from "@/lib/data/squad";
import {
  isGoalkeeper,
  getOutfieldAttrs,
  type OutfieldAttributes,
  type GoalkeeperAttributes,
} from "@/lib/data/squad";
import type { PlayerSeasonStatView } from "@/lib/queries/players";
import { SEASON_STAT_COLUMNS, statCell } from "@/lib/data/player-metrics";

/** squad slug → 真实赛季统计（仅包含已命中的球员） */
type RealStats = Record<string, PlayerSeasonStatView>;

// ---- 类型 ----

type SquadPageProps = {
  formation: (FormationSlot & { player?: SquadPlayer })[];
  goalkeepers: SquadPlayer[];
  defenders: SquadPlayer[];
  midfielders: SquadPlayer[];
  forwards: SquadPlayer[];
  /** squad slug → 真实赛季统计（未命中的球员不显示数值） */
  realStats: RealStats;
};

// ---- 子组件：足球场阵型 ----

function Pitch({ formation, realStats }: { formation: (FormationSlot & { player?: SquadPlayer })[]; realStats: RealStats }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? formation.find((s) => s.player?.id === selectedId)?.player : undefined;
  const selectedStat = selected ? realStats[selected.id] : undefined;

  return (
    <div className="squad-pitch-wrap">
      <div className="squad-pitch" aria-label="阿森纳 4-3-3 阵型">
        {/* 草皮纹理 + 场地线 */}
        <svg className="squad-pitch__lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* 外框 */}
          <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="#4a7c59" strokeWidth="0.4" />
          {/* 中圈 */}
          <circle cx="50" cy="50" r="9" fill="none" stroke="#4a7c59" strokeWidth="0.35" />
          <circle cx="50" cy="50" r="0.4" fill="#4a7c59" />
          {/* 中线 */}
          <line x1="0" y1="50" x2="100" y2="50" stroke="#4a7c59" strokeWidth="0.35" />
          {/* 上半场禁区 */}
          <rect x="28" y="0" width="44" height="16.5" fill="none" stroke="#4a7c59" strokeWidth="0.35" />
          <rect x="36" y="0" width="28" height="5.5" fill="none" stroke="#4a7c59" strokeWidth="0.35" />
          <circle cx="50" cy="16.5" r="0.4" fill="#4a7c59" />
          {/* 下半场禁区 */}
          <rect x="28" y="83.5" width="44" height="16.5" fill="none" stroke="#4a7c59" strokeWidth="0.35" />
          <rect x="36" y="94.5" width="28" height="5.5" fill="none" stroke="#4a7c59" strokeWidth="0.35" />
          <circle cx="50" cy="83.5" r="0.4" fill="#4a7c59" />
        </svg>

        {/* 球员位置 */}
        {formation.map((slot) =>
          slot.player ? (
            <button
              key={slot.label}
              className={`squad-pitch__player ${selectedId === slot.player.id ? "squad-pitch__player--active" : ""}`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              onClick={() => setSelectedId(selectedId === slot.player!.id ? null : slot.player!.id)}
              aria-label={`${slot.player.name} — ${slot.label}`}
            >
              <span className={`squad-jersey ${isGoalkeeper(slot.player) ? "squad-jersey--gk" : ""}`}>
                {slot.player.number || "?"}
              </span>
              <span className="squad-name-tag">{slot.player.nameEn}</span>
            </button>
          ) : (
            <div
              key={slot.label}
              className="squad-pitch__empty"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              aria-label={`空缺 ${slot.label}`}
            >
              <span>{slot.label}</span>
            </div>
          )
        )}
      </div>

      {/* 选中球员的浮层信息卡 */}
      {selected && (
        <div className="squad-pitch__card" role="dialog" aria-label={selected.name}>
          <button
            className="squad-pitch__card-close"
            onClick={() => setSelectedId(null)}
            aria-label="关闭"
          >
            ✕
          </button>
          <div className="squad-card-header">
            <div className="squad-card-header__photo">
              <Image
                src="/players/default-avatar.svg"
                alt=""
                width={80}
                height={80}
                className="squad-card-header__img"
              />
            </div>
            <div className="squad-card-header__info">
              <h3>{selected.name}</h3>
              <p className="squad-card-header__meta">
                <span className="squad-badge">阿森纳</span>
                {selected.birthDate && (
                  <span>{selected.birthDate} ({calcAge(selected.birthDate)}岁)</span>
                )}
                <span>{selected.nationality}</span>
              </p>
              <span className={`squad-status squad-status--${selected.status ?? "fit"}`}>
                {statusLabel(selected.status)}
              </span>
            </div>
            <div className="squad-card-header__rating">
              <span className="squad-overall">{formatOverall(selected)}</span>
              {selectedStat?.rating != null && (
                <small>赛季评分 {selectedStat.rating.toFixed(2)}</small>
              )}
            </div>
          </div>

          {/* 能力条（简化版） */}
          <div className="squad-card-attrs">
            {isGoalkeeper(selected)
              ? renderGkBars(selected.attributes)
              : renderOutfieldBars(getOutfieldAttrs(selected)!)}
          </div>

          <Link href={`/players/${selected.id}`} className="squad-card-link">
            查看完整资料 →
          </Link>
        </div>
      )}
    </div>
  );
}

// ---- 子组件：球员表格 ----

function SquadTable({ players, realStats }: { players: SquadPlayer[]; realStats: RealStats }) {
  return (
    <div className="squad-table-wrap">
      <table className="squad-table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>位置</th>
            {SEASON_STAT_COLUMNS.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const stat = realStats[p.id];
            return (
              <tr key={p.id}>
                <td>
                  <Link href={`/players/${p.id}`} className="squad-table__name">
                    {p.name}
                  </Link>
                </td>
                <td><span className="squad-pos">{positionLabel(p.position)}</span></td>
                {SEASON_STAT_COLUMNS.map((column) => (
                  <td key={column.key} className={column.emphasis ? "stat-emph" : undefined}>
                    {stat ? statCell(column, stat) : "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- 主组件 ----

export function SquadPage({ formation, goalkeepers, defenders, midfielders, forwards, realStats }: SquadPageProps) {
  const allPlayers = [...goalkeepers, ...defenders, ...midfielders, ...forwards];

  return (
    <div className="squad-layout">
      <div className="squad-layout__pitch">
        <Pitch formation={formation} realStats={realStats} />
      </div>
      <div className="squad-layout__list">
        <SquadTable players={allPlayers} realStats={realStats} />
      </div>
    </div>
  );
}

// ---- 工具函数 ----

function calcAge(birthDate: string): number {
  const [d, m, y] = birthDate.split("/").map(Number);
  const birth = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

function statusLabel(s?: string) {
  switch (s) {
    case "injured": return "受伤";
    case "suspended": return "停赛";
    case "resting": return "休息";
    default: return "健康";
  }
}

function positionLabel(pos: string): string {
  const map: Record<string, string> = {
    GK: "GK", CB: "D (C)", RB: "D (R)", LB: "D (L)",
    DM: "DM", CM: "CM", AM: "AM",
    RW: "AM (R)", LW: "AM (L)", ST: "ST (C)", W: "W",
  };
  return map[pos] ?? pos;
}

function formatOverall(p: SquadPlayer): string {
  if (isGoalkeeper(p)) return p.attributes.overall.toFixed(1);
  return p.attributes.overall.toFixed(isInteger(p.attributes.overall) ? 0 : 2);
}

function isInteger(n: number): boolean { return n % 1 === 0; }

function renderOutfieldAttrs(a: OutfieldAttributes) {
  return [
    ["防守", a.defense], ["身体", a.physical], ["速度", a.pace],
    ["视野", a.vision], ["进攻", a.attack], ["技术", a.technique],
    ["制空", a.aerial], ["精神", a.mental],
  ] as const;
}

function renderGkAttrs(a: GoalkeeperAttributes) {
  return [
    ["扑救", a.saving], ["覆盖", a.coverage], ["反应", a.reflexes],
    ["出球", a.distribution], ["神扑", a.spectacular], ["脚下", a.feet],
    ["制空", a.aerial], ["指挥", a.command],
  ] as const;
}

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

function renderOutfieldBars(a: OutfieldAttributes) {
  return <>{renderOutfieldAttrs(a).map(([l, v]) => <AttrBar key={l} label={l} value={v} />)}</>;
}
function renderGkBars(a: GoalkeeperAttributes) {
  return <>{renderGkAttrs(a).map(([l, v]) => <AttrBar key={l} label={l} value={v} />)}</>;
}
