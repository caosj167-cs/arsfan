/**
 * 外部图片：哪些域名交给 next/image 优化，哪些直出。
 *
 * 背景：新闻图和队徽都来自第三方源，域名不可控
 *   - 官网新闻快照 → assets.arsenal.com / afc-prd.graph.arsenal.com
 *   - Guardian 新闻   → i.guim.co.uk / static.guim.co.uk
 *   - football-data   → crests.football-data.org
 *   - AI 抓取兜底     → 任意域名（可能带防盗链）
 *
 * 为什么不全放开（remotePatterns: "**"）：
 *   next/image 优化是**服务端回源**，遇到防盗链或有签名时效的图会 500，
 *   而浏览器直连是正常的。所以：白名单内的走优化（省带宽、更小体积），
 *   白名单外的退回 `<Image unoptimized>` —— 依旧拿到 lazy / 尺寸占位 / 防 CLS，
 *   但不会因为回源失败把整页搞崩。
 *
 * ⚠️ 这个数组是 next.config.ts 里 remotePatterns 的唯一来源，改这里就够了。
 */
export const OPTIMIZABLE_IMAGE_HOSTS = [
  "assets.arsenal.com",
  "afc-prd.graph.arsenal.com",
  "www.arsenal.com",
  "i.guim.co.uk",
  "static.guim.co.uk",
  "crests.football-data.org",
] as const;

const OPTIMIZABLE = new Set<string>(OPTIMIZABLE_IMAGE_HOSTS);

/**
 * 该图片是否可以让 next/image 走优化管线。
 * 相对路径（本站 public/ 下的图）一律可优化。
 */
export function canOptimizeImage(src: string | null | undefined): boolean {
  if (!src) return false;
  if (src.startsWith("/")) return true;
  try {
    return OPTIMIZABLE.has(new URL(src).host);
  } catch {
    return false;
  }
}
