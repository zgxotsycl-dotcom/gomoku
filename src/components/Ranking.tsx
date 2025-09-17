'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { Profile } from '../types';
import PatronBadge from './PatronBadge';
import toast from 'react-hot-toast';
import { FaExternalLinkAlt, FaCopy, FaEye } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { FaExternalLinkAlt, FaCopy, FaEye } from 'react-icons/fa';

const Ranking = () => {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeGames, setActiveGames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [supportersOnly, setSupportersOnly] = useState(false);
  const [sortDesc, setSortDesc] = useState(true); // ELO desc by default
  const [searchTerm, setSearchTerm] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchRankingData = async () => {
      setLoading(true);
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username:nickname, elo_rating, is_supporter, nickname_color, badge_color')
        .neq('elo_rating', 1200)
        .order('elo_rating', { ascending: false })
        .limit(50);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
      } else {
        setProfiles(profileData as Profile[]);
        setUpdatedAt(new Date().toLocaleString());
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

    const scheduleFetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void fetchRankingData();
      }, 500);
    };

    const channel = supabase.channel('ranking-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_games' }, scheduleFetch)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // derived list
  const filtered = (showOnlyActive ? profiles.filter(p => activeGames.has(p.id)) : profiles)
    .filter(p => (supportersOnly ? p.is_supporter : true))
    .filter(p => {
      if (!searchTerm.trim()) return true;
      const name = (p.username || '').toLowerCase();
      return name.includes(searchTerm.trim().toLowerCase());
    })
    .sort((a, b) => sortDesc ? (b.elo_rating - a.elo_rating) : (a.elo_rating - b.elo_rating));

  // Quick spectate helpers
  const spectateFirstActive = () => {
    const target = filtered.find(p => activeGames.has(p.id));
    if (!target) { toast(t('NoActiveMatch', 'No active match to spectate now')); return; }
    const roomId = activeGames.get(target.id);
    if (roomId) window.location.href = `/spectate?roomId=${roomId}`;
  };

  const spectateRandomActive = () => {
    const actives = filtered.filter(p => activeGames.has(p.id));
    if (actives.length === 0) { toast(t('NoActiveMatch', 'No active match to spectate now')); return; }
    const pick = actives[Math.floor(Math.random() * actives.length)];
    const roomId = activeGames.get(pick.id);
    if (roomId) window.location.href = `/spectate?roomId=${roomId}`;
  };

  const copyLink = async (roomId: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/spectate?roomId=${roomId}`);
      toast.success(t('LinkCopied', 'Link copied'));
    } catch {
      toast.error(t('CopyFailed', 'Failed to copy link'));
    }
  };

  return (
    <div className="w-full max-w-md p-4 mt-8 bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700">
      <h2 className="text-2xl font-bold text-center text-white mb-6">{t('Top50Players')}</h2>
      {loading ? (
        <p className="text-center text-gray-400">{t('LoadingRankings')}</p>
      ) : (
        <>
        <div className="flex items-center justify-between mb-3 gap-2">
          <button
            onClick={() => setShowOnlyActive((v) => !v)}
            className="px-3 py-1 rounded text-xs bg-gray-700 text-white hover:bg-gray-600"
          >
            {showOnlyActive ? t('AllPlayers', 'All players') : t('ShowOnlyActive', 'Show only active')}
          </button>
          <button
            onClick={() => setSupportersOnly(v => !v)}
            className="px-3 py-1 rounded text-xs bg-gray-700 text-white hover:bg-gray-600"
          >
            {supportersOnly ? t('AllPlayers', 'All players') : t('SupportersOnly', 'Supporters only')}
          </button>
          <button
            onClick={() => setSortDesc(v => !v)}
            className="px-3 py-1 rounded text-xs bg-gray-700 text-white hover:bg-gray-600"
            title={sortDesc ? t('SortEloAsc', 'ELO asc') : t('SortEloDesc', 'ELO desc')}
          >
            {t('ELO')} {sortDesc ? '▼' : '▲'}
          </button>
        </div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('SearchNickname', 'Search nickname')}
            className="w-full px-3 py-1 rounded bg-gray-700 text-white border border-gray-600"
          />
          <button onClick={() => setSearchTerm('')} className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600">{t('Clear', 'Clear')}</button>
          <button onClick={() => {
            setLoading(true);
            // trigger fresh fetch via minimal hack: call effect function
            (async () => {
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, username:nickname, elo_rating, is_supporter, nickname_color, badge_color')
                .neq('elo_rating', 1200)
                .order('elo_rating', { ascending: false })
                .limit(50);
              if (!profileError && profileData) setProfiles(profileData as Profile[]);
              setUpdatedAt(new Date().toLocaleString());
              setLoading(false);
            })();
          }} className="px-3 py-1 rounded text-xs bg-gray-700 text-white hover:bg-gray-600">{t('Refresh', 'Refresh')}</button>
        </div>
        {/* Quick spectate actions */}
        <div className="flex items-center justify-end gap-2 mb-2">
          <button onClick={spectateFirstActive} className="px-3 py-1 rounded text-xs bg-green-700 text-white hover:bg-green-600 flex items-center gap-1" title={t('SpectateActive', 'Spectate active') as string}>
            <FaEye /> {t('SpectateActive', 'Spectate active')}
          </button>
          <button onClick={spectateRandomActive} className="px-3 py-1 rounded text-xs bg-green-700 text-white hover:bg-green-600" title={t('SpectateRandom', 'Random') as string}>
            {t('SpectateRandom', 'Random')}
          </button>
        </div>
        <div className="text-right text-[10px] text-gray-400 mb-2">{t('UpdatedAt', 'Updated at')}: {updatedAt || '-'}</div>
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400">{t('NoResults', 'No matching results')}</p>
        ) : (
        <ol className="space-y-2">
          {filtered.map((profile, index) => {
            const activeRoomId = activeGames.get(profile.id);
            return (
              <li key={profile.id} className="flex justify-between items-center p-3 bg-gray-700/50 rounded-md">
                <div className="flex items-center truncate gap-2">
                  <span className="text-lg font-medium text-gray-400 w-8 text-center mr-1">{index + 1}</span>
                  {activeRoomId && <span className="px-2 py-0.5 text-[10px] rounded bg-red-600 text-white">{t('Live', 'LIVE')}</span>}
                  <Link href={`/profile/${profile.id}`} className="font-medium hover:underline truncate" style={{ color: profile.nickname_color || '#FFFFFF' }}>
                    {profile.username || t('Anonymous', 'Anonymous')}
                  </Link>
                  {profile.is_supporter && <PatronBadge color={profile.badge_color} text={t('Patron')} />}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {activeRoomId && (
                      <>
                        <Link href={`/spectate?roomId=${activeRoomId}`} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors btn-hover-scale">
                          {t('Spectate')}
                        </Link>
                        <a href={`/spectate?roomId=${activeRoomId}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-700 rounded text-white hover:bg-gray-600" title={t('OpenInNewTab', 'Open in new tab') as string}>
                          <FaExternalLinkAlt />
                        </a>
                        <button onClick={() => copyLink(activeRoomId)} className="p-2 bg-gray-700 rounded text-white hover:bg-gray-600" title={t('CopyLink', 'Copy link') as string}>
                          <FaCopy />
                        </button>
                      </>
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
        </>
      )}
    </div>
  );
};

export default Ranking;
