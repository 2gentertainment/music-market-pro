'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AudioPlayer, { type DemoFeatureKey } from '@/components/AudioPlayer';
import { supabase as _supabase } from '@/utils/supabase';

const FEATURE_GUIDE: Record<
  DemoFeatureKey,
  { badge: string; title: string; summary: string }
> = {
  overview: {
    badge: 'Storefront Display Mode',
    title: 'Tap Any Storefront Control',
    summary:
      'Tap Become a Fan, Stream Now, Buy, Albums, Share, Search, or Playback Controls to see how each tool works for artists and labels.',
  },
  search: {
    badge: 'Catalog Discovery',
    title: 'Instant Track & Genre Search',
    summary:
      'Listeners can filter a creator’s catalog by song title, artist handle, or genre without leaving the storefront player.',
  },
  fan_signup: {
    badge: 'Owned Audience',
    title: 'Direct Fan List Capture',
    summary:
      'Visitors subscribe directly from the player so creators build an owned fan list for drops, shows, and releases.',
  },
  stream_links: {
    badge: 'DSP Routing',
    title: 'Multi-Platform Streaming Drawer',
    summary:
      'Routes listeners to Apple Music, Spotify, Tidal, YouTube, and Pandora while logging outbound stream events.',
  },
  buy_checkout: {
    badge: 'Direct Commerce',
    title: 'Single Master & Album Checkout',
    summary:
      'Launches Stripe checkout for individual tracks or full project bundles with direct creator payouts.',
  },
  albums_view: {
    badge: 'Project Sequencing',
    title: 'Tracks vs. Albums / Projects',
    summary:
      'Lets fans browse the full song list or switch into ordered project groupings and album tracklists.',
  },
  share_track: {
    badge: 'Viral Sharing',
    title: 'One-Tap Track Share Links',
    summary:
      'Copies a direct track link so listeners can share a specific song in texts or social feeds.',
  },
  playback_controls: {
    badge: 'Continuous Playback',
    title: 'Shuffle, Skip, Repeat & Lock Screen',
    summary:
      'Supports continuous queue playback, smart shuffle, track repeat, and lock-screen / control-center media controls.',
  },
};

function MarketContent() {
  const searchParams = useSearchParams();
  const artistHandle = searchParams.get('artist') || undefined;
  const [tracks, setTracks] = useState<any[]>([]);
  const [activeFeature, setActiveFeature] = useState<DemoFeatureKey>('overview');

  useEffect(() => {
    let cancelled = false;

    async function loadPreviewTracks() {
      let query = _supabase
        .from('tracks_pro')
        .select('*')
        .eq('is_archived', false)
        .is('deleted_at', null)
        .order('track_order', { ascending: true, nullsFirst: false });

      if (artistHandle?.trim()) {
        query = query.ilike('artist_handle', artistHandle.trim());
      }

      const { data, error } = await query.limit(25);
      if (cancelled) return;
      if (error) {
        console.error('Error loading market preview tracks:', error);
        return;
      }

      const v2Only = (data || []).filter(
        (t) => t.audio_file_path && !String(t.audio_file_path).includes('v1-legacy')
      );
      setTracks(v2Only);
    }

    loadPreviewTracks();
    return () => {
      cancelled = true;
    };
  }, [artistHandle]);

  const guide = FEATURE_GUIDE[activeFeature];

  const tutorialFooter = (
    <div className="bg-[#1b140c] border border-[#ff8c00]/45 rounded-xl px-3 py-2 text-left space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-wider text-[#ff8c00] bg-[#ff8c00]/15 px-2 py-0.5 rounded">
          {guide.badge}
        </span>
        {activeFeature !== 'overview' && (
          <button
            type="button"
            onClick={() => setActiveFeature('overview')}
            className="text-[10px] text-neutral-400 hover:text-white underline cursor-pointer"
          >
            Reset guide
          </button>
        )}
      </div>
      <p className="text-[11px] font-bold text-white leading-tight">{guide.title}</p>
      <p className="text-[10px] text-neutral-300 leading-snug">{guide.summary}</p>
    </div>
  );

  return (
    <main className="min-h-screen w-full bg-neutral-950 text-white flex flex-col items-center px-3 py-4 sm:px-6 sm:py-6 touch-manipulation selection:bg-[#ff8c00] selection:text-black">
      <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-3 mb-4">
        <Link
          href="/"
          className="text-xs font-bold text-neutral-400 hover:text-white transition-colors"
        >
          ← Back to Home
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-emerald-400">
            ● Storefront Preview &amp; Walkthrough
          </span>
          <Link
            href="/discover"
            className="text-xs font-extrabold bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 px-3 py-1.5 rounded-lg transition-colors"
          >
            Explore Discovery
          </Link>
        </div>
      </div>

      <div className="w-full flex justify-center">
        <AudioPlayer
          artistHandle={artistHandle}
          initialTracks={tracks.length > 0 ? tracks : undefined}
          tier="artist"
          demoMode={true}
          onDemoAction={setActiveFeature}
          demoFooterContent={tutorialFooter}
        />
      </div>
    </main>
  );
}

export default function MarketPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-neutral-950 text-neutral-400 flex items-center justify-center text-sm">
          Loading Market...
        </div>
      }
    >
      <MarketContent />
    </Suspense>
  );
}
