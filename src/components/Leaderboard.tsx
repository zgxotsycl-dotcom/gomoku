"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types';
import PatronBadge from './PatronBadge';
import { FaEye, FaExternalLinkAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { toastOnce } from '@/lib/toastOnce';

type ActiveMap = Map<string, string>; // profileId -> roomId

export default function Leaderboard() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState<ActiveMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, elo_rating, is_supporter, nickname_color, badge_color')
      .neq('elo_rating', 1200)
      .order('elo_rating', { ascending: false })
      .limit(50);
    setProfiles((profileData as Profile[]) || []);

    const { data: gameData } = await supabase
      .from('active_games')
      .select('*');
    const m: ActiveMap = new Map();
    (gameData || []).forEach((g: any) => {
      if (g.player1_id) m.set(g.player1_id, g.room_id);
      if (g.player2_id) m.set(g.player2_id, g.room_id);
    });
    setActive(m);

    setUpdatedAt(new Date().toLocaleString());
    setLoading(false);
  };

  useEffect(() => {
    void fetchAll();
    const schedule = () => setTimeout(() => { void fetchAll(); }, 300);
    const ch = supabase.channel('leaderboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_games' }, schedule)
      .subscribe();
    subRef.current = ch;
    return () => { if (subRef.current) supabase.removeChannel(subRef.current); };
  }, []);

  const spectatable = useMemo(() => profiles.filter(p => active.has(p.id)), [profiles, active]);

  const spectateFirst = () => {
    const target = spectatable[0];
    if (!target) { toastOnce('no_active_match', () => toast(t('NoActiveMatch', 'No active match to spectate now'))); return; }
    const roomId = active.get(target.id);
    if (roomId) window.location.href = `/spectate?roomId=${roomId}`;
  };
  const spectateRandom = () => {
    if (spectatable.length === 0) { toastOnce('no_active_match', () => toast(t('NoActiveMatch', 'No active match to spectate now'))); return; }
    const pick = spectatable[Math.floor(Math.random() * spectatable.length)];
    const roomId = active.get(pick.id);
    if (roomId) window.location.href = `/spectate?roomId=${roomId}`;
  };

  return (
    <section className="w-full max-w-xl mx-auto bg-gray-800/70 rounded-lg border border-gray-700 p-4 shadow-xl" aria-busy={loading}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl md:text-2xl font-bold text-white">{t('Top50Players')}</h2>
        <div className="flex items-center gap-2">
          <button onClick={spectateFirst} className="px-3 py-1 rounded text-xs bg-green-700 text-white hover:bg-green-600 flex items-center gap-1"><FaEye />{t('Spectate', 'Spectate')}</button>
          <button onClick={spectateRandom} className="px-3 py-1 rounded text-xs bg-green-700 text-white hover:bg-green-600">{t('SpectateRandom', 'Random')}</button>
        </div>
      </div>
      <div className="text-right text-[10px] text-gray-400 mb-2" aria-live="polite">{t('UpdatedAt', 'Updated at')}: {updatedAt || '-'}</div>

      {/* Scrollable list area: 7 rows visible */}
      <div className="rounded-md overflow-hidden border border-gray-700/60">
        <div className="grid grid-cols-[48px_1fr_90px_96px] gap-2 px-3 py-2 text-gray-300 text-xs bg-gray-900/60 sticky top-0">
          <span>#</span>
          <span>{t('Nickname', 'Nickname')}</span>
          <span className="text-right">ELO</span>
          <span className="text-right">{t('Action', 'Action')}</span>
        </div>
        <ol className="divide-y divide-gray-700/60 max-h-[448px] overflow-y-auto" aria-label={t('Top50Players')}>
          {profiles.length === 0 && (
            <li className="p-4 text-center text-gray-400">{loading ? t('LoadingRankings','Loading rankings...') : t('NoResults','No matching results')}</li>
          )}
          {profiles.map((p, i) => {
            const roomId = active.get(p.id);
            return (
              <li key={p.id} className="grid grid-cols-[48px_1fr_90px_96px] items-center gap-2 px-3 h-16 bg-gray-800/40 hover:bg-gray-700/40">
                <span className="font-bold text-gray-300">{i + 1}</span>
                <div className="flex items-center gap-2 min-w-0">
                  {roomId && <span className="px-2 py-0.5 text-[10px] rounded bg-red-600 text-white">{t('Live','LIVE')}</span>}
                  <Link href={`/profile/${p.id}`} className="truncate font-medium hover:underline" style={{ color: p.nickname_color || '#FFFFFF' }}>
                    {p.username || t('Anonymous', 'Anonymous')}
                  </Link>
                  {p.is_supporter && <PatronBadge color={p.badge_color} text={t('Patron')} />}
                </div>
                <span className="text-right font-bold text-white">{p.elo_rating}</span>
                <div className="flex items-center justify-end gap-2">
                  {roomId ? (
                    <>
                      <Link href={`/spectate?roomId=${roomId}`} className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors">{t('Spectate')}</Link>
                      <a href={`/spectate?roomId=${roomId}`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-gray-700 rounded text-white hover:bg-gray-600" title={t('OpenInNewTab', 'Open in new tab') as string}>
                        <FaExternalLinkAlt />
                      </a>
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-400">{t('Ready','Ready')}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

