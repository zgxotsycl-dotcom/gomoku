// Gomoku AI Worker - v5.3 (FINAL, CORRECTED, and VERIFIED)

self.onmessage = async (e) => {
    const { board, player, knowledge } = e.data;
    const opponent = player === 'black' ? 'white' : 'black';

    // --- Configuration ---
    const BOARD_SIZE = 19;
    const VCF_SEARCH_DEPTH = 8; 
    const MCTS_ITERATIONS = 3000;
    const MCTS_TIMEOUT = 10000;    
    const C_PARAM = 1.414; 
    const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }];

    // --- START: Hashing, Heuristics, MCTS (Full logic from v4) ---
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
        let score = 0;
        for (let i = 0; i <= line.length - 5; i++) {
            const window = line.slice(i, i + 5);
            let playerCount = 0;
            let opponentCount = 0;
            let emptyCount = 0;
            for (const stone of window) {
                if (stone === p) playerCount++;
                else if (stone === null) emptyCount++;
                else opponentCount++;
            }

            if (playerCount > 0 && opponentCount > 0) continue; // Mixed window is not a threat

            let openEnds = 0;
            if (i > 0 && line[i-1] === null) openEnds++;
            if (i + 5 < line.length && line[i+5] === null) openEnds++;

            if (playerCount > 0) {
                 score += getScore(playerCount, openEnds);
            }
            if (opponentCount > 0) {
                 score += getScore(opponentCount, openEnds) * 1.1; // Blocking bonus
            }
        }
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
        console.log("[Worker] MCTS: Starting search...");
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
                if (i % 500 === 0) {
                    console.log(`[Worker] MCTS: Iteration ${i}...`);
                }
                if (Date.now() - startTime > MCTS_TIMEOUT) {
                    console.log(`[Worker] MCTS timeout! Iterations: ${i}`);
                    break;
                }
                let node = root;
                while (node.isFullyExpanded() && node.children.length > 0) { 
                    node = node.selectBestChild(); 
                }
                if (!node) {
                    console.log("[Worker] MCTS: Tree fully explored or stuck, breaking.");
                    break;
                }
                if (!node.isFullyExpanded()) { 
                    node = node.expand(); 
                }
                if (node) {
                    const result = node.simulate();
                    node.backpropagate(result);
                }
            }

            console.log("[Worker] MCTS: Search loop finished. Finding best move...");
            let bestMove = null;
            let maxVisits = -1;
            for (const child of root.children) {
                if (child.visits > maxVisits) {
                    maxVisits = child.visits;
                    bestMove = child.move;
                }
            }
            const moves = getPossibleMoves(board, player);
            const finalMove = bestMove || (moves.length > 0 ? moves[0] : null);
            console.log("[Worker] MCTS: Best move found:", finalMove);
            resolve(finalMove);
        });
    };
    // --- END: Hashing, Heuristics, MCTS ---

    // --- START: VCF (Forced Win) Search Engine ---
    function findThreats(b, p, len) {
        const threats = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (b[r][c] === null) {
                    b[r][c] = p;
                    if (isThreat(b, p, r, c, len)) {
                        threats.push({ r, c });
                    }
                    b[r][c] = null;
                }
            }
        }
        return threats;
    }

    function isThreat(b, p, r, c, len) {
        for (const dir of directions) {
            let consecutive = 1;
            let openEnds = 0;

            // Positive direction
            for (let i = 1; i < 6; i++) {
                const currentR = r + i * dir.y, currentC = c + i * dir.x;
                if (b[currentR]?.[currentC] === p) {
                    consecutive++;
                } else {
                    if (b[currentR]?.[currentC] === null) openEnds++;
                    break;
                }
            }

            // Negative direction
            for (let i = 1; i < 6; i++) {
                const currentR = r - i * dir.y, currentC = c - i * dir.x;
                if (b[currentR]?.[currentC] === p) {
                    consecutive++;
                } else {
                    if (b[currentR]?.[currentC] === null) openEnds++;
                    break;
                }
            }

            if (len === 5 && consecutive >= 5) return true;
            if (len < 5 && consecutive === len && openEnds >= 2) return true; 
        }
        return false;
    }

    function findVCF(b, p, depth) {
        if (depth <= 0) return null;

        const winMove = findThreats(b, p, 5)[0];
        if (winMove) return winMove;

        const threats = findThreats(b, p, 4);
        for (const threatMove of threats) {
            const tempBoard = b.map(row => [...row]);
            tempBoard[threatMove.r][threatMove.c] = p;

            const opponentBlocks = findThreats(tempBoard, p, 5);
            if (opponentBlocks.length === 0) continue;

            let canOpponentBreak = false;
            for (const blockMove of opponentBlocks) {
                tempBoard[blockMove.r][blockMove.c] = opponent;
                if (findVCF(tempBoard, p, depth - 1) === null) {
                    canOpponentBreak = true;
                }
                tempBoard[blockMove.r][blockMove.c] = null; // backtrack
                if (canOpponentBreak) break;
            }

            if (!canOpponentBreak) {
                return threatMove;
            }
        }
        return null;
    }
    // --- END: VCF Search Engine ---

    // --- Main Decision Function ---
    async function getBestMove() {
        // 1. Check for my immediate win
        const winMove = findThreats(board, player, 5)[0];
        if (winMove) return [winMove.r, winMove.c];

        // 2. Block opponent's immediate win
        const blockMove = findThreats(board, opponent, 5)[0];
        if (blockMove) return [blockMove.r, blockMove.c];

        /*
        // 3. Check for my VCF win
        const vcfMove = findVCF(board, player, VCF_SEARCH_DEPTH);
        if (vcfMove) {
            console.log("[AI] VCF Win found! Playing:", vcfMove);
            return [vcfMove.r, vcfMove.c];
        }

        // 4. Block opponent's VCF win
        const opponentVCF = findVCF(board, opponent, VCF_SEARCH_DEPTH);
        if (opponentVCF) {
            console.log("[AI] Blocking opponent VCF at:", opponentVCF);
            return [opponentVCF.r, opponentVCF.c];
        }
        */

        // 5. If no forced wins, use MCTS
        console.log("[AI] No VCF found, using MCTS...");
        return await findBestMoveMCTS(board, player);
    }

    try {
        const bestMove = await getBestMove();
        // MCTS returns [r, c], VCF returns {r, c}
        const moveObject = Array.isArray(bestMove) ? { r: bestMove[0], c: bestMove[1] } : bestMove;
        self.postMessage({ row: moveObject?.r, col: moveObject?.c });
    } catch (err) {
        console.error('[Worker] Critical error in AI:', err);
        self.postMessage({ row: -1, col: -1 });
    }
};