"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient"; // 별칭 미사용이면 ../../lib/supabaseClient 로 바꿔주세요.

type RegionMode = "global" | "country";
export interface Profile {
  id: string;
  username: string | null;
  elo_rating: number;
  is_supporter: boolean;
  nickname_color?: string | null;
  badge_color?: string | null;
  country?: string | null;
}

interface InlineLeaderboardPanelProps {
  /** 외부에서 열림 상태를 제어 (기존 Show leaderboard 버튼과 연동) */
  open: boolean;

  /** 버튼(앵커) 요소의 ref (버튼 너비 추적 및 애니메이션 원점) */
  anchorRef?: React.RefObject<HTMLElement | null>;

  /** true면 패널 너비를 버튼 너비와 일치시킵니다. 기본 false */
  matchAnchorWidth?: boolean;

  /** 패널 최대 너비 (matchAnchorWidth=false일 때 사용) */
  maxWidth?: number;

  /** 편의 파라미터들 */
  currentUserId?: string;
  currentCountry?: string;
  liveUserIds?: string[];
  avatarUrls?: Record<string, string>;

  /** 콜백 */
  onRequestSpectate?: (p: Profile) => void;
  onRequestProfile?: (p: Profile) => void;

  /** ESC 등으로 닫기 요청 */
  onRequestClose?: () => void;
}

/* ====================== Utils ====================== */
const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

