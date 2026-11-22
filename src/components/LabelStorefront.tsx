'use client';

import React, { useState, useEffect } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

interface Track {
  id: string | number;
  title: string;
  genre?: string | null;
  price: number;
  audio_file_path: string;
  artwork_url?: string;
  artwork_file_path?: string;
  album_name?: string | null;
  album_price?: number | null;
  spotify_url?: string | null;
  apple_music_url?: string | null;
  tidal_url?: string | null;
  youtube_url?: string | null;
  pandora_url?: string | null;
  artist_handle?: string | null;
  album_order?: number | null;
  album_index?: number | null;
}

interface Profile {
  id: string;
  handle: string;
  display_name?: string;
  avatar_url?: string;
  logo_url?: string;
  tier: 'free' | 'artist' | 'label';
  stripe_account_id?: string;
}

interface LabelStorefrontProps {
  profile: Profile | null;
  tracks: Track[];
  labelHandle: string;
}

function PlayIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function PauseIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function ShareIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export default function LabelStorefront({ profile, tracks, labelHandle }: LabelStorefrontProps) {


  const [sortedTracks, setSortedTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioInstance, setAudioInstance] = useState<HTMLAudioElement | null>(null);
  
    const [albumCoverMap, setAlbumCoverMap] = useState<Record<string, string>>({});
    const [mainArtistHandle, setMainArtistHandle] = useState<string | null>(null);
  const [firstRosterArtist, setFirstRosterArtist] = useState<{
    handle: string;
    name?: string | null;
  } | null>(null);



  useEffect(() => {
    async function fetchAlbumArtworks() {
      const { data, error } = await _supabase
        .from('albums_meta')
        .select('*');

      if (error) {
        console.error('Error fetching storefront albums_meta:', error);
        return;
      }

      if (data) {
        const map: Record<string, string> = {};
        data.forEach((album) => {
          let resolvedUrl = album.artwork_url;
          if (!resolvedUrl && album.artwork_file_path) {
            const { data: publicURLData } = _supabase.storage
              .from('v2-cover-art')
              .getPublicUrl(album.artwork_file_path);
            resolvedUrl = publicURLData.publicUrl;
          }

          if (resolvedUrl && album.album_name) {
            const bustedUrl = `${resolvedUrl}?t=${Date.now()}`;
            map[album.album_name] = bustedUrl;
            map[album.album_name.trim().toLowerCase()] = bustedUrl;
          }
        });
        setAlbumCoverMap(map);
      }
    }
        fetchAlbumArtworks();
  }, [labelHandle]);

      useEffect(() => {
    async function fetchLabelAndRosterArtists() {
      if (!profile?.id) {
        setMainArtistHandle(null);
        setFirstRosterArtist(null);
        return;
      }

            const { data: labelProfileData, error: labelProfileError } = await _supabase
        .from('profiles')
        .select('artist_handle, handle, main_artist_profile_id')
        .eq('id', profile.id)
        .maybeSingle();

      if (labelProfileError) {
        console.error('Error fetching label profile artist_handle:', labelProfileError);
      }

      let resolvedMainHandle = labelProfileData?.artist_handle?.trim() || null;
      if (labelProfileData?.main_artist_profile_id) {
        const { data: mainArtistRow } = await _supabase
          .from('profiles')
          .select('artist_handle, handle')
          .eq('id', labelProfileData.main_artist_profile_id)
          .maybeSingle();
        resolvedMainHandle =
          mainArtistRow?.artist_handle?.trim() ||
          mainArtistRow?.handle?.trim() ||
          resolvedMainHandle;
      }

      setMainArtistHandle(resolvedMainHandle);


      const { data, error } = await _supabase
        .from('profiles')
        .select('handle, artist_handle, name, created_at')
        .eq('parent_label_id', profile.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching first roster artist:', error);
        return;
      }

      const resolvedHandle =
        data?.artist_handle?.trim() || data?.handle?.trim() || '';
      const resolvedName = data?.name?.trim() || null;

      if (resolvedHandle) {
        setFirstRosterArtist({ handle: resolvedHandle, name: resolvedName });
      } else {
        setFirstRosterArtist(null);
      }
    }

    fetchLabelAndRosterArtists();
  }, [profile?.id]);




  const formatTrackUrls = (trackList: Track[]) => {
    return trackList.map(track => {
      let audioUrl = track.audio_file_path;
      if (audioUrl && !audioUrl.startsWith('http')) {
        audioUrl = _supabase.storage.from('v2-audio-vault').getPublicUrl(audioUrl).data.publicUrl;
      }

      let artUrl = track.artwork_url;
      if (track.artwork_file_path && !track.artwork_file_path.startsWith('http')) {
        artUrl = _supabase.storage.from('v2-cover-art').getPublicUrl(track.artwork_file_path).data.publicUrl;
      }

      return {
        ...track,
        audio_file_path: audioUrl,
        artwork_url: artUrl
      };
    });
  };

    useEffect(() => {
    const activeTracks = tracks.filter((t: any) => !t.deleted_at);
    const formatted = formatTrackUrls(activeTracks);
    let workingTracks = [...formatted];

    const urlParams = new URLSearchParams(window.location.search);
    const targetTrackParam = urlParams.get('track');

    if (targetTrackParam && workingTracks.length > 0) {
      const trackIndex = workingTracks.findIndex(t => String(t.id) === String(targetTrackParam));
      if (trackIndex !== -1) {
        const sharedTrack = workingTracks.splice(trackIndex, 1)[0];
        workingTracks.unshift(sharedTrack);
      }
    }

        setSortedTracks(workingTracks);
    setCurrentTrack(workingTracks[0] || null);
  }, [tracks]);

  useEffect(() => {
    return () => {
      if (audioInstance) {
        audioInstance.pause();
      }
    };
  }, [audioInstance]);


    function getVisitorId(): string {
    if (typeof window === 'undefined') return 'server';
    let vid = localStorage.getItem('mm_visitor_id');
    if (!vid) {
      vid = `v_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
      localStorage.setItem('mm_visitor_id', vid);
    }
    return vid;
  }

  async function logStorefrontEvent(
    eventType: 'play' | 'outbound_stream',
    track: Track,
    extraMetadata: Record<string, any> = {}
  ) {
    if (!track?.id) return;
    const rawHandle = track.artist_handle?.trim();
    const isLabelImprint =
      Boolean(rawHandle) &&
      Boolean(labelHandle?.trim()) &&
      rawHandle!.toLowerCase() === labelHandle.trim().toLowerCase();

    const resolvedHandle = (
      (!rawHandle || isLabelImprint ? mainArtistHandle || firstRosterArtist?.handle : rawHandle) ||
      labelHandle ||
      ''
    )
      .trim()
      .toLowerCase();

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
          source: 'label_storefront',
          ...extraMetadata,
        },
      });
    } catch (err) {
      console.error(`Failed to log ${eventType} event on LabelStorefront:`, err);
    }
  }

  const togglePlayTrack = (track: Track) => {

    if (currentTrack?.id === track.id && isPlaying) {
      audioInstance?.pause();
      setIsPlaying(false);
      return;
    }

    if (audioInstance) {
      audioInstance.pause();
    }

    if (!track.audio_file_path) {
      alert("Audio file path is missing for this track.");
      return;
    }

        const newAudio = new Audio(track.audio_file_path);
    newAudio
      .play()
      .then(() => {
        logStorefrontEvent('play', track);
      })
      .catch(err => console.error("Audio playback error:", err));
    setAudioInstance(newAudio);
    setCurrentTrack(track);
    setIsPlaying(true);


       newAudio.onended = () => setIsPlaying(false);
  };

  const handleStepTrack = (direction: 'prev' | 'next') => {
    if (sortedTracks.length === 0) return;

    const currentIndex = currentTrack
      ? sortedTracks.findIndex((t) => String(t.id) === String(currentTrack.id))
      : -1;

    let nextIndex = 0;
    if (currentIndex === -1) {
      nextIndex = 0;
    } else if (direction === 'next') {
      nextIndex = (currentIndex + 1) % sortedTracks.length;
    } else {
      nextIndex = (currentIndex - 1 + sortedTracks.length) % sortedTracks.length;
    }

    const targetTrack = sortedTracks[nextIndex];
    if (!targetTrack) return;

    if (audioInstance) {
      audioInstance.pause();
    }

    if (!targetTrack.audio_file_path) {
      setCurrentTrack(targetTrack);
      setIsPlaying(false);
      alert('Audio file path is missing for this track.');
      return;
    }

    const newAudio = new Audio(targetTrack.audio_file_path);
    newAudio
      .play()
      .then(() => {
        logStorefrontEvent('play', targetTrack);
      })
      .catch((err) => console.error('Audio playback error:', err));

    setAudioInstance(newAudio);
    setCurrentTrack(targetTrack);
    setIsPlaying(true);
    newAudio.onended = () => setIsPlaying(false);
  };

  const handleBuyTrack = async (track: Track) => {

    if (!track || !track.id) {
      alert("No track selected for checkout.");
      return;
    }

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
     artistHandle: track.artist_handle || mainArtistHandle || firstRosterArtist?.handle || labelHandle

            }
          ]
        })
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
        alert(session.error || `Could not initiate checkout for "${track.title}"`);
      }
    } catch (err) {
      console.error('Stripe checkout error:', err);
      alert('Network error connecting to payment gateway.');
    }
  };

  const handleBuyAlbum = async (albumName: string, albumPrice: number, albumTracks: Track[]) => {
    if (!albumName) return;

    try {
      const response = await fetch('/api/checkout/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              itemType: 'album',
              albumName: albumName,
              price: albumPrice || 7.99,
              artistHandle: albumTracks[0]?.artist_handle,
              trackIds: albumTracks.map(t => String(t.id))
            }
          ]
        })
      });
      const responseText = await response.text();
      let session;
      try {
        session = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('Non-JSON server response:', responseText);
        alert('Server error: received invalid response from album checkout route.');
        return;
      }

      if (session.url) {
        window.location.href = session.url;
      } else {
        alert(session.error || `Could not initiate checkout for album "${albumName}"`);
      }
    } catch (err) {
      console.error('Stripe album checkout error:', err);
      alert('Network error connecting to payment gateway.');
    }
  };

  const handleShareTrack = (track: Track, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = `${window.location.origin}/artist/${labelHandle}?track=${track.id}`;
    navigator.clipboard.writeText(shareUrl);
    alert(`Copied share link for "${track.title}"!`);
  };

  const isPaidTier = profile?.tier === 'artist' || profile?.tier === 'label';
  const uniqueAlbums = Array.from(
    new Set(
      sortedTracks.flatMap(t => t.album_name ? t.album_name.split(',').map((s: string) => s.trim()) : [])
    )
  ).filter(Boolean) as string[];

  // Contextual Album Upsell: Parse all comma-separated albums associated with the currently playing track
  const activeAlbumNames = currentTrack?.album_name 
    ? currentTrack.album_name.split(',').map((s: string) => s.trim()).filter(Boolean) 
    : [];
  
  const displayAlbums = uniqueAlbums.filter(alb => activeAlbumNames.includes(alb));

  const uniqueArtists = Array.from(new Set(sortedTracks.map(t => t.artist_handle).filter(Boolean)));
  const totalTracksCount = sortedTracks.length;
  const rosterHeadcountLabel = uniqueArtists.length > 1 
    ? `${uniqueArtists.length} Artists • ${totalTracksCount} Masters` 
    : `${totalTracksCount} Catalog Masters`;


    return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center px-3.5 pt-5 pb-36 sm:px-6 sm:pt-6 sm:pb-36 md:p-8 md:pb-36 touch-manipulation overflow-x-hidden">
      <div className="w-full max-w-4xl space-y-6 sm:space-y-8 min-w-0">

        {/* Header / Branding */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-3.5 sm:gap-5 min-w-0 w-full md:w-auto">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#ff8c00] to-neutral-900 flex items-center justify-center font-black text-xl sm:text-2xl border border-neutral-700 overflow-hidden shadow-md shrink-0">
              {profile?.logo_url ? (
                <img src={profile.logo_url} alt="Label Logo" className="w-full h-full object-cover" />
              ) : (
                profile?.display_name?.charAt(0).toUpperCase() || '2G'
              )}
            </div>
            <div className="text-left space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-white break-words leading-tight">
                  {profile?.display_name || labelHandle}
                </h1>
                <span className="text-[10px] bg-[#ff8c00]/10 border border-[#ff8c00]/40 text-[#ff8c00] px-2.5 py-0.5 rounded-full font-bold shrink-0">
                  Verified Label
                </span>
              </div>
              <p className="text-xs text-neutral-400">Direct Music Store & Official Masters</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-xs font-semibold text-neutral-300 bg-neutral-950 px-3.5 py-2 rounded-xl border border-neutral-800 flex items-center gap-2 shadow-inner">
              <svg
                className="w-3.5 h-3.5 text-[#ff8c00] flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span>{isPaidTier ? rosterHeadcountLabel : 'Marketplace Verified'}</span>
            </span>
          </div>
        </div>

        {/* Featured Player Header Card */}
        {currentTrack && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row items-center gap-4 sm:gap-6">
            <img
              src={currentTrack.artwork_url || 'https://27593217-482041110881488807.preview.editmysite.com/uploads/2/7/5/9/27593217/box-logo_orig.jpg'}
              alt={currentTrack.title}
              className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl object-cover border border-neutral-800 shadow-xl shrink-0"
            />
            <div className="flex-1 w-full text-left space-y-3 min-w-0">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[11px] font-bold text-[#ff8c00] tracking-wider uppercase">Currently Playing</span>
                  {currentTrack.genre && (
                    <span className="text-[10px] bg-[#ff8c00]/15 text-[#ff8c00] font-bold px-2 py-0.5 rounded-md border border-[#ff8c00]/30">
                      {currentTrack.genre}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white break-words">{currentTrack.title}</h2>
                {isPaidTier && currentTrack.album_name && (
                  <p className="text-xs text-neutral-400 break-words">Albums: {currentTrack.album_name}</p>
                )}

                {(() => {
                  const rawHandle = currentTrack.artist_handle?.trim();
                  const cleanLabel = labelHandle?.trim().toLowerCase();
                  const isLabelHandle =
                    Boolean(rawHandle) &&
                    Boolean(cleanLabel) &&
                    rawHandle!.toLowerCase() === cleanLabel;
                  const fallbackHandle =
                    mainArtistHandle || firstRosterArtist?.handle || '';
                  const displayHandle =
                    !rawHandle || isLabelHandle ? fallbackHandle : rawHandle;

                  return displayHandle ? (
                    <p className="text-xs text-[#ff8c00] font-semibold truncate">@{displayHandle}</p>
                  ) : null;
                })()}
              </div>

              {/* Streaming Platform Badges */}
              {isPaidTier && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {[
                    { label: 'Spotify', url: currentTrack.spotify_url, cls: 'hover:border-emerald-500 text-emerald-400' },
                    { label: 'Apple Music', url: currentTrack.apple_music_url, cls: 'hover:border-pink-500 text-pink-400' },
                    { label: 'Tidal', url: currentTrack.tidal_url, cls: 'hover:border-cyan-400 text-cyan-400' },
                    { label: 'YouTube', url: currentTrack.youtube_url, cls: 'hover:border-red-500 text-red-400' },
                    { label: 'Pandora', url: currentTrack.pandora_url, cls: 'hover:border-blue-400 text-blue-400' },
                  ]
                    .filter((item) => Boolean(item.url?.trim()))
                    .map((item) => (
                      <a
                        key={item.label}
                        href={item.url!}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => logStorefrontEvent('outbound_stream', currentTrack, { platform: item.label })}
                        className={`text-[11px] bg-neutral-950 border border-neutral-800 ${item.cls} px-3 py-1 rounded-lg font-bold whitespace-nowrap`}
                      >
                        {item.label}
                      </a>
                    ))}
                </div>
              )}

              <div className="flex items-center gap-2.5 flex-wrap pt-2">
                <button
                  type="button"
                  onClick={() => togglePlayTrack(currentTrack)}
                  className="bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap shrink-0"
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  <span>{isPlaying ? 'Pause Preview' : 'Play Preview'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBuyTrack(currentTrack)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition-all whitespace-nowrap shrink-0"
                >
                  Buy Master (${currentTrack.price})
                </button>
                <button
                  type="button"
                  onClick={(e) => handleShareTrack(currentTrack, e)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all border border-neutral-700 whitespace-nowrap shrink-0"
                >
                  <ShareIcon />
                  <span>Share Link</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Multiple Album Upsell Widget */}
        {isPaidTier && displayAlbums.length > 0 && (
          <div className="bg-neutral-900 border border-[#ff8c00]/40 rounded-3xl p-6 text-left space-y-4 shadow-xl shadow-[#ff8c00]/5 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-[#ff8c00] text-neutral-950 font-black uppercase px-2.5 py-0.5 rounded-md">
                  Project Upsell
                </span>
                <h3 className="font-extrabold text-base text-white">
                  {displayAlbums.length > 1 ? 'Available on Multiple Album Bundles' : 'Available on Full Album Bundle'}
                </h3>
              </div>
              <span className="text-xs text-neutral-400">{displayAlbums.length} project(s) found</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {displayAlbums.map((albumName) => {
                const albumTracks = sortedTracks
                  .filter(t => t.album_name?.split(',').map((s: string) => s.trim()).includes(albumName))
                  .sort((a, b) => (a.album_order ?? 0) - (b.album_order ?? 0));
                
                const albumPrice = albumTracks[0]?.album_price ?? 7.99;
                
                const coverArt =
                  albumCoverMap[albumName] ||
                  albumCoverMap[albumName?.trim().toLowerCase()] ||
                  albumTracks[0]?.artwork_url;

                const albumGenre = albumTracks[0]?.genre;

                return (
                  <div key={albumName} className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex gap-4 items-center w-full sm:w-auto truncate">
                      <img 
                        src={coverArt || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'} 
                        alt={albumName} 
                        className="w-18 h-18 rounded-xl object-cover border border-neutral-800 flex-shrink-0 shadow-md"
                      />
                      <div className="truncate space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#ff8c00] font-bold uppercase tracking-wider">Project Bundle</span>
                          {albumGenre && (
                            <span className="text-[9px] bg-[#ff8c00]/15 text-[#ff8c00] font-bold px-1.5 py-0.5 rounded border border-[#ff8c00]/30">
                              {albumGenre}
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-extrabold text-white truncate">{albumName}</h4>
                        <p className="text-xs text-neutral-400">{albumTracks.length} tracks included in this master project</p>
                      </div>
                    </div>

                    <div className="pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-900 flex sm:flex-col justify-between sm:items-end w-full sm:w-auto gap-3 flex-shrink-0">
                      <span className="text-lg font-extrabold text-emerald-400">
                        ${parseFloat(String(albumPrice)).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleBuyAlbum(albumName, Number(albumPrice), albumTracks)}
                        className="bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold px-5 py-2.5 rounded-xl text-xs cursor-pointer transition-all shadow-lg shadow-[#ff8c00]/10 whitespace-nowrap"
                      >
                        Buy Full Album &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full Track Catalog */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-left space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 border-b border-neutral-800 pb-4">
            <h3 className="font-extrabold text-base sm:text-lg text-white">Store Catalog ({sortedTracks.length})</h3>
            <span className="text-xs text-neutral-500">Direct High-Quality MP3 Downloads</span>
          </div>

          <div className="space-y-3">
            {sortedTracks.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              const isTrackPlaying = isPlaying && isCurrent;

              return (
                <div
                  key={track.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0 ${
                    isCurrent
                      ? 'bg-neutral-950 border-[#ff8c00]/60'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <img
                      src={track.artwork_url || 'https://27593217-482041110881488807.preview.editmysite.com/uploads/2/7/5/9/27593217/logo-box_orig.jpg'}
                      alt={track.title}
                      className="w-12 h-12 rounded-xl object-cover border border-neutral-800 shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{track.title}</h4>
                        {track.genre && (
                          <span className="text-[9px] bg-[#ff8c00]/15 text-[#ff8c00] font-bold px-1.5 py-0.5 rounded border border-[#ff8c00]/30 shrink-0">
                            {track.genre}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 truncate">
                        {isPaidTier && track.album_name ? track.album_name : 'Single Master'}{' '}
                        {(() => {
                          const rawHandle = track.artist_handle?.trim();
                          const cleanLabel = labelHandle?.trim().toLowerCase();
                          const isLabelHandle =
                            Boolean(rawHandle) &&
                            Boolean(cleanLabel) &&
                            rawHandle!.toLowerCase() === cleanLabel;

                          const fallbackHandle =
                            mainArtistHandle || firstRosterArtist?.handle || '';

                          if (!rawHandle) {
                            return fallbackHandle ? `• @${fallbackHandle}` : '';
                          }

                          if (isLabelHandle) {
                            return fallbackHandle ? `• @${fallbackHandle}` : `• @${rawHandle}`;
                          }

                          return `• @${rawHandle}`;
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-900 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleShareTrack(track, e)}
                      className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-[#ff8c00] text-neutral-400 hover:text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap"
                      title="Copy Share Link"
                    >
                      <ShareIcon />
                      <span>Share</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => togglePlayTrack(track)}
                      aria-label={isTrackPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                      className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-[#ff8c00] text-[#ff8c00] flex items-center justify-center cursor-pointer transition-all shrink-0"
                    >
                      {isTrackPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBuyTrack(track)}
                      className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap shrink-0"
                    >
                      ${track.price}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {currentTrack && (
        <div
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
          className="fixed bottom-2.5 sm:bottom-4 inset-x-2.5 sm:inset-x-6 z-40 bg-neutral-950/95 backdrop-blur-md border border-neutral-800 rounded-2xl px-3.5 pt-2.5 shadow-2xl"
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img
                src={
                  currentTrack.artwork_url ||
                  'https://27593217-482041110881488807.preview.editmysite.com/uploads/2/7/5/9/27593217/logo-box_orig.jpg'
                }
                alt={currentTrack.title}
                className="w-11 h-11 rounded-xl object-cover border border-neutral-800 shrink-0"
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs sm:text-sm font-bold text-white truncate">{currentTrack.title}</p>
                <p className="text-[11px] text-[#ff8c00] font-semibold truncate">
                  {(() => {
                    const rawHandle = currentTrack.artist_handle?.trim();
                    const cleanLabel = labelHandle?.trim().toLowerCase();
                    const isLabelHandle =
                      Boolean(rawHandle) &&
                      Boolean(cleanLabel) &&
                      rawHandle!.toLowerCase() === cleanLabel;
                    const fallbackHandle = mainArtistHandle || firstRosterArtist?.handle || '';
                    const shown = !rawHandle || isLabelHandle ? fallbackHandle : rawHandle;
                    return shown ? `@${shown}` : currentTrack.genre || 'Direct Master';
                  })()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleStepTrack('prev')}
                aria-label="Previous track"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-[#ff8c00] text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => togglePlayTrack(currentTrack)}
                aria-label={isPlaying ? `Pause ${currentTrack.title}` : `Play ${currentTrack.title}`}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 flex items-center justify-center cursor-pointer transition-all shadow-md shadow-[#ff8c00]/20"
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>

              <button
                type="button"
                onClick={() => handleStepTrack('next')}
                aria-label="Next track"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-[#ff8c00] text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleBuyTrack(currentTrack)}
                className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold px-3 py-2 rounded-xl text-xs cursor-pointer transition-all whitespace-nowrap"
              >
                ${currentTrack.price}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
