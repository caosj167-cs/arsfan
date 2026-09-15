import Link from "next/link";

/** 根级 404：访问不存在的球员 / 比赛 / 路径时展示。 */
export default function NotFound() {
  return (
    <main className="dashboard-shell">
      <div className="dashboard-notice">
        <h1>页面未找到</h1>
        <p>你访问的内容不存在或已移动。</p>
        <div className="notice-actions">
          <Link className="btn btn--primary" href="/">
            返回首页
          </Link>
          <Link className="btn btn--ghost" href="/team-data">
            查看赛程
          </Link>
        </div>
      </div>
    </main>
  );
}
