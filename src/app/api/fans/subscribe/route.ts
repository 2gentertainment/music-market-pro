import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const TOKEN_ROW_ID = 'default';
const rawListId = process.env.AWEBER_FAN_LIST_ID || '6985948';
const FAN_LIST_ID = rawListId.replace(/^awlist/i, '');

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = rawKey?.startsWith('sb_secret_') ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : rawKey;

  if (!url || !key) {
    throw new Error('Missing Supabase URL or key.');
  }

  return createClient(url, key);
}

async function getTokens(supabase: SupabaseClient): Promise<TokenPair | null> {
  const { data } = await supabase
    .from('aweber_tokens')
    .select('access_token, refresh_token')
    .eq('id', TOKEN_ROW_ID)
    .maybeSingle();

  if (data?.access_token && data?.refresh_token) {
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  if (process.env.AWEBER_ACCESS_TOKEN && process.env.AWEBER_REFRESH_TOKEN) {
    return {
      accessToken: process.env.AWEBER_ACCESS_TOKEN,
      refreshToken: process.env.AWEBER_REFRESH_TOKEN,
    };
  }

  return null;
}

async function refreshTokens(supabase: SupabaseClient, refreshToken: string): Promise<TokenPair | null> {
  const clientId = process.env.AWEBER_CLIENT_ID;
  const clientSecret = process.env.AWEBER_CLIENT_SECRET;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('AWeber refresh skipped—missing client credentials or refresh token.');
    return null;
  }

  const res = await fetch('https://auth.aweber.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  const rawBody = await res.text();

  if (!res.ok) {
    console.error('AWeber refresh endpoint error:', res.status, rawBody);
    return null;
  }

  let json: { access_token?: string; refresh_token?: string; expires_in?: number };
  try {
    json = JSON.parse(rawBody);
  } catch {
    console.error('Could not parse AWeber refresh JSON:', rawBody);
    return null;
  }

  if (!json.access_token) {
    console.error('AWeber refresh response missing access_token:', json);
    return null;
  }

  const nextPair: TokenPair = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
  };

  const { error: tokenSaveError } = await supabase.from('aweber_tokens').upsert(
    {
      id: TOKEN_ROW_ID,
      access_token: nextPair.accessToken,
      refresh_token: nextPair.refreshToken,
      expires_at: new Date(Date.now() + Number(json.expires_in || 7200) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (tokenSaveError) {
    console.error('Failed saving refreshed AWeber token to Supabase:', tokenSaveError);
  }

  return nextPair;
}

async function sendToAweber(
  accountId: string,
  accessToken: string,
  body: { email: string; tags: string[]; update_existing: boolean }
) {
  return fetch(`https://api.aweber.com/1.0/accounts/${accountId}/lists/${FAN_LIST_ID}/subscribers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json();

    const email = String(body.email || '').trim().toLowerCase();
    const artistHandle = String(body.artistHandle || 'music-market').trim().toLowerCase();
    const sourceGenre = body.sourceGenre ? String(body.sourceGenre).trim() : 'Untagged';
    const sourceTrackId = body.sourceTrackId ? String(body.sourceTrackId) : null;
    const sourceTrackTitle = body.sourceTrackTitle ? String(body.sourceTrackTitle) : null;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const { error: dbError } = await supabase
      .from('artist_fans')
      .insert({
        artist_handle: artistHandle,
        email,
        source_genre: sourceGenre,
        source_track_id: sourceTrackId,
        source_track_title: sourceTrackTitle,
      });

    if (dbError && dbError.code !== '23505') {
      console.error('Supabase fan insert error:', dbError);
      return NextResponse.json({ error: 'Could not save subscription.' }, { status: 500 });
    }

    const accountId = process.env.AWEBER_ACCOUNT_ID;
    let tokens = await getTokens(supabase);

    if (accountId && tokens?.accessToken) {
      const genreSlug = sourceGenre
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const tags = [
        'music-market-fan',
        `artist:${artistHandle}`,
        genreSlug ? `genre:${genreSlug}` : '',
      ].filter(Boolean);
      const payload = { email, tags, update_existing: true };

      let res = await sendToAweber(accountId, tokens.accessToken, payload);

      if (res.status === 401 && tokens.refreshToken) {
        const refreshed = await refreshTokens(supabase, tokens.refreshToken);
        if (refreshed) {
          tokens = refreshed;
          res = await sendToAweber(accountId, tokens.accessToken, payload);
        }
      }

      if (!res.ok) {
        const text = await res.text();
        console.error('AWeber fan list sync error:', res.status, text);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Fan subscribe route error:', err);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
