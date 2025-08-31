'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import type { Socket } from 'socket.io-client';
import type { GameMode, Profile } from '@/components/Board';

interface OnlineMultiplayerMenuProps {
  setGameMode: (mode: GameMode) => void;
  socketRef: React.RefObject<Socket | null>;
  userProfile: Profile | null;
}

const OnlineMultiplayerMenu: React.FC<OnlineMultiplayerMenuProps> = ({ setGameMode, socketRef, userProfile }) => {
    const { t } = useTranslation();
    const [mode, setMode] = useState<'select' | 'private'>('select');
    const [roomInput, setRoomInput] = useState('');

    const handlePublicMatch = () => { socketRef.current?.emit('join-public-queue', userProfile); toast.success(t('SearchingForPublicMatch')); };
    const handleCreatePrivate = () => socketRef.current?.emit('create-private-room', userProfile);
    const handleJoinPrivate = () => { if (roomInput) socketRef.current?.emit('join-private-room', roomInput, userProfile); };

    if (mode === 'private') {
        return (
            <div className="flex flex-col gap-2 mb-4 p-4 bg-gray-700/50 backdrop-blur-sm border border-gray-600 rounded-lg">
                <div className="flex gap-2">
                    <input type="text" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} placeholder={t('EnterRoomCode')} className="px-2 py-1 rounded text-black bg-gray-200" />
                    <button onClick={handleJoinPrivate} className="px-4 py-1 bg-yellow-500 text-black rounded">{t('Join')}</button>
                </div>
                <button onClick={() => setMode('select')} className="text-sm text-gray-300 hover:underline">{t('Back')}</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 mb-4 p-4 bg-gray-700/50 backdrop-blur-sm border border-gray-600 rounded-lg">
            <button onClick={handlePublicMatch} className="px-4 py-2 bg-indigo-500 text-white rounded">{t('StartPublicMatch')}</button>
            <button onClick={handleCreatePrivate} className="px-4 py-2 bg-teal-500 text-white rounded">{t('CreatePrivateRoom')}</button>
            <button onClick={() => setMode('private')} className="px-4 py-2 bg-gray-500 text-white rounded">{t('JoinPrivateRoom')}</button>
            <button onClick={onCancel} className="text-sm text-gray-300 hover:underline mt-2">{t('Cancel')}</button>
        </div>
    );
};

export default OnlineMultiplayerMenu;
n>
        </div>
    );
};

export default OnlineMultiplayerMenu;
