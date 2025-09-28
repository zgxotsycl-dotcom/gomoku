"use client";

import React, { useState } from 'react';
import PageCurl from '@/components/PageCurl';

export default function CurlTestPage() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-[100svh] p-6 bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">PageCurl 3D Roll Test</h1>
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500"
            onClick={() => setOpen(v => !v)}
          >
            {open ? 'Close (Roll Up)' : 'Open (Roll Down)'}
          </button>
          <span className="opacity-70">mode=&quot;top&quot; / easing=&quot;quint&quot; / 1500ms</span>
        </div>
        <PageCurl open={open} mode="top" durationMs={1500} easing="quint" curlStrength={1.1}>
          <div className="p-6 bg-gray-900/70 rounded-xl border border-white/10">
            <h2 className="text-xl font-medium mb-2">Leaderboard</h2>
            <ul className="space-y-2 text-sm opacity-90">
              {Array.from({ length: 10 }).map((_, i) => (
                <li key={i} className="flex justify-between py-1 border-b border-white/10">
                  <span>Player {i + 1}</span>
                  <span>{Math.round(2000 - i * 42)}</span>
                </li>
              ))}
            </ul>
          </div>
        </PageCurl>
      </div>
    </div>
  );
}


