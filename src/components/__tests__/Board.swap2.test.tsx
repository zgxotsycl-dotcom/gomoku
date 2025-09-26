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
  showColorSelect: false,
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
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ board: proposeBoard, toMove: 'white' }) } as Response);
      }
      if (url.includes('/api/swap2/second')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ board: proposeBoard, toMove: 'black', swapColors: false }) } as Response);
      }
      if (url.includes('/api/get-move')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ move: [7, 7] }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  const renderBoard = () => render(<Board initialGameMode="pva" onExit={() => undefined} />);

  it('auto-opens Swap2 options when random selects white', async () => {
    const orig = Math.random;
    (Math as any).random = () => 0.9; // force white
    renderBoard();
    await screen.findByRole('button', { name: /Option 3/i });
    ;(Math as any).random = orig;
  });

  it('allows requesting Option3 and shows placement override', async () => {
    const orig = Math.random;
    (Math as any).random = () => 0.9;
    renderBoard();
    const option3Button = await screen.findByRole('button', { name: /Option 3/i });
    fireEvent.click(option3Button);
    await waitFor(() => { expect(swap2OverrideRef.current).toBeTruthy(); });
    ;(Math as any).random = orig;
  });

  it('Option3 -> choose White: applies ai=black, toMove=white', async () => {
    const orig = Math.random;
    (Math as any).random = () => 0.9;
    renderBoard();

    fireEvent.click(await screen.findByRole('button', { name: /Option 3/i }));
    await waitFor(() => { expect(swap2OverrideRef.current).toBeTruthy(); });

    await act(async () => { swap2OverrideRef.current.onClick(6, 6); });
    await act(async () => { swap2OverrideRef.current.onClick(6, 7); });

    const chooseWhite = await screen.findByRole('button', { name: /나는 백\(White\)/ });
    fireEvent.click(chooseWhite);

    // After choosing White, next to move should be White
    await screen.findByLabelText(/White to play/i);
    ;(Math as any).random = orig;
  });

  it('Swap option sets next to move to white (prevent double black)', async () => {
    const orig = Math.random;
    (Math as any).random = () => 0.9;
    renderBoard();

    const swapButton = await screen.findByRole('button', { name: /Option 2/i });
    fireEvent.click(swapButton);

    await screen.findByLabelText(/White to play/i);
    ;(Math as any).random = orig;
  });

  it('AI-second Option3: auto color decision after W→B, next to move is white', async () => {
    // Mock endpoints so that /second requests extra white and /choose returns aiColor
    const fetchMock = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/swap2/propose')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ board: proposeBoard, toMove: 'white' }) } as Response);
      }
      if (url.includes('/api/swap2/second')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ board: proposeBoard, toMove: 'white', swapColors: false, pendingWhiteExtra: true }),
        } as Response);
      }
      if (url.includes('/api/swap2/choose')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ aiColor: 'black' }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const orig = Math.random;
    (Math as any).random = () => 0.1; // force black start (auto path)
    renderBoard();

    // Wait until swap2 override is available (Option3 auto path will be prepared)
    await waitFor(() => { expect(swap2OverrideRef.current).toBeTruthy(); });

    // Place W then B
    await act(async () => { swap2OverrideRef.current.onClick(6, 6); });
    await act(async () => { swap2OverrideRef.current.onClick(6, 7); });

    // Should auto finalize without human modal, and next to move is white
    await screen.findByLabelText(/White to play/i);

    ;(Math as any).random = orig;
    vi.unstubAllGlobals();
  });

  it('Option3 choose fallback: when /choose fails, applies fallback and next to move is white', async () => {
    const fetchMock = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/swap2/propose')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ board: proposeBoard, toMove: 'white' }) } as Response);
      }
      if (url.includes('/api/swap2/second')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ board: proposeBoard, toMove: 'white', swapColors: false, pendingWhiteExtra: true }) } as Response);
      }
      if (url.includes('/api/swap2/choose')) {
        return Promise.resolve({ ok: false, status: 500 } as unknown as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const orig = Math.random;
    (Math as any).random = () => 0.1; // force black (auto)
    renderBoard();

    await waitFor(() => { expect(swap2OverrideRef.current).toBeTruthy(); });
    await act(async () => { swap2OverrideRef.current.onClick(6, 6); });
    await act(async () => { swap2OverrideRef.current.onClick(6, 7); });

    await screen.findByLabelText(/White to play/i);

    ;(Math as any).random = orig;
    vi.unstubAllGlobals();
  });

  it('Rematch with rematchSwap2Pending auto-applies opening without user modal', async () => {
    // Override useGomoku to set rematchSwap2Pending=true
    vi.doMock('../lib/hooks/useGomoku', () => ({
      useGomoku: () => ({
        state: { ...baseState, rematchSwap2Pending: true },
        dispatch: mockDispatch,
        socketRef: { current: null },
      })
    }));

    const fetchMock = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/swap2/propose')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ board: proposeBoard, toMove: 'white' }) } as Response);
      }
      if (url.includes('/api/swap2/second')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ board: proposeBoard, toMove: 'white', swapColors: false }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const orig = Math.random;
    (Math as any).random = () => 0.4; // random branch would pick black, but rematch overrides
    const { default: Board2 } = await import('../Board');
    render(<Board2 initialGameMode="pva" onExit={() => undefined} />);

    await screen.findByLabelText(/White to play/i);

    ;(Math as any).random = orig;
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('Second returns swapColors=true with missing toMove -> defaults to white to play', async () => {
    // In this case, user random-picks black, server tells to swap colors without specifying toMove.
    const fetchMock = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/swap2/propose')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ board: proposeBoard, toMove: 'white' }) } as Response);
      }
      if (url.includes('/api/swap2/second')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ board: proposeBoard, swapColors: true }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const orig = Math.random;
    (Math as any).random = () => 0.01; // force black (auto)
    renderBoard();

    // Should auto finalize, and since swapColors with missing toMove -> next to move must be white
    await screen.findByLabelText(/White to play/i);

    ;(Math as any).random = orig;
    vi.unstubAllGlobals();
  });
});
