const BOARD_SIZE = 19;

// Copied from Board.tsx and types removed for JS compatibility
const checkWin = (board, player, row, col) => {
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

self.onmessage = (e) => {
    console.log('AI Worker: Message received from main thread.');
    try {
        const { board, player, knowledge } = e.data;
        console.log('AI Worker: Finding best move for player:', player);
        const bestMove = findBestMove(board, player, knowledge);
        console.log('AI Worker: Best move found:', bestMove);
        self.postMessage(bestMove);
    } catch (error) {
        console.error('AI Worker: An error occurred:', error);
        self.postMessage({ row: -1, col: -1, error: error.message });
    }
};

// --- AI Logic ---

// Simple hash function for a 5x5 board pattern
const hashPattern = (pattern) => {
  return pattern.map(row => row ? row.join('') : 'n').join('|');
}

function getPossibleMoves(board) {
    const moves = new Set();
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
        return [r, c];
    });
}

// --- START: New Evaluation Logic ---

const HEURISTIC_SCORE = {
    FIVE: 100000,
    OPEN_FOUR: 10000,
    CLOSED_FOUR: 1000,
    OPEN_THREE: 500,
    CLOSED_THREE: 10,
    OPEN_TWO: 5,
    CLOSED_TWO: 1,
};

function evaluateLine(line, player) {
    const opponent = player === 'black' ? 'white' : 'black';
    let score = 0;
    
    // Offensive scores
    const playerCount = line.filter(cell => cell === player).length;
    const emptyCount = line.filter(cell => cell === null).length;
    if (playerCount === 5) return HEURISTIC_SCORE.FIVE;
    if (playerCount === 4 && emptyCount === 1) score += HEURISTIC_SCORE.OPEN_FOUR;
    if (playerCount === 3 && emptyCount === 2) score += HEURISTIC_SCORE.OPEN_THREE;
    if (playerCount === 2 && emptyCount === 3) score += HEURISTIC_SCORE.OPEN_TWO;

    // Defensive scores
    const opponentCount = line.filter(cell => cell === opponent).length;
    if (opponentCount === 5) return -HEURISTIC_SCORE.FIVE;
    // Make blocking more valuable than attacking
    if (opponentCount === 4 && emptyCount === 1) score -= HEURISTIC_SCORE.OPEN_FOUR * 1.5;
    if (opponentCount === 3 && emptyCount === 2) score -= HEURISTIC_SCORE.OPEN_THREE * 1.5;
    if (opponentCount === 2 && emptyCount === 3) score -= HEURISTIC_SCORE.OPEN_TWO * 1.5;

    return score;
}


function evaluateBoardWithLearnedData(board, player, knowledge) {
    let totalScore = 0;
    const opponent = player === 'black' ? 'white' : 'black';

    // This new evaluation function scores the board based on learned 5x5 patterns.
    // It falls back to a simple line-based heuristic for general evaluation.

    // 1. Evaluate based on learned 5x5 patterns
    if (knowledge && knowledge.size > 0) {
        for (let r = 0; r <= BOARD_SIZE - 5; r++) {
            for (let c = 0; c <= BOARD_SIZE - 5; c++) {
                const pattern = [];
                for (let i = 0; i < 5; i++) {
                    pattern.push(board[r + i].slice(c, c + 5));
                }
                const patternHash = hashPattern(pattern);
                if (knowledge.has(patternHash)) {
                    const { wins, losses } = knowledge.get(patternHash);
                    // Simple scoring: difference between wins and losses.
                    // This can be made more sophisticated.
                    totalScore += (wins - losses);
                }
            }
        }
    }

    // 2. Fallback to simple heuristic evaluation for overall board structure
    // This helps when no learned patterns are present.
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c <= BOARD_SIZE - 5; c++) {
            totalScore += evaluateLine(board[r].slice(c, c + 5), player);
        }
    }
    for (let c = 0; c < BOARD_SIZE; c++) {
        for (let r = 0; r <= BOARD_SIZE - 5; r++) {
            const line = [];
            for (let i = 0; i < 5; i++) line.push(board[r + i][c]);
            totalScore += evaluateLine(line, player);
        }
    }
    // Diagonals... (simplified for brevity, but should be included in a full implementation)

    return totalScore;
}

// --- END: New Evaluation Logic ---

function minimax(board, depth, alpha, beta, maximizingPlayer, aiPlayer, knowledge) {
    // Check for terminal state (win/loss/draw) can be added here for more accuracy
    if (depth === 0) {
        return evaluateBoardWithLearnedData(board, aiPlayer, knowledge);
    }

    const possibleMoves = getPossibleMoves(board);
    const humanPlayer = aiPlayer === 'black' ? 'white' : 'black';

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

function findBestMove(board, player, knowledge) {
    const opponent = player === 'black' ? 'white' : 'black';
    const possibleMoves = getPossibleMoves(board);

    if (possibleMoves.length === 0) return [-1, -1];

    // --- Step 1: Check for immediate win ---
    for (const [r, c] of possibleMoves) {
        const newBoard = board.map(row => [...row]);
        newBoard[r][c] = player;
        if (checkWin(newBoard, player, r, c)) {
            return [r, c];
        }
    }

    // --- Step 2: Check for immediate block ---
    for (const [r, c] of possibleMoves) {
        const newBoard = board.map(row => [...row]);
        newBoard[r][c] = opponent;
        if (checkWin(newBoard, opponent, r, c)) {
            return [r, c];
        }
    }

    // --- Step 3: If no immediate win/loss, use minimax ---
    let bestVal = -Infinity;
    let bestMove = possibleMoves[0] || [-1, -1];
    const searchDepth = 2;

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
}