'use client';

import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { Player } from '../lib/ai';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import io, { Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';

const BOARD_SIZE = 19;
const K_FACTOR = 32;

// --- Type definitions ---
export type GameMode = 'pvp' | 'pva' | 'pvo';
export type GameState = 'waiting' | 'playing' | 'post-game' | 'replay';
export type Profile = { id: string; username: string; elo_rating: number; is_supporter: boolean; nickname_color: string | null; badge_color: string | null; };
export type Game = { id: number; moves: { player: Player, row: number, col: number }[]; game_type: GameMode; };
export type EmoticonMessage = { id: number; fromId: string; emoticon: string };

interface GameData {
  game_type: GameMode;
  winner_player: Player;
  moves: { player: Player; row: number; col: number; }[];
  player_black_id?: string | null;
  player_white_id?: string | null;
}
// --- Helper Functions ---
const checkWin = (board: (Player | null)[][], player: Player, row: number, col: number): {row: number, col: number}[] | null => {
  const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }];
  for (const dir of directions) {
    const line = [{row, col}];
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const newRow = row + i * dir.y; const newCol = col + i * dir.x;
      if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE || board[newRow][newCol] !== player) break;
      line.push({row: newRow, col: newCol});
      count++;
    }
    for (let i = 1; i < 5; i++) {
      const newRow = row - i * dir.y; const newCol = col - i * dir.x;
      if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE || board[newRow][newCol] !== player) break;
      line.push({row: newRow, col: newCol});
      count++;
    }
    if (count >= 5) {
        return line.slice(0, 5);
    }
  }
  return null;
};

const calculateElo = (playerRating: number, opponentRating: number, score: 1 | 0 | 0.5) => {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(playerRating + K_FACTOR * (score - expectedScore));
};

const formatDuration = (seconds: number, t: (key: string, fallback: string) => string) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}${t('minute', '분')} ${remainingSeconds}${t('second', '초')}`;
}
// --- Sub-components ---
const GameEndModal = ({ winnerProfile, duration, children }: { winnerProfile: Profile | null, duration: string, children: React.ReactNode }) => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (winnerProfile) {
            const timer = setTimeout(() => setVisible(true), 100);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [winnerProfile]);

    if (!winnerProfile) return null;

    return (
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center z-20 transition-opacity ease-in-out duration-[2000ms] ${visible ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`bg-gray-800/50 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl p-8 text-center text-white transition-all ease-in-out duration-[2000ms] ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                <h2 className="text-4xl font-bold text-yellow-400 mb-4">
                    {t('WinnerMessage', { winner: winnerProfile?.username })}
                </h2>
                <p className="text-lg text-gray-300 mb-6">{t('GameDuration', 'Game Duration: {{duration}}', { duration })}</p>
                <div>{children}</div>
            </div>
        </div>
    );
}

interface PostGameManagerProps { isPlayer: boolean; isSpectator: boolean; onExit: () => void; gameMode: GameMode; room: string; socketRef: React.MutableRefObject<Socket | null>; }
const PostGameManager = ({ isPlayer, isSpectator, onExit, gameMode, room, socketRef }: PostGameManagerProps) => {
    const { t } = useTranslation();
    const [showSpectatorPopup, setShowSpectatorPopup] = useState(true);
    const handleRematch = () => { toast.success(t('VotedForRematch')); socketRef.current?.emit('rematch-vote', room); };
    const handleLeave = onExit;
    const handleJoin = () => { toast.success(t('RequestingToJoin')); socketRef.current?.emit('request-to-join', room); };
    if (isPlayer) {
        return (
            <div className="mt-4 flex gap-4">
                <button onClick={handleRematch} className="px-4 py-2 bg-blue-500 text-white rounded">{t('PlayAgain')}</button>
                <button onClick={handleLeave} className="px-4 py-2 bg-gray-500 text-white rounded">{t('Leave')}</button>
            </div>
        );
    }
    if (isSpectator && showSpectatorPopup) {
        return (
            <div className="absolute bottom-4 right-4 bg-gray-700 p-3 rounded-lg shadow-lg flex flex-col gap-2">
                <p className="text-white text-sm">{t('GameHasEnded')}</p>
                <button onClick={handleJoin} className="px-3 py-1 bg-green-500 text-white rounded text-sm">{t('JoinNextGame')}</button>
                <button onClick={() => setShowSpectatorPopup(false)} className="px-3 py-1 bg-gray-500 text-white rounded text-sm">{t('KeepSpectating')}</button>
            </div>
        );
    }
    return null;
};

