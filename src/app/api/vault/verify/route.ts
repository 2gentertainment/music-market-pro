import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('*')
      .ilike('buyer_email', normalizedEmail)
      .order('created_at', { ascending: false });

    if (error || !purchases || purchases.length === 0) {
      return NextResponse.json(
        { error: 'No purchases found for this email address.' },
        { status: 404 }
      );
    }

    const singleTrackIds = Array.from(
      new Set(
        purchases
          .filter((p) => p.item_type === 'single' && p.item_id)
          .map((p) => String(p.item_id).trim())
      )
    );

    const albumIdentifiers = Array.from(
      new Set(
        purchases
          .filter((p) => p.item_type === 'album' && p.item_id)
          .map((p) => String(p.item_id).trim().toLowerCase())
      )
    );

    const resolvedTracksMap = new Map<string, any>();

    if (singleTrackIds.length > 0) {
      const { data: singleTracks } = await supabase
        .from('tracks_pro')
        .select('*')
        .in('id', singleTrackIds)
        .is('deleted_at', null);

      (singleTracks || []).forEach((track) => {
        resolvedTracksMap.set(String(track.id), track);
      });
    }

    if (albumIdentifiers.length > 0) {
      const { data: allActiveTracks } = await supabase
        .from('tracks_pro')
        .select('*')
        .is('deleted_at', null)
        .order('album_order', { ascending: true, nullsFirst: false });

      (allActiveTracks || []).forEach((track) => {
        const matchesId = albumIdentifiers.includes(String(track.id).toLowerCase());
        const trackAlbums = track.album_name
          ? track.album_name.split(',').map((s: string) => s.trim().toLowerCase())
          : [];
        const matchesAlbumName = trackAlbums.some((alb: string) =>
          albumIdentifiers.includes(alb)
        );

        if (matchesId || matchesAlbumName) {
          resolvedTracksMap.set(String(track.id), track);
        }
      });
    }

    const purchasedTracks = Array.from(resolvedTracksMap.values());

    if (purchasedTracks.length === 0) {
      return NextResponse.json(
        { error: 'No downloadable tracks found for your purchases.' },
        { status: 404 }
      );
    }

    const artistHandles = Array.from(
      new Set(
        purchasedTracks
          .map((t) => String(t.artist_handle || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );

    const creatorTierMap = new Map<string, 'free' | 'artist' | 'label'>();

    if (artistHandles.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('handle, artist_handle, tier')
        .or(
          artistHandles
            .map(
              (h) =>
                `handle.ilike.${h.replace(/[,()]/g, '')},artist_handle.ilike.${h.replace(/[,()]/g, '')}`
            )
            .join(',')
        );

      (profiles || []).forEach((p: any) => {
        const resolvedTier: 'free' | 'artist' | 'label' =
          p.tier === 'label' || p.tier === 'artist' ? p.tier : 'free';
        if (p.handle) {
          creatorTierMap.set(String(p.handle).trim().toLowerCase(), resolvedTier);
        }
        if (p.artist_handle) {
          creatorTierMap.set(String(p.artist_handle).trim().toLowerCase(), resolvedTier);
        }
      });
    }

    const gatedTracks = purchasedTracks.map((track) => {
      const handleKey = String(track.artist_handle || '').trim().toLowerCase();
      const creatorTier = creatorTierMap.get(handleKey) || 'free';
      const hasPremiumMediaFeatures = creatorTier === 'artist' || creatorTier === 'label';

      return {
        ...track,
        creator_tier: creatorTier,
        can_stream: hasPremiumMediaFeatures,
        can_clip_ringtone: hasPremiumMediaFeatures,
        spotify_url: hasPremiumMediaFeatures ? track.spotify_url : null,
        apple_music_url: hasPremiumMediaFeatures ? track.apple_music_url : null,
        tidal_url: hasPremiumMediaFeatures ? track.tidal_url : null,
        youtube_url: hasPremiumMediaFeatures ? track.youtube_url : null,
        pandora_url: hasPremiumMediaFeatures ? track.pandora_url : null,
      };
    });

    return NextResponse.json({ success: true, tracks: gatedTracks });
  } catch (err: any) {
    console.error('Vault verification error:', err);
    return NextResponse.json(
      { error: 'Internal server error verifying vault access' },
      { status: 500 }
    );
  }
}
