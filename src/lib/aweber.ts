import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    'Warning: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in src/lib/aweber.ts'
  );
}

const supabaseAdmin = createClient(
  SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY || ''
);

export type AweberAudienceType = 'creator' | 'customer' | 'fan';

interface SyncCreatorToAweberInput {
  email: string;
  name?: string;
  tier?: string;
  handle?: string;
  audience?: AweberAudienceType;
}

function resolveNumericListId(audience: AweberAudienceType = 'creator'): string {
  const rawListId =
    audience === 'customer'
      ? process.env.AWEBER_CUSTOMER_LIST || 'awlist6985219'
      : audience === 'fan'
      ? process.env.AWEBER_FAN_LIST_ID || 'awlist6985948'
      : process.env.AWEBER_LIST_ID || 'awlist6985664';

  return rawListId.replace(/^awlist/i, '').trim();
}

export async function syncCreatorToAweber({
  email,
  name = '',
  tier,
  handle,
  audience = 'creator',
}: SyncCreatorToAweberInput) {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Email is required for AWeber sync');
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY for AWeber token lookup'
    );
  }

  const { data: tokenRecord, error: dbError } = await supabaseAdmin
    .from('integration_tokens')
    .select('*')
    .eq('provider', 'aweber')
    .single();

  if (dbError || !tokenRecord) {
    throw new Error(
      `AWeber tokens not found in integration_tokens table: ${dbError?.message || 'no row'}`
    );
  }

  let accessToken = tokenRecord.access_token;
  let refreshToken = tokenRecord.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error(
      'AWeber access_token or refresh_token is empty in integration_tokens'
    );
  }

  const accountId = process.env.AWEBER_ACCOUNT_ID?.trim();
  const listId = resolveNumericListId(audience);

  if (!accountId || !listId) {
    throw new Error(
      `Missing AWEBER_ACCOUNT_ID or list ID for audience "${audience}"`
    );
  }

  const tags: string[] = ['2g-music-market', audience];
  if (tier) tags.push(`tier-${tier.toLowerCase()}`);
  if (handle) tags.push(handle.trim().toLowerCase());

  const subscriberPayload: Record<string, any> = {
    email: cleanEmail,
    tags,
    update_existing: true,
  };

  if (name?.trim()) {
    subscriberPayload.name = name.trim();
  }

  const aweberUrl = `https://api.aweber.com/1.0/accounts/${accountId}/lists/${listId}/subscribers`;

  const postSubscriber = async (token: string) =>
    fetch(aweberUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(subscriberPayload),
    });

  let aweberRes = await postSubscriber(accessToken);

  if (aweberRes.status === 401) {
    const clientId = process.env.AWEBER_CLIENT_ID;
    const clientSecret = process.env.AWEBER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        'Missing AWEBER_CLIENT_ID or AWEBER_CLIENT_SECRET environment variables for token refresh'
      );
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64'
    );

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
      throw new Error(
        `AWeber token refresh failed (${refreshRes.status}): ${refreshErrText}`
      );
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
      console.error(
        'Failed to save refreshed AWeber token to Supabase:',
        tokenUpdateError.message
      );
    }

    aweberRes = await postSubscriber(accessToken);
  }

  if (!aweberRes.ok && aweberRes.status !== 201) {
    const rawErrText = await aweberRes.text().catch(() => '');
    const alreadySubscribed =
      aweberRes.status === 400 &&
      rawErrText.toLowerCase().includes('already subscribed');

    if (!alreadySubscribed) {
      throw new Error(
        `AWeber API Error (${aweberRes.status}) on list ${listId} for ${cleanEmail}: ${rawErrText}`
      );
    }
  }

  return { email: cleanEmail, listId, audience, tags };
}
