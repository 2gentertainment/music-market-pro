// app/api/connect/onboard/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    // 1. Create express connected account for artist
    const account = await stripe.accounts.create({
      type: 'express',
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // 2. Create account onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_BASE_URL}/onboard/refresh`,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?connect=success`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url, accountId: account.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}