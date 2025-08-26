'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Player } from '@/lib/ai';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import io, { Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';

const BOARD_SIZE = 19;
const K_FACTOR = 32;

// --- Type definitions ---
type GameMode = 'pvp' | 'pva' | 'pvo';
type GameState = 'waiting' | 'playing' | 'post-game' | 'replay';
type Profile = { id: string; username: string; elo_rating: number; is_supporter: boolean; };
type Game = { id: number; moves: { player: Player, row: number, col: number }[]; game_type: GameMode; };
type EmoticonMessage = { id: number; fromId: string; emoticon: string };

interface BoardProps {
  spectateRoomId?: string | null;
  replayGame?: Game | null;
}

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
// ... (Sub-components remain the same, they are self-contained)

// --- Main Board Component ---
const Board = ({ spectateRoomId = null, replayGame = null }: BoardProps) => {
  const { t } = useTranslation();
  const [board, setBoard] = useState<Array<Array<Player | null>>>(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('black');
  const [winner, setWinner] = useState<Player | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>(spectateRoomId ? 'pvo' : (replayGame ? replayGame.game_type : 'pvp'));
  const [gameState, setGameState] = useState<GameState>(replayGame ? 'replay' : 'waiting');
  // ... (rest of the state and logic is the same)
  return (
    <div>... The full board component JSX ...</div>
  );
};

export default Board;