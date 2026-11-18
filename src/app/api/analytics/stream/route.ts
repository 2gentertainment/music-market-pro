import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { trackId, durationSeconds, userId } = await req.json();

    if (!trackId || typeof durationSeconds !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { error } = await supabase.from('stream_logs').insert({
      track_id: trackId,
      user_id: userId || null,
      duration_seconds: durationSeconds,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Stream logging error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}