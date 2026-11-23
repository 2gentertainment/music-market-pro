'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

interface ImpulsePlayerProps {
  trackId: string | number;
}

export default function ImpulsePlayer({ trackId }: ImpulsePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [track, setTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resolvedArtistHandle, setResolvedArtistHandle] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSingleTrack() {
      setLoading(true);
      try {
        const { data, error } = await _supabase
          .from('tracks_pro')
          .select('*')
          .eq('id', trackId)
          .is('deleted_at', null)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          let audioUrl = data.audio_file_path;
          if (audioUrl && !audioUrl.startsWith('http')) {
            audioUrl = _supabase.storage.from('v2-audio-vault').getPublicUrl(audioUrl).data.publicUrl;
          }

          let artUrl = data.artwork_url;
          if (data.artwork_file_path && !data.artwork_file_path.startsWith('http')) {
            artUrl = _supabase.storage.from('v2-cover-art').getPublicUrl(data.artwork_file_path).data.publicUrl;
          }

          setTrack({
            ...data,
            audio_file_path: audioUrl,
            artwork_url: artUrl,
          });

          const rawHandle = data.artist_handle?.trim() || '';
          if (!rawHandle) {
            setResolvedArtistHandle(null);
          } else {
            const { data: matchedProfile } = await _supabase
              .from('profiles')
              .select('id, handle, artist_handle, tier, main_artist_profile_id')
              .or(`handle.ilike.${rawHandle},artist_handle.ilike.${rawHandle}`)
              .limit(1)
              .maybeSingle();

            if (matchedProfile) {
              let designatedMainHandle: string | null = null;
              if (matchedProfile.main_artist_profile_id) {
                const { data: designatedMain } = await _supabase
                  .from('profiles')
                  .select('artist_handle, handle')
                  .eq('id', matchedProfile.main_artist_profile_id)
                  .maybeSingle();
                designatedMainHandle =
                  designatedMain?.artist_handle?.trim() ||
                  designatedMain?.handle?.trim() ||
                  null;
              }

              const isLabelRow =
                matchedProfile.tier === 'label' ||
                (matchedProfile.handle &&
                  matchedProfile.handle.trim().toLowerCase() === rawHandle.toLowerCase() &&
                  matchedProfile.artist_handle);

              if (designatedMainHandle) {
                setResolvedArtistHandle(designatedMainHandle);
              } else if (matchedProfile.artist_handle?.trim()) {
                setResolvedArtistHandle(matchedProfile.artist_handle.trim());
              } else if (isLabelRow) {
                const { data: firstRoster } = await _supabase
                  .from('profiles')
                  .select('artist_handle, handle, created_at')
                  .eq('parent_label_id', matchedProfile.id)
                  .neq('id', matchedProfile.id)
                  .order('created_at', { ascending: true })
                  .limit(1)
                  .maybeSingle();

                setResolvedArtistHandle(
                  firstRoster?.artist_handle?.trim() ||
                    firstRoster?.handle?.trim() ||
                    rawHandle
                );
              } else {
                setResolvedArtistHandle(rawHandle);
              }
            } else {
              setResolvedArtistHandle(rawHandle);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching impulse drop track:', err);
      } finally {
        setLoading(false);
      }
    }

    if (trackId) {
      fetchSingleTrack();
    }
  }, [trackId]);

  function getVisitorId(): string {
    if (typeof window === 'undefined') return 'server';
    let vid = localStorage.getItem('mm_visitor_id');
    if (!vid) {
      vid = `v_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
      localStorage.setItem('mm_visitor_id', vid);
    }
    return vid;
  }

  async function logImpulseEvent(
    eventType: 'play' | 'outbound_stream',
    extraMetadata: Record<string, any> = {}
  ) {
    if (!track?.id) return;
    const ownerHandle = (resolvedArtistHandle || track.artist_handle || '').trim().toLowerCase();
    if (!ownerHandle) return;

    try {
      await _supabase.from('analytics_events_v2').insert({
        event_type: eventType,
        track_id: String(track.id),
        artist_handle: ownerHandle,
        visitor_id: getVisitorId(),
        metadata: {
          track_title: track.title || null,
          album_name: track.album_name || null,
          source: 'impulse_player',
          ...extraMetadata,
        },
      });
    } catch (err) {
      console.error(`Failed to log ${eventType} event on ImpulsePlayer:`, err);
    }
  }

  const togglePlay = () => {
    if (!audioRef.current || !track?.audio_file_path) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            logImpulseEvent('play');
          })
          .catch((err) => {
            if (err?.name !== 'AbortError') {
              console.error('Impulse audio playback error:', err);
            }
          });
      } else {
        logImpulseEvent('play');
      }
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleBuyTrack = async () => {
    if (!track || !track.id) return;
    try {
      const response = await fetch('/api/checkout/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              itemType: 'single',
              trackId: String(track.id),
              price: track.price,
              title: track.title,
              artistHandle: resolvedArtistHandle || track.artist_handle,
            },
          ],
        }),
      });
      const responseText = await response.text();
      let session;
      try {
        session = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('Non-JSON server response:', responseText);
        alert('Server error: received invalid response from checkout route.');
        return;
      }

      if (session.url) {
        window.location.href = session.url;
      } else {
        alert(session.error || 'Could not initiate checkout.');
      }
    } catch (err) {
      console.error('Stripe checkout error:', err);
      alert('Network error connecting to payment gateway.');
    }
  };

  if (loading) {
    return (
      <div className="h-[100dvh] w-full overflow-hidden bg-neutral-950 text-white flex items-center justify-center p-4 text-sm text-neutral-400">
        Loading drop...
      </div>
    );
  }

  if (!track) {
    return (
      <div className="h-[100dvh] w-full overflow-hidden bg-neutral-950 text-white flex items-center justify-center p-4 text-sm text-neutral-400">
        Track drop not found or unavailable.
      </div>
    );
  }

  const hasStreamLinks = Boolean(
    track.spotify_url || track.apple_music_url || track.tidal_url || track.youtube_url || track.pandora_url
  );

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-neutral-950 text-white flex flex-col items-center justify-center p-4 touch-manipulation selection:bg-[#ff8c00] selection:text-black">
      <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(200%); }
        }
        .animate-shine {
          animation: shine 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      <div className="w-full max-w-[420px] max-h-[94dvh] bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col items-center justify-center space-y-4 relative overflow-hidden touch-manipulation">
        {/* Header Branding */}
        <div className="text-center shrink-0">
          <span className="text-[10px] bg-[#ff8c00]/15 border border-[#ff8c00]/40 text-[#ff8c00] px-3.5 py-1 rounded-full font-extrabold uppercase tracking-widest shadow-[0_0_15px_rgba(255,140,0,0.25)]">
            Official Single Drop
          </span>
        </div>

        {/* Large Artwork with Play Overlay */}
        <div
          className="relative group w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 bg-neutral-950 cursor-pointer shrink-0"
          onClick={togglePlay}
        >
          <img
            src={
              track.artwork_url ||
              'https://27593217-482041110881488807.preview.editmysite.com/uploads/2/7/5/9/27593217/logo-box_orig.jpg'
            }
            alt={track.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity">
            <div className="w-16 h-16 rounded-full bg-[#ff8c00] text-neutral-950 flex items-center justify-center shadow-xl shadow-[#ff8c00]/40">
              {!isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Track Title & Artist Handle */}
        <div className="text-center space-y-0.5 w-full truncate px-2 shrink-0">
          <h1 className="text-xl font-extrabold text-white truncate">{track.title}</h1>
          <p className="text-xs text-[#ff8c00] font-bold">
            @{resolvedArtistHandle || track.artist_handle?.trim() || '2g-entertainment'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-1 px-1 shrink-0">
          <input
            type="range"
            className="w-full h-1.5 bg-neutral-800 rounded-lg outline-none cursor-pointer accent-[#ff8c00]"
            value={currentTime}
            min={0}
            max={duration || 100}
            step={0.1}
            onChange={handleSeek}
          />
          <div className="flex justify-between text-[11px] text-neutral-500 font-medium">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* STREAMING PLATFORM BUTTONS (Strict 2-Column Grid) */}
        {hasStreamLinks && (
          <div className="w-full space-y-1.5 shrink-0">
            <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-extrabold block text-center">
              Stream On Platforms
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Spotify', url: track.spotify_url },
                { label: 'Apple Music', url: track.apple_music_url },
                { label: 'Tidal', url: track.tidal_url },
                { label: 'YouTube', url: track.youtube_url },
                { label: 'Pandora', url: track.pandora_url },
              ]
                .filter((item) => Boolean(item.url?.trim()))
                .map((item) => (
                  <a
                    key={item.label}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => logImpulseEvent('outbound_stream', { platform: item.label })}
                    className="relative overflow-hidden p-2 rounded-xl bg-neutral-950 border border-[#ff8c00]/60 hover:border-[#ff8c00] text-neutral-100 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(255,140,0,0.18)] group"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#ff8c00]/25 to-transparent -translate-x-full group-hover:animate-shine" />
                    {item.label}
                  </a>
                ))}
            </div>
          </div>
        )}

        {/* Direct Purchase Button with Continuous Seamless Shine */}
        <button
          onClick={handleBuyTrack}
          className="relative overflow-hidden w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25 transition-all group shrink-0"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shine pointer-events-none" />
          <span>Buy Master Audio</span>
          <span className="bg-emerald-950/20 px-2.5 py-0.5 rounded-lg text-xs font-black">${track.price}</span>
        </button>
      </div>

      <audio
        ref={audioRef}
        src={track.audio_file_path}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}
