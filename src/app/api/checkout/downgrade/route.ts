import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chhwujiajdhaihupvuix.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: missing service role key.' },
        { status: 500 }
      );
    }

    const { accountId, handle, profileId, userId, email } = await req.json();
    const rawUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'http://localhost:3000';
    const appUrl = rawUrl.trim().replace(/\/+$/, '');


    let targetProfileId: string | null = null;

    // 1. Match by explicit profile/user ID
    const explicitId = profileId || userId;
    if (!targetProfileId && explicitId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', explicitId)
        .maybeSingle();
      if (data) targetProfileId = data.id;
    }

    // 2. Match by Stripe connected account ID
    if (!targetProfileId && accountId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('stripe_account_id', accountId)
        .maybeSingle();
      if (data) targetProfileId = data.id;
    }

       // 3. Match by handle or artist_handle (case-insensitive)
    if (!targetProfileId && handle) {
      const cleanHandle = String(handle).trim().replace(/[,()]/g, '');
      if (cleanHandle) {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .or(`handle.ilike.${cleanHandle},artist_handle.ilike.${cleanHandle}`)
          .maybeSingle();
        if (data) targetProfileId = data.id;
      }
    }


    // 4. Match by account email
    if (!targetProfileId && email) {
      const cleanEmail = String(email).trim().toLowerCase();
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle();
      if (data) targetProfileId = data.id;
    }

    if (!targetProfileId) {
      return NextResponse.json(
        { error: 'No matching profile found to downgrade.' },
        { status: 400 }
      );
    }

    // 5. Execute DB downgrade to free tier (keeps first_month_coupon_used intact)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ tier: 'free', updated_at: new Date().toISOString() })
      .eq('id', targetProfileId);

    if (updateError) {
      throw new Error(`Failed to update tier: ${updateError.message}`);
    }

    return NextResponse.json({ url: `${appUrl}/dashboard?success=true&tier=free` });
  } catch (error: any) {
    console.error('Downgrade Error:', error);
    return NextResponse.json({ error: error.message || 'Error processing downgrade' }, { status: 500 });
  }
}
