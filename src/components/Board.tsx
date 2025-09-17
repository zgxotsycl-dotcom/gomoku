'use client';

import { useTranslation } from 'react-i18next';
import { useGomoku } from '../lib/hooks/useGomoku';
import GameEndModal from './GameEndModal';
import PostGameManager from './PostGameManager';
import GameArea from './GameArea';
import PvaBackground from './PvaBackground';
import PlayerBanner from './PlayerBanner'; // Import PlayerBanner
import type { GameMode, Game } from '../types';
import ColorSelect from './ColorSelect';
import { useEffect } from 'react';
import Script from 'next/script';

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

    const onChooseColor = async (color: 'black' | 'white') => {
        try {
            if (color === 'black') {
                // Human is Black (first). Second(=AI) chooses best option.
                const resp = await fetch('/api/swap2/second', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ board: state.board }),
                });
                if (!resp.ok) throw new Error(`Swap2(second) failed: ${resp.status}`);
                const data = await resp.json();
                let aiColor: 'black' | 'white' = 'white';
                if (data?.swapColors) aiColor = 'black';
                dispatch({ type: 'APPLY_OPENING', payload: { board: data.board, toMove: data.toMove, aiPlayer: aiColor } });
            } else {
                // Human is White (second). Propose B-W-B and let human add extra white move (option 2 simplified).
                const resp = await fetch('/api/swap2/propose', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ board: state.board }),
                });
                if (!resp.ok) throw new Error(`Swap2(propose) failed: ${resp.status}`);
                const data = await resp.json();
                dispatch({ type: 'APPLY_OPENING', payload: { board: data.board, toMove: data.toMove, aiPlayer: 'black', pendingWhiteExtra: true } });
            }
        } catch (e) {
            console.error('Swap2 setup failed:', e);
        } finally {
            dispatch({ type: 'HIDE_COLOR_SELECT' });
        }
    };

    return (
        <>
            <ColorSelect visible={state.gameMode === 'pva' && state.difficulty === 'normal' && state.showColorSelect && state.history.length === 0} onSelect={onChooseColor} />
            {state.gameMode === 'pva' && <PvaBackground />}
            <div className="w-full h-full relative">
                <div className="fixed top-4 left-4 z-50">
                    <button onClick={onExit} className="text-gray-400 hover:text-gray-200 p-2 transition-colors btn-hover-scale">
                        {t('Back')}
                    </button>
                </div>
                <div className="flex flex-col items-center w-full h-full pt-6">
                    {/* Apply online opening payload if present */}
                    {state.gameMode === 'pvo' && state.history.length === 0 && (
                        <Script id="apply-opening" strategy="afterInteractive">
                          {`
                          (function(){
                            try {
                              const raw = sessionStorage.getItem('openingBoard');
                              if (raw) {
                                const data = JSON.parse(raw);
                                window.dispatchEvent(new CustomEvent('apply-opening', { detail: data }));
                                sessionStorage.removeItem('openingBoard');
                              }
                            } catch(_){}
                          })();
                          `}
                        </Script>
                    )}
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
    // Listen for online opening application event
    useEffect(() => {
        const handler = (e: any) => {
            const data = e?.detail;
            if (!data || !data.board) return;
            dispatch({ type: 'APPLY_OPENING', payload: { board: data.board, toMove: data.toMove || 'white' } });
        };
        if (typeof window !== 'undefined') window.addEventListener('apply-opening', handler as any);
        return () => { if (typeof window !== 'undefined') window.removeEventListener('apply-opening', handler as any); };
    }, [dispatch, state.gameMode]);

    // Initialize difficulty from mode selection (sessionStorage), and open ColorSelect if normal
    useEffect(() => {
        if (state.gameMode !== 'pva' || state.history.length !== 0) return;
        try {
            const raw = sessionStorage.getItem('pva_difficulty');
            if (!raw) return;
            sessionStorage.removeItem('pva_difficulty');
            if (raw === 'easy') {
                dispatch({ type: 'SET_DIFFICULTY', payload: 'easy' });
                dispatch({ type: 'SET_AI_PLAYER', payload: 'white' }); // user black
                dispatch({ type: 'TRIGGER_START_ANIM' });
            } else if (raw === 'normal') {
                dispatch({ type: 'SET_DIFFICULTY', payload: 'normal' });
                dispatch({ type: 'SHOW_COLOR_SELECT' });
            }
        } catch {}
    }, [dispatch, state.gameMode, state.history.length]);
