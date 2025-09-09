import React from 'react';
import type { Player, Move } from '../types';

const BOARD_SIZE = 19;

interface GameBoardProps {
    board: (Player | null)[][];
    lastMove: Move | null;
    handleBoardClick: (event: React.MouseEvent<HTMLDivElement>) => void;
    isSpectator: boolean;
    gameMode: string;
    currentPlayer: Player;
    aiPlayer: Player;
    gameState: string;
    whatIf: { isMode: boolean; };
    winningLine: { row: number; col: number }[] | null;
    forbiddenMoves: { row: number; col: number }[];
    isWinningShake: boolean; // Add new prop
}

export const GameBoard = ({
    board,
    lastMove,
    handleBoardClick,
    isSpectator,
    gameMode,
    currentPlayer,
    aiPlayer,
    gameState,
    whatIf,
    winningLine,
    forbiddenMoves,
    isWinningShake, // Destructure new prop
}: GameBoardProps) => {
    const isWinningStone = (row: number, col: number) => winningLine?.some(stone => stone.row === row && stone.col === col) || false;
    const isLastMove = (row: number, col: number) => {
        if (!lastMove) return false;
        return lastMove.row === row && lastMove.col === col;
    };

    return (
        <div className={`relative ${isWinningShake ? 'animate-board-shake' : ''}`} style={{ width: '64vmin', height: '64vmin' }}>
            {/* The frame with a wooden color */}
            <div className={`p-4 bg-[#d2b48c] rounded-md shadow-lg w-full h-full ${winningLine ? 'animate-red-shadow' : ''}`}>
                {/* The interactive grid area */}
                <div
                    onClick={handleBoardClick}
                    className={`goboard bg-[#c19a6b] relative w-full h-full rounded-sm ${isSpectator || (gameMode === 'pva' && currentPlayer === aiPlayer) || (gameState !== 'playing' && !whatIf.isMode) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    {/* Lines are drawn on a transparent overlay inside the grid */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ padding: `calc(100% / (${BOARD_SIZE} - 1) / 2)` }}>
                        {Array.from({ length: BOARD_SIZE }).map((_, i) => <div key={`v-${i}`} className="goboard-line absolute" style={{ left: `${(i / (BOARD_SIZE - 1)) * 100}%`, top: 0, width: '1px', height: '100%' }}></div>)}
                        {Array.from({ length: BOARD_SIZE }).map((_, i) => <div key={`h-${i}`} className="goboard-line absolute" style={{ top: `${(i / (BOARD_SIZE - 1)) * 100}%`, left: 0, height: '1px', width: '100%' }}></div>)}
                    </div>
                    {/* Stones are drawn on another transparent overlay inside the grid */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        {board.map((row, r_idx) => row.map((cell, c_idx) => {
                            if (cell) {
                                const stoneSize = `calc(100% / ${BOARD_SIZE} * 0.9)`;
                                const isWinStone = isWinningStone(r_idx, c_idx);
                                const isLast = isLastMove(r_idx, c_idx);
                                const stoneClasses = `absolute rounded-full stone-shadow ${isWinStone ? 'animate-chroma-shine' : ''} ${!isWinStone && isLast ? 'animate-slime-in' : ''}`;
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
                        {/* Forbidden Move Markers */}
                        {forbiddenMoves.map(({ row, col }) => {
                            const stoneSize = `calc(100% / ${BOARD_SIZE} * 0.9)`;
                            return <div key={`f-${row}-${col}`} className="absolute rounded-full forbidden-move-marker" style={{
                                top: `calc(${(row / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                left: `calc(${(col / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                width: stoneSize,
                                height: stoneSize,
                            }}></div>
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};