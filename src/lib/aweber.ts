import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in src/lib/aweber.ts');
}

const supabaseAdmin = createClient(
  SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY || ''
);

interface SyncCreatorToAweberInput {
  email: string;
  name?: string;
  tier?: string;
  handle?: string;
}

export async function syncCreatorToAweber({
  email,
  name = '',
  tier,
  handle,
}: SyncCreatorToAweberInput) {
  if (!email) {
    throw new Error('Email is required for AWeber sync');
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY for AWeber token lookup');
  }

  const { data: tokenRecord, error: dbError } = await supabaseAdmin
    .from('integration_tokens')
    .select('*')
    .eq('provider', 'aweber')
    .single();

  if (dbError || !tokenRecord) {
    throw new Error(`AWeber tokens not found in integration_tokens table: ${dbError?.message || 'no row'}`);
  }

  let accessToken = tokenRecord.access_token;
  let refreshToken = tokenRecord.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error('AWeber access_token or refresh_token is empty in integration_tokens');
  }

  const accountId = process.env.AWEBER_ACCOUNT_ID;
  const listId = (process.env.AWEBER_LIST_ID || 'awlist6985664').replace('awlist', '');

  if (!accountId || !listId) {
    throw new Error('Missing AWEBER_ACCOUNT_ID or AWEBER_LIST_ID environment variables');
  }

  const tags = ['2g-music-market', 'creator'];
  if (tier) tags.push(`tier-${tier.toLowerCase()}`);
  if (handle) tags.push(handle);

  const subscriberPayload = {
    email,
    name,
    tags,
    update_existing: true,
  };

  const aweberUrl = `https://api.aweber.com/1.0/accounts/${accountId}/lists/${listId}/subscribers`;

  let aweberRes = await fetch(aweberUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(subscriberPayload),
  });

    if (aweberRes.status === 401) {
    const clientId = process.env.AWEBER_CLIENT_ID;
    const clientSecret = process.env.AWEBER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Missing AWEBER_CLIENT_ID or AWEBER_CLIENT_SECRET environment variables for token refresh');
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');


    const refreshRes = await fetch('https://auth.aweber.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!refreshRes.ok) {
      const refreshErrText = await refreshRes.text().catch(() => '');
      throw new Error(`AWeber token refresh failed (${refreshRes.status}): ${refreshErrText}`);
    }

    const refreshData = await refreshRes.json();
    accessToken = refreshData.access_token;
    refreshToken = refreshData.refresh_token || refreshToken;

    if (!accessToken) {
      throw new Error('AWeber token refresh returned no access_token');
    }

    const { error: tokenUpdateError } = await supabaseAdmin
      .from('integration_tokens')
      .update({
        access_token: accessToken,
        refresh_token: refreshToken,
        updated_at: new Date().toISOString(),
      })
      .eq('provider', 'aweber');

    if (tokenUpdateError) {
      console.error('Failed to save refreshed AWeber token to Supabase:', tokenUpdateError.message);
    }

    aweberRes = await fetch(aweberUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(subscriberPayload),
    });
  }

  if (!aweberRes.ok && aweberRes.status !== 201) {
    const errorData = await aweberRes.json().catch(() => ({}));
    throw new Error(`AWeber API Error (${aweberRes.status}): ${JSON.stringify(errorData)}`);
  }

  return { email, tags };
}
