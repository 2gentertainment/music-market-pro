'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { supabase as _supabase } from '@/utils/supabase';

interface Track {
  id: string | number;
  title: string;
  genre?: string | null;
  price: number;
  audio_file_path: string;
  artwork_url?: string | null;
  artwork_file_path?: string | null;
  album_name?: string | null;
  album_price?: number | null;
  album_order?: number | null;
  artist_handle?: string | null;
  created_at?: string | null;
  spotify_url?: string | null;
  apple_music_url?: string | null;
  tidal_url?: string | null;
  youtube_url?: string | null;
  pandora_url?: string | null;
}

interface ProfileRecord {
  id: string;
  handle?: string | null;
  artist_handle?: string | null;
  label_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  tier?: string | null;
  logo_url?: string | null;
  avatar_url?: string | null;
}

interface AlbumSummary {
  name: string;
  handle: string;
  price: number;
  coverUrl: string;
  trackCount: number;
  trackIds: Array<string | number>;
}

const FALLBACK_ART =
  'https://27593217-482041110881488807.preview.editmysite.com/uploads/2/7/5/9/27593217/logo-box_orig.jpg';

function resolveAssetUrl(
  url?: string | null,
  filePath?: string | null,
  bucket: 'v2-audio-vault' | 'v2-cover-art' = 'v2-cover-art'
): string {
  if (url && url.startsWith('http')) return url;
  if (filePath) {
    if (filePath.startsWith('http')) return filePath;
    return _supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
  }
  if (url) {
    return _supabase.storage.from(bucket).getPublicUrl(url).data.publicUrl;
  }
  return '';
}

