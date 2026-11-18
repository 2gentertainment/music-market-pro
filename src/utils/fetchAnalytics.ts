// utils/fetchAnalytics.ts
import { supabase } from '@/utils/supabase';

export interface TrackBreakdownMetric {
  plays: number;
  clickThroughs: number;
  revenue: number;
}

export async function getAnalyticsData(
  timeframe: 'today' | '7d' | '30d' | 'all',
  artistHandle?: string,
  isSuperAdmin: boolean = false
) {
  const now = new Date();
  let startDate = new Date(0); // Epoch for 'all'

  if (timeframe === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (timeframe === '7d') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (timeframe === '30d') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const isoStart = startDate.toISOString();

    // 1. Fetch Earnings (includes track_id for per-track revenue breakdown)
  let earningsQuery = supabase
    .from('artist_earnings')
    .select('id, track_id, net_amount, gross_amount, platform_fee, platform_commission, created_at, artist_handle')
    .gte('created_at', isoStart)
    .order('created_at', { ascending: false });


  if (artistHandle) {
    earningsQuery = earningsQuery.eq('artist_handle', artistHandle.toLowerCase());
  }

  const { data: earningsData } = await earningsQuery;

  // 2. Fetch Telemetry Events (Plays & Stream Click-Throughs)
  let telemetryQuery = supabase
    .from('analytics_events_v2')
    .select('event_type, track_id, artist_handle, visitor_id, metadata, created_at')
    .gte('created_at', isoStart);

  if (artistHandle) {
    telemetryQuery = telemetryQuery.eq('artist_handle', artistHandle.toLowerCase());
  }

  const { data: telemetryData } = await telemetryQuery;

  let totalGross = 0;
  let totalNet = 0;
  let totalPlatformCommission = 0;
  let totalPlays = 0;
  let totalClickThroughs = 0;

  const artistRevenueMap: Record<string, { artist_handle: string; total_revenue: number; total_sales: number }> = {};
  const trackBreakdown: Record<string, TrackBreakdownMetric> = {};

  function getOrCreateTrackMetric(trackId: string): TrackBreakdownMetric {
    const key = trackId.toLowerCase();
    if (!trackBreakdown[key]) {
      trackBreakdown[key] = { plays: 0, clickThroughs: 0, revenue: 0 };
    }
    return trackBreakdown[key];
  }

    earningsData?.forEach((row) => {
    const gross = Number(row.gross_amount || 0);
    const fee = Number(row.platform_fee || row.platform_commission || 0);
    const net = Number(row.net_amount || (gross - fee));


    totalGross += gross;
    totalNet += net;
    totalPlatformCommission += fee;

    if (row.track_id) {
      const metric = getOrCreateTrackMetric(String(row.track_id));
      // Use net for creator/track view, gross for super-admin global view
      metric.revenue += isSuperAdmin && !artistHandle ? gross : net;
    }

    if (isSuperAdmin && !artistHandle && row.artist_handle) {
      const handle = row.artist_handle.toLowerCase();
      if (!artistRevenueMap[handle]) {
        artistRevenueMap[handle] = { artist_handle: handle, total_revenue: 0, total_sales: 0 };
      }
      artistRevenueMap[handle].total_revenue += gross;
      artistRevenueMap[handle].total_sales += 1;
    }
  });

  telemetryData?.forEach((ev) => {
    const trackKey = ev.track_id ? String(ev.track_id).toLowerCase() : null;

    if (ev.event_type === 'play') {
      totalPlays++;
      if (trackKey) {
        getOrCreateTrackMetric(trackKey).plays++;
      }
    }

        if (
      ev.event_type === 'outbound_stream' ||
      ev.event_type === 'stream_click_through' ||
      ev.event_type === 'click_through' ||
      ev.event_type === 'dsp_redirect'
    ) {
      totalClickThroughs++;
      if (trackKey) {
        getOrCreateTrackMetric(trackKey).clickThroughs++;
      }
    }

  });

  // 3. Super-Admin Only Telemetry
  let tierCounts = { free: 0, artist: 0, label: 0 };
  let commissionAuditLog: typeof earningsData = [];
  let topArtistsLeaderboard: { artist_handle: string; total_revenue: number; total_sales: number }[] = [];

  if (isSuperAdmin && !artistHandle) {
    const { data: profilesData } = await supabase.from('profiles').select('tier');
    profilesData?.forEach((profile) => {
      const tier = profile.tier?.toLowerCase() || 'free';
      if (tier === 'free') tierCounts.free++;
      else if (tier === 'artist') tierCounts.artist++;
      else if (tier === 'label') tierCounts.label++;
    });

    commissionAuditLog = (earningsData || []).slice(0, 25);

    topArtistsLeaderboard = Object.values(artistRevenueMap)
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 5);
  }

  return {
    totalGross,
    totalNet,
    totalPlatformCommission,
    totalPlays,
    totalClickThroughs,
    salesCount: earningsData?.length || 0,
    trackBreakdown,
    tierCounts,
    commissionAuditLog,
    topArtistsLeaderboard,
  };
}
