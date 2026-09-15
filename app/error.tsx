"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * 根级错误边界：任意路由渲染抛错（如 Neon 抖动、抓取源超时）时不再暴露原始错误页，
 * 而是给出可重试的友好提示。reset() 会重新渲染当前路由段。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="dashboard-shell">
      <div className="dashboard-notice dashboard-notice--error">
        <h1>页面加载出错</h1>
        <p>数据请求失败，多半是数据源暂时不可用。可直接重试，页面会自动从缓存恢复。</p>
        <div className="notice-actions">
          <button className="btn btn--primary" type="button" onClick={reset}>
            重试
          </button>
          <Link className="btn btn--ghost" href="/">
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
