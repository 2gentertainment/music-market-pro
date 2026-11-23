'use client';

import React, { useState } from 'react';
import SupportModal from '@/components/SupportModal';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chhwujiajdhaihupvuix.supabase.co';

function getTrackArtworkUrl(track: any): string | null {
  if (track?.artwork_url) return track.artwork_url;
  if (track?.artwork_file_path) {
    return `${SUPABASE_URL}/storage/v1/object/public/v2-cover-art/${track.artwork_file_path}`;
  }
  return null;
}

function getTrackDownloadUrl(track: any): string | null {
  if (!track?.audio_file_path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/v2-audio-vault/${track.audio_file_path}`;
}

type PlatformKey = 'spotify' | 'apple' | 'youtube' | 'tidal' | 'pandora';

interface StreamingPlatformOption {
  key: PlatformKey;
  name: string;
  url: string;
  accentClass: string;
}

function PlatformBrandIcon({ platform }: { platform: PlatformKey }) {
  switch (platform) {
    case 'spotify':
      return (
        <svg className="w-4 h-4 text-[#1DB954] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      );
    case 'apple':
      return (
        <svg className="w-4 h-4 text-[#FA243C] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.96 6.32c.67-.81 1.12-1.94 1-3.07-.96.04-2.13.64-2.82 1.45-.61.7-.115 1.85-1.01 2.96 1.08.08 2.16-.53 2.83-1.34" />
        </svg>
      );
    case 'youtube':
      return (
        <svg className="w-4 h-4 text-[#FF0000] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'tidal':
      return (
        <svg className="w-4 h-4 text-white flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996 4.004 12l4.004-4.004L12.012 12l-4.004 4.004 4.004 4.004 4.004-4.004L12.012 12l4.004-4.004-4.004-4.004zm4.004 4.004l4.004-4.004L24.024 7.996 20.02 12l-4.004-4.004z" />
        </svg>
      );
    case 'pandora':
      return (
        <svg className="w-4 h-4 text-[#3668FF] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.38 2H5v20h4.72v-6.12h3.48c4.66 0 7.8-2.66 7.8-6.96C21 4.62 17.94 2 13.38 2zm-.34 10.12H9.72V5.74h3.32c2.18 0 3.44 1.16 3.44 3.18 0 2.04-1.26 3.2-3.44 3.2z" />
        </svg>
      );
  }
}

function getStreamingPlatforms(track: any): StreamingPlatformOption[] {
  const candidates: Array<{
    key: PlatformKey;
    name: string;
    url?: string | null;
    accentClass: string;
  }> = [
    {
      key: 'spotify',
      name: 'Spotify',
      url: track?.spotify_url,
      accentClass: 'border-[#1DB954]/30 hover:border-[#1DB954]',
    },
    {
      key: 'apple',
      name: 'Apple Music',
      url: track?.apple_music_url,
      accentClass: 'border-[#FA243C]/30 hover:border-[#FA243C]',
    },
    {
      key: 'youtube',
      name: 'YouTube',
      url: track?.youtube_url,
      accentClass: 'border-[#FF0000]/30 hover:border-[#FF0000]',
    },
    {
      key: 'tidal',
      name: 'TIDAL',
      url: track?.tidal_url,
      accentClass: 'border-white/25 hover:border-white',
    },
    {
      key: 'pandora',
      name: 'Pandora',
      url: track?.pandora_url,
      accentClass: 'border-[#3668FF]/30 hover:border-[#3668FF]',
    },
  ];

  return candidates
    .filter((item) => typeof item.url === 'string' && item.url.trim().length > 0)
    .map((item) => ({
      key: item.key,
      name: item.name,
      url: item.url!.trim(),
      accentClass: item.accentClass,
    }));
}

export default function VaultPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tracks, setTracks] = useState<Array<any> | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [streamModalTrack, setStreamModalTrack] = useState<any | null>(null);

  const handleVaultLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setStreamModalTrack(null);

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

  const activeStreamPlatforms = streamModalTrack ? getStreamingPlatforms(streamModalTrack) : [];

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
          <a href="/" className="text-[#aaa] hover:text-white text-[13px] font-bold transition-all">
            ← Back to Home
          </a>

          {/* Support Envelope Button */}
          <button
            onClick={() => setIsSupportModalOpen(true)}
            className="bg-[#1a1a1a] hover:bg-[#252525] border border-[#2e2e2e] hover:border-[#ff8c00] text-[#ff8c00] p-2.5 rounded-[10px] transition-all cursor-pointer flex items-center justify-center shadow-md"
            title="Contact Support"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <section className="w-full max-w-[680px] mx-auto px-6 py-10 text-center flex flex-col items-center my-auto">
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
        <p className="text-[#aaa] text-[14px] max-w-[480px] mb-8 leading-relaxed">
          Forgot to download your audio masters right away? Enter the email address you used at checkout to stream on your favorite platforms or download your files.
        </p>

        {!tracks ? (
          <form
            onSubmit={handleVaultLookup}
            className="w-full bg-[#161616] border border-[#262626] p-6 rounded-[20px] shadow-xl text-left space-y-4"
          >
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
                onClick={() => {
                  setStreamModalTrack(null);
                  setTracks(null);
                }}
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
                {tracks.map((track, idx) => {
                  const artworkUrl = getTrackArtworkUrl(track);
                  const downloadUrl = getTrackDownloadUrl(track);

                  return (
                    <div
                      key={track.id || idx}
                      className="bg-[#161616] border border-[#262626] p-4 rounded-[16px] flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-black border border-[#2a2a2a] overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {artworkUrl ? (
                            <img
                              src={artworkUrl}
                              alt={track.title || 'Track artwork'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <svg
                              className="w-5 h-5 text-[#666]"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path d="M9 18V5l12-2v13" />
                              <circle cx="6" cy="18" r="3" />
                              <circle cx="18" cy="16" r="3" />
                            </svg>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{track.title}</h4>
                          <span className="text-xs text-[#888] truncate block">
                            Artist: @{track.artist_handle || 'independent'} • High-Quality Audio Master
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setStreamModalTrack(track)}
                          className="bg-[#222] hover:bg-[#2b2b2b] text-white border border-[#343434] hover:border-[#ff8c00]/50 font-bold px-3.5 py-2 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5"
                          title="Choose Streaming Platform"
                        >
                          <svg
                            className="w-3.5 h-3.5 text-[#ff8c00]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 14.5a5 5 0 0 1 0-7" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 17.5a9 9 0 0 1 0-13" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 7.5a5 5 0 0 1 0 7" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 4.5a9 9 0 0 1 0 13" />
                            <circle cx="12" cy="11" r="1.5" fill="currentColor" />
                          </svg>
                          <span>Stream</span>
                        </button>

                        {downloadUrl && (
                          <a
                            href={downloadUrl}
                            download
                            className="bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold px-3.5 py-2 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5"
                            title="Download Audio Master"
                          >
                            <svg
                              className="w-3.5 h-3.5 text-black"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              viewBox="0 0 24 24"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            <span>Download</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ARTIST CONVERSION CARD (Appears right after successful vault retrieval) */}
            <div className="mt-8 relative overflow-hidden rounded-[20px] bg-gradient-to-r from-[#161616] via-[#1a1a1a] to-[#121212] border border-[#2a2a2a] p-6 shadow-xl">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#ff8c00]/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#ff8c00] font-bold uppercase tracking-wider">
                    Independent Creators
                  </span>
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

      {/* Streaming Platforms Pop-up Modal */}
      {streamModalTrack && (
        <div
          onClick={() => setStreamModalTrack(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 touch-manipulation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#161616] border border-[#2a2a2a] rounded-3xl w-full max-w-md p-6 space-y-5 text-left shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#242424] pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-black border border-[#2a2a2a] overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {getTrackArtworkUrl(streamModalTrack) ? (
                    <img
                      src={getTrackArtworkUrl(streamModalTrack)!}
                      alt={streamModalTrack.title || 'Track artwork'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-black text-[#ff8c00]">DSP</span>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[#ff8c00] font-bold uppercase tracking-wider block">
                    Stream Platforms
                  </span>
                  <h3 className="font-extrabold text-base text-white truncate">
                    {streamModalTrack.title}
                  </h3>
                  <p className="text-xs text-[#888] truncate">
                    @{streamModalTrack.artist_handle || 'independent'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStreamModalTrack(null)}
                className="text-[#888] hover:text-white font-bold text-lg cursor-pointer px-1"
                aria-label="Close streaming platforms modal"
              >
                ✕
              </button>
            </div>

            {activeStreamPlatforms.length === 0 ? (
              <div className="bg-[#111] border border-[#262626] rounded-2xl p-5 text-center space-y-2">
                <p className="text-xs font-bold text-white">No streaming links attached to this track yet.</p>
                <p className="text-[11px] text-[#888]">
                  You can still download your master file directly from the Vault.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeStreamPlatforms.map((platform) => (
                  <a
                    key={platform.key}
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full bg-[#111] hover:bg-[#1b1b1b] border ${platform.accentClass} px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all group`}
                  >
                    <span className="flex items-center gap-3">
                      <PlatformBrandIcon platform={platform.key} />
                      <span className="text-white">{platform.name}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#aaa] group-hover:text-white transition-colors">
                      <span>Open</span>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
                      </svg>
                    </span>
                  </a>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setStreamModalTrack(null)}
              className="w-full bg-[#222] hover:bg-[#2b2b2b] text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

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
