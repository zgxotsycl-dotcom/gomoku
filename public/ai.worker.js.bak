// Gomoku AI Worker - v4 (Restored Stable Version: MCTS + Heuristics + Learning Data)

self.onmessage = async (e) => {
    const { board, player, knowledge } = e.data;
    const opponent = player === 'black' ? 'white' : 'black';

    // --- Configuration ---
    const BOARD_SIZE = 15;
    const MCTS_ITERATIONS = 3000;
    const MCTS_TIMEOUT = 10000;
    const C_PARAM = 1.414;
    const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }];

    // --- Pattern Hashing Logic ---
    const HASH_WINDOW_SIZE = 3;
    function getPatternHash(b, r, c, p) {
        const pattern = [];
        for (let i = -HASH_WINDOW_SIZE; i <= HASH_WINDOW_SIZE; i++) {
            const row = [];
            for (let j = -HASH_WINDOW_SIZE; j <= HASH_WINDOW_SIZE; j++) {
                const newR = r + i, newC = c + j;
                if (newR < 0 || newR >= BOARD_SIZE || newC < 0 || newC >= BOARD_SIZE) row.push(3);
                else {
                    const cell = b[newR][newC];
                    if (cell === null) row.push(0);
                    else row.push(cell === p ? 1 : 2);
                }
            }
            pattern.push(row);
        }
        let canonicalPattern = pattern.map(row => row.join('')).join('|');
        let currentPattern = pattern;
        for (let i = 0; i < 4; i++) {
            currentPattern = rotate(currentPattern);
            const p_str = currentPattern.map(row => row.join('')).join('|');
            if (p_str < canonicalPattern) canonicalPattern = p_str;
            const flipped = flip(currentPattern);
            const fp_str = flipped.map(row => row.join('')).join('|');
            if (fp_str < canonicalPattern) canonicalPattern = fp_str;
        }
        return canonicalPattern;
    }
    function rotate(matrix) {
        const N = matrix.length;
        const newMatrix = Array(N).fill(0).map(() => Array(N).fill(0));
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) newMatrix[j][N - 1 - i] = matrix[i][j];
        return newMatrix;
    }
    function flip(matrix) { return matrix.map(row => row.slice().reverse()); }

    // --- Heuristic Evaluation Logic ---
    const HEURISTIC_SCORES = { FIVE: 10000000, OPEN_FOUR: 500000, CLOSED_FOUR: 4000, OPEN_THREE: 2500, CLOSED_THREE: 100, OPEN_TWO: 20, CLOSED_TWO: 2, ONE: 1 };
    function getScore(count, openEnds) {
        if (openEnds === 0 && count < 5) return 0;
        switch (count) {
            case 5: return HEURISTIC_SCORES.FIVE;
            case 4: return openEnds >= 2 ? HEURISTIC_SCORES.OPEN_FOUR : HEURISTIC_SCORES.CLOSED_FOUR;
            case 3: return openEnds >= 2 ? HEURISTIC_SCORES.OPEN_THREE : HEURISTIC_SCORES.CLOSED_THREE;
            case 2: return openEnds >= 2 ? HEURISTIC_SCORES.OPEN_TWO : HEURISTIC_SCORES.CLOSED_TWO;
            case 1: return HEURISTIC_SCORES.ONE;
            default: return HEURISTIC_SCORES.FIVE;
        }
    }
    function evaluateLine(line, p) {
        let score = 0, consecutive = 0, openEnds = 0;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === p) {
                consecutive++;
            } else if (line[i] === null) {
                if (consecutive > 0) { openEnds++; score += getScore(consecutive, openEnds); consecutive = 0; openEnds = 1; }
                else openEnds = 1;
            } else {
                if (consecutive > 0) score += getScore(consecutive, openEnds);
                consecutive = 0; openEnds = 0;
            }
        }
        if (consecutive > 0) score += getScore(consecutive, openEnds);
        return score;
    }
    function getMoveScore(b, r, c, p) {
        let totalScore = 0;
        const opp = p === 'black' ? 'white' : 'black';
        for (const dir of directions) {
            let line = [p];
            for (let i = 1; i < 6; i++) { const R = r + i * dir.y, C = c + i * dir.x; if (R < 0 || R >= BOARD_SIZE || C < 0 || C >= BOARD_SIZE) { line.push(opp); break; } line.push(b[R][C]); }
            for (let i = 1; i < 6; i++) { const R = r - i * dir.y, C = c - i * dir.x; if (R < 0 || R >= BOARD_SIZE || C < 0 || C >= BOARD_SIZE) { line.unshift(opp); break; } line.unshift(b[R][C]); }
            totalScore += evaluateLine(line, p);
            totalScore += evaluateLine(line, opp) * 1.1;
        }
        return totalScore;
    }

    // --- MCTS Logic ---
    const checkTerminalState = (b, p, r, c) => {
        if (p && r !== undefined && c !== undefined) {
            for (const dir of directions) {
                let count = 1;
                for(let i = 1; i < 5; i++) { if(b[r+i*dir.y]?.[c+i*dir.x] === p) count++; else break; }
                for(let i = 1; i < 5; i++) { if(b[r-i*dir.y]?.[c-i*dir.x] === p) count++; else break; }
                if (count >= 5) return p;
            }
        }
        if (b.every(row => row.every(cell => cell !== null))) return 0;
        return null;
    };
    const getPossibleMoves = (b) => {
        const moves = new Set(); let hasStones = false;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (b[r][c]) {
                    hasStones = true;
                    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
                        if (i === 0 && j === 0) continue;
                        const newR = r + i, newC = c + j;
                        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && !b[newR][newC]) moves.add(`${newR},${newC}`);
                    }
                }
            }
        }
        if (!hasStones) return [[Math.floor(BOARD_SIZE / 2), Math.floor(BOARD_SIZE / 2)]];
        return Array.from(moves).map(m => m.split(',').map(Number));
    };

    class MCTSNode {
        constructor(board, player, parent = null, move = null) {
            this.parent = parent;
            this.children = [];
            this.visits = 0;
            this.wins = 0;
            this.board = board;
            this.player = player;
            this.move = move;
            this.unexploredMoves = getPossibleMoves(this.board);
        }
        isFullyExpanded() { return this.unexploredMoves.length === 0; }
        selectBestChild() {
            let bestScore = -Infinity;
            let bestChild = null;
            for (const child of this.children) {
                if (child.visits === 0) return child;
                const score = (child.wins / child.visits) + C_PARAM * Math.sqrt(Math.log(this.visits) / child.visits);
                if (score > bestScore) { bestScore = score; bestChild = child; }
            }
            return bestChild;
        }
        expand() {
            const move = this.unexploredMoves.pop();
            const newBoard = this.board.map(row => [...row]);
            newBoard[move[0]][move[1]] = this.player;
            const nextPlayer = this.player === 'black' ? 'white' : 'black';
            const childNode = new MCTSNode(newBoard, nextPlayer, this, move);
            if (knowledge) {
                const hash = getPatternHash(this.board, move[0], move[1], this.player);
                const prior = knowledge.get(hash);
                if (prior) {
                    childNode.visits = prior.wins + prior.losses;
                    childNode.wins = prior.wins;
                }
            }
            this.children.push(childNode);
            return childNode;
        }
        simulate() {
            let tempBoard = this.board.map(row => [...row]);
            let currentPlayer = this.player;
            let terminalState = checkTerminalState(tempBoard);
            for (let i = 0; i < 80; i++) {
                if (terminalState !== null) break;
                const moves = getPossibleMoves(tempBoard);
                if (moves.length === 0) { terminalState = 0; break; }
                
                let bestHeuristicMove = moves[0];
                let bestHeuristicScore = -Infinity;
                for (const move of moves) {
                    const score = getMoveScore(tempBoard, move[0], move[1], currentPlayer);
                    if (score > bestHeuristicScore) {
                        bestHeuristicScore = score;
                        bestHeuristicMove = move;
                    }
                }
                tempBoard[bestHeuristicMove[0]][bestHeuristicMove[1]] = currentPlayer;
                terminalState = checkTerminalState(tempBoard, currentPlayer, bestHeuristicMove[0], bestHeuristicMove[1]);
                currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
            }
            if (terminalState === null) terminalState = 0;
            if (terminalState === 0) return 0.5;
            if (terminalState === this.parent?.player) return 1;
            return 0;
        }
        backpropagate(result) {
            let node = this;
            while (node !== null) {
                node.visits++;
                node.wins += result;
                result = 1 - result;
                node = node.parent;
            }
        }
    }

    const findBestMoveMCTS = (board, player) => {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const root = new MCTSNode(board, player);

            for (const move of [...root.unexploredMoves]) {
                const hash = getPatternHash(board, move[0], move[1], player);
                if (knowledge && knowledge.has(hash)) {
                    const prior = knowledge.get(hash);
                    const newBoard = board.map(row => [...row]);
                    newBoard[move[0]][move[1]] = player;
                    const childNode = new MCTSNode(newBoard, player === 'black' ? 'white' : 'black', root, move);
                    childNode.wins = prior.wins;
                    childNode.visits = prior.wins + prior.losses;
                    root.children.push(childNode);
                    root.unexploredMoves = root.unexploredMoves.filter(m => m[0] !== move[0] || m[1] !== move[1]);
                }
            }

            for (let i = 0; i < MCTS_ITERATIONS; i++) {
                if (Date.now() - startTime > MCTS_TIMEOUT) {
                    console.log(`[Worker] MCTS timeout! Iterations: ${i}`);
                    break;
                }
                let node = root;
                while (node.isFullyExpanded() && node.children.length > 0) { node = node.selectBestChild(); }
                if (!node.isFullyExpanded()) { node = node.expand(); }
                if (node) {
                    const result = node.simulate();
                    node.backpropagate(result);
                }
            }

            let bestMove = null;
            let maxVisits = -1;
            for (const child of root.children) {
                if (child.visits > maxVisits) {
                    maxVisits = child.visits;
                    bestMove = child.move;
                }
            }
            resolve(bestMove || getPossibleMoves(board, player)[0]);
        });
    };

    try {
        const move = await findBestMoveMCTS(board, player);
        self.postMessage({ row: move?.[0], col: move?.[1] });
    } catch (err) {
        console.error('[Worker] Critical error in final AI:', err);
        self.postMessage({ row: -1, col: -1 });
    }
};
