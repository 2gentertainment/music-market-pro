// src/app/api/connect/onboard/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, stageName, fullName } = body;

    // 1. Create Express connected account using Accounts v2 with Stripe handling losses
    const account = await stripe.v2.core.accounts.create({
      contact_email: email,
      display_name: stageName || fullName || email,
      identity: {
        country: 'us',
      },
      dashboard: 'express',
      defaults: {
        responsibilities: {
          fees_collector: 'stripe',
          losses_collector: 'stripe',
        },
      },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { requested: true },
          },
        },
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { requested: true },
            },
          },
        },
      },
    });

    // 2. Create Accounts v2 onboarding link
    const accountLink = await stripe.v2.core.accountLinks.create({
      account: account.id,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          refresh_url: `${process.env.NEXT_PUBLIC_BASE_URL}/onboard/refresh`,
          return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?connect=success`,
        },
      },
    });

    return NextResponse.json({ url: accountLink.url, accountId: account.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
