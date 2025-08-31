'use client';
import { useState } from 'react';
import Board from '../../../components/Board';
import { useTranslation } from '../../i18n';

export default function Home({ params: { lng } }) {
  const { t } = useTranslation(lng, 'translation');
  const [gameMode, setGameMode] = useState(null);

  const handleExitGame = () => {
    setGameMode(null); // Go back to the menu
  };

  if (!gameMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-4xl font-bold mb-8">{t('gomoku.title')}</h1>
        <div className="flex flex-col gap-4">
          <button onClick={() => setGameMode('pvp')} className="px-8 py-4 bg-blue-500 text-white rounded text-xl">
            {t('game.mode.local')}
          </button>
          <button onClick={() => setGameMode('pva')} className="px-8 py-4 bg-green-500 text-white rounded text-xl">
            {t('game.mode.ai')}
          </button>
          <button onClick={() => setGameMode('pvo')} className="px-8 py-4 bg-indigo-500 text-white rounded text-xl">
            {t('game.mode.online')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen p-4 ${gameMode === 'pva' ? 'bg-space-animated' : 'bg-gray-100'}`}>
      <Board 
        initialGameMode={gameMode}
        onExit={handleExitGame}
      />
    </div>
  );
}
