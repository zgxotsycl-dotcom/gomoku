"use client";
import { useEffect } from 'react';

export default function ClientInit() {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw-rocket.js').catch(() => {});
      }
    } catch {}
  }, []);
  return null;
}

