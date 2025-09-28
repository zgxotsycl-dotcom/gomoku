'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Board from '@/components/Board';
import Link from 'next/link';
import { Suspense } from 'react';

const SpectateGame = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = searchParams.get('roomId');

  const handleExit = () => {
    router.push('/');
  };

  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100svh] bg-gray-800 text-white">
        <h2 className="text-2xl mb-4">No game room specified.</h2>
        <Link href="/" className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600">Go to Homepage</Link>
      </div>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-[100svh] bg-gray-800 p-10">
      <h1 className="text-3xl font-bold text-white mb-4">Spectating Game</h1>
      <h2 className="text-lg text-gray-400 mb-8">Room: {roomId}</h2>
      <Board spectateRoomId={roomId} initialGameMode={'spectate'} onExit={handleExit} />
       {/* Redundant link removed */}
    </main>
  );
};

const SpectatePage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SpectateGame />
    </Suspense>
  );
};

export default SpectatePage;

