// 赛程合并的「纯逻辑」层：状态判定（P1-④）与破坏性删除守卫（P1-③）。
//
// 抽成无 prisma / 无 IO 依赖的纯函数，方便单元测试，且不影响
// syncFixtureEntries 的编排行为（编排层只是调用这里的函数，逻辑完全一致）。

export type FixtureSourceLabel = "football-data.org" | "arsenal.com" | "wikipedia";

/** 终场 / 进行中的状态：未开赛的场次不允许出现这些状态 */
export const SETTLED_STATUSES = new Set(["FINISHED", "AWARDED", "IN_PLAY", "PAUSED"]);

/**
 * 推导单场 FixtureEntry 的 status。
 *
 * 规则（与 syncFixtureEntries 原内联逻辑一致）：
 * - 已完赛 finished = fd 报 FINISHED/AWARDED，或任一来源报 FINISHED/AWARDED，
 *   或「有同日比分且 fd 未处于实时进行态（IN_PLAY/PAUSED）」。
 * - 已开赛：finished → FINISHED；否则取 fd 的 SETTLED 状态，再否则 fd 原值，再否则 SCHEDULED。
 * - 未开赛：fd 非 SETTLED 状态原样透传，否则 SCHEDULED。
 *
 * 关键：不能把「有比分」直接等同 FINISHED——进行中的比赛 fd 带实时部分比分，要保留 IN_PLAY/PAUSED。
 */
export function deriveFixtureEntryStatus(args: {
  fdStatus: string | null | undefined;
  sourceStatuses: string[];
  started: boolean;
  hasSameDayScore: boolean;
}): string {
  const { fdStatus, sourceStatuses, started, hasSameDayScore } = args;
  const finished =
    fdStatus === "FINISHED" ||
    fdStatus === "AWARDED" ||
    sourceStatuses.some((s) => s === "FINISHED" || s === "AWARDED") ||
    (hasSameDayScore && !(fdStatus && SETTLED_STATUSES.has(fdStatus)));

  if (started) {
    return finished
      ? "FINISHED"
      : fdStatus && SETTLED_STATUSES.has(fdStatus)
        ? fdStatus
        : fdStatus ?? "SCHEDULED";
  }
  return fdStatus && !SETTLED_STATUSES.has(fdStatus) ? fdStatus : "SCHEDULED";
}

/**
 * 破坏性删除守卫（P1-③）：返回本趟同步应当删除的 FixtureEntry id 列表。
 *
 * @param keepIds     本趟重新生成的行 id（upsert 后）
 * @param failedSources 本趟抓取失败的主源（为空 = 三源全成功）
 * @param existingRows 库里该 season 的全部行（id + primarySource）
 *
 * - 全部来源成功（failedSources 为空）：删所有孤儿（不在 keepIds 里的行）。
 * - 有来源失败：只删「primarySource 不属于失败源」的孤儿，
 *   避免某抓取源挂掉时误删它独有的欧战/杯赛行（已发生过的 bug）。
 */
export function planFixtureEntryDeletion(args: {
  keepIds: string[];
  failedSources: FixtureSourceLabel[];
  existingRows: { id: string; primarySource: FixtureSourceLabel }[];
}): string[] {
  const keep = new Set(args.keepIds);
  const failed = new Set(args.failedSources);
  const orphans = args.existingRows.filter((row) => !keep.has(row.id));
  if (failed.size === 0) {
    return orphans.map((row) => row.id);
  }
  return orphans
    .filter((row) => !failed.has(row.primarySource))
    .map((row) => row.id);
}
