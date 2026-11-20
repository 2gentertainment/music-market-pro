'use client';

import React, { useState, useEffect } from 'react';

const IS_DEV_SUITE_ENABLED =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_SUITE === 'true';

export default function DevSuiteBar() {
  const [testTier, setTestTier] = useState<'logged_out' | 'free' | 'artist' | 'label'>('logged_out');

  useEffect(() => {
    if (!IS_DEV_SUITE_ENABLED) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mm_dev_tier');
      }
      return;
    }

    const saved = localStorage.getItem('mm_dev_tier') as 'logged_out' | 'free' | 'artist' | 'label' | null;
    if (saved) setTestTier(saved);

    const handleAutoLogin = () => {
      const current = localStorage.getItem('mm_dev_tier');
      if (!current || current === 'logged_out') {
        setTestTier('free');
        localStorage.setItem('mm_dev_tier', 'free');
        window.dispatchEvent(new Event('mm_tier_changed'));
      }
    };

    window.addEventListener('mm_auto_login', handleAutoLogin);
    return () => window.removeEventListener('mm_auto_login', handleAutoLogin);
  }, []);

  if (!IS_DEV_SUITE_ENABLED) {
    return null;
  }

  const switchTier = (status: 'logged_out' | 'free' | 'artist' | 'label') => {
    setTestTier(status);
    localStorage.setItem('mm_dev_tier', status);
    window.dispatchEvent(new Event('mm_tier_changed'));
  };

  return (
    <div className="sticky top-0 z-[9999] w-full bg-[#161616] border-b border-[#ff8c00]/40 p-2 text-center flex flex-wrap items-center justify-center gap-3 text-xs shadow-2xl backdrop-blur-md bg-opacity-95">
      <span className="text-[#ff8c00] font-bold uppercase tracking-wider text-[10px] border border-[#ff8c00]/30 px-2.5 py-0.5 rounded-md bg-[#ff8c00]/10">
        Global Dev Suite
      </span>
      <button
        type="button"
        onClick={() => switchTier('logged_out')}
        className={`px-3 py-1 rounded-lg font-bold cursor-pointer transition-all ${testTier === 'logged_out' ? 'bg-[#ff8c00] text-black shadow-[0_0_12px_rgba(255,140,0,0.3)]' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
      >
        Logged Out
      </button>
      <button
        type="button"
        onClick={() => switchTier('free')}
        className={`px-3 py-1 rounded-lg font-bold cursor-pointer transition-all ${testTier === 'free' ? 'bg-[#ff8c00] text-black shadow-[0_0_12px_rgba(255,140,0,0.3)]' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
      >
        Free Tier
      </button>
      <button
        type="button"
        onClick={() => switchTier('artist')}
        className={`px-3 py-1 rounded-lg font-bold cursor-pointer transition-all ${testTier === 'artist' ? 'bg-[#ff8c00] text-black shadow-[0_0_12px_rgba(255,140,0,0.3)]' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
      >
        Artist Tier ($9.99)
      </button>
      <button
        type="button"
        onClick={() => switchTier('label')}
        className={`px-3 py-1 rounded-lg font-bold cursor-pointer transition-all ${testTier === 'label' ? 'bg-[#ff8c00] text-black shadow-[0_0_12px_rgba(255,140,0,0.3)]' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
      >
        Label Tier ($29.99)
      </button>
    </div>
  );
}