function flagEmoji(code?: string) {
  if (!code) return "";
  const cc = code.toUpperCase().slice(0, 2);
  const A = 0x1f1e6;
  const cp1 = A + (cc.charCodeAt(0) - 65);
  const cp2 = A + (cc.charCodeAt(1) - 65);
  if (isNaN(cp1) || isNaN(cp2)) return "";
  return String.fromCodePoint(cp1) + String.fromCodePoint(cp2);
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!isBrowser) return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/* ====================== Component ====================== */
export default function InlineLeaderboardPanel({
  open,
  anchorRef,
  matchAnchorWidth = false,
  maxWidth = 1120,
  currentUserId,
  currentCountry,
  liveUserIds,
  avatarUrls,
  onRequestSpectate,
  onRequestProfile,
  onRequestClose,
}: InlineLeaderboardPanelProps) {
  /** refs */
  const hostRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /** layout state */
  const [contentH, setContentH] = useState(0);
  const [anchorW, setAnchorW] = useState<number | null>(null);
  const [originX, setOriginX] = useState<number | null>(null);
  const [originY, setOriginY] = useState<number | null>(null);

  const prefersReduced = usePrefersReducedMotion();

  /** data + ui states */
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const [orderAsc, setOrderAsc] = useState(false);
  const [supportersOnly, setSupportersOnly] = useState(false);
  const [regionMode, setRegionMode] = useState<RegionMode>("global");
  const [myCountry, setMyCountry] = useState<string>("GLOBAL");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** ========== Measure content height for animation ========== */
  const recalcHeight = useCallback(() => {
    if (!cardRef.current) return;
    setContentH(cardRef.current.scrollHeight);
  }, []);
  useLayoutEffect(() => {
    recalcHeight();
  }, [open, recalcHeight]);
  useEffect(() => {
    if (!isBrowser || !open) return;
    const ro = new ResizeObserver(() => recalcHeight());
    if (cardRef.current) ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [open, recalcHeight]);

  /** ========== Anchor width/origin match ========== */
  const applyAnchorMetrics = useCallback(() => {
    const btn = anchorRef?.current;
    const host = hostRef.current;
    if (!isBrowser || !btn || !host) return;
    const btnRect = btn.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    // 패널 transform-origin 및 clip-path의 기준점 계산(버튼의 상단 중앙)
    const ox = btnRect.left + btnRect.width / 2 - hostRect.left;
    const oy = btnRect.bottom - hostRect.top;
    setOriginX(ox);
    setOriginY(oy);
    setAnchorW(btnRect.width);
  }, [anchorRef]);

  useEffect(() => {
    if (!isBrowser) return;
    applyAnchorMetrics();
    window.addEventListener("resize", applyAnchorMetrics);
    window.addEventListener("scroll", applyAnchorMetrics, { passive: true });
    return () => {
      window.removeEventListener("resize", applyAnchorMetrics);
      window.removeEventListener("scroll", applyAnchorMetrics as any);
    };
  }, [applyAnchorMetrics]);

  /** ========== ESC to close ========== */
  useEffect(() => {
    if (!open || !onRequestClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onRequestClose?.();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onRequestClose]);

  /** ========== Country & user defaults ========== */
  useEffect(() => {
    (async () => {
      if (currentCountry) {
        setMyCountry(currentCountry.toUpperCase());
        return;
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const uid = currentUserId || user?.id;
        if (uid) {
          const { data } = await supabase
            .from("profiles")
            .select("country")
            .eq("id", uid)
            .single();
          if (data?.country) {
            setMyCountry(String(data.country).toUpperCase());
            return;
          }
        }
      } catch {}
      try {
        const loc =
          (navigator as any)?.language ||
          (Intl as any)?.DateTimeFormat?.().resolvedOptions?.().locale ||
          "en-US";
        const m = String(loc).match(/[-_]([A-Z]{2})$/i);
        if (m && m[1]) setMyCountry(m[1].toUpperCase());
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ========== Fetch Top 50 profiles ========== */
  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, elo_rating, is_supporter, nickname_color, badge_color, country"
        )
        .neq("elo_rating", 1200)
        .order("elo_rating", { ascending: false })
        .limit(50);
      if (error) {
        setErrorMsg("Failed to load leaderboard.");
        return;
      }
      const rows = (data || []) as Profile[];
      setProfiles(rows);

      const setC = new Set<string>();
      for (const p of rows) {
        const c = (p.country || "").toString().trim().toUpperCase();
        if (c) setC.add(c);
      }
      setCountries([
        "GLOBAL",
        ...Array.from(setC.values())
          .sort()
          .filter((c) => c !== "GLOBAL"),
      ]);

      try {
        const fmt = new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
        setUpdatedAt(fmt.format(new Date()));
      } catch {
        setUpdatedAt(new Date().toLocaleString());
      }
    } catch {
      setErrorMsg("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  /** ========== Auto refresh ========== */
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchProfiles, 12000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchProfiles]);

  /** ========== Derived list & helpers ========== */
  const filteredSorted = useMemo(() => {
    const base = supportersOnly
      ? profiles.filter((p) => p.is_supporter)
      : profiles;
    const regionFiltered =
      regionMode === "country" && myCountry && myCountry !== "GLOBAL"
        ? base.filter(
            (p) => (p.country || "").toUpperCase() === myCountry.toUpperCase()
          )
        : base;
    const q = search.trim().toLowerCase();
    const nameFiltered = q
      ? regionFiltered.filter((p) =>
          (p.username || "anonymous").toLowerCase().includes(q)
        )
      : regionFiltered;
    const sorted = [...nameFiltered].sort((a, b) =>
      orderAsc ? a.elo_rating - b.elo_rating : b.elo_rating - a.elo_rating
    );
    return sorted.slice(0, 50);
  }, [profiles, supportersOnly, regionMode, myCountry, search, orderAsc]);

  const cycleCountry = (dir: -1 | 1) => {
    if (!countries.length) return;
    const idx = Math.max(0, countries.findIndex((c) => c === myCountry));
    const next =
      idx < 0
        ? 0
        : (idx + (dir === 1 ? 1 : countries.length - 1)) % countries.length;
    setMyCountry(countries[next]);
  };

  const exportCsv = () => {
    try {
      const rows = ["rank,username,elo,country,supporter"];
      filteredSorted.forEach((p, i) =>
        rows.push(
          `${i + 1},"${(p.username || "Anonymous").replace(/"/g, '""')}",${
            p.elo_rating
          },${p.country || ""},${p.is_supporter ? "1" : "0"}`
        )
      );
      const blob = new Blob([rows.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "leaderboard_top50.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
  };

  const scrollToIndex = (index: number) => {
    if (!listRef.current) return;
    const row =
      listRef.current.querySelector<HTMLElement>(`[data-row-index="${index}"]`);
    if (!row) return;
    const parent = listRef.current;
    parent.scrollTo({
      top: Math.max(0, row.offsetTop - row.clientHeight),
      behavior: prefersReduced ? "auto" : "smooth",
    });
  };

  const myRankIndex = useMemo(() => {
    if (!currentUserId) return -1;
    return filteredSorted.findIndex((p) => p.id === currentUserId);
  }, [filteredSorted, currentUserId]);

  const spectateRandom = () => {
    const pool =
      liveUserIds && liveUserIds.length > 0
        ? filteredSorted.filter((p) => liveUserIds.includes(p.id))
        : filteredSorted;
    if (pool.length === 0) return;
    const target = pool[Math.floor(Math.random() * pool.length)];
    onRequestSpectate?.(target);
  };

  /** ========== Render ========== */
  return (
    <div
      ref={hostRef}
      className="lb-host"
      style={{
        // 버튼 폭에 맞출지 여부
        ["--panel-w" as any]:
          matchAnchorWidth && anchorW
            ? `${Math.min(anchorW, maxWidth)}px`
            : "min(1120px, 100%)",

        // 애니메이션 원점(버튼 중앙 아래) 좌표
        ["--origin-x" as any]: originX != null ? `${originX}px` : "50%",
        ["--origin-y" as any]: originY != null ? `${originY}px` : "0px",
      }}
      aria-live="polite"
    >
      <div
        ref={cardRef}
        className="lb-card"
        data-open={open}
        style={{
          maxHeight: open ? contentH : 0,
          opacity: open ? 1 : 0,
          transformOrigin: "var(--origin-x) var(--origin-y)",
          transform: open
            ? "translateY(0) scaleY(1)"
            : "translateY(-10px) scaleY(0.92)",
          clipPath: open
            ? "inset(0 0 0 0 round 14px)"
            : "inset(0 0 calc(100% - 6px) 0 round 14px)",
          transition: prefersReduced
            ? "max-height .01s linear, opacity .1s linear"
            : "max-height 420ms cubic-bezier(0.19,1,0.22,1), transform 420ms cubic-bezier(0.16,1,0.3,1), clip-path 420ms cubic-bezier(0.16,1,0.3,1), opacity 210ms ease",
        }}
        role="region"
        aria-label="Leaderboard panel"
      >
        {/* Header */}
        <div className="lb-head">
          <div className="title">
            <div className="stone black" aria-hidden />
            <div className="stone white" aria-hidden />
            <h3>Leaderboard</h3>
          </div>
          <div className="updated">{updatedAt ? `Updated: ${updatedAt}` : ""}</div>
        </div>

        {/* Controls */}
        <div className="lb-controls">
          <div className="search">
            <input
              type="search"
              placeholder="Search players…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search players"
            />
          </div>

          <div className="chips">
            <button
              className="chip"
              data-active={regionMode === "country"}
              onClick={() =>
                setRegionMode((m) => (m === "global" ? "country" : "global"))
              }
              title="Toggle region filter"
            >
              {regionMode === "global" ? "Region: Global" : `Region: ${myCountry}`}
            </button>
            {regionMode === "country" && (
              <>
                <button
                  className="chip small"
                  onClick={() => cycleCountry(-1)}
                  aria-label="Previous country"
                >
                  ◀
                </button>
                <button
                  className="chip small"
                  onClick={() => cycleCountry(1)}
                  aria-label="Next country"
                >
                  ▶
                </button>
              </>
            )}
            <button
              className="chip"
              data-active={supportersOnly}
              onClick={() => setSupportersOnly((v) => !v)}
            >
              Supporters: {supportersOnly ? "ON" : "OFF"}
            </button>
            <button className="chip" onClick={() => setOrderAsc((v) => !v)}>
              Sort: {orderAsc ? "ASC" : "DESC"}
            </button>
            <button
              className="chip"
              data-active={autoRefresh}
              onClick={() => setAutoRefresh((v) => !v)}
            >
              Auto: {autoRefresh ? "ON" : "OFF"}
            </button>
            <button className="chip" onClick={fetchProfiles}>
              Refresh
            </button>
            <button className="chip" onClick={exportCsv}>
              Export CSV
            </button>
            <button className="chip" onClick={spectateRandom}>
              Spectate Random
            </button>
            <button
              className="chip"
              onClick={() => {
                if (myRankIndex >= 0) scrollToIndex(myRankIndex);
              }}
            >
              ☆ My Rank
            </button>
            <button className="chip" onClick={() => scrollToIndex(0)}>
              ▲ Top
            </button>
            <button className="chip" onClick={() => scrollToIndex(49)}>
              ▼ 50th
            </button>
          </div>
        </div>

        {/* Table header */}
        <div className="lb-table-head" role="row">
          <div className="col-rank" role="columnheader">
            #
          </div>
          <div className="col-player" role="columnheader">
            Player
          </div>
          <div className="col-elo" role="columnheader">
            ELO
          </div>
        </div>

        {/* List (7행 고정 높이, 내부 스크롤만) */}
        <div
          className="lb-list"
          ref={listRef}
          role="rowgroup"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {loading && (
            <div className="loading">
              <span className="spinner" aria-hidden /> Loading…
            </div>
          )}
          {!loading && errorMsg && <div className="error">{errorMsg}</div>}
          {!loading && !errorMsg && filteredSorted.length === 0 && (
            <div className="empty">No players found.</div>
          )}

          {!loading &&
            !errorMsg &&
            filteredSorted.map((p, i) => {
              const rank = i + 1;
              const medal = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : null;
              const isMe = currentUserId && p.id === currentUserId;
              const live = liveUserIds?.includes(p.id);

              return (
                <div
                  key={p.id}
                  className="row"
                  data-row-index={i}
                  data-me={isMe || undefined}
                  role="row"
                >
                  <div className="col-rank" role="cell">
                    <div className={`rank ${medal ?? ""}`}>{medal ? "" : rank}</div>
                  </div>

                  <div className="col-player" role="cell">
                    <div className="player-line">
                      <div className="avatar" aria-hidden>
                        <span className="avatar-fb">
                          {(p.username || "A").slice(0, 1).toUpperCase()}
                        </span>
                        {avatarUrls?.[p.id] && (
                          <Image
                            src={avatarUrls[p.id]}
                            alt=""
                            fill
                            sizes="40px"
                            className="avatar-img"
                          />
                        )}
                      </div>
                      <div className="names">
                        <div
                          className="name"
                          style={{ color: p.nickname_color || "#fff" }}
                          title={p.username || "Anonymous"}
                        >
                          {p.username || "Anonymous"}
                          {p.is_supporter && (
                            <span
                              className="support-dot"
                              style={{ background: p.badge_color || "#d4af37" }}
                              title="Supporter"
                            />
                          )}
                        </div>
                        <div className="meta">
                          {p.country && (
                            <span className="flag-chip">{flagEmoji(p.country)}</span>
                          )}
                          {live && <span className="live-chip">● LIVE</span>}
                        </div>
                      </div>
                    </div>
                    <div className="row-actions">
                      <button className="tiny" onClick={() => onRequestProfile?.(p)}>
                        Profile
                      </button>
                      <button className="tiny" onClick={() => onRequestSpectate?.(p)}>
                        Watch
                      </button>
                    </div>
                  </div>

                  <div className="col-elo" role="cell">
                    <span className="elo">{p.elo_rating}</span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <style jsx>{`
        .lb-host {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          position: relative;
          --panel-w: min(1120px, 100%);
          --row-h: clamp(58px, 7.5vh, 88px);
          --wood-1: #f1d6a3;
          --wood-2: #d8ba84;
          --ink: #12110f;
          --stone-black: #181818;
          --gold: #d4af37;
        }
        .lb-card {
          width: var(--panel-w);
          margin-top: 10px;
          overflow: hidden;
          border-radius: 14px;
          background: linear-gradient(180deg, var(--wood-2), #2f302b);
          box-shadow: 0 18px 70px rgba(0, 0, 0, 0.45),
            inset 0 0 0 1px rgba(0, 0, 0, 0.18);
          border: 1px solid rgba(0, 0, 0, 0.28);
          will-change: max-height, transform, clip-path, opacity;
        }
        .lb-head {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px 16px 10px 16px;
          background: linear-gradient(180deg, var(--wood-1), var(--wood-2));
          border-bottom: 1px solid rgba(0, 0, 0, 0.18);
        }
        .title {
          display: inline-grid;
          grid-auto-flow: column;
          align-items: center;
          gap: 10px;
        }
        .title h3 {
          margin: 0;
          font-size: 20px;
          color: var(--ink);
          font-weight: 900;
          letter-spacing: 0.2px;
        }
        .updated {
          color: rgba(0, 0, 0, 0.6);
          font-weight: 800;
          font-size: 13px;
        }
        .stone {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.28),
            inset 0 -2px 6px rgba(0, 0, 0, 0.35), 0 1px 0 rgba(255, 255, 255, 0.35);
        }
        .stone.black {
          background: radial-gradient(circle at 30% 30%, #3d3d3d, var(--stone-black));
        }
        .stone.white {
          background: radial-gradient(circle at 30% 30%, #fff, #dcdcdc);
        }
        .lb-controls {
          display: grid;
          grid-template-columns: minmax(220px, 360px) 1fr;
          gap: 10px 12px;
          align-items: center;
          padding: 10px 16px 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.1));
        }
        .search input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.25);
          background: rgba(255, 255, 255, 0.86);
          color: #222;
          outline: none;
          font-weight: 700;
        }
        .search input::placeholder {
          color: #6b6b6b;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }
        .chip {
          border: 1px solid rgba(0, 0, 0, 0.25);
          background: linear-gradient(180deg, #fff, #e9e0cf);
          color: #1d1a14;
          padding: 8px 11px;
          border-radius: 10px;
          font-weight: 900;
          font-size: 12.5px;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.2s ease,
            border-color 0.2s ease, background 0.2s ease;
        }
        .chip:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
        }
        .chip[data-active="true"] {
          border-color: var(--gold);
          box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.35) inset;
        }
        .chip.small {
          padding: 8px 10px;
          min-width: 44px;
          text-align: center;
        }
        .lb-table-head {
          display: grid;
          grid-template-columns: 70px 1fr 120px;
          align-items: center;
          height: 38px;
          padding: 0 12px;
          color: rgba(255, 255, 255, 0.75);
          font-weight: 900;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.14), rgba(0, 0, 0, 0.06));
          border-top: 1px solid rgba(0, 0, 0, 0.28);
          border-bottom: 1px solid rgba(0, 0, 0, 0.18);
        }
        .col-elo {
          text-align: right;
          padding-right: 6px;
        }
        .lb-list {
          height: calc(var(--row-h) * 7 + 2px);
          overflow: auto;
          overscroll-behavior: contain;  /* 내부 스크롤만, 바깥으로 전파 방지 */
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;           /* 모바일 세로 스크롤 */
          scroll-behavior: smooth;
          background: linear-gradient(180deg, #2f302b, #23241f);
        }
        .lb-list::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .lb-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.28);
          border-radius: 999px;
        }
        .lb-list::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
        }
        .loading,
        .empty,
        .error {
          padding: 16px;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 800;
        }
        .error {
          color: #ffb0b0;
        }
        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          margin-right: 8px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .row {
          display: grid;
          grid-template-columns: 70px 1fr 120px;
          align-items: center;
          min-height: var(--row-h);
          padding: 6px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: transparent;
        }
        .row:nth-child(odd) {
          background: rgba(0, 0, 0, 0.14);
        }
        .row[data-me="true"] {
          outline: 2px solid rgba(212, 175, 55, 0.55);
          outline-offset: -2px;
          background: linear-gradient(180deg, rgba(212, 175, 55, 0.1), transparent);
        }
        .rank {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.26);
          background: rgba(255, 255, 255, 0.08);
          font-weight: 900;
          color: #fff;
        }
        .rank.gold {
          background: linear-gradient(180deg, #fff6d1, #dfc36f);
          border-color: #c9a84f;
        }
        .rank.silver {
          background: linear-gradient(180deg, #f3f3f3, #cfcfcf);
          border-color: #b1b1b1;
          color: #222;
        }
        .rank.bronze {
          background: linear-gradient(180deg, #f7ddb9, #cd9153);
          border-color: #b0713d;
        }
        .player-line {
          display: grid;
          grid-template-columns: 44px 1fr;
          align-items: center;
          gap: 10px;
        }
        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          overflow: hidden;
          position: relative;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.1);
          display: grid;
          place-items: center;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.85);
        }
        .avatar :global(.avatar-img) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .names {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 900;
          letter-spacing: 0.2px;
        }
        .support-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          margin-left: 8px;
          vertical-align: middle;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25);
        }
        .meta {
          display: inline-flex;
          gap: 8px;
          color: rgba(255, 255, 255, 0.75);
          font-weight: 800;
          font-size: 12px;
        }
        .flag-chip {
          padding: 1px 8px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.1);
        }
        .live-chip {
          color: #ff6b6b;
          font-weight: 900;
          letter-spacing: 0.3px;
        }
        .row-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
        .row-actions .tiny {
          padding: 6px 10px;
          font-weight: 900;
          font-size: 12px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .row-actions .tiny:hover {
          background: rgba(255, 255, 255, 0.16);
          transform: translateY(-1px);
        }
        .elo {
          font-weight: 900;
          font-size: 20px;
          text-align: right;
        }
        @media (max-width: 860px) {
          .lb-controls {
            grid-template-columns: 1fr;
          }
          .chips {
            justify-content: flex-start;
          }
          .lb-table-head,
          .row {
            grid-template-columns: 56px 1fr 96px;
          }
          .elo {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
}
