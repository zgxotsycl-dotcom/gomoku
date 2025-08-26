export type Player = 'black' | 'white';
export type AIKnowledge = Map<string, { wins: number, losses: number }>;

const BOARD_SIZE = 19;

// Simple hash function for a 5x5 board pattern
const hashPattern = (pattern: (Player | null)[][]): string => {
  return pattern.map(row => row ? row.join('') : 'n').join('|');
}

function getPossibleMoves(board: (Player | null)[][]): [number, number][] {
    const moves: Set<string> = new Set();
    const radius = 2;
    let hasStones = false;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== null) {
                hasStones = true;
                for (let i = -radius; i <= radius; i++) {
                    for (let j = -radius; j <= radius; j++) {
                        const newR = r + i;
                        const newC = c + j;
                        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === null) {
                            moves.add(`${newR},${newC}`);
                        }
                    }
                }
            }
        }
    }

    if (!hasStones) {
        return [[Math.floor(BOARD_SIZE / 2), Math.floor(BOARD_SIZE / 2)]];
    }

    return Array.from(moves).map(move => {
        const [r, c] = move.split(',').map(Number);
        return [r, c] as [number, number];
    });
}

const HEURISTIC_SCORE = {
    FIVE: 100000,
    OPEN_FOUR: 10000,
    CLOSED_FOUR: 1000,
    OPEN_THREE: 100,
    CLOSED_THREE: 10,
    OPEN_TWO: 5,
    CLOSED_TWO: 1,
};

function evaluateLine(line: (Player | null)[], player: Player): number {
    const opponent: Player = player === 'black' ? 'white' : 'black';
    let score = 0;
    let playerCount = line.filter(cell => cell === player).length;
    let emptyCount = line.filter(cell => cell === null).length;
    if (playerCount === 5) return HEURISTIC_SCORE.FIVE;
    if (playerCount === 4 && emptyCount === 1) score += HEURISTIC_SCORE.OPEN_FOUR;
    if (playerCount === 3 && emptyCount === 2) score += HEURISTIC_SCORE.OPEN_THREE;
    let opponentCount = line.filter(cell => cell === opponent).length;
    if (opponentCount === 5) return -HEURISTIC_SCORE.FIVE;
    if (opponentCount === 4 && emptyCount === 1) score -= HEURISTIC_SCORE.OPEN_FOUR;
    if (opponentCount === 3 && emptyCount === 2) score -= HEURISTIC_SCORE.OPEN_THREE;
    return score;
}

function evaluateBoardWithLearnedData(board: (Player | null)[][], player: Player, knowledge: AIKnowledge | null): number {
    let totalScore = 0;

    if (knowledge && knowledge.size > 0) {
        for (let r = 0; r <= BOARD_SIZE - 5; r++) {
            for (let c = 0; c <= BOARD_SIZE - 5; c++) {
                const pattern: (Player | null)[][] = [];
                for (let i = 0; i < 5; i++) {
                    pattern.push(board[r + i].slice(c, c + 5));
                }
                const patternHash = hashPattern(pattern);
                if (knowledge.has(patternHash)) {
                    const { wins, losses } = knowledge.get(patternHash)!;
                    totalScore += (wins - losses);
                }
            }
        }
    }

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c <= BOARD_SIZE - 5; c++) {
            totalScore += evaluateLine(board[r].slice(c, c + 5), player);
        }
    }
    for (let c = 0; c < BOARD_SIZE; c++) {
        for (let r = 0; r <= BOARD_SIZE - 5; r++) {
            const line: (Player|null)[] = [];
            for (let i = 0; i < 5; i++) line.push(board[r + i][c]);
            totalScore += evaluateLine(line, player);
        }
    }

    return totalScore;
}

function minimax(board: (Player | null)[][], depth: number, alpha: number, beta: number, maximizingPlayer: boolean, aiPlayer: Player, knowledge: AIKnowledge | null): number {
    if (depth === 0) {
        return evaluateBoardWithLearnedData(board, aiPlayer, knowledge);
    }

    const possibleMoves = getPossibleMoves(board);
    const humanPlayer: Player = aiPlayer === 'black' ? 'white' : 'black';

    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (const [r, c] of possibleMoves) {
            const newBoard = board.map(row => [...row]);
            newBoard[r][c] = aiPlayer;
            const evaluation = minimax(newBoard, depth - 1, alpha, beta, false, aiPlayer, knowledge);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const [r, c] of possibleMoves) {
            const newBoard = board.map(row => [...row]);
            newBoard[r][c] = humanPlayer;
            const evaluation = minimax(newBoard, depth - 1, alpha, beta, true, aiPlayer, knowledge);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

export const findBestMove = (board: (Player | null)[][], player: Player, knowledge: AIKnowledge | null): [number, number] => {
    let bestVal = -Infinity;
    let bestMove: [number, number] = [-1, -1];
    const possibleMoves = getPossibleMoves(board);

    if (possibleMoves.length === 0) return [-1, -1];
    if (possibleMoves.length === 1) return possibleMoves[0];

    const searchDepth = 3;

    for (const [r, c] of possibleMoves) {
        const newBoard = board.map(row => [...row]);
        newBoard[r][c] = player;
        const moveVal = minimax(newBoard, searchDepth, -Infinity, Infinity, false, player, knowledge);

        if (moveVal > bestVal) {
            bestMove = [r, c];
            bestVal = moveVal;
        }
    }
    return bestMove;
};