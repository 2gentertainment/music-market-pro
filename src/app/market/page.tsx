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
    title: 'Tap a Song to Play or Tap Any Button to Preview',
    summary:
      'Tap tracks to hear audio play live, and tap any button on the player to see what that feature does on a live store.',
  },
  search: {
    badge: 'Catalog Search',
    title: 'Search Tracks, Artists & Genres',
    summary:
      'Lets visitors search through a creator’s songs by title, artist handle, or genre right inside the player.',
  },
  fan_signup: {
    badge: 'Fan Capture',
    title: 'Become a Fan Email Box',
    summary:
      'Opens an inline email signup so fans can join an artist or label’s list directly from the storefront.',
  },
  stream_links: {
    badge: 'Streaming Links',
    title: 'Stream Now DSP Drawer',
    summary:
      'Opens a drawer with the creator’s streaming links (Apple Music, Spotify, Tidal, YouTube, Pandora) and logs stream clicks.',
  },
  buy_checkout: {
    badge: 'Direct Sales',
    title: 'Buy Track / Project Checkout',
    summary:
      'Starts checkout so fans can buy singles & albums directly. Fans who purchase get access to song download(s), stream links & song ringtones.',
  },
  albums_view: {
    badge: 'Projects & Albums',
    title: 'Browse Artist Projects & Albums',
    summary:
      'Once an artist handle is selected, if that artist has albums/projects, listeners can open their project list to play a full release in order.',
  },
  share_track: {
    badge: 'Share Link',
    title: 'Copy Direct Track Link',
    summary:
      'Copies a shareable link for that specific song so fans can send it in messages or post it.',
  },
  playback_controls: {
    badge: 'Playback Controls',
    title: 'Shuffle, Skip, Play/Pause & Repeat',
    summary:
      'Controls queue order, track skipping, play/pause, and repeat while syncing lock-screen / control-center media controls.',
  },
};

function MarketContent() {
  const searchParams = useSearchParams();
  const artistHandle = searchParams.get('artist') || undefined;
  const [tracks, setTracks] = useState<any[]>([]);
  const [activeFeature, setActiveFeature] = useState<DemoFeatureKey>('overview');
  const [pulseKey, setPulseKey] = useState<number>(0);

  const handleFeatureSelect = (feature: DemoFeatureKey) => {
    setActiveFeature(feature);
    setPulseKey((prev) => prev + 1);
  };

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
    <div
      key={pulseKey}
      className="market-guide-pop bg-[#1b140c] border border-[#ff8c00]/55 rounded-xl px-3 py-2 text-left space-y-0.5 shadow-[0_0_20px_rgba(255,140,0,0.16)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-wider text-[#ff8c00] bg-[#ff8c00]/15 px-2 py-0.5 rounded">
          {guide.badge}
        </span>
        {activeFeature !== 'overview' && (
          <button
            type="button"
            onClick={() => handleFeatureSelect('overview')}
            className="text-[10px] text-neutral-400 hover:text-white underline cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
      <p className="text-[11px] font-bold text-white leading-tight">{guide.title}</p>
      <p className="text-[10px] text-neutral-300 leading-snug">{guide.summary}</p>
    </div>
  );

  return (
    <main className="h-[100dvh] w-full bg-neutral-950 text-white flex flex-col items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3 overflow-hidden touch-manipulation selection:bg-[#ff8c00] selection:text-black">
      <style jsx>{`
        @keyframes guidePop {
          0% {
            opacity: 0.35;
            transform: translateY(6px) scale(0.985);
          }
          60% {
            opacity: 1;
            transform: translateY(-1px) scale(1.008);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .market-guide-pop {
          animation: guidePop 0.32s cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>

      <div className="w-full max-w-[480px] flex items-center justify-between gap-2 flex-shrink-0 mb-1.5">
        <Link
          href="/"
          className="text-xs font-bold text-neutral-400 hover:text-white transition-colors"
        >
          ← Back to Home
        </Link>

        <span className="text-[11px] font-bold text-emerald-400">
          ● Interactive Feature Guide
        </span>
      </div>

      <div className="w-full flex-1 min-h-0 flex justify-center items-center">
        <AudioPlayer
          artistHandle={
            artistHandle || (!artistHandle && tracks.length > 0 ? 'Label Roster' : undefined)
          }
          initialTracks={tracks.length > 0 ? tracks : undefined}
          tier={artistHandle ? 'artist' : 'label'}
          demoMode={true}
          demoIntercept={true}
          onDemoAction={handleFeatureSelect}
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
        <div className="h-[100dvh] w-full bg-neutral-950 text-neutral-400 flex items-center justify-center text-sm">
          Loading Market...
        </div>
      }
    >
      <MarketContent />
    </Suspense>
  );
}
