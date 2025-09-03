'use client';

import { useTranslation } from 'react-i18next';
import { useGomoku } from '../lib/hooks/useGomoku';
import GameEndModal from './GameEndModal';
import PostGameManager from './PostGameManager';
import GameArea from './GameArea';
import PvaBackground from './PvaBackground';
import PlayerBanner from './PlayerBanner'; // Import PlayerBanner
import type { GameMode, Game } from '../types';

const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    const milliseconds = Math.floor((ms % 1000) / 100).toString();
    return `${seconds}.${milliseconds}`;
}

interface BoardProps {
    initialGameMode: GameMode;
    onExit: () => void;
    spectateRoomId?: string | null;
    replayGame?: Game | null;
}

const Board = ({ initialGameMode, onExit, spectateRoomId = null, replayGame = null }: BoardProps) => {
    const { t } = useTranslation();
    const { state, dispatch, socketRef } = useGomoku(initialGameMode, onExit, spectateRoomId, replayGame);

    const getWinnerName = () => {
        if (!state.winner) return '';
        if (state.gameMode === 'pva') {
            return state.winner === state.aiPlayer ? 'Gomoku AI' : state.userProfile?.username || 'Player';
        }
        return state.winner.charAt(0).toUpperCase() + state.winner.slice(1);
    };

    const winnerName = getWinnerName();

    // Construct profiles for PlayerBanner in PVA mode
    let p1Profile = null;
    let p2Profile = null;
    if (state.gameMode === 'pva') {
        const humanPlayerIsBlack = state.aiPlayer === 'white';
        const humanProfile = state.userProfile;
        const aiProfile = {
            id: 'ai',
            username: 'Gomoku AI',
            elo_rating: 1500, // Placeholder ELO
            is_supporter: true,
            nickname_color: '#FFD700',
            badge_color: '#FFD700',
            banner_color: '#4A5568', // Default AI banner color
        };

        p1Profile = humanPlayerIsBlack ? humanProfile : aiProfile;
        p2Profile = humanPlayerIsBlack ? aiProfile : humanProfile;
    }
    // TODO: Add logic for PVO profiles

    return (
        <>
            {state.gameMode === 'pva' && <PvaBackground />}
            <div className="w-full h-full relative">
                <div className="fixed top-4 left-4 z-50">
                    <button onClick={onExit} className="text-gray-400 hover:text-gray-200 p-2 transition-colors btn-hover-scale">
                        {t('Back')}
                    </button>
                </div>
                <div className="flex flex-col items-center w-full h-full pt-6">
                    {/* Player Banners */}
                    {state.gameMode === 'pva' && (
                        <PlayerBanner 
                            p1Profile={p1Profile}
                            p2Profile={p2Profile}
                            activeEmoticon={state.activeEmoticon}
                        />
                    )}

                    {/* Timer Display */}
                    <div className="mb-4 h-16 flex items-center justify-center">
                        {(state.gameMode === 'pva' || state.gameMode === 'pvo') && state.gameState === 'playing' && (
                            <div className="flex items-center gap-4 p-3 rounded-lg bg-black/30 backdrop-blur-sm shadow-lg">
                                <div className={`w-8 h-8 rounded-full border-2 border-white ${state.currentPlayer === 'black' ? 'bg-black' : 'bg-white'}`}></div>
                                <span className="text-3xl font-mono text-white w-28 text-center">{formatTime(state.turnTimeRemaining)}</span>
                            </div>
                        )}
                    </div>

                    <GameArea
                        state={state}
                        dispatch={dispatch}
                        replayGame={replayGame}
                    />

                    {state.winner &&
                        <GameEndModal winnerName={winnerName} duration={state.gameDuration}>
                            <PostGameManager
                                isPlayer={!state.isSpectator}
                                isSpectator={state.isSpectator}
                                onExit={onExit}
                                gameMode={state.gameMode}
                                room={state.room}
                                socketRef={socketRef}
                                onRematch={() => dispatch({ type: 'RESET_GAME', payload: { gameMode: state.gameMode } })}
                            />
                        </GameEndModal>
                    }
                </div>
            </div>
        </>
    );
}

export default Board;