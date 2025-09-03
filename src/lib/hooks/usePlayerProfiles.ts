import { useMemo } from 'react';
import type { Profile } from '../../types';

// NOTE: The types for game and players are simplified here.
// For a more robust solution, these types should be exported from useGomoku or a shared types file.

export const usePlayerProfiles = (game: any, players: any) => {
    const aiProfile: Profile = useMemo(() => ({
        id: 'ai',
        username: 'Gomoku AI',
        elo_rating: 1500,
        is_supporter: true,
        nickname_color: null,
        badge_color: null
    }), []);

    const profiles = useMemo(() => {
        let p1Profile: Profile | null = null;
        let p2Profile: Profile | null = null;

        if (game.mode === 'pvo') {
            p1Profile = players.role === 'black' ? players.user : players.opponent;
            p2Profile = players.role === 'white' ? players.user : players.opponent;
        } else if (game.mode === 'pva') {
            p1Profile = players.ai === 'white' ? players.user : aiProfile;
            p2Profile = players.ai === 'white' ? aiProfile : players.user;
        } else {
            p1Profile = players.user;
            p2Profile = players.opponent;
        }
        return { p1Profile, p2Profile };
    }, [game.mode, players.role, players.user, players.ai, players.opponent, aiProfile]);

    return profiles;
};