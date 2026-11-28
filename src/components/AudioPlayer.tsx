'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

export type DemoFeatureKey =
  | 'overview'
  | 'search'
  | 'fan_signup'
  | 'stream_links'
  | 'buy_checkout'
  | 'albums_view'
  | 'share_track'
  | 'playback_controls';

interface AudioPlayerProps {
  artistHandle?: string;
  initialTracks?: any[];
  tier?: string;
  demoMode?: boolean;
  demoIntercept?: boolean;
  onDemoAction?: (feature: DemoFeatureKey) => void;
  demoFooterContent?: React.ReactNode;
  showLabelPromoStrip?: boolean;
}

const FALLBACK_COVER_ART =
  'https://27593217-482041110881488807.preview.editmysite.com/uploads/2/7/5/9/27593217/box-logo_orig.jpg';

const platformColors: Record<string, string> = {
  'Apple Music': '#fa233b',
  'Spotify': '#1db954',
  'Tidal': '#00ffff',
  'YouTube': '#ff0000',
  'Pandora': '#0095ff',
};

export default function AudioPlayer({
  artistHandle,
  initialTracks,
  tier = 'free',
  demoMode = false,
  demoIntercept = false,
  onDemoAction,
  demoFooterContent,
  showLabelPromoStrip = false,
}: AudioPlayerProps) {
  const triggerDemoFeature = (key: DemoFeatureKey): boolean => {
    if (demoMode && onDemoAction) {
      onDemoAction(key);
    }
    return Boolean(demoIntercept);
  };
  const audioRef = useRef<HTMLAudioElement>(null);

  const isDevSuiteEnabled =
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_SUITE === 'true';

  const [currentTier, setCurrentTier] = useState<string>(tier);

  useEffect(() => {
    const checkDevTier = () => {
      const devTier =
        isDevSuiteEnabled && typeof window !== 'undefined'
          ? localStorage.getItem('mm_dev_tier')
          : null;
      if (isDevSuiteEnabled && devTier && devTier !== 'logged_out') {
        setCurrentTier(devTier);
      } else {
        setCurrentTier(tier);
      }
    };

    checkDevTier();

    window.addEventListener('mm_tier_changed', checkDevTier);
    return () => window.removeEventListener('mm_tier_changed', checkDevTier);
  }, [tier]);

  const [masterPlaylist, setMasterPlaylist] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [streamModalOpen, setStreamModalOpen] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [isRepeated, setIsRepeated] = useState(false);
  const [subscribeBoxOpen, setSubscribeBoxOpen] = useState(false);
  const [subscriberEmail, setSubscriberEmail] = useState('');
  const [submittingFan, setSubmittingFan] = useState(false);

  // Smart Shuffle Pool State
  const [shufflePool, setShufflePool] = useState<number[]>([]);

  // Rotating Stream Button State
  const [streamDisplayHtml, setStreamDisplayHtml] = useState<{ text: string; color: string }>({
    text: 'STREAM NOW',
    color: '#ffffff',
  });

  // Album / Project View State
  const [viewMode, setViewMode] = useState<'tracks' | 'albums'>('tracks');
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);

  // Buy Light Box Modal State
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [trackToBuy, setTrackToBuy] = useState<any>(null);

  // Label Multi-Artist Filter State
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('all');

  const currentTrack = activePlaylist[currentIndex] || null;
  const isPlayingRef = useRef<boolean>(false);
  const currentTrackRef = useRef<any>(null);
  const currentIndexRef = useRef<number>(0);
  const activePlaylistRef = useRef<any[]>([]);
  const isShuffledRef = useRef<boolean>(false);
  const isRepeatedRef = useRef<boolean>(false);
  const shufflePoolRef = useRef<number[]>([]);
  const playlistSignatureRef = useRef<string>('');
  const errorRetryCountRef = useRef<number>(0);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoggedPlayTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
    currentIndexRef.current = currentIndex;
  }, [currentTrack, currentIndex]);

  useEffect(() => {
    activePlaylistRef.current = activePlaylist;
  }, [activePlaylist]);

  useEffect(() => {
    isShuffledRef.current = isShuffled;
  }, [isShuffled]);

  useEffect(() => {
    isRepeatedRef.current = isRepeated;
  }, [isRepeated]);

  useEffect(() => {
    shufflePoolRef.current = shufflePool;
  }, [shufflePool]);

  useEffect(() => {
    return () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (initialTracks && initialTracks.length > 0) {
      const nextSignature = `${artistHandle || ''}::${initialTracks
        .map((t) => `${t.id}:${t.track_order ?? ''}:${t.audio_file_path ?? ''}`)
        .join('|')}`;
      if (nextSignature !== playlistSignatureRef.current) {
        playlistSignatureRef.current = nextSignature;
        processTracks(initialTracks);
      }
    } else {
      initPlayer();
    }
  }, [artistHandle, initialTracks]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && audioRef.current) {
        if (isPlayingRef.current && audioRef.current.paused && currentTrackRef.current?.audio_file_path) {
          if (audioRef.current.readyState === 0) {
            audioRef.current.load();
          }
          safePlay(false);
        } else if (!isPlayingRef.current && !audioRef.current.paused) {
          setIsPlaying(true);
        }
      }
    };

    const handleOnline = () => {
      if (isPlayingRef.current && audioRef.current && currentTrackRef.current?.audio_file_path) {
        const savedTime = audioRef.current.currentTime;
        audioRef.current.load();
        if (savedTime > 0) {
          audioRef.current.currentTime = savedTime;
        }
        safePlay(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (!currentTrack) {
      setStreamDisplayHtml({ text: 'STREAM NOW', color: '#ffffff' });
      return;
    }

    const availablePlatforms: { name: string; color: string }[] = [];
    if (currentTrack.apple_music_url?.trim())
      availablePlatforms.push({ name: 'Apple Music', color: platformColors['Apple Music'] });
    if (currentTrack.spotify_url?.trim())
      availablePlatforms.push({ name: 'Spotify', color: platformColors['Spotify'] });
    if (currentTrack.tidal_url?.trim())
      availablePlatforms.push({ name: 'Tidal', color: platformColors['Tidal'] });
    if (currentTrack.youtube_url?.trim())
      availablePlatforms.push({ name: 'YouTube', color: platformColors['YouTube'] });
    if (currentTrack.pandora_url?.trim())
      availablePlatforms.push({ name: 'Pandora', color: platformColors['Pandora'] });

    if (availablePlatforms.length === 0) {
      setStreamDisplayHtml({ text: 'STREAM NOW', color: '#ffffff' });
      return;
    }

    const slides = [
      { text: 'STREAM NOW', color: '#ffffff' },
      ...availablePlatforms.map((p) => ({ text: p.name, color: p.color })),
    ];
    let slideIndex = 0;
    setStreamDisplayHtml(slides[0]);

    const interval = setInterval(() => {
      slideIndex = (slideIndex + 1) % slides.length;
      setStreamDisplayHtml(slides[slideIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, [currentTrack?.id]);

  // Sync iOS Lock Screen / Control Center metadata & Next/Prev hardware controls
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const track = currentTrack;
    const handleLabel = artistHandle || track?.artist_handle || 'Music Market';
    const artworkUrl = track?.artwork_url || FALLBACK_COVER_ART;

    try {
      if (!track) {
        navigator.mediaSession.metadata = null;
        return;
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Untitled Track',
        artist: `@${handleLabel}`,
        album: track.album_name || 'Music Market',
        artwork: [
          { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
      });
    } catch {
      // Ignore MediaMetadata errors on unsupported browsers
    }
  }, [currentTrack, artistHandle]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const setHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Unsupported action on current browser/OS
      }
    };

    setHandler('play', () => {
      if (!isPlayingRef.current) {
        safePlay(true);
      }
    });

    setHandler('pause', () => {
      if (audioRef.current && !audioRef.current.paused) {
        clearStallTimer();
        audioRef.current.pause();
        setIsPlaying(false);
      }
    });

    setHandler('nexttrack', () => {
      nextTrack(true);
    });

    setHandler('previoustrack', () => {
      prevTrack(true);
    });

    setHandler('seekto', (details) => {
      if (
        audioRef.current &&
        typeof details.seekTime === 'number' &&
        !isNaN(details.seekTime)
      ) {
        audioRef.current.currentTime = details.seekTime;
        setCurrentTime(details.seekTime);
      }
    });

    return () => {
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('nexttrack', null);
      setHandler('previoustrack', null);
      setHandler('seekto', null);
    };
  }, []);

  useEffect(() => {
    if (isShuffled) {
      resetShufflePool(currentIndex, activePlaylist.length);
    }
  }, [isShuffled, activePlaylist]);

  function clearStallTimer() {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }

  function armStallWatchdog() {
    clearStallTimer();
    stallTimerRef.current = setTimeout(() => {
      const el = audioRef.current;
      if (!el || !isPlayingRef.current || !currentTrackRef.current?.audio_file_path) return;
      if (el.paused && document.visibilityState === 'visible') {
        if (el.readyState === 0) {
          el.load();
        }
        el.play().catch(() => {});
      }
    }, 3500);
  }

  function buildShuffledPool(currentIdx: number, totalTracks: number): number[] {
    const pool: number[] = [];
    for (let i = 0; i < totalTracks; i++) {
      if (i !== currentIdx) {
        pool.push(i);
      }
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }

  function resetShufflePool(currentIdx: number, totalTracks: number) {
    const pool = buildShuffledPool(currentIdx, totalTracks);
    shufflePoolRef.current = pool;
    setShufflePool(pool);
  }

  function safePlay(ensureSourceLoaded = false) {
    const el = audioRef.current;
    const track = currentTrackRef.current;
    if (!el || !track?.audio_file_path) return;

    if (ensureSourceLoaded && (!el.currentSrc || el.readyState === 0)) {
      el.src = track.audio_file_path;
      el.load();
    }

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          errorRetryCountRef.current = 0;
          clearStallTimer();
          setIsPlaying(true);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          console.error('Audio playback error:', err);
          if (document.visibilityState === 'hidden') {
            setIsPlaying(true);
          } else {
            setIsPlaying(false);
          }
        });
    }
  }

  function processTracks(data: any[]) {
    const formattedTracks = data.map((track) => {
      let audioUrl = track.audio_file_path;
      if (audioUrl && !audioUrl.startsWith('http')) {
        audioUrl = _supabase.storage.from('v2-audio-vault').getPublicUrl(audioUrl).data.publicUrl;
      }

      let artUrl = track.artwork_url;
      if (track.artwork_file_path && !track.artwork_file_path.startsWith('http')) {
        artUrl = _supabase.storage
          .from('v2-cover-art')
          .getPublicUrl(track.artwork_file_path).data.publicUrl;
      }

      return {
        ...track,
        audio_file_path: audioUrl,
        artwork_url: artUrl,
      };
    });

    let filteredData = formattedTracks.filter((track) => !track.deleted_at);

    if (artistHandle && (!initialTracks || initialTracks.length === 0) && currentTier !== 'label') {
      const cleanSlug = artistHandle.toLowerCase().trim();
      filteredData = formattedTracks.filter((track) => {
        const textHandle = track.artist_handle ? track.artist_handle.toLowerCase().trim() : '';
        return textHandle === cleanSlug;
      });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const targetTrackParam = urlParams.get('track');

    if (targetTrackParam) {
      const trackIndex = filteredData.findIndex((t) => String(t.id) === String(targetTrackParam));
      if (trackIndex !== -1) {
        const sharedTrack = filteredData.splice(trackIndex, 1)[0];
        filteredData.unshift(sharedTrack);
      }
    }

    setMasterPlaylist(filteredData);
    setActivePlaylist(filteredData);
    if (filteredData.length > 0) {
      loadTrack(filteredData[0], 0, false);
      if (isShuffled) resetShufflePool(0, filteredData.length);
    } else {
      setCurrentIndex(0);
      setCurrentTime(0);
      setDuration(0);
    }
  }

  async function initPlayer() {
    let query = _supabase
      .from('tracks_pro')
      .select('*')
      .is('deleted_at', null)
      .order('track_order', { ascending: true, nullsFirst: false });

    if (artistHandle) {
      query = query.ilike('artist_handle', artistHandle.trim());
    }

    const { data, error } = await query;

    if (!error && data) {
      const nextSignature = `${artistHandle || ''}::${data
        .map((t) => `${t.id}:${t.track_order ?? ''}:${t.audio_file_path ?? ''}`)
        .join('|')}`;
      playlistSignatureRef.current = nextSignature;
      processTracks(data);
    }
  }

  function loadTrack(track: any, index: number, shouldPlay = false) {
    if (!track) return;
    clearStallTimer();
    errorRetryCountRef.current = 0;
    lastLoggedPlayTrackIdRef.current = null;
    currentTrackRef.current = track;
    currentIndexRef.current = index;
    setCurrentIndex(index);
    setCurrentTime(0);
    setDuration(0);
    setSubscribeBoxOpen(false);

    if (audioRef.current && track?.audio_file_path) {
      const el = audioRef.current;
      el.src = track.audio_file_path;
      el.load();
      if (shouldPlay) {
        setIsPlaying(true);
        const attemptPlay = () => {
          el.play().catch((err) => {
            if (err?.name === 'AbortError') return;
            if (document.visibilityState === 'visible') {
              setIsPlaying(false);
            }
          });
        };
        attemptPlay();
        // Backup trigger once enough data is buffered if backgrounded on iOS
        const onCanPlay = () => {
          el.removeEventListener('canplay', onCanPlay);
          if (isPlayingRef.current && el.paused) {
            attemptPlay();
          }
        };
        el.addEventListener('canplay', onCanPlay, { once: true });
      } else {
        setIsPlaying(false);
      }
    }
  }

  function togglePlay() {
    if (!audioRef.current || !currentTrackRef.current?.audio_file_path) return;
    if (isPlayingRef.current) {
      clearStallTimer();
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      safePlay(true);
    }
  }

  function handleTimeUpdate() {
    if (audioRef.current) {
      clearStallTimer();
      setCurrentTime(audioRef.current.currentTime);
      if (!isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  }

  function nextTrack(shouldPlay?: boolean) {
    const playlist = activePlaylistRef.current;
    if (playlist.length === 0) return;

    const idxNow = currentIndexRef.current;
    const playAfter = typeof shouldPlay === 'boolean' ? shouldPlay : isPlayingRef.current;
    let nextIdx: number;

    if (isShuffledRef.current) {
      let currentPool = [...shufflePoolRef.current];
      if (currentPool.length === 0) {
        currentPool = buildShuffledPool(idxNow, playlist.length);
      }
      const popped = currentPool.pop();
      nextIdx = popped !== undefined ? popped : (idxNow + 1) % playlist.length;
      shufflePoolRef.current = currentPool;
      setShufflePool(currentPool);
    } else {
      nextIdx = (idxNow + 1) % playlist.length;
    }

    loadTrack(playlist[nextIdx], nextIdx, playAfter);
  }

  function prevTrack(shouldPlay?: boolean) {
    const playlist = activePlaylistRef.current;
    if (playlist.length === 0) return;

    const idxNow = currentIndexRef.current;
    const playAfter = typeof shouldPlay === 'boolean' ? shouldPlay : isPlayingRef.current;
    const prevIdx = (idxNow - 1 + playlist.length) % playlist.length;
    loadTrack(playlist[prevIdx], prevIdx, playAfter);
  }

  const lastBackClickRef = useRef<number>(0);

  function handlePreviousClick() {
    const now = Date.now();
    const timeSinceLastClick = now - lastBackClickRef.current;
    const doubleClickThreshold = 350;

    if (lastBackClickRef.current && timeSinceLastClick < doubleClickThreshold) {
      prevTrack();
      lastBackClickRef.current = 0;
    } else {
      if (audioRef.current && audioRef.current.currentTime > 3) {
        audioRef.current.currentTime = 0;
        if (isPlayingRef.current) safePlay(false);
      } else {
        prevTrack();
      }
      lastBackClickRef.current = now;
    }
  }

  function handleTrackEnded() {
    clearStallTimer();
    if (isRepeatedRef.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      safePlay(false);
    } else {
      const playlist = activePlaylistRef.current;
      if (playlist.length > 0) {
        setIsPlaying(true);
        nextTrack(true);
      } else {
        setIsPlaying(false);
      }
    }
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

  async function logAnalyticsEvent(
    eventType: 'play' | 'outbound_stream',
    track: any,
    extraMetadata: Record<string, any> = {}
  ) {
    if (!track?.id) return;
    const resolvedHandle = (track.artist_handle || artistHandle || '').trim().toLowerCase();
    if (!resolvedHandle) return;

    try {
      await _supabase.from('analytics_events_v2').insert({
        event_type: eventType,
        track_id: String(track.id),
        artist_handle: resolvedHandle,
        visitor_id: getVisitorId(),
        metadata: {
          track_title: track.title || null,
          album_name: track.album_name || null,
          ...extraMetadata,
        },
      });
    } catch (err) {
      console.error(`Failed to log ${eventType} analytics event:`, err);
    }
  }

  function handleAudioError() {
    const el = audioRef.current;
    const track = currentTrackRef.current;
    if (!el || !track?.audio_file_path) return;

    if (errorRetryCountRef.current < 2 && isPlayingRef.current) {
      errorRetryCountRef.current += 1;
      const resumeTime = el.currentTime || 0;
      setTimeout(() => {
        if (!audioRef.current || !currentTrackRef.current?.audio_file_path || !isPlayingRef.current) {
          return;
        }
        audioRef.current.src = currentTrackRef.current.audio_file_path;
        audioRef.current.load();
        if (resumeTime > 0) {
          audioRef.current.currentTime = resumeTime;
        }
        audioRef.current.play().catch(() => {});
      }, 600);
      return;
    }

    clearStallTimer();
    if (document.visibilityState === 'visible' && isPlayingRef.current) {
      setIsPlaying(false);
    }
  }

  function formatTime(secs: number) {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  async function handleFanSubscribe(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!subscriberEmail.trim() || submittingFan) return;

    setSubmittingFan(true);
    try {
      const activeHandle = (
        currentTier === 'label'
          ? currentTrack?.artist_handle || artistHandle || ''
          : artistHandle || currentTrack?.artist_handle || ''
      )
        .trim()
        .toLowerCase();
      if (!activeHandle) {
        alert('Unable to determine which artist store this fan signup belongs to.');
        setSubmittingFan(false);
        return;
      }

      const res = await fetch('/api/fans/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: subscriberEmail.trim(),
          artistHandle: activeHandle,
          sourceGenre: currentTrack?.genre || 'Untagged',
          sourceTrackId: currentTrack?.id ? String(currentTrack.id) : null,
          sourceTrackTitle: currentTrack?.title || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Could not subscribe right now.');
      } else {
        alert(`You're locked in with @${activeHandle}!`);
        setSubscriberEmail('');
        setSubscribeBoxOpen(false);
      }
    } catch (err) {
      console.error('Fan subscribe error:', err);
      alert('Network error. Please try again.');
    } finally {
      setSubmittingFan(false);
    }
  }

  function handleShareTrack(track: any, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (triggerDemoFeature('share_track')) return;
    const basePath = artistHandle ? window.location.pathname : `/artist/workspace`;
    const shareUrl = `${window.location.origin}${basePath}?track=${track.id}`;
    navigator.clipboard.writeText(shareUrl);
    alert(`Copied share link for "${track.title}"!`);
  }

  function handleBuyClick(track: any) {
    if (!track || !track.id) return;
    if (triggerDemoFeature('buy_checkout')) return;
    setTrackToBuy(track);
    setSubscribeBoxOpen(false);

       const checkoutHandle =
      currentTier === 'label'
        ? track.artist_handle || artistHandle
        : artistHandle || track.artist_handle;

    if (track.album_name) {
      setBuyModalOpen(true);
    } else {
      executeCheckout({
        itemType: 'single',
        trackId: String(track.id),
        artistHandle: checkoutHandle,
        price: track.price,
        title: track.title,
      });
    }
  }

  async function executeCheckout(payload: {
    itemType: 'single' | 'album';
    trackId?: string;
    albumName?: string;
    artistHandle?: string;
    price: number | string;
    title?: string;
  }) {
    try {
      const response = await fetch('/api/checkout/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [payload] }),
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
      if (session.url) window.location.href = session.url;
      else alert(session.error || 'Could not initiate checkout.');
    } catch (err) {
      console.error('Stripe checkout error:', err);
      alert('Network error initiating checkout.');
    }
  }

  const trackIncludesAlbum = (track: any, albumName: string) =>
    Boolean(track.album_name) &&
    String(track.album_name)
      .split(',')
      .map((s: string) => s.trim())
      .includes(albumName);

  const rosterArtists = Array.from(
    new Set(
      masterPlaylist
        .map((t) => (t.artist_handle ? String(t.artist_handle).trim() : ''))
        .filter(Boolean)
    )
  );

  const isLabelRosterMode = currentTier === 'label' && rosterArtists.length > 1;

  const albumSourceTracks =
    isLabelRosterMode && selectedArtistFilter !== 'all'
      ? masterPlaylist.filter(
          (t) =>
            String(t.artist_handle || '').trim().toLowerCase() ===
            selectedArtistFilter.toLowerCase()
        )
      : masterPlaylist;

  const uniqueAlbums = Array.from(
    new Set(
      albumSourceTracks.flatMap((t) =>
        t.album_name
          ? String(t.album_name)
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : []
      )
    )
  ).sort((a, b) => {
    const indexA = albumSourceTracks.find((t) => trackIncludesAlbum(t, a))?.album_index ?? 9999;
    const indexB = albumSourceTracks.find((t) => trackIncludesAlbum(t, b))?.album_index ?? 9999;
    return indexA - indexB;
  });

  function handleSelectRosterArtist(handleKey: string) {
    setSelectedArtistFilter(handleKey);
    setSelectedAlbum(null);
    setViewMode('tracks');

    if (handleKey === 'all') {
      setActivePlaylist(masterPlaylist);
      if (masterPlaylist.length > 0) loadTrack(masterPlaylist[0], 0, false);
      return;
    }

    const filtered = masterPlaylist.filter(
      (t) => String(t.artist_handle || '').trim().toLowerCase() === handleKey.toLowerCase()
    );
    setActivePlaylist(filtered);
    if (filtered.length > 0) loadTrack(filtered[0], 0, false);
  }

  return (
    <div className="player-card bg-[#121212] text-white w-full max-w-[480px] h-[100dvh] p-4 flex flex-col justify-between overflow-hidden box-border mx-auto relative touch-manipulation">
      <div className="player-header text-center text-[11px] tracking-[2px] text-[#666] uppercase pt-[2px]">
        {artistHandle || currentTrack?.artist_handle
          ? String(artistHandle || currentTrack?.artist_handle)
              .replace(/[-_]+/g, ' ')
              .trim()
              .toUpperCase()
          : 'Music Market'}
      </div>

      {/* Fixed-Height Search Bar Wrapper to prevent vertical shifting */}
      <div className={`search-wrapper relative w-full my-[6px] h-[36px] flex-shrink-0 ${searchActive ? 'active' : ''}`}>
        {!searchActive ? (
          <div
            className="search-collapsed-btn absolute left-0 top-0 w-[36px] h-[36px] bg-[#1a1a1a] border border-[#333] rounded-[8px] flex items-center justify-center cursor-pointer hover:border-[#ff8c00]"
            onClick={() => {
              if (triggerDemoFeature('search')) return;
              setSearchActive(true);
              setSubscribeBoxOpen(false);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff8c00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        ) : (
          <div className="search-input-container absolute left-0 top-0 w-full z-20">
            <input
              type="text"
              className="w-full h-[36px] px-[14px] bg-black border border-[#ff8c00] rounded-[8px] text-white text-base sm:text-[13px] outline-none shadow-[0_0_0_2px_rgba(255,140,0,0.2)] touch-manipulation"
              placeholder="Search catalog by title, artist, or genre..."
              value={searchQuery}
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                setSearchQuery(q);
                setSearchResults(
                  masterPlaylist.filter(
                    (t) =>
                      t.title.toLowerCase().includes(q) ||
                      t.artist_handle?.toLowerCase().includes(q) ||
                      t.genre?.toLowerCase().includes(q)
                  )
                );
              }}
              autoFocus
              onBlur={() => {
                setTimeout(() => setSearchActive(false), 200);
              }}
            />
          </div>
        )}

        {searchActive && searchResults.length > 0 && (
          <div className="search-results-dropdown absolute top-[calc(100%+4px)] left-0 w-full bg-[#161616] border border-[#2e2e2e] rounded-[8px] max-h-[240px] overflow-y-auto z-50 shadow-2xl">
            {searchResults.map((track) => (
              <div
                key={track.id}
                className="search-result-item flex items-center gap-[10px] p-[8px_12px] border-b border-[#1f1f1f] cursor-pointer hover:bg-[#262626]"
                onClick={() => {
                  loadTrack(
                    track,
                    masterPlaylist.findIndex((t) => t.id === track.id),
                    true
                  );
                  setSearchActive(false);
                }}
              >
                <img
                  src={track.artwork_url || FALLBACK_COVER_ART}
                  className="w-[32px] h-[32px] object-cover rounded-[4px] bg-[#222]"
                  alt=""
                />

                <div className="flex flex-col overflow-hidden flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-white truncate">{track.title}</span>
                    {track.genre && (
                      <span className="text-[9px] bg-[#ff8c00]/15 text-[#ff8c00] font-bold px-1.5 py-0.2 rounded border border-[#ff8c00]/30">
                        {track.genre}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#ff8c00] truncate">
                    @
                    {currentTier === 'label'
                      ? track.artist_handle || artistHandle
                      : artistHandle || track.artist_handle}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artwork */}
      <div
        className={`artwork-container mx-auto rounded-[12px] overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex items-center justify-center bg-[#1a1a1a] flex-shrink-0 ${
          demoMode ? 'w-[108px] h-[108px] sm:w-[126px] sm:h-[126px]' : 'w-[150px] h-[150px]'
        }`}
      >
        <img
          src={currentTrack?.artwork_url || FALLBACK_COVER_ART}
          alt="Artwork"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Track Info & Genre Tag */}
      <div className="track-info text-center mb-[4px] flex-shrink-0">
        <h3 className="text-[15px] font-bold text-white truncate m-[0_0_2px_0]">
          {currentTrack?.title || 'No tracks uploaded yet'}
        </h3>
        <div className="flex items-center justify-center gap-2 m-0">
          <p className="text-[11px] text-[#ff8c00] font-medium m-0">
            {(() => {
              const displayedHandle =
                currentTier === 'label'
                  ? currentTrack?.artist_handle || artistHandle
                  : artistHandle || currentTrack?.artist_handle;
              return displayedHandle ? `@${displayedHandle}` : 'Music Market';
            })()}
          </p>

          {currentTrack?.genre && (
            <span className="text-[10px] bg-[#ff8c00]/15 text-[#ff8c00] font-bold px-2 py-0.2 rounded-md border border-[#ff8c00]/30">
              {currentTrack.genre}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-container w-full mb-[6px] flex-shrink-0">
        <input
          type="range"
          className="progress-bar w-full h-[5px] bg-[#333] rounded-[3px] outline-none cursor-pointer accent-[#ff8c00]"
          value={currentTime}
          min={0}
          max={duration || 100}
          step={0.1}
          onChange={handleSeek}
        />
        <div className="time-info flex justify-between text-[11px] text-[#888] mt-[3px]">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Action Row */}
      <div className="subscribe-container flex-shrink-0">
        {!subscribeBoxOpen ? (
          <div className="action-section flex gap-[10px] mb-[6px]">
            <button
              className="main-sub-btn bg-[#ff8c00] text-black font-bold p-[8px] rounded-[10px] flex-1 text-[12px] hover:bg-[#e07b00]"
              onClick={() => {
                if (triggerDemoFeature('fan_signup')) return;
                setSubscribeBoxOpen(true);
              }}
            >
              BECOME A FAN
            </button>

            {currentTier !== 'free' &&
              currentTrack?.id &&
              (currentTrack.apple_music_url ||
                currentTrack.spotify_url ||
                currentTrack.tidal_url ||
                currentTrack.youtube_url ||
                currentTrack.pandora_url) && (
                <button
                  className="stream-trigger-btn bg-[#2a2a2a] text-white border border-[#444] p-[8px_12px] font-bold rounded-[10px] flex-1 text-[12px] hover:border-[#ff8c00]"
                  onClick={() => {
                    if (triggerDemoFeature('stream_links')) return;
                    setStreamModalOpen(true);
                    setSubscribeBoxOpen(false);
                  }}
                >
                  <span style={{ color: streamDisplayHtml.color, transition: 'color 0.3s ease' }}>
                    {streamDisplayHtml.text}
                  </span>
                </button>
              )}

            {Number(currentTrack?.price) > 0 && (
              <button
                className="buy-trigger-btn bg-[#1b3a2b] text-[#2ecc71] border border-[#27ae60] p-[8px_12px] font-bold rounded-[10px] flex-1 text-[12px] flex items-center justify-center gap-[6px] cursor-pointer hover:border-[#2ecc71]"
                onClick={() => handleBuyClick(currentTrack)}
              >
                <span>Buy:</span> <span>${currentTrack.price}</span>
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleFanSubscribe} className="sub-form flex gap-[10px] mb-[6px]">
            <input
              type="email"
              required
              className="flex-1 p-[8px] rounded-[10px] border border-[#444] bg-[#1a1a1a] text-white text-base sm:text-[13px] outline-none focus:border-[#ff8c00]"
              placeholder="Enter your email..."
              value={subscriberEmail}
              onChange={(e) => setSubscriberEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={submittingFan}
              className="bg-[#ff8c00] text-black border-none p-[0_14px] font-bold rounded-[10px] text-[12px] cursor-pointer disabled:opacity-50"
            >
              {submittingFan ? '...' : 'Join'}
            </button>
            <button
              type="button"
              className="bg-[#2a2a2a] text-[#aaa] border border-[#444] p-[0_10px] font-bold rounded-[10px] text-[12px] cursor-pointer hover:text-white"
              onClick={() => setSubscribeBoxOpen(false)}
              title="Cancel"
            >
              ✕
            </button>
          </form>
        )}
      </div>

      {/* Playlist / Albums Navigation Drawer */}
      <div className="inline-playlist-section bg-[#161616] border border-[#262626] rounded-[12px] p-[8px] mb-[8px] flex-1 min-h-[80px] overflow-hidden flex flex-col">
        {currentTier === 'label' && rosterArtists.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 mb-1.5 border-b border-[#222] flex-shrink-0">
            <button
              type="button"
              onClick={() => handleSelectRosterArtist('all')}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap cursor-pointer transition-all ${
                selectedArtistFilter === 'all'
                  ? 'bg-[#ff8c00] text-black'
                  : 'bg-[#202020] text-[#888] hover:text-white'
              }`}
            >
              All Artists
            </button>
            {rosterArtists.map((handleName) => {
              const isSelected = selectedArtistFilter.toLowerCase() === handleName.toLowerCase();
              return (
                <button
                  key={handleName}
                  type="button"
                  onClick={() => handleSelectRosterArtist(handleName)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#ff8c00] text-black'
                      : 'bg-[#202020] text-[#888] hover:text-white'
                  }`}
                >
                  @{handleName}
                </button>
              );
            })}
          </div>
        )}

        {currentTier !== 'free' &&
          uniqueAlbums.length > 0 &&
          (!isLabelRosterMode || selectedArtistFilter !== 'all') && (
            <div className="flex items-center gap-2 mb-2 pb-1 border-b border-[#222]">
              {!isLabelRosterMode && (
                <button
                  onClick={() => {
                    if (triggerDemoFeature('albums_view')) return;
                    setViewMode('tracks');
                    setActivePlaylist(masterPlaylist);
                    setSelectedAlbum(null);
                  }}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer transition-all ${
                    viewMode === 'tracks'
                      ? 'bg-[#ff8c00] text-black'
                      : 'bg-[#202020] text-[#888] hover:text-white'
                  }`}
                >
                  All Tracks
                </button>
              )}
              <button
                onClick={() => {
                  if (triggerDemoFeature('albums_view')) return;
                  if (isLabelRosterMode && viewMode === 'albums') {
                    handleSelectRosterArtist(selectedArtistFilter);
                    return;
                  }
                  setSelectedAlbum(null);
                  setViewMode('albums');
                }}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer transition-all ${
                  viewMode === 'albums'
                    ? 'bg-[#ff8c00] text-black'
                    : 'bg-[#202020] text-[#888] hover:text-white'
                }`}
              >
                Albums / Projects ({uniqueAlbums.length})
              </button>
              {selectedAlbum && (
                <span className="text-[10px] text-[#ff8c00] truncate ml-auto">
                  Proj: {selectedAlbum}
                </span>
              )}
            </div>
          )}

        <div className="inline-tracks-list flex flex-col gap-[6px] overflow-y-auto flex-1">
          {currentTier !== 'free' && viewMode === 'albums' && !selectedAlbum ? (
            <div className="space-y-2">
              {uniqueAlbums.map((albumName, idx) => {
                const albumTracks = albumSourceTracks.filter((t) =>
                  trackIncludesAlbum(t, albumName)
                );
                const albumThumb =
                  albumTracks.find((t) => t.artwork_url)?.artwork_url || FALLBACK_COVER_ART;

                return (
                  <div
                    key={idx}
                    className="bg-[#202020] p-2.5 rounded-[8px] border border-[#2e2e2e] cursor-pointer hover:border-[#ff8c00] flex items-center justify-between gap-3"
                    onClick={() => {
                      const sortedAlbumTracks = [...albumTracks].sort((a, b) => {
                        return (a.album_order ?? 99) - (b.album_order ?? 99);
                      });
                      setActivePlaylist(sortedAlbumTracks);
                      setSelectedAlbum(albumName);
                      setViewMode('tracks');
                      if (sortedAlbumTracks.length > 0) {
                        loadTrack(sortedAlbumTracks[0], 0, true);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={albumThumb}
                        alt={albumName}
                        className="w-[34px] h-[34px] rounded-[5px] object-cover flex-shrink-0 border border-[#333]"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{albumName}</div>
                        <div className="text-[10px] text-[#888]">
                          {albumTracks.length} Track{albumTracks.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#ff8c00] font-bold flex-shrink-0">
                      Play Project &rarr;
                    </span>
                  </div>
                );
              })}
            </div>
          ) : activePlaylist.length === 0 ? (
            <div className="text-center text-[#666] text-[12px] py-6">
              {artistHandle ? 'No tracks added to this store yet.' : 'No tracks found.'}
            </div>
          ) : (
            activePlaylist.map((track, idx) => (
              <div
                key={track.id}
                className={`playlist-item bg-[#202020] p-[8px_12px] rounded-[8px] flex items-center justify-between gap-[10px] cursor-pointer border ${
                  idx === currentIndex ? 'border-[#ff8c00] bg-[#2a1f12]' : 'border-[#2e2e2e]'
                }`}
                onClick={() => {
                  loadTrack(track, idx, true);
                }}
              >
                <div className="flex items-center gap-[10px] overflow-hidden flex-1">
                  <img
                    src={track.artwork_url || FALLBACK_COVER_ART}
                    className="w-[32px] h-[32px] rounded-[5px] object-cover flex-shrink-0"
                    alt=""
                  />

                  <div className="playlist-item-info flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <div className="playlist-item-title text-[12px] font-bold text-white truncate">
                        {track.title}
                      </div>
                      {track.genre && (
                        <span className="text-[9px] bg-[#ff8c00]/15 text-[#ff8c00] font-bold px-1.5 py-0.2 rounded border border-[#ff8c00]/30 flex-shrink-0">
                          {track.genre}
                        </span>
                      )}
                    </div>
                    <div className="playlist-item-artist text-[11px] text-[#ff8c00] truncate">
                      @
                      {currentTier === 'label'
                        ? track.artist_handle || artistHandle
                        : artistHandle || track.artist_handle}
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => handleShareTrack(track, e)}
                  className="px-2.5 py-1 rounded-[6px] bg-[#1a1a1a] border border-[#333] hover:border-[#ff8c00] text-[#aaa] hover:text-white text-[10px] font-bold cursor-pointer transition-all flex-shrink-0"
                  title="Copy Share Link"
                >
                  Share
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Player Controls */}
      <div className="controls flex justify-between items-center pb-[2px] flex-shrink-0">
        <button
          className={`w-[38px] h-[38px] rounded-full flex items-center justify-center transition-all ${
            isShuffled
              ? 'text-[#ff8c00] bg-[#2a1f12] border border-[#ff8c00]'
              : 'bg-[#1e1e1e] text-[#aaa] hover:bg-[#2e2e2e] hover:text-white'
          }`}
          onClick={() => {
            if (triggerDemoFeature('playback_controls')) return;
            setIsShuffled(!isShuffled);
            setSubscribeBoxOpen(false);
          }}
          title="Shuffle"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8"></polyline>
            <line x1="4" y1="20" x2="21" y2="3"></line>
            <polyline points="21 16 21 21 16 21"></polyline>
            <line x1="15" y1="15" x2="21" y2="21"></line>
            <line x1="4" y1="4" x2="9" y2="9"></line>
          </svg>
        </button>

        <button
          className="w-[38px] h-[38px] bg-[#1e1e1e] text-[#aaa] rounded-full flex items-center justify-center hover:bg-[#2e2e2e] hover:text-white"
          onClick={() => {
            if (triggerDemoFeature('playback_controls')) return;
            handlePreviousClick();
          }}
          title="Previous"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="19 20 9 12 19 4 19 20"></polygon>
            <line x1="5" y1="19" x2="5" y2="5"></line>
          </svg>
        </button>

        <button
          id="play-pause-btn"
          className="w-[46px] h-[46px] bg-[#ff8c00] text-black rounded-full flex items-center justify-center shadow-lg"
          onClick={() => {
            if (triggerDemoFeature('playback_controls')) return;
            togglePlay();
            setSubscribeBoxOpen(false);
          }}
          title="Play/Pause"
        >
          {!isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          )}
        </button>

        <button
          className="w-[38px] h-[38px] bg-[#1e1e1e] text-[#aaa] rounded-full flex items-center justify-center hover:bg-[#2e2e2e] hover:text-white"
          onClick={() => {
            if (triggerDemoFeature('playback_controls')) return;
            nextTrack();
            setSubscribeBoxOpen(false);
          }}
          title="Next"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 4 15 12 5 20 5 4"></polygon>
            <line x1="19" y1="5" x2="19" y2="19"></line>
          </svg>
        </button>

        <button
          className={`w-[38px] h-[38px] rounded-full flex items-center justify-center transition-all ${
            isRepeated
              ? 'text-[#ff8c00] bg-[#2a1f12] border border-[#ff8c00]'
              : 'bg-[#1e1e1e] text-[#aaa] hover:bg-[#2e2e2e] hover:text-white'
          }`}
          onClick={() => {
            if (triggerDemoFeature('playback_controls')) return;
            setIsRepeated(!isRepeated);
            setSubscribeBoxOpen(false);
          }}
          title="Repeat"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9"></polyline>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
            <polyline points="7 23 3 19 7 15"></polyline>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
          </svg>
        </button>
      </div>

      {/* Demo Mode Tutorial Dock (Market Page Only) */}
      {demoMode && demoFooterContent ? (
        <div className="pt-1 pb-[2px] flex-shrink-0">{demoFooterContent}</div>
      ) : currentTier === 'label' && showLabelPromoStrip ? (
        <div className="group h-[24px] pt-1 overflow-hidden relative flex-shrink-0">
          <style>{`
            @keyframes mmLabelPromoVerticalCycle {
              0%, 65% {
                transform: translateY(0);
              }
              70%, 95% {
                transform: translateY(-20px);
              }
              100% {
                transform: translateY(0);
              }
            }
            @keyframes mmLabelPromoGlowPulse {
              0%, 100% {
                text-shadow:
                  0 0 7px rgba(255, 140, 0, 0.45),
                  0 0 14px rgba(46, 204, 113, 0.15);
              }
              50% {
                text-shadow:
                  0 0 12px rgba(255, 140, 0, 0.8),
                  0 0 22px rgba(46, 204, 113, 0.32);
              }
            }
            .mm-label-promo-track {
              display: flex;
              flex-direction: column;
              animation: mmLabelPromoVerticalCycle 15s cubic-bezier(0.22, 1, 0.36, 1) infinite;
            }
            .group:hover .mm-label-promo-track {
              animation-play-state: paused;
            }
            .mm-label-promo-hype {
              font-size: 10.5px;
              font-weight: 700;
              letter-spacing: 0.4px;
              color: #ff9d2e;
              animation: mmLabelPromoGlowPulse 2s ease-in-out infinite;
            }
          `}</style>
          <a
            href="/create"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full h-full no-underline"
          >
            <div className="mm-label-promo-track">
              <div className="h-[20px] flex items-center justify-center gap-1.5 text-[10px] text-[#888] tracking-[0.3px] flex-shrink-0">
                <span className="inline-flex items-end gap-[2px] h-[11px]" aria-hidden="true">
                  <span className="w-[2px] h-full bg-[#ff8c00]" />
                  <span className="w-[2px] h-[7px] bg-[#ff8c00]" />
                  <span className="w-[2px] h-[5px] bg-[#ff8c00]" />
                  <span className="w-[2px] h-[4px] bg-[#ff8c00]" />
                  <span className="w-[2px] h-[5px] bg-[#ff8c00]" />
                  <span className="w-[2px] h-[9px] bg-[#2ecc71]" />
                  <span className="w-[2px] h-full bg-[#ff8c00]" />
                </span>
                <span>Powered by</span>
                <span className="font-bold text-white">Music Market</span>
                <span>&middot;</span>
                <span className="underline text-[#ff8c00] font-semibold">Create Your Account Now</span>
              </div>
              <div className="h-[20px] flex items-center justify-center flex-shrink-0">
                <span className="mm-label-promo-hype">More Streams, More Sales, More Fans</span>
              </div>
            </div>
          </a>
        </div>
      ) : (
        /* Free Tier Artist Acquisition Footer */
        currentTier === 'free' && (
          <div className="text-center pt-1 pb-[2px] flex-shrink-0">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-1.5 text-[10px] text-[#777] hover:text-[#ff8c00] transition-colors tracking-wide"
            >
              <span className="inline-flex items-end gap-[2px] h-[11px]" aria-hidden="true">
                <span className="w-[2px] h-full bg-[#ff8c00]" />
                <span className="w-[2px] h-[7px] bg-[#ff8c00]" />
                <span className="w-[2px] h-[5px] bg-[#ff8c00]" />
                <span className="w-[2px] h-[4px] bg-[#ff8c00]" />
                <span className="w-[2px] h-[5px] bg-[#ff8c00]" />
                <span className="w-[2px] h-[9px] bg-[#2ecc71]" />
                <span className="w-[2px] h-full bg-[#ff8c00]" />
              </span>
              <span>Powered by</span>
              <span className="font-bold text-white">Music Market</span>
              <span>·</span>
              <span className="underline">Create Your Store</span>
            </a>
          </div>
        )
      )}

      {/* Stream Links Modal Drawer */}
      {streamModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 flex justify-center items-end z-50 touch-manipulation"
          onClick={() => setStreamModalOpen(false)}
        >
          <div
            className="bg-[#1a1a1a] w-full max-w-[480px] rounded-t-[20px] p-5 border-t border-[#333] text-center touch-manipulation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h4 className="m-0 text-[15px] text-white font-bold tracking-wider">LISTEN ON</h4>
              <button
                className="bg-transparent border-none text-[#aaa] text-xl cursor-pointer"
                onClick={() => setStreamModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Spotify', url: currentTrack?.spotify_url },
                { label: 'Apple Music', url: currentTrack?.apple_music_url },
                { label: 'Tidal', url: currentTrack?.tidal_url },
                { label: 'YouTube', url: currentTrack?.youtube_url },
                { label: 'Pandora', url: currentTrack?.pandora_url },
              ]
                .filter((item) => Boolean(item.url?.trim()))
                .map((item) => (
                  <a
                    key={item.label}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      if (currentTrack?.id) {
                        logAnalyticsEvent('outbound_stream', currentTrack, { platform: item.label });
                      }
                    }}
                    className="bg-[#252525] text-white p-3 rounded-[10px] font-bold text-sm border border-[#333] hover:border-[#ff8c00] block"
                  >
                    {item.label}
                  </a>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Buy Option Light Box Modal */}
      {buyModalOpen && trackToBuy && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 touch-manipulation">
          <div className="bg-[#161616] border border-[#2e2e2e] w-full max-w-[420px] rounded-[22px] p-6 text-left shadow-2xl relative touch-manipulation">
            <button
              onClick={() => setBuyModalOpen(false)}
              className="absolute top-4 right-4 text-[#888] hover:text-white text-[18px] font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-[20px] font-bold text-white mb-1">Select Purchase Option</h3>
            <p className="text-[12px] text-[#888] mb-5">
              Choose whether to buy this individual track or the full project.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setBuyModalOpen(false);
                  executeCheckout({
                    itemType: 'single',
                    trackId: String(trackToBuy.id),
                    artistHandle:
                      currentTier === 'label'
                        ? trackToBuy.artist_handle || artistHandle
                        : artistHandle || trackToBuy.artist_handle,
                    price: trackToBuy.price,
                    title: trackToBuy.title,
                  });
                }}
                className="w-full bg-[#111] hover:bg-[#1f1f1f] border border-[#262626] hover:border-[#ff8c00] p-4 rounded-[14px] flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div>
                  <div className="text-[11px] font-bold text-[#ff8c00] uppercase tracking-wider mb-0.5">
                    Single Track
                  </div>
                  <div className="text-[14px] font-bold text-white group-hover:text-[#ff8c00] transition-colors">
                    {trackToBuy.title}
                  </div>
                </div>
                <div className="text-[15px] font-bold text-white bg-[#222] px-3 py-1.5 rounded-[8px] border border-[#333]">
                  ${parseFloat(String(trackToBuy.price || 0.99)).toFixed(2)}
                </div>
              </button>

              {trackToBuy.album_name && (
                <button
                  type="button"
                  onClick={() => {
                    setBuyModalOpen(false);
                    executeCheckout({
                      itemType: 'album',
                      albumName: trackToBuy.album_name,
                      artistHandle: trackToBuy.artist_handle,
                      price: 7.99,
                    });
                  }}
                  className="w-full bg-[#1e1710] hover:bg-[#2a1f12] border border-[#ff8c00]/40 hover:border-[#ff8c00] p-4 rounded-[14px] flex items-center justify-between text-left transition-all cursor-pointer group shadow-[0_0_16px_rgba(255,140,0,0.1)]"
                >
                  <div>
                    <div className="text-[11px] font-bold text-[#2ecc71] uppercase tracking-wider mb-0.5">
                      Full Album Bundle
                    </div>
                    <div className="text-[14px] font-bold text-white group-hover:text-[#ff8c00] transition-colors">
                      {trackToBuy.album_name}
                    </div>
                  </div>
                  <div className="text-[15px] font-bold text-[#ff8c00] bg-[#2a1f12] px-3 py-1.5 rounded-[8px] border border-[#ff8c00]/40">
                    $7.99
                  </div>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setBuyModalOpen(false)}
              className="w-full text-center text-[12px] text-[#666] hover:text-[#aaa] font-bold pt-4 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => {
          setIsPlaying(true);
          const active = currentTrackRef.current;
          if (active?.id && lastLoggedPlayTrackIdRef.current !== String(active.id)) {
            lastLoggedPlayTrackIdRef.current = String(active.id);
            logAnalyticsEvent('play', active);
          }
        }}
        onPause={() => {
          if (document.visibilityState === 'visible') {
            setIsPlaying(false);
          }
        }}
        onWaiting={() => {
          if (isPlayingRef.current) {
            armStallWatchdog();
          }
        }}
        onStalled={() => {
          if (isPlayingRef.current) {
            armStallWatchdog();
          }
        }}
        onLoadedMetadata={handleTimeUpdate}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleTrackEnded}
        onError={handleAudioError}
      />
    </div>
  );
}
