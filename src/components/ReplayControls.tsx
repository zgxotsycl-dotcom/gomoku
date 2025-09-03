'use client';

import { useTranslation } from 'react-i18next';
import type { Dispatch, SetStateAction } from 'react';

interface ReplayControlsProps { 
    moveCount: number; 
    currentMove: number; 
    setCurrentMove: Dispatch<SetStateAction<number>>; 
    isPlaying: boolean; 
    setIsPlaying: Dispatch<SetStateAction<boolean>>;
    onWhatIf?: () => void; 
}

const ReplayControls = ({ moveCount, currentMove, setCurrentMove, isPlaying, setIsPlaying, onWhatIf }: ReplayControlsProps) => {
    const { t } = useTranslation();
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => setCurrentMove(Number(e.target.value));
    return (
        <div className="w-full max-w-lg mt-4 p-3 bg-gray-700 rounded-lg flex items-center gap-4 text-white">
            <button onClick={() => setCurrentMove(0)} title={t('First')} className="btn-hover-scale">|«</button>
            <button onClick={() => setCurrentMove(Math.max(0, currentMove - 1))} title={t('Previous')} className="btn-hover-scale">‹</button>
            <button onClick={() => setIsPlaying(!isPlaying)} className="w-20 px-2 py-1 bg-blue-600 rounded btn-hover-scale">{isPlaying ? t('Pause') : t('Play')}</button>
            <button onClick={() => setCurrentMove(Math.min(moveCount - 1, currentMove + 1))} title={t('Next')} className="btn-hover-scale">›</button>
            <button onClick={() => setCurrentMove(moveCount - 1)} title={t('Last')} className="btn-hover-scale">»|</button>
            <input type="range" min="0" max={moveCount > 0 ? moveCount - 1 : 0} value={currentMove} onChange={handleSliderChange} className="w-full" />
            {onWhatIf && <button onClick={onWhatIf} className="px-3 py-1 bg-teal-500 rounded text-sm btn-hover-scale">{t('WhatIf')}</button>}
        </div>
    );
};

export default ReplayControls;