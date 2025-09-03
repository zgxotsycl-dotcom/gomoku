'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile } from '../types';
import Fireworks from './Fireworks';


interface GameEndModalProps {
    winnerName: string | null;
    duration: string;
    children: React.ReactNode;
}

const GameEndModal = ({ winnerName, duration, children }: GameEndModalProps) => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (winnerName) {
            const timer = setTimeout(() => setVisible(true), 1000); // Appear after 1 second
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [winnerName]);

    if (!visible) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20 }}>
            <div className="relative bg-gray-800/70 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl p-8 text-center text-white animate-scale-in">
                <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                    <Fireworks />
                </div>
                <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                    <Fireworks />
                </div>
                <h2 className="text-4xl font-bold text-yellow-400 mb-4">
                    {t('WinnerMessage', { winner: winnerName })}
                </h2>
                                <p className="text-lg text-gray-300 mb-6">{t('GameDuration', 'Game Duration: {{duration}}', { duration })}</p>
                <div>{children}</div>
            </div>
        </div>
    );
}

export default GameEndModal;