interface OnlineMultiplayerMenuProps { setGameMode: (mode: GameMode) => void; socketRef: React.MutableRefObject<Socket | null>; userProfile: Profile | null; }
const OnlineMultiplayerMenu = ({ setGameMode, socketRef, userProfile }: OnlineMultiplayerMenuProps) => {
    const { t } = useTranslation();
    const [mode, setMode] = useState<'select' | 'private'>('select');
    const [roomInput, setRoomInput] = useState('');
    const handlePublicMatch = () => { socketRef.current?.emit('join-public-queue', userProfile); toast.success(t('SearchingForPublicMatch')); };
    const handleCreatePrivate = () => { socketRef.current?.emit('create-private-room', userProfile); };
    const handleJoinPrivate = () => { if (roomInput) socketRef.current?.emit('join-private-room', roomInput, userProfile); };
    if (mode === 'private') {
        return (
            <div className="flex flex-col gap-2 mb-4 p-4 bg-gray-600 rounded-lg">
                <div className="flex gap-2">
                    <input type="text" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} placeholder={t('EnterRoomCode')} className="px-2 py-1 rounded text-black" />
                    <button onClick={handleJoinPrivate} className="px-4 py-1 bg-yellow-500 text-black rounded">{t('Join')}</button>
                </div>
                <button onClick={() => setMode('select')} className="text-sm text-gray-300 hover:underline">{t('Back')}</button>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-4 mb-4 p-4 bg-gray-600 rounded-lg">
            <button onClick={handlePublicMatch} className="px-4 py-2 bg-indigo-500 text-white rounded">{t('StartPublicMatch')}</button>
            <button onClick={handleCreatePrivate} className="px-4 py-2 bg-teal-500 text-white rounded">{t('CreatePrivateRoom')}</button>
            <button onClick={() => setMode('private')} className="px-4 py-2 bg-gray-500 text-white rounded">{t('JoinPrivateRoom')}</button>
            <button onClick={() => setGameMode('pvp')} className="text-sm text-gray-300 hover:underline mt-2">{t('Cancel')}</button>
        </div>
    );
};
interface ReplayControlsProps { moveCount: number; currentMove: number; setCurrentMove: Dispatch<SetStateAction<number>>; isPlaying: boolean; setIsPlaying: Dispatch<SetStateAction<
    boolean>>; onWhatIf?: () => void; }
const ReplayControls = ({ moveCount, currentMove, setCurrentMove, isPlaying, setIsPlaying, onWhatIf }: ReplayControlsProps) => {
    const { t } = useTranslation();
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => setCurrentMove(Number(e.target.value));
    return (
        <div className="w-full max-w-lg mt-4 p-3 bg-gray-700 rounded-lg flex items-center gap-4 text-white">
            <button onClick={() => setCurrentMove(0)} title={t('First')}>|«</button>
            <button onClick={() => setCurrentMove(p => Math.max(0, p - 1))} title={t('Previous')}>‹</button>
            <button onClick={() => setIsPlaying(p => !p)} className="w-20 px-2 py-1 bg-blue-600 rounded">{isPlaying ? t('Pause') : t('Play')}</button>
            <button onClick={() => setCurrentMove(p => Math.min(moveCount - 1, p + 1))} title={t('Next')}>›</button>
            <button onClick={() => setCurrentMove(moveCount - 1)} title={t('Last')}>»|</button>
            <input type="range" min="0" max={moveCount > 0 ? moveCount - 1 : 0} value={currentMove} onChange={handleSliderChange} className="w-full" />
            {onWhatIf && <button onClick={onWhatIf} className="px-3 py-1 bg-teal-500 rounded text-sm">{t('WhatIf')}</button>}
        </div>
    );
};

