'use client';

import React, { useState, useEffect } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

interface BalanceCardProps {
  artistHandle: string;
  tier: string;
  stripeAccountId?: string | null;
  profileId?: string | null;
  email?: string | null;
  displayName?: string | null;
  onboardEndpoint?: string;
}

type TimeframeKey = 'today' | '7d' | '30d' | 'all';

const TIMEFRAME_ORDER: TimeframeKey[] = ['today', '7d', '30d', 'all'];

const TIMEFRAME_LABELS: Record<TimeframeKey, string> = {
  today: 'Today',
  '7d': 'Past 7 Days',
  '30d': 'Past 30 Days',
  all: 'All-Time',
};

export default function DirectBalanceButton({
  artistHandle,
  tier,
  stripeAccountId,
  profileId,
  email,
  displayName,
  onboardEndpoint = '/api/connect/onboard',
}: BalanceCardProps) {
  const isPaid = tier !== 'free';
  const needsPayoutSetup = !stripeAccountId;

  const [timeframe, setTimeframe] = useState<TimeframeKey>('today');
  const [balances, setBalances] = useState<Record<TimeframeKey, number>>({
    today: 0,
    '7d': 0,
    '30d': 0,
    all: 0,
  });
  const [loading, setLoading] = useState(true);
  const [startingOnboarding, setStartingOnboarding] = useState(false);

  useEffect(() => {
    async function fetchBalances() {
      if (!artistHandle || needsPayoutSetup) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      try {
        if (!isPaid) {
          // FREE TIER: Minimal bandwidth — only fetch today's records
          const { data, error } = await _supabase
            .from('artist_earnings')
            .select('net_amount')
            .eq('artist_handle', artistHandle)
            .gte('created_at', startOfToday);

          if (!error && data) {
            const todayTotal = data.reduce((sum, row) => sum + Number(row.net_amount || 0), 0);
            setBalances((prev) => ({ ...prev, today: todayTotal }));
          }
        } else {
          // PAID TIER: Single query computes all buckets locally for instant tapping
          const { data, error } = await _supabase
            .from('artist_earnings')
            .select('net_amount, created_at')
            .eq('artist_handle', artistHandle);

          if (!error && data) {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

            let todaySum = 0;
            let sevenDaySum = 0;
            let thirtyDaySum = 0;
            let allTimeSum = 0;

            for (const row of data) {
              const amt = Number(row.net_amount || 0);
              const ts = row.created_at;

              allTimeSum += amt;
              if (ts >= thirtyDaysAgo) thirtyDaySum += amt;
              if (ts >= sevenDaysAgo) sevenDaySum += amt;
              if (ts >= startOfToday) todaySum += amt;
            }

            setBalances({
              today: todaySum,
              '7d': sevenDaySum,
              '30d': thirtyDaySum,
              all: allTimeSum,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching artist balance:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchBalances();
  }, [artistHandle, isPaid, needsPayoutSetup]);

  async function handleCardClick() {
    if (needsPayoutSetup) {
      if (startingOnboarding) return;
      setStartingOnboarding(true);
      try {
        const res = await fetch(onboardEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId,
            userId: profileId,
            email,
            tier,
            handle: artistHandle,
            handleName: displayName || artistHandle,
            startPayoutOnboarding: true,
          }),
        });

        const data = await res.json();
        if (res.ok && data.url) {
          window.location.href = data.url;
          return;
        }
        throw new Error(data.error || 'Could not start Stripe payout setup.');
      } catch (err: any) {
        console.error('Payout onboarding error:', err);
        alert(err.message || 'Failed to launch Stripe payout setup.');
        setStartingOnboarding(false);
      }
      return;
    }

    if (!isPaid) return;
    const currentIndex = TIMEFRAME_ORDER.indexOf(timeframe);
    const nextIndex = (currentIndex + 1) % TIMEFRAME_ORDER.length;
    setTimeframe(TIMEFRAME_ORDER[nextIndex]);
  }

  const activeAmount = balances[timeframe] ?? 0;
  const isInteractive = needsPayoutSetup ? !startingOnboarding : isPaid;

  return (
    <button
      type="button"
      onClick={handleCardClick}
      disabled={!isInteractive}
      className={`p-5 bg-neutral-900 border rounded-xl flex items-center justify-between transition-all text-left w-full touch-manipulation ${
        needsPayoutSetup
          ? 'border-emerald-500/40 hover:border-emerald-400 cursor-pointer active:scale-[0.99]'
          : isPaid
            ? 'border-neutral-800 hover:border-[#ff8c00] cursor-pointer active:scale-[0.99]'
            : 'border-neutral-800 cursor-default'
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
            Direct Balance
          </span>
          {!needsPayoutSetup && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#ff8c00]/15 text-[#ff8c00] border border-[#ff8c00]/30">
              {TIMEFRAME_LABELS[timeframe]}
            </span>
          )}
        </div>

        {needsPayoutSetup ? (
          <>
            <h3 className="font-bold text-lg text-emerald-400">
              {startingOnboarding ? 'Opening Stripe...' : 'Verify Payout Method'}
            </h3>
            <p className="text-xs text-emerald-400/80">
              create your stripe payout account
            </p>
          </>
        ) : (
          <>
            <h3 className="font-bold text-lg text-emerald-400">
              {loading ? '...' : `$${activeAmount.toFixed(2)}`}
            </h3>
            <p className="text-xs text-emerald-400/80">
              {isPaid ? 'Tap card to cycle timeframe' : '24h view • Upgrade for history'}
            </p>
          </>
        )}
      </div>

      {(needsPayoutSetup || isPaid) && (
        <div
          className={`p-2 rounded-lg border flex-shrink-0 ${
            needsPayoutSetup
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
              : 'text-[#ff8c00] bg-[#ff8c00]/10 border-[#ff8c00]/20'
          }`}
        >
          {needsPayoutSetup ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
          )}
        </div>
      )}
    </button>
  );
}
