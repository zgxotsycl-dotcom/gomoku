'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import toast from 'react-hot-toast';

// Define the shape of the joined game data
interface GameInfo {
  winner_player: string;
  game_type: string;
}

// Define the main Replay type
interface Replay {
  id: number;
  game_id: number;
  is_starred: boolean;
  created_at: string;
  games: GameInfo | null; // Supabase join can return a single object if the relationship is one-to-one
}

const ReplaysPage = () => {
  const { user } = useAuth();
  const [replays, setReplays] = useState<Replay[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReplays = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // The RPC call ensures we get one game per replay
    const { data, error } = await supabase
      .from('user_replays')
      .select(`
        id,
        game_id,
        is_starred,
        created_at,
        games ( winner_player, game_type )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load replays.');
      console.error('Error fetching replays:', error);
    } else {
      // Ensure the data matches the expected type
      const typedData = data.map(item => ({ ...item, games: Array.isArray(item.games) ? item.games[0] : item.games })) as Replay[];
      setReplays(typedData);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchReplays();
  }, [fetchReplays]);

  const toggleStar = async (replay_id: number, current_status: boolean) => {
    const { error } = await supabase
      .from('user_replays')
      .update({ is_starred: !current_status })
      .eq('id', replay_id);

    if (error) {
      toast.error('Failed to update star status.');
    } else {
      toast.success(`Replay ${!current_status ? 'starred' : 'unstarred'}.`);
      fetchReplays(); // Refresh the list
    }
  };

  if (loading) {
    return <div className="text-center text-white p-10">Loading replays...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">My Replays</h1>
            <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Back to Game
            </Link>
        </div>
        <div className="bg-gray-900 rounded-lg shadow-lg p-4">
          <ul className="space-y-3">
            {replays.length > 0 ? replays.map((replay) => (
              <li key={replay.id} className="p-4 bg-gray-800 rounded-md flex justify-between items-center">
                <div>
                  <p className="font-semibold">Game #{replay.game_id}</p>
                  <p className="text-sm text-gray-400">
                    Mode: {replay.games?.game_type} | Winner: {replay.games?.winner_player}
                  </p>
                  <p className="text-xs text-gray-500">Saved: {new Date(replay.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleStar(replay.id, replay.is_starred)} className="text-2xl">
                    {replay.is_starred ? <span className="text-yellow-400">★</span> : <span className="text-gray-500">☆</span>}
                  </button>
                  <Link href={`/replay?gameId=${replay.game_id}`} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    Watch
                  </Link>
                </div>
              </li>
            )) : (
              <p className="text-center text-gray-500 py-8">No replays found. Play some games to save them!</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReplaysPage;