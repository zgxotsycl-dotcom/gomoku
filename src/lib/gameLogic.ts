import { Player } from './ai.ts';

export const BOARD_SIZE = 19;

export const checkWin = (board: (Player | null)[][], player: Player, row: number, col: number): {row: number, col: number}[] | null => {
  const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }];
  for (const dir of directions) {
    const line = [{row, col}];
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
    if (count >= 5) {
        return line.slice(0, 5);
    }
  }
  return null;
};

export const isBoardFull = (board: (Player | null)[][]): boolean => {
  return board.every(row => row.every(cell => cell !== null));
};
