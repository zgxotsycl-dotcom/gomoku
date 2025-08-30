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
export type Profile = { id: string; username: string; elo_rating: number; is_supporter: boolean; };
export type Game = { id: number; moves: { player: Player, row: number, col: number }[]; game_type: GameMode; };
export type EmoticonMessage = { id: number; fromId: string; emoticon: string };

// --- Helper Functions ---
const checkWin = (board: (Player | null)[][], player: Player, row: number, col: number): boolean => {
  const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }];
  for (const dir of directions) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const newRow = row + i * dir.y; const newCol = col + i * dir.x;
      if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE || board[newRow][newCol] !== player) break;
      count++;
    }
    for (let i = 1; i < 5; i++) {
      const newRow = row - i * dir.y; const newCol = col - i * dir.x;
      if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE || board[newRow][newCol] !== player) break;
      count++;
    }
    if (count >= 5) return true;
  }
  return false;
};

const calculateElo = (playerRating: number, opponentRating: number, score: 1 | 0 | 0.5) => {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(playerRating + K_FACTOR * (score - expectedScore));
};

// --- Sub-components ---
interface PostGameManagerProps { isPlayer: boolean; isSpectator: boolean; resetGame: (mode: GameMode) => void; gameMode: GameMode; room: string; socketRef: React.MutableRefObject<Socket | null>; }
const PostGameManager = ({ isPlayer, isSpectator, resetGame, gameMode, room, socketRef }: PostGameManagerProps) => {
    const { t } = useTranslation();
    const [showSpectatorPopup, setShowSpectatorPopup] = useState(true);
    const handleRematch = () => { toast.success(t('PostGameManager.votedForRematch')); socketRef.current?.emit('rematch-vote', room); };
    const handleLeave = () => resetGame(gameMode);
    const handleJoin = () => { toast.success(t('PostGameManager.requestingToJoin')); socketRef.current?.emit('request-to-join', room); };
    if (isPlayer) {
        return (
            <div className="mt-4 flex gap-4">
                <button onClick={handleRematch} className="px-4 py-2 bg-blue-500 text-white rounded">{t('PostGameManager.playAgain')}</button>
                <button onClick={handleLeave} className="px-4 py-2 bg-gray-500 text-white rounded">{t('PostGameManager.leave')}</button>
            </div>
        );
    }
    if (isSpectator && showSpectatorPopup) {
        return (
            <div className="absolute bottom-4 right-4 bg-gray-700 p-3 rounded-lg shadow-lg flex flex-col gap-2">
                <p className="text-white text-sm">{t('PostGameManager.gameHasEnded')}</p>
                <button onClick={handleJoin} className="px-3 py-1 bg-green-500 text-white rounded text-sm">{t('PostGameManager.joinNextGame')}</button>
                <button onClick={() => setShowSpectatorPopup(false)} className="px-3 py-1 bg-gray-500 text-white rounded text-sm">{t('PostGameManager.keepSpectating')}</button>
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
    const handlePublicMatch = () => { socketRef.current?.emit('join-public-queue', userProfile); toast.success(t('OnlineMenu.searchingForPublicMatch')); };
    const handleCreatePrivate = () => socketRef.current?.emit('create-private-room', userProfile);
    const handleJoinPrivate = () => { if (roomInput) socketRef.current?.emit('join-private-room', roomInput, userProfile); };
    if (mode === 'private') {
        return (
            <div className="flex flex-col gap-2 mb-4 p-4 bg-gray-600 rounded-lg">
                <div className="flex gap-2">
                    <input type="text" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} placeholder={t('OnlineMenu.enterRoomCode')} className="px-2 py-1 rounded text-black" />
                    <button onClick={handleJoinPrivate} className="px-4 py-1 bg-yellow-500 text-black rounded">{t('OnlineMenu.join')}</button>
                </div>
                <button onClick={() => setMode('select')} className="text-sm text-gray-300 hover:underline">{t('OnlineMenu.back')}</button>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-4 mb-4 p-4 bg-gray-600 rounded-lg">
            <button onClick={handlePublicMatch} className="px-4 py-2 bg-indigo-500 text-white rounded">{t('OnlineMenu.startPublicMatch')}</button>
            <button onClick={handleCreatePrivate} className="px-4 py-2 bg-teal-500 text-white rounded">{t('OnlineMenu.createPrivateRoom')}</button>
            <button onClick={() => setMode('private')} className="px-4 py-2 bg-gray-500 text-white rounded">{t('OnlineMenu.joinPrivateRoom')}</button>
            <button onClick={() => setGameMode('pvp')} className="text-sm text-gray-300 hover:underline mt-2">{t('OnlineMenu.cancel')}</button>
        </div>
    );
};

interface ReplayControlsProps { moveCount: number; currentMove: number; setCurrentMove: Dispatch<SetStateAction<number>>; isPlaying: boolean; setIsPlaying: Dispatch<SetStateAction<boolean>>; onWhatIf?: () => void; }
const ReplayControls = ({ moveCount, currentMove, setCurrentMove, isPlaying, setIsPlaying, onWhatIf }: ReplayControlsProps) => {
    const { t } = useTranslation();
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => setCurrentMove(Number(e.target.value));
    return (
        <div className="w-full max-w-lg mt-4 p-3 bg-gray-700 rounded-lg flex items-center gap-4 text-white">
            <button onClick={() => setCurrentMove(0)} title={t('ReplayControls.first')}>|«</button>
            <button onClick={() => setCurrentMove(p => Math.max(0, p - 1))} title={t('ReplayControls.previous')}>‹</button>
            <button onClick={() => setIsPlaying(p => !p)} className="w-20 px-2 py-1 bg-blue-600 rounded">{isPlaying ? t('ReplayControls.pause') : t('ReplayControls.play')}</button>
            <button onClick={() => setCurrentMove(p => Math.min(moveCount - 1, p + 1))} title={t('ReplayControls.next')}>›</button>
            <button onClick={() => setCurrentMove(moveCount - 1)} title={t('ReplayControls.last')}>»|</button>
            <input type="range" min="0" max={moveCount > 0 ? moveCount - 1 : 0} value={currentMove} onChange={handleSliderChange} className="w-full" />
            {onWhatIf && <button onClick={onWhatIf} className="px-3 py-1 bg-teal-500 rounded text-sm">{t('ReplayControls.whatIf')}</button>}
        </div>
    );
};

interface PlayerDisplayProps { profile: Profile | null; lastEmoticon: EmoticonMessage | undefined; }
const PlayerDisplay = ({ profile, lastEmoticon }: PlayerDisplayProps) => {
    if (!profile) return <div className="w-48 h-16 bg-gray-700 rounded-lg animate-pulse" />;
    return (
        <div className="relative w-48 p-3 bg-gray-700 rounded-lg text-white text-center">
            <p className="font-bold truncate">{profile.username}</p>
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

interface BoardProps { spectateRoomId?: string | null; replayGame?: Game | null; }
const Board = ({ spectateRoomId = null, replayGame = null }: BoardProps) => {
  const { t } = useTranslation();
  const [board, setBoard] = useState<Array<Array<Player | null>>>(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('black');
  const [winner, setWinner] = useState<Player | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>(spectateRoomId ? 'pvo' : (replayGame ? replayGame.game_type : 'pvp'));
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

  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const aiWorkerRef = useRef<Worker | null>(null);
  const replayIntervalRef = useRef<number | null>(null);
  const userProfileRef = useRef(userProfile);
  userProfileRef.current = userProfile;

  const handleStonePlacement = useCallback((row: number, col: number, isAI: boolean = false) => {
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
    if (gameMode === 'pvo' && currentPlayer !== playerRole) { toast.error(t('Board.toast.notYourTurn')); return; }

    const newPlayer = currentPlayer === 'black' ? 'white' : 'black';
    if (gameMode === 'pvo') socketRef.current?.emit('player-move', { room, move: { row, col }, newPlayer });

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    setHistory(h => [...h, { player: currentPlayer, row, col }]);

    if (checkWin(newBoard, currentPlayer, row, col)) {
      setWinner(currentPlayer);
      if (gameMode === 'pvo') socketRef.current?.emit('game-over', { roomId: room, winner: currentPlayer });
    } else {
      setCurrentPlayer(newPlayer);
    }
  }, [board, currentPlayer, gameState, gameMode, isSpectator, playerRole, room, winner, whatIfState, aiKnowledge, t]);

  const handleGameEnd = useCallback(async (gameWinner: Player) => {
    if (isSpectator) return;
    let gameData: any = { game_type: gameMode, winner_player: gameWinner, moves: history };
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
    if (gameSaveError || !savedGame) { toast.error(t('Board.toast.failedToSaveGame')); return; }
    else { 
      toast.success(t('Board.toast.gameResultsSaved'));
      if (userProfile?.is_supporter) await supabase.rpc('add_replay_and_prune', { user_id_in: userProfile.id, game_id_in: savedGame.id });
      if (opponentProfile?.is_supporter) await supabase.rpc('add_replay_and_prune', { user_id_in: opponentProfile.id, game_id_in: savedGame.id });
    }
    if (gameMode === 'pvo' && userProfile && opponentProfile) {
      const didIWin = playerRole === gameWinner;
      const myNewElo = calculateElo(userProfile.elo_rating ?? 1500, opponentProfile.elo_rating ?? 1500, didIWin ? 1 : 0);
      const opponentNewElo = calculateElo(opponentProfile.elo_rating ?? 1500, userProfile.elo_rating ?? 1500, didIWin ? 0 : 1);
      toast.success(`${t('Board.toast.yourNewElo')}: ${myNewElo} (${myNewElo - userProfile.elo_rating >= 0 ? '+' : ''}${myNewElo - userProfile.elo_rating})`);
      await supabase.rpc('update_elo', { winner_id: didIWin ? userProfile.id : opponentProfile.id, loser_id: didIWin ? opponentProfile.id : userProfile.id, winner_new_elo: didIWin ? myNewElo : opponentNewElo, loser_new_elo: didIWin ? opponentNewElo : myNewElo });
      setUserProfile(p => p ? { ...p, elo_rating: myNewElo } : null);
      setOpponentProfile(p => p ? { ...p, elo_rating: opponentNewElo } : null);
    }
  }, [isSpectator, gameMode, history, userProfile, opponentProfile, playerRole, t, aiPlayer]);

  useEffect(() => { if (winner && gameState !== 'replay') handleGameEnd(winner); }, [winner, gameState, handleGameEnd]);

  useEffect(() => { const fetchUserProfile = async () => { if (!user) return; const { data, error } = await supabase.from('profiles').select('id, username, elo_rating, is_supporter').eq('id', user.id).single(); if (error) console.error('Error fetching user profile:', error); else setUserProfile(data); }; fetchUserProfile(); }, [user]);

  useEffect(() => { aiWorkerRef.current = new Worker('/ai.worker.js'); aiWorkerRef.current.onmessage = (e) => { const { row, col } = e.data; if (row !== -1 && col !== -1) handleStonePlacement(row, col, true); }; return () => aiWorkerRef.current?.terminate(); }, [handleStonePlacement]);

  useEffect(() => { const fetchAiKnowledge = async () => { const { data, error } = await supabase.from('ai_knowledge').select('*'); if (error) console.error('Error fetching AI knowledge:', error); else { const knowledgeMap = new Map(data.map(item => [item.pattern_hash, { wins: item.wins, losses: item.losses }])); setAiKnowledge(knowledgeMap); } }; fetchAiKnowledge(); }, []);

  useEffect(() => { if (gameMode === 'pva' && currentPlayer === aiPlayer && !winner && aiKnowledge) aiWorkerRef.current?.postMessage({ board, player: currentPlayer, knowledge: aiKnowledge }); }, [currentPlayer, gameMode, winner, board, aiKnowledge, aiPlayer]);

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
    socket.on('game-start', ({ roomId }) => { setRoom(roomId); setGameState('playing'); toast.success(t('Board.toast.gameStarted')); if (userProfileRef.current) socket.emit('share-profile', { room: roomId, profile: userProfileRef.current }); });
    socket.on('joined-as-spectator', () => { setIsSpectator(true); setGameState('playing'); toast.info(t('Board.toast.nowSpectating')); });
    socket.on('opponent-profile', (profile) => setOpponentProfile(profile));
    socket.on('game-state-update', ({ move, newPlayer }) => { setBoard(prevBoard => { const newBoard = prevBoard.map(r => [...r]); newBoard[move.row][move.col] = newPlayer === 'black' ? 'white' : 'black'; return newBoard; }); setCurrentPlayer(newPlayer); });
    socket.on('game-over-update', ({ winner: winnerName }) => { setWinner(winnerName); setGameState('post-game'); });
    socket.on('new-game-starting', () => { toast.success(t('Board.toast.rematchStarting')); internalReset(); });
    socket.on('room-full-or-invalid', () => toast.error(t('Board.toast.roomFullOrInvalid')));
    socket.on('opponent-disconnected', () => { toast.error(t('Board.toast.opponentDisconnected')); resetGame(gameMode); });
    const handleNewEmoticon = (data: EmoticonMessage) => { const newEmoticon = { ...data, id: Date.now() }; setEmoticons(current => [...current, newEmoticon]); setTimeout(() => { setEmoticons(current => current.filter(e => e.id !== newEmoticon.id)); }, 4000); };
    socket.on('new-emoticon', handleNewEmoticon);
    return () => { socket.off('new-emoticon', handleNewEmoticon); socket.disconnect(); };
  }, [gameMode, user, spectateRoomId, t]);

  const internalReset = () => { setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))); setCurrentPlayer('black'); setWinner(null); setHistory([]); setGameState('playing'); setWhatIfState(null); };
  const resetGame = (mode: GameMode) => { internalReset(); setGameMode(mode); setRoom(spectateRoomId || ''); setPlayerRole(null); setOpponentProfile(null); setIsSpectator(!!spectateRoomId); };
  const handleBoardClick = (event: React.MouseEvent<HTMLDivElement>) => { if (winner || isSpectator || (gameState !== 'playing' && !whatIfState)) return; if (gameMode === 'pva' && currentPlayer === aiPlayer) return; const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top; const row = Math.round((y / rect.height) * (BOARD_SIZE - 1)); const col = Math.round((x / rect.width) * (BOARD_SIZE - 1)); if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) handleStonePlacement(row, col); };
  const handleSendEmoticon = (emoticon: string) => { socketRef.current?.emit('send-emoticon', { room, emoticon }); };
  const handleWhatIf = () => { if (history.length === 0) { toast.error(t('Board.toast.noMovesToAnalyze')); return; } if (replayGame?.game_type !== 'pva') { toast.error(t('Board.toast.whatIfPvaOnly')); return; } setIsReplaying(false); const currentReplayBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)); for (let i = 0; i <= replayMoveIndex; i++) { currentReplayBoard[history[i].row][history[i].col] = history[i].player; } const nextPlayer = history[replayMoveIndex + 1]?.player || (history[replayMoveIndex].player === 'black' ? 'white' : 'black'); setWhatIfState({ board: currentReplayBoard, player: nextPlayer }); toast.success(t('Board.toast.whatIfActivated')); };
  const exitWhatIf = () => setWhatIfState(null);

  const replayBoard = gameState === 'replay' ? Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)) : null;
  if (replayBoard) {
    for (let i = 0; i < replayMoveIndex; i++) {
        if(history[i]) replayBoard[history[i].row][history[i].col] = history[i].player;
    }
  }

  const currentBoard = whatIfState ? whatIfState.board : (replayBoard || board);
  
  const aiProfile: Profile | null = gameMode === 'pva' ? { id: 'ai', username: 'Gomoku AI', elo_rating: 1500, is_supporter: true } : null;

  const p1Profile = gameMode === 'pvo' ? (playerRole === 'black' ? userProfile : opponentProfile) : (gameMode === 'pva' ? (aiPlayer === 'white' ? userProfile : aiProfile) : userProfile);
  const p2Profile = gameMode === 'pvo' ? (playerRole === 'white' ? userProfile : opponentProfile) : (gameMode === 'pva' ? (aiPlayer === 'black' ? userProfile : aiProfile) : opponentProfile);

  const p1LastEmoticon = p1Profile ? emoticons.find(e => e.fromId === p1Profile.id) : undefined;
  const p2LastEmoticon = p2Profile ? emoticons.find(e => e.fromId === p2Profile.id) : undefined;

  return (
    <div className="flex flex-col items-center">
      {gameState !== 'replay' && (
        <div className="mb-4 flex gap-4">
            <button onClick={() => resetGame('pvp')} className={`px-4 py-2 text-white rounded ${gameMode === 'pvp' ? 'bg-blue-600' : 'bg-blue-400'}`}>{t('Board.gameModes.pvp')}</button>
            <button onClick={() => resetGame('pva')} className={`px-4 py-2 text-white rounded ${gameMode === 'pva' ? 'bg-green-600' : 'bg-green-400'}`}>{t('Board.gameModes.pva')}</button>
            <button onClick={() => resetGame('pvo')} className={`px-4 py-2 text-white rounded ${gameMode === 'pvo' ? 'bg-purple-600' : 'bg-purple-400'}`}>{t('Board.gameModes.pvo')}</button>
        </div>
      )}

      {gameMode === 'pvo' && !room && !spectateRoomId && <OnlineMultiplayerMenu setGameMode={setGameMode} socketRef={socketRef} userProfile={userProfile} />}

      <div className="flex w-full max-w-4xl justify-around items-center mb-4">
          <PlayerDisplay profile={p1Profile} lastEmoticon={p1LastEmoticon} />
          <span className="text-2xl font-bold text-white">VS</span>
          <PlayerDisplay profile={p2Profile} lastEmoticon={p2LastEmoticon} />
      </div>

      {(gameMode !== 'pvo' || room) && (
        <div onClick={handleBoardClick} className={`bg-yellow-800 p-2 shadow-lg relative rounded-md ${isSpectator || (gameMode === 'pva' && currentPlayer === aiPlayer) || (gameState !== 'playing' && !whatIfState) ? 'cursor-not-allowed' : 'cursor-pointer'}`} style={{ width: '64vmin', height: '64vmin' }}>
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ padding: 'calc(100% / (BOARD_SIZE - 1) / 2)' }}>
              {Array.from({length: BOARD_SIZE}).map((_, i) => <div key={`v-${i}`} className="absolute bg-black" style={{left: `${(i / (BOARD_SIZE - 1)) * 100}%`, top: 0, width: '1px', height: '100%'}}></div>)}
              {Array.from({length: BOARD_SIZE}).map((_, i) => <div key={`h-${i}`} className="absolute bg-black" style={{top: `${(i / (BOARD_SIZE - 1)) * 100}%`, left: 0, height: '1px', width: '100%'}}></div>)}
          </div>
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {currentBoard.map((row, r_idx) => row.map((cell, c_idx) => {
              if (cell) {
                const stoneSize = `calc(100% / ${BOARD_SIZE} * 0.9)`;
                return <div key={`${r_idx}-${c_idx}`} className={`absolute rounded-full shadow-md`} style={{ 
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
      )}

      {gameState === 'playing' && !isSpectator && !replayGame && (
        <div className="mt-4">
            <EmoticonPicker onSelect={handleSendEmoticon} />
        </div>
      )}

      {winner && gameState !== 'replay' && <div className="mt-4 text-2xl font-bold text-white">{t('Board.winnerMessage', { winner: winner.charAt(0).toUpperCase() + winner.slice(1) })}</div>}
      {gameState === 'post-game' && <PostGameManager isPlayer={!isSpectator} isSpectator={isSpectator} resetGame={resetGame} gameMode={gameMode} room={room} socketRef={socketRef} />}
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
      {whatIfState && <button onClick={exitWhatIf} className="mt-2 px-4 py-2 bg-red-500 text-white rounded">{t('Board.exitWhatIf')}</button>}
    </div>
  );
};

export default Board;