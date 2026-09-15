/**
 * 根级加载态：路由切换 / 数据查询期间展示，避免白屏。
 * 配合各页面改为 ISR（revalidate=300）后，首屏命中缓存即不再出现此态。
 */
export default function Loading() {
  return (
    <main className="dashboard-shell">
      <div className="dashboard-notice">
        <p>正在加载数据…</p>
      </div>
    </main>
  );
}
