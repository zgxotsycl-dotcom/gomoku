"use client";

import React, { useEffect, useRef, useState } from 'react';

type PlayerChoice = 'black' | 'white';

interface ColorSelectProps {
  visible: boolean;
  onSelect: (color: PlayerChoice) => void;
  timeoutMs?: number | null;
  onTimeout?: () => void;
}

export default function ColorSelect({ visible, onSelect, timeoutMs, onTimeout }: ColorSelectProps) {
  const effectiveTimeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : null;
  const [remain, setRemain] = useState(effectiveTimeout ?? 0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!visible) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (!effectiveTimeout) {
      setRemain(0);
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }

    setRemain(effectiveTimeout);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, effectiveTimeout - elapsed);
      setRemain(left);
      if (left <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (onTimeout) onTimeout(); else onSelect('black');
      }
    }, 50);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, effectiveTimeout, onTimeout, onSelect]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="animate-slime-in bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl w-[640px] max-w-[96%]">
        <h3 className="text-center text-white text-2xl font-bold mb-4">색을 선택해주세요</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button type="button" onClick={() => onSelect('black')} className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 hover:from-gray-700 hover:to-gray-600 transition-all duration-200 btn-hover-scale">
            <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent_50%)]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-black border border-gray-400 shadow-lg animate-chroma-shine" />
              <div className="text-left">
                <div className="text-white font-bold text-lg">흑으로 진행</div>
              </div>
            </div>
          </button>
          <button type="button" onClick={() => onSelect('white')} className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 hover:from-gray-700 hover:to-gray-600 transition-all duration-200 btn-hover-scale">
            <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.2),transparent_50%)]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-gray-400 shadow-lg animate-chroma-shine" />
              <div className="text-left">
                <div className="text-white font-bold text-lg">백으로 진행</div>
              </div>
            </div>
          </button>
        </div>
        {effectiveTimeout && (
          <div className="mt-4 h-1.5 w-full bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-400 countdown-line"
              style={{ ['--cd' as any]: `${effectiveTimeout}ms` }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={effectiveTimeout}
              aria-valuenow={remain}
            />
          </div>
        )}
      </div>
    </div>
  );
}