interface PlayerDisplayProps { profile: Profile | null; lastEmoticon: EmoticonMessage | undefined; }
const PlayerDisplay = ({ profile, lastEmoticon }: PlayerDisplayProps) => {
    if (!profile) return <div className="w-48 h-16 bg-gray-700 rounded-lg animate-pulse" />;
    return (
        <div className="relative w-48 p-3 bg-gray-700 rounded-lg text-white text-center">
            <p className="font-bold truncate" style={{ color: profile.is_supporter ? profile.nickname_color || '#FFFFFF' : '#FFFFFF' }}>{profile.username}</p>
            <p className="text-sm text-cyan-400">{profile.elo_rating} ELO</p>
            {lastEmoticon && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl animate-bounce">
                    {lastEmoticon.emoticon}
                </div>
            )}
        </div>
    );
};

interface EmoticonPickerProps { onSelect: (emoticon: string) => void; }
const EmoticonPicker = ({ onSelect }: EmoticonPickerProps) => {
    const emoticons = ['😊', '😂', '😭', '👍', '🤔', '🔥'];
    return (
        <div className="flex gap-2 p-2 bg-gray-700 rounded-lg">
            {emoticons.map(emo => (
                <button key={emo} onClick={() => onSelect(emo)} className="text-2xl hover:scale-125 transition-transform">
                    {emo}
                </button>
            ))}
        </div>
    );
};

