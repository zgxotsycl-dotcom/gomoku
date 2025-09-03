'use client';

import type { Profile } from '../types';
import { useTranslation } from 'react-i18next';
import PatronBadge from './PatronBadge';

interface PlayerDisplayProps { 
    profile: Profile | null; 
}

const PlayerDisplay = ({ profile }: PlayerDisplayProps) => {
    const { t } = useTranslation();

    if (!profile) return <div className="w-48 h-16 bg-gray-700 rounded-lg animate-pulse" />;

    return (
        <div 
            className="relative w-48 p-3 rounded-lg text-white text-center transition-colors"
            style={{
                backgroundColor: profile.is_supporter && profile.banner_color ? `${profile.banner_color}80` : 'rgba(55, 65, 81, 0.5)' // Default to gray-700 with 50% opacity
            }}
        >
            <div className="flex items-center justify-center">
                <p className="font-bold truncate" style={{ color: profile.is_supporter ? profile.nickname_color || '#FFFFFF' : '#FFFFFF' }}>
                    {profile.username}
                </p>
                {profile.is_supporter && <PatronBadge color={profile.badge_color} text={t('Patron')} />}
            </div>
            <p className="text-sm text-cyan-400">{profile.elo_rating} ELO</p>
        </div>
    );
};

export default PlayerDisplay;