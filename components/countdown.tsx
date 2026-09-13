"use client";

import { useEffect, useState } from "react";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  return {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
    s: Math.floor((ms % 60_000) / 1_000),
  };
}

const LABELS: [keyof ReturnType<typeof diff>, string][] = [
  ["d", "天"],
  ["h", "时"],
  ["m", "分"],
  ["s", "秒"],
];

/**
 * 距离开球倒计时（设计稿：4 格 78×84，数字 26 ExtraBold + 单位 12 Medium）。
 * 首屏渲染固定输出 00，挂载后再对齐真实时间 —— 避免服务端/客户端时间差导致 hydration 报错。
 */
export function Countdown({ target }: { target: string }) {
  const t = new Date(target).getTime();
  const [v, setV] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => setV(diff(t));
    const interval = setInterval(tick, 1000);
    // 延后到下一个宏任务再对齐时间，避免在 effect 内同步 setState 触发级联渲染
    const boot = setTimeout(tick, 0);
    return () => {
      clearInterval(interval);
      clearTimeout(boot);
    };
  }, [t]);

  return (
    <div className="countdown">
      {LABELS.map(([key, label]) => (
        <div className="countdown__cell" key={key}>
          <b>{String(v[key]).padStart(2, "0")}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
