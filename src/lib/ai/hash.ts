type Player = 'black' | 'white';

const HASH_WINDOW_SIZE = 3; // Looks at a 7x7 window (3 cells in each direction)
const BOARD_SIZE_HASH = 15;

function getPattern(board: (Player | null)[][], r: number, c: number, player: Player): number[][] {
    const pattern = [];
    for (let i = -HASH_WINDOW_SIZE; i <= HASH_WINDOW_SIZE; i++) {
        const row = [];
        for (let j = -HASH_WINDOW_SIZE; j <= HASH_WINDOW_SIZE; j++) {
            const newR = r + i;
            const newC = c + j;
            if (newR < 0 || newR >= BOARD_SIZE_HASH || newC < 0 || newC >= BOARD_SIZE_HASH) {
                row.push(3); // Border
            } else {
                const cell = board[newR][newC];
                if (cell === null) row.push(0);
                else row.push(cell === player ? 1 : 2); // My stone vs opponent's
            }
        }
        pattern.push(row);
    }
    return pattern;
}

function rotate(matrix: number[][]): number[][] {
    const N = matrix.length;
    const newMatrix = Array(N).fill(0).map(() => Array(N).fill(0));
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            newMatrix[j][N - 1 - i] = matrix[i][j];
        }
    }
    return newMatrix;
}

function flip(matrix: number[][]): number[][] {
    return matrix.map(row => row.slice().reverse());
}

export function getPatternHash(board: (Player | null)[][], r: number, c: number, player: Player): string {
    const pattern = getPattern(board, r, c, player);
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