function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server';
  let vid = localStorage.getItem('mm_visitor_id');
  if (!vid) {
    vid = `v_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
    localStorage.setItem('mm_visitor_id', vid);
  }
  return vid;
}

export default function DiscoverPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [albumArtMap, setAlbumArtMap] = useState<Record<string, string>>({});
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDiscoveryCatalog() {
      setLoading(true);
      try {
        const [
          { data: trackRows, error: trackErr },
          { data: profileRows, error: profileErr },
          { data: albumRows, error: albumErr },
          { data: playRows, error: playErr },
        ] = await Promise.all([
          _supabase
            .from('tracks_pro')
            .select('*')
            .eq('is_archived', false)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          _supabase.from('profiles').select('*'),
          _supabase.from('albums_meta').select('*'),
          _supabase
            .from('analytics_events_v2')
            .select('track_id')
            .eq('event_type', 'play'),
        ]);

        if (trackErr) console.error('Discover tracks error:', trackErr);
        if (profileErr) console.error('Discover profiles error:', profileErr);
        if (albumErr) console.error('Discover albums_meta error:', albumErr);
        if (playErr) console.error('Discover analytics error:', playErr);

        if (cancelled) return;

        const formattedTracks: Track[] = (trackRows || [])
          .filter((t) => t.audio_file_path && !String(t.audio_file_path).includes('v1-legacy'))
          .map((t) => ({
            ...t,
            audio_file_path: resolveAssetUrl(t.audio_file_path, null, 'v2-audio-vault'),
            artwork_url: resolveAssetUrl(t.artwork_url, t.artwork_file_path, 'v2-cover-art') || FALLBACK_ART,
          }));

        const artMap: Record<string, string> = {};
        (albumRows || []).forEach((alb) => {
          const resolved = resolveAssetUrl(alb.artwork_url, alb.artwork_file_path, 'v2-cover-art');
          if (resolved && alb.album_name) {
            artMap[alb.album_name] = resolved;
            artMap[String(alb.album_name).trim().toLowerCase()] = resolved;
          }
        });

        const counts: Record<string, number> = {};
        (playRows || []).forEach((row) => {
          if (row.track_id !== null && row.track_id !== undefined) {
            const key = String(row.track_id);
            counts[key] = (counts[key] || 0) + 1;
          }
        });

        setTracks(formattedTracks);
        setProfiles(profileRows || []);
        setAlbumArtMap(artMap);
        setPlayCounts(counts);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDiscoveryCatalog();
    return () => {
      cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const logEvent = async (
    eventType: 'play' | 'outbound_stream',
    track: Track,
    extra: Record<string, any> = {}
  ) => {
    const handle = (track.artist_handle || '').trim().toLowerCase();
    if (!handle || !track.id) return;

    try {
      await _supabase.from('analytics_events_v2').insert({
        event_type: eventType,
        track_id: String(track.id),
        artist_handle: handle,
        visitor_id: getVisitorId(),
        metadata: {
          track_title: track.title || null,
          album_name: track.album_name || null,
          source: 'discover_page',
          ...extra,
        },
      });
    } catch (err) {
      console.error('Failed to log discover event:', err);
    }
  };

  const syncMediaSession = (track: Track | null, playing: boolean) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      if (!track) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
        return;
      }
      const art = track.artwork_url || FALLBACK_ART;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Untitled Track',
        artist: track.artist_handle ? `@${track.artist_handle}` : 'Music Market',
        album: track.album_name ? track.album_name.split(',')[0].trim() : 'Music Market Discover',
        artwork: [
          { src: art, sizes: '192x192', type: 'image/jpeg' },
          { src: art, sizes: '512x512', type: 'image/jpeg' },
        ],
      });
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    } catch {
      // Ignore unsupported mediaSession errors
    }
  };

  const handleTogglePlay = (track: Track) => {
    if (!track.audio_file_path) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }

    const el = audioRef.current;
    const sameTrack = currentTrack && String(currentTrack.id) === String(track.id);

    if (sameTrack && isPlaying && !el.paused) {
      el.pause();
      setIsPlaying(false);
      syncMediaSession(track, false);
      return;
    }

    if (sameTrack && !isPlaying && el.src) {
      setIsPlaying(true);
      syncMediaSession(track, true);
      el.play().catch(() => setIsPlaying(false));
      return;
    }

    el.pause();
    el.src = track.audio_file_path;
    el.load();
    el.onended = () => {
      setIsPlaying(false);
      syncMediaSession(track, false);
    };

    setCurrentTrack(track);
    setIsPlaying(true);
    syncMediaSession(track, true);

    el.play()
      .then(() => {
        logEvent('play', track);
        setPlayCounts((prev) => ({
          ...prev,
          [String(track.id)]: (prev[String(track.id)] || 0) + 1,
        }));
      })
      .catch((err) => {
        console.error('Discover playback error:', err);
        setIsPlaying(false);
      });
  };

  const handleBuySingle = async (track: Track) => {
    try {
      const res = await fetch('/api/checkout/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              itemType: 'single',
              trackId: String(track.id),
              price: track.price,
              title: track.title,
              artistHandle: track.artist_handle,
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Could not start checkout.');
      }
    } catch {
      alert('Network error starting checkout.');
    }
  };

  const handleBuyAlbum = async (album: AlbumSummary) => {
    try {
      const res = await fetch('/api/checkout/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              itemType: 'album',
              albumName: album.name,
              price: album.price,
              artistHandle: album.handle,
              trackIds: album.trackIds.map(String),
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Could not start album checkout.');
      }
    } catch {
      alert('Network error starting album checkout.');
    }
  };

  const genres = useMemo(() => {
    const set = new Set<string>();
    tracks.forEach((t) => {
      if (t.genre?.trim()) set.add(t.genre.trim());
    });
    return ['ALL', ...Array.from(set)];
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tracks.filter((t) => {
      const matchesGenre =
        selectedGenre === 'ALL' || (t.genre || '').trim().toLowerCase() === selectedGenre.toLowerCase();
      if (!matchesGenre) return false;
      if (!q) return true;
      return (
        t.title?.toLowerCase().includes(q) ||
        t.artist_handle?.toLowerCase().includes(q) ||
        t.album_name?.toLowerCase().includes(q) ||
        t.genre?.toLowerCase().includes(q)
      );
    });
  }, [tracks, searchQuery, selectedGenre]);

  const top10Singles = useMemo(() => {
    return [...filteredTracks]
      .sort((a, b) => {
        const countDiff = (playCounts[String(b.id)] || 0) - (playCounts[String(a.id)] || 0);
        if (countDiff !== 0) return countDiff;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })
      .slice(0, 10);
  }, [filteredTracks, playCounts]);

  const newReleases = useMemo(() => {
    return [...filteredTracks]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 8);
  }, [filteredTracks]);

  const top5Albums = useMemo<AlbumSummary[]>(() => {
    const grouped: Record<string, Track[]> = {};
    tracks.forEach((t) => {
      if (!t.album_name) return;
      t.album_name
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((albName) => {
          if (!grouped[albName]) grouped[albName] = [];
          grouped[albName].push(t);
        });
    });

    return Object.entries(grouped)
      .map(([name, albTracks]) => {
        const totalPlays = albTracks.reduce((sum, tr) => sum + (playCounts[String(tr.id)] || 0), 0);
        const firstArt = albTracks.find((tr) => tr.artwork_url)?.artwork_url || FALLBACK_ART;
        const coverUrl = albumArtMap[name] || albumArtMap[name.toLowerCase()] || firstArt;
        const handle = albTracks[0]?.artist_handle || '2g-imprint';
        const price = Number(albTracks[0]?.album_price ?? 7.99);
        return {
          name,
          handle,
          price,
          coverUrl,
          trackCount: albTracks.length,
          trackIds: albTracks.map((tr) => tr.id),
          totalPlays,
        };
      })
      .sort((a, b) => b.totalPlays - a.totalPlays || b.trackCount - a.trackCount)
      .slice(0, 5);
  }, [tracks, albumArtMap, playCounts]);

  const spotlightLabels = useMemo(() => {
    return profiles.filter((p) => p.tier === 'label');
  }, [profiles]);

  const renderTrackCard = (track: Track, rank?: number) => {
    const active = currentTrack && String(currentTrack.id) === String(track.id);
    const playingThis = Boolean(active && isPlaying);
    const handle = (track.artist_handle || '').trim();
    const dspLinks = [
      { label: 'Spotify', url: track.spotify_url },
      { label: 'Apple Music', url: track.apple_music_url },
      { label: 'Tidal', url: track.tidal_url },
      { label: 'YouTube', url: track.youtube_url },
      { label: 'Pandora', url: track.pandora_url },
    ].filter((item) => Boolean(item.url?.trim()));

    return (
      <div
        key={track.id}
        className={`bg-neutral-900 border rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all ${
          active ? 'border-[#ff8c00]' : 'border-neutral-800 hover:border-neutral-700'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {typeof rank === 'number' && (
            <span className="text-sm font-black text-[#ff8c00] w-5 text-center shrink-0">
              #{rank + 1}
            </span>
          )}
          <img
            src={track.artwork_url || FALLBACK_ART}
            alt={track.title}
            className="w-14 h-14 rounded-xl object-cover border border-neutral-800 shrink-0"
          />
          <div className="min-w-0 flex-1 text-left">
            <h4 className="text-sm font-bold text-white truncate">{track.title}</h4>
            <div className="flex items-center gap-2 text-xs text-neutral-400 truncate">
              {handle && (
                <Link
                  href={`/artist/${encodeURIComponent(handle)}?view=player`}
                  className="text-[#ff8c00] hover:underline font-semibold truncate"
                >
                  @{handle}
                </Link>
              )}
              {track.genre && <span>• {track.genre}</span>}
              <span>• {playCounts[String(track.id)] || 0} plays</span>
            </div>
          </div>
        </div>

        {dspLinks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {dspLinks.map((dsp) => (
              <a
                key={dsp.label}
                href={dsp.url!}
                target="_blank"
                rel="noreferrer"
                onClick={() => logEvent('outbound_stream', track, { platform: dsp.label })}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-[#ff8c00] text-neutral-200 transition-all"
              >
                {dsp.label}
              </a>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800/80">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTogglePlay(track)}
              className="bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold px-3.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all"
            >
              {playingThis ? 'Pause' : 'Play'}
            </button>
            {handle && (
              <Link
                href={`/artist/${encodeURIComponent(handle)}?view=player`}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold px-3 py-1.5 rounded-xl text-xs border border-neutral-700 transition-all"
              >
                Player
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleBuySingle(track)}
            className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold px-3.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all"
          >
            Buy ${Number(track.price || 0.99).toFixed(2)}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-white px-4 py-8 pb-32">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Hero & Filter Controls */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 text-left">
              <span className="text-[10px] bg-[#ff8c00]/15 text-[#ff8c00] border border-[#ff8c00]/40 px-3 py-1 rounded-full font-extrabold uppercase tracking-wider">
                Music Market Discovery & Commerce
              </span>
              <h1 className="text-2xl md:text-3xl font-black text-white pt-1">
                Explore Artists, Labels, Top Singles & Albums
              </h1>
              <p className="text-xs md:text-sm text-neutral-400">
                Stream previews, jump into artist & label storefronts, stream on DSPs, or buy direct masters.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs border border-neutral-700 self-start md:self-auto"
            >
              Creator Workspace
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tracks, artists (@handle), albums, or genres..."
              className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl px-4 py-2.5 text-sm text-white outline-none"
            />
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {genres.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGenre(g)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                    selectedGenre === g
                      ? 'bg-[#ff8c00] text-neutral-950'
                      : 'bg-neutral-950 text-neutral-300 border border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-sm text-neutral-400">Loading discovery feed...</div>
        ) : (
          <>
            {/* Top 10 Most Played Singles */}
            <section className="space-y-4 text-left">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">Top 10 Most Played Singles</h2>
                <span className="text-xs text-neutral-400">Live play telemetry</span>
              </div>
              {top10Singles.length === 0 ? (
                <p className="text-xs text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  No matching singles found.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {top10Singles.map((track, idx) => renderTrackCard(track, idx))}
                </div>
              )}
            </section>

            {/* New Releases */}
            <section className="space-y-4 text-left">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">New Releases</h2>
                <span className="text-xs text-neutral-400">Fresh drops across the network</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {newReleases.map((track) => renderTrackCard(track))}
              </div>
            </section>

            {/* Top 5 Albums */}
            <section className="space-y-4 text-left">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">Top 5 Albums</h2>
                <span className="text-xs text-neutral-400">Full project bundles</span>
              </div>
              {top5Albums.length === 0 ? (
                <p className="text-xs text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  No albums published yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {top5Albums.map((alb) => (
                    <div
                      key={alb.name}
                      className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2.5">
                        <img
                          src={alb.coverUrl || FALLBACK_ART}
                          alt={alb.name}
                          className="w-full aspect-square rounded-xl object-cover border border-neutral-800"
                        />
                        <div>
                          <h3 className="text-sm font-extrabold text-white truncate">{alb.name}</h3>
                          <Link
                            href={`/artist/${encodeURIComponent(alb.handle)}`}
                            className="text-xs text-[#ff8c00] hover:underline font-semibold block truncate"
                          >
                            @{alb.handle}
                          </Link>
                          <p className="text-[11px] text-neutral-400">{alb.trackCount} tracks</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleBuyAlbum(alb)}
                        className="w-full bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-2 rounded-xl text-xs cursor-pointer transition-all"
                      >
                        Buy Album ${alb.price.toFixed(2)}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Label Spotlight */}
            <section className="space-y-4 text-left">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">Label Spotlight</h2>
                <span className="text-xs text-neutral-400">Executive storefronts</span>
              </div>
              {spotlightLabels.length === 0 ? (
                <p className="text-xs text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  Label storefronts will appear here once label profiles are active.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {spotlightLabels.map((lbl) => {
                    const slug = (lbl.handle || lbl.artist_handle || '').trim();
                    const title = lbl.label_name || lbl.display_name || lbl.name || slug || 'Label';
                    const logo = resolveAssetUrl(lbl.logo_url || lbl.avatar_url, null, 'v2-cover-art') || FALLBACK_ART;
                    return (
                      <div
                        key={lbl.id}
                        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={logo}
                            alt={title}
                            className="w-14 h-14 rounded-xl object-cover border border-neutral-800 shrink-0"
                          />
                          <div className="min-w-0">
                            <h3 className="text-sm font-extrabold text-white truncate">{title}</h3>
                            {slug && <p className="text-xs text-[#ff8c00] truncate">@{slug}</p>}
                          </div>
                        </div>
                        {slug && (
                          <Link
                            href={`/artist/${encodeURIComponent(slug)}`}
                            className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs border border-neutral-700 shrink-0"
                          >
                            Storefront
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Persistent Bottom Mini-Player */}
      {currentTrack && (
        <div className="fixed bottom-3 inset-x-3 z-40 max-w-4xl mx-auto bg-neutral-950/95 backdrop-blur-md border border-neutral-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={currentTrack.artwork_url || FALLBACK_ART}
              alt={currentTrack.title}
              className="w-11 h-11 rounded-xl object-cover border border-neutral-800 shrink-0"
            />
            <div className="min-w-0 text-left">
              <p className="text-xs sm:text-sm font-bold text-white truncate">{currentTrack.title}</p>
              <p className="text-[11px] text-[#ff8c00] truncate">
                {currentTrack.artist_handle ? `@${currentTrack.artist_handle}` : 'Music Market'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleTogglePlay(currentTrack)}
              className="bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold px-4 py-2 rounded-xl text-xs cursor-pointer"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => handleBuySingle(currentTrack)}
              className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold px-3.5 py-2 rounded-xl text-xs cursor-pointer"
            >
              ${Number(currentTrack.price || 0.99).toFixed(2)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
