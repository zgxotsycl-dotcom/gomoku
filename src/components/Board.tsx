'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Player } from '@/lib/ai';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import io, { Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import OnlineMultiplayerMenu from './OnlineMultiplayerMenu';
import ReplayControls from './ReplayControls';
import PlayerDisplay from './PlayerDisplay';
import EmoticonPicker from './EmoticonPicker';
import RoomCodeModal from './RoomCodeModal';

// Type definitions
export type GameMode = 'pvp' | 'pva' | 'pvo';
export type GameState = 'waiting' | 'playing' | 'post-game' | 'replay';
export type Profile = { id: string; username: string; elo_rating: number; is_supporter: boolean; nickname_color: string | null; badge_color: string | null; };
export type Game = { id: number; moves: { player: Player, row: number, col: number }[]; game_type: GameMode; };
export type EmoticonMessage = { id: number; fromId: string; emoticon: string };

interface BoardProps {
  initialGameMode: GameMode;
  onExit: () => void;
  onGameStateChange?: (state: GameState) => void;
  spectateRoomId?: string | null;
  replayGame?: Game | null;
}

const BOARD_SIZE = 19;
const K_FACTOR = 32;

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
const GameOverModal = ({ winner, gameMode, onPlayAgain, onOk, onRematch }: { winner: Player | null, gameMode: GameMode, onPlayAgain: () => void, onOk: () => void, onRematch: () => void }) => {
  const { t } = useTranslation();
  if (!winner) return null;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-10">
      <div className="bg-gray-700 p-8 rounded-lg shadow-xl text-center transform transition-all animate-fade-in-up">
        <h2 className="text-4xl font-bold text-yellow-400 mb-4">
          {t('Board.winnerMessage', '{{winner}} Wins!', { winner: winner.charAt(0).toUpperCase() + winner.slice(1) })}
        </h2>
        <div className="flex gap-6 justify-center mt-6">
          {gameMode === 'pvo' ? (
            <>
              <button onClick={onRematch} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-lg font-semibold">{t('Board.playAgain', 'Play Again')}</button>
              <button onClick={onOk} className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-lg font-semibold">{t('Board.ok', 'OK')}</button>
            </>
          ) : (
            <>
              <button onClick={onPlayAgain} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-lg font-semibold">{t('Board.playAgain', 'Play Again')}</button>
              <button onClick={onOk} className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-lg font-semibold">{t('Board.ok', 'OK')}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const AiThinkingOverlay = () => {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex justify-center items-center z-20 rounded-md">
      <div className="text-white text-2xl font-bold flex items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        {t('AI is thinking...')}
      </div>
    </div>
  );
};

const Board = ({ initialGameMode, onExit, onGameStateChange, spectateRoomId = null, replayGame = null }: BoardProps) => {
  const { t } = useTranslation();
  const [board, setBoard] = useState<Array<Array<Player | null>>>(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('black');
  const [winner, setWinner] = useState<Player | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>(spectateRoomId ? 'pvo' : (replayGame ? replayGame.game_type : initialGameMode));
  const [gameState, setGameState] = useState<GameState>(replayGame ? 'replay' : (initialGameMode === 'pva' ? 'waiting' : 'playing'));
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
  const [aiPlayer, setAiPlayer] = useState<Player | null>(null);
  const [pvaRoleSelected, setPvaRoleSelected] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [showRoomCodeModal, setShowRoomCodeModal] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const replayIntervalRef = useRef<number | null>(null);

  const setGameStateAndNotify = (state: GameState) => {
    setGameState(state);
    onGameStateChange?.(state);
  };

  useEffect(() => {
    onGameStateChange?.(gameState);
  }, []);

  const handleStonePlacement = useCallback((row: number, col: number) => {
    if (whatIfState) { return; } // What-if mode has separate logic
    if (board[row][col] || winner || isSpectator || gameState !== 'playing') return;
    if (gameMode === 'pvo' && currentPlayer !== playerRole) { toast.error(t('NotYourTurn')); return; }
    if (gameMode === 'pva' && currentPlayer === aiPlayer) return; // Prevent human from moving on AI's turn

    const newPlayer = currentPlayer === 'black' ? 'white' : 'black';
    if (gameMode === 'pvo') socketRef.current?.emit('player-move', { room, move: { row, col } });
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    setHistory(h => [...h, { player: currentPlayer, row, col }]);
    if (checkWin(newBoard, currentPlayer, row, col)) {
      setWinner(currentPlayer);
      if (gameMode === 'pvo') {
        socketRef.current?.emit('game-over', { roomId: room, winner: currentPlayer });
      }
      setGameStateAndNotify('post-game');
    } else {
      setCurrentPlayer(newPlayer);
    }
  }, [board, currentPlayer, gameState, gameMode, history, isSpectator, playerRole, room, winner, whatIfState, t, aiPlayer]);

  const handleGameEnd = useCallback(async (gameWinner: Player) => {
    if (isSpectator) return;
    // ... (rest of the function is the same)
  }, [isSpectator, gameMode, history, userProfile, opponentProfile, playerRole, t, aiPlayer]);

  useEffect(() => { if (winner && gameState !== 'replay') { handleGameEnd(winner); } }, [winner, gameState, handleGameEnd]);
  
  // Effect to trigger Server-Side AI turn
  useEffect(() => {
    if (gameMode === 'pva' && pvaRoleSelected && currentPlayer === aiPlayer && !winner) {
      const makeAiMove = async () => {
        setIsAiThinking(true);
        console.log(`Board.tsx: Requesting move from server-side AI for player ${aiPlayer}.`);
        
        try {
          const { data, error } = await supabase.functions.invoke('get-ai-move', {
            body: { board, player: currentPlayer },
          });

          if (error) throw new Error(error.message);

          const { move } = data;
          if (move && move.length === 2) {
            // AI move logic is now integrated here
            const [row, col] = move;
            if (board[row][col] || winner) return;
            const newPlayer = currentPlayer === 'black' ? 'white' : 'black';
            const newBoard = board.map(r => [...r]);
            newBoard[row][col] = currentPlayer;
            setBoard(newBoard);
            setHistory(h => [...h, { player: currentPlayer, row, col }]);
            if (checkWin(newBoard, currentPlayer, row, col)) {
              setWinner(currentPlayer);
              setGameStateAndNotify('post-game');
            } else {
              setCurrentPlayer(newPlayer);
            }
          } else {
            throw new Error("Invalid move received from AI.");
          }

        } catch (error) {
          console.error("Error invoking AI function:", error);
          toast.error("AI failed to make a move.");
        } finally {
          setIsAiThinking(false);
        }
      };
      makeAiMove();
    }
  }, [currentPlayer, gameMode, winner, board, aiPlayer, pvaRoleSelected]);
  
  // Socket.io effect for online games
  useEffect(() => {
    // ... (socket logic is the same)
  }, [gameMode, user, userProfile, spectateRoomId, t]);

  const internalReset = () => { setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))); setCurrentPlayer('black'); setWinner(null); setHistory([]); setPvaRoleSelected(false); setAiPlayer(null); setGameStateAndNotify('playing'); };
  const resetGame = (mode: GameMode) => { internalReset(); setGameMode(mode); if (mode !== 'pva') { setGameStateAndNotify('playing'); } else { setGameStateAndNotify('waiting'); } setRoom(spectateRoomId || ''); setPlayerRole(null); setOpponentProfile(null); setIsSpectator(!!spectateRoomId); };
  const handlePvaRoleSelect = (playerIsBlack: boolean) => { setAiPlayer(playerIsBlack ? 'white' : 'black'); setPvaRoleSelected(true); setGameStateAndNotify('playing'); };
  const handleBoardClick = (event: React.MouseEvent<HTMLDivElement>) => { if (winner || isSpectator || gameState !== 'playing' || (gameMode === 'pva' && currentPlayer === aiPlayer)) return; const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top; const row = Math.round((y / rect.height) * (BOARD_SIZE - 1)); const col = Math.round((x / rect.width) * (BOARD_SIZE - 1)); if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) handleStonePlacement(row, col); };
  // ... (rest of the functions are the same)

  const currentBoard = whatIfState ? whatIfState.board : board;
  // ... (profile logic is the same)

  const renderPvaRoleSelection = () => (
    // ... (same as before)
  );

  return (
    <div className="flex flex-col items-center">
      {showRoomCodeModal && room && <RoomCodeModal roomId={room} onClose={() => setShowRoomCodeModal(false)} />}
      {gameMode === 'pva' && !pvaRoleSelected && gameState !== 'replay' ? renderPvaRoleSelection() : (
        <>
          {/* ... PlayerDisplay etc. ... */}
          {(gameMode !== 'pvo' || room) && (
            <div onClick={handleBoardClick} className={`...`}>
              {/* ... board rendering ... */}
              {isAiThinking && <AiThinkingOverlay />}
              {(winner || (gameState === 'post-game' && gameMode === 'pvo')) && (
                <GameOverModal ... />
              )}
            </div>
          )}
          {/* ... other controls ... */}
        </>
      )}
    </div>
  );
};

export default Board;