interface BoardProps {
    initialGameMode: GameMode;
    onExit: () => void;
    spectateRoomId?: string | null;
    replayGame?: Game | null;
}
const Board = ({ initialGameMode, onExit, spectateRoomId = null, replayGame = null }: BoardProps) => {
    const { t } = useTranslation();
    const [board, setBoard] = useState<Array<Array<Player | null>>>(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
    const [currentPlayer, setCurrentPlayer] = useState<Player>('black');
    const [winner, setWinner] = useState<Player | null>(null);
    const [gameMode, setGameMode] = useState<GameMode>(initialGameMode);
    const [gameState, setGameState] = useState<GameState>(replayGame ? 'replay' : 'waiting');
    const [room, setRoom] = useState(spectateRoomId || '');
    const [playerRole, setPlayerRole] = useState<Player | null>(null);
    const [isSpectator, setIsSpectator] = useState(!!spectateRoomId);
    const [history, setHistory] = useState(replayGame ? replayGame.moves : []);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [opponentProfile, setOpponentProfile] = useState<Profile | null>(null);
    const [emoticons, setEmoticons] = useState<EmoticonMessage[]>([]);

    const [replayMoveIndex, setReplayMoveIndex] = useState(0);
    const [isReplaying, setIsReplaying] = useState(false);
    const [whatIfState, setWhatIfState] = useState<{board: (Player | null)[][], player: Player} | null>(null);

    const [aiKnowledge, setAiKnowledge] = useState<Map<string, { wins: number; losses: number; }> | null>(null);
    const [aiPlayer, setAiPlayer] = useState<Player>('white');

    const [winningLine, setWinningLine] = useState<{row: number, col: number}[] | null>(null);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [gameDuration, setGameDuration] = useState("");
    

    const { user } = useAuth();
    const socketRef = useRef<Socket | null>(null);
    const aiWorkerRef = useRef<Worker | null>(null);
    const replayIntervalRef = useRef<number | null>(null);
    const userProfileRef = useRef(userProfile);
    userProfileRef.current = userProfile;
    const internalReset = () => {
    setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
    setCurrentPlayer('black');
    setWinner(null);
    setHistory([]);
    setGameState('playing');
    setWhatIfState(null);
    setWinningLine(null);
    
    setStartTime(Date.now());
};

useEffect(() => {
    setGameMode(initialGameMode);
    internalReset();
    if (initialGameMode === 'pva' && !replayGame && !spectateRoomId) {
        const randomAiPlayer = Math.random() < 0.5 ? 'black' : 'white';
        setAiPlayer(randomAiPlayer);
    }
}, [initialGameMode, replayGame, spectateRoomId]);

const handleStonePlacement = useCallback((row: number, col: number) => {
    if (whatIfState) {
        const board = whatIfState.board;
        if (board[row][col]) return;
        const newBoard = board.map(r => [...r]);
        newBoard[row][col] = whatIfState.player;
        const nextPlayer = whatIfState.player === 'black' ? 'white' : 'black';
        setWhatIfState({ board: newBoard, player: nextPlayer });
        aiWorkerRef.current?.postMessage({ board: newBoard, player: nextPlayer, knowledge: aiKnowledge });
        return;
    }

    if (board[row][col] || winner || isSpectator || gameState !== 'playing') return;
    if (gameMode === 'pvo' && currentPlayer !== playerRole) { toast.error(t('NotYourTurn')); return; }

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    const newHistory = [...history, { player: currentPlayer, row, col }];
    setBoard(newBoard);
    setHistory(newHistory);

    const winInfo = checkWin(newBoard, currentPlayer, row, col);
    if (winInfo) {
        setWinner(currentPlayer);
        setWinningLine(winInfo);
        if(startTime) {
            const durationInSeconds = (Date.now() - startTime) / 1000;
            setGameDuration(formatDuration(durationInSeconds, t));
        }
        setGameState('post-game');
        
        if (gameMode === 'pvo') socketRef.current?.emit('game-over', { roomId: room, winner: currentPlayer });
    } else {
        const newPlayer = currentPlayer === 'black' ? 'white' : 'black';
        setCurrentPlayer(newPlayer);
    }
}, [board, currentPlayer, gameState, gameMode, isSpectator, playerRole, room, winner, whatIfState, aiKnowledge, t, history, startTime]);

const handleGameEnd = useCallback(async (gameWinner: Player) => {
    if (isSpectator || gameMode === 'pvp') return;
    let gameData: GameData = { game_type: gameMode, winner_player: gameWinner, moves: history };
    if (gameMode === 'pvo' && userProfile && opponentProfile) {
        gameData.player_black_id = playerRole === 'black' ? userProfile.id : opponentProfile.id;
        gameData.player_white_id = playerRole === 'white' ? userProfile.id : opponentProfile.id;
    } else if (gameMode === 'pva' && userProfile) {
        if (aiPlayer === 'white') {
            gameData.player_black_id = userProfile.id;
            gameData.player_white_id = null;
        } else {
            gameData.player_black_id = null;
            gameData.player_white_id = userProfile.id;
        }
    }
    const { data: savedGame, error: gameSaveError } = await supabase.from('games').insert([gameData]).select().single();
    if (gameSaveError || !savedGame) { toast.error(t('FailedToSaveGame')); return; }
    else {
        toast.success(t('GameResultsSaved'));
        if (userProfile?.is_supporter) await supabase.rpc('add_replay_and_prune', { user_id_in: userProfile.id, game_id_in: savedGame.id });
        if (opponentProfile?.is_supporter) await supabase.rpc('add_replay_and_prune', { user_id_in: opponentProfile.id, game_id_in: savedGame.id });
    }
    if (gameMode === 'pvo' && userProfile && opponentProfile) {
        const didIWin = playerRole === gameWinner;
        const myNewElo = calculateElo(userProfile.elo_rating ?? 1500, opponentProfile.elo_rating ?? 1500, didIWin ? 1 : 0);
        const opponentNewElo = calculateElo(opponentProfile.elo_rating ?? 1500, userProfile.elo_rating ?? 1500, didIWin ? 0 : 1);
        toast.success(`${t('YourNewElo')}: ${myNewElo} (${myNewElo - userProfile.elo_rating >= 0 ? '+' : ''}${myNewElo - userProfile.elo_rating})`);
        await supabase.rpc('update_elo', { winner_id: didIWin ? userProfile.id : opponentProfile.id, loser_id: didIWin ? opponentProfile.id : userProfile.id, winner_new_elo: didIWin
        ? myNewElo : opponentNewElo, loser_new_elo: didIWin ? opponentNewElo : myNewElo });
        setUserProfile(p => p ? { ...p, elo_rating: myNewElo } : null);
        setOpponentProfile(p => p ? { ...p, elo_rating: opponentNewElo } : null);
    }
}, [isSpectator, gameMode, history, userProfile, opponentProfile, playerRole, t, aiPlayer]);

useEffect(() => { if (winner && gameState === 'post-game') handleGameEnd(winner); }, [winner, gameState, handleGameEnd]);

useEffect(() => { const fetchUserProfile = async () => { if (!user) return; const { data, error } = await supabase.from('profiles').select('id, username, elo_rating, is_supporter, nickname_color, badge_color').eq('id', user.id).single(); if (error) console.error('Error fetching user profile:', error); else setUserProfile(data); };
    fetchUserProfile(); }, [user]);

useEffect(() => { aiWorkerRef.current = new Worker('/ai.worker.js', { type: 'module' }); aiWorkerRef.current.onmessage = (e) => { const { row, col } = e.data; if (row !== -1 &&
    col !== -1) handleStonePlacement(row, col); }; return () => aiWorkerRef.current?.terminate(); }, [handleStonePlacement]);

useEffect(() => { const fetchAiKnowledge = async () => { const { data, error } = await supabase.from('ai_knowledge').select('*'); if (error) console.error('Error fetching AI knowledge:', error); else { const knowledgeMap = new Map(data.map(item => [item.pattern_hash, { wins: item.wins, losses: item.losses }])); setAiKnowledge(knowledgeMap); } };
    fetchAiKnowledge(); }, []);

useEffect(() => { if (gameMode === 'pva' && currentPlayer === aiPlayer && !winner && gameState === 'playing') aiWorkerRef.current?.postMessage({ board, player: currentPlayer,
    knowledge: aiKnowledge }); }, [currentPlayer, gameMode, winner, board, aiKnowledge, aiPlayer, gameState]);
    useEffect(() => {
    if (isReplaying && gameState === 'replay') {
        replayIntervalRef.current = window.setInterval(() => {
            setReplayMoveIndex(prev => {
                if (prev < history.length - 1) {
                    return prev + 1;
                }
                setIsReplaying(false);
                return prev;
            });
        }, 1000);
    } else {
        if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    }
    return () => {
        if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    };
}, [isReplaying, gameState, history.length]);

useEffect(() => {
    if (gameMode !== 'pvo' && !spectateRoomId) return;
    if (!userProfileRef.current) return;
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl);
    socketRef.current = socket;
    socket.on('connect', () => { if (user) socket.emit('authenticate', user.id); if (spectateRoomId) socket.emit('join-private-room', spectateRoomId, userProfileRef.current); });
    socket.on('assign-role', (role) => setPlayerRole(role));
    socket.on('game-start', ({ roomId }) => { setRoom(roomId); setGameState('playing'); toast.success(t('GameStarted')); if (userProfileRef.current) socket.emit('share-profile', {
        room: roomId, profile: userProfileRef.current }); });
    socket.on('joined-as-spectator', () => { setIsSpectator(true); setGameState('playing'); toast(t('NowSpectating')); });
    socket.on('opponent-profile', (profile) => setOpponentProfile(profile));
    socket.on('game-state-update', ({ move, newPlayer }) => { setBoard(prevBoard => { const newBoard = prevBoard.map(r => [...r]); newBoard[move.row][move.col] = newPlayer ===
        'black' ? 'white' : 'black'; return newBoard; }); setCurrentPlayer(newPlayer); });
    socket.on('game-over-update', ({ winner: winnerName }) => { setWinner(winnerName); setGameState('post-game'); });
    socket.on('new-game-starting', () => { toast.success(t('RematchStarting')); internalReset(); });
    socket.on('room-full-or-invalid', () => toast.error(t('RoomFullOrInvalid')));
    socket.on('opponent-disconnected', () => { toast.error(t('OpponentDisconnected')); resetGame(gameMode); });
    const handleNewEmoticon = (data: EmoticonMessage) => { const newEmoticon = { ...data, id: Date.now() }; setEmoticons(current => [...current, newEmoticon]); setTimeout(() => {
        setEmoticons(current => current.filter(e => e.id !== newEmoticon.id)); }, 4000); };
    socket.on('new-emoticon', handleNewEmoticon);
    return () => { socket.off('new-emoticon', handleNewEmoticon); socket.disconnect(); };
}, [gameMode, user, spectateRoomId, t]);

const resetGame = (mode: GameMode) => {
    setGameMode(mode);
    internalReset();
};
const handleBoardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (winner || isSpectator || (gameState !== 'playing' && !whatIfState)) return;
    if (gameMode === 'pva' && currentPlayer === aiPlayer) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const gridWidth = event.currentTarget.clientWidth;
    const gridHeight = event.currentTarget.clientHeight;
    const style = window.getComputedStyle(event.currentTarget);
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingTop = parseFloat(style.paddingTop);

    const x = event.clientX - rect.left - paddingLeft;
    const y = event.clientY - rect.top - paddingTop;

    if (x < 0 || x > gridWidth || y < 0 || y > gridHeight) {
        return;
    }

    const row = Math.round((y / gridHeight) * (BOARD_SIZE - 1));
    const col = Math.round((x / gridWidth) * (BOARD_SIZE - 1));

    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
        handleStonePlacement(row, col);
    }
};
const handleSendEmoticon = (emoticon: string) => { socketRef.current?.emit('send-emoticon', { room, emoticon }); };
const handleWhatIf = () => { if (history.length === 0) { toast.error(t('NoMovesToAnalyze')); return; } if (replayGame?.game_type !== 'pva') { toast.error(t('WhatIfPvaOnly'));
    return; } setIsReplaying(false); const currentReplayBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)); for (let i = 0; i <= replayMoveIndex; i++) {
    currentReplayBoard[history[i].row][history[i].col] = history[i].player; } const nextPlayer = history[replayMoveIndex + 1]?.player || (history[replayMoveIndex].player === 'black' ?
    'white' : 'black'); setWhatIfState({ board: currentReplayBoard, player: nextPlayer }); toast.success(t('WhatIfActivated')); };
