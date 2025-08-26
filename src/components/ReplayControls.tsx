'use client';

import React, { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';

interface ReplayControlsProps {
    moveCount: number;
    currentMove: number;
    setCurrentMove: Dispatch<SetStateAction<number>>;
    isPlaying: boolean;
    setIsPlaying: Dispatch<SetStateAction<boolean>>;
    onWhatIf?: () => void;
}

const ReplayControls: React.FC<ReplayControlsProps> = ({ moveCount, currentMove, setCurrentMove, isPlaying, setIsPlaying, onWhatIf }) => {
    const { t } = useTranslation();
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => setCurrentMove(Number(e.target.value));
    return (
        <div className="w-full max-w-lg mt-4 p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg flex items-center gap-4 text-white">
            <button onClick={() => setCurrentMove(0)} title={t('First')}>|«</button>
            <button onClick={() => setCurrentMove(p => Math.max(0, p - 1))} title={t('Previous')}>‹</button>
            <button onClick={() => setIsPlaying(p => !p)} className="w-20 px-2 py-1 bg-blue-600 rounded">{isPlaying ? t('Pause') : t('Play')}</button>
            <button onClick={() => setCurrentMove(p => Math.min(moveCount - 1, p + 1))} title={t('Next')}>›</button>
            <button onClick={() => setCurrentMove(moveCount - 1)} title={t('Last')}>»|</button>
            <input type="range" min="0" max={moveCount - 1} value={currentMove} onChange={handleSliderChange} className="w-full" />
            {onWhatIf && <button onClick={onWhatIf} className="px-3 py-1 bg-teal-500 rounded text-sm">{t('WhatIf')}</button>}
        </div>
    );
};

export default ReplayControls;
