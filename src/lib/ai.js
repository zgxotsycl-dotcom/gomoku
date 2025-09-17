"use strict";
/**
 * @file Gomoku AI Logic - MCTS (Monte Carlo Tree Search)
 * This file contains the core AI engine, now upgraded with a Neural Network-guided MCTS.
 * This library is intended to be used in a Deno environment.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpponent = getOpponent;
exports.checkWin = checkWin;
exports.getPossibleMoves = getPossibleMoves;
exports.findBestMoveNN = findBestMoveNN;
const tf = __importStar(require("@tensorflow/tfjs-node"));
// --- Constants ---
const BOARD_SIZE = 15;
// --- Helper Functions ---
function getOpponent(player) {
    return player === 'black' ? 'white' : 'black';
}
function checkWin(board, player, move) {
    if (!move || move[0] === -1)
        return false;
    const [r, c] = move;
    const directions = [[[0, 1], [0, -1]], [[1, 0], [-1, 0]], [[1, 1], [-1, -1]], [[-1, 1], [1, -1]]];
    for (const dir of directions) {
        let count = 1;
        for (const [dr, dc] of dir) {
            for (let i = 1; i < 5; i++) {
                const newR = r + dr * i;
                const newC = c + dc * i;
                if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === player) {
                    count++;
                }
                else {
                    break;
                }
            }
        }
        if (count >= 5)
            return true;
    }
    return false;
}
function boardToInputTensor(board, player) {
    const opponent = player === 'black' ? 'white' : 'black';
    const playerChannel = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
    const opponentChannel = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player)
                playerChannel[r][c] = 1;
            else if (board[r][c] === opponent)
                opponentChannel[r][c] = 1;
        }
    }
    const colorChannel = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(player === 'black' ? 1 : 0));
    const tensor = tf.tensor4d([playerChannel, opponentChannel, colorChannel], [1, BOARD_SIZE, BOARD_SIZE, 3]);
    return tensor.transpose([0, 2, 3, 1]);
}
function getPossibleMoves(board, radius = 1) {
    const moves = new Set();
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
    if (!hasStones)
        return [[Math.floor(BOARD_SIZE / 2), Math.floor(BOARD_SIZE / 2)]];
    return Array.from(moves).map(move => {
        const [r, c] = move.split(',').map(Number);
        return [r, c];
    });
}
// --- NN-Guided MCTS Implementation ---
class MCTSNodeNN {
    parent;
    children;
    player;
    move;
    prior;
    visits;
    valueSum;
    constructor(player, parent = null, move = null, prior = 0) {
        this.player = player;
        this.parent = parent;
        this.move = move;
        this.children = {};
        this.visits = 0;
        this.valueSum = 0;
        this.prior = prior;
    }
    get value() {
        return this.visits === 0 ? 0 : this.valueSum / this.visits;
    }
    selectChild() {
        const c_puct = 1.5;
        let bestScore = -Infinity;
        let bestChild = null;
        const sqrtTotalVisits = Math.sqrt(this.visits);
        for (const child of Object.values(this.children)) {
            const puctScore = child.value + c_puct * child.prior * (sqrtTotalVisits / (1 + child.visits));
            if (puctScore > bestScore) {
                bestScore = puctScore;
                bestChild = child;
            }
        }
        return bestChild;
    }
    expand(board, policy) {
        const possibleMoves = getPossibleMoves(board);
        for (const move of possibleMoves) {
            const [r, c] = move;
            const moveIndex = r * BOARD_SIZE + c;
            if (!(moveIndex in this.children)) {
                this.children[moveIndex] = new MCTSNodeNN(getOpponent(this.player), this, move, policy[moveIndex]);
            }
        }
    }
    backpropagate(value) {
        let node = this;
        while (node) {
            node.visits++;
            node.valueSum += value;
            value = -value;
            node = node.parent;
        }
    }
}
async function findBestMoveNN(model, board, player, timeLimit) {
    const startTime = Date.now();
    const root = new MCTSNodeNN(player);
    // Initial prediction for the root node
    const rootInputTensor = boardToInputTensor(board, player);
    const [rootPolicyTensor, rootValueTensor] = model.predict(rootInputTensor);
    const rootPolicy = await rootPolicyTensor.data();
    tf.dispose([rootInputTensor, rootPolicyTensor, rootValueTensor]);
    root.expand(board, rootPolicy);
    let simulationCount = 0;
    while (Date.now() - startTime < timeLimit) {
        const currentBoard = board.map(row => [...row]);
        let node = root;
        const path = [root];
        while (Object.keys(node.children).length > 0) {
            node = node.selectChild();
            path.push(node);
            currentBoard[node.move[0]][node.move[1]] = node.parent.player;
        }
        const inputTensor = boardToInputTensor(currentBoard, node.player);
        const [policyTensor, valueTensor] = model.predict(inputTensor);
        const value = (await valueTensor.data())[0];
        tf.dispose([inputTensor, policyTensor, valueTensor]);
        node.backpropagate(value);
        simulationCount++;
    }
    if (Object.keys(root.children).length === 0) {
        return { bestMove: [-1, -1], policy: [] };
    }
    let bestMove = null;
    let maxVisits = -1;
    for (const child of Object.values(root.children)) {
        if (child.visits > maxVisits) {
            maxVisits = child.visits;
            bestMove = child.move;
        }
    }
    return {
        bestMove: bestMove,
        policy: Object.values(root.children).map(child => ({ move: child.move, visits: child.visits }))
    };
}