const exitWhatIf = () => setWhatIfState(null);
const isWinningStone = (row: number, col: number) => {
    return winningLine?.some(stone => stone.row === row && stone.col === col) || false;
}
const isLastMove = (row: number, col: number) => {
    if (history.length === 0) return false;
    const lastMove = history[history.length - 1];
    return lastMove.row === row && lastMove.col === col;
}

const replayBoard = gameState === 'replay' ? Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)) : null;
if (replayBoard) {
    for (let i = 0; i <= replayMoveIndex; i++) {
        if(history[i]) replayBoard[history[i].row][history[i].col] = history[i].player;
    }
}

const currentBoard = whatIfState ? whatIfState.board : (replayBoard || board);

const aiProfile: Profile | null = gameMode === 'pva' ? { id: 'ai', username: 'Gomoku AI', elo_rating: 1500, is_supporter: true, nickname_color: null, badge_color: null } : null;

let winnerProfile: Profile | null = null;
if (winner) {
    if (gameMode === 'pvo') {
        winnerProfile = winner === playerRole ? userProfile : opponentProfile;
    } else if (gameMode === 'pva') {
        winnerProfile = winner === aiPlayer ? aiProfile : userProfile;
    } else { // pvp
        const winnerName = winner.charAt(0).toUpperCase() + winner.slice(1);
        winnerProfile = {
            id: winner,
            username: winnerName,
            elo_rating: 0,
            is_supporter: false,
            nickname_color: null,
            badge_color: null
        };
    }
}

