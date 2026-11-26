import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import DynamicStorefrontRouter from './DynamicStorefrontRouter';

const FALLBACK_MUSIC_THUMBNAIL =
  'https://www.2g-ent.com/uploads/2/7/5/9/27593217/box-logo_orig.jpg';

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function resolveArtworkUrl(raw?: string | null): string {
  if (!raw || !raw.trim()) return FALLBACK_MUSIC_THUMBNAIL;
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  if (baseUrl) {
    const cleanPath = trimmed.replace(/^\/+/, '');
    const withBucket = cleanPath.startsWith('v2-cover-art/')
      ? cleanPath
      : `v2-cover-art/${cleanPath}`;
    return `${baseUrl}/storage/v1/object/public/${withBucket}`;
  }
  return FALLBACK_MUSIC_THUMBNAIL;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string | string[] }>;
  searchParams: Promise<{ drop?: string; track?: string; view?: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;

  const rawSlug = resolvedParams?.slug;
  const slugParts = Array.isArray(rawSlug)
    ? rawSlug.map((s) => decodeURIComponent(s).trim())
    : typeof rawSlug === 'string'
    ? [decodeURIComponent(rawSlug).trim()]
    : [];

  const primary = slugParts[0] || '';
  const secondary = slugParts[1] || '';
  const targetHandle =
    primary.toLowerCase() === 'workspace' ? secondary : primary || '2g-imprint';

  // 1. Track-specific ?drop= or ?track= share link
  const sharedTrackId = resolvedSearch?.drop || resolvedSearch?.track;
  if (sharedTrackId) {
    const { data: track } = await supabaseServer
      .from('tracks_pro')
      .select('title, artist_handle, artwork_url, artwork_file_path, album_name')
      .eq('id', sharedTrackId)
      .is('deleted_at', null)
      .maybeSingle();

    if (track) {
      const thumb = resolveArtworkUrl(track.artwork_url || track.artwork_file_path);
      const artistLabel = track.artist_handle || targetHandle;
      const title = `${track.title} — ${artistLabel} | Music Market Pro`;
      const description = track.album_name
        ? `Listen to "${track.title}" from ${track.album_name} by ${artistLabel} on Music Market Pro.`
        : `Listen to "${track.title}" by ${artistLabel} on Music Market Pro.`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: 'music.song',
          images: [{ url: thumb, width: 1200, height: 1200, alt: track.title }],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [thumb],
        },
      };
    }
  }

  // 2. Artist or Label storefront share link
  const safeLookup = targetHandle.replace(/[,()]/g, '');
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('id, handle, artist_handle, display_name, label_name, avatar_url, logo_url, tier')
    .or(`handle.ilike.${safeLookup},artist_handle.ilike.${safeLookup}`)
    .maybeSingle();

  const displayName =
    profile?.label_name || profile?.display_name || targetHandle || 'Music Market Pro';

  let lookupHandles = [
    safeLookup,
    safeLookup.toLowerCase(),
    profile?.handle,
    profile?.artist_handle,
  ].filter(Boolean) as string[];

  if (profile?.tier === 'label' && profile?.id) {
    const { data: roster } = await supabaseServer
      .from('profiles')
      .select('handle, artist_handle')
      .eq('parent_label_id', profile.id);
    if (roster) {
      lookupHandles.push(
        ...(roster.flatMap((r) => [r.handle, r.artist_handle]).filter(Boolean) as string[])
      );
    }
  }

  const expandedHandles = Array.from(
    new Set(lookupHandles.flatMap((h) => [h.trim(), h.trim().toLowerCase()]))
  );

  const { data: topTrack } = await supabaseServer
    .from('tracks_pro')
    .select('title, artwork_url, artwork_file_path')
    .eq('is_archived', false)
    .is('deleted_at', null)
    .in('artist_handle', expandedHandles)
    .order('track_order', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const thumbnail = resolveArtworkUrl(
    topTrack?.artwork_url ||
      topTrack?.artwork_file_path ||
      profile?.avatar_url ||
      profile?.logo_url ||
      FALLBACK_MUSIC_THUMBNAIL
  );

  const title = `${displayName} | Music Market Pro`;
  const description =
    profile?.tier === 'label'
      ? `Explore releases and artists from ${displayName} on Music Market Pro.`
      : `Stream and support ${displayName} directly on Music Market Pro.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: thumbnail, alt: displayName }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [thumbnail],
    },
  };
}

export default function Page() {
  return <DynamicStorefrontRouter />;
}
