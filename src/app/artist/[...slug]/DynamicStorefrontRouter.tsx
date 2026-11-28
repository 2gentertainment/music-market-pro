'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase as _supabase } from '@/utils/supabase';
import AudioPlayer from '@/components/AudioPlayer';
import LabelStorefront from '@/components/LabelStorefront';
import ImpulsePlayer from '@/components/ImpulsePlayer';

const VALID_TIERS = new Set(['free', 'artist', 'label']);

function normalizeHandle(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

function expandHandleVariants(handles: Array<string | null | undefined>): string[] {
  const variants = handles
    .filter((h): h is string => Boolean(h && h.trim()))
    .flatMap((h) => {
      const trimmed = h.trim();
      return [trimmed, trimmed.toLowerCase()];
    });
  return Array.from(new Set(variants));
}


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
  email?: string | null;
  is_super_admin?: boolean;
  tier: 'free' | 'artist' | 'label';
  stripe_account_id?: string;
}

export default function DynamicStorefrontRouter() {
  const params = useParams();
  const searchParams = useSearchParams();
  const dropTrackId = searchParams.get('drop');
  const forcePlayerView = searchParams.get('view') === 'player';


  const rawSlug = params?.slug;
  const slugArray = useMemo(() => {
    if (Array.isArray(rawSlug)) return rawSlug.map((s) => decodeURIComponent(s).trim());
    if (typeof rawSlug === 'string') return [decodeURIComponent(rawSlug).trim()];
    return [];
  }, [rawSlug]);

  const isWorkspaceNested = normalizeHandle(slugArray[0]) === 'workspace';
  const primarySlug = slugArray[0] || '';
  const secondarySlug = slugArray[1] || null;

  const targetArtistHandle = useMemo(() => {
    if (isWorkspaceNested) return secondarySlug || null;
    const normPrimary = normalizeHandle(primarySlug);
    if (normPrimary && normPrimary !== '2g-imprint' && normPrimary !== 'workspace') {
      return primarySlug;
    }
    return null;
  }, [isWorkspaceNested, primarySlug, secondarySlug]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState<boolean>(!dropTrackId);


    useEffect(() => {
    if (dropTrackId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadStorefrontData() {
      setLoading(true);
      setTracks([]);

            try {
        const isDevSuiteEnabled =
          process.env.NODE_ENV === 'development' &&
          process.env.NEXT_PUBLIC_ENABLE_DEV_SUITE === 'true';

        const rawDevTier =
          isDevSuiteEnabled && typeof window !== 'undefined'
            ? localStorage.getItem('mm_dev_tier')
            : null;
        const devTier =
          rawDevTier && VALID_TIERS.has(rawDevTier)
            ? (rawDevTier as Profile['tier'])
            : null;

        const lookupHandle = (targetArtistHandle || primarySlug).trim();
        let profileData: Profile | null = null;

        if (lookupHandle && normalizeHandle(lookupHandle) !== 'workspace') {
          const safeLookup = lookupHandle.replace(/[,()]/g, '');
          const { data } = await _supabase
            .from('profiles')
            .select('*')
            .or(`handle.ilike.${safeLookup},artist_handle.ilike.${safeLookup}`)
            .maybeSingle();

          profileData = data as Profile | null;
        }

        if (!profileData && !targetArtistHandle) {
          const { data: labelProfiles } = await _supabase
            .from('profiles')
            .select('*')
            .eq('tier', 'label')
            .is('parent_label_id', null)
            .limit(1);

          if (labelProfiles && labelProfiles.length > 0) {
            profileData = labelProfiles[0] as Profile;
          }
        }

        const activeProfile: Profile = profileData || {
          id: 'test-id',
          handle: lookupHandle || '2g-imprint',
          display_name: lookupHandle || 'Music Market',
          tier: targetArtistHandle ? 'artist' : 'label',
        };

                if (isDevSuiteEnabled && devTier) {
          activeProfile.tier = devTier;
        }


        if (cancelled) return;
        setProfile(activeProfile);

                const normTarget = normalizeHandle(targetArtistHandle);
        const normProfileHandle = normalizeHandle(activeProfile.handle);
        const normProfileArtistHandle = normalizeHandle(activeProfile.artist_handle);

        const isExplicitArtistHandleMatch =
          Boolean(normTarget) &&
          Boolean(normProfileArtistHandle) &&
          normTarget === normProfileArtistHandle &&
          normProfileArtistHandle !== normProfileHandle;

        const isLabelAccount =
          !isExplicitArtistHandleMatch &&
          (activeProfile.tier === 'label' ||
            (!targetArtistHandle && normalizeHandle(primarySlug) === '2g-imprint'));

        let lookupHandles: string[] = [];

        if (isLabelAccount) {
          const { data: rosterArtists } = await _supabase
            .from('profiles')
            .select('handle, artist_handle')
            .eq('parent_label_id', activeProfile.id);

          lookupHandles = expandHandleVariants([
            activeProfile.handle,
            activeProfile.artist_handle,
            ...(rosterArtists?.flatMap((a) => [a.handle, a.artist_handle]) || []),
          ]);
        } else {
          lookupHandles = expandHandleVariants(
            isExplicitArtistHandleMatch
              ? [targetArtistHandle || activeProfile.artist_handle || activeProfile.handle]
              : [targetArtistHandle, activeProfile.handle, activeProfile.artist_handle]
          );
        }


        if (lookupHandles.length === 0) {
          if (!cancelled) setTracks([]);
          return;
        }

        const { data: trackData, error: trackError } = await _supabase
          .from('tracks_pro')
          .select('*')
          .eq('is_archived', false)
          .is('deleted_at', null)
          .in('artist_handle', lookupHandles)
          .order('track_order', { ascending: true, nullsFirst: false })
          .order('album_index', { ascending: true, nullsFirst: false });

        if (cancelled) return;

        if (trackError) {
          console.error('Error fetching tracks:', trackError);
          setTracks([]);
          return;
        }

        const validV2Tracks = (trackData || []).filter(
          (t) => t.audio_file_path && !t.audio_file_path.includes('v1-legacy')
        );
        setTracks(validV2Tracks);
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading storefront:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStorefrontData();

    const handleTierChange = () => loadStorefrontData();
    window.addEventListener('mm_tier_changed', handleTierChange);
    return () => {
      cancelled = true;
      window.removeEventListener('mm_tier_changed', handleTierChange);
    };
  }, [dropTrackId, primarySlug, secondarySlug, targetArtistHandle]);


    // 1. SAFE POST-HOOK INTERCEPT FOR ?drop= IMPULSE PLAYER
  if (dropTrackId) {
    return (
      <div className="h-[100dvh] w-full bg-neutral-950 flex flex-col items-center justify-center overflow-hidden p-0 touch-manipulation">
        <ImpulsePlayer trackId={dropTrackId} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center text-sm text-neutral-400">
        Loading storefront...
      </div>
    );
  }

    // 2. RENDER LABEL STOREFRONT FOR LABEL PROFILES OR ROOT LABEL SLUG
  const normCurrentSlug = normalizeHandle(targetArtistHandle || primarySlug);
  const normResolvedHandle = normalizeHandle(profile?.handle);
  const normResolvedArtistHandle = normalizeHandle(profile?.artist_handle);

  const isTargetingOwnerArtistHandle =
    Boolean(normCurrentSlug) &&
    Boolean(normResolvedArtistHandle) &&
    normCurrentSlug === normResolvedArtistHandle &&
    normResolvedArtistHandle !== normResolvedHandle;

  const isLabelStorefront =
    !forcePlayerView &&
    !isTargetingOwnerArtistHandle &&
    (profile?.tier === 'label' ||
      (!targetArtistHandle && Boolean(primarySlug)));

  if (isLabelStorefront) {
    return (
      <LabelStorefront
        profile={profile}
        tracks={tracks}
        labelHandle={primarySlug || profile?.handle || '2g-imprint'}
      />
    );
  }


  // 3. RENDER AUDIO PLAYER (INDIVIDUAL ARTIST OR FULL LABEL ROSTER)
  const isLabelRosterPlayer =
    forcePlayerView &&
    !isTargetingOwnerArtistHandle &&
    (profile?.tier === 'label' ||
      (!targetArtistHandle && Boolean(primarySlug)));

  const isSuperAdminAccount =
    Boolean(profile?.is_super_admin) ||
    normalizeHandle(profile?.email) === 'lakimgolden@gmail.com';

  const artistHandleToUse = isLabelRosterPlayer
    ? (profile?.display_name || profile?.handle || primarySlug)
    : (targetArtistHandle || primarySlug);
  const resolvedPlayerTier = isLabelRosterPlayer ? 'label' : (profile?.tier || 'artist');

  return (
    <div className="h-[100dvh] w-full bg-neutral-950 flex flex-col items-center justify-center overflow-hidden p-0 touch-manipulation">
      <AudioPlayer
        artistHandle={artistHandleToUse}
        initialTracks={tracks}
        tier={resolvedPlayerTier}
        showLabelPromoStrip={isSuperAdminAccount}
      />
    </div>
  );
}
