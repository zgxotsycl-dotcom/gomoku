import { useReducer, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameMode, GameState, Profile, Game, Player, Move } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { findForbiddenMoves } from '../gomokuRules';
import io, { Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';

const BOARD_SIZE = 19;
const K_FACTOR = 32;
const BASE_TURN_TIME = 5000;
const TIME_INCREMENT = 1000;
const MAX_TURN_TIME = 30000;

const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
};

const checkWin = (board: (Player | null)[][], player: Player, row: number, col: number): {row: number, col: number}[] | null => {
    const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }];
    for (const dir of directions) {
        let line = [{row, col}];
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
        if (count >= 5) return line.slice(0, 5);
    }
    return null;
};

const calculateElo = (playerRating: number, opponentRating: number, score: 1 | 0 | 0.5) => {
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    return Math.round(playerRating + K_FACTOR * (score - expectedScore));
};
const initialState = {
    gameMode: 'pvp' as GameMode,
    gameState: 'waiting' as GameState,
    board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)) as (Player | null)[][],
    currentPlayer: 'black' as Player,
    winner: null as Player | null,
    history: [] as Move[],
    winningLine: null as {row: number, col: number}[] | null,
    forbiddenMoves: [] as {row: number, col: number}[],
    startTime: null as number | null,
    gameDuration: "",
    aiPlayer: 'white' as Player,
    isPrivateGame: false,
    room: '',
    playerRole: null as Player | null,
    isSpectator: false,
    userProfile: null as Profile | null,
    opponentProfile: null as Profile | null,
    activeEmoticon: null as { id: number, fromId: string, emoticon: string } | null,
    emoticonCooldown: false,
    replayMoveIndex: 0,
    isReplaying: false,
    turnTimeLimit: BASE_TURN_TIME,
    turnTimeRemaining: BASE_TURN_TIME,
    onlineUsers: 0,
    inQueueUsers: 0,
    createdRoomId: null as string | null,
    showRoomCodeModal: false,
    isSocketConnected: false,
    aiKnowledge: null as Map<string, { wins: number; losses: number; }> | null,
    isWhatIfMode: false,
    whatIfBoard: null as (Player | null)[][] | null,
    isAiThinking: false,
    whatIfPlayer: 'black' as Player,
    whatIfWinner: null as Player | null,
    whatIfWinningLine: null as {row: number, col: number}[] | null,
    whatIfLastMove: null as Move | null,
};

type Action =
    | { type: 'PLACE_STONE', payload: { row: number, col: number } }
    | { type: 'AI_MOVE', payload: { row: number, col: number } }
    | { type: 'RESET_GAME', payload?: { gameMode?: GameMode, isPrivate?: boolean } }
    | { type: 'SET_BOARD', payload: (Player | null)[][] }
    | { type: 'SET_GAME_MODE', payload: GameMode }
    | { type: 'SET_GAME_STATE', payload: GameState }
    | { type: 'SET_WINNER', payload: { winner: Player, line: {row: number, col: number}[] } }
    | { type: 'SET_HISTORY', payload: Move[] }
    | { type: 'SET_AI_PLAYER', payload: Player }
    | { type: 'SET_USER_PROFILE', payload: Profile | null }
    | { type: 'ENTER_WHAT_IF' }
    | { type: 'EXIT_WHAT_IF' }
    | { type: 'PLACE_WHAT_IF_STONE', payload: { row: number, col: number } }
    | { type: 'SET_AI_THINKING', payload: boolean }
    | { type: 'SET_REPLAY_INDEX', payload: number }
    | { type: 'SET_IS_REPLAYING', payload: boolean }
    | { type: 'TICK_TIMER' };

