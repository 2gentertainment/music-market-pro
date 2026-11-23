'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase as _supabase } from '@/utils/supabase';

export default function HomePage() {
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'free' | 'artist' | 'label'>('free');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [handleName, setHandleName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formError, setFormError] = useState('');
  const [submittingSignup, setSubmittingSignup] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

      // 1. Register user with Supabase Auth including metadata
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

      // 2. Provision initial profile record with tier-specific naming & dedicated artist_handle
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

      // 3. Free tier -> Stripe Express payout onboarding; Paid tiers -> Subscription checkout first
      const endpoint = selectedTier === 'free' ? '/api/checkout/store' : '/api/checkout/signup';
      const bodyPayload =
        selectedTier === 'free'
          ? {
              email,
              tier: selectedTier,
              handleName,
              fullName,
              phoneNumber,
              userId,
            }
          : {
              tier: selectedTier,
              email,
              handle: cleanHandle,
              handleName,
              fullName,
              phoneNumber,
              userId,
              commissionRate: selectedTier === 'label' ? 0.05 : 0.1,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (res.ok && (data.url || data.redirectTo)) {
        if (selectedTier === 'free' && !data.url) {
          await _supabase.auth.signInWithPassword({ email, password });
        }
        window.location.href = data.url || data.redirectTo;
        return;
      } else {
        setFormError(
          data.error ||
            (selectedTier === 'free'
              ? 'Failed to set up your free workspace.'
              : 'Failed to start subscription checkout.')
        );
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmittingSignup(false);
    }
  };

  const tierDetails = {
    free: {
      title: 'Free Hub',
      price: '100% Free Setup',
      description: 'For Artists: Centralize your core catalog and link your payout rails to start selling directly with 15% platform split.',
      features: [
        '10-song centralized catalog hub for fans & A&Rs',
        'Stripe Express account linking for instant direct payouts',
        'Direct track sales enabled (15% commission split)',
        'Instant upgrade / downgrade anytime',
      ],
    },
    artist: {
      title: 'Independent Artist',
      price: '$9.99 / mo',
      description: 'For Artists: Ready to bridge listeners, lower platform commission to 10%, and scale their independent movement.',
      features: [
        'Unlimited catalog uploads & custom player branding',
        'Stripe Express account linking for direct payouts',
        '10% platform commission split (down from 15%)',
        'Built-in audience capture & subscriber fan lists',
      ],
    },
    label: {
      title: 'Imprint & Label',
      price: '$29.99 / mo',
      description: 'For Record Labels & Management Teams: Controlling multi-artist rosters and shared pipelines.',
      features: [
        'Centralized management for full artist rosters',
        'Stripe Express account linking across all roster profiles',
        'Unified roster growth tracking & analytics',
        '5% platform commission split across artist catalogs',
      ],
    },
  };

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-[100dvh] bg-[#121212] text-white flex flex-col justify-between touch-manipulation selection:bg-[#ff8c00] selection:text-black">
      <header className="w-full max-w-[1200px] mx-auto p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
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
        </div>
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="bg-[#1e1e1e] border border-[#333] hover:border-[#ff8c00] px-4 py-2 rounded-[10px] text-[13px] font-bold transition-all">
                Dashboard
              </Link>
              {userTier === 'free' && (
                <Link href="/upgrade" className="bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold px-4 py-2 rounded-[10px] text-[13px] transition-all cursor-pointer">
                  Upgrade
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/auth" className="text-[#aaa] hover:text-white text-[13px] font-bold px-3 py-2 transition-all">
                Log In
              </Link>
              <button onClick={() => setShowSignupModal(true)} className="bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold px-4 py-2 rounded-[10px] text-[13px] transition-all cursor-pointer">
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      <section className="w-full max-w-[950px] mx-auto px-6 py-16 text-center flex flex-col items-center">
        <div className="w-[120px] h-[120px] mb-8 rounded-[20px] bg-black border border-[#262626] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex items-center justify-center">
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
        <div className="inline-block bg-[#1a1a1a] border border-[#333] text-[#ff8c00] text-[12px] font-bold px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
          Direct-To-Fan-Solutions
        </div>
        <h1 className="text-[36px] md:text-[52px] font-extrabold tracking-tight mb-4 leading-tight">
          Music Market is Your <span className="text-[#ff8c00]">Bridge</span>
        </h1>
        <p className="text-[#aaa] text-[15px] md:text-[17px] max-w-[680px] mb-8 leading-relaxed">
          {isLoggedIn
            ? `Welcome back to your workspace. Manage your ${userTier === 'label' ? 'artist roster and store hub' : 'catalog and direct payouts'} or grab your store link below.`
            : 'The ultimate central hub for independent artists and labels. Guide fans frictionlessly to major streaming platforms while offering direct purchases, audience capture, and unified career tracking.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="w-full sm:w-auto bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold px-8 py-4 rounded-[12px] text-[15px] transition-all cursor-pointer shadow-[0_0_24px_rgba(255,140,0,0.3)] text-center">
                View Dashboard →
              </Link>
              <button onClick={handleCopyStorefrontLink} className="w-full sm:w-auto bg-[#181818] hover:bg-[#222] border border-[#333] text-white font-bold px-8 py-4 rounded-[12px] text-[15px] transition-all text-center cursor-pointer">
                {copiedHeroLink ? '✓ Link Copied!' : 'Copy Store Links'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowSignupModal(true)} className="w-full sm:w-auto bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold px-8 py-4 rounded-[12px] text-[15px] transition-all cursor-pointer shadow-[0_0_24px_rgba(255,140,0,0.3)]">
                Create Your Account →
              </button>
              <Link href="/market" className="w-full sm:w-auto bg-[#181818] hover:bg-[#222] border border-[#333] text-white font-bold px-8 py-4 rounded-[12px] text-[15px] transition-all text-center">
                Explore the Market
              </Link>
            </>
          )}
        </div>
      </section>

      {!isLoggedIn && (
        <section className="w-full max-w-[1100px] mx-auto px-6 py-16 border-t border-[#1f1f1f]">
          <div className="text-center mb-12">
            <h2 className="text-[28px] font-bold tracking-tight mb-2">Designed for Total Control</h2>
            <p className="text-[#888] text-[14px]">Everything artists and label managers need to direct traffic, monetize, and scale.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#161616] border border-[#222] p-6 rounded-[16px] flex flex-col gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#2a1f12] border border-[#ff8c00]/30 flex items-center justify-center text-[#ff8c00] font-bold">01</div>
              <h3 className="text-[16px] font-bold text-white">Frictionless Listener Routing</h3>
              <p className="text-[13px] text-[#888] leading-relaxed">Effortlessly siphon fans to their preferred streaming platforms without roadblocks, giving listeners instant access wherever they stream.</p>
            </div>
            <div className="bg-[#161616] border border-[#222] p-6 rounded-[16px] flex flex-col gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#1b3a2b] border border-[#27ae60]/30 flex items-center justify-center text-[#2ecc71] font-bold">02</div>
              <h3 className="text-[16px] font-bold text-white">Direct-to-Fan Commerce</h3>
              <p className="text-[13px] text-[#888] leading-relaxed">Give dedicated fans who want true ownership a direct place to purchase high-quality downloads and support your movement directly.</p>
            </div>
            <div className="bg-[#161616] border border-[#222] p-6 rounded-[16px] flex flex-col gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#222] border border-[#444] flex items-center justify-center text-white font-bold">03</div>
              <h3 className="text-[16px] font-bold text-white">Unified Traffic & Fan Growth</h3>
              <p className="text-[13px] text-[#888] leading-relaxed">Seamlessly manage your independent career or roster traffic in one place—converting casual listeners into streams, direct sales, and subscribed super-fans.</p>
            </div>
          </div>
        </section>
      )}

      {showSignupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 touch-manipulation">
          <div className="bg-[#161616] border border-[#2e2e2e] w-full max-w-[540px] rounded-[22px] p-6 sm:p-8 relative shadow-2xl max-h-[90vh] overflow-y-auto touch-manipulation">
            <button onClick={() => setShowSignupModal(false)} className="absolute top-4 right-4 text-[#888] hover:text-white text-[18px] font-bold cursor-pointer">
              ✕
            </button>

            {!submitted ? (
              <>
                <h3 className="text-[22px] font-bold mb-1">Create Your Account</h3>
                <p className="text-[#888] text-[13px] mb-5">Select a tier below and set up your payout rails.</p>

                <div className="grid grid-cols-3 gap-2 mb-5">
                  {(['free', 'artist', 'label'] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedTier(tier)}
                      className={`py-3 px-2 rounded-[10px] text-[12px] font-bold border transition-all cursor-pointer capitalize ${
                        selectedTier === tier
                          ? 'bg-[#222] border-[#ff8c00] text-[#ff8c00] shadow-[0_0_12px_rgba(255,140,0,0.15)]'
                          : 'bg-[#111] border-[#222] text-[#888] hover:border-[#444]'
                      }`}
                    >
                      {tier === 'free' ? 'Free' : tier === 'artist' ? 'Artist' : 'Label'}
                    </button>
                  ))}
                </div>

                <div className="bg-[#111] border border-[#262626] rounded-[14px] p-4 mb-6">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-[15px] font-bold text-white">{tierDetails[selectedTier].title}</h4>
                    <span className="text-[11px] font-bold text-[#ff8c00] bg-[#2a1f12] px-2 py-0.5 rounded-full border border-[#ff8c00]/30">
                      {tierDetails[selectedTier].price}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#888] mb-3 leading-relaxed">{tierDetails[selectedTier].description}</p>
                  <div className="space-y-1.5 border-t border-[#1e1e1e] pt-3">
                    {tierDetails[selectedTier].features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[12px] text-[#ccc]">
                        <span className="text-[#2ecc71] font-bold text-[13px]">✓</span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

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
                      className="w-full bg-[#111] border border-[#2e2e2e] focus:border-[#ff8c00] px-4 py-3 rounded-[10px] text-base sm:text-[14px] text-white outline-none mb-3"
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
                      className="w-full bg-[#111] border border-[#2e2e2e] focus:border-[#ff8c00] px-4 py-3 rounded-[10px] text-base sm:text-[14px] text-white outline-none mb-3"
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
                        className="w-full bg-[#111] border border-[#2e2e2e] focus:border-[#ff8c00] px-4 py-3 rounded-[10px] text-base sm:text-[14px] text-white outline-none"
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
                        className="w-full bg-[#111] border border-[#2e2e2e] focus:border-[#ff8c00] px-4 py-3 rounded-[10px] text-base sm:text-[14px] text-white outline-none"
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
                        className="w-full bg-[#111] border border-[#2e2e2e] focus:border-[#ff8c00] px-4 py-3 rounded-[10px] text-base sm:text-[14px] text-white outline-none"
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
                        className={`w-full bg-[#111] border px-4 py-3 rounded-[10px] text-base sm:text-[14px] text-white outline-none ${
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
                      id="homeTerms"
                      required
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-neutral-800 bg-neutral-900 text-[#ff8c00] focus:ring-[#ff8c00] cursor-pointer accent-[#ff8c00] flex-shrink-0"
                    />
                    <label htmlFor="homeTerms" className="text-[11px] text-[#888] leading-relaxed cursor-pointer">
                      I warrant that I own 100% of the rights or hold explicit, valid licenses (including beat leases/exclusive rights and sample clearances) for all audio uploaded. I agree to indemnify and hold harmless <span className="text-white font-medium">2G Entertainment</span> and <span className="text-white font-medium">Music Market</span> from any copyright infringement claims, damages, or liabilities. Violations will result in immediate account termination without refund.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingSignup}
                    className="w-full bg-[#ff8c00] hover:bg-[#e07b00] disabled:opacity-50 text-black font-bold py-3.5 rounded-[10px] text-[14px] transition-all cursor-pointer mt-2"
                  >
                    {submittingSignup
                      ? 'Checking & Setting Up...'
                      : selectedTier === 'free'
                      ? 'Create Free Workspace →'
                      : `Continue to ${selectedTier === 'artist' ? 'Artist' : 'Label'} Checkout →`}
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      )}

      <footer className="w-full border-t border-[#1f1f1f] py-6 text-center text-[12px] text-[#666]">
        &copy; {new Date().getFullYear()} Music Market. All rights reserved.
      </footer>
    </div>
  );
}
