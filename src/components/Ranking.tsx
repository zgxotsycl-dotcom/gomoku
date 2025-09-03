'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { Profile } from '../types';
import PatronBadge from './PatronBadge';

const Ranking = () => {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeGames, setActiveGames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRankingData = async () => {
      setLoading(true);
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, elo_rating, is_supporter, nickname_color, badge_color')
        .neq('elo_rating', 1200)
        .order('elo_rating', { ascending: false })
        .limit(50);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
      } else {
        setProfiles(profileData as Profile[]);
      }

      const { data: gameData, error: gameError } = await supabase
        .from('active_games')
        .select('*');

      if (gameError) {
          console.error('Error fetching active games:', gameError);
      } else {
          const gameMap = new Map();
          gameData.forEach(game => {
              gameMap.set(game.player1_id, game.room_id);
              gameMap.set(game.player2_id, game.room_id);
          });
          setActiveGames(gameMap);
      }

      setLoading(false);
    };

    fetchRankingData();

    const channel = supabase.channel('ranking-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchRankingData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_games' }, fetchRankingData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="w-full max-w-md p-4 mt-8 bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700">
      <h2 className="text-2xl font-bold text-center text-white mb-6">{t('Top50Players')}</h2>
      {loading ? (
        <p className="text-center text-gray-400">{t('LoadingRankings')}</p>
      ) : (
        <ol className="space-y-2">
          {profiles.map((profile, index) => {
            const activeRoomId = activeGames.get(profile.id);
            return (
              <li key={profile.id} className="flex justify-between items-center p-3 bg-gray-700/50 rounded-md">
                <div className="flex items-center truncate">
                  <span className="text-lg font-medium text-gray-400 w-8 text-center mr-3">{index + 1}</span>
                  <Link href={`/profile/${profile.id}`} className="font-medium hover:underline truncate" style={{ color: profile.nickname_color || '#FFFFFF' }}>
                    {profile.username || 'Anonymous'}
                  </Link>
                  {profile.is_supporter && <PatronBadge color={profile.badge_color} text={t('Patron')} />}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                    {activeRoomId && (
                        <Link href={`/spectate?roomId=${activeRoomId}`} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors btn-hover-scale">
                            {t('Spectate')}
                        </Link>
                    )}
                    <span className="text-lg font-bold text-white">
                        {profile.elo_rating}
                    </span>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  );
};

export default Ranking;