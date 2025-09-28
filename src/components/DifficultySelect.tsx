"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type Difficulty = 'easy' | 'normal';

interface DifficultySelectProps {
  visible: boolean;
  onSelect: (d: Difficulty) => void;
  onDismiss?: () => void;
}

const EXIT_DURATION = 220;

export default function DifficultySelect({ visible, onSelect, onDismiss }: DifficultySelectProps) {
  const { t, i18n } = useTranslation();
  const L = useCallback((ko: string, ja: string, en: string) => {
    const lng = (i18n?.language || 'en').toLowerCase();
    if (lng.startsWith('ko')) return ko;
    if (lng.startsWith('ja')) return ja;
    return en;
  }, [i18n?.language]);
  const prevVisibleRef = useRef(visible);
  const [shouldRender, setShouldRender] = useState(visible);
  const [closing, setClosing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(closing);

  useEffect(() => { closingRef.current = closing; }, [closing]);

  useEffect(() => {
    if (prevVisibleRef.current === visible) return;
    prevVisibleRef.current = visible;
    if (visible) {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      setShouldRender(true);
      setClosing(false);
      return;
    }
    if (!closingRef.current) setShouldRender(false);
  }, [visible]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

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
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') triggerDismiss(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, triggerDismiss]);

  const handlePanelClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => { event.stopPropagation(); }, []);

  const handleSelect = useCallback((difficulty: Difficulty) => {
    if (closing) return; onSelect(difficulty);
  }, [closing, onSelect]);

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
        <h3 className="text-center text-white text-2xl font-bold mb-5">{t('difficulty.title', L('난이도를 선택하세요','難易度を選択','Choose difficulty'))}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button
            onClick={() => handleSelect('easy')}
            className="group relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-emerald-700 to-emerald-600 border border-emerald-500 hover:from-emerald-600 hover:to-emerald-500 transition-all duration-200 btn-hover-scale text-left"
          >
            <div className="absolute inset-0 opacity-20 group-hover:opacity-35 transition-opacity bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_55%)]" />
            <div>
              <div className="text-white font-extrabold text-xl">{t('difficulty.easy', L('쉬움','かんたん','Easy'))}</div>
              <ul className="text-emerald-100 text-sm mt-2 space-y-1 list-disc list-inside">
                <li>{t('difficulty.easyDesc1', L('편하게 플레이','気楽にプレイ','Relaxed play'))}</li>
                <li>{t('difficulty.easyDesc2', L('기본 규칙 익히기','基本を学ぶ','Learn the basics'))}</li>
              </ul>
            </div>
          </button>
          <button
            onClick={() => handleSelect('normal')}
            className="group relative overflow-hidden rounded-xl p-6 bg-gradient-to-br from-sky-700 to-sky-600 border border-sky-500 hover:from-sky-600 hover:to-sky-500 transition-all duration-200 btn-hover-scale text-left"
          >
            <div className="absolute inset-0 opacity-20 group-hover:opacity-35 transition-opacity bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.25),transparent_55%)]" />
            <div>
              <div className="text-white font-extrabold text-xl">{t('difficulty.normal', L('일반','ふつう','Normal'))}</div>
              <ul className="text-sky-100 text-sm mt-2 space-y-1 list-disc list-inside">
                <li>{t('difficulty.normalDesc1', L('표준 규칙','標準ルール','Standard rules'))}</li>
                <li>{t('difficulty.normalDesc2', L('균형 잡힌 도전','ほどよい難易度','Balanced challenge'))}</li>
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

        @keyframes selectOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes selectOverlayOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes selectPanelIn { 0% { opacity: 0; transform: translateY(16px) scale(0.96); } 60% { opacity: 1; transform: translateY(-4px) scale(1.01); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes selectPanelOut { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(14px) scale(0.96); } }
      `}</style>
    </div>
  );
}
