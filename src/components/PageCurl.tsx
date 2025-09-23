"use client";

import React, { useEffect, useMemo, useRef, useLayoutEffect, useState } from 'react';

interface PageCurlProps {
  open: boolean;
  children: React.ReactNode;
  mode?: 'corner' | 'top'; // 'corner' = corner flip, 'top' = roll down from top edge
  durationMs?: number;     // JS-driven curl duration (top mode)
  easing?: 'cubic' | 'quint'; // Easing curve for JS-driven curl
  curlStrength?: number;   // Multiplier for initial startDeg (>=1 = stronger)
  radiusFactor?: number;   // Divisor for H when computing cylinder radius R
  radiusMax?: number;      // Clamp for R
  scrollOnly?: boolean;    // If true, render only the rolled slices (hide flat face)
  slices?: number;         // Number of vertical slices for rolled sheet
  theme?: 'parchment' | 'hanji' | 'dark' | 'royal'; // Visual theme
  rollEdgeHeight?: number; // Closed edge visual height (px)
  lowSpecAuto?: boolean;   // Reduce complexity on low-end/mobile
  textureStrength?: number; // 0..1 paper texture intensity multiplier
}

// Lightweight wrapper that applies a natural page-curl open animation.
// Uses CSS-only animation for reliability; gracefully respects reduced motion.
export default function PageCurl({ open, children, mode = 'corner', durationMs = 1500, easing = 'quint', curlStrength = 1.0, radiusFactor = 1.3, radiusMax = 220, scrollOnly = false, slices, theme = 'parchment', rollEdgeHeight = 28, lowSpecAuto = true, textureStrength = 1 }: PageCurlProps) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const faceRef = useRef<HTMLDivElement | null>(null);
  const slicesWrapRef = useRef<HTMLDivElement | null>(null);
  const capRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const staffRef = useRef<HTMLDivElement | null>(null);
  const ornLeftRef = useRef<HTMLDivElement | null>(null);
  const ornRightRef = useRef<HTMLDivElement | null>(null);
  const [snapshotHtml, setSnapshotHtml] = useState<string>('');
  const sliceRefs = useRef<Array<HTMLDivElement | null>>([]);
  const animRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const modeRef = useRef<'open' | 'close'>('open');
  const env = useMemo(() => {
    if (typeof window === 'undefined') return { sliceCount: slices ?? 64, tex: textureStrength };
    let sliceCount = slices ?? (window.innerWidth <= 420 ? 44 : 64);
    let tex = textureStrength;
    if (lowSpecAuto) {
      const mem = (navigator as any).deviceMemory || 8;
      const cores = navigator.hardwareConcurrency || 8;
      const low = mem <= 4 || cores <= 4 || window.innerWidth <= 400;
      if (low) {
        sliceCount = Math.min(sliceCount, 40);
        tex = Math.min(tex, 0.7);
      }
    }
    return { sliceCount, tex };
  }, [slices, lowSpecAuto, textureStrength]);

  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    // Re-trigger animation when toggling open state
    el.classList.remove('curl-open', 'curl-closed', 'curl-open-top', 'curl-close-top', 'top-origin');
    // Force reflow for restart
    void el.offsetWidth;
    if (mode === 'top') el.classList.add('top-origin');
    el.classList.add(open ? (mode === 'top' ? 'curl-open-top' : 'curl-open') : (mode === 'top' ? 'curl-close-top' : 'curl-closed'));
    // 초기 상태에서 콘텐츠 깜빡임 방지: face를 완전히 클립하고 롤 파츠만 노출
    if (mode === 'top') {
      try {
        const face = faceRef.current as HTMLElement | null;
        const slices = slicesWrapRef.current as HTMLElement | null;
        const cap = capRef.current as HTMLElement | null;
        const staff = staffRef.current as HTMLElement | null;
        const oL = ornLeftRef.current as HTMLElement | null;
        const oR = ornRightRef.current as HTMLElement | null;
        const sh = shadowRef.current as HTMLElement | null;
        if (face) face.style.clipPath = open ? 'inset(0 0 0 0 round 12px)' : 'inset(100% 0 0 0 round 12px)';
        if (slices) slices.style.clipPath = 'inset(0 0 0 0 round 12px)';
        const vis = open ? '0' : '1';
        if (cap) cap.style.opacity = vis;
        if (staff) staff.style.opacity = vis;
        if (oL) oL.style.opacity = vis;
        if (oR) oR.style.opacity = vis;
        if (sh) sh.style.opacity = open ? '0' : '1';
      } catch {}
    }
  }, [open, mode]);

  useEffect(() => {
    // Capture a static HTML snapshot of the content for slice rendering (visual only, no events)
    if (mode === 'top') {
      const node = faceRef.current;
      if (node) {
        // Slight timeout to ensure content has rendered
        const t = setTimeout(() => {
          try {
            setSnapshotHtml(node.innerHTML || '');
          } catch {}
        }, 0);
        return () => clearTimeout(t);
      }
    }
  }, [open, mode]);

  useEffect(() => {
    if (mode !== 'top') return;
    // Cancel any previous animation
    if (animRef.current) cancelAnimationFrame(animRef.current);
    modeRef.current = open ? 'open' : 'close';
    const duration = Math.max(200, durationMs | 0); // ms
    const faces = sliceRefs.current;
    const size = faces.length;
    if (!size) return;
    const faceNode = faceRef.current;
    const rect = faceNode ? faceNode.getBoundingClientRect() : { height: 480 } as any;
    const H = rect.height || 480;
    const R = Math.min(H / (radiusFactor || 1.3), radiusMax || 220); // base cylinder radius

    const ease = (t: number) => {
      const tt = Math.min(1, Math.max(0, t));
      return easing === 'quint' ? (1 - Math.pow(1 - tt, 5)) : (1 - Math.pow(1 - tt, 3));
    }; // easeOutQuint | easeOutCubic

    const prefersReduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 3D roll parameters
    const thetaMax = 160 * (Math.PI / 180); // clamp angle to avoid full flip artifacts

    const step = (now: number) => {
      if (!startRef.current) startRef.current = now;
      let p = (now - startRef.current) / duration;
      if (p > 1) p = 1;
      const e = ease(p);
      // rolling front position with baseline so closed state still shows an edge
      const B = Math.min(H, Math.max(1, (rollEdgeHeight as number) || 1));
      const frontY = (modeRef.current === 'open')
        ? (B + e * (H - B))
        : (B + (1 - e) * (H - B));

      // simulate scroll remnant radius (more rolled = larger radius)
      const rolledFrac = modeRef.current === 'open' ? (1 - e) : e; // 1 at start of close or end of open
      const Rcap = R * (0.75 + 0.35 * Math.sqrt(Math.max(0, Math.min(1, rolledFrac))));

      // clip underlying flat face to reveal only unrolled part
      if (faceNode) {
        if (scrollOnly) {
          // Hide flat face entirely when rendering as a scroll-only view
          (faceNode as HTMLElement).style.clipPath = `inset(${H}px 0 0 0 round 12px)`;
        } else {
          const topClip = Math.max(0, H - frontY);
          (faceNode as HTMLElement).style.clipPath = `inset(${topClip.toFixed(2)}px 0 0 0 round 12px)`;
        }
      }
      // clip rolled overlay slices to only show above the front
      const slicesWrap = slicesWrapRef.current;
      if (slicesWrap) {
        // Only show the rolled region above the moving front; hide unrolled band below
        const bottomCut = Math.max(0, H - frontY);
        (slicesWrap as HTMLElement).style.clipPath = `inset(0 0 ${bottomCut.toFixed(2)}px 0 round 12px)`;
      }

      // update roll cap (visual cylinder edge)
      const cap = capRef.current;
      if (cap) {
        (cap as HTMLElement).style.transform = `translateY(${frontY.toFixed(2)}px) translateZ(${Rcap.toFixed(2)}px) rotateX(90deg)`;
        (cap as HTMLElement).style.opacity = frontY <= 2 ? '0' : '1';
        (cap as HTMLElement).style.height = `${Math.max(10, Rcap * 0.08)}px`;
        (cap as HTMLElement).style.filter = `blur(${Math.max(0.2, (1 - rolledFrac) * 0.6)}px)`;
      }

      // staff (rod) across the width at the rolling edge
      const staff = staffRef.current;
      if (staff) {
        (staff as HTMLElement).style.transform = `translateY(${frontY.toFixed(2)}px) translateZ(${(Rcap + 1).toFixed(2)}px) rotateX(90deg)`;
        (staff as HTMLElement).style.opacity = frontY <= 2 ? '0' : '1';
      }

      // ornaments at both ends of the staff
      const ol = ornLeftRef.current;
      const orr = ornRightRef.current;
      if (ol) {
        (ol as HTMLElement).style.transform = `translateY(${frontY.toFixed(2)}px) translateZ(${(Rcap + 2).toFixed(2)}px) rotateX(90deg)`;
        (ol as HTMLElement).style.opacity = frontY <= 2 ? '0' : '1';
      }
      if (orr) {
        (orr as HTMLElement).style.transform = `translateY(${frontY.toFixed(2)}px) translateZ(${(Rcap + 2).toFixed(2)}px) rotateX(90deg)`;
        (orr as HTMLElement).style.opacity = frontY <= 2 ? '0' : '1';
      }

      // drop shadow cast by the rolling edge (for scroll depth)
      const sh = shadowRef.current;
      if (sh) {
        (sh as HTMLElement).style.transform = `translateY(${frontY.toFixed(2)}px)`;
        const shOpacity = Math.min(0.55, 0.1 + 0.45 * (1 - Math.cos(Math.PI * Math.min(1, e))));
        (sh as HTMLElement).style.opacity = shOpacity.toFixed(3);
        (sh as HTMLElement).style.filter = `blur(${Math.max(6, Rcap * 0.06)}px)`;
      }

      // rotate slices around moving pivot at the rolling front
      for (let i = 0; i < size; i++) {
        const el = faces[i];
        if (!el) continue;
        const topY = (H / size) * i; // slice top in px
        const d = Math.max(0, frontY - topY); // distance into rolled region
        const theta = Math.min(thetaMax, (d / R) * (curlStrength || 1));
        const deg = theta * 180 / Math.PI;
        const node = el as HTMLElement;
        const pivotLocal = Math.max(0, frontY - topY);
        node.style.transformOrigin = `50% ${pivotLocal.toFixed(2)}px`;
        node.style.transform = `rotateX(${deg.toFixed(2)}deg)`;
        // dynamic shading to emphasize curvature
        const shade = Math.min(0.55, Math.max(0, Math.sin(theta) * 0.45));
        node.style.setProperty('--br', String(1 - shade * 0.35));
        const band = node.querySelector('.slice-band') as HTMLElement | null;
        if (band) band.style.opacity = String(shade);
      }
      if (p < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        // End state: ensure final positions
        const Bf = Math.min(H, Math.max(1, (rollEdgeHeight as number) || 1));
        const finalFront = (modeRef.current === 'open') ? H : Bf;
        // Face: fully open => reveal all; closed => hide completely to avoid peeking
        if (faceNode) {
          if (modeRef.current === 'open') {
            (faceNode as HTMLElement).style.clipPath = `inset(0 0 0 0 round 12px)`;
          } else {
            (faceNode as HTMLElement).style.clipPath = `inset(${H}px 0 0 0 round 12px)`;
          }
        }
        if (slicesWrapRef.current) {
          // Keep only the rolled band visible when closed; none when fully open
          const bottomCut = (modeRef.current === 'open') ? H : Math.max(0, H - finalFront);
          (slicesWrapRef.current as HTMLElement).style.clipPath = `inset(0 0 ${bottomCut}px 0 round 12px)`;
        }
        // Decorations visibility at end
        if (modeRef.current === 'open') {
          if (shadowRef.current) (shadowRef.current as HTMLElement).style.opacity = '0';
          if (staffRef.current) (staffRef.current as HTMLElement).style.opacity = '0';
          if (ornLeftRef.current) (ornLeftRef.current as HTMLElement).style.opacity = '0';
          if (ornRightRef.current) (ornRightRef.current as HTMLElement).style.opacity = '0';
        } else {
          if (shadowRef.current) (shadowRef.current as HTMLElement).style.opacity = '1';
          if (staffRef.current) (staffRef.current as HTMLElement).style.opacity = '1';
          if (ornLeftRef.current) (ornLeftRef.current as HTMLElement).style.opacity = '1';
          if (ornRightRef.current) (ornRightRef.current as HTMLElement).style.opacity = '1';
        }
        if (modeRef.current === 'open') {
          for (const el of faces) if (el) (el as HTMLElement).style.transform = 'rotateX(0deg)';
          if (cap) (cap as HTMLElement).style.opacity = '0';
        } else {
          for (let i = 0; i < size; i++) {
            const el = faces[i]; if (!el) continue;
            const topY = (H / size) * i;
            const d = Math.max(0, finalFront - topY);
            const theta = Math.min(thetaMax, (d / R) * (curlStrength || 1));
            const deg = theta * 180 / Math.PI;
            const pivotLocal = Math.max(0, finalFront - topY);
            (el as HTMLElement).style.transformOrigin = `50% ${pivotLocal}px`;
            (el as HTMLElement).style.transform = `rotateX(${deg.toFixed(2)}deg)`;
          }
        }
        startRef.current = 0;
        animRef.current = null;
      }
    };
    if (prefersReduce) {
      // Jump to end state for reduced motion
      const endFront = (modeRef.current === 'open') ? H : 0;
      const faceTopClip = Math.max(0, H - endFront);
      if (faceNode) (faceNode as HTMLElement).style.clipPath = scrollOnly ? `inset(${H}px 0 0 0 round 12px)` : `inset(${faceTopClip}px 0 0 0 round 12px)`;
      if (slicesWrapRef.current) {
        const bottomCut = (modeRef.current === 'open') ? H : Math.max(0, H - endFront);
        (slicesWrapRef.current as HTMLElement).style.clipPath = `inset(0 0 ${bottomCut}px 0 round 12px)`;
      }
      for (const el of faces) if (el) (el as HTMLElement).style.transform = 'rotateX(0deg)';
      if (capRef.current) (capRef.current as HTMLElement).style.opacity = '0';
      if (staffRef.current) (staffRef.current as HTMLElement).style.opacity = '0';
      if (ornLeftRef.current) (ornLeftRef.current as HTMLElement).style.opacity = '0';
      if (ornRightRef.current) (ornRightRef.current as HTMLElement).style.opacity = '0';
      if (shadowRef.current) (shadowRef.current as HTMLElement).style.opacity = '0';
      return;
    }
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); startRef.current = 0; animRef.current = null; };
  }, [open, mode, snapshotHtml, durationMs, easing, curlStrength, radiusFactor, radiusMax, scrollOnly, rollEdgeHeight]);

  return (
    <div className={`curl-wrap scroll-theme-${theme}`} style={{
      ['--texture-opacity' as any]: String(Math.max(0, Math.min(1, env.tex)) * 0.1),
      ['--roll-cap-h' as any]: '16px',
      ['--roll-staff-h' as any]: '8px',
      ['--roll-edge-h' as any]: `${Math.max(12, Math.min(64, rollEdgeHeight))}px`,
    }}>
      <div ref={pageRef} className="curl-page">
        {mode === 'top' ? (
          <div className="scroll-mask">
            <div className="curl-face" ref={faceRef}>
              <div className="curl-content">{children}</div>
            </div>
            <div className="slices" ref={slicesWrapRef}>
              {Array.from({ length: env.sliceCount }).map((_, i) => {
                const size = env.sliceCount;
                const top = (100 / size) * i;
                const bottom = 100 - (100 / size) * (i + 1);
                const delay = i * 14;
                // Stronger curvature near the top; ease out towards bottom
                const rx = (size - 1 - i) * 8;    // starting extra bend
                const rxm = (size - 1 - i) * 3;   // mid-phase bend
                return (
                  <div key={`slice-${i}`} className="slice" style={{ ['--top' as any]: `${top}%`, ['--bottom' as any]: `${bottom}%`, ['--d' as any]: `${delay}ms` }}>
                    <div className="slice-face" ref={(el) => { sliceRefs.current[i] = el; }}>
                      <div className="slice-side back"><div className="slice-html back" dangerouslySetInnerHTML={{ __html: snapshotHtml }} /></div>
                      <div className="slice-side front"><div className="slice-html" dangerouslySetInnerHTML={{ __html: snapshotHtml }} /><div className="slice-texture" /></div>
                      <div className="slice-band" />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="roll-cap" ref={capRef} />
            <div className="roll-staff" ref={staffRef} />
            <div className="roll-orn left" ref={ornLeftRef} />
            <div className="roll-orn right" ref={ornRightRef} />
            <div className="roll-shadow" ref={shadowRef} />
          </div>
        ) : (
          <div className="scroll-mask">
            <div className="curl-face">
              <div className="side back"><div className="curl-content back">{children}</div></div>
              <div className="side front"><div className="curl-content">{children}</div></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



