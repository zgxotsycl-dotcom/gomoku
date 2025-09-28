'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useViewportScale } from '../hooks/useViewportScale';
import { useTranslation } from 'react-i18next';
import { useGomoku } from '../lib/hooks/useGomoku';
import GameEndModal from './GameEndModal';
import PostGameManager from './PostGameManager';
import GameArea from './GameArea';
import PvaBackground from './PvaBackground';
import PlayerBanner from './PlayerBanner';
import OnlineMultiplayerMenu from './OnlineMultiplayerMenu';
import RoomCodeModal from './RoomCodeModal';
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

interface Swap2SecondDecision {
  board: BoardMatrix;
  toMove: Player;
  aiColor: Player;
  pendingWhiteExtra: boolean;
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

const SWAP2_SECOND_TIMEOUT_MS = 2500;
// 런타임 기본값(환경변수)
const RANDOM_START_DEFAULT = (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_SWAP2_RANDOM_START ?? 'true')) !== 'false';
const COLOR_SELECT_TIMEOUT_DEFAULT = Number(
  (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_COLOR_SELECT_TIMEOUT_MS ?? '7000')) || '7000'
);
const BANNER_DURATION_DEFAULT = Number(
  (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_SWAP2_BANNER_MS ?? '3000')) || '3000'
);

