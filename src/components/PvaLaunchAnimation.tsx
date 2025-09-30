"use client";

import React from "react";

const DEFAULT_MESSAGES = ["준비 중", "모듈 초기화", "리소스 로딩", "환경 정리"];

export default function PvaLaunchAnimation({
  progress,             // 0~100 (미지정 시: 느린 인디케이터)
  size = "md",          // "sm" | "md" | "lg"
  messages = DEFAULT_MESSAGES,
  className,
  style,
}) {
  const clamped =
    typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;

  return (
    <div
      className={`pva-launch ${size} ${className ?? ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-indeterminate={clamped == null ? "true" : "false"}
      style={{
        "--p": clamped != null ? `${clamped * 3.6}deg` : "90deg",
        ...style,
      }}
    >
      <span className="sr-only">
        콘텐츠를 불러오는 중입니다{clamped != null ? `, 진행률 ${clamped}%` : ""}.
      </span>

      {/* 진행 링 */}
      <div className="progress-ring" aria-hidden />

      {/* 장면(모노톤) */}
      <div className="scene-wrap" aria-hidden>
        <div className="launch-scene">
          {/* 은은한 지구 실루엣 */}
          <div className="launch-sphere earth" />
          {/* 미세 광륜 */}
          <div className="launch-sphere halo" />

          {/* 로켓 (미니멀 실루엣) */}
          <div className="launch-rocket">
            <div className="rocket-body">
              <div className="rocket-window" />
              <div className="rocket-ridge" />
            </div>
            <div className="rocket-fin fin-left" />
            <div className="rocket-fin fin-right" />
            <div className="rocket-flame">
              <span className="flame-core" />
            </div>
          </div>

          {/* 미세 별 점(저채도) */}
          <div className="launch-stars starfield-1" />
          <div className="launch-stars starfield-2" />
        </div>
      </div>

      {/* 상태 메시지(저 대비) */}
      <div className="loading-messages" aria-hidden>
        {messages.slice(0, 4).map((text, i) => (
          <span key={i} className={`msg m${i + 1}`}>
            {text}
          </span>
        ))}
      </div>

      <style jsx>{`
        /* ---------- Monochrome Tokens ---------- */
        .pva-launch {
          --size: clamp(14rem, 42vw, 28rem);
          --ring-thickness: 8px;
          --ink: #e8e8e8;                /* 주 텍스트/링 */
          --ink-dim: rgba(255, 255, 255, 0.6);
          --line: rgba(255, 255, 255, 0.12); /* 경계선 */
          --bg0: #0a0a0a;                /* 배경 깊음 */
          --bg1: #0f1011;                /* 패널 */
          --grain: rgba(255, 255, 255, 0.025);
          position: relative;
          width: var(--size);
          height: var(--size);
          border-radius: 16px;
          display: grid;
          place-items: center;
          isolation: isolate;
          overflow: visible;
          -webkit-font-smoothing: antialiased;
          backface-visibility: hidden;
          contain: layout paint style;
        }
        .pva-launch.sm { --size: clamp(12rem, 38vw, 22rem); --ring-thickness: 7px; }
        .pva-launch.lg { --size: clamp(18rem, 48vw, 32rem); --ring-thickness: 10px; }

        /* subtle grain */
        .pva-launch::after {
          content: "";
          position: absolute; inset: 0;
          border-radius: 16px;
          background:
            repeating-linear-gradient(
              0deg,
              transparent 0, transparent 2px, var(--grain) 3px, transparent 4px
            );
          mix-blend-mode: soft-light;
          pointer-events: none;
          z-index: 1;
        }

        /* ---------- A11y ---------- */
        .sr-only {
          position: absolute !important;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0);
          white-space: nowrap; border: 0;
        }

        /* ---------- Progress Ring ---------- */
        .progress-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          pointer-events: none;
          z-index: 2;
        }
        /* 트랙 */
        .progress-ring::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background:
            radial-gradient(
              closest-side,
              rgba(255,255,255,0) calc(50% - var(--ring-thickness)),
              var(--line) calc(50% - var(--ring-thickness) + 1px),
              transparent calc(50% - var(--ring-thickness) + 2px)
            );
          -webkit-mask:
            radial-gradient(farthest-side, #000 calc(50% - 1px), transparent calc(50%));
          mask:
            radial-gradient(farthest-side, #000 calc(50% - 1px), transparent calc(50%));
        }
        /* 채움 */
        .progress-ring::after {
          content: "";
          position: absolute; inset: 0;
          border-radius: 9999px;
          background: conic-gradient(var(--ink) var(--p), transparent 0);
          -webkit-mask: radial-gradient(
            farthest-side,
            transparent calc(50% - var(--ring-thickness)),
            #000 calc(50% - var(--ring-thickness))
          );
          mask: radial-gradient(
            farthest-side,
            transparent calc(50% - var(--ring-thickness)),
            #000 calc(50% - var(--ring-thickness))
          );
          filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.06));
          transform-origin: 50% 50%;
        }
        /* 인디케이터 모드 (느리고 차분하게) */
        .pva-launch[data-indeterminate="true"] .progress-ring::after {
          background:
            conic-gradient(from 0deg,
              var(--ink) 0 16%, transparent 16% 40%,
              var(--ink) 40% 52%, transparent 52% 100%
            );
          animation: ringSpin 2.8s linear infinite;
          opacity: 0.9;
        }
        @keyframes ringSpin { to { transform: rotate(1turn); } }

        /* ---------- Scene Shell ---------- */
        .scene-wrap {
          position: absolute;
          inset: min(10%, 18px);
          display: grid;
          place-items: center;
          z-index: 3;
        }
        .launch-scene {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          overflow: hidden;
          isolation: isolate;
          border-radius: 12px;
          background: radial-gradient(80% 80% at 50% 60%, #0e0f10 0%, #080808 100%);
          border: 1px solid var(--line);
          animation: scenePulse 12s ease-in-out infinite;
        }
        @keyframes scenePulse { 0%,100% { transform: scale(1)} 50% { transform: scale(1.005)} }

        /* ---------- Minimal Visuals (Monochrome) ---------- */
        .launch-sphere { position: absolute; border-radius: 50%; backface-visibility: hidden; }
        .earth {
          bottom: -40%; left: 50%; width: 140%; height: 140%; transform: translateX(-50%);
          background: radial-gradient(circle at 35% 30%, #2a2a2a 0%, #111 45%, #0a0a0a 70%);
          box-shadow: 0 -24px 80px rgba(255, 255, 255, 0.06) inset;
          animation: earthDrift 16s ease-in-out infinite;
        }
        .halo {
          bottom: -6%; left: 50%; width: 110%; height: 110%; transform: translateX(-50%);
          background: radial-gradient(circle at 50% 80%, rgba(255,255,255,0.06), transparent 65%);
          animation: haloPulse 8s ease-in-out infinite;
          mix-blend-mode: screen;
        }
        @keyframes earthDrift { 0%,100%{ transform: translate3d(-50%,0,0)} 50%{ transform: translate3d(calc(-50% + 1px),6px,0)} }
        @keyframes haloPulse { 0%,100%{opacity:.5} 50%{opacity:.8} }

        .launch-rocket {
          position: absolute; bottom: 14%; left: 44%; width: 3.2rem; height: 7.2rem;
          transform-origin: center;
          animation: rocketFloat 6.5s cubic-bezier(.22,1,.36,1) infinite;
          filter: drop-shadow(0 4px 10px rgba(0,0,0,.35));
        }
        @keyframes rocketFloat {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg) }
          25%  { transform: translate3d(2px, -4px, 0) rotate(-1.5deg) }
          50%  { transform: translate3d(4px, -8px, 0) rotate(-2deg) }
          75%  { transform: translate3d(6px, -4px, 0) rotate(-0.5deg) }
          100% { transform: translate3d(8px, -8px, 0) rotate(0deg) }
        }

        .rocket-body {
          position: absolute; inset: 0; border-radius: 1.6rem 1.6rem 0.8rem 0.8rem;
          background: linear-gradient(180deg, #f2f2f2, #cfcfcf);
          box-shadow: 0 0 12px rgba(255,255,255,.08);
        }
        .rocket-window {
          position: absolute; top: 28%; left: 50%; width: 0.9rem; height: 0.9rem; border-radius: 50%;
          transform: translateX(-50%);
          background: radial-gradient(circle at 30% 35%, #fff, #d1d1d1);
          box-shadow: inset 0 0 4px rgba(255,255,255,.6);
        }
        .rocket-ridge {
          position: absolute; bottom: 40%; left: 50%; width: 68%; height: .28rem; border-radius: 999px; transform: translateX(-50%);
          background: linear-gradient(90deg, #9aa0a6, #e5e7eb);
        }
        .rocket-fin {
          position: absolute; bottom: .6rem; width: 1.4rem; height: 2.3rem;
          background: linear-gradient(180deg, #d9d9d9, #bfbfbf);
          border-radius: 0 0 1.2rem 1.2rem;
        }
        .fin-left { left: -0.9rem; transform: rotate(-8deg); }
        .fin-right { right: -0.9rem; transform: rotate(8deg); }
        .rocket-flame { position: absolute; bottom: -0.8rem; left: 50%; width: 0.8rem; height: 1.2rem; transform: translate3d(-50%,0,0); }
        .flame-core {
          position: absolute; inset: 0; border-radius: 999px;
          background: radial-gradient(circle at 50% 35%, #fff, #9f9f9f);
          opacity: 0.65;
          animation: flame 240ms ease-in-out infinite;
          filter: blur(0.2px);
        }
        @keyframes flame { 0%,100%{ transform: scale3d(1,1,1)} 50%{ transform: scale3d(1,0.9,1)} }

        .launch-stars {
          position: absolute; inset: 0;
          background: radial-gradient(circle, rgba(255,255,255,.55) 1px, transparent 2px);
          opacity:.22; mix-blend-mode: screen;
        }
        .starfield-1 { background-size: 26px 26px; animation: starDrift 22s linear infinite; }
        .starfield-2 { background-size: 34px 34px; animation: starDrift 28s linear infinite reverse; opacity:.14 }
        @keyframes starDrift { 0%{ transform: translate3d(0,0,0) } 100%{ transform: translate3d(0,-18px,0) } }

        /* ---------- Messages ---------- */
        .loading-messages {
          position: absolute;
          bottom: min(7%, 18px);
          left: 50%;
          transform: translateX(-50%);
          width: 80%;
          height: 1.2rem;
          overflow: hidden;
          text-align: center;
          z-index: 4;
          font-size: 0.9rem;
          letter-spacing: 0.2px;
          color: var(--ink-dim);
          user-select: none;
        }
        .loading-messages .msg {
          position: absolute;
          inset: 0;
          opacity: 0;
          transform: translateY(6px);
          animation: msgCycle 8s ease-in-out infinite;
        }
        .loading-messages .m2 { animation-delay: 2s; }
        .loading-messages .m3 { animation-delay: 4s; }
        .loading-messages .m4 { animation-delay: 6s; }
        @keyframes msgCycle {
          0%, 18%   { opacity: 0; transform: translateY(6px) }
          25%, 55%  { opacity: 1; transform: translateY(0) }
          65%, 100% { opacity: 0; transform: translateY(-6px) }
        }

        /* ---------- Reduced Motion ---------- */
        @media (prefers-reduced-motion: reduce) {
          .progress-ring::after,
          .launch-scene,
          .earth, .halo, .launch-rocket,
          .launch-stars,
          .flame-core,
          .loading-messages .msg { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
