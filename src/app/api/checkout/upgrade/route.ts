import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chhwujiajdhaihupvuix.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Optional: map a promo code string to a Stripe Coupon ID in env/config
const VALID_FIRST_MONTH_COUPONS: Record<string, string | undefined> = {
  FIRSTMONTH: process.env.STRIPE_FIRST_MONTH_COUPON_ID,
};

export async function POST(req: Request) {
  try {
    const { tier, accountId, handle, profileId, couponCode } = await req.json();

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

    const normalizedCode = typeof couponCode === 'string' ? couponCode.trim().toUpperCase() : '';
    const alreadyUsedCoupon = Boolean(profile?.first_month_coupon_used);

    if (normalizedCode && alreadyUsedCoupon) {
      return NextResponse.json(
        { error: 'Your account has already used its one-time first-month coupon.' },
        { status: 400 }
      );
    }

    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    let appliedCouponCode = '';

    if (normalizedCode && !alreadyUsedCoupon) {
      const stripeCouponId = VALID_FIRST_MONTH_COUPONS[normalizedCode];
      if (!stripeCouponId) {
        return NextResponse.json(
          { error: 'Invalid or expired first-month coupon code.' },
          { status: 400 }
        );
      }
      discounts = [{ coupon: stripeCouponId }];
      appliedCouponCode = normalizedCode;
    }

    // PAID TIERS (Artist or Label Upgrades/Cross-grades via Stripe)
    const priceAmount = tier === 'label' ? 2999 : 999;
    const tierTitle = tier === 'label' ? 'Label Executive Tier' : 'Independent Artist Tier';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
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
      success_url: `${appUrl}/dashboard?success=true&tier=${tier}`,
      cancel_url: `${appUrl}/upgrade`,
      metadata: {
        profileId: profile?.id || profileId || '',
        tierUpgrade: tier,
        stripeAccountId: accountId || '',
        customHandle: handle || '',
        firstMonthCouponCode: appliedCouponCode,
      },
    };

    // Stripe Checkout does not allow both `discounts` and `allow_promotion_codes` at once
    if (discounts) {
      sessionParams.discounts = discounts;
    } else if (!alreadyUsedCoupon) {
      sessionParams.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Tier Change Checkout Error:', error);
    return NextResponse.json({ error: error.message || 'Error processing tier change' }, { status: 500 });
  }
}
