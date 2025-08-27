'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import type { Socket } from 'socket.io-client';
import type { GameMode } from '@/components/Board';

interface PostGameManagerProps {
  isPlayer: boolean;
  isSpectator: boolean;
  resetGame: (mode: GameMode) => void;
  gameMode: GameMode;
  room: string;
  socketRef: React.RefObject<Socket | null>;
}

const PostGameManager: React.FC<PostGameManagerProps> = ({ isPlayer, isSpectator, resetGame, gameMode, room, socketRef }) => {
    const { t } = useTranslation();
    const [showSpectatorPopup, setShowSpectatorPopup] = useState(true);

    const handleRematch = () => { toast.success(t('VotedForRematch')); socketRef.current?.emit('rematch-vote', room); };
    const handleLeave = () => resetGame(gameMode);
    const handleJoin = () => { toast.success(t('RequestingToJoin')); socketRef.current?.emit('request-to-join', room); };

    if (isPlayer) {
        return (
            <div className="mt-4 flex gap-4">
                <button onClick={handleRematch} className="px-4 py-2 bg-blue-500 text-white rounded">{t('PlayAgain')}</button>
                <button onClick={handleLeave} className="px-4 py-2 bg-gray-500 text-white rounded">{t('Leave')}</button>
            </div>
        );
    }

    if (isSpectator && showSpectatorPopup) {
        return (
            <div className="absolute bottom-4 right-4 bg-gray-700 p-3 rounded-lg shadow-lg flex flex-col gap-2 z-20">
                <p className="text-white text-sm">{t('GameHasEnded')}</p>
                <button onClick={handleJoin} className="px-3 py-1 bg-green-500 text-white rounded text-sm">{t('JoinNextGame')}</button>
                <button onClick={() => setShowSpectatorPopup(false)} className="px-3 py-1 bg-gray-500 text-white rounded text-sm">{t('KeepSpectating')}</button>
            </div>
        );
    }

    return null;
};

export default PostGameManager;
