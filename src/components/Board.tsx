'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGomoku } from '../lib/hooks/useGomoku';
import GameEndModal from './GameEndModal';
import PostGameManager from './PostGameManager';
import GameArea from './GameArea';
import PvaBackground from './PvaBackground';
import PlayerBanner from './PlayerBanner';
import ColorSelect from './ColorSelect';
import Swap2OptionsModal from './Swap2OptionsModal';
import Script from 'next/script';
import type { GameMode, Game, Player } from '../types';

/* ===================== Utils & Types ===================== */
const isBrowser = typeof window !== 'undefined';

const clampNonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** 0:00.0 형식(초.1/10초) — 디자인 유지, 음수 방지 */
const formatTime = (ms: number) => {
  const safeMs = clampNonNegative(ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  const milliseconds = Math.floor((safeMs % 1000) / 100).toString();
  return `${seconds}.${milliseconds}`;
};

interface BoardProps {
  initialGameMode: GameMode;
  onExit: () => void;
  spectateRoomId?: string | null;
  replayGame?: Game | null;
  loadingOverlayActive?: boolean;
}

type BoardMatrix = (Player | null)[][];

interface Swap2Proposal {
  board: BoardMatrix;
  toMove: Player;
  pendingWhiteExtra: boolean;
}

interface Swap2DecisionState {
  board: BoardMatrix;
  toMove: Player;
}

interface Swap2Option3State {
  board: BoardMatrix;
  stage: 'white' | 'black';
}

interface ApplyOpeningDetail {
  board: BoardMatrix;
  toMove?: Player;
}

type PlayerChoice = 'black' | 'white';

/* ===================== Pure helpers ===================== */
const cloneBoard = (board: BoardMatrix): BoardMatrix =>
  board.map((row) => [...row]) as BoardMatrix;

/** 서버 응답을 안전한 보드 행렬로 파싱 */
const toBoardMatrix = (board: unknown): BoardMatrix | null => {
  if (!Array.isArray(board) || board.length === 0) return null;
  const size = board.length;
  const matrix: BoardMatrix = Array.from({ length: size }, () => Array(size).fill(null) as (Player | null)[]);
  for (let r = 0; r < size; r++) {
    const row = board[r];
    if (!Array.isArray(row) || row.length !== size) return null;
    for (let c = 0; c < size; c++) {
      const cell = row[c];
      if (cell === 'black' || cell === 'white' || cell === null) {
        matrix[r][c] = cell;
      } else {
        matrix[r][c] = null;
      }
    }
  }
  return matrix;
};

const findFirstEmptyAround = (board: BoardMatrix, r0: number, c0: number, rings = 2): [number, number] => {
  const size = board.length;
  for (let rad = 1; rad <= rings; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r >= 0 && c >= 0 && r < size && c < size && board[r][c] === null) {
          return [r, c];
        }
      }
    }
  }
  // 아무 데나
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === null) return [r, c];
    }
  }
  return [-1, -1];
};

/** 서버 실패 시 로컬 폴백 제안(스왑2 규칙의 최초 3수 구성) */
const createFallbackSwap2 = (size: number): { board: BoardMatrix; toMove: Player } => {
  const board = Array.from({ length: size }, () => Array(size).fill(null) as (Player | null)[]);
  const mid = Math.floor(size / 2);
  board[mid][mid] = 'black';
  const [wr, wc] = findFirstEmptyAround(board, mid, mid, 1);
  if (wr !== -1) board[wr][wc] = 'white';
  const [br, bc] = findFirstEmptyAround(board, mid, mid, 1);
  if (br !== -1) board[br][bc] = 'black';
  return { board, toMove: 'white' };
};

const truthy = (v: unknown) => v === true || v === 'true' || v === 1;

/** 다양한 서버 필드 네이밍을 허용하여 White extra 요청 여부 추정 */
const shouldRequestExtraWhite = (payload: any): boolean => {
  if (!payload) return false;
  const booleanFlags = [
    payload?.pendingWhiteExtra,
    payload?.requireExtraWhite,
    payload?.requiresExtraWhite,
    payload?.requestExtraWhite,
    payload?.needsExtraWhite,
    payload?.needExtraWhite,
    payload?.whiteExtra,
  ];
  if (booleanFlags.some(truthy)) return true;

  const keywordSources = [
    payload?.request,
    payload?.option,
    payload?.nextPhase,
    payload?.extra,
    payload?.phase,
    payload?.extraPhase,
  ].map((value) => (typeof value === 'string' ? value.toLowerCase() : ''));

  return keywordSources.some((field) => field.includes('white_extra') || field.includes('extra_white'));
};