const p1Profile = gameMode === 'pvo' ? (playerRole === 'black' ? userProfile : opponentProfile) : (gameMode === 'pva' ? (aiPlayer === 'white' ? userProfile : aiProfile) :
    userProfile);
const p2Profile = gameMode === 'pvo' ? (playerRole === 'white' ? userProfile : opponentProfile) : (gameMode === 'pva' ? (aiPlayer === 'black' ? userProfile : aiProfile) :
    opponentProfile);

const p1LastEmoticon = p1Profile ? emoticons.find(e => e.fromId === p1Profile.id) : undefined;
const p2LastEmoticon = p2Profile ? emoticons.find(e => e.fromId === p2Profile.id) : undefined;
return (
    <div className="flex flex-col items-center w-full relative p-6">
        <div className="absolute top-0 left-0">
            <button onClick={onExit} className="text-gray-400 hover:text-gray-200 p-4 transition-colors">
                {t('Back')}
            </button>
        </div>

        {gameMode === 'pvo' && !room && !spectateRoomId && <OnlineMultiplayerMenu setGameMode={setGameMode} socketRef={socketRef} userProfile={userProfile} />}

        <div className="flex w-full max-w-4xl justify-around items-center mb-8">
            <PlayerDisplay profile={p1Profile} lastEmoticon={p1LastEmoticon} />
            <span className="text-2xl font-bold text-white">VS</span>
            <PlayerDisplay profile={p2Profile} lastEmoticon={p2LastEmoticon} />
        </div>

        {(gameMode !== 'pvo' || room) && (
            <div className="relative" style={{ width: '64vmin', height: '64vmin' }}>
                {/* The frame with a wooden color */}
                <div className="p-4 bg-[#d2b48c] rounded-md shadow-lg w-full h-full">
                    {/* The interactive grid area */}
                    <div 
                        onClick={handleBoardClick} 
                        className={`goboard bg-[#c19a6b] relative w-full h-full rounded-sm ${isSpectator || (gameMode === 'pva' && currentPlayer === aiPlayer) || (gameState !== 'playing' && !whatIfState) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        {/* Lines are drawn on a transparent overlay inside the grid */}
                        <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ padding: `calc(100% / (${BOARD_SIZE} - 1) / 2)` }}>
                            {Array.from({length: BOARD_SIZE}).map((_, i) => <div key={`v-${i}`} className="goboard-line absolute" style={{left: `${(i / (BOARD_SIZE - 1)) * 100}%`, top: 0, width: '1px', height: '100%'}}></div>)}
                            {Array.from({length: BOARD_SIZE}).map((_, i) => <div key={`h-${i}`} className="goboard-line absolute" style={{top: `${(i / (BOARD_SIZE - 1)) * 100}%`, left: 0, height: '1px', width: '100%'}}></div>)}
                        </div>
                        {/* Stones are drawn on another transparent overlay inside the grid */}
                        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                            {currentBoard.map((row, r_idx) => row.map((cell, c_idx) => {
                                if (cell) {
                                    const stoneSize = `calc(100% / ${BOARD_SIZE} * 0.9)`;
                                    const isWinStone = isWinningStone(r_idx, c_idx);
                                    const isLast = isLastMove(r_idx, c_idx);
                                    const stoneClasses = `absolute rounded-full stone-shadow ${isWinStone ? 'animate-chroma-shine' : ''} ${isWinStone && isLast ? 'animate-pulse-throb' : ''} ${!isWinStone && isLast ? 'animate-slime-in' : ''}`;
                                    return <div key={`${r_idx}-${c_idx}`} className={stoneClasses} style={{
                                        top: `calc(${(r_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                        left: `calc(${(c_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                        width: stoneSize,
                                        height: stoneSize,
                                        backgroundColor: cell,
                                        border: '1px solid gray'
                                    }}></div>;
                                }
                                return null;
                            }))}
                        </div>
                    </div>
                </div>
                {/* The overlay is now a sibling to the frame, and will cover the whole 64vmin area */}
                {winnerProfile &&
                    <GameEndModal winnerProfile={winnerProfile} duration={gameDuration}>
                        <PostGameManager isPlayer={!isSpectator} isSpectator={isSpectator} onExit={onExit} gameMode={gameMode} room={room} socketRef={socketRef} />
                    </GameEndModal>
                }
            </div>
        )}

        {gameState === 'playing' && !isSpectator && !replayGame && (
            <div className="mt-4">
                <EmoticonPicker onSelect={handleSendEmoticon} />
            </div>
        )}

        {gameState === 'replay' && (
            <ReplayControls
                moveCount={history.length}
                currentMove={replayMoveIndex}
                setCurrentMove={setReplayMoveIndex}
                isPlaying={isReplaying}
                setIsPlaying={setIsReplaying}
                onWhatIf={replayGame?.game_type === 'pva' ? handleWhatIf : undefined}
            />
        )}
        {whatIfState && <button onClick={exitWhatIf} className="mt-2 px-4 py-2 bg-red-500 text-white rounded">{t('ExitWhatIf')}</button>}
    </div>
);
};

export default Board;