/* ===================== Component ===================== */
const Board = ({ initialGameMode, onExit, spectateRoomId = null, replayGame = null, loadingOverlayActive = false }: BoardProps) => {
  const { t } = useTranslation();
  const { state, dispatch, socketRef } = useGomoku(initialGameMode, onExit, spectateRoomId, replayGame);
  const vp = useViewportScale();

  const [swap2Decision, setSwap2Decision] = useState<Swap2DecisionState | null>(null);
  const [swap2PreviewBoard, setSwap2PreviewBoard] = useState<BoardMatrix | null>(null);
  const [swap2Option3State, setSwap2Option3State] = useState<Swap2Option3State | null>(null);
  const [swap2Processing, setSwap2Processing] = useState(false);
  const [swap2SecondReady, setSwap2SecondReady] = useState(false);
  const [swap2Banner, setSwap2Banner] = useState<string | null>(null);
  const [option3ChooseVisible, setOption3ChooseVisible] = useState(false);
  const option3ResultBoardRef = useRef<BoardMatrix | null>(null);
  const [option3SecondIsAI, setOption3SecondIsAI] = useState(false);
  const swap2ProposalRef = useRef<Swap2Proposal | null>(null);
  const swap2ProposalPromiseRef = useRef<Promise<Swap2Proposal> | null>(null);
  const swap2SecondDecisionRef = useRef<Swap2SecondDecision | null>(null);
  const swap2SecondPromiseRef = useRef<Promise<Swap2SecondDecision> | null>(null);
  const swap2PrefetchErrorNotifiedRef = useRef(false);
  // 설정(로컬스토리지/설정창) 기반 런타임 제어값
  const [randomStart, setRandomStart] = useState<boolean>(RANDOM_START_DEFAULT);
  const [colorSelectTimeoutMs, setColorSelectTimeoutMs] = useState<number>(COLOR_SELECT_TIMEOUT_DEFAULT);
  const [bannerDurationMs, setBannerDurationMs] = useState<number>(BANNER_DURATION_DEFAULT);

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

  // Swap2 guide visibility helpers
  const inSwap2Phase = useMemo(() => {
    if (!isPVA) return false;
    if (!isOpeningWaiting) return false;
    return (
      state.showColorSelect ||
      !!swap2Decision ||
      !!swap2Option3State ||
      !!swap2PreviewBoard ||
      !swap2SecondReady
    );
  }, [isPVA, isOpeningWaiting, state.showColorSelect, swap2Decision, swap2Option3State, swap2PreviewBoard, swap2SecondReady]);

  const swap2Guide = useMemo(() => {
    if (!inSwap2Phase) return null;
    // Main/secondary texts
    let title = t('swap2.guide.title','Swap2 오프닝 진행 중');
    let detail = '';

    if (swap2Option3State) {
      // Option3 placement stage
      const stageLabel = swap2Option3State.stage === 'white'
        ? t('swap2.option3.placeWhite','흰 돌을 둘 위치를 클릭하세요.')
        : t('swap2.option3.placeBlack','검은 돌을 둘 위치를 클릭하세요.');
      const left = swap2Option3State.stage === 'white' ? 2 : 1;
      detail = `${t('swap2.guide.option3','두 수 배치')}: ${stageLabel} · ${t('swap2.guide.left','남은 수')}: ${left}`;
    } else if (state.showColorSelect) {
      title = t('swap2.guide.choose','Swap2: 색상 선택');
      detail = t('swap2.guide.chooseDetail','흑/백 선택 또는 두 수 더 두기(Option3)');
    } else if (!swap2SecondReady) {
      title = t('swap2.guide.preparing','Swap2: 두 번째 결정 준비 중');
      detail = t('swap2.guide.loading','로딩 중…');
    } else if (swap2Decision && !swap2Option3State) {
      title = t('swap2.guide.swapDecision','Swap2: 색상 유지/교환 선택');
      detail = t('swap2.guide.swapDetail','백 유지, 흑으로 교환 또는 두 수 더 두기');
    }

    return { title, detail };
  }, [inSwap2Phase, swap2Option3State, state.showColorSelect, swap2SecondReady, swap2Decision, t]);

  // Responsive sizes for timer/guide based on viewport scale
  const timerHeightCls = vp.size === 'xs' ? 'h-12' : vp.size === 'sm' ? 'h-14' : vp.size === 'md' ? 'h-16' : 'h-20';
  const timerTextCls = vp.size === 'xs' ? 'text-2xl' : vp.size === 'sm' ? 'text-3xl' : vp.size === 'md' ? 'text-4xl' : 'text-5xl';
  const guideTextCls = vp.size === 'xs' ? 'text-[10px]' : vp.size === 'sm' ? 'text-xs' : vp.size === 'md' ? 'text-sm' : 'text-base';
  const tinyLayout = (vp.size === 'xs' || vp.size === 'sm') && vp.portrait;

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

  // 설정 초기 로드 및 변경 이벤트 수신
  useEffect(() => {
    if (!isBrowser) return;
    try {
      const rs = localStorage.getItem('swap2RandomStart');
      if (rs !== null) setRandomStart(rs !== 'false');
      const ct = localStorage.getItem('colorSelectTimeoutMs');
      if (ct && !Number.isNaN(Number(ct))) setColorSelectTimeoutMs(Number(ct));
      const bm = localStorage.getItem('swap2BannerMs');
      if (bm && !Number.isNaN(Number(bm))) setBannerDurationMs(Number(bm));
    } catch {}
    const onSettingsChanged = (e: Event) => {
      const d = (e as CustomEvent<any>)?.detail || {};
      if (typeof d.randomStart === 'boolean') setRandomStart(d.randomStart);
      if (typeof d.colorSelectTimeoutMs === 'number') setColorSelectTimeoutMs(d.colorSelectTimeoutMs);
      if (typeof d.swap2BannerMs === 'number') setBannerDurationMs(d.swap2BannerMs);
    };
    window.addEventListener('settings-changed', onSettingsChanged as EventListener);
    return () => window.removeEventListener('settings-changed', onSettingsChanged as EventListener);
  }, []);

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
      setSwap2SecondReady(false);
      swap2ProposalRef.current = null;
      swap2ProposalPromiseRef.current = null;
      swap2SecondDecisionRef.current = null;
      swap2SecondPromiseRef.current = null;
      swap2PrefetchErrorNotifiedRef.current = false;
    },
    [dispatch]
  );

  /** 서버 제안 요청(캐시/폴백) */
  const ensureSwap2Proposal = useCallback(async (): Promise<Swap2Proposal> => {
    if (swap2ProposalRef.current) return swap2ProposalRef.current;
    if (swap2ProposalPromiseRef.current) return swap2ProposalPromiseRef.current;

    const size = state.board?.length || 15;

    const pending = (async () => {
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
        if (!isAbortError(err) && !swap2PrefetchErrorNotifiedRef.current) {
          console.error('Swap2 propose failed, using fallback:', err);
          swap2PrefetchErrorNotifiedRef.current = true;
          // 비차단 안내 배너: AI 서버 연결 실패 시 로컬 폴백으로 시작
          setSwap2Banner(t('swap2.banner.localFallback1','AI 서버 연결이 원활하지 않아 로컬로 시작합니다.'));
          setTimeout(() => setSwap2Banner(null), bannerDurationMs);
        }
        const local = createFallbackSwap2(size);
        const fallbackProposal: Swap2Proposal = {
          board: cloneBoard(local.board),
          toMove: local.toMove,
          pendingWhiteExtra: false,
        };
        swap2ProposalRef.current = fallbackProposal;
        setSwap2PreviewBoard(cloneBoard(fallbackProposal.board));
        return fallbackProposal;
      } finally {
        swap2ProposalPromiseRef.current = null;
      }
    })();

    swap2ProposalPromiseRef.current = pending;
    return pending;
  }, [state.board, bannerDurationMs, t]);

  const ensureSwap2SecondDecision = useCallback(async (): Promise<Swap2SecondDecision | null> => {
    if (swap2SecondDecisionRef.current) return swap2SecondDecisionRef.current;
    if (swap2SecondPromiseRef.current) return swap2SecondPromiseRef.current;

    const pending = (async () => {
      const proposal = await ensureSwap2Proposal();
      const baseDecision: Swap2SecondDecision = {
        board: cloneBoard(proposal.board),
        toMove: proposal.toMove,
        aiColor: 'white',
        pendingWhiteExtra: proposal.pendingWhiteExtra,
      };

      try {
        const respSecond = await fetchWithTimeout(
          '/api/swap2/second',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ board: proposal.board }),
          },
          SWAP2_SECOND_TIMEOUT_MS
        );

        if (respSecond.ok) {
          const decision = await respSecond.json();
          const nextBoard = toBoardMatrix(decision?.board);
          const resolvedBoard = nextBoard ? cloneBoard(nextBoard) : cloneBoard(proposal.board);

          let toMove: Player =
            decision?.toMove === 'black' || decision?.toMove === 'white' ? decision.toMove : proposal.toMove;
          let aiColor: Player = 'white';

          const swapColorsNormalized =
            typeof decision?.swapColors === 'boolean'
              ? decision.swapColors
              : decision?.swapColors === 'true' || decision?.swapColors === 1;

          if (swapColorsNormalized) {
            aiColor = 'black';
            // 스왑 후에는 백이 다음 수를 두도록 기본값을 'white'로 설정
            if (!(decision?.toMove === 'black' || decision?.toMove === 'white')) {
              toMove = 'white';
            }
          } else {
            aiColor = 'white';
          }

          const pendingWhiteExtra = proposal.pendingWhiteExtra || shouldRequestExtraWhite(decision);

          const normalized: Swap2SecondDecision = {
            board: resolvedBoard,
            toMove,
            aiColor,
            pendingWhiteExtra,
          };

          swap2SecondDecisionRef.current = normalized;
          return normalized;
        }

        console.warn('Swap2 second returned non-OK status', respSecond.status);
        swap2SecondDecisionRef.current = baseDecision;
        return baseDecision;
      } catch (err) {
        if (!isAbortError(err) && !swap2PrefetchErrorNotifiedRef.current) {
          console.warn('Swap2 second step failed; continuing with proposal board', err);
          swap2PrefetchErrorNotifiedRef.current = true;
          setSwap2Banner(t('swap2.banner.localFallback2','AI 서버 연결이 일시적으로 느려 로컬로 진행합니다.'));
          setTimeout(() => setSwap2Banner(null), bannerDurationMs);
        }
        swap2SecondDecisionRef.current = baseDecision;
        return baseDecision;
      } finally {
        swap2SecondPromiseRef.current = null;
      }
    })();

    swap2SecondPromiseRef.current = pending;
    return pending;
  }, [ensureSwap2Proposal, bannerDurationMs, t]);

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
            setSwap2PreviewBoard(boardClone);
            setSwap2Option3State(null);
          }
        }
      };

      // 흑 선택: 프리페치된 second 결정을 우선 적용
      if (color === 'black') {
        setSwap2Processing(true);
        try {
          const decision = await ensureSwap2SecondDecision();
          if (decision) {
            if (decision.pendingWhiteExtra) {
              const base = cloneBoard(decision.board);
              dispatch({ type: 'HIDE_COLOR_SELECT' });
              setSwap2Decision({ board: base, toMove: decision.toMove });
              setSwap2PreviewBoard(base);
              setOption3SecondIsAI(true);
              setSwap2Option3State({ board: base, stage: 'white' });
              setSwap2Banner('AI가 두 수 더를 요청했습니다. 백 1수 → 흑 1수를 두어주세요.');
              setTimeout(() => setSwap2Banner(null), bannerDurationMs);
              return;
            } else {
              finalizeSwap2Opening(
                cloneBoard(decision.board),
                decision.aiColor,
                decision.toMove,
                decision.pendingWhiteExtra ? { pendingWhiteExtra: true } : undefined
              );
              return;
            }
          }

          const proposal = await ensureSwap2Proposal();
          finalizeSwap2Opening(
            cloneBoard(proposal.board),
            'white',
            proposal.toMove,
            proposal.pendingWhiteExtra ? { pendingWhiteExtra: true } : undefined
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
        const pendingExtra = proposal.pendingWhiteExtra ? { pendingWhiteExtra: true } : undefined;
        dispatch({ type: 'HIDE_COLOR_SELECT' });

        if (auto) {
          finalizeSwap2Opening(baseBoard, 'black', proposal.toMove, pendingExtra);
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
    [
      swap2Processing,
      state.board,
      ensureSwap2Proposal,
      ensureSwap2SecondDecision,
      finalizeSwap2Opening,
      dispatch,
      bannerDurationMs,
    ]
  );

  const handleSwap2StayWhite = useCallback(() => {
    if (!swap2Decision) return;
    finalizeSwap2Opening(cloneBoard(swap2Decision.board), 'black', swap2Decision.toMove || 'white');
  }, [swap2Decision, finalizeSwap2Opening]);

  const handleSwap2SwapToBlack = useCallback(() => {
    if (!swap2Decision) return;
    // 스왑 후에는 백(white)이 다음 수를 두도록 toMove를 'white'로 설정하여
    // 흑이 즉시 한 수 더 두는 현상을 방지합니다.
    finalizeSwap2Opening(cloneBoard(swap2Decision.board), 'white', 'white');
  }, [swap2Decision, finalizeSwap2Opening]);

  const handleSwap2Option3Start = useCallback(() => {
    if (!swap2Decision) return;
    const boardCopy = cloneBoard(swap2Decision.board);
    setOption3SecondIsAI(false);
    setSwap2Option3State({ board: boardCopy, stage: 'white' });
    setSwap2PreviewBoard(boardCopy);
  }, [swap2Decision]);

  const handleColorSelectOption3 = useCallback(async () => {
    if (swap2Processing) return;
    setSwap2Processing(true);
    const size = state.board?.length || 15;
    try {
      const proposal = await ensureSwap2Proposal();
      const boardCopy = cloneBoard(proposal.board);
      dispatch({ type: 'HIDE_COLOR_SELECT' });
      setSwap2Decision({ board: boardCopy, toMove: proposal.toMove });
      setSwap2Option3State({ board: boardCopy, stage: 'white' });
      setSwap2PreviewBoard(boardCopy);
    } catch (err) {
      if (!isAbortError(err)) console.error('Swap2 option3 setup failed:', err);
      const local = createFallbackSwap2(size);
      const fallbackBoard = cloneBoard(local.board);
      dispatch({ type: 'HIDE_COLOR_SELECT' });
      setSwap2Decision({ board: fallbackBoard, toMove: local.toMove });
      setSwap2Option3State({ board: fallbackBoard, stage: 'white' });
      setSwap2PreviewBoard(fallbackBoard);
    } finally {
      setSwap2Processing(false);
    }
  }, [
    swap2Processing,
    ensureSwap2Proposal,
    dispatch,
    state.board?.length,
  ]);

  const finalizeOption3 = useCallback(
    async (board: BoardMatrix) => {
      try {
        setSwap2Processing(true);
        setSwap2Banner(t('swap2.banner.deciding','색상 결정 중...'));
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
        // Option3 마지막 수는 흑이므로, 다음 수는 백입니다.
        const nextToMove: Player = 'white';
        setSwap2Banner(`AI가 ${aiColor === 'black' ? '흑' : '백'}을 선택했습니다`);
        setTimeout(() => setSwap2Banner(null), bannerDurationMs);
        finalizeSwap2Opening(board, aiColor, nextToMove);
      } catch (e) {
        if (!isAbortError(e)) console.error('Swap2 choose failed:', e);
        setSwap2Banner(t('swap2.banner.deciding','색상 결정 중...'));
        setTimeout(() => setSwap2Banner(null), bannerDurationMs);
        finalizeSwap2Opening(board, 'black', 'white');
      }
    },
    [finalizeSwap2Opening, bannerDurationMs, t]
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
        // 두 수 배치 완료: 규칙상 두 번째 선수가 색을 선택
        option3ResultBoardRef.current = boardCopy;
        setSwap2Option3State(null);
        setSwap2PreviewBoard(boardCopy);
        if (option3SecondIsAI) { setSwap2Banner(t('swap2.banner.deciding','색상 결정 중...')); void finalizeOption3(boardCopy); } else { setOption3ChooseVisible(true); }
      }
    },
    [swap2Option3State, option3SecondIsAI, finalizeOption3, t]
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

  // 새로운 대기 상태로 진입하면 Swap2 프리페치 캐시를 초기화
  useEffect(() => {
    if (!isPVA) return;
    if (state.difficulty !== 'normal') return;
    if (!isOpeningWaiting) return;

    setSwap2SecondReady(false);
    swap2ProposalRef.current = null;
    swap2ProposalPromiseRef.current = null;
    swap2SecondDecisionRef.current = null;
    swap2SecondPromiseRef.current = null;
    swap2PrefetchErrorNotifiedRef.current = false;
  }, [isPVA, state.difficulty, isOpeningWaiting]);

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

  // ColorSelect가 열리면 프리페치된 제안을 미리 반영
  useEffect(() => {
    const active = isPVA && isOpeningWaiting && state.showColorSelect && !loadingOverlayActive;
    if (!active) return;

    if (swap2ProposalRef.current) {
      setSwap2PreviewBoard(cloneBoard(swap2ProposalRef.current.board));
      return;
    }

    void ensureSwap2Proposal();
  }, [
    isPVA,
    isOpeningWaiting,
    state.showColorSelect,
    loadingOverlayActive,
    ensureSwap2Proposal,
  ]);

  // PvA 대기 시간 동안 Swap2 전 과정을 미리 계산해 대기시간을 제거
  useEffect(() => {
    if (!isPVA) return;
    if (state.difficulty !== 'normal') return;
    if (!isOpeningWaiting) return;
    if (loadingOverlayActive) return;
    if (swap2SecondReady) return;

    let active = true;

    (async () => {
      try {
        await ensureSwap2Proposal();
        if (active) setSwap2SecondReady(true);
        await ensureSwap2SecondDecision();
      } catch (err) {
        if (!isAbortError(err) && !swap2PrefetchErrorNotifiedRef.current) {
          console.warn('Swap2 prefetch failed; fallback flows will be used', err);
          swap2PrefetchErrorNotifiedRef.current = true;
        }
        if (active) setSwap2SecondReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    isPVA,
    state.difficulty,
    isOpeningWaiting,
    loadingOverlayActive,
    swap2SecondReady,
    ensureSwap2Proposal,
    ensureSwap2SecondDecision,
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
    if (!swap2SecondReady) return;
    if (state.rematchSwap2Pending) return;
    if (state.showColorSelect) return;
    if (swap2Decision || swap2Option3State || swap2Processing) return;
    // 자동 시작 모드에서는 선택창을 열지 않습니다.
    if (!randomStart) dispatch({ type: 'SHOW_COLOR_SELECT' });
  }, [
    isPVA,
    state.difficulty,
    isOpeningWaiting,
    loadingOverlayActive,
    swap2SecondReady,
    state.rematchSwap2Pending,
    state.showColorSelect,
    swap2Decision,
    swap2Option3State,
    swap2Processing,
    dispatch,
    randomStart,
  ]);

  // Auto-start: 랜덤 색상으로 즉시 시작 (초기 진입 1회)
  const autoRandomStartedRef = useRef(false);
  useEffect(() => {
    if (!isPVA) return;
    if (state.difficulty !== 'normal') return;
    if (!isOpeningWaiting) return;
    if (loadingOverlayActive) return;
    if (!swap2SecondReady) return;
    if (state.rematchSwap2Pending) return;
    if (autoRandomStartedRef.current) return;

    if (!randomStart) return;
    autoRandomStartedRef.current = true;
    const randomColor: PlayerChoice = Math.random() < 0.5 ? 'black' : 'white';
    // 규칙상 백(후수)을 받은 경우에는 Swap2 색상 변경(스왑/옵션3) 기회를 보여줘야 하므로
    // auto=false로 전달해 옵션 모달을 표시합니다. 흑(선수)은 즉시 적용(auto=true).
    const auto = randomColor === 'black';
    void onChooseColor(randomColor, auto);
  }, [
    isPVA,
    state.difficulty,
    isOpeningWaiting,
    loadingOverlayActive,
    swap2SecondReady,
    state.rematchSwap2Pending,
    onChooseColor,
    randomStart,
  ]);

  /* ========== 리매치: 기존 인간 색상 유지해서 자동 선택 ========== */
  useEffect(() => {
    if (!isPVA) return;
    if (state.difficulty !== 'normal') return;
    if (!state.rematchSwap2Pending) return;
    if (!isOpeningWaiting) return;
    if (loadingOverlayActive) return;
    if (!swap2SecondReady) return;
    const autoColor: PlayerChoice = currentHumanColor;
    void onChooseColor(autoColor, true);
  }, [
    isPVA,
    state.difficulty,
    state.rematchSwap2Pending,
    isOpeningWaiting,
    loadingOverlayActive,
    swap2SecondReady,
    state.aiPlayer,
    state.playerRole,
    currentHumanColor,
    onChooseColor,
  ]);

  /* ===================== Render ===================== */
  return (
    <>
      {/* Swap2: Option3 placement banner */}
      <ColorSelect
        visible={
          isPVA &&
          state.difficulty === 'normal' &&
          state.showColorSelect &&
          isOpeningWaiting &&
          !loadingOverlayActive &&
          swap2SecondReady
        }
        onSelect={(c) => {
          // 안전하게 비동기 처리
          void onChooseColor(c);
        }}
        onRequestOption3={() => {
          void handleColorSelectOption3();
        }}
        timeoutMs={colorSelectTimeoutMs}
        onTimeout={() => {
          const fallback: PlayerChoice = currentHumanColor;
          void onChooseColor(fallback, true);
        }}
      />

      {/* Swap2: Option3 placement banner */}
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

      {/* Option3 banner temporarily removed to fix build */}
      {/* Swap2: Option3 placement banner */}

      {/* Swap2: Option3 placement banner */}
      {false && swap2Processing && (
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

      {/* Swap2: Option3 placement banner */}
      {isPVA && <PvaBackground />}

      {swap2Banner && (
        <div
          className="fixed inset-x-0 z-[9999] flex justify-center pointer-events-none"
          role="status"
          aria-live="polite"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 80px)' }}
        >
          <div className="px-4 py-2 rounded-lg bg-black/70 text-gray-100 text-sm shadow-lg">
            <span>{swap2Banner}</span>
          </div>
        </div>
      )}
      {/* Swap2 guide panel */}
      {swap2Guide && (
        <div
          className="fixed inset-x-0 z-[9998] flex justify-center"
          aria-live="polite"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 48px)' }}
        >
          <div className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-black/60 text-white ${guideTextCls} shadow pointer-events-none`}>
            <span className="font-semibold">{swap2Guide.title}</span>
            {swap2Guide.detail && <span className="opacity-80 ml-2">{swap2Guide.detail}</span>}
          </div>
        </div>
      )}
      {!swap2Banner && swap2Option3State && !swap2Processing && (
        <div
          className="fixed inset-x-0 z-[9998] flex justify-center pointer-events-none"
          role="status"
          aria-live="polite"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 80px)' }}
        >
          <div className="px-4 py-2 rounded-lg bg-black/70 text-gray-100 text-sm shadow-lg">
            <span>
              {swap2Option3State.stage === 'white'
                ? t('swap2.option3.placeWhite', '흰 돌을 둘 위치를 클릭하세요.')
                : t('swap2.option3.placeBlack', '검은 돌을 둘 위치를 클릭하세요.')}
            </span>
          </div>
        </div>
      )}
      {option3ChooseVisible && !swap2Processing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 md:p-6 shadow-2xl w-[92vw] max-w-[520px]">
            <h3 className="text-center text-white text-xl font-bold mb-3">{t('swap2.option3.chooseTitle','색상을 선택하세요')}</h3>
            <p className="text-center text-gray-300 mb-5 text-sm">{t('swap2.option3.chooseDesc','두 수 배치가 끝났습니다. 색상을 결정해 주세요.')}</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="px-4 py-2 md:py-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-100 text-sm md:text-base btn-hover-scale min-w-[120px] md:min-w-[160px] whitespace-nowrap"
                onClick={() => {
                  const board = option3ResultBoardRef.current; if (!board) return;
                  setOption3ChooseVisible(false);
                  finalizeSwap2Opening(board, 'black', 'white');
                }}
              >{t('swap2.option3.pickWhite','나는 백(White)')}</button>
              <button
                type="button"
                className="px-4 py-2 md:py-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-100 text-sm md:text-base btn-hover-scale min-w-[120px] md:min-w-[160px] whitespace-nowrap"
                onClick={() => {
                  const board = option3ResultBoardRef.current; if (!board) return;
                  setOption3ChooseVisible(false);
                  finalizeSwap2Opening(board, 'white', 'white');
                }}
              >{t('swap2.option3.pickBlack','나는 흑(Black)')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full h-full relative">
        {state.showRoomCodeModal && state.createdRoomId && (
          <RoomCodeModal
            roomId={state.createdRoomId}
            onClose={() => dispatch({ type: 'SET_SHOW_ROOM_CODE_MODAL', payload: false })}
          />
        )}
        {/* Swap2: Option3 placement banner */}
        <div className="fixed z-50" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)', left: 'calc(env(safe-area-inset-left, 0px) + 16px)' }}>
          <button onClick={onExit} className="text-gray-400 hover:text-gray-200 p-2 transition-colors text-sm md:text-base btn-hover-scale">
            {t('Back')}
          </button>
        </div>

        <div className="flex flex-col items-center w-full h-full min-h-0 pt-2 md:pt-6">
          {state.gameMode === 'pvo' && state.gameState === 'waiting' && (
            <div className="w-full h-full flex items-start justify-center" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 40px)' }}>
              <OnlineMultiplayerMenu
                onBack={onExit}
                setGameMode={(mode) => dispatch({ type: 'SET_GAME_MODE', payload: mode })}
                socketRef={socketRef}
                userProfile={state.userProfile}
                onlineUsers={state.onlineUsers}
                inQueueUsers={state.inQueueUsers}
                isSocketConnected={state.isSocketConnected}
              />
            </div>
          )}

          {!(state.gameMode === 'pvo' && state.gameState === 'waiting') && (
            <>
              {/* Swap2: Option3 placement banner */}
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

              {/* Swap2: Option3 placement banner */}
              {isPVA && (
                <PlayerBanner
                  p1Profile={p1Profile}
                  p2Profile={p2Profile}
                  activeEmoticon={state.activeEmoticon}
                />
              )}

              {/* Swap2: Option3 placement banner */}
              <div className={`mb-1 md:mb-4 ${timerHeightCls} flex items-center justify-center ${tinyLayout ? 'scale-90' : ''}`}>
                {(state.gameMode === 'pva' || state.gameMode === 'pvo') &&
                  state.gameState === 'playing' && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-black/30 backdrop-blur-sm shadow-lg">
                      <div
                        className={`w-8 h-8 rounded-full border-2 border-white ${
                          state.currentPlayer === 'black' ? 'bg-black' : 'bg-white'
                        }`}
                        aria-label={state.currentPlayer === 'black' ? 'Black to play' : 'White to play'}
                      />
                      <span className={`${timerTextCls} font-mono text-white w-28 text-center`}>
                        {formatTime(state.turnTimeRemaining)}
                      </span>
                    </div>
                  )}
              </div>

              {/* Swap2: Option3 placement banner */}
              <div className="w-full flex-1 min-h-0 flex gap-3">
                {vp.ultraWide && (
                  <aside className="hidden 2xl:flex w-64 min-h-0">
                    <div className="w-full h-full bg-black/30 border border-gray-700 rounded-lg p-3 text-gray-100 overflow-auto">
                      <div className="text-sm font-semibold mb-2">{t('swap2.guide.title','Swap2 오프닝 진행 중')}</div>
                      {swap2Guide ? (
                        <>
                          <div className="text-xs opacity-90 mb-1">{swap2Guide.title}</div>
                          {swap2Guide.detail && <div className="text-xs opacity-80">{swap2Guide.detail}</div>}
                        </>
                      ) : (
                        <div className="text-xs opacity-80">{t('Ready','Ready')}</div>
                      )}
                      <div className="mt-3 text-xs">
                        <div className="opacity-80 mb-1">{t('Turn','Turn')}</div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${state.currentPlayer==='black'?'bg-black border border-white':'bg-white border border-black'}`}></span>
                          <span className="capitalize">{state.currentPlayer}</span>
                        </div>
                      </div>
                    </div>
                  </aside>
                )}

                <div className="w-full flex-1 min-h-0 flex">
                  <GameArea
                    state={state}
                    dispatch={dispatch}
                    replayGame={replayGame}
                    swap2Override={swap2BoardOverride ?? undefined}
                    socketRef={socketRef}
                  />
                </div>

                {vp.ultraWide && (
                  <aside className="hidden 2xl:flex w-64 min-h-0">
                    <div className="w-full h-full bg-black/30 border border-gray-700 rounded-lg p-3 text-gray-100 overflow-auto">
                      <div className="text-sm font-semibold mb-2">{t('History','History')}</div>
                      <ol className="text-xs space-y-1">
                        {state.history.slice(-30).map((mv:any, idx:number) => (
                          <li key={`mv-${idx}`} className="flex items-center gap-2">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${mv.player==='black'?'bg-black border border-white':'bg-white border border-black'}`}></span>
                            <span className="opacity-80">{mv.player}</span>
                            <span className="opacity-60">({mv.row},{mv.col})</span>
                          </li>
                        ))}
                        {state.history.length===0 && <li className="opacity-60">{t('NoMoves','No moves yet')}</li>}
                      </ol>
                    </div>
                  </aside>
                )}

              </div>

              {/* Swap2: Option3 placement banner */}
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
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Board;



