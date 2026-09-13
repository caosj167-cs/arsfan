/**
 * 赛季标签：2024 → "2024/25"。
 * 纯函数、无依赖，可被客户端组件（"use client"）安全引用——
 * 不要从 lib/queries/* 引入（那里会连带 import Prisma，污染浏览器包）。
 */
export function seasonLabel(season: number) {
  return `${season}/${String((season + 1) % 100).padStart(2, "0")}`;
}

/** 当前赛季起始年（可用 SEASON_START_YEAR 覆盖）；纯读环境变量，无副作用。 */
export function seasonStartYear(fallback = 2026) {
  const fromEnv = Number.parseInt(process.env.SEASON_START_YEAR ?? "", 10);
  return Number.isInteger(fromEnv) ? fromEnv : fallback;
}
