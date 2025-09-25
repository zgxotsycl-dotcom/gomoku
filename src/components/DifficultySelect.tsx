"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';

type Difficulty = 'easy' | 'normal';

interface DifficultySelectProps {
  visible: boolean;
  onSelect: (d: Difficulty) => void;
  onDismiss?: () => void;
}

const EXIT_DURATION = 220;

export default function DifficultySelect({ visible, onSelect, onDismiss }: DifficultySelectProps) {
  const prevVisibleRef = useRef(visible);
  const [shouldRender, setShouldRender] = useState(visible);
  const [closing, setClosing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(closing);

  useEffect(() => {
    closingRef.current = closing;
  }, [closing]);

  useEffect(() => {
    if (prevVisibleRef.current === visible) return;
    prevVisibleRef.current = visible;

    if (visible) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setShouldRender(true);
      setClosing(false);
      return;
    }

    if (!closingRef.current) {
      setShouldRender(false);
    }
  }, [visible]);

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const triggerDismiss = useCallback(() => {
    if (!onDismiss || closing) return;
    setClosing(true);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      onDismiss();
      setShouldRender(false);
      setClosing(false);
    }, EXIT_DURATION);
  }, [onDismiss, closing]);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        triggerDismiss();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, triggerDismiss]);

  const handlePanelClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  const handleSelect = useCallback(
    (difficulty: Difficulty) => {
      if (closing) return;
      onSelect(difficulty);
    },
    [closing, onSelect],
  );

  if (!shouldRender) return null;

  const overlayStateClass = closing ? 'select-overlay-leave' : 'select-overlay-enter';
  const panelStateClass = closing ? 'select-panel-leave' : 'select-panel-enter';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm ${overlayStateClass}`}
      onClick={triggerDismiss}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl w-[680px] max-w-[96%] ${panelStateClass}`}
        onClick={handlePanelClick}
      >
        <h3 className="text-center text-white text-2xl font-bold mb-5">난이도를 선택해주세요</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button
            onClick={() => handleSelect('easy')}
            className="group relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-emerald-700 to-emerald-600 border border-emerald-500 hover:from-emerald-600 hover:to-emerald-500 transition-all duration-200 btn-hover-scale text-left"
          >
            <div className="absolute inset-0 opacity-20 group-hover:opacity-35 transition-opacity bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_55%)]" />
            <div>
              <div className="text-white font-extrabold text-xl">쉬움</div>
              <ul className="text-emerald-100 text-sm mt-2 space-y-1 list-disc list-inside">
                <li>초보자 친화(금수 규칙 완화)</li>
                <li>AI의 응답 시간 단축</li>
                <li>패턴/수읽기 부담 감소</li>
              </ul>
            </div>
          </button>
          <button
            onClick={() => handleSelect('normal')}
            className="group relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-sky-700 to-sky-600 border border-sky-500 hover:from-sky-600 hover:to-sky-500 transition-all duration-200 btn-hover-scale text-left"
          >
            <div className="absolute inset-0 opacity-20 group-hover:opacity-35 transition-opacity bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.25),transparent_55%)]" />
            <div>
              <div className="text-white font-extrabold text-xl">보통</div>
              <ul className="text-sky-100 text-sm mt-2 space-y-1 list-disc list-inside">
                <li>Swap2 룰 적용(선/후 역할 선택)</li>
                <li>타이머(초/초) 활성화</li>
                <li>AI가 제한 시간까지 깊게 계산</li>
              </ul>
            </div>
          </button>
        </div>
      </div>
      <style jsx>{`
        .select-overlay-enter { animation: selectOverlayIn 220ms ease forwards; }
        .select-overlay-leave { animation: selectOverlayOut 220ms ease forwards; }
        .select-panel-enter { animation: selectPanelIn 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .select-panel-leave { animation: selectPanelOut 200ms ease forwards; }

        @keyframes selectOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes selectOverlayOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes selectPanelIn {
          0% { opacity: 0; transform: translateY(16px) scale(0.96); }
          60% { opacity: 1; transform: translateY(-4px) scale(1.01); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes selectPanelOut {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(14px) scale(0.96); }
        }
      `}</style>
    </div>
  );
}
