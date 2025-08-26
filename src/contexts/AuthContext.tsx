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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessionAndProfile = async () => {
      setLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error getting session:", error);
        setLoading(false);
        return;
      }

      if (session) {
        setSession(session);
        setUser(session.user);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(profileData as Profile);
      } else {
        const { data: anonSession, error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) {
            console.error("Error signing in anonymously:", anonError);
            setLoading(false); // <-- This was the missing line
        } else if (anonSession.session) {
            setSession(anonSession.session);
            setUser(anonSession.session.user);
            // The trigger will create a profile, which will be picked up by the listener.
        }
      }
      setLoading(false);
    };

    fetchSessionAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Fetch profile on auth change
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(profileData as Profile);
      } else {
        // If user logs out, clear profile and try to sign in anonymously again
        setProfile(null);
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) console.error("Error re-signing in anonymously after logout:", anonError);
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
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};