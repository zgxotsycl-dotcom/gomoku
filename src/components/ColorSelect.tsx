"use client";

import React from 'react';

type Player = 'black' | 'white';

export default function ColorSelect({ visible, onSelect }: { visible: boolean; onSelect: (color: Player) => void }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="animate-slime-in bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl w-[520px] max-w-[92%]">
        <h3 className="text-center text-white text-2xl font-bold mb-4">색상을 선택하세요</h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onSelect('black')}
            className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 hover:from-gray-700 hover:to-gray-600 transition-all duration-200 btn-hover-scale"
          >
            <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent_50%)]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-black border border-gray-400 shadow-lg animate-chroma-shine" />
              <div className="text-left">
                <div className="text-white font-bold text-lg">흑으로 시작</div>
                <div className="text-gray-300 text-sm">첫 수를 선점합니다</div>
              </div>
            </div>
          </button>
          <button
            onClick={() => onSelect('white')}
            className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 hover:from-gray-700 hover:to-gray-600 transition-all duration-200 btn-hover-scale"
          >
            <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.2),transparent_50%)]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-gray-400 shadow-lg animate-chroma-shine" />
              <div className="text-left">
                <div className="text-white font-bold text-lg">백으로 시작</div>
                <div className="text-gray-300 text-sm">Swap2 규칙 적용</div>
              </div>
            </div>
          </button>
        </div>
        <div className="mt-4 text-center text-gray-400 text-xs">AI 대전과 온라인 매치에서만 Swap2가 적용됩니다</div>
      </div>
    </div>
  );
}

