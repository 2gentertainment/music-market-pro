'use client';

import React, { useState } from 'react';
import SupportModal from '@/components/SupportModal';

export default function VaultPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tracks, setTracks] = useState<Array<any> | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  const handleVaultLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/vault/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to retrieve vault access.');
      }

      setTracks(data.tracks || []);
    } catch (err: any) {
      console.error('Vault lookup error:', err);
      setError(err.message || 'An unexpected error occurred.');
      setTracks(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col justify-between touch-manipulation selection:bg-[#ff8c00] selection:text-black">
      {/* Header */}
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
          <span className="font-bold tracking-[1px] text-[15px]">Music Market Vault</span>
        </div>

        <div className="flex items-center gap-4">
          <a href="/" className="text-[#aaa] hover:text-white text-[13px] font-bold transition-all">← Back to Home</a>
          
          {/* Support Envelope Button */}
          <button
            onClick={() => setIsSupportModalOpen(true)}
            className="bg-[#1a1a1a] hover:bg-[#252525] border border-[#2e2e2e] hover:border-[#ff8c00] text-[#ff8c00] p-2.5 rounded-[10px] transition-all cursor-pointer flex items-center justify-center shadow-md"
            title="Contact Support"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <section className="w-full max-w-[600px] mx-auto px-6 py-12 text-center flex flex-col items-center my-auto">
        <div className="w-[80px] h-[80px] mb-6 rounded-[20px] bg-black border border-[#262626] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex items-center justify-center">
          <svg 
            className="w-8 h-8 text-[#ff8c00]" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        
        <h1 className="text-[32px] font-extrabold tracking-tight mb-2">Customer Download Vault</h1>
        <p className="text-[#aaa] text-[14px] max-w-[460px] mb-8 leading-relaxed">
          Forgot to download your audio masters right away? Enter the email address you used at checkout to instantly access your files.
        </p>

        {!tracks ? (
          <form onSubmit={handleVaultLookup} className="w-full bg-[#161616] border border-[#262626] p-6 rounded-[20px] shadow-xl text-left space-y-4">
            <div>
              <label className="block text-[12px] text-[#aaa] font-bold mb-1.5">Checkout Email Address</label>
              <input
                type="email"
                placeholder="fan@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111] border border-[#2e2e2e] focus:border-[#ff8c00] px-4 py-3 rounded-[10px] text-base sm:text-[14px] text-white outline-none"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500 text-red-400 text-xs rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold py-3.5 rounded-[10px] text-[14px] transition-all cursor-pointer shadow-[0_0_20px_rgba(255,140,0,0.2)] disabled:opacity-50"
            >
              {loading ? 'Searching Vault...' : 'Unlock My Files →'}
            </button>
          </form>
        ) : (
          <div className="w-full space-y-4 text-left">
            <div className="flex justify-between items-center bg-[#1a1a1a] border border-[#333] p-4 rounded-[14px]">
              <div>
                <span className="text-[12px] text-[#2ecc71] font-bold">● Vault Verified</span>
                <h3 className="text-[14px] text-white font-medium">{email}</h3>
              </div>
              <button
                onClick={() => setTracks(null)}
                className="text-xs text-[#aaa] hover:text-white underline cursor-pointer"
              >
                Search Different Email
              </button>
            </div>

            <h3 className="text-[16px] font-bold text-white pt-2">Your Purchased Masters ({tracks.length})</h3>

            {tracks.length === 0 ? (
              <div className="bg-[#161616] border border-[#262626] p-6 rounded-[16px] text-center text-[#888] text-xs">
                No completed purchase records found matching this email address.
              </div>
            ) : (
              <div className="space-y-3">
                {tracks.map((track, idx) => (
                  <div key={idx} className="bg-[#161616] border border-[#262626] p-4 rounded-[16px] flex justify-between items-center gap-4">
                    <div className="truncate">
                      <h4 className="text-sm font-bold text-white truncate">{track.title}</h4>
                      <span className="text-xs text-[#888] truncate block">
                        Artist: @{track.artist_handle || 'independent'} • High-Quality Audio Master
                      </span>
                    </div>
                    {track.audio_file_path && (
                      <a
                        href={`https://chhwujiajdhaihupvuix.supabase.co/storage/v1/object/public/v2-audio-vault/${track.audio_file_path}`}
                        download
                        className="bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer"
                      >
                        Download Master 📥
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ARTIST CONVERSION CARD (Appears right after successful vault retrieval) */}
            <div className="mt-8 relative overflow-hidden rounded-[20px] bg-gradient-to-r from-[#161616] via-[#1a1a1a] to-[#121212] border border-[#2a2a2a] p-6 shadow-xl">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#ff8c00]/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#ff8c00] font-bold uppercase tracking-wider">Independent Creators</span>
                  <h4 className="text-sm font-extrabold text-white">Are you an artist or label?</h4>
                  <p className="text-xs text-[#aaa] max-w-[280px]">
                    Launch your own automated music store and keep 100% of your leverage with direct Stripe payouts.
                  </p>
                </div>
                
                <a
                  href="/#pricing"
                  className="bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold px-5 py-3 rounded-[12px] text-xs whitespace-nowrap transition-all shadow-[0_0_15px_rgba(255,140,0,0.2)] cursor-pointer"
                >
                  Start Your Store →
                </a>
              </div>
            </div>

          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-[#1f1f1f] py-6 text-center text-[12px] text-[#666]">
        &copy; {new Date().getFullYear()} Music Market. All rights reserved.
      </footer>

      {/* Support Modal */}
      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        userEmail={email || undefined}
      />
    </div>
  );
}
