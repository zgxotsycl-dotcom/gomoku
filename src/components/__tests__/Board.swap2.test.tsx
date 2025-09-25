import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import Board from '../Board';
import { vi } from 'vitest';

const BOARD_SIZE = 15;

const makeEmptyBoard = () => Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

const proposeBoard = (() => {
  const board = makeEmptyBoard();
  const mid = Math.floor(BOARD_SIZE / 2);
  board[mid][mid] = 'black';
  board[mid][mid + 1] = 'white';
  board[mid][mid + 2] = 'black';
  return board;
})();

const swap2OverrideRef: { current: any } = { current: null };

const mockDispatch = vi.fn();

vi.mock('../GameArea', () => ({
  default: (props: any) => {
    swap2OverrideRef.current = props.swap2Override;
    return <div data-testid="game-area" />;
  },
}));

vi.mock('../GameEndModal', () => ({ default: ({ children }: any) => <div data-testid="game-end-modal">{children}</div> }));
vi.mock('../PostGameManager', () => ({ default: () => <div data-testid="post-game-manager" /> }));
vi.mock('../PvaBackground', () => ({ default: () => <div data-testid="pva-bg" /> }));
vi.mock('../PlayerBanner', () => ({ default: () => <div data-testid="player-banner" /> }));
vi.mock('next/script', () => ({ default: () => null }));

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, profile: null }) }));

const baseState = {
  gameMode: 'pva' as const,
  board: makeEmptyBoard(),
  forbiddenMoves: [],
  history: [] as any[],
  gameState: 'waiting' as const,
  showColorSelect: true,
  difficulty: 'normal' as const,
  pendingOpening: 'none' as const,
  rematchSwap2Pending: false,
  aiPlayer: 'white' as const,
  playerRole: 'black' as const,
  winner: null,
  activeEmoticon: null,
  userProfile: null,
  turnTimeRemaining: 5000,
  currentPlayer: 'black' as const,
  startAnimKey: 0,
  isSpectator: false,
  room: null,
  gameDuration: 0,
  pendingOpeningData: null,
  isAiThinking: false,
  whatIfBoard: null,
};

vi.mock('../lib/hooks/useGomoku', () => ({
  useGomoku: () => ({
    state: baseState,
    dispatch: mockDispatch,
    socketRef: { current: null },
  }),
}));

describe('Board Swap2 flow', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    swap2OverrideRef.current = null;
    (global.fetch as any)?.mockClear?.();
  });

  beforeAll(() => {
    const fetchMock = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/swap2/propose')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ board: proposeBoard, toMove: 'white' }),
        } as Response);
      }
      if (url.includes('/api/swap2/second')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ board: proposeBoard, toMove: 'black', swapColors: false }),
        } as Response);
      }
      if (url.includes('/api/swap2/choose')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ aiColor: 'white' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  const renderBoard = () =>
    render(
      <Board
        initialGameMode="pva"
        onExit={() => undefined}
      />
    );

  it('shows Swap2 options after choosing white', async () => {
    renderBoard();

    const whiteButton = await screen.findByRole('button', { name: '백돌을 선택' });
    fireEvent.click(whiteButton);

    await waitFor(() => {
      expect(screen.getByText('Swap2 선택')).toBeInTheDocument();
    });
  });

  it('allows requesting Option3 before placing stones', async () => {
    renderBoard();

    const option3Button = await screen.findByRole('button', { name: /추가 두 수 배치/ });
    fireEvent.click(option3Button);

    await waitFor(() => {
      expect(screen.getByText('백 돌을 배치할 위치를 클릭하세요.')).toBeInTheDocument();
    });

  });

  it('completes Option3 flow and applies opening', async () => {
    renderBoard();

    const option3Button = await screen.findByRole('button', { name: /추가 두 수 배치/ });
    fireEvent.click(option3Button);

    await waitFor(() => {
      expect(screen.getByText('백 돌을 배치할 위치를 클릭하세요.')).toBeInTheDocument();
      expect(swap2OverrideRef.current).toBeTruthy();
    });

    await act(async () => {
      swap2OverrideRef.current.onClick(6, 6);
    });

    await waitFor(() => {
      expect(screen.getByText('흑 돌을 배치할 위치를 클릭하세요.')).toBeInTheDocument();
    });

    await act(async () => {
      swap2OverrideRef.current.onClick(6, 7);
    });

    await waitFor(() => {
      expect(screen.queryByText('백 돌을 배치할 위치를 클릭하세요.')).not.toBeInTheDocument();
      expect(screen.queryByText('흑 돌을 배치할 위치를 클릭하세요.')).not.toBeInTheDocument();
    });
  });
});
