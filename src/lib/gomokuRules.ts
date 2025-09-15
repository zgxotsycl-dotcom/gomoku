import type { Player } from '../types';

// Helper function to check bounds
const inBounds = (r: number, c: number, size: number) => r >= 0 && r < size && c >= 0 && c < size;

// This is a simplified check and may not cover all edge cases of Renju rules,
// but it provides a solid foundation for 3-3 and 4-4 detection.

/**
 * Analyzes a line of 6 cells in a specific direction to find patterns.
 * A line of 6 is used to correctly identify open 3s (e.g., OXXXO_)
 * @param board The game board
 * @param r The starting row
 * @param c The starting col
 * @param dr The row direction delta
 * @param dc The column direction delta
 * @param player The player to check for
 * @returns A string representing the 6 cells in the line (X for player, O for opponent, _ for empty)
 */
const getLine = (board: (Player | null)[][], r: number, c: number, dr: number, dc: number, player: Player): string => {
    const BOARD_SIZE = board.length;
    let line = '';
    for (let i = -1; i < 5; i++) { // Check a 6-cell window starting from one behind
        const cr = r + i * dr;
        const cc = c + i * dc;
        if (!inBounds(cr, cc, BOARD_SIZE)) {
            line += 'E'; // Edge of board
        } else {
            const cell = board[cr][cc];
            if (cell === player) {
                line += 'X';
            } else if (cell === null) {
                line += '_';
            } else {
                line += 'O';
            }
        }
    }
    return line;
};

/**
 * Checks how many open threes a move creates.
 * An open three is a line of three stones that is not blocked by an opponent on either side.
 * e.g., _XXX_ 
 */
const countOpenThrees = (board: (Player | null)[][], r: number, c: number, player: Player): number => {
    let count = 0;
    const directions = [{ dr: 1, dc: 0 }, { dr: 0, dc: 1 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];

    board[r][c] = player; // Temporarily place the stone

    for (const { dr, dc } of directions) {
        // Check all 4 possible positions of the new stone within a line of 3
        for (let i = -2; i <= 0; i++) {
            const line = getLine(board, r + i * dr, c + i * dc, dr, dc, player);
            // Pattern for open three: _XXX_
            if (line.substring(1, 5) === 'XXX_' && line[0] === '_' && line[5] === '_') {
                 count++;
            }
        }
    }

    board[r][c] = null; // Remove the temporary stone
    return count;
};

/**
 * Checks how many fours a move creates.
 */
const countFours = (board: (Player | null)[][], r: number, c: number, player: Player): number => {
    let count = 0;
    const directions = [{ dr: 1, dc: 0 }, { dr: 0, dc: 1 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];

    board[r][c] = player; // Temporarily place the stone

    for (const { dr, dc } of directions) {
        for (let i = -3; i <= 0; i++) {
            const line = getLine(board, r + i * dr, c + i * dc, dr, dc, player);
            // Pattern for four: _XXXX or XXXX_
            if (line.substring(1, 5) === 'XXXX') {
                count++;
            }
        }
    }

    board[r][c] = null; // Remove the temporary stone
    return count;
};


/**
 * Finds all forbidden moves for a given player.
 * @param board The game board
 * @param player The player (should be 'black')
 * @returns An array of coordinates {row, col} that are forbidden.
 */
export const findForbiddenMoves = (board: (Player | null)[][], player: Player): {row: number, col: number}[] => {
    if (player !== 'black') return [];

    const forbidden: {row: number, col: number}[] = [];

    const BOARD_SIZE = board.length;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === null) { // Only check empty cells
                // Temporarily place stone to check for violations
                board[r][c] = player;

                // Check for 3-3: creating two or more open threes
                if (countOpenThrees(board, r, c, player) >= 2) {
                    forbidden.push({ row: r, col: c });
                    board[r][c] = null; // backtrack
                    continue; // Move to next cell
                }

                // Check for 4-4: creating two or more fours
                if (countFours(board, r, c, player) >= 2) {
                    forbidden.push({ row: r, col: c });
                    board[r][c] = null; // backtrack
                    continue; // Move to next cell
                }

                // Backtrack
                board[r][c] = null;
            }
        }
    }

    return forbidden;
};
