'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Board from '@/components/Board';
import type { GameMode } from '@/types';
import Auth from '@/components/Auth';
import dynamic from 'next/dynamic';
const AnimatedLeaderboard = dynamic(() => import('@/components/AnimatedLeaderboard'), { ssr: false });
import SettingsModal from '@/components/SettingsModal';
import SupporterBenefitsModal from '@/components/SupporterBenefitsModal';
import OnlineMultiplayerMenu from '@/components/OnlineMultiplayerMenu';
import RoomCodeModal from '@/components/RoomCodeModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useTranslation } from 'react-i18next';

import LanguageSwitcher from '@/components/LanguageSwitcher';
import { FiSettings, FiHeart, FiLogOut, FiFilm } from 'react-icons/fi';
import Ranking from '@/components/Ranking'; // WebGL 불가 시 폴백
import DifficultySelect from '@/components/DifficultySelect';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { toastOnce } from '@/lib/toastOnce';

/* ------------------------------- 상단 계정 정보 ------------------------------- */
const AccountInfo = ({ onOpenSettings, onOpenBenefits }: { onOpenSettings: () => void, onOpenBenefits: () => void }) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  return (
    <>
      {/* Desktop (md+) toolbar */}
      <div className="absolute top-4 right-4 text-white hidden md:flex items-center gap-4 z-10">
        <LanguageSwitcher />
        <span className="truncate max-w-[220px] opacity-90">{profile?.username || user?.email}</span>
        {user && !user.is_anonymous && (
          <>
            <button onClick={onOpenSettings} className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-700 btn-hover-scale">{t('Settings')}</button>
            {profile?.is_supporter ? (
              <Link href="/replays" className="px-3 py-1 bg-indigo-600 rounded hover:bg-indigo-700 btn-hover-scale">
                {t('MyReplays')}
              </Link>
            ) : (
              <button onClick={onOpenBenefits} className="px-3 py-1 bg-yellow-500 text-black rounded hover:bg-yellow-600 btn-hover-scale">
                {t('BecomeASupporter')}
              </button>
            )}
            <button onClick={() => supabase.auth.signOut()} className="px-3 py-1 bg-red-600 rounded hover:bg-red-700 btn-hover-scale">
              {t('Logout')}
            </button>
          </>
        )}
      </div>

      {/* Mobile toolbar */}
      <div className="fixed inset-x-0 z-10 flex items-center justify-between px-3 pt-2 md:hidden"
           style={{ top: 'calc(env(safe-area-inset-top, 0px))' }}>
        <div className="scale-90 origin-left">
          <LanguageSwitcher />
        </div>
        <div className="flex items-center gap-2">
          {user && !user.is_anonymous && (
            <>
              <button aria-label={t('Settings')} onClick={onOpenSettings}
                      className="p-2 rounded bg-gray-700/70 text-white hover:bg-gray-600">
                <FiSettings />
              </button>
              {profile?.is_supporter ? (
                <Link href="/replays" aria-label={t('MyReplays')}
                      className="p-2 rounded bg-indigo-600/80 text-white hover:bg-indigo-600">
                  <FiFilm />
                </Link>
              ) : (
                <button aria-label={t('BecomeASupporter')} onClick={onOpenBenefits}
                        className="p-2 rounded bg-yellow-500 text-black hover:bg-yellow-400">
                  <FiHeart />
                </button>
              )}
              <button aria-label={t('Logout')} onClick={() => supabase.auth.signOut()}
                      className="p-2 rounded bg-red-600/90 text-white hover:bg-red-600">
                <FiLogOut />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

/* ------------------------------- 광고 배너(메뉴에서만) ------------------------------- */
const AdBanner = () => {
  // 프로덕션에서만 로드해 개발 중 방해 최소화
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    const id = 'monetag-vignette-script';
    if (document.getElementById(id)) return;
    const s = document.createElement('script');
    s.id = id;
    s.src = 'https://gizokraijaw.net/vignette.min.js';
    s.setAttribute('data-zone', '9825317');
    document.body.appendChild(s);
    return () => {
      try {
        document.getElementById(id)?.remove();
        document.querySelectorAll(
          'iframe[src*="gizokraijaw"], div[id*="vignette"], div[class*="vignette"], div[id*="monetag"], div[class*="monetag"]'
        ).forEach(el => (el as HTMLElement).remove());
      } catch {}
    };
  }, []);
  return null;
};

const PvaLaunchAnimation = () => (
  <div className="launch-scene">
    <div className="launch-sphere earth" />
    <div className="launch-sphere aurora" />
    <div className="launch-trail">
      <span className="trail trail-1" />
      <span className="trail trail-2" />
      <span className="trail trail-3" />
    </div>
    <div className="launch-rocket">
      <div className="rocket-body">
        <div className="rocket-window" />
        <div className="rocket-ridge" />
      </div>
      <div className="rocket-fin fin-left" />
      <div className="rocket-fin fin-right" />
      <div className="rocket-flame">
        <span className="flame-core" />
        <span className="flame-glow" />
      </div>
    </div>
    <div className="launch-clouds">
      <span className="puff puff-1" />
      <span className="puff puff-2" />
      <span className="puff puff-3" />
    </div>
    <div className="launch-stars starfield-1" />
    <div className="launch-stars starfield-2" />
    <style jsx>{`
      .launch-scene {
        position: relative;
        width: 18rem;
        max-width: 80vw;
        aspect-ratio: 1;
        overflow: hidden;
      }
      .launch-sphere {
        position: absolute;
        border-radius: 50%;
        filter: blur(0px);
        transform-origin: center;
      }
      .earth {
        bottom: -35%;
        left: 50%;
        width: 150%;
        height: 150%;
        transform: translateX(-50%);
        background: radial-gradient(circle at 35% 30%, rgba(80, 165, 255, 0.85), rgba(12, 52, 129, 0.95) 45%, rgba(4, 16, 45, 1) 70%);
        box-shadow: 0 -30px 120px rgba(0, 120, 255, 0.35);
      }
      .aurora {
        bottom: -10%;
        left: 50%;
        width: 110%;
        height: 110%;
        transform: translateX(-50%);
        background: radial-gradient(circle at 50% 80%, rgba(74, 222, 128, 0.55), transparent 65%);
        animation: auroraPulse 6s ease-in-out infinite;
      }
      .launch-trail {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .trail {
        position: absolute;
        bottom: 12%;
        left: 52%;
        width: 8rem;
        height: 0.75rem;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0.2), rgba(80, 200, 255, 0));
        transform-origin: left center;
        opacity: 0;
        animation: trailStreak 2.8s ease-in-out infinite;
      }
      .trail-1 {
        transform: rotate(-6deg) scaleX(0.8);
        animation-delay: 0.1s;
      }
      .trail-2 {
        transform: rotate(-12deg) scaleX(1);
        animation-delay: 0.25s;
      }
      .trail-3 {
        transform: rotate(-18deg) scaleX(0.9);
        animation-delay: 0.4s;
      }
      .launch-rocket {
        position: absolute;
        bottom: 16%;
        left: 46%;
        width: 3.6rem;
        height: 8.25rem;
        transform-origin: center;
        animation: rocketFlight 4.2s cubic-bezier(0.55, 0.03, 0.21, 0.99) infinite;
      }
      .rocket-body {
        position: absolute;
        inset: 0;
        border-radius: 1.8rem 1.8rem 0.9rem 0.9rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(210, 224, 255, 0.9));
        box-shadow: 0 0 25px rgba(120, 200, 255, 0.6);
      }
      .rocket-window {
        position: absolute;
        top: 28%;
        left: 50%;
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        transform: translateX(-50%);
        background: radial-gradient(circle at 30% 35%, rgba(255, 255, 255, 0.9), rgba(81, 111, 255, 0.85));
        box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.7);
      }
      .rocket-ridge {
        position: absolute;
        bottom: 38%;
        left: 50%;
        width: 70%;
        height: 0.35rem;
        border-radius: 999px;
        transform: translateX(-50%);
        background: linear-gradient(90deg, rgba(148, 163, 184, 0.9), rgba(226, 232, 240, 0.9));
      }
      .rocket-fin {
        position: absolute;
        bottom: 0.6rem;
        width: 1.6rem;
        height: 2.6rem;
        background: linear-gradient(180deg, rgba(125, 211, 252, 0.9), rgba(59, 130, 246, 0.8));
        border-radius: 0 0 1.4rem 1.4rem;
        box-shadow: 0 8px 20px rgba(56, 189, 248, 0.4);
      }
      .fin-left {
        left: -0.85rem;
        transform: rotate(-18deg);
      }
      .fin-right {
        right: -0.85rem;
        transform: rotate(18deg);
      }
      .rocket-flame {
        position: absolute;
        bottom: -1.9rem;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .flame-core {
        display: block;
        width: 0.9rem;
        height: 2.4rem;
        border-radius: 999px;
        background: radial-gradient(circle at 50% 15%, rgba(255, 255, 255, 0.95), rgba(251, 191, 36, 0.92));
        animation: flameFlicker 0.75s ease-in-out infinite;
      }
      .flame-glow {
        position: absolute;
        width: 2.8rem;
        height: 3.2rem;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(253, 224, 71, 0.4), rgba(226, 95, 26, 0));
        animation: flameGlow 0.9s ease-in-out infinite;
      }
      .launch-clouds {
        position: absolute;
        bottom: 6%;
        left: 50%;
        width: 120%;
        transform: translateX(-50%);
        display: flex;
        justify-content: space-between;
      }
      .puff {
        display: block;
        width: 2.8rem;
        height: 2rem;
        border-radius: 50%;
        background: radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.8), rgba(148, 163, 184, 0.25));
        animation: puffDrift 3.6s ease-in-out infinite;
      }
      .puff-1 { animation-delay: 0s; }
      .puff-2 { animation-delay: 0.4s; }
      .puff-3 { animation-delay: 0.8s; }
      .launch-stars {
        position: absolute;
        inset: -20%;
        background-size: 120px 120px;
        opacity: 0.6;
        animation: starDrift linear infinite;
      }
      .starfield-1 {
        background-image: radial-gradient(circle 1px, rgba(255, 255, 255, 0.9) 0, transparent 45%);
        animation-duration: 38s;
      }
      .starfield-2 {
        background-image: radial-gradient(circle 2px, rgba(96, 165, 250, 0.6) 0, transparent 40%);
        animation-duration: 26s;
        animation-direction: reverse;
      }
      @keyframes rocketFlight {
        0% {
          transform: translate(-55%, 5%) rotate(-8deg) scale(0.96);
        }
        38% {
          transform: translate(10%, -50%) rotate(-2deg) scale(1.02);
        }
        55% {
          transform: translate(25%, -70%) rotate(5deg) scale(1.05);
        }
        72% {
          transform: translate(40%, -92%) rotate(12deg) scale(1.12);
        }
        100% {
          transform: translate(65%, -125%) rotate(18deg) scale(1.2);
        }
      }
      @keyframes auroraPulse {
        0%, 100% { opacity: 0.35; transform: translateX(-50%) scale(1); }
        50% { opacity: 0.6; transform: translateX(-50%) scale(1.08); }
      }
      @keyframes trailStreak {
        0% { opacity: 0; transform: rotate(-4deg) scaleX(0.2); }
        20% { opacity: 0.75; }
        60% { opacity: 0.15; }
        100% { opacity: 0; transform: rotate(-20deg) scaleX(1.1); }
      }
      @keyframes flameFlicker {
        0%, 100% { transform: scaleY(1) skewX(0deg); }
        50% { transform: scaleY(1.2) skewX(-5deg); }
      }
      @keyframes flameGlow {
        0%, 100% { opacity: 0.35; transform: scale(1); }
        50% { opacity: 0.65; transform: scale(1.08); }
      }
      @keyframes puffDrift {
        0% { transform: translateY(0) scale(1); opacity: 0.85; }
        50% { transform: translateY(-12%) scale(1.05); opacity: 0.65; }
        100% { transform: translateY(-22%) scale(1.1); opacity: 0.4; }
      }
      @keyframes starDrift {
        from { transform: translateY(0) rotate(0deg); }
        to { transform: translateY(-180px) rotate(3deg); }
      }
    `}</style>
  </div>
);


/* ------------------------------------ 페이지 ------------------------------------ */
export default function Home() {
  const { t } = useTranslation();
  const { session, user, profile, loading } = useAuth();

  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isBenefitsOpen, setBenefitsOpen] = useState(false);
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [showRanking, setShowRanking] = useState(false);
  const leaderboardRef = useRef<HTMLDivElement | null>(null);

  // WebGL 지원 여부 감지 → 미지원 시 <Ranking /> 폴백
  const [canUseWebGL, setCanUseWebGL] = useState(true);
  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      const ok = !!(c.getContext('webgl2') || c.getContext('webgl') || (c as any).getContext?.('experimental-webgl'));
      setCanUseWebGL(ok);
    } catch { setCanUseWebGL(false); }
  }, []);

  // Prefers-reduced-motion 감지 (향후 애니메이션 최소화 지점)
  const [prefersReducedMotion, setPRM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setPRM(!!mq?.matches);
    update();
    mq?.addEventListener ? mq.addEventListener('change', update) : mq?.addListener?.(update);
    return () => {
      mq?.removeEventListener ? mq.removeEventListener('change', update) : mq?.removeListener?.(update);
    };
  }, []);

  // 열림 시 포커스/스크롤
  useEffect(() => {
    if (showRanking) {
      const el = document.getElementById('leaderboard-panel');
      try { el?.focus(); } catch {}
      try { el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
    }
  }, [showRanking]);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowRanking(false); };
    if (showRanking) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showRanking]);

  // Socket
  const socketRef = useRef<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [inQueueUsers, setInQueueUsers] = useState(0);
  const [room, setRoom] = useState<string | null>(null);
  const [showRoomCodeModal, setShowRoomCodeModal] = useState(false);
  const [showPvaDifficulty, setShowPvaDifficulty] = useState(false);
  // PVA 프리로드 로딩 화면 상태
  const [pvaLoading, setPvaLoading] = useState(false);
  const pvaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    // Resolve socket URL: prefer env, else same-origin (for self-hosted socket server)
    const base = (process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
    const socket = io(base, {
      path: '/socket.io/',
      // Allow polling fallback for environments where pure websocket is blocked
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsSocketConnected(true);
      socket.emit('authenticate', user.id);
    });
    socket.on('disconnect', () => setIsSocketConnected(false));
    socket.on('connect_error', (err) => {
      console.warn('Socket connect_error:', err?.message || err);
      const allowToasts = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SOCKET_TOASTS === 'true';
      if (allowToasts) { toastOnce('socket_connect_error', () => toast.error('온라인 서버에 연결할 수 없습니다. 나중에 다시 시도해주세요.')); }
    });
    socket.on('user-counts-update', ({ onlineUsers, inQueueUsers }) => {
      setOnlineUsers(onlineUsers);
      setInQueueUsers(inQueueUsers);
    });
    socket.on('game-start', (gameData) => {
      setRoom(gameData.roomId);
      setSelectedGameMode('pvo');
      setShowRoomCodeModal(false);
      if (gameData.openingBoard && Array.isArray(gameData.openingBoard)) {
        try {
          sessionStorage.setItem('openingBoard', JSON.stringify({ board: gameData.openingBoard, toMove: gameData.openingToMove || 'white' }));
        } catch {}
      }
    });
    socket.on('room-created', (roomId) => {
      setRoom(roomId);
      setShowRoomCodeModal(true);
    });

    // If not connected within 5s, inform user
    const t = window.setTimeout(() => {
      if (!socket.connected) {
        const allowToasts = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SOCKET_TOASTS === 'true';
        if (allowToasts) { toastOnce('socket_connect_timeout', () => toast.error('온라인 기능을 사용할 수 없습니다. 네트워크를 확인해주세요.')); }
        setIsSocketConnected(false);
      }
    }, 5000);

    return () => { window.clearTimeout(t); socket.disconnect(); };
  }, [user]);

  // 로딩 화면 진행도(감성)
  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => {
      setLoadingProgress((p) => (p >= 99 ? (window.clearInterval(id), 99) : p + 1));
    }, 100);
    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (session) {
      const action = localStorage.getItem('postLoginAction');
      if (action === 'openBenefits') {
        localStorage.removeItem('postLoginAction');
        setBenefitsOpen(true);
      }
    }
  }, [session]);

  // PVA 로딩 타이머 정리
  useEffect(() => {
    return () => {
      if (pvaTimerRef.current) clearTimeout(pvaTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedGameMode !== 'pva') return;
    if (!pvaLoading) return;
    const failSafe = window.setTimeout(() => setPvaLoading(false), 5000);
    return () => window.clearTimeout(failSafe);
  }, [selectedGameMode, pvaLoading]);

  // PVA 배경 사전 로딩을 전역 iframe으로 유지(React 언마운트에 영향받지 않도록)
  useEffect(() => {
    // Disable heavy hidden iframe preload to prevent browser lock-ups
    return;
    if (!pvaLoading) return;
    try {
      const id = 'pva-preload-iframe';
      let ifr = document.getElementById(id) as HTMLIFrameElement | null;
      if (!ifr) {
        ifr = document.createElement('iframe');
        ifr.id = id;
        ifr.src = '/backgrounds/ai-daejeon-cosmos.html?quality=high&embed=1';
        ifr.loading = 'eager';
        ifr.style.position = 'absolute';
        ifr.style.width = '1px';
        ifr.style.height = '1px';
        ifr.style.opacity = '0';
        ifr.style.pointerEvents = 'none';
        ifr.style.border = '0';
        ifr.style.left = '-9999px';
        ifr.style.top = '-9999px';
        document.body.appendChild(ifr);
      }
    } catch {}
  }, [pvaLoading]);

  const handleBecomeSupporter = () => {
    if (user && !user.is_anonymous) {
      setBenefitsOpen(true);
    } else {
      localStorage.setItem('postLoginAction', 'openBenefits');
      setShowLoginModal(true);
    }
  };

  const handleBackToMenu = useCallback(() => {
    setSelectedGameMode(null);
    setRoom(null);
  }, []);

  // 메뉴↔게임 전환 시 광고 가시성 토글
  useEffect(() => {
    try {
      const adContainer = document.querySelector<HTMLElement>('div[class*="vignette-banner"]');
      if (adContainer) adContainer.style.display = selectedGameMode ? 'none' : 'block';
    } catch (error) {
      console.error('Error handling ad visibility:', error);
    }
  }, [selectedGameMode]);

  /* -------------------------------- 렌더 -------------------------------- */
  if (loading) {
    return (
      <div className="relative min-h-screen main-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-8 h-8 bg-black rounded-full animate-bounce shadow-lg"></div>
            <div className="w-8 h-8 bg-white rounded-full animate-bounce shadow-lg [animation-delay:0.2s]"></div>
            <div className="w-8 h-8 bg-black rounded-full animate-bounce shadow-lg [animation-delay:0.4s]"></div>
          </div>
          <div className="text-white text-2xl font-mono w-24 text-center">{loadingProgress}%</div>
        </div>
      </div>
    );
  }

  const showLogin = !session;

  return (
    <div className={`relative min-h-screen ${selectedGameMode === 'pva' ? '' : 'main-background'}`}>
      {showLogin ? (
        <div className="flex items-center justify-center min-h-screen">
          <Auth />
        </div>
      ) : (
<main className="flex flex-col items-center justify-center p-4 pt-16 md:p-10 md:pt-20">
          {!selectedGameMode && <AccountInfo onOpenSettings={() => setSettingsOpen(true)} onOpenBenefits={handleBecomeSupporter} />}

          {selectedGameMode === 'pvo' && room && !showRoomCodeModal ? (
            <Board initialGameMode={'pvo'} onExit={handleBackToMenu} spectateRoomId={room} />
          ) : selectedGameMode === 'pvo' ? (
            <OnlineMultiplayerMenu
              onBack={handleBackToMenu}
              setGameMode={setSelectedGameMode}
              socketRef={socketRef}
              userProfile={profile}
              onlineUsers={onlineUsers}
              inQueueUsers={inQueueUsers}
              isSocketConnected={isSocketConnected}
            />
          ) : selectedGameMode ? (
            <div className="flex flex-col items-center w-full">
              <Board
                initialGameMode={selectedGameMode}
                onExit={handleBackToMenu}
                loadingOverlayActive={selectedGameMode === 'pva' ? pvaLoading : false}
              />
            </div>
          ) : (
            <div className="text-center px-3">
              <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 md:mb-8 text-center shadow-lg [text-shadow:_2px_2px_8px_rgb(0_0_0_/_50%)]">
                {t('GomokuGame')}
              </h1>
              <h2 className="text-2xl md:text-3xl text-white mb-5 md:mb-6">{t('SelectGameMode')}</h2>
              <div className="mx-auto w-full max-w-xs sm:max-w-none flex flex-col sm:flex-row gap-3 md:gap-4">
                <button
                  onClick={() => setShowPvaDifficulty(true)}
                  className="px-6 py-3 md:px-8 md:py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-lg md:text-xl btn-hover-scale"
                >
                  {t('PvsAI')}
                </button>
                <button
                  onClick={() => { user?.is_anonymous ? setShowLoginModal(true) : setSelectedGameMode('pvo'); }}
                  className="px-6 py-3 md:px-8 md:py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors text-lg md:text-xl btn-hover-scale"
                >
                  {t('PvsOnline')}
                </button>
                <button
                  onClick={() => setSelectedGameMode('pvp')}
                  className="px-6 py-3 md:px-8 md:py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-lg md:text-xl btn-hover-scale"
                >
                  {t('PvsPlayer')}
                </button>
              </div>

              {/* 토너먼트(후원자) */}
              {profile?.is_supporter && (
              <div className="mt-3 md:mt-4">
                <button
                  onClick={() => toastOnce('coming_soon', () => toast(t('coming_soon')))}
                  className="px-5 py-2.5 md:px-8 md:py-4 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-600 transition-colors text-base md:text-xl btn-hover-scale"
                >
                  {t('Tournaments')}
                </button>
              </div>
              )}

              {/* 후원 유도 */}
              <div className="mt-5 md:mt-8 mb-6 md:mb-8">
                {profile && !profile.is_supporter && (
                  <button
                    onClick={handleBecomeSupporter}
                    className="px-5 py-2.5 md:px-6 md:py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-600 transition-colors text-base md:text-lg btn-hover-scale"
                  >
                    {t('BecomeASupporter')}
                  </button>
                )}
              </div>

              {/* 광고: 메뉴에서만, 비후원자만 */}
              {!profile?.is_supporter && !selectedGameMode && <AdBanner />}

              {/* 리더보드 토글/패널 */}
              <div className="mt-8 w-full max-w-md mx-auto paper-fold-wrap">
                <button
                  onClick={() => setShowRanking(v => !v)}
                  className="w-full px-4 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-600 transition-colors btn-hover-scale"
                  aria-expanded={showRanking}
                  aria-controls="leaderboard-panel"
                  aria-label={showRanking ? t('HideLeaderboard','Hide leaderboard') : t('ShowLeaderboard','Show leaderboard')}
                >
                  {showRanking ? t('HideLeaderboard','Hide leaderboard') : t('ShowLeaderboard','Show leaderboard')}
                </button>

                <div
                  id="leaderboard-panel"
                  ref={leaderboardRef}
                  aria-hidden={!showRanking}
                  tabIndex={-1}
                  className="mt-3"
                  style={{
                    overflow: 'hidden',
                    minHeight: showRanking ? 480 : 0, // AnimatedLeaderboard가 내부에서 높이를 관리
                    willChange: 'min-height'
                  }}
                >
                  {showRanking && (
                    canUseWebGL ? (
                      // 조명/그림자 반응 좋은 버텍스 변형 모드 + HTML 오버레이(정확한 UV→3D)
                      <AnimatedLeaderboard open={showRanking} mode="shader" overlay="raycast" />
                    ) : (
                      // WebGL 불가 시 폴백 리스트
                      <div className="p-4 bg-gray-800/70 rounded-lg border border-gray-700">
                        <Ranking />
                        <p className="text-xs text-gray-400 mt-2">{t('WebGLNotSupported','Your browser does not support 3D. Showing a basic leaderboard instead.')}</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {showRoomCodeModal && room && (
            <RoomCodeModal
              roomId={room}
              onClose={() => setShowRoomCodeModal(false)}
            />
          )}

          <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
          <SupporterBenefitsModal
            isOpen={isBenefitsOpen}
            onClose={() => setBenefitsOpen(false)}
            isGuest={user?.is_anonymous || false}
            user={user}
          />
        </main>
      )}

      {/* PvA 로딩 화면: 배경 미리 로딩 */}
      {pvaLoading && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black px-6">
          <PvaLaunchAnimation />
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <div className="text-white text-2xl font-semibold tracking-wide">{t('PvaLoadingTitle')}</div>
            <p className="text-sky-200/80 text-sm leading-relaxed max-w-xs">AI 대전을 위한 전략 궤도와 추론 매개변수를 정렬하고 있어요.
            </p>
            <div className="launch-progress">
              <span className="launch-progress-meter" />
            </div>
          </div>
          <style jsx>{`
            .launch-progress {
              position: relative;
              width: 11rem;
              height: 0.35rem;
              border-radius: 999px;
              overflow: hidden;
              background: linear-gradient(90deg, rgba(30, 64, 175, 0.4), rgba(148, 163, 184, 0.12));
              box-shadow: 0 0 24px rgba(59, 130, 246, 0.35);
            }
            .launch-progress-meter {
              position: absolute;
              inset: 0;
              background: linear-gradient(90deg, rgba(15, 118, 110, 0.15), rgba(125, 211, 252, 0.85), rgba(14, 165, 233, 0.2));
              animation: launchSweep 2.4s ease-in-out infinite;
            }
            @keyframes launchSweep {
              0% { transform: translateX(-80%); }
              50% { transform: translateX(-10%); }
              100% { transform: translateX(80%); }
            }
          `}</style>
        </div>
      )}

      {/* 모드 선택 화면의 배경 데코 */}
      {!selectedGameMode && (
        <div className="pointer-events-none fixed inset-0 -z-0">
          <div className="ai-anticipation">
            <div className="ai-node n1" />
            <div className="ai-node n2" />
            <div className="ai-node n3" />
            <div className="ai-node n4" />
            <div className="ai-node n5" />
            <div className="ai-connector c1" />
            <div className="ai-connector c2" />
            <div className="ai-connector c3" />
          </div>
        </div>
      )}

      {/* PvA 난이도 선택 모달 */}
      <DifficultySelect
        visible={showPvaDifficulty}
        onDismiss={() => setShowPvaDifficulty(false)}
        onSelect={(d) => {
          try { sessionStorage.setItem('pva_difficulty', d); } catch {}
          setShowPvaDifficulty(false);
          setRoom(null);
          setShowRoomCodeModal(false);
          // 난이도 선택 후 1.5초 로딩 화면으로 이동하며 PVA 배경 미리 로딩
          setPvaLoading(true);
          setSelectedGameMode('pva');
          if (pvaTimerRef.current) { clearTimeout(pvaTimerRef.current); }
          pvaTimerRef.current = window.setTimeout(() => {
            setPvaLoading(false);
          }, 1500);
        }}
      />

      {/* 로그인 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl relative">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-2 right-2 text-white text-2xl btn-hover-scale">&times;</button>
            <Auth />
          </div>
        </div>
      )}
    </div>
  );
}


