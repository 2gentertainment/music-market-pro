import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chhwujiajdhaihupvuix.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_bHflg5jJHZfPzoOdsC5f_Q_H3YO4v3c';
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. API Route Stream Logger
export async function logTrackStream({
  trackId,
  durationSeconds,
  userId,
}: {
  trackId: string;
  durationSeconds: number;
  userId?: string;
}) {
  try {
    await fetch('/api/analytics/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId, durationSeconds, userId }),
    });
  } catch (error) {
    console.error('Failed to log stream analytics:', error);
  }
}

// 2. Direct Supabase Engagement Logger
export async function trackEngagementEvent(
  eventType: 'play' | 'fan_signup' | 'outbound_stream' | 'purchase_intent',
  trackId?: string,
  metadata?: Record<string, any>,
  artistHandle?: string
) {
  try {
    let visitorId = typeof window !== 'undefined' ? localStorage.getItem('2g_visitor_id') : null;
    if (!visitorId && typeof window !== 'undefined') {
      visitorId = 'v_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('2g_visitor_id', visitorId);
    }

    const resolvedHandle = artistHandle || metadata?.artist_handle || null;

    await _supabase.from('analytics_events_v2').insert([
      {
        event_type: eventType,
        track_id: trackId || null,
        artist_handle: resolvedHandle ? String(resolvedHandle).toLowerCase() : null,
        visitor_id: visitorId,
        metadata: metadata || null,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (err) {
    console.error(`Telemetry error (${eventType}):`, err);
  }
}


