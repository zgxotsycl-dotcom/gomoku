'use client';

import { GameBoard } from './GameBoard';
import { GameControls } from './GameControls';
import type { Game as ReplayGame, Player } from '../types';
import type { Socket } from 'socket.io-client';

interface Swap2Override {
    active: boolean;
    board: (Player | null)[][];
    onClick: (row: number, col: number) => void;
}

interface GameAreaProps {
    state: any;
    dispatch: (action: any) => void;
    replayGame: ReplayGame | null;
    swap2Override?: Swap2Override | null;
    socketRef?: React.MutableRefObject<Socket | null>;
}

import { useEffect, useRef, useState } from 'react';

const GameArea = ({ state, dispatch, replayGame, swap2Override, socketRef }: GameAreaProps) => {
    const fitRef = useRef<HTMLDivElement | null>(null);
    const [boardSize, setBoardSize] = useState<number>(0);
    useEffect(() => {
        const el = fitRef.current;
        if (!el) return;
        const compute = () => {
            const rect = el.getBoundingClientRect();
            const vw = window.innerWidth || document.documentElement.clientWidth;
            const vh = window.innerHeight || document.documentElement.clientHeight;
            // Clamp available area to the visible viewport to avoid scrollbars on desktop
            const maxVisibleW = Math.max(0, Math.min(rect.width, vw - rect.left - 8));
            const maxVisibleH = Math.max(0, Math.min(rect.height, vh - rect.top - 8));
            const size = Math.floor(Math.max(0, Math.min(maxVisibleW, maxVisibleH)));
            setBoardSize(size);
        };
        compute();
        const ro = new ResizeObserver(() => compute());
        ro.observe(el);
        const onResize = () => compute();
        window.addEventListener('resize', onResize);
        return () => { try { ro.disconnect(); } catch {} window.removeEventListener('resize', onResize); };
    }, []);
    const handleBoardClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const style = window.getComputedStyle(event.currentTarget);
        const paddingLeft = parseFloat(style.paddingLeft);
        const paddingTop = parseFloat(style.paddingTop);
        const gridWidth = event.currentTarget.clientWidth - paddingLeft * 2;
        const gridHeight = event.currentTarget.clientHeight - paddingTop * 2;
        const x = event.clientX - rect.left - paddingLeft;
        const y = event.clientY - rect.top - paddingTop;
        if (x < 0 || x > gridWidth || y < 0 || y > gridHeight) return;
        const size = (swap2Override?.board?.length) || state.board?.length || 15;
        const row = Math.round((y / gridHeight) * (size - 1));
        const col = Math.round((x / gridWidth) * (size - 1));
        if (row < 0 || row >= size || col < 0 || col >= size) return;

        if (swap2Override?.active) {
            swap2Override.onClick(row, col);
            return;
        }

        if ((state.difficulty === 'normal' && state.showColorSelect) || state.gameState !== 'playing') return;

        // Online multiplayer (PVO): never place stones locally
        if (state.gameMode === 'pvo') {
            if (socketRef?.current && state.playerRole && state.playerRole === state.currentPlayer) {
                socketRef.current.emit('player-move', { room: state.room, move: { row, col } });
            }
            return; // always block local placement in online mode
        }

        if (state.isWhatIfMode) {
            dispatch({ type: 'PLACE_WHAT_IF_STONE', payload: { row, col } });
        } else if (state.gameState !== 'replay') {
            dispatch({ type: 'PLACE_STONE', payload: { row, col } });
        }
    };

    const getLastMove = () => {
        if (state.isWhatIfMode) return state.whatIfLastMove;
        if (state.gameState === 'replay') {
            if (state.replayMoveIndex === 0) return null;
            return state.history[state.replayMoveIndex - 1];
        }
        if (state.history.length === 0) return null;
        return state.history[state.history.length - 1];
    };

    const boardForRender = swap2Override?.board ?? (state.isWhatIfMode ? state.whatIfBoard : state.board);
    const winningLine = state.isWhatIfMode ? state.whatIfWinningLine : state.winningLine;

    return (
        <div className="w-full flex flex-col items-center flex-1 min-h-0">
            <div
              ref={fitRef}
              className="w-full flex-1 min-h-0 flex items-center justify-center px-2"
              style={{ maxWidth: '100vw', maxHeight: '100svh' }}
            >
            <GameBoard
                board={boardForRender}
                lastMove={getLastMove()}
                isSpectator={state.isSpectator}
                handleBoardClick={handleBoardClick}
                gameMode={state.gameMode}
                currentPlayer={state.currentPlayer}
                aiPlayer={state.aiPlayer}
                gameState={state.gameState}
                whatIf={{ isMode: state.isWhatIfMode }}
                winningLine={winningLine}
                forbiddenMoves={state.forbiddenMoves}
                isWinningShake={state.isWinningShake}
                startAnimKey={state.startAnimKey}
                boardSizePx={boardSize} winner={state.winner}
            />

            </div>
            <div className="mt-2 md:mt-4 flex flex-col items-center gap-2">
            <GameControls
                state={state}
                dispatch={dispatch}
                replayGame={replayGame}
            />
            </div>
        </div>
    );
};

export default GameArea;

