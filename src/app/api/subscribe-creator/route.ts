import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Server Client (using service role to bypass RLS for server-to-server sync)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const webhookSecret = request.headers.get('x-webhook-secret');
    if (process.env.WEBHOOK_SECRET && webhookSecret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, name, tier, handle } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // 1. Fetch current tokens from Supabase
    const { data: tokenRecord, error: dbError } = await supabase
      .from('integration_tokens')
      .select('*')
      .eq('provider', 'aweber')
      .single();

    if (dbError || !tokenRecord) {
      return NextResponse.json({ error: 'AWeber tokens not found in database' }, { status: 500 });
    }

    let accessToken = tokenRecord.access_token;
    let refreshToken = tokenRecord.refresh_token;

    const accountId = process.env.AWEBER_ACCOUNT_ID;
    const listId = process.env.AWEBER_LIST_ID?.replace('awlist', '');

    const tags = ['2g-music-market', 'creator'];
    if (tier) tags.push(`tier-${tier.toLowerCase()}`);
    if (handle) tags.push(handle);

    const subscriberPayload = { email, name: name || '', tags, update_existing: true };
    const aweberUrl = `https://api.aweber.com/1.0/accounts/${accountId}/lists/${listId}/subscribers`;

    // 2. Attempt AWeber API call
    let aweberRes = await fetch(aweberUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(subscriberPayload),
    });

    // 3. Handle Token Expiration & Rotation
    if (aweberRes.status === 401) {
      const refreshRes = await fetch('https://auth.aweber.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.AWEBER_CLIENT_ID || 'moj5CVeEMIYMAqtk0ZWeDMIdj7UAE2A1',
          client_secret: process.env.AWEBER_CLIENT_SECRET || 'zOgLeuFRyW7G2nrtS5beMSPIb9AZNovF',
          refresh_token: refreshToken,
        }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        accessToken = refreshData.access_token;
        refreshToken = refreshData.refresh_token; // Capture the new rotated refresh token!

        // Instantly save the new tokens back to Supabase
        await supabase
          .from('integration_tokens')
          .update({
            access_token: accessToken,
            refresh_token: refreshToken,
            updated_at: new Date().toISOString(),
          })
          .eq('provider', 'aweber');

        // Retry the subscriber request with the new access token
        aweberRes = await fetch(aweberUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(subscriberPayload),
        });
      }
    }

    if (aweberRes.status === 201 || aweberRes.ok) {
      return NextResponse.json({
        success: true,
        message: 'Creator synced to AWeber successfully with persistent token management',
        subscriber: email,
        tags,
      });
    }

    const errorData = await aweberRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: 'AWeber API Error', status: aweberRes.status, details: errorData },
      { status: aweberRes.status }
    );
  } catch (err: any) {
    console.error('Subscribe Creator Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
