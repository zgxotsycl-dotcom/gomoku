"use client";

import { useEffect, useMemo, useState } from 'react';

export type ViewportSize = 'xs' | 'sm' | 'md' | 'lg';

export function useViewportScale() {
  const [dim, setDim] = useState<{ w: number; h: number }>({ w: 1024, h: 768 });

  useEffect(() => {
    const update = () => setDim({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const info = useMemo(() => {
    const { w, h } = dim;
    const minD = Math.min(w, h);
    let size: ViewportSize = 'lg';
    if (minD < 420) size = 'xs';
    else if (minD < 640) size = 'sm';
    else if (minD < 900) size = 'md';
    else size = 'lg';
    const portrait = h >= w;
    const ultraWide = w / Math.max(1, h) > 2.0;
    const short = h < 640;
    return { size, portrait, ultraWide, short, minD, w, h };
  }, [dim]);

  return info;
}

