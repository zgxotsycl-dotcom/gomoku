'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

const AuthComponent = () => {

  const handleGuestLogin = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      toast.error('Could not log in as guest. Please try again.');
      console.error('Error signing in anonymously:', error);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-gray-700 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center text-white">Welcome to Gomoku</h1>
        <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            theme="dark"
            providers={['github', 'google']}
            redirectTo={typeof window !== 'undefined' ? window.location.origin : ''}
        />
        <div className="relative flex py-3 items-center">
            <div className="flex-grow border-t border-gray-500"></div>
            <span className="flex-shrink mx-4 text-gray-400">Or</span>
            <div className="flex-grow border-t border-gray-500"></div>
        </div>
        <button 
            onClick={handleGuestLogin}
            className="w-full px-4 py-2 font-bold text-white bg-gray-500 rounded hover:bg-gray-600 btn-hover-scale"
        >
            Play as Guest
        </button>
    </div>
  );
};

export default AuthComponent;
