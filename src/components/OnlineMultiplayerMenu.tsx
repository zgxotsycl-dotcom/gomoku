'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import type { Socket } from 'socket.io-client';
import type { GameMode, Profile } from '../types';

interface OnlineMultiplayerMenuProps { 
    onBack: () => void;
    setGameMode: (mode: GameMode) => void; 
    socketRef: React.MutableRefObject<Socket | null>; 
    userProfile: Profile | null; 
    onlineUsers: number;
    inQueueUsers: number;
    isSocketConnected: boolean;
}

const OnlineMultiplayerMenu = ({ onBack, setGameMode, socketRef, userProfile, onlineUsers, inQueueUsers, isSocketConnected }: OnlineMultiplayerMenuProps) => {
    const { t } = useTranslation();
    const [mode, setMode] = useState<'select' | 'private'>('select');
    const [roomInput, setRoomInput] = useState('');
    const [isQueuing, setIsQueuing] = useState(false);

    const handlePublicMatch = () => { 
        socketRef.current?.emit('join-public-queue', userProfile);
        toast.success(t('SearchingForPublicMatch', 'Searching for a match...'));
        setIsQueuing(true);
    };
    const handleCancelMatchmaking = () => {
        socketRef.current?.emit('leave-public-queue');
        toast.error(t('MatchmakingCancelled', 'Matchmaking cancelled.'));
        setIsQueuing(false);
    };
    const handleCreatePrivate = () => { socketRef.current?.emit('create-private-room', userProfile); };
    const handleJoinPrivate = () => { if (roomInput) socketRef.current?.emit('join-private-room', roomInput, userProfile); };

    const buttonsDisabled = !isSocketConnected || isQueuing;

    if (mode === 'private') {
        return (
            <div className="flex flex-col gap-2 mb-4 p-4 bg-gray-800/70 backdrop-blur-sm rounded-lg w-full max-w-sm">
                <h2 className="text-xl font-bold text-white text-center mb-2">{t('JoinPrivateRoom')}</h2>
                <div className="flex gap-2">
                    <input type="text" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} placeholder={t('EnterRoomCode')} className="flex-grow px-2 py-1 rounded text-black bg-gray-300 placeholder-gray-500" />
                    <button onClick={handleJoinPrivate} className="px-4 py-1 bg-yellow-500 text-black rounded btn-hover-scale" disabled={!isSocketConnected}>{t('Join')}</button>
                </div>
                <button onClick={() => setMode('select')} className="text-sm text-gray-400 hover:text-white mt-2">{t('Back')}</button>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-4 mb-4 p-6 bg-gray-800/70 backdrop-blur-sm rounded-lg w-full max-w-sm shadow-2xl">
            <div className="flex justify-between text-white text-sm mb-2 gap-4 border-b border-gray-700 pb-2">
                <span>{t('Online')}: {onlineUsers}</span>
                <span>{t('InQueue')}: {inQueueUsers}</span>
            </div>
            <button onClick={handlePublicMatch} className="px-4 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors btn-hover-scale" disabled={buttonsDisabled}>{t('StartPublicMatch')}</button>
            <button onClick={handleCreatePrivate} className="px-4 py-3 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition-colors btn-hover-scale" disabled={buttonsDisabled}>{t('CreatePrivateRoom')}</button>
            <button onClick={() => setMode('private')} className="px-4 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors btn-hover-scale" disabled={buttonsDisabled}>{t('JoinPrivateRoom')}</button>
            
            <div className="h-6 mt-2">
                {isQueuing && (
                    <button onClick={handleCancelMatchmaking} className="text-sm text-red-400 hover:text-red-300 w-full">
                        {t('CancelMatchmaking', 'Cancel Matchmaking')}
                    </button>
                )}
            </div>
            <button onClick={onBack} className="text-sm text-gray-400 hover:text-white mt-4 pt-4 border-t border-gray-700">{t('Back')}</button>
        </div>
    );
};