"use client";

import React, { useEffect, useRef } from "react";

/** fade-in/out 없이 상시 가시 · 상시 플럼 버전 */
export default function PvaLaunchAnimation() {
  const sceneRef = useRef<HTMLDivElement>(null);

  // (선택) 가벼운 관성 틸트 — 시각적 재미는 유지, 성능 영향 최소
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) return;

    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0,
      rafId = 0;

    const follow = () => {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      el.style.setProperty("--rx", `${cy}deg`);
      el.style.setProperty("--ry", `${cx}deg`);
      rafId = requestAnimationFrame(follow);
    };
    const onMove = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      const nx = (x - r.left) / r.width - 0.5;
      const ny = (y - r.top) / r.height - 0.5;
      tx = nx * 6;
      ty = -ny * 6;
      if (!rafId) rafId = requestAnimationFrame(follow);
    };
    const onPointerMove = (e: PointerEvent) => onMove(e.clientX, e.clientY);
    const onLeave = () => {
      tx = 0;
      ty = 0;
    };

    el.addEventListener("pointermove", onPointerMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={sceneRef}
      className="launch-scene"
      aria-hidden
      role="img"
      aria-label="Rocket with continuous flame flying on an elliptical path"
    >
      {/* 배경 */}
      <div className="launch-sphere earth" />
      <div className="launch-sphere aurora" />

      {/* 속도감(스피드라인) — 불투명도 애니메이션 없음 */}
      <div className="speedlines" aria-hidden>
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} style={{ ["--i" as any]: i } as React.CSSProperties} />
        ))}
      </div>

      {/* 로켓 본체 */}
      <div className="launch-rocket">
        <div className="rocket-body">
          <div className="rocket-window" />
          <div className="rocket-ridge" />
        </div>
        <div className="rocket-fin fin-left" />
        <div className="rocket-fin fin-right" />

        {/* 항상 보이는 플럼(불꽃) + 아이온 트레일 (opacity 고정) */}
        <div className="ion-trail" aria-hidden />
        <div className="rocket-flame">
          <span className="flame-core" />
          <span className="flame-glow" />
        </div>

        {/* 스파크(불투명도 고정, 위치/스케일만 변경) */}
        <div className="exhaust-sparks">
          <span />
          <span />
          <span />
        </div>
      </div>

      {/* 스타필드(밝기/흐림만 변화, 투명도 애니메이션 없음) */}
      <div className="launch-stars starfield-1" />
      <div className="launch-stars starfield-2" />

      <style jsx>{`
        /* ===== 커스텀 속성(타임라인/틸트) ===== */
        @property --rx {
          syntax: "<angle>";
          inherits: true;
          initial-value: 0deg;
        }
        @property --ry {
          syntax: "<angle>";
          inherits: true;
          initial-value: 0deg;
        }
        @property --t {
          syntax: "<number>";
          inherits: true;
          initial-value: 0;
        } /* 0→1 진행도 */

        .launch-scene {
          --orbitT: 7.2s; /* 궤도 1회전 시간 */
          --Ax: 56px; /* 타원 반경 X */
          --Ay: 42px; /* 타원 반경 Y */

          /* 깊이 레이어 */
          --z-earth: -80px;
          --z-aurora: -120px;
          --z-stars1: -180px;
          --z-stars2: -220px;
          --z-rocket: 32px;

          position: relative;
          width: clamp(14rem, 42vw, 28rem);
          aspect-ratio: 1;
          overflow: hidden;
          isolation: isolate;
          transform-style: preserve-3d;
          perspective: 900px;

          /* 카메라 틸트(관성 업데이트) */
          transform: rotateX(var(--rx)) rotateY(var(--ry));
          will-change: transform;

          /* 전역 타임라인 — --t만 선형으로 진행 (opacity는 건드리지 않음) */
          animation: orbitProgress var(--orbitT) linear infinite;

          contain: layout paint style;
          content-visibility: auto;
          contain-intrinsic-size: 448px 448px;
          backface-visibility: hidden;
          border-radius: 16px;
          cursor: default;
        }
        @keyframes orbitProgress {
          from {
            --t: 0;
          }
          to {
            --t: 1;
          }
        }

        /* ===== 지구/오로라(항시 가시) ===== */
        .launch-sphere {
          position: absolute;
          border-radius: 50%;
          transform-origin: center;
          backface-visibility: hidden;
        }
        .earth {
          bottom: -35%;
          left: 50%;
          width: 150%;
          height: 150%;
          transform: translateX(-50%) translateZ(var(--z-earth));
          background: radial-gradient(
            circle at 35% 30%,
            rgba(80, 165, 255, 0.85),
            rgba(12, 52, 129, 0.95) 45%,
            rgba(4, 16, 45, 1) 70%
          );
          box-shadow: 0 -24px 100px rgba(0, 120, 255, 0.3);
        }
        .aurora {
          bottom: -12%;
          left: 50%;
          width: 118%;
          height: 118%;
          transform: translateX(-50%) translateZ(var(--z-aurora));
          background: radial-gradient(
              circle at 50% 78%,
              rgba(74, 222, 128, 0.5),
              transparent 62%
            ),
            conic-gradient(
              from 220deg,
              transparent 0 40deg,
              rgba(74, 222, 128, 0.35) 60deg,
              rgba(110, 231, 183, 0.25) 120deg,
              rgba(59, 130, 246, 0.15) 180deg,
              transparent 260deg 360deg
            );
          mix-blend-mode: screen;
          filter: blur(0.6px) hue-rotate(-6deg);
        }

        /* ===== 로켓: 타원 궤도(사인/코사인) — 루프 이음새 無 ===== */
        .launch-rocket {
          --ang: calc(var(--t) * 360deg);
          --x: calc(var(--Ax) * sin(var(--ang)));
          --y: calc(var(--Ay) * -cos(var(--ang))); /* 시작점 아래쪽 */

          --bank: calc(8deg * sin(calc(var(--ang) * 2))); /* 좌우 롤 */
          --pitch: calc(4deg * cos(var(--ang))); /* 상하 피치 */

          position: absolute;
          left: 50%;
          top: 55%;
          width: 3.6rem;
          height: 8.25rem;
          transform-origin: center;
          backface-visibility: hidden;
          will-change: transform;
          transform: translateZ(var(--z-rocket))
            translate3d(calc(-50% + var(--x)), calc(-50% + var(--y)), 0)
            rotate(calc(var(--bank) + var(--pitch)));
          filter: drop-shadow(0 4px 12px rgba(120, 200, 255, 0.5));
        }

        .rocket-body {
          position: absolute;
          inset: 0;
          border-radius: 1.8rem 1.8rem 0.9rem 0.9rem;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.98),
            rgba(210, 224, 255, 0.92)
          );
          box-shadow: 0 0 18px rgba(120, 200, 255, 0.5);
        }
        .rocket-window {
          position: absolute;
          top: 28%;
          left: 50%;
          width: 1rem;
          height: 1rem;
          border-radius: 50%;
          transform: translateX(-50%);
          background: radial-gradient(
            circle at 30% 35%,
            rgba(255, 255, 255, 0.9),
            rgba(81, 111, 255, 0.85)
          );
          box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.7);
        }
        .rocket-ridge {
          position: absolute;
          bottom: 38%;
          left: 50%;
          width: 70%;
          height: 0.35rem;
          border-radius: 999px;
          transform: translateX(-50%);
          background: linear-gradient(
            90deg,
            rgba(148, 163, 184, 0.9),
            rgba(226, 232, 240, 0.95)
          );
        }
        .rocket-fin {
          position: absolute;
          bottom: 0.6rem;
          width: 1.6rem;
          height: 2.6rem;
          background: linear-gradient(
            180deg,
            rgba(125, 211, 252, 0.95),
            rgba(59, 130, 246, 0.85)
          );
          border-radius: 0 0 1.4rem 1.4rem;
          box-shadow: 0 6px 16px rgba(56, 189, 248, 0.35);
        }
        .fin-left {
          left: -1rem;
          transform: rotate(-10deg);
        }
        .fin-right {
          right: -1rem;
          transform: rotate(10deg);
        }

        /* ===== 상시 플럼(불꽃) — opacity 애니메이션 금지, 길이/형상만 변화 ===== */
        .rocket-flame {
          position: absolute;
          bottom: -1rem;
          left: 50%;
          width: 1.05rem;
          height: 1.7rem;
          transform: translate3d(-50%, 0, 0)
            scaleY(
              calc(
                0.95 + 0.18 * (1 + sin(calc(var(--ang) * 3)))
              )
            ); /* 맥동 */
          filter: none; /* 고비용 필터 미사용 */
        }
        .rocket-flame::before {
          /* Shock diamonds 느낌을 투명도 변경 없이 구현 */
          content: "";
          position: absolute;
          inset: 30% 28% -8% 28%;
          border-radius: 999px;
          background: repeating-linear-gradient(
            180deg,
            rgba(255, 210, 120, 0.72) 0 6px,
            rgba(255, 140, 0, 0.55) 6px 12px
          );
          mix-blend-mode: screen;
          /* transform만 애니메이션 */
          animation: diamonds 420ms linear infinite;
        }
        @keyframes diamonds {
          0% {
            transform: scaleY(0.96);
          }
          50% {
            transform: scaleY(1.04);
          }
          100% {
            transform: scaleY(0.96);
          }
        }
        .flame-core {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: radial-gradient(
            circle at 50% 35%,
            rgba(255, 255, 255, 0.98),
            rgba(255, 160, 40, 0.95)
          );
          /* 약한 형상 플리커(투명도 X) */
          animation: coreFlick 140ms ease-in-out infinite;
        }
        @keyframes coreFlick {
          0%,
          100% {
            transform: scale3d(1, 1, 1);
          }
          50% {
            transform: scale3d(1, 0.88, 1);
          }
        }
        .flame-glow {
          position: absolute;
          inset: -0.34rem;
          border-radius: 999px;
          background: radial-gradient(
            circle,
            rgba(255, 184, 108, 0.6),
            transparent 60%
          );
          filter: blur(6px);
          /* 투명도 고정 */
          opacity: 0.9;
        }

        /* 연속 아이온 트레일 — 길이/위치만 변화 (opacity 고정) */
        .ion-trail {
          position: absolute;
          bottom: -1.2rem;
          left: 50%;
          width: 1.2rem;
          height: 3rem;
          transform: translateX(-50%)
            scaleY(calc(1 + 0.4 * (1 + sin(calc(var(--ang) * 2)))));
          background: radial-gradient(
            50% 120% at 50% 0%,
            rgba(120, 200, 255, 0.55),
            rgba(80, 160, 255, 0.28) 60%,
            transparent 70%
          );
          filter: blur(3px);
          opacity: 0.7; /* 고정 */
          pointer-events: none;
        }

        /* 스파크 — 투명도 고정, 위치/스케일만 */
        .exhaust-sparks {
          position: absolute;
          left: 50%;
          bottom: -0.6rem;
          width: 0;
          height: 0;
          pointer-events: none;
        }
        .exhaust-sparks span {
          position: absolute;
          width: 5px;
          height: 5px;
          background: radial-gradient(
            circle,
            rgba(255, 220, 120, 0.95),
            rgba(255, 120, 0, 0.24)
          );
          border-radius: 9999px;
          transform: translate3d(-50%, 0, 0) scale(0.6);
          opacity: 0.9; /* 고정 */
          animation: spark 900ms linear infinite;
        }
        .exhaust-sparks span:nth-child(2) {
          animation-delay: 120ms;
        }
        .exhaust-sparks span:nth-child(3) {
          animation-delay: 240ms;
        }
        @keyframes spark {
          0% {
            transform: translate3d(-50%, 0, 0) scale(0.8);
          }
          100% {
            transform: translate3d(calc(-50% - 22px), -30px, 0) scale(0.2);
          }
        }

        /* ===== 스피드라인 — 불투명도 애니메이션 X, 위치만 이동 ===== */
        .speedlines {
          position: absolute;
          inset: -10% -20%;
          pointer-events: none;
          transform: translateZ(-10px);
          mix-blend-mode: screen;
          opacity: 0.35; /* 고정 */
        }
        .speedlines span {
          --i: 0;
          position: absolute;
          left: calc(4% + (var(--i) * 9%));
          top: -10%;
          width: 2px;
          height: 120%;
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0),
            rgba(180, 220, 255, 0.9),
            rgba(80, 180, 255, 0)
          );
          transform: rotate(calc(-8deg - (var(--i) % 3) * 2deg));
          filter: blur(0.3px);
          animation: speedline 2.2s linear infinite;
          animation-delay: calc((var(--i) % 5) * -0.2s);
        }
        @keyframes speedline {
          from {
            transform: translate3d(0, 0, 0) rotate(var(--_rot, -10deg));
          }
          to {
            transform: translate3d(0, 40%, 0) rotate(var(--_rot, -10deg));
          }
        }

        /* ===== 별 — 밝기/블러만 변화(투명도 고정) ===== */
        .launch-stars {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          will-change: transform, filter;
        }
        .starfield-1 {
          transform: translateZ(var(--z-stars1))
            translate3d(0, calc(-30px * var(--t)), 0);
          background-image: radial-gradient(
              circle,
              rgba(255, 255, 255, 0.65) 1px,
              transparent 2px
            ),
            radial-gradient(
              circle,
              rgba(255, 255, 255, 0.38) 1px,
              transparent 2px
            );
          background-size: 22px 22px, 36px 36px;
          filter: brightness(calc(0.9 + 0.2 * sin(calc(var(--ang) * 2))));
          opacity: 0.42; /* 고정 */
        }
        .starfield-2 {
          transform: translateZ(var(--z-stars2))
            translate3d(0, calc(-30px * var(--t)), 0);
          background-image: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.5) 1px,
            transparent 2px
          );
          background-size: 28px 28px;
          filter: brightness(calc(0.85 + 0.25 * cos(calc(var(--ang) * 3))));
          opacity: 0.32; /* 고정 */
        }

        /* ===== 접근성: Reduce Motion ===== */
        @media (prefers-reduced-motion: reduce) {
          .launch-scene {
            animation: none !important;
            transform: none !important;
          }
          .launch-rocket,
          .speedlines span,
          .ion-trail,
          .rocket-flame::before,
          .flame-core {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