const isAbortError = (err: unknown): err is DOMException =>
  err instanceof DOMException && err.name === 'AbortError';

const fetchWithTimeout = async (input: RequestInfo, init: RequestInit = {}, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/* ===================== Component ===================== */
const Board = ({ initialGameMode, onExit, spectateRoomId = null, replayGame = null, loadingOverlayActive = false }: BoardProps) => {
  const { t } = useTranslation();
  const { state, dispatch, socketRef } = useGomoku(initialGameMode, onExit, spectateRoomId, replayGame);

  const [swap2Decision, setSwap2Decision] = useState<Swap2DecisionState | null>(null);
  const [swap2PreviewBoard, setSwap2PreviewBoard] = useState<BoardMatrix | null>(null);
  const [swap2Option3State, setSwap2Option3State] = useState<Swap2Option3State | null>(null);
  const [swap2Processing, setSwap2Processing] = useState(false);
  const swap2ProposalRef = useRef<Swap2Proposal | null>(null);

  const isPVA = state.gameMode === 'pva';
  const isOpeningWaiting = state.history.length === 0 && state.gameState === 'waiting';
  const currentHumanColor: Player = state.playerRole ?? (state.aiPlayer === 'white' ? 'black' : 'white');

  const winnerName = useMemo(() => {
    if (!state.winner) return '';
    if (state.gameMode === 'pva') {
      return state.winner === state.aiPlayer ? 'Gomoku AI' : state.userProfile?.username || 'Player';
    }
    return state.winner.charAt(0).toUpperCase() + state.winner.slice(1);
  }, [state.winner, state.gameMode, state.aiPlayer, state.userProfile?.username]);

  const { extraWhitePending, extraWhitePlacementsLeft } = useMemo(() => {
    const pending = state.pendingOpening === 'white_extra2' || state.pendingOpening === 'white_extra1';
    const left = state.pendingOpening === 'white_extra2' ? 2 : state.pendingOpening === 'white_extra1' ? 1 : 0;
    return { extraWhitePending: pending, extraWhitePlacementsLeft: left };
  }, [state.pendingOpening]);

  // PVA 배너용 프로필 구성 (메모이즈)
  const { p1Profile, p2Profile } = useMemo(() => {
    if (!isPVA) return { p1Profile: null, p2Profile: null };
    const humanProfile = state.userProfile;
    const aiProfile = {
      id: 'ai',
      username: 'Gomoku AI',
      elo_rating: 1500,
      is_supporter: true,
      nickname_color: '#FFD700',
      badge_color: '#FFD700',
      banner_color: '#4A5568',
    } as any;
    const humanPlayerIsBlack = (currentHumanColor === 'black');
    return {
      p1Profile: humanPlayerIsBlack ? humanProfile : aiProfile,
      p2Profile: humanPlayerIsBlack ? aiProfile : humanProfile,
    };
  }, [isPVA, state.userProfile, currentHumanColor]);

  /** 스왑2 최종 적용 */
  const finalizeSwap2Opening = useCallback(
    (board: BoardMatrix, aiColor: Player, toMove: Player, options?: { pendingWhiteExtra?: boolean }) => {
      const boardCopy = cloneBoard(board);
      dispatch({ type: 'SET_AI_PLAYER', payload: aiColor });
      dispatch({
        type: 'APPLY_OPENING',
        payload: { board: boardCopy, toMove, aiPlayer: aiColor, pendingWhiteExtra: !!options?.pendingWhiteExtra },
      });
      dispatch({ type: 'HIDE_COLOR_SELECT' });
      dispatch({ type: 'SET_GAME_STATE', payload: 'playing' });
      dispatch({ type: 'TRIGGER_START_ANIM' });
      dispatch({ type: 'SET_REMATCH_SWAP2_PENDING', payload: false });
      setSwap2Decision(null);
      setSwap2PreviewBoard(null);
      setSwap2Option3State(null);
      setSwap2Processing(false);
      swap2ProposalRef.current = null;
    },
    [dispatch]
  );

  /** 서버 제안 요청(캐시/폴백) */
  const ensureSwap2Proposal = useCallback(async (): Promise<Swap2Proposal> => {
    if (swap2ProposalRef.current) return swap2ProposalRef.current;
    const size = state.board?.length || 15;

    try {
      const respProp = await fetchWithTimeout(
        '/api/swap2/propose',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ board: state.board }),
        },
        6000
      );
      if (!respProp.ok) throw new Error(`Swap2 propose failed: ${respProp.status}`);

      const prop = await respProp.json();
      const parsed = toBoardMatrix(prop?.board);
      if (!parsed) throw new Error('Swap2 propose returned invalid board');

      const toMove: Player = prop?.toMove === 'black' || prop?.toMove === 'white' ? prop.toMove : 'white';
      const proposal: Swap2Proposal = {
        board: cloneBoard(parsed),
        toMove,
        pendingWhiteExtra: shouldRequestExtraWhite(prop),
      };
      swap2ProposalRef.current = proposal;
      setSwap2PreviewBoard(cloneBoard(proposal.board));
      return proposal;
    } catch (err) {
      if (!isAbortError(err)) console.error('Swap2 propose failed, using fallback:', err);
      const local = createFallbackSwap2(size);
      const fallbackProposal: Swap2Proposal = {
        board: cloneBoard(local.board),
        toMove: local.toMove,
        pendingWhiteExtra: false,
      };
      swap2ProposalRef.current = fallbackProposal;
      setSwap2PreviewBoard(cloneBoard(fallbackProposal.board));
      return fallbackProposal;
    }
  }, [state.board]);

  /** 색 선택 처리 (수동/자동) */
  const onChooseColor = useCallback(
    async (color: PlayerChoice, auto = false) => {
      if (swap2Processing) return;

      const size = state.board?.length || 15;

      const fallback = () => {
        const local = createFallbackSwap2(size);
        const boardClone = cloneBoard(local.board);
        swap2ProposalRef.current = { board: boardClone, toMove: local.toMove, pendingWhiteExtra: false };
        setSwap2PreviewBoard(boardClone);
        if (color === 'black') {
          finalizeSwap2Opening(boardClone, 'white', local.toMove);
        } else {
          dispatch({ type: 'HIDE_COLOR_SELECT' });
          if (auto) {
            finalizeSwap2Opening(boardClone, 'black', local.toMove);
            swap2ProposalRef.current = null;
          } else {
            setSwap2Decision({ board: boardClone, toMove: local.toMove });
            setSwap2Option3State(null);
          }
        }
      };

      // 흑 선택: 서버에 second 결정도 요청
      if (color === 'black') {
        setSwap2Processing(true);
        try {
          const proposal = await ensureSwap2Proposal();
          let proposalBoard = cloneBoard(proposal.board);
          let toMove = proposal.toMove;
          let aiColor: Player = 'white';
          let pendingWhiteExtra = proposal.pendingWhiteExtra;

          try {
            const respSecond = await fetchWithTimeout(
              '/api/swap2/second',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ board: proposal.board }),
              },
              4000
            );

            if (respSecond.ok) {
              const decision = await respSecond.json();

              const nextBoard = toBoardMatrix(decision?.board);
              if (nextBoard) proposalBoard = cloneBoard(nextBoard);

              if (decision?.toMove === 'black' || decision?.toMove === 'white') {
                toMove = decision.toMove;
              }

              // swapColors 명시(불리언/문자/숫자 수용)
              const swapColorsNormalized =
                typeof decision?.swapColors === 'boolean'
                  ? decision.swapColors
                  : decision?.swapColors === 'true' || decision?.swapColors === 1;

              if (swapColorsNormalized) {
                aiColor = 'black';
                if (!(decision?.toMove === 'black' || decision?.toMove === 'white')) {
                  toMove = 'black';
                }
              } else {
                aiColor = 'white';
              }

              if (shouldRequestExtraWhite(decision)) {
                pendingWhiteExtra = true;
              }
            } else {
              console.warn('Swap2 second returned non-OK status', respSecond.status);
            }
          } catch (err) {
            if (!isAbortError(err)) {
              console.warn('Swap2 second step failed; continuing with proposal board', err);
            }
          }

          finalizeSwap2Opening(
            proposalBoard,
            aiColor,
            toMove,
            pendingWhiteExtra ? { pendingWhiteExtra: true } : undefined
          );
          return;
        } catch (err) {
          if (!isAbortError(err)) console.error('Swap2 setup failed:', err);
          fallback();
          return;
        } finally {
          setSwap2Processing(false);
        }
      }

      // 백 선택
      setSwap2Processing(true);
      try {
        const proposal = await ensureSwap2Proposal();
        const baseBoard = cloneBoard(proposal.board);
        dispatch({ type: 'HIDE_COLOR_SELECT' });

        if (auto) {
          finalizeSwap2Opening(baseBoard, 'black', proposal.toMove);
          swap2ProposalRef.current = null;
        } else {
          setSwap2Decision({ board: baseBoard, toMove: proposal.toMove });
          setSwap2PreviewBoard(cloneBoard(baseBoard));
          setSwap2Option3State(null);
        }
      } catch (err) {
        if (!isAbortError(err)) console.error('Swap2 setup failed:', err);
        dispatch({ type: 'HIDE_COLOR_SELECT' });
        fallback();
      } finally {
        setSwap2Processing(false);
      }
    },
    [swap2Processing, state.board, ensureSwap2Proposal, finalizeSwap2Opening, dispatch]
  );

  const handleSwap2StayWhite = useCallback(() => {
    if (!swap2Decision) return;
    finalizeSwap2Opening(cloneBoard(swap2Decision.board), 'black', swap2Decision.toMove || 'white');
  }, [swap2Decision, finalizeSwap2Opening]);

  const handleSwap2SwapToBlack = useCallback(() => {
    if (!swap2Decision) return;
    finalizeSwap2Opening(cloneBoard(swap2Decision.board), 'white', 'black');
  }, [swap2Decision, finalizeSwap2Opening]);

  const handleSwap2Option3Start = useCallback(() => {
    if (!swap2Decision) return;
    const boardCopy = cloneBoard(swap2Decision.board);
    setSwap2Option3State({ board: boardCopy, stage: 'white' });
    setSwap2PreviewBoard(boardCopy);
  }, [swap2Decision]);

  const finalizeOption3 = useCallback(
    async (board: BoardMatrix) => {
      try {
        setSwap2Processing(true);
        const resp = await fetchWithTimeout(
          '/api/swap2/choose',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ board }),
          },
          4000
        );
        let aiColor: Player = 'black';
        if (resp.ok) {
          const data = await resp.json();
          if (data?.aiColor === 'white') aiColor = 'white';
        } else {
          console.warn('Swap2 choose returned non-OK status', resp.status);
        }
        const nextToMove: Player = 'black';
        finalizeSwap2Opening(board, aiColor, nextToMove);
      } catch (e) {
        if (!isAbortError(e)) console.error('Swap2 choose failed:', e);
        finalizeSwap2Opening(board, 'black', 'black');
      }
    },
    [finalizeSwap2Opening]
  );

  const handleSwap2BoardClick = useCallback(
    (row: number, col: number) => {
      if (!swap2Option3State) return;
      const boardCopy = cloneBoard(swap2Option3State.board);
      if (boardCopy[row][col] !== null) return;

      if (swap2Option3State.stage === 'white') {
        boardCopy[row][col] = 'white';
        setSwap2Option3State({ board: boardCopy, stage: 'black' });
        setSwap2PreviewBoard(boardCopy);
      } else if (swap2Option3State.stage === 'black') {
        boardCopy[row][col] = 'black';
        setSwap2Option3State(null);
        setSwap2PreviewBoard(boardCopy);
        void finalizeOption3(boardCopy);
      }
    },
    [swap2Option3State, finalizeOption3]
  );

  const swap2BoardOverride = useMemo(() => {
    if (!swap2PreviewBoard) return null;
    return {
      board: swap2PreviewBoard,
      active: !!swap2Option3State && !swap2Processing,
      onClick: handleSwap2BoardClick,
    };
  }, [swap2PreviewBoard, swap2Option3State, swap2Processing, handleSwap2BoardClick]);

  /* ========== Lifecycle: Color select 활성화/초기화 & 프리페치 ========== */
  const colorSelectActiveRef = useRef(false);

  // ColorSelect가 처음 나타날 때 내부 상태 초기화
  useEffect(() => {
    const active = isPVA && isOpeningWaiting && state.showColorSelect && !loadingOverlayActive;
    if (active && !colorSelectActiveRef.current) {
      setSwap2Decision(null);
      setSwap2PreviewBoard(null);
      setSwap2Option3State(null);
      setSwap2Processing(false);
    }
    colorSelectActiveRef.current = active;
  }, [isPVA, isOpeningWaiting, state.showColorSelect, loadingOverlayActive]);

  // ColorSelect가 열리면 서버 제안 미리 확보 (중복 방지 가드 포함)
  useEffect(() => {
    const active = isPVA && isOpeningWaiting && state.showColorSelect && !loadingOverlayActive;
    if (!active) return;

    if (swap2ProposalRef.current) {
      setSwap2PreviewBoard(cloneBoard(swap2ProposalRef.current.board));
      return;
    }

    let cancelled = false;
    const shouldToggle = !swap2Processing;
    if (shouldToggle) setSwap2Processing(true);

    (async () => {
      try {
        await ensureSwap2Proposal();
      } finally {
        if (!cancelled && shouldToggle) setSwap2Processing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isPVA,
    isOpeningWaiting,
    state.showColorSelect,
    loadingOverlayActive,
    swap2Processing,
    ensureSwap2Proposal,
  ]);

  /* ========== Custom event: apply-opening (replay/실험용) ========== */
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent<ApplyOpeningDetail>)?.detail;
      if (!data || !data.board) return;
      dispatch({
        type: 'APPLY_OPENING',
        payload: { board: data.board, toMove: data.toMove || 'white' },
      });
    };
    if (isBrowser) window.addEventListener('apply-opening', handler as EventListener);
    return () => {
      if (isBrowser) window.removeEventListener('apply-opening', handler as EventListener);
    };
  }, [dispatch]);

  // 로딩 오버레이가 떠 있는 동안에는 색상 선택 UI를 숨긴다
  useEffect(() => {
    if (!isPVA) return;
    if (!loadingOverlayActive) return;
    if (!state.showColorSelect) return;
    dispatch({ type: 'HIDE_COLOR_SELECT' });
  }, [isPVA, loadingOverlayActive, state.showColorSelect, dispatch]);

  /* ========== 자동 ColorSelect 오픈 (초기 대기 시) ========== */
  useEffect(() => {
    if (!isPVA) return;
    if (state.difficulty !== 'normal') return;
    if (!isOpeningWaiting) return;
    if (loadingOverlayActive) return;
    if (state.rematchSwap2Pending) return;
    if (state.showColorSelect) return;
    if (swap2Decision || swap2Option3State || swap2Processing) return;
    dispatch({ type: 'SHOW_COLOR_SELECT' });
  }, [
    isPVA,
    state.difficulty,
    isOpeningWaiting,
    loadingOverlayActive,
    state.rematchSwap2Pending,
    state.showColorSelect,
    swap2Decision,
    swap2Option3State,
    swap2Processing,
    dispatch,
  ]);

  /* ========== 리매치: 기존 인간 색상 유지해서 자동 선택 ========== */
  useEffect(() => {
    if (!isPVA) return;
    if (state.difficulty !== 'normal') return;
    if (!state.rematchSwap2Pending) return;
    if (!isOpeningWaiting) return;
    if (loadingOverlayActive) return;
    const autoColor: PlayerChoice = currentHumanColor;
    void onChooseColor(autoColor, true);
  }, [
    isPVA,
    state.difficulty,
    state.rematchSwap2Pending,
    isOpeningWaiting,
    loadingOverlayActive,
    state.aiPlayer,
    state.playerRole,
    currentHumanColor,
    onChooseColor,
  ]);

  /* ===================== Render ===================== */
  return (
    <>
      {/* 색상 선택 모달 */}
      <ColorSelect
        visible={
          isPVA &&
          state.difficulty === 'normal' &&
          state.showColorSelect &&
          isOpeningWaiting &&
          !loadingOverlayActive
        }
        onSelect={(c) => {
          // 안전하게 비동기 처리
          void onChooseColor(c);
        }}
        timeoutMs={7000}
        onTimeout={() => {
          const fallback: PlayerChoice = currentHumanColor;
          void onChooseColor(fallback, true);
        }}
      />

      {/* 스왑2: 선택지 모달 */}
      <Swap2OptionsModal
        visible={!!swap2Decision && !swap2Option3State && !swap2Processing}
        loading={swap2Processing}
        onStayWhite={handleSwap2StayWhite}
        onSwapToBlack={handleSwap2SwapToBlack}
        onForceFirstChoice={handleSwap2Option3Start}
        onCancel={() => {
          setSwap2Decision(null);
          setSwap2PreviewBoard(null);
          dispatch({ type: 'SHOW_COLOR_SELECT' });
        }}
      />

      {/* 스왑2: 옵션3 배치 안내 */}
      {swap2Option3State && (
        <div className="fixed top-16 inset-x-0 z-40 flex justify-center" role="status" aria-live="polite">
          <div className="px-4 py-2 rounded-lg bg-black/70 text-gray-100 text-sm shadow-lg flex items-center gap-4">
            <span>
              {swap2Option3State.stage === 'white'
                ? '백 돌을 배치할 위치를 클릭하세요.'
                : '흑 돌을 배치할 위치를 클릭하세요.'}
            </span>
            {swap2Decision && (
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-500 text-gray-200 hover:bg-gray-700 transition"
                onClick={() => {
                  setSwap2Option3State(null);
                  setSwap2PreviewBoard(cloneBoard(swap2Decision.board));
                }}
              >
                되돌리기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 추가 백 수 안내 */}
      {extraWhitePending && !swap2Option3State && (
        <div className="fixed top-16 inset-x-0 z-40 flex justify-center pointer-events-none" role="status" aria-live="polite">
          <div className="px-4 py-2 rounded-lg bg-black/70 text-gray-100 text-sm shadow-lg">
            <span>AI가 추가 백 수 배치를 요청했습니다. 남은 백 돌 {extraWhitePlacementsLeft}개를 더 놓아주세요.</span>
          </div>
        </div>
      )}

      {/* 진행 중 오버레이 */}
      {swap2Processing && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-600 text-gray-100 text-sm shadow-lg">
            Swap2 결정을 적용하는 중...
          </div>
        </div>
      )}

      {/* 배경 */}
      {isPVA && <PvaBackground />}

      <div className="w-full h-full relative">
        {/* 뒤로가기 */}
        <div className="fixed top-4 left-4 z-50">
          <button onClick={onExit} className="text-gray-400 hover:text-gray-200 p-2 transition-colors btn-hover-scale">
            {t('Back')}
          </button>
        </div>

        <div className="flex flex-col items-center w-full h-full pt-6">
          {/* PVO: 세션 스토리지에 준비된 오프닝 자동 적용 */}
          {state.gameMode === 'pvo' && state.history.length === 0 && (
            <Script id="apply-opening" strategy="afterInteractive">
              {`
                (function () {
                  try {
                    var raw = sessionStorage.getItem('openingBoard');
                    if (raw) {
                      var data = JSON.parse(raw);
                      window.dispatchEvent(new CustomEvent('apply-opening', { detail: data }));
                      sessionStorage.removeItem('openingBoard');
                    }
                  } catch (_) {}
                })();
              `}
            </Script>
          )}

          {/* PVA 배너 */}
          {isPVA && (
            <PlayerBanner
              p1Profile={p1Profile}
              p2Profile={p2Profile}
              activeEmoticon={state.activeEmoticon}
            />
          )}

          {/* 현재 턴/타이머 */}
          <div className="mb-4 h-16 flex items-center justify-center">
            {(state.gameMode === 'pva' || state.gameMode === 'pvo') &&
              state.gameState === 'playing' && (
                <div className="flex items-center gap-4 p-3 rounded-lg bg-black/30 backdrop-blur-sm shadow-lg">
                  <div
                    className={`w-8 h-8 rounded-full border-2 border-white ${
                      state.currentPlayer === 'black' ? 'bg-black' : 'bg-white'
                    }`}
                    aria-label={state.currentPlayer === 'black' ? 'Black to play' : 'White to play'}
                  />
                  <span className="text-3xl font-mono text-white w-28 text-center">
                    {formatTime(state.turnTimeRemaining)}
                  </span>
                </div>
              )}
          </div>

          {/* 게임 보드 */}
          <GameArea
            state={state}
            dispatch={dispatch}
            replayGame={replayGame}
            swap2Override={swap2BoardOverride ?? undefined}
          />

          {/* 게임 종료 모달 */}
          {state.winner && (
            <GameEndModal winnerName={winnerName} duration={state.gameDuration}>
              <PostGameManager
                isPlayer={!state.isSpectator}
                isSpectator={state.isSpectator}
                onExit={onExit}
                gameMode={state.gameMode}
                room={state.room}
                socketRef={socketRef}
                onRematch={() =>
                  dispatch({ type: 'RESET_GAME', payload: { gameMode: state.gameMode, isRematch: true } })
                }
              />
            </GameEndModal>
          )}
        </div>
      </div>
    </>
  );
};

export default Board;
