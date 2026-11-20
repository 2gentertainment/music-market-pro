import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);


export async function POST(req: Request) {
  try {
    const { tier, accountId, handle, profileId } = await req.json();


    if (!tier) {
      return NextResponse.json({ error: 'Tier selection is required' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Resolve target profile without falling back to an arbitrary oldest row
    let profile: {
      id: string;
      tier?: string | null;
      first_month_coupon_used?: boolean | null;
    } | null = null;

    if (profileId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, tier, first_month_coupon_used')
        .eq('id', profileId)
        .maybeSingle();
      profile = data;
    } else if (accountId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, tier, first_month_coupon_used')
        .eq('stripe_account_id', accountId)
        .maybeSingle();
      profile = data;
    } else if (handle) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, tier, first_month_coupon_used')
        .eq('handle', handle)
        .maybeSingle();
      profile = data;
    }

      const alreadyUsedCoupon = Boolean(profile?.first_month_coupon_used);

    // PAID TIERS (Artist or Label Upgrades/Cross-grades via Stripe)
    const priceAmount = tier === 'label' ? 2999 : 999;
    const tierTitle = tier === 'label' ? 'Label Executive Tier' : 'Independent Artist Tier';

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [

        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Music Market Pro - ${tierTitle}`,
              description: 'Monthly creator subscription unlocking unlimited uploads and direct payouts.',
            },
            unit_amount: priceAmount,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
            mode: 'subscription',
      allow_promotion_codes: !alreadyUsedCoupon,
      subscription_data: {
        metadata: {
          profileId: profile?.id || profileId || '',
          tier,
          stripeAccountId: accountId || '',
          customHandle: handle || '',
        },
      },
      success_url: `${appUrl}/dashboard?success=true&tier=${tier}`,

      cancel_url: `${appUrl}/upgrade`,
      metadata: {
        profileId: profile?.id || profileId || '',
        tierUpgrade: tier,
        stripeAccountId: accountId || '',
        customHandle: handle || '',
      },
    };


    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Tier Change Checkout Error:', error);
    return NextResponse.json({ error: error.message || 'Error processing tier change' }, { status: 500 });
  }
}
