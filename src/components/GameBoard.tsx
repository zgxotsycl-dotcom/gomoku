import React from 'react';
import type { Player, Move } from '../types';

const getSize = (board: (Player | null)[][]) => board.length || 15;

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
    startAnimKey?: number;
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
    startAnimKey = 0,
}: GameBoardProps) => {
    const BOARD_SIZE = getSize(board);
    const isWinningStone = (row: number, col: number) => winningLine?.some(stone => stone.row === row && stone.col === col) || false;
    const isLastMove = (row: number, col: number) => {
        if (!lastMove) return false;
        return lastMove.row === row && lastMove.col === col;
    };

    const starPoints = (() => {
        if (BOARD_SIZE === 15) {
            const pts = [3, 7, 11];
            return [
                [pts[0], pts[0]], [pts[0], pts[2]], [pts[1], pts[1]], [pts[2], pts[0]], [pts[2], pts[2]],
            ];
        } else if (BOARD_SIZE === 19) {
            const pts = [3, 9, 15];
            const arr: [number, number][] = [];
            for (const r of pts) for (const c of pts) arr.push([r, c]);
            return arr;
        }
        return [] as [number, number][];
    })();

    return (
        <div
            className={`relative ${isWinningShake ? 'animate-board-shake' : ''}`}
            // 모바일에서는 너무 작지 않게, 데스크탑에서는 과도하게 커지지 않도록 클램프 처리
            // 300px ~ 800px 사이에서 92vmin 기준으로 반응
            style={{ width: 'clamp(300px, 92vmin, 800px)', height: 'clamp(300px, 92vmin, 800px)' }}
        >
            {/* The frame with a wooden color */}
            <div className={`p-2 md:p-4 bg-[#d2b48c] rounded-md shadow-lg w-full h-full ${winningLine ? 'animate-red-shadow' : ''}`}>
                {/* The interactive grid area */}
                <div
                    onClick={handleBoardClick}
                    className={`goboard bg-[#c19a6b] relative w-full h-full rounded-sm select-none touch-manipulation overscroll-none ${isSpectator || (gameMode === 'pva' && currentPlayer === aiPlayer) || (gameState !== 'playing' && !whatIf.isMode) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    role="grid"
                >
                    {/* Tile-by-tile intro overlay (from top-left corner) */}
                    {startAnimKey > 0 && (
                      <div className="intro-tiles pointer-events-none" key={`intro-${startAnimKey}`} style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
                        gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
                        position: 'absolute', inset: 0,
                      }}>
                        {Array.from({ length: BOARD_SIZE }).map((_, r) => (
                          Array.from({ length: BOARD_SIZE }).map((__, c) => {
                            const d = (r + c) * 22; // ms delay per diagonal step
                            return <div key={`t-${r}-${c}`} className="intro-tile" style={{ animationDelay: `${d}ms` }} />
                          })
                        ))}
                      </div>
                    )}
                    {/* Lines are drawn on a transparent overlay inside the grid */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ padding: `calc(100% / (${BOARD_SIZE} - 1) / 2)` }}>
                        {Array.from({ length: BOARD_SIZE }).map((_, i) => <div key={`v-${i}`} className="goboard-line absolute" style={{ left: `${(i / (BOARD_SIZE - 1)) * 100}%`, top: 0, width: '1px', height: '100%' }}></div>)}
                        {Array.from({ length: BOARD_SIZE }).map((_, i) => <div key={`h-${i}`} className="goboard-line absolute" style={{ top: `${(i / (BOARD_SIZE - 1)) * 100}%`, left: 0, height: '1px', width: '100%' }}></div>)}
                    </div>
                    {/* Star points */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ padding: `calc(100% / (${BOARD_SIZE} - 1) / 2)` }}>
                        {starPoints.map(([r, c], idx) => {
                            const dot = `calc(100% / ${BOARD_SIZE} * 0.25)`;
                            return (
                                <div key={`star-${idx}`} className="absolute rounded-full bg-black/60"
                                     style={{
                                         top: `calc(${(r / (BOARD_SIZE - 1)) * 100}% - (${dot} / 2))`,
                                         left: `calc(${(c / (BOARD_SIZE - 1)) * 100}% - (${dot} / 2))`,
                                         width: dot,
                                         height: dot,
                                     }} />
                            );
                        })}
                    </div>
                    {/* Stones are drawn on another transparent overlay inside the grid */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        {board.map((row, r_idx) => row.map((cell, c_idx) => {
                            if (cell) {
                                const stoneSize = `calc(100% / ${BOARD_SIZE} * 0.9)`;
                                const isWinStone = isWinningStone(r_idx, c_idx);
                                const isLast = isLastMove(r_idx, c_idx);
                                const stoneClasses = `absolute rounded-full stone-shadow ${isWinStone ? 'animate-chroma-shine' : ''} ${!isWinStone && isLast ? 'stone-pop' : ''}`;
                                const stoneStyle: React.CSSProperties = {
                                    top: `calc(${(r_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                    left: `calc(${(c_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                    width: stoneSize,
                                    height: stoneSize,
                                    backgroundColor: cell,
                                    border: '1px solid gray'
                                };
                                return (
                                  <React.Fragment key={`stone-${r_idx}-${c_idx}`}>
                                    <div key={`s-${r_idx}-${c_idx}`} className={stoneClasses} style={stoneStyle} />
                                    {isLast && !isWinStone && (
                                      <div key={`r-${r_idx}-${c_idx}`} className="stone-ripple" style={{
                                        top: `calc(${(r_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                        left: `calc(${(c_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                        width: stoneSize,
                                        height: stoneSize,
                                      }} />
                                    )}
                                  </React.Fragment>
                                );
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

