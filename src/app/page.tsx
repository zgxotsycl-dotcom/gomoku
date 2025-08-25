'use client'

import { useState } from 'react';
import Link from 'next/link';
import Board from '@/components/Board';
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

  const showLogin = !session && !profile;

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
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <Board />
            <Ranking />
          </div>
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