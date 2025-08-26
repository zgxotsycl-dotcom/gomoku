'use client';

import React from 'react';
import type { Profile, EmoticonMessage } from '@/components/Board';

interface PlayerDisplayProps {
    profile: Profile | null;
    lastEmoticon: EmoticonMessage | undefined;
}

const PlayerDisplay: React.FC<PlayerDisplayProps> = ({ profile, lastEmoticon }) => {
    if (!profile) return <div className="w-48 h-20 bg-gray-700/50 rounded-lg animate-pulse" />;
    return (
        <div className="relative w-48 p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg text-white text-center">
            <p className="font-bold text-lg truncate" style={{ color: profile.is_supporter ? profile.nickname_color || '#FFFFFF' : '#FFFFFF' }}>{profile.username}</p>
            <p className="text-sm text-cyan-400">{profile.elo_rating} ELO</p>
            {lastEmoticon && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-5xl animate-bounce">
                    {lastEmoticon.emoticon}
                </div>
            )}
        </div>
    );
};

export default PlayerDisplay;
