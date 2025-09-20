"use client";
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
const ScrollLeaderboard3D = dynamic(() => import('@/components/ScrollLeaderboard3D'), { ssr: false });

export default function Scroll3DLab() {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(true); }, []);
  return (
    <div className="min-h-screen p-6 bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Scroll Leaderboard 3D Lab</h1>
        <p className="opacity-80">Use ?dbg=1|2|3 to triage geometry/lighting/texture.</p>
        <div className="border border-white/10 rounded-xl p-2 bg-black/20">
          <ScrollLeaderboard3D open={open} mode="shader" overlay="raycast" />
        </div>
      </div>
    </div>
  );
}

