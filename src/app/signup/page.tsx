'use client';

import React, { useState } from 'react';
import { supabaseV2 } from '@/lib/supabaseClient';
import { Check, Music, Building2, Sparkles, ArrowRight } from 'lucide-react';

type Tier = 'free' | 'artist' | 'label';

export default function SignUpPage() {
  const [selectedTier, setSelectedTier] = useState<Tier>('artist');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      // 1. Sign up user via Supabase Auth into V2 namespace
      const { data, error } = await supabaseV2.auth.signUp({
        email,
        password,
        options: {
          data: {
            tier: selectedTier,
          },
        },
      });

      if (error) throw error;

      // 2. Routing Logic
      if (selectedTier === 'free') {
        // Free tier goes straight to the dashboard
        window.location.href = '/dashboard';
      } else {
        // Paid tiers ($9.99 / $29.99) trigger Stripe Checkout Session
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user?.id,
            email: email,
            tier: selectedTier,
          }),
        });

        const checkoutData = await response.json();
        if (checkoutData.url) {
          window.location.href = checkoutData.url;
        } else {
          throw new Error('Failed to create Stripe checkout session');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 mx-auto text-center">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">
            Join 2G Music Market
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Select the tier that fits your creative vision.
          </p>
        </div>

        {/* Tier Selector Cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* FREE TIER */}
          <button
            type="button"
            onClick={() => setSelectedTier('free')}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedTier === 'free'
                ? 'border-white bg-zinc-900 shadow-lg scale-105'
                : 'border-zinc-800 bg-zinc-950 text-gray-400 hover:border-zinc-700'
            }`}
          >
            <Music className="w-6 h-6 mb-2 text-gray-400" />
            <h3 className="font-bold text-white text-sm">Free</h3>
            <p className="text-xs text-gray-400 mt-1">$0/mo</p>
          </button>

          {/* ARTIST TIER */}
          <button
            type="button"
            onClick={() => setSelectedTier('artist')}
            className={`p-4 rounded-xl border text-left transition-all relative ${
              selectedTier === 'artist'
                ? 'border-emerald-500 bg-zinc-900 shadow-lg scale-105'
                : 'border-zinc-800 bg-zinc-950 text-gray-400 hover:border-zinc-700'
            }`}
          >
            <Sparkles className="w-6 h-6 mb-2 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">Artist</h3>
            <p className="text-xs text-emerald-400 font-semibold mt-1">$9.99/mo</p>
          </button>

          {/* LABEL TIER */}
          <button
            type="button"
            onClick={() => setSelectedTier('label')}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedTier === 'label'
                ? 'border-purple-500 bg-zinc-900 shadow-lg scale-105'
                : 'border-zinc-800 bg-zinc-950 text-gray-400 hover:border-zinc-700'
            }`}
          >
            <Building2 className="w-6 h-6 mb-2 text-purple-400" />
            <h3 className="font-bold text-white text-sm">Label</h3>
            <p className="text-xs text-purple-400 font-semibold mt-1">$29.99/mo</p>
          </button>
        </div>

        {/* Tier Details Box */}
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-left text-xs space-y-2">
          {selectedTier === 'free' && (
            <p className="text-gray-300">
              • Access to basic music discovery player<br />
              • Standard listener account features
            </p>
          )}
          {selectedTier === 'artist' && (
            <p className="text-gray-300">
              • Full catalogue & track metadata management<br />
              • Custom fan-intent link arrays (merch, socials, etc.)<br />
              • Direct track/album pricing controls<br />
              • Daily stream & bandwidth metrics
            </p>
          )}
          {selectedTier === 'label' && (
            <p className="text-gray-300">
              • Everything in Artist tier<br />
              • Manage up to <strong>4 Artist Rosters</strong> under 1 dashboard<br />
              • Unified catalog & revenue analytics
            </p>
          )}
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSignUp} className="mt-8 space-y-4 text-left">
          {errorMessage && (
            <div className="p-3 bg-red-900/40 border border-red-500 text-red-200 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="artist@label.com"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              'Processing...'
            ) : (
              <>
                <span>Continue to {selectedTier === 'free' ? 'Dashboard' : 'Payment'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
