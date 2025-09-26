"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = { open: boolean; mode?: string; overlay?: string };
type Item = { id: string; username: string | null; elo_rating: number; country?: string | null; is_supporter?: boolean };

function makeFallback(count = 30): Item[] {
  const names = [
    "Alpha","Bravo","Charlie","Delta","Echo","Foxtrot","Golf","Hotel","India","Juliet",
    "Kilo","Lima","Mike","November","Oscar","Papa","Quebec","Romeo","Sierra","Tango",
    "Uniform","Victor","Whiskey","Xray","Yankee","Zulu",
  ];
  const arr: Item[] = [];
  let base = 2300;
  for (let i = 0; i < count; i++) {
    arr.push({ id: `mock-${i}`, username: `${names[i % names.length]}_${i+1}`, elo_rating: base, country: i%5===0?"KR":i%3===0?"US":"JP", is_supporter: i%7===0 });
    base -= Math.floor(10 + Math.random()*30);
  }
  return arr;
}

export default function AnimatedLeaderboard({ open }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, elo_rating, country, is_supporter")
          .order("elo_rating", { ascending: false })
          .limit(50);
        if (error) throw error;
        if (!cancelled) setItems((data as any as Item[]) || makeFallback());
      } catch (e) {
        if (!cancelled) { setItems(makeFallback()); setError(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const top3 = useMemo(() => items.slice(0,3), [items]);
  const rest = useMemo(() => items.slice(3), [items]);

  return (
    <div className="lb-wrap" aria-hidden={!open} style={{ maxHeight: open ? 1200 : 0, opacity: open ? 1 : 0 }}>
      <div className="lb-card">
        <header className="lb-header">
          <h3 className="lb-title"><span className="spark" aria-hidden/>Global Leaderboard</h3>
          <div className="lb-sub">Top players by ELO rating</div>
        </header>

        <section className="lb-podium" aria-label="Top 3 players">
          {top3.map((p, i) => (
            <div key={p.id} className={`podium podium-${i+1}`}>
              {i===0 && (
                <svg className="crown" viewBox="0 0 64 32" aria-hidden>
                  <path d="M2 30h60L54 10l-9 7-13-14-13 14-9-7z" fill="url(#g)" />
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#fff4c2"/>
                      <stop offset="100%" stopColor="#d4af37"/>
                    </linearGradient>
                  </defs>
                </svg>
              )}
              <div className="rank-badge">#{i+1}</div>
              <div className="name">{p.username || 'Anonymous'}</div>
              <div className="elo">{p.elo_rating}</div>
            </div>
          ))}
        </section>

        <section className="lb-list" aria-label="Top 50 list">
          <div className="lb-head-row"><span>#</span><span>Player</span><span className="t-right">ELO</span></div>
          {loading && <div className="lb-empty">Loading…</div>}
          {!loading && error && <div className="lb-empty">{error}</div>}
          {!loading && !error && rest.map((p, idx) => (
            <div key={p.id} className="lb-row" data-index={idx+4}>
              <span className="rank">{idx+4}</span>
              <span className="player">
                <span className={`dot ${p.is_supporter ? 'gold':''}`} aria-hidden/>
                {p.username || 'Anonymous'}
                {p.country && <span className="country">{p.country}</span>}
              </span>
              <span className="elo t-right">{p.elo_rating}</span>
            </div>
          ))}
        </section>
      </div>

      <style jsx>{`
        .lb-wrap { overflow:hidden; transition:max-height 400ms ease, opacity 300ms ease; }
        .lb-card { border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:16px; background:
          radial-gradient(1200px 800px at 10% -20%, rgba(32,41,64,.35), rgba(0,0,0,.2)),
          linear-gradient(180deg, rgba(15,15,18,.85), rgba(18,20,24,.85)); box-shadow:0 8px 30px rgba(0,0,0,.35); }
        .lb-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px }
        .lb-title { position:relative; font-weight:900; color:#fff; letter-spacing:.3px; font-size:20px }
        .lb-sub { color:rgba(255,255,255,.7); font-weight:700; font-size:12px }
        .spark { position:absolute; inset:-4px -8px; background:linear-gradient(90deg,transparent,rgba(255,220,120,.35),transparent); filter:blur(6px); animation:sweep 2.8s linear infinite }
        @keyframes sweep { 0%{ transform:translateX(-110%)} 100%{ transform:translateX(110%)} }

        .lb-podium { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:8px 0 14px }
        .podium { position:relative; padding:14px 12px; border-radius:14px; text-align:center; color:#fff; font-weight:900;
          background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)); border:1px solid rgba(255,255,255,.12);
          box-shadow:0 6px 20px rgba(0,0,0,.25) }
        .podium-1 { transform:translateY(-6px); background:linear-gradient(180deg, rgba(255,244,194,.10), rgba(255,255,255,.02)); border-color:rgba(212,175,55,.55) }
        .podium-2 { transform:translateY(0); background:linear-gradient(180deg, rgba(230,230,230,.08), rgba(255,255,255,.02)); border-color:rgba(200,200,200,.35) }
        .podium-3 { transform:translateY(4px); background:linear-gradient(180deg, rgba(255,180,120,.08), rgba(255,255,255,.02)); border-color:rgba(205,120,60,.35) }
        .podium::after { content:""; position:absolute; inset:-2px; border-radius:14px; pointer-events:none; box-shadow:0 0 30px rgba(255,215,140,.22) inset; opacity:.0; animation:glow 3s ease-in-out infinite }
        @keyframes glow { 0%,100%{opacity:.05} 50%{opacity:.25} }
        .rank-badge { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; margin:0 auto 6px; background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.2) }
        .name { font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
        .elo { font-size:13px; opacity:.9 }
        .crown { position:absolute; top:-18px; left:50%; transform:translateX(-50%); width:54px; filter:drop-shadow(0 4px 10px rgba(212,175,55,.45)) }

        .lb-list { border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,.08); background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)) }
        .lb-head-row { display:grid; grid-template-columns:56px 1fr 96px; padding:10px 12px; color:rgba(255,255,255,.75); font-weight:900; background:linear-gradient(180deg, rgba(0,0,0,.16), rgba(0,0,0,.08)); border-bottom:1px solid rgba(255,255,255,.08) }
        .t-right { text-align:right }
        .lb-row { display:grid; grid-template-columns:56px 1fr 96px; padding:10px 12px; align-items:center; color:#fff; border-bottom:1px solid rgba(255,255,255,.06); transition: background .15s ease, transform .12s ease }
        .lb-row:nth-child(odd){ background:rgba(0,0,0,.08) }
        .lb-row:hover { background:rgba(255,255,255,.08); transform:translateY(-1px) }
        .rank { font-weight:900; opacity:.95 }
        .player { display:flex; align-items:center; gap:8px; min-width:0; font-weight:900; letter-spacing:.2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
        .dot { width:8px; height:8px; border-radius:50%; background:#9aa4b2; box-shadow:0 0 0 2px rgba(0,0,0,.25) }
        .dot.gold { background:#d4af37 }
        .country { margin-left:8px; padding:2px 8px; font-size:11px; font-weight:800; border-radius:999px; border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.06) }
        .elo { font-weight:900 }

        @media (max-width: 860px){ .lb-podium { grid-template-columns:1fr } .podium-1,.podium-2,.podium-3 { transform:none } }
      `}</style>
    </div>
  );
}

