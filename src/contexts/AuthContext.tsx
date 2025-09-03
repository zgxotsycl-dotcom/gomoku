'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  username: string;
  elo_rating: number;
  is_supporter: boolean;
  nickname_color: string | null;
  badge_color: string | null;
}

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
            });
        } else {
            setProfile(null);
        }
    });

    return () => {
        authListener.subscription.unsubscribe();
    };
}, []);

  const value = {
    session,
    user,
    profile,
    loading,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};