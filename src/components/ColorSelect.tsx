"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';

type PlayerChoice = 'black' | 'white';

interface ColorSelectProps {
  visible: boolean;
  onSelect: (color: PlayerChoice) => void;
  timeoutMs?: number | null;
  onTimeout?: () => void;
  onRequestOption3?: () => void;
}

const EXIT_DURATION = 220;

export default function ColorSelect({ visible, onSelect, timeoutMs, onTimeout, onRequestOption3 }: ColorSelectProps) {
  const effectiveTimeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : null;
  const showOption3 = typeof onRequestOption3 === 'function';
  const [remain, setRemain] = useState(effectiveTimeout ?? 0);
  const [shouldRender, setShouldRender] = useState(visible);
  const [closing, setClosing] = useState(false);
  const prevVisibleRef = useRef(visible);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const exitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevVisibleRef.current === visible) return;
    prevVisibleRef.current = visible;

    if (visible) {
      if (exitRef.current) {
        clearTimeout(exitRef.current);
        exitRef.current = null;
      }
      setShouldRender(true);
      setClosing(false);
    } else if (!closing) {
      setShouldRender(false);
    }
  }, [visible, closing]);

  useEffect(() => () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (exitRef.current) {
      clearTimeout(exitRef.current);
      exitRef.current = null;
    }
  }, []);

  const runExit = useCallback(() => {
    if (closing) return;
    setClosing(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    exitRef.current = window.setTimeout(() => {
      exitRef.current = null;
      setShouldRender(false);
      setClosing(false);
    }, EXIT_DURATION);
  }, [closing]);

  useEffect(() => {
    if (!shouldRender || closing) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (!visible) return;

    if (!effectiveTimeout) {
      setRemain(0);
      return undefined;
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
        runExit();
        if (onTimeout) onTimeout(); else onSelect('black');
      }
    }, 50);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [shouldRender, closing, visible, effectiveTimeout, onTimeout, onSelect, runExit]);

  const handleSelect = useCallback(
    (choice: PlayerChoice) => {
      if (closing) return;
      onSelect(choice);
      runExit();
    },
    [closing, onSelect, runExit],
  );

  const handleOption3 = useCallback(() => {
    if (closing || !onRequestOption3) return;
    onRequestOption3();
    runExit();
  }, [closing, onRequestOption3, runExit]);

  if (!shouldRender) return null;

  const overlayClass = closing ? 'color-select-overlay-leave' : 'color-select-overlay-enter';
  const panelClass = closing ? 'color-select-panel-leave' : 'color-select-panel-enter';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm ${overlayClass}`}>
      <div className={`bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl w-[640px] max-w-[96%] ${panelClass}`}>
        <h3 className="text-center text-white text-2xl font-bold mb-4">색상을 선택해주세요</h3>
        <div className={`grid grid-cols-1 ${showOption3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
          <button
            type="button"
            onClick={() => handleSelect('black')}
            className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 hover:from-gray-700 hover:to-gray-600 transition-all duration-200 btn-hover-scale"
          >
            <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent_50%)]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-black border border-gray-400 shadow-lg animate-chroma-shine" />
              <div className="text-left">
                <div className="text-white font-bold text-lg">흑돌을 선택</div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleSelect('white')}
            className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 hover:from-gray-700 hover:to-gray-600 transition-all duration-200 btn-hover-scale"
          >
            <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.2),transparent_50%)]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-gray-400 shadow-lg animate-chroma-shine" />
              <div className="text-left">
                <div className="text-white font-bold text-lg">백돌을 선택</div>
              </div>
            </div>
          </button>
          {showOption3 && (
            <button
              type="button"
              onClick={handleOption3}
              className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 hover:from-gray-700 hover:to-gray-600 transition-all duration-200 btn-hover-scale text-left"
            >
              <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.2),transparent_50%)]" />
              <div className="flex flex-col gap-2">
                <div className="text-white font-bold text-lg">추가 두 수 배치</div>
                <div className="text-gray-300 text-sm">백과 흑 한 수씩 더 두고 색상 선택권을 다시 넘깁니다.</div>
              </div>
            </button>
          )}
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
      <style jsx>{`
        .color-select-overlay-enter { animation: colorOverlayIn 220ms ease forwards; }
        .color-select-overlay-leave { animation: colorOverlayOut 220ms ease forwards; }
        .color-select-panel-enter { animation: colorPanelIn 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .color-select-panel-leave { animation: colorPanelOut 200ms ease forwards; }

        @keyframes colorOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes colorOverlayOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes colorPanelIn {
          0% { opacity: 0; transform: translateY(18px) scale(0.95); }
          60% { opacity: 1; transform: translateY(-4px) scale(1.01); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes colorPanelOut {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(14px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}

