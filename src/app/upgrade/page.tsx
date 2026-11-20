'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';

function UpgradePageContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account_id');
  const handle = searchParams.get('handle');
  const action = searchParams.get('action'); // 'downgrade' or null
  const currentTier = searchParams.get('tier') || 'free'; // 'free', 'artist', or 'label'
  const profileId = searchParams.get('profile_id');

    const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const isDowngrade = action === 'downgrade';


  const handleAction = async (targetTier: string) => {
  setLoadingTier(targetTier);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || null;

           const useDowngradeRoute = targetTier === 'free' || (isDowngrade && targetTier === 'artist');
    const endpoint = useDowngradeRoute ? '/api/checkout/downgrade' : '/api/checkout/upgrade';
    const payload = {
      tier: targetTier,
      targetTier,
      accountId,
      handle,
      profileId,
      email,
    };

    const res = await fetch(endpoint, {

      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Failed to process tier change.');
    }
  } catch (err: any) {
    console.error('Tier change error:', err);
    alert(err.message || 'Error updating subscription. Please try again.');
    setLoadingTier(null);
  }
};


  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-4xl space-y-8 text-center">

        <div className="space-y-2">
          <span className="text-xs uppercase tracking-widest text-[#ff8c00] font-bold bg-[#ff8c00]/10 px-3 py-1 rounded-full border border-[#ff8c00]/30">
            Music Market Pro Licensing
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {isDowngrade ? 'Manage & Downgrade Your Workspace' : 'Upgrade Your Creator Workspace'}
          </h1>
          <p className="text-neutral-400 text-sm max-w-lg mx-auto">
            {isDowngrade
              ? 'Select a lower tier. Downgrading to Free will enforce the 10-track limit and re-enable the 15% marketplace commission.'
              : 'Unlock unlimited track uploads, 100% direct revenue payouts, and advanced roster management.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left pt-2">

          {/* ================= DOWNGRADE VIEWS ================= */}
          {isDowngrade && (
            <>
              {currentTier === 'label' && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 relative overflow-hidden">
                  <div className="space-y-4">
                    <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-md font-bold uppercase border border-neutral-700">
                      Solo Creator
                    </span>
                                    <h3 className="text-xl font-bold text-white mt-2">Independent Artist</h3>
                    <p className="text-xs text-neutral-400 mt-1">Scale down to solo creator status ($9.99/mo).</p>
                    <p className="text-[11px] text-[#ff8c00] font-medium">
                      Takes effect at the end of your current paid billing period.
                    </p>

                    <ul className="space-y-2.5 text-xs text-neutral-300">
                      <li className="flex items-center gap-2">✓ Unlimited catalogue track uploads</li>
                      <li className="flex items-center gap-2">✓ 10% Marketplace commission</li>
                      <li className="flex items-center gap-2 text-neutral-500">✕ Master label roster management removed</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => handleAction('artist')}
                    disabled={loadingTier !== null}
                    className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-extrabold py-3 rounded-xl text-xs cursor-pointer transition-all border border-neutral-700 disabled:opacity-50"
                  >
                    {loadingTier === 'artist' ? 'Processing...' : 'Switch to Artist Tier'}
                  </button>
                </div>
              )}

              <div
                className={`bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 relative overflow-hidden ${
                  currentTier !== 'label' ? 'md:col-span-2 max-w-lg mx-auto w-full' : ''
                }`}
              >
                <div className="space-y-4 text-center">
                  <span className="text-[10px] bg-red-500/20 text-red-400 px-2.5 py-1 rounded-md font-bold uppercase border border-red-500/30">
                    Basic Tier
                  </span>
                                   <h3 className="text-xl font-bold text-white mt-2">Downgrade to Free</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Downgrade to free tier ($0/mo). Your catalog will be capped at 10 tracks and a 15% marketplace commission will apply.
                  </p>
                  <p className="text-[11px] text-[#ff8c00] font-medium">
                    Takes effect at the end of your current paid billing period.
                  </p>

                </div>
                <button
                  onClick={() => handleAction('free')}
                  disabled={loadingTier !== null}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-extrabold py-3 rounded-xl text-xs cursor-pointer transition-all border border-red-500/30 disabled:opacity-50"
                >
                  {loadingTier === 'free' ? 'Processing...' : 'Downgrade to Free Tier'}
                </button>
              </div>
            </>
          )}

          {/* ================= UPGRADE VIEWS (Filtered by Current Tier) ================= */}
          {!isDowngrade && (
            <>
              {currentTier !== 'artist' && currentTier !== 'label' && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 relative overflow-hidden">
                  <div className="space-y-4">
                    <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-md font-bold uppercase border border-neutral-700">
                      Solo Creator
                    </span>
                    <h3 className="text-xl font-bold text-white mt-2">Independent Artist</h3>
                    <p className="text-xs text-neutral-400 mt-1">Perfect for Artists who are scaling their catalog.</p>

                    <div className="text-3xl font-black text-[#ff8c00]">
                      $9.99<span className="text-xs font-normal text-neutral-400"> / month</span>
                    </div>

                    <ul className="space-y-2.5 text-xs text-neutral-300">
                      <li className="flex items-center gap-2">✓ <strong>Unlimited</strong> catalogue track uploads</li>
                      <li className="flex items-center gap-2">✓ <strong>10% Marketplace commission</strong> via Stripe</li>
<li className="flex items-center gap-2">✓ Audio Player Direct stream links</li>
<li className="flex items-center gap-2">✓ Album uploads/sales</li>
                      <li className="flex items-center gap-2">✓ Enhanced analytics & fan data</li>
                    </ul>
                  </div>

                  <button
                    onClick={() => handleAction('artist')}
                    disabled={loadingTier !== null}
                    className="w-full bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-3 rounded-xl text-xs cursor-pointer transition-all shadow-lg shadow-[#ff8c00]/10 disabled:opacity-50"
                  >
                    {loadingTier === 'artist' ? 'Redirecting...' : 'Upgrade to Artist Tier'}
                  </button>
                </div>
              )}

              {currentTier !== 'label' && (
                <div className="bg-neutral-900 border-2 border-[#ff8c00]/50 rounded-3xl p-6 flex flex-col justify-between space-y-6 relative overflow-hidden shadow-xl shadow-[#ff8c00]/5 md:col-span-1">
                  <div className="absolute top-4 right-4 bg-[#ff8c00] text-neutral-950 font-black text-[9px] uppercase px-2.5 py-1 rounded-md">
                    Most Popular
                  </div>

                  <div className="space-y-4">
                    <span className="text-[10px] bg-[#ff8c00]/20 text-[#ff8c00] px-2.5 py-1 rounded-md font-bold uppercase border border-[#ff8c00]/30">
                      Full Imprint
                    </span>
                    <h3 className="text-xl font-bold text-white mt-2">Label Executive</h3>
                    <p className="text-xs text-neutral-400 mt-1">Built for independent record labels managing multiple artist rosters.</p>

                    <div className="text-3xl font-black text-emerald-400">
                      $29.99<span className="text-xs font-normal text-neutral-400"> / month</span>
                    </div>

                    <ul className="space-y-2.5 text-xs text-neutral-300">
                      <li className="flex items-center gap-2">✓ <strong>Unlimited Hub</strong> catalogue track uploads</li>
                      <li className="flex items-center gap-2">✓ <strong>5% Marketplace commission</strong> via Stripe</li>
                      <li className="flex items-center gap-2">✓ <strong>Master Label Hub</strong> & multi-artist management (4 Artists)</li>
                      <li className="flex items-center gap-2">✓ Up to 4 Individual Music Market Audio Players</li>
                      <li className="flex items-center gap-2">✓ Full roster analytics</li>

                    </ul>
                  </div>

                  <button
                    onClick={() => handleAction('label')}
                    disabled={loadingTier !== null}
                    className="w-full bg-white hover:bg-neutral-200 text-neutral-950 font-extrabold py-3 rounded-xl text-xs cursor-pointer transition-all shadow-lg disabled:opacity-50"
                  >
                    {loadingTier === 'label' ? 'Redirecting...' : 'Upgrade to Label Executive'}
                  </button>
                </div>
              )}
            </>
          )}

        </div>

        <div className="pt-4">
          <a href="/dashboard" className="text-xs text-neutral-500 hover:text-white transition-all">
            &larr; Return to Dashboard
          </a>
        </div>

      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center p-6 text-sm">
          Loading workspace licensing...
        </div>
      }
    >
      <UpgradePageContent />
    </Suspense>
  );
}
