"use client";

import React from 'react';

type Difficulty = 'easy' | 'normal';

export default function DifficultySelect({ visible, onSelect }: { visible: boolean; onSelect: (d: Difficulty) => void }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="animate-slime-in bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl w-[680px] max-w-[96%]">
        <h3 className="text-center text-white text-2xl font-bold mb-5">난이도를 선택하세요</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button onClick={() => onSelect('easy')} className="group relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-emerald-700 to-emerald-600 border border-emerald-500 hover:from-emerald-600 hover:to-emerald-500 transition-all duration-200 btn-hover-scale text-left">
            <div className="absolute inset-0 opacity-20 group-hover:opacity-35 transition-opacity bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_55%)]" />
            <div>
              <div className="text-white font-extrabold text-xl">쉬움</div>
              <ul className="text-emerald-100 text-sm mt-2 space-y-1 list-disc list-inside">
                <li>흑부터 시작(색상 선택 없음)</li>
                <li>AI가 빨리 둠(생각 시간 짧음)</li>
                <li>연습/속성 플레이에 적합</li>
              </ul>
            </div>
          </button>
          <button onClick={() => onSelect('normal')} className="group relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-sky-700 to-sky-600 border border-sky-500 hover:from-sky-600 hover:to-sky-500 transition-all duration-200 btn-hover-scale text-left">
            <div className="absolute inset-0 opacity-20 group-hover:opacity-35 transition-opacity bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.25),transparent_55%)]" />
            <div>
              <div className="text-white font-extrabold text-xl">보통</div>
              <ul className="text-sky-100 text-sm mt-2 space-y-1 list-disc list-inside">
                <li>Swap2 규칙 적용(시작 시 흑/백 선택)</li>
                <li>금수(삼삼/사사) 적용</li>
                <li>턴마다 남은 시간에 따라 AI 생각 시간 가변</li>
              </ul>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

