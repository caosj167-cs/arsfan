"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { formatBeijing } from "@/lib/datetime";

type Notif = {
  id: string;
  kind: "upcoming" | "result";
  title: string;
  body: string;
  time: string;
  href: string;
};

type NotifPayload = { upcoming: Notif[]; recent: Notif[]; unread: number };

function fmt(ts: string) {
  return formatBeijing(ts, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function SiteNotifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const d = (await res.json()) as NotifPayload;
        setItems([...d.upcoming, ...d.recent]);
        setUnread(d.unread ?? 0);
      }
    } catch {
      /* keep empty */
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="site-notif" ref={ref}>
      <button
        type="button"
        className="header-ops__icon"
        aria-label="通知"
        aria-expanded={open}
        title="通知"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            setUnread(0);
            if (!loaded) load();
          }
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 16V10a6 6 0 0 1 12 0v6l1.5 2H4.5z" />
          <path d="M10 20.5a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && <span className="site-notif__badge">{unread}</span>}
      </button>

      {open && (
        <div className="site-notif__panel" role="menu">
          <div className="site-notif__head">通知</div>
          {items.length === 0 ? (
            <p className="site-notif__empty">暂无赛程通知</p>
          ) : (
            <ul className="site-notif__list">
              {items.map((it) => (
                <li key={it.id}>
                  <Link href={it.href} className="site-notif__item" onClick={() => setOpen(false)}>
                    <span className={`site-notif__tag site-notif__tag--${it.kind}`}>
                      {it.kind === "upcoming" ? "赛前" : "战报"}
                    </span>
                    <span className="site-notif__title">{it.title}</span>
                    <span className="site-notif__meta">
                      {it.body} · {fmt(it.time)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