function gomokuReducer(state: typeof initialState, action: Action): typeof initialState {
    switch (action.type) {
        case 'SET_BOARD':
            return { ...state, board: action.payload };
        case 'SET_HISTORY':
            return { ...state, history: action.payload };
        case 'SET_GAME_STATE':
            return { ...state, gameState: action.payload };
        case 'SET_GAME_MODE':
            return { ...state, gameMode: action.payload };
        case 'TICK_TIMER': {
            if (state.gameState !== 'playing') return state;
            const newTime = state.turnTimeRemaining - 100;
            if (newTime <= 0) {
                const winner = state.currentPlayer === 'black' ? 'white' : 'black';
                return {
                    ...state,
                    winner,
                    gameState: 'post-game',
                    gameDuration: state.startTime ? formatDuration((Date.now() - state.startTime) / 1000) : "",
                    turnTimeRemaining: 0,
                };
            }
            return { ...state, turnTimeRemaining: newTime };
        }
        case 'AI_MOVE': {
            const { row, col } = action.payload;
            if (row === -1 || col === -1) { // AI failed or passed
                if (state.isWhatIfMode) return { ...state, isAiThinking: false };
                return state;
            }

            if (state.isWhatIfMode) {
                if (!state.whatIfBoard || state.isAiThinking || state.whatIfWinner) return state;
                const player = state.whatIfPlayer;
                if (state.whatIfBoard[row][col]) return { ...state, isAiThinking: false };

                const newBoard = state.whatIfBoard.map(r => [...r]);
                newBoard[row][col] = player;
                const winInfo = checkWin(newBoard, player, row, col);

                if (winInfo) {
                    return {
                        ...state,
                        whatIfBoard: newBoard,
                        whatIfWinner: player,
                        whatIfWinningLine: winInfo,
                        whatIfLastMove: { player, row, col },
                        isAiThinking: false,
                    };
                }

                return {
                    ...state,
                    whatIfBoard: newBoard,
                    whatIfPlayer: player === 'black' ? 'white' : 'black',
                    whatIfLastMove: { player, row, col },
                    isAiThinking: false,
                };
            }

            const player = state.currentPlayer;
            if (state.board[row][col] || state.winner || state.gameState !== 'playing') {
                return state;
            }

            const newBoard = state.board.map(r => [...r]);
            newBoard[row][col] = player;
            const newHistory = [...state.history, { player, row, col }];
            const winInfo = checkWin(newBoard, player, row, col);

            if (winInfo) {
                return {
                    ...state,
                    board: newBoard,
                    history: newHistory,
                    winner: player,
                    winningLine: winInfo,
                    gameState: 'post-game',
                    gameDuration: state.startTime ? formatDuration((Date.now() - state.startTime) / 1000) : "",
                };
            }
            
            const newTurnTimeLimit = Math.min(MAX_TURN_TIME, state.turnTimeLimit + TIME_INCREMENT);

            return {
                ...state,
                board: newBoard,
                history: newHistory,
                currentPlayer: player === 'black' ? 'white' : 'black',
                forbiddenMoves: player === 'white' ? findForbiddenMoves(newBoard, 'black') : [],
                turnTimeLimit: newTurnTimeLimit,
                turnTimeRemaining: newTurnTimeLimit,
            };
        }
        case 'PLACE_STONE': {
            const { row, col } = action.payload;
            const player = state.currentPlayer;

            if (state.board[row][col] || state.winner || state.gameState !== 'playing') return state;
            if (player === 'black' && state.forbiddenMoves.some(m => m.row === row && m.col === col)) {
                toast.error('This move is forbidden (3-3 or 4-4).');
                return state;
            }

            const newBoard = state.board.map(r => [...r]);
            newBoard[row][col] = player;
            const newHistory = [...state.history, { player, row, col }];
            const winInfo = checkWin(newBoard, player, row, col);

            if (winInfo) {
                return {
                    ...state,
                    board: newBoard,
                    history: newHistory,
                    winner: player,
                    winningLine: winInfo,
                    gameState: 'post-game',
                    gameDuration: state.startTime ? formatDuration((Date.now() - state.startTime) / 1000) : "",
                };
            }
            
            const newTurnTimeLimit = Math.min(MAX_TURN_TIME, state.turnTimeLimit + TIME_INCREMENT);

            return {
                ...state,
                board: newBoard,
                history: newHistory,
                currentPlayer: player === 'black' ? 'white' : 'black',
                forbiddenMoves: player === 'white' ? findForbiddenMoves(newBoard, 'black') : [],
                turnTimeLimit: newTurnTimeLimit,
                turnTimeRemaining: newTurnTimeLimit,
            };
        }
        case 'RESET_GAME': {
            const gameMode = action.payload?.gameMode || state.gameMode;
            return {
                ...initialState,
                gameMode: gameMode,
                isPrivateGame: action.payload?.isPrivate || false,
                gameState: 'playing',
                startTime: Date.now(),
                aiPlayer: Math.random() < 0.5 ? 'black' : 'white',
                turnTimeLimit: BASE_TURN_TIME,
                turnTimeRemaining: BASE_TURN_TIME,
            };
        }
        case 'SET_AI_PLAYER':
            return { ...state, aiPlayer: action.payload };
        case 'SET_USER_PROFILE':
            return { ...state, userProfile: action.payload };
        case 'ENTER_WHAT_IF': {
            const replayBoard = Array(19).fill(null).map(() => Array(19).fill(null));
            for (let i = 0; i < state.replayMoveIndex; i++) {
                if (state.history[i]) replayBoard[state.history[i].row][state.history[i].col] = state.history[i].player;
            }
            const nextPlayer = state.replayMoveIndex % 2 === 0 ? 'black' : 'white';
            return {
                ...state,
                isWhatIfMode: true,
                whatIfBoard: replayBoard,
                whatIfPlayer: nextPlayer,
                aiPlayer: nextPlayer, // Assume AI makes the next move
                whatIfWinner: null,
                whatIfWinningLine: null,
                whatIfLastMove: null,
            };
        }
        case 'EXIT_WHAT_IF':
            return { 
                ...state, 
                isWhatIfMode: false, 
                whatIfBoard: null, 
                whatIfWinner: null, 
                whatIfWinningLine: null,
                whatIfLastMove: null,
            };
        case 'PLACE_WHAT_IF_STONE': {
            if (!state.whatIfBoard || state.isAiThinking || state.whatIfWinner) return state;
            const { row, col } = action.payload;
            if (state.whatIfBoard[row][col]) return state;

            const player = state.whatIfPlayer;
            const newBoard = state.whatIfBoard.map(r => [...r]);
            newBoard[row][col] = player;
            const winInfo = checkWin(newBoard, player, row, col);

            if (winInfo) {
                return {
                    ...state,
                    whatIfBoard: newBoard,
                    whatIfWinner: player,
                    whatIfWinningLine: winInfo,
                    whatIfLastMove: { player, row, col },
                };
            }

            return {
                ...state,
                whatIfBoard: newBoard,
                whatIfPlayer: player === 'black' ? 'white' : 'black',
                whatIfLastMove: { player, row, col },
            };
        }
        case 'SET_AI_THINKING':
            return { ...state, isAiThinking: action.payload };
        case 'SET_REPLAY_INDEX':
            return { ...state, replayMoveIndex: action.payload };
        case 'SET_IS_REPLAYING':
            return { ...state, isReplaying: action.payload };
        default:
            return state;
    }
}
export const useGomoku = (initialGameMode: GameMode, onExit: () => void, spectateRoomId: string | null, replayGame: Game | null) => {
    const [state, dispatch] = useReducer(gomokuReducer, {
        ...initialState,
        gameMode: initialGameMode,
        gameState: replayGame ? 'replay' : (initialGameMode === 'pvo' || initialGameMode === 'spectate' ? 'waiting' : 'playing'),
        history: replayGame ? replayGame.moves : [],
        startTime: (initialGameMode !== 'pvo' && initialGameMode !== 'spectate' && !replayGame) ? Date.now() : null
    });

    const { t } = useTranslation();
    const { user } = useAuth();
    const [isGameSaved, setIsGameSaved] = useState(false);
    const aiWorkerRef = useRef<Worker | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Load replay game data when prop changes
    useEffect(() => {
        if (replayGame) {
            dispatch({ type: 'SET_HISTORY', payload: replayGame.moves });
            dispatch({ type: 'SET_GAME_STATE', payload: 'replay' });
            dispatch({ type: 'SET_GAME_MODE', payload: replayGame.game_type });
        }
    }, [replayGame]);

    // Save game to database
    useEffect(() => {
        const saveGame = async () => {
            if (state.gameState === 'post-game' && !isGameSaved && user && state.gameMode !== 'pvp' && !replayGame) {
                setIsGameSaved(true); // Prevent multiple saves

                const { data: gameData, error: gameError } = await supabase
                    .from('games')
                    .insert({
                        moves: state.history,
                        game_type: state.gameMode,
                        winner_player: state.winner,
                    })
                    .select()
                    .single();

                if (gameError || !gameData) {
                    toast.error('Failed to save game for replay.');
                    console.error('Error saving game:', gameError);
                    return;
                }

                const newGameId = gameData.id;

                const { error: replayError } = await supabase
                    .from('user_replays')
                    .insert({
                        user_id: user.id,
                        game_id: newGameId,
                    });

                if (replayError) {
                    toast.error('Failed to associate replay with user.');
                    console.error('Error saving user_replay:', replayError);
                } else {
                    toast.success('Game saved to your replays!');
                }
            }
        };

        saveGame();
    }, [state.gameState, isGameSaved, user, state.gameMode, state.history, state.winner, replayGame]);

    // Replay board update logic
    useEffect(() => {
        if (state.gameState === 'replay') {
            const newBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
            for (let i = 0; i < state.replayMoveIndex; i++) {
                const move = state.history[i];
                if (move) {
                    newBoard[move.row][move.col] = move.player;
                }
            }
            dispatch({ type: 'SET_BOARD', payload: newBoard });
        }
    }, [state.replayMoveIndex, state.gameState, state.history]);

    // Replay auto-play logic
    useEffect(() => {
        let playInterval: NodeJS.Timeout | null = null;
        if (state.isReplaying && state.replayMoveIndex < state.history.length) {
            playInterval = setInterval(() => {
                dispatch({ type: 'SET_REPLAY_INDEX', payload: state.replayMoveIndex + 1 });
            }, 1000);
        } else if (state.isReplaying) {
            dispatch({ type: 'SET_IS_REPLAYING', payload: false });
        }

        return () => {
            if (playInterval) {
                clearInterval(playInterval);
            }
        };
    }, [state.isReplaying, state.replayMoveIndex, state.history.length, dispatch]);


    // Game Timer Logic (PVA and PVO)
    useEffect(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if ((state.gameMode === 'pva' || state.gameMode === 'pvo') && state.gameState === 'playing' && !state.winner) {
            timerRef.current = setInterval(() => {
                dispatch({ type: 'TICK_TIMER' });
            }, 100);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [state.currentPlayer, state.gameState, state.winner, state.gameMode]);

    // AI Worker Setup & Message Handling
    useEffect(() => {
        aiWorkerRef.current = new Worker('/ai.worker.js', { type: 'module' });
        aiWorkerRef.current.onmessage = (e) => {
            const { row, col } = e.data;
            dispatch({ type: 'AI_MOVE', payload: { row, col } });
        };
        return () => aiWorkerRef.current?.terminate();
    }, []);

    // AI Turn Logic
    useEffect(() => {
        if (state.gameMode === 'pva' && state.currentPlayer === state.aiPlayer && !state.winner && state.gameState === 'playing') {
            aiWorkerRef.current?.postMessage({ board: state.board, player: state.currentPlayer });
        }
    }, [state.currentPlayer, state.gameMode, state.winner, state.board, state.aiPlayer, state.gameState]);

    // What If AI Turn Logic
    useEffect(() => {
        if (state.isWhatIfMode && state.whatIfPlayer === state.aiPlayer && state.whatIfBoard && !state.isAiThinking) {
            dispatch({ type: 'SET_AI_THINKING', payload: true });
            aiWorkerRef.current?.postMessage({ board: state.whatIfBoard, player: state.whatIfPlayer });
        }
    }, [state.isWhatIfMode, state.whatIfPlayer, state.whatIfBoard, state.aiPlayer, state.isAiThinking]);
    
    // Game Start Logic
    useEffect(() => {
        if (!replayGame && (initialGameMode === 'pva' || initialGameMode === 'pvp')) {
            dispatch({ type: 'RESET_GAME', payload: { gameMode: initialGameMode } });
        }
    }, [initialGameMode, replayGame]);

    // User Profile Fetching
    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!user) return;
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            dispatch({ type: 'SET_USER_PROFILE', payload: data });
        };
        fetchUserProfile();
    }, [user]);

    return { state, dispatch, socketRef };
};
