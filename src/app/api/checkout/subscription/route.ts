import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const TIER_PRICES: Record<string, number> = {
  artist: 999, // $9.99 in cents
  label: 2999, // $29.99 in cents
};

export async function POST(request: Request) {
  try {
    const { userId, email, tier } = await request.json();

    if (!tier || !TIER_PRICES[tier]) {
      return NextResponse.json({ error: 'Invalid subscription tier selected' }, { status: 400 });
    }

    const priceAmount = TIER_PRICES[tier];
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      metadata: {
        user_id: userId,
        tier: tier,
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `2G Music Market - ${tierLabel} Tier`,
              description: `Monthly subscription to 2G Music Market ${tierLabel} plan.`,
            },
            unit_amount: priceAmount,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/signup`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Subscription Session Error:', error);
    return NextResponse.json({ error: error.message || 'Stripe Session Error' }, { status: 500 });
  }
}