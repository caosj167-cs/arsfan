import { NextResponse } from "next/server";

/**
 * 统一 API 响应契约（对应 ars.md §11）。
 *
 * 所有读类 / 写类接口都通过 apiJson / apiError 返回同一个信封结构，
 * 避免各路由手写 { data, meta, error } 时出现字段不一致。
 */

export type ApiError = {
  code: string;
  message: string;
};

export type ApiMeta = {
  /** 数据来源，如 football-data.org / arsenal.com / The Guardian */
  source?: string;
  /** 真实库时间戳（最近一次成功同步），缺失时为 null，不得用 new Date() 伪造 */
  lastUpdatedAt?: string | null;
  /** 命中缓存时为 true */
  cached?: boolean;
  /** 返回的是降级/过期数据时为 true */
  stale?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  pages?: number;
  [key: string]: unknown;
};

export type ApiResponse<T> = {
  data: T;
  meta: ApiMeta;
  error: ApiError | null;
};

export const ApiErrorCode = {
  INVALID_QUERY: "INVALID_QUERY",
  INVALID_BODY: "INVALID_BODY",
  INVALID_SCORE: "INVALID_SCORE",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_SCOPE: "INVALID_SCOPE",
  FIXTURE_NOT_FOUND: "FIXTURE_NOT_FOUND",
  FIXTURE_READ_ERROR: "FIXTURE_READ_ERROR",
  STANDINGS_READ_ERROR: "STANDINGS_READ_ERROR",
  OFFICIAL_NEWS_READ_ERROR: "OFFICIAL_NEWS_READ_ERROR",
  OFFICIAL_FIXTURE_READ_ERROR: "OFFICIAL_FIXTURE_READ_ERROR",
  OFFICIAL_PLAYER_READ_ERROR: "OFFICIAL_PLAYER_READ_ERROR",
  NEWS_PROVIDER_ERROR: "NEWS_PROVIDER_ERROR",
  STALE_DATA: "STALE_DATA",
  READ_FAILED: "READ_FAILED",
  SYNC_FAILED: "SYNC_FAILED",
  DETAILS_UNAVAILABLE: "DETAILS_UNAVAILABLE",
  PLAYER_NOT_FOUND: "PLAYER_NOT_FOUND",
  NEWS_NOT_FOUND: "NEWS_NOT_FOUND",
  SEASON_NOT_FOUND: "SEASON_NOT_FOUND",
  ANALYSIS_UNAVAILABLE: "ANALYSIS_UNAVAILABLE",
} as const;

export type ApiErrorCodeValue = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export function apiJson<T>(
  data: T,
  meta: ApiMeta = {},
  error: ApiError | null = null,
  status = 200,
): NextResponse {
  return NextResponse.json({ data, meta, error } satisfies ApiResponse<T>, { status });
}

export function apiError(
  code: ApiErrorCodeValue | string,
  message: string,
  status: number,
  meta: ApiMeta = {},
): NextResponse {
  return apiJson(null, meta, { code, message }, status);
}
