'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase as _supabase } from '@/utils/supabase';
import AudioPlayer from '@/components/AudioPlayer';
import LabelStorefront from '@/components/LabelStorefront';
import ImpulsePlayer from '@/components/ImpulsePlayer';

interface Track {
  id: string | number;
  title: string;
  price: number;
  audio_file_path: string;
  artwork_url?: string;
  artwork_file_path?: string;
  album_name?: string | null;
  spotify_url?: string | null;
  apple_music_url?: string | null;
  tidal_url?: string | null;
  youtube_url?: string | null;
  pandora_url?: string | null;
  artist_handle?: string | null;
  track_order?: number | null;
  album_order?: number | null;
  album_index?: number | null;
}

interface Profile {
  id: string;
  handle: string;
  artist_handle?: string;
  display_name?: string;
  avatar_url?: string;
  logo_url?: string;
  tier: 'free' | 'artist' | 'label';
  stripe_account_id?: string;
}

export default function DynamicStorefrontRouter() {
  const params = useParams();
  const searchParams = useSearchParams();
  const dropTrackId = searchParams.get('drop');

  // 1. ABSOLUTE TOP-LEVEL INTERCEPT: IF ?drop= IS IN THE URL, RENDER IMPULSE PLAYER IMMEDIATELY
  if (dropTrackId) {
    return <ImpulsePlayer trackId={dropTrackId} />;
  }

  const rawSlug = params?.slug;
  const slugArray = Array.isArray(rawSlug)
    ? rawSlug
    : typeof rawSlug === 'string'
      ? [rawSlug]
      : [];

  const isWorkspaceNested = slugArray[0] === 'workspace';
  const primarySlug = slugArray[0] || '';
  const secondarySlug = slugArray[1] || null;

  const targetArtistHandle = isWorkspaceNested
    ? secondarySlug
    : primarySlug && primarySlug !== '2g-imprint' && primarySlug !== 'workspace'
      ? primarySlug
      : null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStorefrontData() {
      setLoading(true);
      try {
        const devTier =
          typeof window !== 'undefined' ? localStorage.getItem('mm_dev_tier') : null;

        const lookupHandle = targetArtistHandle || primarySlug;
        let profileData = null;

        if (lookupHandle && lookupHandle !== 'workspace') {
          const { data } = await _supabase
            .from('profiles')
            .select('*')
            .or(`handle.eq.${lookupHandle},artist_handle.eq.${lookupHandle}`)
            .maybeSingle();
          profileData = data;
        }

               if (!profileData && !targetArtistHandle) {
          const { data: labelProfiles } = await _supabase
            .from('profiles')
            .select('*')
            .eq('tier', 'label')
            .is('parent_label_id', null)
            .limit(1);

          if (labelProfiles && labelProfiles.length > 0) {
            profileData = labelProfiles[0];
          }
        }


        const activeProfile: Profile = profileData || {
          id: 'test-id',
          handle: lookupHandle || '2g-imprint',
          display_name: lookupHandle || 'Music Market',
          tier: targetArtistHandle ? 'artist' : 'label',
        };

        if (devTier && devTier !== 'logged_out') {
          activeProfile.tier = devTier as any;
        }

        setProfile(activeProfile);

                let trackQuery = _supabase
          .from('tracks_pro')
          .select('*')
          .eq('is_archived', false)
          .is('deleted_at', null)
          .order('track_order', { ascending: true, nullsFirst: false })
          .order('album_index', { ascending: true, nullsFirst: false });


        // 👇 BULLETPROOF STOREFRONT ROUTING & TRACK QUERY
        const normalizedSlug = String(targetArtistHandle || primarySlug || '')
          .trim()
          .toLowerCase();
        const normalizedProfileHandle = String(activeProfile.handle || '')
          .trim()
          .toLowerCase();

        const isViewingIndividualArtist =
          Boolean(targetArtistHandle) && normalizedSlug !== normalizedProfileHandle;

        const isLabelView =
          !isViewingIndividualArtist &&
          (activeProfile.tier === 'label' ||
            primarySlug === '2g-imprint' ||
            !targetArtistHandle);

        if (isLabelView) {
          const { data: rosterArtists } = await _supabase
            .from('profiles')
            .select('handle, artist_handle')
            .eq('parent_label_id', activeProfile.id);

          const handles = [
            activeProfile.handle,
            activeProfile.artist_handle,
            ...(rosterArtists?.flatMap((a) => [a.handle, a.artist_handle]) || []),
          ].filter(Boolean);

          const rawHandles = handles.flatMap((h) => [
            h,
            String(h).toLowerCase(),
            String(h).trim(),
          ]);
          const uniqueHandles = Array.from(new Set(rawHandles));

          if (uniqueHandles.length > 0) {
            trackQuery = trackQuery.in('artist_handle', uniqueHandles);
          }
        } else if (targetArtistHandle) {
          const artistLookupHandles = Array.from(
            new Set(
              [targetArtistHandle, activeProfile.handle]
                .filter(Boolean)
                .flatMap((h) => [String(h).trim(), String(h).trim().toLowerCase()])
            )
          );
          trackQuery = trackQuery.in('artist_handle', artistLookupHandles);
        }

        const { data: trackData, error: trackError } = await trackQuery;

        if (trackError) {
          console.error('Error fetching tracks:', trackError);
        }

        if (trackData) {
          const validV2Tracks = trackData.filter(
            (t) => t.audio_file_path && !t.audio_file_path.includes('v1-legacy')
          );
          setTracks(validV2Tracks);
        }
      } catch (err) {
        console.error('Error loading storefront:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStorefrontData();

    const handleTierChange = () => loadStorefrontData();
    window.addEventListener('mm_tier_changed', handleTierChange);
    return () => window.removeEventListener('mm_tier_changed', handleTierChange);
  }, [primarySlug, secondarySlug, targetArtistHandle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center text-sm text-neutral-400">
        Loading storefront...
      </div>
    );
  }

  // 2. RENDER LABEL STOREFRONT ONLY WHEN NOT VIEWING A SPECIFIC INDIVIDUAL ARTIST HANDLE
  const normalizedCurrentSlug = String(targetArtistHandle || primarySlug || '')
    .trim()
    .toLowerCase();
  const normalizedCurrentLabelHandle = String(profile?.handle || '')
    .trim()
    .toLowerCase();
  const isSpecificArtistPlayer =
    Boolean(targetArtistHandle) && normalizedCurrentSlug !== normalizedCurrentLabelHandle;

  if (
    !isSpecificArtistPlayer &&
    (profile?.tier === 'label' || (!targetArtistHandle && primarySlug))
  ) {
    return (
      <LabelStorefront
        profile={profile}
        tracks={tracks}
        labelHandle={primarySlug || profile?.handle || '2g-imprint'}
      />
    );
  }

  // 3. RENDER INDIVIDUAL ARTIST AUDIO PLAYER
  const artistHandleToUse = targetArtistHandle || primarySlug;
  const artistTier = profile?.tier || 'artist';

    return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-2">
      <AudioPlayer
        artistHandle={artistHandleToUse}
        initialTracks={tracks}
        tier={artistTier}
      />
    </div>
  );
}
