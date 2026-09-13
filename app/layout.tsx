import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "阿森纳球迷数据中心",
  description: "阿森纳赛程、比赛结果、积分榜与俱乐部新闻。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <head>
        {/* Inter —— 设计稿指定的唯一拉丁字族；中文由 CSS 里的 Noto Sans SC / 系统字体兜底。
            使用 <link> 而非 next/font，避免构建期必须联网；加载失败时优雅降级到兜底字体。
            该链接写在 App Router 的根 layout 里，对所有路由生效。 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
