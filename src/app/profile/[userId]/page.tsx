'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const ProfilePage = ({ params }: { params: { userId: string } }) => {
  const { userId } = params;
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchProfileData = async () => {
      setLoading(true);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        console.error('Error fetching profile:', profileError);
        setLoading(false);
        return notFound();
      }
      setProfile(profileData);

      const { data: statsData, error: statsError } = await supabase.rpc('get_user_stats', {
        user_id_in: userId,
      });

      if (statsError) {
        console.error('Error fetching stats:', statsError);
      } else {
        setStats(statsData);
      }

      setLoading(false);
    };

    fetchProfileData();
  }, [userId]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen bg-gray-800 text-white">Loading profile...</div>;
  }

  if (!profile) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
            <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                ← Back to Game
            </Link>
        </div>

        <div className="bg-gray-900 rounded-lg shadow-lg p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0">
                <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center text-4xl font-bold" style={{ color: profile.nickname_color || '#FFFFFF' }}>
                    {profile.username ? profile.username.charAt(0).toUpperCase() : 'A'}
                </div>
            </div>
            <div>
                <h1 className="text-3xl font-bold flex items-center" style={{ color: profile.nickname_color || '#FFFFFF' }}>
                    {profile.username || 'Anonymous'}
                    {profile.is_supporter && 
                        <span className="ml-3 px-3 py-1 text-sm font-semibold text-black rounded-full" style={{ backgroundColor: profile.badge_color || '#FFD700' }}>
                            Patron
                        </span>
                    }
                </h1>
                <p className="text-cyan-400 text-xl">{profile.elo_rating} ELO</p>
            </div>
        </div>

        {stats && (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-gray-400 text-sm">Total Games</p>
                    <p className="text-2xl font-bold">{stats.total_games}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-gray-400 text-sm">Wins</p>
                    <p className="text-2xl font-bold text-green-400">{stats.total_wins}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-gray-400 text-sm">Losses</p>
                    <p className="text-2xl font-bold text-red-400">{stats.total_losses}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-gray-400 text-sm">Win Rate</p>
                    <p className="text-2xl font-bold">{stats.win_rate}%</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
