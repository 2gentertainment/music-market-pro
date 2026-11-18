import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Download token is required.' }, { status: 400 });
  }

  try {
    // 1. Look up the token in Supabase
    const { data: tokenData, error: tokenError } = await supabase
      .from('download_tokens')
      .select('*, orders(track_id, tracks(audio_file_url, title))')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: 'Invalid or expired download link.' }, { status: 404 });
    }

    // 2. Check Expiration (72-hour window)
    if (new Date() > new Date(tokenData.expires_at)) {
      return NextResponse.json({ error: 'This download link has expired (72-hour limit reached).' }, { status: 403 });
    }

    // 3. Check Download Limit
    if (tokenData.download_count >= tokenData.max_downloads) {
      return NextResponse.json({ error: 'Maximum download limit reached for this link.' }, { status: 403 });
    }

    // 4. Increment download count
    await supabase
      .from('download_tokens')
      .update({ download_count: tokenData.download_count + 1 })
      .eq('id', tokenData.id);

    // 5. Get the actual track file URL from the relation
    const track = tokenData.orders?.tracks;
    if (!track || !track.audio_file_url) {
      return NextResponse.json({ error: 'Associated audio file not found.' }, { status: 404 });
    }

    // Redirect the user directly to the secure file asset (or signed storage url)
    return NextResponse.redirect(track.audio_file_url);

  } catch (err: any) {
    console.error('Download routing error:', err);
    return NextResponse.json({ error: 'Internal server error processing download.' }, { status: 500 });
  }
}