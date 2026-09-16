/**
 * 站点统一的日期/时间格式化 —— **必须固定时区**，不要在组件里直接 new Intl.DateTimeFormat。
 *
 * ## 为什么必须固定时区
 * 这些格式化会在两处各执行一次：服务端渲染（Render 跑在 UTC）与浏览器水合
 * （读者多在 Asia/Shanghai）。`Intl.DateTimeFormat` 默认使用**运行时本地时区**，
 * 同一个时间戳两边算出的文本会差 8 小时，React 因此判定水合失败并整棵树重渲染：
 *   · 线上表现：`Minified React error #418`（args[]=text）
 *   · dev 表现：`Hydration failed because the server rendered text didn't match the client`
 *     并直接打出差异，例如 `+ 2026/9/16 12:17`（客户端）/ `- 2026/9/16 04:17`（服务端）
 *
 * ⚠️ 这个 bug **在本地开发时永远复现不了** —— 因为本机 Node 与浏览器同在东八区。
 * 想本地复现必须让服务端也处于 UTC：`TZ=UTC npx next dev`。
 *
 * 站点是中文站、读者以中国为主，所以统一按北京时间显示（与国内体育站的惯例一致）。
 */
const LOCALE = "zh-CN";
const TIME_ZONE = "Asia/Shanghai";

/** Intl.DateTimeFormat 构造开销较大，按选项缓存复用（原先每处每次调用都在新建实例）。 */
const cache = new Map<string, Intl.DateTimeFormat>();

export function formatBeijing(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions,
): string {
  const key = JSON.stringify(options);
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: TIME_ZONE });
    cache.set(key, fmt);
  }
  return fmt.format(typeof value === "object" ? value : new Date(value));
}
