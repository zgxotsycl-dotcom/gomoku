'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import Board from '../../../components/Board';
import type { Game } from '../../../types';
import { useTranslation } from 'react-i18next';

const ReplayGame = ({ lng }: { lng: string }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const gameId = searchParams.get('gameId');
    const [replayGame, setReplayGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();

    const fetchReplayGame = useCallback(async (currentId: string) => {
        try {
            const { data, error } = await supabase
                .from('games')
                .select('* ')
                .eq('id', currentId)
                .single();

            if (error) throw error;
            if (data) {
                setReplayGame(data as Game);
            }
        } catch (err: any) {
            setError('Failed to load replay game. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (gameId) {
            fetchReplayGame(gameId);
        } else {
            setError('Game ID is missing.');
            setLoading(false);
        }
    }, [gameId, fetchReplayGame]);

    const handleExit = () => {
        router.push(`/${lng}/replays`);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">{t('LoadingReplay')}...</div>;
    }

    if (error) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-red-500">{t('Error')}: {error}</div>;
    }

    if (!replayGame) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">{t('ReplayNotFound')}</div>;
    }

    return (
        <div className="w-screen h-screen bg-gray-900">
            <Board
                initialGameMode={replayGame.game_type}
                replayGame={replayGame}
                onExit={handleExit}
            />
        </div>
    );
};

const ReplayPage = ({ params: { lng } }: { params: { lng: string } }) => {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading...</div>}>
            <ReplayGame lng={lng} />
        </Suspense>
    );
};

export default ReplayPage;