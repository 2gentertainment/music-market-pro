'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase as _supabase } from '@/utils/supabase';

export default function CreateAdLandingPage() {
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'free' | 'artist' | 'label'>('artist');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [handleName, setHandleName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formError, setFormError] = useState('');
  const [submittingSignup, setSubmittingSignup] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userTier, setUserTier] = useState<string>('free');
  const [userHandle, setUserHandle] = useState<string | null>(null);
  const [copiedHeroLink, setCopiedHeroLink] = useState(false);

  const isDevSuiteEnabled =
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_SUITE === 'true';

  const syncWorkspaceState = async () => {
    if (isDevSuiteEnabled && typeof window !== 'undefined') {
      const devTier = localStorage.getItem('mm_dev_tier');
      if (devTier && devTier !== 'logged_out') {
        setIsLoggedIn(true);
        setUserTier(devTier);
        setUserHandle(devTier === 'label' ? 'label-imprint' : 'new-artist');
        return;
      } else if (devTier === 'logged_out') {
        setIsLoggedIn(false);
        setUserTier('free');
        setUserHandle(null);
        return;
      }
    }

    try {
      const { data: { session } } = await _supabase.auth.getSession();
      if (session?.user) {
        setIsLoggedIn(true);
        const { data: profile } = await _supabase
          .from('profiles')
          .select('tier, handle')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile?.tier) setUserTier(profile.tier);
        if (profile?.handle) setUserHandle(profile.handle);
      } else {
        setIsLoggedIn(false);
        setUserTier('free');
        setUserHandle(null);
      }
    } catch (err) {
      console.error('Session fetch error:', err);
    }
  };

  useEffect(() => {
    syncWorkspaceState();
    const handleGlobalTierChange = () => syncWorkspaceState();
    window.addEventListener('mm_tier_changed', handleGlobalTierChange);
    return () => window.removeEventListener('mm_tier_changed', handleGlobalTierChange);
  }, []);

  const openTrialModal = (tier: 'artist' | 'label' = 'artist') => {
    setSelectedTier(tier);
    setFormError('');
    setShowSignupModal(true);
  };

  const handleCopyStorefrontLink = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://musicmarket.app';
    const storeUrl =
      userTier === 'label'
        ? `${baseUrl}/artist/${userHandle || 'workspace'}`
        : `${baseUrl}/artist/workspace/${userHandle || 'workspace'}`;

    navigator.clipboard.writeText(storeUrl);
    setCopiedHeroLink(true);
    setTimeout(() => setCopiedHeroLink(false), 2500);
  };

  const generateSlug = (text: string) => {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const checkNameAvailability = async (rawName: string, slug: string) => {
    const trimmed = rawName.trim().toLowerCase();
    if (!slug && !trimmed) return { available: true };

    const { data: existingHandles } = await _supabase
      .from('profiles')
      .select('id, handle, artist_handle, stage_name, label_name')
      .or(`handle.eq.${slug},artist_handle.eq.${slug}`)
      .limit(1);

    if (existingHandles && existingHandles.length > 0) {
      return {
        available: false,
        message: `The handle "${slug}" is already taken. Try a slightly different stage or label name.`,
      };
    }

    const { data: existingNames } = await _supabase
      .from('profiles')
      .select('id, stage_name, label_name')
      .or(`stage_name.ilike.${trimmed},label_name.ilike.${trimmed}`)
      .limit(1);

    if (existingNames && existingNames.length > 0) {
      return {
        available: false,
        message: `"${rawName.trim()}" is already registered as an artist stage name or label name.`,
      };
    }

    return { available: true };
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (selectedTier === 'free') {
      setSelectedTier('artist');
      setFormError('Select Independent Artist or Imprint & Label to claim your 30-Day Free Trial ($0.00 due today).');
      return;
    }

    if (!email || !password || !confirmPassword || !fullName || !phoneNumber || !handleName) {
      setFormError('Please fill out all required fields.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please double-check both password boxes.');
      return;
    }

    if (!agreedToTerms) {
      setFormError('You must warrant ownership/valid licenses of uploaded audio and agree to the terms to proceed.');
      return;
    }

    setSubmittingSignup(true);
    try {
      const cleanHandle = generateSlug(handleName);
      if (!cleanHandle) {
        setFormError('Please enter a valid artist stage name or label name.');
        setSubmittingSignup(false);
        return;
      }

      const availability = await checkNameAvailability(handleName, cleanHandle);
      if (!availability.available) {
        setFormError(availability.message || 'That name or handle is already taken.');
        setSubmittingSignup(false);
        return;
      }

      const { data: authData, error: authError } = await _supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            stage_name: handleName,
            phone: phoneNumber,
          },
        },
      });

      if (authError) {
        setFormError(authError.message);
        setSubmittingSignup(false);
        return;
      }

      if (authData?.user) {
        const { error: dbError } = await _supabase.from('profiles').upsert({
          id: authData.user.id,
          email: email,
          handle: cleanHandle,
          artist_handle: cleanHandle,
          stage_name: selectedTier !== 'label' ? handleName.trim() : null,
          name: selectedTier !== 'label' ? handleName.trim() : null,
          label_name: selectedTier === 'label' ? handleName.trim() : null,
          full_name: handleName.trim(),
          full_legal_name: fullName.trim(),
          phone_number: phoneNumber.trim(),
          tier: selectedTier,
          terms_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (dbError) {
          console.error('Profile Upsert Error:', dbError.message);
          if (dbError.code === '23505') {
            setFormError('That stage name, label name, or handle is already in use.');
            setSubmittingSignup(false);
            return;
          }
        }
      }

      const userId = authData?.user?.id;

      const res = await fetch('/api/checkout/signup-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: selectedTier,
          email,
          handle: cleanHandle,
          handleName,
          fullName,
          phoneNumber,
          userId,
          commissionRate: selectedTier === 'label' ? 0.05 : 0.1,
        }),
      });

      const data = await res.json();
      if (res.ok && (data.url || data.redirectTo)) {
        window.location.href = data.url || data.redirectTo;
        return;
      } else {
        setFormError(data.error || 'Failed to start your 30-day free trial checkout.');
      }
    } catch (err: any) {
      console.error('Trial signup error:', err);
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmittingSignup(false);
    }
  };

  const tierDetails = {
    free: {
      title: 'Free Hub (Downgrade Option)',
      price: 'Included in Trial · $0/mo Anytime',
      description:
        'Start with Artist or Label free for 30 days first—you can switch down to the 10-song Free Hub anytime from your dashboard.',
      features: [
        '10-song centralized catalog hub for fans & A&Rs',
        'Stripe Express account linking for instant direct payouts',
        'Direct track sales enabled (15% commission split)',
        'Available anytime if you downgrade after your 30-day trial',
      ],
    },
    artist: {
      title: 'Independent Artist',
      price: '1st Month Free · Then $9.99 / mo',
      description:
        'Unlock unlimited uploads, custom storefront branding, fan email capture, and a 10% platform commission—$0.00 due today.',
      features: [
        'First 30 days completely free — no promo code needed',
        'Unlimited catalog uploads & custom player branding',
        '10% platform commission split (keep 90% of direct sales)',
        'Built-in audience capture & subscriber fan lists',
      ],
    },
    label: {
      title: 'Imprint & Label',
      price: '1st Month Free · Then $29.99 / mo',
      description:
        'Manage your entire artist roster, shared pipelines, and direct payouts at a 5% platform commission—$0.00 due today.',
      features: [
        'First 30 days completely free — no promo code needed',
        'Centralized management for full multi-artist rosters',
        '5% platform commission split (keep 95% across catalogs)',
        'Unified roster growth tracking & analytics',
      ],
    },
  };

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-[100dvh] bg-[#121212] text-white flex flex-col justify-between touch-manipulation selection:bg-[#ff8c00] selection:text-black">
      <header className="w-full max-w-[1200px] mx-auto p-6 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex items-end gap-1 h-6">
            <span className="w-[2px] h-full bg-[#ff8c00]"></span>
            <span className="w-[2px] h-4 bg-[#ff8c00]"></span>
            <span className="w-[2px] h-3 bg-[#ff8c00]"></span>
            <span className="w-[2px] h-2 bg-[#ff8c00]"></span>
            <span className="w-[2px] h-3 bg-[#ff8c00]"></span>
            <span className="w-[2px] h-5 bg-[#2ecc71]"></span>
            <span className="w-[2px] h-full bg-[#ff8c00]"></span>
          </div>
          <span className="font-bold tracking-[1px] text-[15px]">Music Market</span>
        </Link>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="bg-[#1e1e1e] border border-[#333] hover:border-[#ff8c00] px-4 py-2 rounded-[10px] text-[13px] font-bold transition-all"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/auth"
                className="text-[#aaa] hover:text-white text-[13px] font-bold px-3 py-2 transition-all"
              >

                Try Free
              </button>
            </>
          )}
        </div>
      </header>

      <section className="w-full max-w-[950px] mx-auto px-6 py-14 text-center flex flex-col items-center">
        <div className="w-[110px] h-[110px] mb-7 rounded-[20px] bg-black border border-[#262626] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex items-center justify-center">
          <div className="flex items-end gap-1.5 h-12">
            <span className="w-[3px] h-full bg-[#ff8c00] rounded-full"></span>
            <span className="w-[3px] h-8 bg-[#ff8c00] rounded-full"></span>
            <span className="w-[3px] h-6 bg-[#ff8c00] rounded-full"></span>
            <span className="w-[3px] h-4 bg-[#ff8c00] rounded-full"></span>
            <span className="w-[3px] h-6 bg-[#ff8c00] rounded-full"></span>
            <span className="w-[3px] h-10 bg-[#2ecc71] rounded-full"></span>
            <span className="w-[3px] h-full bg-[#ff8c00] rounded-full"></span>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 bg-[#1b3a2b] border border-[#27ae60]/50 text-[#2ecc71] text-[12px] font-extrabold px-3.5 py-1 rounded-full mb-4 tracking-wide uppercase">
          <span>● Limited Time Offer — First Month Free</span>
        </div>

        <h1 className="text-[34px] md:text-[52px] font-extrabold tracking-tight mb-4 leading-tight">
          Music Mrket Is Your. <span className="text-[#ff8c00]">Bridge.</span>
        </h1>

        <p className="text-[#aaa] text-[15px] md:text-[17px] max-w-[680px] mb-8 leading-relaxed">
          {isLoggedIn
            ? `Welcome back to your workspace. Manage your ${userTier === 'label' ? 'artist roster and store hub' : 'catalog and direct payouts'} or copy your storefront link below.`
            : 'Turn social media clicks into streaming traffic, direct sales, and an owned fan data inside one customizable storefront. Try Artist or Label tier free for 30 days.'}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full sm:w-auto">
          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold px-8 py-4 rounded-[12px] text-[15px] transition-all cursor-pointer shadow-[0_0_24px_rgba(255,140,0,0.3)] text-center"
              >
                View Dashboard →
              </Link>
              <button
                onClick={handleCopyStorefrontLink}
                className="w-full sm:w-auto bg-[#181818] hover:bg-[#222] border border-[#333] text-white font-bold px-8 py-4 rounded-[12px] text-[15px] transition-all text-center cursor-pointer"
              >
                {copiedHeroLink ? '✓ Link Copied!' : 'Copy Store Links'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => openTrialModal('artist')}
                className="w-full sm:w-auto bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold px-8 py-4 rounded-[12px] text-[15px] transition-all cursor-pointer shadow-[0_0_24px_rgba(255,140,0,0.3)]"
              >
                Try 1 Month Free →
              </button>
              <Link
                href="/market"
                className="w-full sm:w-auto bg-[#181818] hover:bg-[#222] border border-[#333] text-white font-bold px-8 py-4 rounded-[12px] text-[15px] transition-all text-center"
              >
                Store Demo
              </Link>
            </>
          )}
        </div>

        {!isLoggedIn && (
          <p className="text-[12px] text-[#777] mt-4">
            $0.00 due today · Automatic 30-day free trial applied · Cancel or downgrade to Free anytime
          </p>
        )}
      </section>

      {!isLoggedIn && (
        <section className="w-full max-w-[1100px] mx-auto px-6 py-14 border-t border-[#1f1f1f]">
          <div className="text-center mb-10">
            <h2 className="text-[28px] font-bold tracking-tight mb-2">One Link. Three Revenue &amp; Growth Engines.</h2>
            <p className="text-[#888] text-[14px]">
              Built for independent artists and labels running ads, dropping singles, and selling direct.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#161616] border border-[#222] p-6 rounded-[16px] flex flex-col gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#2a1f12] border border-[#ff8c00]/30 flex items-center justify-center text-[#ff8c00] font-bold">
                01
              </div>
              <h3 className="text-[16px] font-bold text-white">Route Listeners to Every DSP</h3>
              <p className="text-[13px] text-[#888] leading-relaxed">
                Send fans straight to Apple Music, Spotify, Tidal, YouTube, or Pandora with live click telemetry—without losing them to generic link trees.
              </p>
            </div>
            <div className="bg-[#161616] border border-[#222] p-6 rounded-[16px] flex flex-col gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#1b3a2b] border border-[#27ae60]/30 flex items-center justify-center text-[#2ecc71] font-bold">
                02
              </div>
              <h3 className="text-[16px] font-bold text-white">Sell Singles &amp; Albums Direct</h3>
              <p className="text-[13px] text-[#888] leading-relaxed">
                Sell high-quality singles and full album bundles right from your player with instant Stripe payouts—keep 90% on Artist or 95% on Label.
              </p>
            </div>
            <div className="bg-[#161616] border border-[#222] p-6 rounded-[16px] flex flex-col gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#222] border border-[#444] flex items-center justify-center text-white font-bold">
                03
              </div>
              <h3 className="text-[16px] font-bold text-white">Capture Your Own Fan List</h3>
              <p className="text-[13px] text-[#888] leading-relaxed">
                Every visitor can subscribe directly inside your player so you own your audience for future drops, merch, and shows—independent of algorithms.
              </p>
            </div>
          </div>
        </section>
      )}

      {showSignupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 touch-manipulation">
          <div className="bg-[#161616] border border-[#2e2e2e] w-full max-w-[540px] rounded-[22px] p-6 sm:p-8 relative shadow-2xl max-h-[90vh] overflow-y-auto touch-manipulation">
            <button
              onClick={() => setShowSignupModal(false)}
              className="absolute top-4 right-4 text-[#888] hover:text-white text-[18px] font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="inline-block bg-[#1b3a2b] border border-[#27ae60]/40 text-[#2ecc71] text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-2">
              30-Day Free Trial Automatically Applied
            </div>
            <h3 className="text-[22px] font-bold mb-1">Start Your First Month Free</h3>
            <p className="text-[#888] text-[13px] mb-5">
              Choose Artist or Label below—$0.00 due today, no promo code required.
            </p>

            <div className="grid grid-cols-3 gap-2 mb-5">
              {(['free', 'artist', 'label'] as const).map((tier) => {
                const isLockedFree = tier === 'free';
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      if (isLockedFree) {
                        setSelectedTier('free');
                        return;
                      }
                      setFormError('');
                      setSelectedTier(tier);
                    }}
                    className={`py-3 px-2 rounded-[10px] text-[12px] font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      selectedTier === tier
                        ? isLockedFree
                          ? 'bg-[#1a1a1a] border-[#555] text-[#aaa]'
                          : 'bg-[#222] border-[#ff8c00] text-[#ff8c00] shadow-[0_0_12px_rgba(255,140,0,0.15)]'
                        : 'bg-[#111] border-[#222] text-[#888] hover:border-[#444]'
                    }`}
                  >
                    <span>{tier === 'free' ? 'Free Hub' : tier === 'artist' ? 'Artist' : 'Label'}</span>
                    <span className="text-[9px] font-semibold">
                      {isLockedFree ? 'Downgrade Option' : '30 Days Free'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="bg-[#111] border border-[#262626] rounded-[14px] p-4 mb-6">
              <div className="flex justify-between items-center gap-2 mb-1">
                <h4 className="text-[15px] font-bold text-white">{tierDetails[selectedTier].title}</h4>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    selectedTier === 'free'
                      ? 'text-[#aaa] bg-[#1c1c1c] border-[#333]'
                      : 'text-[#2ecc71] bg-[#1b3a2b] border-[#27ae60]/40'
                  }`}
                >
                  {tierDetails[selectedTier].price}
                </span>
              </div>
              <p className="text-[12px] text-[#888] mb-3 leading-relaxed">
                {tierDetails[selectedTier].description}
              </p>
              <div className="space-y-1.5 border-t border-[#1e1e1e] pt-3">
                {tierDetails[selectedTier].features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[12px] text-[#ccc]">
                    <span className="text-[#2ecc71] font-bold text-[13px]">✓</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedTier === 'free' ? (
              <div className="bg-[#1a140d] border border-[#ff8c00]/40 rounded-[14px] p-4 text-center space-y-3">
                <p className="text-[12px] text-[#ddd] leading-relaxed">
                  Direct Free Hub signups are locked on this promo page so you can get your{' '}
                  <span className="text-[#ff8c00] font-bold">first 30 days of Artist or Label completely free</span>. You can switch to Free anytime inside your dashboard.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTier('artist')}
                    className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold py-2.5 px-4 rounded-[10px] text-[12px] cursor-pointer"
                  >
                    Try Artist Free (30 Days)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTier('label')}
                    className="flex-1 bg-[#222] hover:bg-[#2c2c2c] border border-[#3a3a3a] text-white font-bold py-2.5 px-4 rounded-[10px] text-[12px] cursor-pointer"
                  >
                    Try Label Free (30 Days)
                  </button>
                </div>
              </div>
            ) : (
              <>
                {formError && (
                  <div className="p-3 mb-4 bg-red-500/10 border border-red-500 text-red-400 text-xs rounded-lg text-left">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSignupSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-[12px] text-[#aaa] font-bold mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      name="fullName"
                      autoComplete="name"
                      placeholder="e.g. Johnathan Michael Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#111] border border-[#2e2e2e] focus:border-[#ff8c00] px-4 py-3 rounded-[10px] text-[16px] text-white outline-none mb-3"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] text-[#aaa] font-bold mb-1">
                      {selectedTier === 'label' ? 'Label Name' : 'Artist Stage Name'}
                    </label>
                    <input
                      type="text"
                      name="handleName"
                      autoComplete="nickname"
                      placeholder={selectedTier === 'label' ? 'Enter Record Label Name' : 'Enter Artist Stage Name'}
                      value={handleName}
                      onChange={(e) => setHandleName(e.target.value)}
                      className="w-full bg-[#111] border border-[#2e2e2e] focus:border-[#ff8c00] px-4 py-3 rounded-[10px] text-[16px] text-white outline-none mb-3"
                      required
                    />
                    {handleName.trim() && (
                      <p className="text-[11px] text-[#888] mt-[-6px] mb-3 truncate">
                        Storefront Link: <span className="text-[#ff8c00] font-semibold">/artist/{generateSlug(handleName)}</span>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-[12px] text-[#aaa] font-bold mb-1">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder="artist@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-[#111] border border-[#2e2e2e] focus:border-[#ff8c00] px-4 py-3 rounded-[10px] text-[16px] text-white outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-[#aaa] font-bold mb-1">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        autoComplete="tel"
                        placeholder="(555) 000-0000"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full bg-[#111] border border-[#2e2e2e] focus:border-[#ff8c00] px-4 py-3 rounded-[10px] text-[16px] text-white outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] text-[#aaa] font-bold mb-1">Create Password</label>
                      <input
                        type="password"
                        name="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#111] border border-[#2e2e2e] focus:border-[#ff8c00] px-4 py-3 rounded-[10px] text-[16px] text-white outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-[#aaa] font-bold mb-1">Verify Password</label>
                      <input
                        type="password"
                        name="confirmPassword"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full bg-[#111] border px-4 py-3 rounded-[10px] text-[16px] text-white outline-none ${
                          passwordsMismatch ? 'border-red-500 focus:border-red-500' : 'border-[#2e2e2e] focus:border-[#ff8c00]'
                        }`}
                        required
                      />
                    </div>
                  </div>
                  {passwordsMismatch && (
                    <p className="text-[11px] text-red-400 mt-[-2px]">Passwords do not match yet.</p>
                  )}

                  <div className="flex items-start gap-3 mt-2 text-left">
                    <input
                      type="checkbox"
                      id="createTerms"
                      required
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-neutral-800 bg-neutral-900 text-[#ff8c00] focus:ring-[#ff8c00] cursor-pointer accent-[#ff8c00] flex-shrink-0"
                    />
                    <label htmlFor="createTerms" className="text-[11px] text-[#888] leading-relaxed cursor-pointer">
                      I warrant that I own 100% of the rights or hold explicit, valid licenses (including beat leases/exclusive rights and sample clearances) for all audio uploaded. I agree to indemnify and hold harmless <span className="text-white font-medium">2G Entertainment</span> and <span className="text-white font-medium">Music Market</span> from any copyright infringement claims, damages, or liabilities. Violations will result in immediate account termination without refund.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingSignup}
                    className="w-full bg-[#ff8c00] hover:bg-[#e07b00] disabled:opacity-50 text-black font-bold py-3.5 rounded-[10px] text-[14px] transition-all cursor-pointer mt-2"
                  >
                    {submittingSignup
                      ? 'Setting Up Your Free Month...'
                      : `Start ${selectedTier === 'artist' ? 'Artist' : 'Label'} 30-Day Free Trial →`}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <footer className="w-full border-t border-[#1f1f1f] py-6 text-center text-[12px] text-[#666]">
        &copy; {new Date().getFullYear()} Music Market. All rights reserved.
      </footer>
    </div>
  );
}
