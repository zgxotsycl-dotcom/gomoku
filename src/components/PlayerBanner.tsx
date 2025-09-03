'use client';

import PlayerDisplay from './PlayerDisplay';
import type { Profile } from '../types';

interface Emoticon {
    id: number;
    fromId: string;
    emoticon: string;
}

interface PlayerBannerProps {
    p1Profile: Profile | null;
    p2Profile: Profile | null;
    activeEmoticon: Emoticon | null;
}

const PlayerBanner = ({ p1Profile, p2Profile, activeEmoticon }: PlayerBannerProps) => {
    return (
        <div className="flex w-full max-w-4xl justify-around items-center mb-8 relative">
            {activeEmoticon && p1Profile && activeEmoticon.fromId === p1Profile.id && (
                <div key={activeEmoticon.id} className="absolute left-0 -top-16 text-5xl emoticon-final-animation z-10">
                    {activeEmoticon.emoticon}
                </div>
            )}
            <PlayerDisplay profile={p1Profile} />
            <span className="text-2xl font-bold text-white">VS</span>
            <PlayerDisplay profile={p2Profile} />
            {activeEmoticon && p2Profile && activeEmoticon.fromId === p2Profile.id && (
                <div key={activeEmoticon.id} className="absolute right-0 -top-16 text-5xl emoticon-final-animation z-10">
                    {activeEmoticon.emoticon}
                </div>
            )}
        </div>
    );
};

export default PlayerBanner;