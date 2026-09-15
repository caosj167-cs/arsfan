"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type PlayerHit = {
  id: string;
  name: string;
  nameEn: string;
  number: number;
  position: string;
  href: string;
};

type FixtureHit = {
  id: string;
  opponentName: string;
  competition: string;
  competitionCode: string | null;
  homeAway: "HOME" | "AWAY";
  status: string;
  kickoffAt: string;
  homeScore: number | null;
  awayScore: number | null;
  href: string;
};

type SearchResult = { players: PlayerHit[]; fixtures: FixtureHit[] };

function fmt(ts: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "未开赛",
  TIMED: "未开赛",
  IN_PLAY: "进行中",
  PAUSED: "中场",
  FINISHED: "已结束",
  AWARDED: "已结束",
  POSTPONED: "延期",
};

export function SiteSearch() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResult>({ players: [], fixtures: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length === 0) return; // 面板在 q 为空时不渲染，无需重置 state
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) setData((await res.json()) as SearchResult);
      } catch {
        /* aborted or network error — keep previous */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // 点击组件外部关闭
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const flat = [...data.players, ...data.fixtures];
  const hasResults = flat.length > 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const hit = flat[active];
      if (hit) {
        window.location.href = hit.href;
      }
    }
  };

  return (
    <div className="site-search" ref={boxRef}>
      <div className="site-search__field">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 21 21" />
        </svg>
        <input
          type="search"
          className="site-search__input"
          placeholder="搜索球员 / 对手 / 赛事"
          aria-label="搜索"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && q.trim().length > 0 && (
        <div className="site-search__panel" role="listbox">
          {!hasResults && <p className="site-search__empty">没有匹配「{q.trim()}」的结果</p>}

          {data.players.length > 0 && (
            <div className="site-search__group">
              <span className="site-search__label">球员</span>
              <ul>
                {data.players.map((p, i) => (
                  <li key={p.id} role="option" aria-selected={active === i}>
                    <Link
                      href={p.href}
                      className="site-search__item"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => setOpen(false)}
                    >
                      <span className="site-search__num">#{p.number}</span>
                      <span className="site-search__name">{p.name}</span>
                      <span className="site-search__sub">{p.nameEn} · {p.position}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.fixtures.length > 0 && (
            <div className="site-search__group">
              <span className="site-search__label">比赛</span>
              <ul>
                {data.fixtures.map((f, i) => {
                  const idx = data.players.length + i;
                  return (
                    <li key={f.id} role="option" aria-selected={active === idx}>
                      <Link
                        href={f.href}
                        className="site-search__item"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => setOpen(false)}
                      >
                        <span className="site-search__name">
                          vs {f.opponentName}
                          <em className="site-search__homeside">{f.homeAway === "HOME" ? "主" : "客"}</em>
                        </span>
                        <span className="site-search__sub">
                          {f.competition} · {STATUS_LABEL[f.status] ?? f.status}
                          {f.status === "FINISHED"
                            ? ` ${f.homeScore ?? "-"}:${f.awayScore ?? "-"}`
                            : ` · ${fmt(f.kickoffAt)}`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
