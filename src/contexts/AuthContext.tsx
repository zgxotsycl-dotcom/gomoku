'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { languages } from '@/i18n/settings';

function normalizeLng(input: unknown): string | null {
  if (!input) return null;
  try {
    const s = String(input).toLowerCase();
    const base = s.split(/[-_]/)[0];
    return base;
  } catch {
    return null;
  }
}
import { supabase } from '@/lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  updateProfile: (newProfileData: Partial<Profile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const updateProfile = (newProfileData: Partial<Profile>) => {
    setProfile((currentProfile) => {
      if (currentProfile) {
        return { ...currentProfile, ...newProfileData };
      }
      return null;
    });
  };

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
            const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            setProfile(profileData as Profile);
            try {
              const raw = (profileData as any)?.locale || (profileData as any)?.language || (profileData as any)?.preferred_language || localStorage.getItem('preferredLng');
              const pref = normalizeLng(raw);
              if (pref && languages.includes(pref)) {
                const maxAge = 60 * 60 * 24 * 365;
                document.cookie = `i18next=${pref}; Max-Age=${maxAge}; Path=/`;
                localStorage.setItem('preferredLng', pref);
              }
            } catch {}
        }
      } catch (error) {
        console.error("Error in getInitialSession:", error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
            supabase.from('profiles').select('*').eq('id', session.user.id).single().then(response => {
                setProfile(response.data as Profile);
                try {
                  const raw = (response.data as any)?.locale || (response.data as any)?.language || (response.data as any)?.preferred_language || localStorage.getItem('preferredLng');
                  const pref = normalizeLng(raw);
                  if (pref && languages.includes(pref)) {
                    const maxAge = 60 * 60 * 24 * 365;
                    document.cookie = `i18next=${pref}; Max-Age=${maxAge}; Path=/`;
                    localStorage.setItem('preferredLng', pref);
                  }
                } catch {}
            });
        } else {
            setProfile(null);
        }
    });

    return () => {
        authListener.subscription.unsubscribe();
    };
}, []);

  const value = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    updateProfile,
  }), [session, user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
