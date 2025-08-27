'use client'

import { useState } from 'react';
import Link from 'next/link';
import Board, { GameMode } from '@/components/Board';
import Auth from '@/components/Auth';
import Ranking from '@/components/Ranking';
import SettingsModal from '@/components/SettingsModal';
import SupporterBenefitsModal from '@/components/SupporterBenefitsModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useTranslation } from 'react-i18next';

const AccountInfo = ({ onOpenSettings, onOpenBenefits }: { onOpenSettings: () => void, onOpenBenefits: () => void }) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  return (
    <div className="absolute top-4 right-4 text-white flex items-center gap-4 z-10">
      <span>{profile?.username || user?.email}</span>
      {profile?.is_supporter && (
        <>
          <Link href="/replays" className="px-3 py-1 bg-indigo-600 rounded hover:bg-indigo-700">
            {t('MyReplays')}
          </Link>
          <button onClick={onOpenSettings} className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-700">{t('Settings')}</button>
        </>
      )}
      {profile && !profile.is_supporter && (
        <button onClick={onOpenBenefits} className="px-3 py-1 bg-yellow-500 text-black rounded hover:bg-yellow-600">
          {t('BecomeASupporter')}
        </button>
      )}
      {!user?.is_anonymous && (
        <button onClick={() => supabase.auth.signOut()} className="px-3 py-1 bg-red-600 rounded hover:bg-red-700">
            {t('Logout')}
        </button>
      )}
    </div>
  )
}

export default function Home() {
  const { t } = useTranslation();
  const { session, user, profile } = useAuth();
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isBenefitsOpen, setBenefitsOpen] = useState(false);
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode | null>(null);

  const showLogin = !session && !profile;

  const handleBackToMenu = () => {
    setSelectedGameMode(null);
  };

  return (
    <div className="relative min-h-screen main-background">
      {showLogin ? (
        <div className="flex items-center justify-center min-h-screen">
          <Auth />
        </div>
      ) : (
        <main className="flex flex-col items-center justify-center p-10 pt-20">
          <AccountInfo onOpenSettings={() => setSettingsOpen(true)} onOpenBenefits={() => setBenefitsOpen(true)} />
          <h1 className="text-5xl font-extrabold text-white mb-8 text-center shadow-lg [text-shadow:_2px_2px_8px_rgb(0_0_0_/_50%)]">
            {t('GomokuGame')}
          </h1>
          
          {selectedGameMode ? (
            <div className="flex flex-col items-center w-full">
              <div className="flex flex-col lg:flex-row gap-8 items-start w-full justify-center">
                <Board initialGameMode={selectedGameMode} />
                <Ranking />
              </div>
              <button onClick={handleBackToMenu} className="mt-8 px-6 py-2 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors">
                {t('BackToMenu')}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-3xl text-white mb-6">{t('SelectGameMode')}</h2>
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => setSelectedGameMode('pva')} className="px-8 py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-xl">
                  {t('PvsAI')}
                </button>
                <button onClick={() => setSelectedGameMode('pvo')} className="px-8 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors text-xl">
                  {t('PvsOnline')}
                </button>
                <button onClick={() => setSelectedGameMode('pvp')} className="px-8 py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-xl">
                  {t('PvsPlayer')}
                </button>
              </div>
            </div>
          )}

          <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
          <SupporterBenefitsModal 
            isOpen={isBenefitsOpen} 
            onClose={() => setBenefitsOpen(false)} 
            isGuest={user?.is_anonymous || false}
          />
        </main>
      )}
    </div>
  )
}