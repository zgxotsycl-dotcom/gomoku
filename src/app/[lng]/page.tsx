'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Board from '@/components/Board';
import type { GameMode } from '@/types';
import Auth from '@/components/Auth';
import Ranking from '@/components/Ranking';
import SettingsModal from '@/components/SettingsModal';
import SupporterBenefitsModal from '@/components/SupporterBenefitsModal';
import OnlineMultiplayerMenu from '@/components/OnlineMultiplayerMenu';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

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

const AdBanner = () => (
    <div className="w-full max-w-md mx-auto my-4 text-center text-white">
        <div 
            className="bg-gray-700/50 border border-gray-600 rounded-lg flex items-center justify-center"
            style={{ minHeight: '100px' }} // Ad container
        >
            {/* 
              This is where you place your ad unit code from PropellerAds.
              It will likely be a <div> or a <script> tag.

              If you get a script, you might need to use dangerouslySetInnerHTML like this:
              <div dangerouslySetInnerHTML={{ __html: `YOUR_PROPELLER_ADS_SCRIPT_HERE` }} />

              IMPORTANT: Be very careful with dangerouslySetInnerHTML as it can expose your app to security risks (XSS) if the code is not from a trusted source.
              Only use it for ad codes from reputable networks like PropellerAds.
            */}
            <span className="text-sm">Advertisement Placeholder</span>
        </div>
    </div>
);

export default function Home() {
  const { t } = useTranslation();
  const { session, user, profile, loading } = useAuth();
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isBenefitsOpen, setBenefitsOpen] = useState(false);
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const socketRef = useRef<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [inQueueUsers, setInQueueUsers] = useState(0);
  const [room, setRoom] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002', {
        path: "/socket.io/",
        transports: ['websocket']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
        setIsSocketConnected(true);
        toast.success("Connected to server!");
        socket.emit('authenticate', user.id);
    });

    socket.on('disconnect', () => {
        setIsSocketConnected(false);
        toast.error("Disconnected from server.");
    });

    socket.on('user-counts-update', ({ onlineUsers, inQueueUsers }) => {
        setOnlineUsers(onlineUsers);
        setInQueueUsers(inQueueUsers);
    });

    socket.on('game-start', (gameData) => {
        setRoom(gameData.roomId);
        setSelectedGameMode('pvo');
    });

    socket.on('room-created', (roomId) => {
        setRoom(roomId);
        toast.success(t('RoomCreated', { roomId }));
    });

    return () => {
        socket.disconnect();
    };
  }, [user, t]);

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

  const handleBackToMenu = useCallback(() => {
    setSelectedGameMode(null);
    setRoom(null);
  }, []);

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
        
        {room ? (
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
              <button onClick={() => setSelectedGameMode('pva')} className="px-8 py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-xl
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

            {/* New Tournament Button for Supporters */}
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

            <div className="mt-8 mb-8">
              {profile && !profile.is_supporter && (
                <button onClick={handleBecomeSupporter} className="px-6 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-600 transition-colors text-lg
btn-hover-scale">
                  {t('BecomeASupporter')}
                </button>
              )}
            </div>

            {/* Ad placeholder for non-supporters */}
            {!profile?.is_supporter && <AdBanner />}

            <Ranking />
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