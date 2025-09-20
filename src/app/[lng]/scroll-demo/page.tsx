"use client";
import React from 'react';
import dynamic from 'next/dynamic';

const ScrollLeaderboard3D = dynamic(() => import('@/components/ScrollLeaderboard3D'), { ssr: false });

export default function ScrollDemoPage() {
  const [open, setOpen] = React.useState(true);
  return (
    <main style={{ padding: 24, minHeight: '100vh', background: '#111', color: '#fff' }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Scroll Leaderboard Demo</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={()=>setOpen(o=>!o)} style={{ padding: '8px 14px', borderRadius: 8 }}>Toggle Open</button>
      </div>
      <ScrollLeaderboard3D open={open} mode="shader" width={1024} height={1536} />
      <p style={{ opacity: 0.7, marginTop: 12 }}>Locale-scoped demo: /en/scroll-demo</p>
    </main>
  );
}

