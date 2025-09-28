"use client";

import React from 'react';

export default function PvaLaunchAnimation() {
  return (
    <div className="launch-scene" aria-hidden>
      <div className="launch-sphere earth" />
      <div className="launch-sphere aurora" />
      <div className="launch-trail">
        <span className="trail trail-1" />
        <span className="trail trail-2" />
        <span className="trail trail-3" />
      </div>
      <div className="launch-rocket">
        <div className="rocket-body">
          <div className="rocket-window" />
          <div className="rocket-ridge" />
        </div>
        <div className="rocket-fin fin-left" />
        <div className="rocket-fin fin-right" />
        <div className="rocket-flame">
          <span className="flame-core" />
          <span className="flame-glow" />
        </div>
        {/* playful exhaust sparks */}
        <div className="exhaust-sparks">
          <span /><span /><span />
        </div>
      </div>
      <div className="launch-clouds">
        <span className="puff puff-1" />
        <span className="puff puff-2" />
        <span className="puff puff-3" />
      </div>
      <div className="launch-stars starfield-1" />
      <div className="launch-stars starfield-2" />
      {/* occasional shooting stars */}
      <div className="shooting-stars">
        <span className="comet c1" />
        <span className="comet c2" />
      </div>
      <style jsx>{`
        .launch-scene { position: relative; width: clamp(14rem, 42vw, 28rem); aspect-ratio: 1; overflow: hidden; will-change: transform; animation: scenePulse 8s ease-in-out infinite; isolation:isolate; contain: layout paint style; backface-visibility:hidden; }
        @keyframes scenePulse { 0%,100% { transform: scale(1)} 50% { transform: scale(1.02)} }
        .launch-sphere { position: absolute; border-radius: 50%; filter: blur(0px); transform-origin: center; will-change: transform, opacity; backface-visibility:hidden; }
        .earth { bottom: -35%; left: 50%; width: 150%; height: 150%; transform: translateX(-50%);
                 background: radial-gradient(circle at 35% 30%, rgba(80, 165, 255, 0.85), rgba(12, 52, 129, 0.95) 45%, rgba(4, 16, 45, 1) 70%);
                 box-shadow: 0 -30px 120px rgba(0, 120, 255, 0.35); animation: earthDrift 12s ease-in-out infinite; }
        @keyframes earthDrift { 0%,100%{ transform: translate3d(-50%,0,0)} 50%{ transform: translate3d(calc(-50% + 2px),8px,0)} }
        .aurora { bottom: -10%; left: 50%; width: 110%; height: 110%; transform: translateX(-50%);
                  background: radial-gradient(circle at 50% 80%, rgba(74, 222, 128, 0.55), transparent 65%);
                  animation: auroraPulse 6s ease-in-out infinite; mix-blend-mode: screen; }
        @keyframes auroraPulse { 0%,100%{opacity:.7} 50%{opacity:1} }

        .launch-trail { position: absolute; inset: 0; pointer-events: none; }
        .trail { position: absolute; bottom: 12%; left: 52%; width: 8rem; height: 0.75rem; border-radius: 999px;
                 background: linear-gradient(90deg, rgba(255,255,255,0.2), rgba(80,200,255,0)); transform-origin: left center; opacity: 0;
                 animation: trailStreak 2.6s ease-in-out infinite; }
        .trail-1 { transform: rotate(-6deg) scaleX(0.8); animation-delay: .1s; }
        .trail-2 { transform: rotate(-12deg) scaleX(1); animation-delay: .25s; }
        .trail-3 { transform: rotate(-18deg) scaleX(0.9); animation-delay: .4s; }
        @keyframes trailStreak { 0%{opacity:0} 25%{opacity:1} 60%{opacity:.2} 100%{opacity:0} }

        .launch-rocket { position: absolute; bottom: 12%; left: 40%; width: 3.6rem; height: 8.25rem; transform-origin: center; will-change: transform; backface-visibility:hidden;
                         animation: rocketPath 4.6s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        @keyframes rocketPath {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg) }
          15%  { transform: translate3d(5px, -8px, 0) rotate(-3deg) }
          30%  { transform: translate3d(12px, -16px, 0) rotate(-6deg) }
          45%  { transform: translate3d(20px, -24px, 0) rotate(-4deg) }
          60%  { transform: translate3d(28px, -32px, 0) rotate(0deg) }
          75%  { transform: translate3d(36px, -38px, 0) rotate(3deg) }
          100% { transform: translate3d(44px, -44px, 0) rotate(5deg) }
        }
        .rocket-body { position: absolute; inset: 0; border-radius: 1.8rem 1.8rem 0.9rem 0.9rem;
                       background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(210,224,255,.9)); box-shadow: 0 0 25px rgba(120,200,255,.6); }
        .rocket-window { position: absolute; top: 28%; left: 50%; width: 1rem; height: 1rem; border-radius: 50%; transform: translateX(-50%);
                         background: radial-gradient(circle at 30% 35%, rgba(255,255,255,.9), rgba(81,111,255,.85)); box-shadow: inset 0 0 6px rgba(255,255,255,.7); }
        .rocket-ridge { position: absolute; bottom: 38%; left: 50%; width: 70%; height: .35rem; border-radius: 999px; transform: translateX(-50%);
                         background: linear-gradient(90deg, rgba(148,163,184,.9), rgba(226,232,240,.9)); }
        .rocket-fin { position: absolute; bottom: .6rem; width: 1.6rem; height: 2.6rem; background: linear-gradient(180deg, rgba(125,211,252,.9), rgba(59,130,246,.8));
                       border-radius: 0 0 1.4rem 1.4rem; box-shadow: 0 8px 20px rgba(56,189,248,.4); }
        .fin-left { left: -1rem; transform: rotate(-10deg); }
        .fin-right { right: -1rem; transform: rotate(10deg); }
        .rocket-flame { position: absolute; bottom: -1rem; left: 50%; width: 1rem; height: 1.6rem; transform: translate3d(-50%,0,0); filter: blur(.15px); will-change: transform; }
        .flame-core { position: absolute; inset: 0; border-radius: 999px; background: radial-gradient(circle at 50% 35%, rgba(255,255,255,.98), rgba(255,160,40,.9));
                      animation: flameFlicker 140ms ease-in-out infinite; }
        .flame-glow { position: absolute; inset: -.3rem; border-radius: 999px; background: radial-gradient(circle, rgba(255,184,108,.5), transparent 60%); filter: blur(5px); }
        @keyframes flameFlicker { 0%,100%{ transform: scale3d(1,1,1)} 50%{ transform: scale3d(1,0.86,1)} }

        .launch-clouds { position: absolute; inset: 0; pointer-events: none; }
        .puff { position: absolute; bottom: 8%; left: 45%; width: 2rem; height: 1rem; border-radius: 999px; background: rgba(255,255,255,.45); filter: blur(6px);
                animation: puffOut 3.2s ease-in-out infinite; will-change: transform, opacity; }
        .puff-1 { animation-delay: .2s }
        .puff-2 { left: 48%; width: 2.4rem; animation-delay: .4s }
        .puff-3 { left: 42%; width: 1.6rem; animation-delay: .6s }
        @keyframes puffOut { 0%{ opacity:.0; transform: translate3d(0,0,0) scale(0.8)} 30%{ opacity:.7 }
                              100%{ opacity:0; transform: translate3d(-12px, -52px, 0) scale(1.5)} }

        .launch-stars { position: absolute; inset: 0; background: radial-gradient(circle, rgba(255,255,255,.65) 1px, transparent 2px); opacity:.38; mix-blend-mode: screen; will-change: transform; }
        .starfield-1 { background-size: 22px 22px; animation: starDrift 13s linear infinite; }
        .starfield-2 { background-size: 28px 28px; animation: starDrift 17s linear infinite reverse; opacity:.28 }
        @keyframes starDrift { 0%{ transform: translate3d(0,0,0) } 100%{ transform: translate3d(0,-30px,0) } }

        /* Exhaust playful sparks */
        .exhaust-sparks { position:absolute; left: 50%; bottom: -0.6rem; width: 0; height: 0; pointer-events: none; }
        .exhaust-sparks span { position:absolute; width: 5px; height: 5px; background: radial-gradient(circle, rgba(255,220,120,.9), rgba(255,120,0,.2));
                               border-radius: 9999px; transform: translate3d(-50%, 0, 0); opacity: 0; animation: spark 900ms ease-out infinite; will-change: transform, opacity; }
        .exhaust-sparks span:nth-child(1){ animation-delay: 0ms }
        .exhaust-sparks span:nth-child(2){ animation-delay: 120ms }
        .exhaust-sparks span:nth-child(3){ animation-delay: 240ms }
        @keyframes spark { 0%{ opacity:0; transform: translate3d(-50%, 0, 0) scale(.6) } 20%{ opacity: .95 }
                           100%{ opacity:0; transform: translate3d(calc(-50% - 16px), -26px, 0) scale(.2) } }

        /* Shooting stars */
        .shooting-stars { position:absolute; inset:0; pointer-events:none; }
        .comet { position:absolute; top: 12%; left: -10%; width: 110px; height: 2px; background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.9));
                 filter: blur(0.8px); opacity:.0; animation: cometFly 8s linear infinite; will-change: transform, opacity; }
        .comet.c2 { top: 68%; left: -15%; width: 140px; animation-delay: 3s }
        @keyframes cometFly { 0%{ opacity:0; transform: translate3d(0,0,0) rotate(12deg) }
                              10%{ opacity:.9 }
                              70%{ opacity:.8 }
                              100%{ opacity:0; transform: translate3d(120vw, -40vh, 0) rotate(12deg) } }

        @media (prefers-reduced-motion: reduce) {
          .launch-scene, .earth, .aurora, .launch-rocket, .trail, .puff, .launch-stars, .exhaust-sparks span, .comet { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
