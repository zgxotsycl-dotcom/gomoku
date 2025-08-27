'use client';

import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { Player } from '@/lib/ai';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import io, { Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import PostGameManager from './PostGameManager';
import OnlineMultiplayerMenu from './OnlineMultiplayerMenu';
import ReplayControls from './ReplayControls';
import PlayerDisplay from './PlayerDisplay';
import EmoticonPicker from './EmoticonPicker';

// Type definitions are now exported so other components can use them
export type GameMode = 'pvp' | 'pva' | 'pvo';
export type GameState = 'waiting' | 'playing' | 'post-game' | 'replay';
export type Profile = { id: string; username: string; elo_rating: number; is_supporter: boolean; nickname_color: string | null; badge_color: string | null; };
export type Game = { id: number; moves: { player: Player, row: number, col: number }[]; game_type: GameMode; };
export type EmoticonMessage = { id: number; fromId: string; emoticon: string };

interface BoardProps {
  initialGameMode: GameMode;
  spectateRoomId?: string | null;
  replayGame?: Game | null;
}

const BOARD_SIZE = 19;
const K_FACTOR = 32;

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

const Board = ({ initialGameMode, spectateRoomId = null, replayGame = null }: BoardProps) => {
  const { t } = useTranslation();
  const [board, setBoard] = useState<Array<Array<Player | null>>>(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('black');
  const [winner, setWinner] = useState<Player | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>(spectateRoomId ? 'pvo' : (replayGame ? replayGame.game_type : initialGameMode));
  const [gameState, setGameState] = useState<GameState>(replayGame ? 'replay' : 'waiting');
  const [room, setRoom] = useState(spectateRoomId || '');
  const [playerRole, setPlayerRole] = useState<Player | null>(null);
  const [isSpectator, setIsSpectator] = useState(!!spectateRoomId);
  const [history, setHistory] = useState(replayGame ? replayGame.moves : []);
  const { user, profile: userProfile } = useAuth();
  const [opponentProfile, setOpponentProfile] = useState<Profile | null>(null);
  const [emoticons, setEmoticons] = useState<EmoticonMessage[]>([]);
  const [replayMoveIndex, setReplayMoveIndex] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [whatIfState, setWhatIfState] = useState<{board: (Player | null)[][], player: Player} | null>(null);
  const [aiKnowledge, setAiKnowledge] = useState<Map<string, { wins: number, losses: number }> | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const aiWorkerRef = useRef<Worker | null>(null);
  const replayIntervalRef = useRef<number | null>(null);

  const handleStonePlacement = useCallback((row: number, col: number, isAI: boolean = false) => {
    if (whatIfState) {
        const board = whatIfState.board;
        if (board[row][col]) return;
        const newBoard = board.map(r => [...r]);
        newBoard[row][col] = whatIfState.player;
        setWhatIfState({ board: newBoard, player: whatIfState.player === 'black' ? 'white' : 'black' });
        aiWorkerRef.current?.postMessage({ board: newBoard, player: 'white', knowledge: null });
        return;
    }
    if (board[row][col] || winner || isSpectator || gameState !== 'playing') return;
    if (gameMode === 'pvo' && currentPlayer !== playerRole) { toast.error(t('NotYourTurn')); return; }
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
  }, [board, currentPlayer, gameState, gameMode, history, isSpectator, playerRole, room, winner, whatIfState, t]);

  const handleGameEnd = useCallback(async (gameWinner: Player) => {
    if (isSpectator) return;
    let gameData: any = { game_type: gameMode, winner_player: gameWinner, moves: history };
    if (gameMode === 'pvo' && userProfile && opponentProfile) {
      gameData.player_black_id = playerRole === 'black' ? userProfile.id : opponentProfile.id;
      gameData.player_white_id = playerRole === 'white' ? userProfile.id : opponentProfile.id;
    } else if (gameMode === 'pva' && userProfile) {
      gameData.player_black_id = userProfile.id;
      gameData.player_white_id = null;
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
      const myNewElo = calculateElo(userProfile.elo_rating, opponentProfile.elo_rating, didIWin ? 1 : 0);
      const opponentNewElo = calculateElo(opponentProfile.elo_rating, userProfile.elo_rating, didIWin ? 0 : 1);
      toast.success(`${t('YourNewElo')}: ${myNewElo} (${myNewElo - userProfile.elo_rating >= 0 ? '+' : ''}${myNewElo - userProfile.elo_rating})`);
      await supabase.rpc('update_elo', { winner_id: didIWin ? userProfile.id : opponentProfile.id, loser_id: didIWin ? opponentProfile.id : userProfile.id, winner_new_elo: didIWin ? myNewElo : opponentNewElo, loser_new_elo: didIWin ? opponentNewElo : myNewElo });
    }
  }, [isSpectator, gameMode, history, userProfile, opponentProfile, playerRole, t]);

  useEffect(() => { if (winner && gameState !== 'replay') { handleGameEnd(winner); } }, [winner, gameState, handleGameEnd]);
  useEffect(() => { aiWorkerRef.current = new Worker('/ai.worker.js'); aiWorkerRef.current.onmessage = (e) => { const { row, col } = e.data; if (row !== -1 && col !== -1) handleStonePlacement(row, col, true); }; return () => aiWorkerRef.current?.terminate(); }, [handleStonePlacement]);
  useEffect(() => { const fetchAiKnowledge = async () => { const { data, error } = await supabase.from('ai_knowledge').select('*'); if (error) console.error('Error fetching AI knowledge:', error); else { const knowledgeMap = new Map(data.map(item => [item.pattern_hash, { wins: item.wins, losses: item.losses }])); setAiKnowledge(knowledgeMap); } }; fetchAiKnowledge(); }, []);
  useEffect(() => { if (gameMode === 'pva' && currentPlayer === 'white' && !winner) { aiWorkerRef.current?.postMessage({ board, player: 'white', knowledge: aiKnowledge }); } }, [currentPlayer, gameMode, winner, board, aiKnowledge]);
  useEffect(() => {
    if (gameMode !== 'pvo' && !spectateRoomId) return;
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl);
    socketRef.current = socket;
    socket.on('connect', () => { if (user) socket.emit('authenticate', user.id); if (spectateRoomId) socket.emit('join-private-room', spectateRoomId, userProfile); });
    socket.on('assign-role', (role) => setPlayerRole(role));
    socket.on('game-start', ({ roomId }) => { setRoom(roomId); setGameState('playing'); toast.success(t('GameStarted')); if (userProfile) socket.emit('share-profile', { room: roomId, profile: userProfile }); });
    socket.on('joined-as-spectator', () => { setIsSpectator(true); setGameState('playing'); toast.info(t('NowSpectating')); });
    socket.on('opponent-profile', (profile) => setOpponentProfile(profile));
    socket.on('game-state-update', ({ move, newPlayer }) => { setBoard(prevBoard => { const newBoard = prevBoard.map(r => [...r]); newBoard[move.row][move.col] = currentPlayer; return newBoard; }); setCurrentPlayer(newPlayer); });
    socket.on('game-over-update', ({ winner: winnerName }) => { setWinner(winnerName); setGameState('post-game'); });
    socket.on('new-game-starting', () => { toast.success(t('RematchStarting')); internalReset(); });
    socket.on('room-full-or-invalid', () => toast.error(t('RoomFullOrInvalid')));
    socket.on('opponent-disconnected', () => { toast.error(t('OpponentDisconnected')); resetGame(gameMode); });
    const handleNewEmoticon = (data) => { const newEmoticon = { ...data, id: Date.now() }; setEmoticons(current => [...current, newEmoticon]); setTimeout(() => { setEmoticons(current => current.filter(e => e.id !== newEmoticon.id)); }, 4000); };
    socket.on('new-emoticon', handleNewEmoticon);
    return () => { socket.off('new-emoticon', handleNewEmoticon); socket.disconnect(); };
  }, [gameMode, user, userProfile, spectateRoomId, t]);

  const internalReset = () => { setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))); setCurrentPlayer('black'); setWinner(null); setHistory([]); setGameState('playing'); };
  const resetGame = (mode: GameMode) => { internalReset(); setGameMode(mode); setRoom(spectateRoomId || ''); setPlayerRole(null); setOpponentProfile(null); setIsSpectator(!!spectateRoomId); };
  const handleBoardClick = (event: React.MouseEvent<HTMLDivElement>) => { if (winner || isSpectator || (gameState !== 'playing' && !whatIfState)) return; if (gameMode === 'pva' && currentPlayer === 'white') return; const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top; const row = Math.round((y / rect.height) * (BOARD_SIZE - 1)); const col = Math.round((x / rect.width) * (BOARD_SIZE - 1)); if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) handleStonePlacement(row, col); };
  const handleSendEmoticon = (emoticon: string) => { socketRef.current?.emit('send-emoticon', { room, emoticon }); };
  const handleWhatIf = () => { if (replayGame?.game_type !== 'pva') { toast.error(t('WhatIfPvaOnly')); return; } setIsReplaying(false); const currentReplayBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)); for (let i = 0; i <= replayMoveIndex; i++) { currentReplayBoard[history[i].row][history[i].col] = history[i].player; } const nextPlayer = history[replayMoveIndex + 1]?.player || (history[replayMoveIndex].player === 'black' ? 'white' : 'black'); setWhatIfState({ board: currentReplayBoard, player: nextPlayer }); toast.success(t('WhatIfActivated')); };
  const exitWhatIf = () => setWhatIfState(null);

  const currentBoard = whatIfState ? whatIfState.board : board;
  const p1Profile = playerRole === 'black' ? userProfile : opponentProfile;
  const p2Profile = playerRole === 'white' ? userProfile : opponentProfile;
  const p1LastEmoticon = emoticons.find(e => e.fromId === p1Profile?.id);
  const p2LastEmoticon = emoticons.find(e => e.fromId === p2Profile?.id);

  return (
    <div className="flex flex-col items-center">
      {gameState !== 'replay' && (
        <div className="mb-4 flex gap-2 p-1 bg-gray-800/50 rounded-full border border-gray-700">
            <button onClick={() => resetGame('pvp')} className={`px-4 py-2 text-white rounded-full text-sm ${gameMode === 'pvp' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>{t('PvsPlayer')}</button>
            <button onClick={() => resetGame('pva')} className={`px-4 py-2 text-white rounded-full text-sm ${gameMode === 'pva' ? 'bg-green-600' : 'hover:bg-gray-700'}`}>{t('PvsAI')}</button>
            <button onClick={() => resetGame('pvo')} className={`px-4 py-2 text-white rounded-full text-sm ${gameMode === 'pvo' ? 'bg-purple-600' : 'hover:bg-gray-700'}`}>{t('PvsOnline')}</button>
        </div>
      )}
      {gameMode === 'pvo' && !room && !spectateRoomId && <OnlineMultiplayerMenu setGameMode={setGameMode} socketRef={socketRef} userProfile={userProfile} />}
      <div className="flex w-full max-w-4xl justify-around items-center mb-4">
          <PlayerDisplay profile={p1Profile} lastEmoticon={p1LastEmoticon} />
          <span className="text-2xl font-bold text-white">VS</span>
          <PlayerDisplay profile={p2Profile} lastEmoticon={p2LastEmoticon} />
      </div>
      {(gameMode !== 'pvo' || room) && (
        <div onClick={handleBoardClick} className={`bg-orange-200 p-2 shadow-lg relative rounded-md ${isSpectator || (gameMode === 'pva' && currentPlayer === 'white') || (gameState !== 'playing' && !whatIfState) ? 'cursor-not-allowed' : 'cursor-pointer'}`} style={{ width: '64vmin', height: '64vmin' }}>
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ padding: 'calc(100% / (BOARD_SIZE - 1) / 2)' }}>
              {Array.from({length: BOARD_SIZE}).map((_, i) => <div key={`v-${i}`} className="absolute bg-black/50" style={{left: `${(i / (BOARD_SIZE - 1)) * 100}%`, top: 0, width: '1px', height: '100%'}}></div>)}
              {Array.from({length: BOARD_SIZE}).map((_, i) => <div key={`h-${i}`} className="absolute bg-black/50" style={{top: `${(i / (BOARD_SIZE - 1)) * 100}%`, left: 0, height: '1px', width: '100%'}}></div>)}
          </div>
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {currentBoard.map((row, r_idx) => row.map((cell, c_idx) => {
              if (cell) {
                const stoneSize = `calc(100% / ${BOARD_SIZE} * 0.95)`;
                return <div key={`${r_idx}-${c_idx}`} className={`absolute rounded-full shadow-md`} style={{ top: `calc(${(r_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`, left: `calc(${(c_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`, width: stoneSize, height: stoneSize, backgroundColor: cell, border: cell === 'black' ? '1px solid #202020' : '1px solid #e0e0e0' }}></div>;
              }
              return null;
            }))}
          </div>
        </div>
      )}
      {gameState === 'playing' && !isSpectator && !replayGame && (<div className="mt-4"><EmoticonPicker onSelect={handleSendEmoticon} /></div>)}
      {winner && gameState !== 'replay' && <div className="mt-4 text-2xl font-bold text-white">{t('WinnerMessage', { winner: winner.charAt(0).toUpperCase() + winner.slice(1) })}</div>}
      {gameState === 'post-game' && <PostGameManager isPlayer={!isSpectator} isSpectator={isSpectator} resetGame={resetGame} gameMode={gameMode} room={room} socketRef={socketRef} />}
      {gameState === 'replay' && (<ReplayControls moveCount={history.length} currentMove={replayMoveIndex} setCurrentMove={setReplayMoveIndex} isPlaying={isReplaying} setIsPlaying={setIsReplaying} onWhatIf={replayGame?.game_type === 'pva' ? handleWhatIf : undefined}/>)}
      {whatIfState && <button onClick={exitWhatIf} className="mt-2 px-4 py-2 bg-red-500 text-white rounded">{t('ExitWhatIf')}</button>}
    </div>
  );
};

export default Board;