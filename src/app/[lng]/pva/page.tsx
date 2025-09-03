'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { BOARD_SIZE, checkWin } from '../../../lib/gameLogic';

// --- Type Definitions ---
type Player = 'black' | 'white';
type GameState = 'playing' | 'post-game';

// --- PvaPage Component ---
export default function PvaPage() {
  const { t } = useTranslation();
  const [board, setBoard] = useState<Array<Array<Player | null>>>(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('black');
  const [winner, setWinner] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [playerColor, setPlayerColor] = useState<Player | null>(null);
  const [winningLine, setWinningLine] = useState<{row: number, col: number}[]>([]);
  
  const aiWorkerRef = useRef<Worker | null>(null);
  const stateRef = useRef({ winner, currentPlayer, playerColor, gameState, board });
  stateRef.current = { winner, currentPlayer, playerColor, gameState, board };

  const aiMove = useCallback((currentBoard: (Player | null)[][], aiPlayer: Player) => {
    console.log('[Main] Posting message to worker to request move for', aiPlayer);
    toast.success(t('Board.toast.aiThinking'));
    aiWorkerRef.current?.postMessage({ 
        board: currentBoard, 
        player: aiPlayer, 
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
  }, [t]);

  const handleStonePlacement = useCallback((row: number, col: number, isAI: boolean = false) => {
    const { winner, currentPlayer, playerColor, board } = stateRef.current;
    if (board[row][col] || winner || gameState !== 'playing') return;
    if (!isAI && currentPlayer !== playerColor) {
        toast.error(t('Board.toast.notYourTurn'));
        return;
    }
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    const winLine = checkWin(newBoard, currentPlayer, row, col);
    setBoard(newBoard);
    if (winLine) {
      setWinner(currentPlayer);
      setWinningLine(winLine);
      setGameState('post-game');
    } else {
      setCurrentPlayer(p => p === 'black' ? 'white' : 'black');
    }
  }, [t]);

  const startNewGame = useCallback(() => {
    const newBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    setBoard(newBoard);
    setCurrentPlayer('black');
    setWinner(null);
    setWinningLine([]);
    const aiColor = Math.random() < 0.5 ? 'black' : 'white';
    const newPlayerColor = aiColor === 'black' ? 'white' : 'black';
    setPlayerColor(newPlayerColor);
    setGameState('playing');
    toast.success(`${t('Board.toast.youAre')} ${newPlayerColor === 'black' ? t('Board.toast.black') : t('Board.toast.white')}`);
    if (aiColor === 'black') {
        aiMove(newBoard, 'black');
    }
  }, [aiMove, t]);

  useEffect(() => {
    if (typeof window !== 'undefined') { // Check if running in the browser
        aiWorkerRef.current = new Worker('/ai.worker.js');
        aiWorkerRef.current.onmessage = (e) => {
            console.log('[Main] Message received from worker', e.data);
            const { row, col } = e.data;
            if (row !== -1 && col !== -1) {
                handleStonePlacement(row, col, true);
            }
        };
        
        startNewGame();

        return () => aiWorkerRef.current?.terminate();
    }
  }, [handleStonePlacement, startNewGame]);

  useEffect(() => {
    if (gameState === 'playing' && currentPlayer !== playerColor && !winner) {
        const timer = setTimeout(() => {
            aiMove(board, currentPlayer);
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [currentPlayer, gameState, winner, board, playerColor, aiMove]);

  const handleBoardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const { winner, gameState, currentPlayer, playerColor } = stateRef.current;
    if (winner || gameState !== 'playing' || currentPlayer !== playerColor) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const row = Math.round((y / rect.height) * (BOARD_SIZE - 1));
    const col = Math.round((x / rect.width) * (BOARD_SIZE - 1));
    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
        handleStonePlacement(row, col, false);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 min-h-screen bg-gray-800 text-white">
        <div className="w-full max-w-4xl mb-4 flex justify-between items-center">
            <Link href="/" className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-transform">{t('Board.backToMenu')}</Link>
            {playerColor && <div className="text-lg">{t('Board.toast.youAre')} <span className={`font-bold ${playerColor === 'black' ? 'text-gray-900' : 'text-white'}`}>{playerColor === 'black' ? t('Board.toast.black') : t('Board.toast.white')}</span></div>}
        </div>

        <div onClick={handleBoardClick} className={`bg-yellow-800 p-2 shadow-lg relative rounded-md ${currentPlayer !== playerColor || gameState !== 'playing' ? 'cursor-not-allowed' : 'cursor-pointer'}`} style={{ width: '80vmin', height: '80vmin', maxWidth: '800px', maxHeight: '800px' }}>
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ padding: 'calc(100% / (BOARD_SIZE - 1) / 2)' }}>
                {Array.from({length: BOARD_SIZE}).map((_, i) => <div key={`v-${i}`} className="absolute bg-black" style={{left: `${(i / (BOARD_SIZE - 1)) * 100}%`, top: 0, width: '1px', height: '100%'}}></div>)}
                {Array.from({length: BOARD_SIZE}).map((_, i) => <div key={`h-${i}`} className="absolute bg-black" style={{top: `${(i / (BOARD_SIZE - 1)) * 100}%`, left: 0, height: '1px', width: '100%'}}></div>)}
            </div>
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                {board.map((row, r_idx) => row.map((cell, c_idx) => {
                if (cell) {
                    const stoneSize = `calc(100% / ${BOARD_SIZE} * 0.9)`;
                    const isWinningStone = winningLine.some(stone => stone.row === r_idx && stone.col === c_idx);
                    const winningStoneIndex = winningLine.findIndex(stone => stone.row === r_idx && stone.col === c_idx);
                    const animationDelay = isWinningStone ? `${winningStoneIndex * 100}ms` : '0ms';
                    const animationClass = isWinningStone ? 'animate-chroma-shine' : 'animate-stone-drop';

                    return <div key={`${r_idx}-${c_idx}`} 
                                className={`absolute rounded-full shadow-md ${animationClass}`}
                                style={{ 
                                    top: `calc(${(r_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`, 
                                    left: `calc(${(c_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`, 
                                    width: stoneSize, 
                                    height: stoneSize, 
                                    backgroundColor: cell, 
                                    border: '1px solid gray',
                                    animationDelay: animationDelay,
                                    animationIterationCount: isWinningStone ? 'infinite' : '1'
                                }}></div>;
                }
                return null;
                }))}
            </div>
        </div>

        {gameState === 'post-game' && winner && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex justify-center items-center z-20">
                <div className="bg-gray-800 border-2 border-yellow-500 p-8 rounded-lg shadow-2xl text-center animate-fade-in-up">
                    <h2 className="text-4xl font-extrabold text-white mb-4">{t('Board.winnerMessage', { winner: winner.charAt(0).toUpperCase() + winner.slice(1) })}</h2>
                    <button onClick={startNewGame} className="mt-4 px-6 py-2 bg-green-500 text-white font-bold rounded hover:bg-green-600 transition-colors">{t('PostGameManager.playAgain')}</button>
                </div>
            </div>
        )}
    </div>
  );
}