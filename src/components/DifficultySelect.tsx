"use client";

import React from 'react';

type Difficulty = 'easy' | 'normal';

export default function DifficultySelect({ visible, onSelect }: { visible: boolean; onSelect: (d: Difficulty) => void }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="animate-slime-in bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl w-[560px] max-w-[94%]">
        <h3 className="text-center text-white text-2xl font-bold mb-5">난이도를 선택하세요</h3>
        <div className="grid grid-cols-2 gap-5">
          <button onClick={() => onSelect('easy')} className="group relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-emerald-700 to-emerald-600 border border-emerald-500 hover:from-emerald-600 hover:to-emerald-500 transition-all duration-200 btn-hover-scale">
            <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3),transparent_50%)]" />
            <div className="text-left">
              <div className="text-white font-extrabold text-xl">쉬움</div>
              <div className="text-emerald-100 text-sm mt-1">Swap2 미적용 · 사용자 흑 고정 · AI 1초 생각</div>
            </div>
          </button>
          <button onClick={() => onSelect('normal')} className="group relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-sky-700 to-sky-600 border border-sky-500 hover:from-sky-600 hover:to-sky-500 transition-all duration-200 btn-hover-scale">
            <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.3),transparent_50%)]" />
            <div className="text-left">
              <div className="text-white font-extrabold text-xl">보통</div>
              <div className="text-sky-100 text-sm mt-1">Swap2 적용 · 색상 선택 가능 · 표준 생각시간</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

