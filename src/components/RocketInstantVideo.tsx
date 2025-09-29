"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Source = { src: string; width: number }; // 낮은 해상도 -> 높은 해상도 순

function pickSource(sources: Source[]) {
  const conn: any = (navigator as any).connection;
  const save = conn?.saveData === true;
  const slow = save || conn?.effectiveType?.includes("2g") || conn?.effectiveType?.includes("3g") || (conn?.downlink ?? 10) < 2;
  const w = Math.min(window.innerWidth, window.innerHeight);
  if (slow) return sources[0];
  const target = w <= 480 ? 480 : w <= 800 ? 720 : 1080;
  return sources.reduce((best, s) => (s.width >= target && s.width < (best?.width ?? Infinity) ? s : best), sources[sources.length - 1]);
}

/** CSS 애니메이션 즉시 표시(항상 불꽃, opacity 페이드 없음) → 비디오 로드되면 무페이드 스왑 */
export default function RocketInstantVideo({
  className = "",
  sources = [
    { src: "/videos/rocket-320.mp4", width: 320 },
    { src: "/videos/rocket-480.mp4", width: 480 },
    { src: "/videos/rocket-720.mp4", width: 720 },
    { src: "/videos/rocket-1080.mp4", width: 1080 },
  ],
  poster = "/videos/rocket-poster.jpg",
  preload = true,
}: {
  className?: string;
  sources?: Source[];
  poster?: string;
  preload?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const chosen = useMemo(() => pickSource(sources), [sources]);

  // preload hint (첫 페인트 이후 DOM에 주입)
  useEffect(() => {
    if (!preload) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.href = chosen.src;
    link.type = "video/mp4";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, [chosen.src, preload]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onReady = () => {
      setReady(true);
      v.play().catch(() => {});
    };
    v.addEventListener("loadeddata", onReady, { once: true });
    // 모바일에서 초기 autplay 방지 회피: mute + playsinline 필수
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    // 교차 출처 비디오를 캔버스로 쓸 계획이라면 아래 주석 해제 + CORS 구성
    // v.crossOrigin = "anonymous";
    return () => v.removeEventListener("loadeddata", onReady);
  }, [chosen.src]);

  return (
    <div className={`rocket-wrap ${className}`} aria-label="Rocket animation">
      {!ready && <Fallback />}
      <video
        ref={videoRef}
        src={chosen.src}
        poster={poster}
        playsInline
        muted
        autoPlay
        loop
        preload="auto"
        controls={false}
        style={{ display: ready ? "block" : "none", width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }}
      />
      <style jsx>{`
        .rocket-wrap{position:relative;width:clamp(14rem,42vw,28rem);aspect-ratio:1;border-radius:16px;overflow:hidden;background:#020617}
      `}</style>
    </div>
  );
}

/** 즉시 표시되는 CSS 로켓 (opacity 애니메이션 없음, 항상 불꽃 분사) */
function Fallback() {
  return (
    <div className="rf" aria-hidden>
      <div className="rf-earth" />
      <div className="rf-stars s1" />
      <div className="rf-stars s2" />
      <div className="rf-rocket">
        <div className="rf-body"><i className="rf-window" /><i className="rf-ridge" /></div>
        <i className="rf-fin l" /><i className="rf-fin r" />
        <div className="rf-ion" />
        <div className="rf-flame"><i className="core" /><i className="glow" /></div>
      </div>
      <style jsx>{`
        .rf{position:absolute;inset:0;isolation:isolate}
        .rf-earth{position:absolute;bottom:-35%;left:50%;width:150%;height:150%;transform:translateX(-50%);border-radius:50%;
          background:radial-gradient(circle at 35% 30%, rgba(80,165,255,.85), rgba(12,52,129,.95) 45%, rgba(4,16,45,1) 70%)}
        .rf-stars{position:absolute;inset:0}
        .rf-stars.s1{background-image:radial-gradient(circle, rgba(255,255,255,.65) 1px, transparent 2px);background-size:22px 22px}
        .rf-stars.s2{background-image:radial-gradient(circle, rgba(255,255,255,.45) 1px, transparent 2px);background-size:28px 28px}
        .rf-rocket{position:absolute;left:40%;bottom:12%;width:3.6rem;height:8.25rem;transform:translate(0,0) rotate(-2deg)}
        .rf-body{position:absolute;inset:0;border-radius:1.8rem 1.8rem .9rem .9rem;background:linear-gradient(180deg,#fff,#d2e0ff)}
        .rf-window{position:absolute;top:28%;left:50%;width:1rem;height:1rem;transform:translateX(-50%);border-radius:50%;
          background:radial-gradient(circle at 30% 35%, #fff, #516fff);box-shadow:inset 0 0 6px rgba(255,255,255,.7)}
        .rf-ridge{position:absolute;bottom:38%;left:50%;width:70%;height:.35rem;transform:translateX(-50%);border-radius:999px;
          background:linear-gradient(90deg, rgba(148,163,184,.9), rgba(226,232,240,.95))}
        .rf-fin{position:absolute;bottom:.6rem;width:1.6rem;height:2.6rem;border-radius:0 0 1.4rem 1.4rem;background:linear-gradient(180deg,#7dd3fc,#3b82f6)}
        .rf-fin.l{left:-1rem;transform:rotate(-10deg)} .rf-fin.r{right:-1rem;transform:rotate(10deg)}
        .rf-flame{position:absolute;bottom:-1rem;left:50%;width:1.05rem;height:1.7rem;transform:translateX(-50%) scaleY(1.12)}
        .rf-flame::before{content:"";position:absolute;inset:30% 28% -8% 28%;border-radius:999px;
          background:repeating-linear-gradient(180deg, rgba(255,210,120,.72) 0 6px, rgba(255,140,0,.55) 6px 12px);
          mix-blend-mode:screen;animation:diam 420ms linear infinite}
        @keyframes diam{0%{transform:scaleY(.96)}50%{transform:scaleY(1.04)}100%{transform:scaleY(.96)}}
        .rf-flame .core{position:absolute;inset:0;border-radius:999px;background:radial-gradient(circle at 50% 35%, #fff, #ffa028);animation:flick 140ms ease-in-out infinite}
        @keyframes flick{0%,100%{transform:scale3d(1,1,1)}50%{transform:scale3d(1,.88,1)}}
        .rf-flame .glow{position:absolute;inset:-.34rem;border-radius:999px;background:radial-gradient(circle, rgba(255,184,108,.6), transparent 60%);filter:blur(6px)}
        .rf-ion{position:absolute;bottom:-1.2rem;left:50%;width:1.2rem;height:3rem;transform:translateX(-50%) scaleY(1.3);
          background:radial-gradient(50% 120% at 50% 0%, rgba(120,200,255,.55), rgba(80,160,255,.28) 60%, transparent 70%);filter:blur(3px)}
      `}</style>
    </div>
  );
}
