'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabaseClient';

const AuthComponent = () => {
  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-gray-700 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center text-white">Welcome to Gomoku</h1>
        <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            theme="dark"
            providers={['github', 'google']}
            redirectTo={`${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`}
        />
    </div>
  );
};

export default AuthComponent;