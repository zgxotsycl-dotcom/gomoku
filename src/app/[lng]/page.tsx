'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Board from '@/components/Board';
import type { GameMode } from '@/types';
import Auth from '@/components/Auth';
import dynamic from 'next/dynamic';
const ScrollLeaderboard3D = dynamic(() => import('@/components/ScrollLeaderboard3D'), { ssr: false });
import SettingsModal from '@/components/SettingsModal';
import SupporterBenefitsModal from '@/components/SupporterBenefitsModal';
import OnlineMultiplayerMenu from '@/components/OnlineMultiplayerMenu';
import RoomCodeModal from '@/components/RoomCodeModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useTranslation } from 'react-i18next';

import LanguageSwitcher from '@/components/LanguageSwitcher';
import Ranking from '@/components/Ranking'; // WebGL 불가 시 폴백
import DifficultySelect from '@/components/DifficultySelect';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

/* ------------------------------- 상단 계정 정보 ------------------------------- */
const AccountInfo = ({ onOpenSettings, onOpenBenefits }: { onOpenSettings: () => void, onOpenBenefits: () => void }) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  return (
    <div className="absolute top-4 right-4 text-white flex items-center gap-4 z-10">
      <LanguageSwitcher />
      <span>{profile?.username || user?.email}</span>
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
  const pvaTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002', {
      path: '/socket.io/',
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsSocketConnected(true);
      socket.emit('authenticate', user.id);
    });
    socket.on('disconnect', () => setIsSocketConnected(false));
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

    return () => { socket.disconnect(); };
  }, [user]);

  // 로딩 화면 진행도(감성)
  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => {
      setLoadingProgress((p) => (p >= 99 ? (window.clearInterval(id), 99) : p + 1));
    }, 20);
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

  // PVA 배경 사전 로딩을 전역 iframe으로 유지(React 언마운트에 영향받지 않도록)
  useEffect(() => {
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
        <main className="flex flex-col items-center justify-center p-10 pt-20">
          {!selectedGameMode && <AccountInfo onOpenSettings={() => setSettingsOpen(true)} onOpenBenefits={handleBecomeSupporter} />}

          {room && !showRoomCodeModal ? (
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
              <Board initialGameMode={selectedGameMode} onExit={handleBackToMenu} />
            </div>
          ) : (
            <div className="text-center">
              <h1 className="text-5xl font-extrabold text-white mb-8 text-center shadow-lg [text-shadow:_2px_2px_8px_rgb(0_0_0_/_50%)]">
                {t('GomokuGame')}
              </h1>
              <h2 className="text-3xl text-white mb-6">{t('SelectGameMode')}</h2>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setShowPvaDifficulty(true)}
                  className="px-8 py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-xl btn-hover-scale"
                >
                  {t('PvsAI')}
                </button>
                <button
                  onClick={() => { user?.is_anonymous ? setShowLoginModal(true) : setSelectedGameMode('pvo'); }}
                  className="px-8 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors text-xl btn-hover-scale"
                >
                  {t('PvsOnline')}
                </button>
                <button
                  onClick={() => setSelectedGameMode('pvp')}
                  className="px-8 py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-xl btn-hover-scale"
                >
                  {t('PvsPlayer')}
                </button>
              </div>

              {/* 토너먼트(후원자) */}
              {profile?.is_supporter && (
                <div className="mt-4">
                  <button
                    onClick={() => toast(t('coming_soon'))}
                    className="px-8 py-4 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-600 transition-colors text-xl btn-hover-scale"
                  >
                    {t('Tournaments')}
                  </button>
                </div>
              )}

              {/* 후원 유도 */}
              <div className="mt-8 mb-8">
                {profile && !profile.is_supporter && (
                  <button
                    onClick={handleBecomeSupporter}
                    className="px-6 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-600 transition-colors text-lg btn-hover-scale"
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
                    minHeight: showRanking ? 480 : 0, // ScrollLeaderboard3D가 내부에서 높이를 관리
                    willChange: 'min-height'
                  }}
                >
                  {showRanking && (
                    canUseWebGL ? (
                      // 조명/그림자 반응 좋은 버텍스 변형 모드 + HTML 오버레이(정확한 UV→3D)
                      <ScrollLeaderboard3D open={showRanking} mode="shader" overlay="raycast" />
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-4">
            {/* 재미있는 로딩 애니메이션: 바둑돌 공전 */}
            <div className="relative w-[120px] h-[120px]">
              <div className="absolute inset-0 animate-[orbit_2.8s_linear_infinite]">
                <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-0 w-[22px] h-[22px] rounded-full bg-black shadow-xl" />
                <div className="absolute left-1/2 -translate-x-1/2 translate-y-1/2 bottom-0 w-[22px] h-[22px] rounded-full bg-white shadow-xl border border-gray-300" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white/30"></div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-white/40 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse [animation-delay:0.15s]"></div>
              <div className="w-2 h-2 bg-white/80 rounded-full animate-pulse [animation-delay:0.3s]"></div>
            </div>
            <div className="text-white text-xl font-semibold">{t('PvaLoadingTitle')}</div>
          </div>
          <style jsx>{`
            @keyframes orbit { to { transform: rotate(360deg); } }
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
      {showPvaDifficulty && (
        <DifficultySelect
          visible={true}
          onSelect={(d) => {
            try { sessionStorage.setItem('pva_difficulty', d); } catch {}
            setShowPvaDifficulty(false);
            // 난이도 선택 후 1.5초 로딩 화면으로 이동하며 PVA 배경 미리 로딩
            setPvaLoading(true);
            if (pvaTimerRef.current) { clearTimeout(pvaTimerRef.current); }
            pvaTimerRef.current = setTimeout(() => {
              setSelectedGameMode('pva');
              setPvaLoading(false);
            }, 1500);
          }}
        />
      )}

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
