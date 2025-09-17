'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Fireworks from '@/components/Fireworks';

export default function SupportSuccessPage() {
  const { t } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState<boolean>(!!profile?.is_supporter);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Poll a few times to catch the webhook update quickly after redirect
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (!user?.id) return;
      setLoading(true);
      setStatusMsg(null);
      try {
        for (let i = 0; i < 10; i++) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (cancelled) return;
          if (error) {
            // brief backoff and retry
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          if (data) {
            updateProfile(data as any);
            if ((data as any).is_supporter) {
              setActivated(true);
              setStatusMsg(t('SupporterActivated', 'Supporter benefits are now active!'));
              break;
            }
          }
          await new Promise((r) => setTimeout(r, 800));
        }
        if (!activated && !cancelled) {
          setStatusMsg(t('SupporterNotYet', 'Payment detected soon. Please try again in a moment.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    // Auto-start when arriving at the page
    void poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const manualRefresh = async () => {
    if (!user?.id) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      updateProfile(data as any);
      if ((data as any)?.is_supporter) {
        setActivated(true);
        setStatusMsg(t('SupporterActivated', 'Supporter benefits are now active!'));
      } else {
        setStatusMsg(t('SupporterNotYet', 'Payment detected soon. Please try again in a moment.'));
      }
    } catch (_) {
      setStatusMsg(t('RefreshFailed', 'Failed to refresh profile. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">{t('SupportThankYou', 'Thank you for your support!')}</h1>
          <p className="text-gray-300 mb-4">{t('LoginToApply', 'Please login to apply supporter benefits to your account.')}</p>
          <Link href="/" className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-500 inline-block">
            {t('GoHome', 'Go Home')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="relative max-w-xl w-full bg-gray-800 border border-gray-700 rounded-lg p-6">
        {activated && <div className="absolute inset-0 pointer-events-none"><Fireworks /></div>}
        <h1 className="text-3xl font-extrabold text-white mb-2 text-center">
          {t('SupportThankYou', 'Thank you for your support!')}
        </h1>
        <p className="text-center text-gray-300 mb-6">
          {activated
            ? t('SupportActiveDesc', 'Your supporter benefits are now active on your account.')
            : t('SupportPendingDesc', 'We are applying your benefits. This usually takes a moment.')}
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={manualRefresh}
            disabled={loading}
            className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-60"
          >
            {loading ? t('Refreshing...', 'Refreshing...') : t('Refresh Profile', 'Refresh Profile')}
          </button>
          {statusMsg && <p className="text-sm text-gray-300 text-center">{statusMsg}</p>}
          <Link href="/" className="mt-2 text-sm text-cyan-300 hover:underline">
            {t('BackToHome', 'Back to Home')}
          </Link>
        </div>
      </div>
    </div>
  );
}

