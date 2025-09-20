'use client';

import { useEffect, useRef } from 'react';

const PvaBackground = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // 전역 사전 로딩된 iframe이 있으면 붙여서 재사용
    const existing = document.getElementById('pva-preload-iframe') as HTMLIFrameElement | null;
    if (existing) {
      existing.removeAttribute('style');
      existing.className = 'cosmos-bg-iframe';
      existing.title = 'AI대전 배경';
      existing.loading = 'eager';
      container.appendChild(existing);
      return;
    }
    // 없으면 새로 생성
    const ifr = document.createElement('iframe');
    ifr.className = 'cosmos-bg-iframe';
    ifr.src = '/backgrounds/ai-daejeon-cosmos.html?quality=high&embed=1';
    ifr.title = 'AI대전 배경';
    ifr.loading = 'eager';
    container.appendChild(ifr);
  }, []);

  return (
    <div className="space-background" ref={containerRef} />
  );
};

export default PvaBackground;
