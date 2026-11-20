import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { syncCreatorToAweber } from '@/lib/aweber';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is missing in api/checkout/signup/route.ts');
}

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

        const { tier, email, handle, handleName, fullName, phoneNumber, userId } = await req.json();
    const resolvedHandle = (handle || handleName || '').trim();

    if (!tier || !['artist', 'label'].includes(tier)) {
      return NextResponse.json(
        { error: 'A valid paid tier (artist or label) is required.' },
        { status: 400 }
      );
    }

    const rawUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'http://localhost:3000';
    const appUrl = rawUrl.trim().replace(/\/+$/, '');
    const priceAmount = tier === 'label' ? 2999 : 999;
    const tierTitle = tier === 'label' ? 'Label Executive Tier' : 'Independent Artist Tier';
    const commissionRate = tier === 'label' ? '0.05' : '0.1';

    // Resolve profileId if available
    let profileId: string = userId || '';
    if (!profileId && resolvedHandle) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('handle', resolvedHandle)
        .maybeSingle();
      if (data?.id) {
        profileId = data.id;
      }
    }


       const session = await stripe.checkout.sessions.create({
      customer_email: email || undefined,

      line_items: [
        {
          price_data: {
            currency: 'usd',
                       product_data: {
              name: `Music Market Pro - ${tierTitle}`,
              description: `Monthly creator subscription unlocking full catalog, direct payouts, and ${tier === 'label' ? '5%' : '10%'} platform commission.`,
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
      subscription_data: {
        metadata: {
          profileId,
          customHandle: resolvedHandle,
          tier,
        },
      },
      success_url: `${appUrl}/dashboard?success=true&tier=${tier}${profileId ? `&profile_id=${encodeURIComponent(profileId)}` : ''}`,
      cancel_url: `${appUrl}/?signup=cancelled`,
      metadata: {

        flow: 'initial_signup',
        profileId,
        tierSignup: tier,
        commissionRate,
        customHandle: resolvedHandle,
        fullName: fullName || '',
        phoneNumber: phoneNumber || '',
      },

    });

    // Sync paid signup creator to AWeber when an email is present
    if (email) {
      try {
        await syncCreatorToAweber({
          email,
          name: fullName || handle || '',
          tier,
          handle: handle || undefined,
        });
      } catch (aweberErr) {
        console.error('AWeber sync warning (paid signup checkout):', aweberErr);
      }
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Signup Checkout Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error creating signup checkout session.' },
      { status: 500 }
    );
  }
}
