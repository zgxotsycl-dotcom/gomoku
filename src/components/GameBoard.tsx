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
    whatIf: { isMode: boolean };
    winningLine: { row: number; col: number }[] | null;
    forbiddenMoves: { row: number; col: number }[];
    isWinningShake: boolean; // Add new prop
    startAnimKey?: number;
    boardSizePx?: number;
    winner?: Player | null;
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
    boardSizePx,
    winner = null,
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

    const winShadow = (() => {
        let s = '';
        // Local modes (pvp/pva/spectate): colorize the frame by winner
        // Online (pvo): keep red even on win
        if (winningLine && winner && gameMode !== 'pvo') {
            s = winner === 'black' ? 'animate-gold-shadow' : 'animate-blue-shadow';
        } else if (winningLine) {
            s = 'animate-red-shadow';
        }
        return s;
    })();

    return (
        <div
            className={`relative ${isWinningShake ? 'animate-board-shake' : ''}`}
            // Board container fits within available square area; never exceed parent
            style={
              boardSizePx && boardSizePx > 0
                ? { width: `${boardSizePx}px`, height: `${boardSizePx}px`, maxWidth: '100%', maxHeight: '100%' }
                : { width: 'clamp(280px, 92vmin, 820px)', height: 'clamp(280px, 92vmin, 820px)', maxWidth: '100%', maxHeight: '100%' }
            }
        >
            {/* The frame with a wooden color */}
            <div className={`p-2 md:p-4 bg-[#d2b48c] rounded-md shadow-lg w-full h-full ${winShadow}`}>
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
                                const winStoneClass = isWinStone
                                  ? (winner ? (winner === 'black' ? 'win-stone-gold' : 'win-stone-blue') : 'animate-chroma-shine')
                                  : '';
                                const stoneClasses = `absolute rounded-full stone-shadow ${winStoneClass} ${!isWinStone && isLast ? 'stone-pop' : ''} ${isLast ? 'stone-glow-once' : ''}`;
                                const stoneStyle: React.CSSProperties = {
                                    top: `calc(${(r_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                    left: `calc(${(c_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                    width: stoneSize,
                                    height: stoneSize,
                                    backgroundColor: cell,
                                    border: '1px solid gray'
                                };
                                if (isLast) {
                                    // Opposite color glow for visibility on the board background
                                    const glow = cell === 'black' ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.70)';
                                    (stoneStyle as any)['--stone-glow-color'] = glow;
                                    // Slight per-position variation for a more natural drop
                                    const seed = ((r_idx * 31 + c_idx * 17) % 5) - 2; // -2..2
                                    (stoneStyle as any)['--drop-rot'] = `${seed * 1.2}deg`;
                                    (stoneStyle as any)['--drop-x'] = `${seed * 0.6}px`;
                                }
                                return (
                                  <React.Fragment key={`stone-${r_idx}-${c_idx}`}>
                                    <div key={`s-${r_idx}-${c_idx}`} className={stoneClasses} style={stoneStyle} />
                                    {isLast && !isWinStone && (
                                      <>
                                        <div key={`r1-${r_idx}-${c_idx}`} className="stone-ripple" style={{
                                          top: `calc(${(r_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                          left: `calc(${(c_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                          width: stoneSize,
                                          height: stoneSize,
                                          // ring color: opposite of stone for contrast
                                          ['--ring-color' as any]: cell === 'black' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'
                                        }} />
                                        <div key={`r2-${r_idx}-${c_idx}`} className="stone-ripple--inner" style={{
                                          top: `calc(${(r_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                          left: `calc(${(c_idx / (BOARD_SIZE - 1)) * 100}% - (${stoneSize} / 2))`,
                                          width: stoneSize,
                                          height: stoneSize,
                                          ['--ring-color' as any]: cell === 'black' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.28)'
                                        }} />
                                      </>
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
