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

    return NextResponse.json({ success: true, tracks: purchasedTracks });

  } catch (err: any) {
    console.error('Vault verification error:', err);
    return NextResponse.json({ error: 'Internal server error verifying vault access' }, { status: 500 });
  }
}
