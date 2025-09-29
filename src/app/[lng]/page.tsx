'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Board from '@/components/Board';
import type { GameMode } from '@/types';
import Auth from '@/components/Auth';
import Leaderboard from '@/components/Leaderboard';
import DifficultySelect from '@/components/DifficultySelect';
import SettingsModal from '@/components/SettingsModal';
import SupporterBenefitsModal from '@/components/SupporterBenefitsModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PvaLaunchAnimation from '@/components/PvaLaunchAnimation';

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
}

export default function Home() {
  const { t } = useTranslation();
  const { session, user, profile, loading } = useAuth();
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isBenefitsOpen, setBenefitsOpen] = useState(false);
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showPvaDifficulty, setShowPvaDifficulty] = useState(false);
  const [pvaLoading, setPvaLoading] = useState(false);
  const pvaTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
        setLoadingProgress(prev => {
            if (prev >= 99) {
                clearInterval(interval);
                return 99;
            }
            return prev + 1;
        });
    }, 20);

    return () => clearInterval(interval);
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

  const handleBecomeSupporter = () => {
    if (user && !user.is_anonymous) {
      setBenefitsOpen(true);
    } else {
      localStorage.setItem('postLoginAction', 'openBenefits');
      setShowLoginModal(true);
    }
  };

  const handleBackToMenu = () => {
    setSelectedGameMode(null);
  };

  if (loading) {
    return (
      <div className="relative min-h-[100svh] main-background flex items-center justify-center">
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
  <div className={`relative min-h-[100svh] ${selectedGameMode === 'pva' ? '' : 'main-background'}`}>
    {showLogin ? (
      <div className="flex items-center justify-center min-h-[100svh]">
        <Auth />
      </div>
    ) : (
      <main className="flex flex-col items-center justify-center p-10 pt-20 overflow-auto no-scrollbar safe-bottom">
        {!selectedGameMode && <AccountInfo onOpenSettings={() => setSettingsOpen(true)} onOpenBenefits={handleBecomeSupporter} />}
        <h1 className="text-5xl font-extrabold text-white mb-8 text-center shadow-lg [text-shadow:_2px_2px_8px_rgb(0_0_0_/_50%)]">
          {t('GomokuGame')}
        </h1>

        {selectedGameMode ? (
          <div className="flex flex-col items-center w-full">
            <Board initialGameMode={selectedGameMode} onExit={handleBackToMenu} loadingOverlayActive={selectedGameMode === 'pva' ? pvaLoading : false} />
          </div>
        ) : (
          <div className="text-center">
            <h2 className="text-3xl text-white mb-6">{t('SelectGameMode')}</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => setShowPvaDifficulty(true)} className="px-8 py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-xl
btn-hover-scale">
                {t('PvsAI')}
              </button>
              <button onClick={() => { user?.is_anonymous ? setShowLoginModal(true) : setSelectedGameMode('pvo') }} className="px-8 py-4 bg-purple-600 text-white font-bold
rounded-lg hover:bg-purple-700 transition-colors text-xl btn-hover-scale">
                {t('PvsOnline')}
              </button>
              <button onClick={() => setSelectedGameMode('pvp')} className="px-8 py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-xl
btn-hover-scale">
                {t('PvsPlayer')}
              </button>
            </div>
            <div className="mt-8 mb-8">
              {profile && !profile.is_supporter && (
                <button onClick={handleBecomeSupporter} className="px-6 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-600 transition-colors text-lg
btn-hover-scale">
                  {t('BecomeASupporter')}
                </button>
              )}
            </div>
            <Leaderboard />
          </div>
        )}

        <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
        <SupporterBenefitsModal
          isOpen={isBenefitsOpen}
          onClose={() => setBenefitsOpen(false)}
          isGuest={user?.is_anonymous || false}
          user={user}
        />

        {/* AI 난이도 선택 */}
        <DifficultySelect
          visible={showPvaDifficulty}
          onSelect={(d) => {
            try { sessionStorage.setItem('pva_difficulty', d); } catch {}
            setShowPvaDifficulty(false);
            // Start PvA with a brief loading overlay
            setSelectedGameMode('pva');
            setPvaLoading(true);
            if (pvaTimerRef.current) { window.clearTimeout(pvaTimerRef.current); pvaTimerRef.current = null; }
            pvaTimerRef.current = window.setTimeout(() => { setPvaLoading(false); pvaTimerRef.current = null; }, 1500) as unknown as number;
          }}
          onDismiss={() => setShowPvaDifficulty(false)}
        />
      </main>
    )}
    {/* PvA 로딩 오버레이 */}
    {selectedGameMode === 'pva' && pvaLoading && (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black px-6">
        <PvaLaunchAnimation />
        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <div className="text-white text-xl font-semibold tracking-wide">{t('PvaLoadingTitle')}</div>
          <p className="text-sky-200/80 text-xs md:text-sm leading-relaxed max-w-xs">{t('PvaLoadingSubtitle')}</p>
        </div>
      </div>
    )}
    {showLoginModal && (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl relative">
          <button onClick={() => setShowLoginModal(false)} className="absolute top-2 right-2 text-white text-2xl btn-hover-scale">&times;</button>
          <Auth />
        </div>
      </div>
    )}
  </div>
)
}

