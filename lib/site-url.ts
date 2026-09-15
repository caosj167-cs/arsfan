/**
 * 站点绝对 URL（用于 metadataBase / canonical / og:url / sitemap / robots）。
 *
 * 取值优先级：
 *  1. `NEXT_PUBLIC_SITE_URL` —— 显式配置。本地开发（.env 里是 http://localhost:3000）
 *     与绑定自定义域名后的线上环境都走这一条。
 *  2. `RENDER_EXTERNAL_URL` —— Render 自动注入的服务 onrender.com 全量 URL
 *     （官方文档：默认环境变量在「构建期与运行期」均可用，RENDER_EXTERNAL_URL 无例外标注）。
 *     线上不手填任何变量即可自动得到正确域名，服务名被占用而带后缀时也能自愈。
 *  3. `http://localhost:3000` —— 兜底（非 Render 的裸环境）。
 *
 * 注意：只有 `NEXT_PUBLIC_*` 才会被 Next 内联进客户端包，而本模块仅被服务端文件引用
 * （app/layout.tsx 的 metadata、app/robots.ts、app/sitemap.ts），因此这里读非公开变量是安全的。
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "http://localhost:3000";
