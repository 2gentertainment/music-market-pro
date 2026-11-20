import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function findStripeCustomerId(
  email?: string | null,
  profileId?: string | null,
  handle?: string | null
): Promise<string | null> {
  if (email) {
    const customers = await stripe.customers.list({ email: email.trim().toLowerCase(), limit: 5 });
    if (customers.data.length > 0) {
      return customers.data[0].id;
    }
  }

  // Fallback: search recent subscriptions by metadata if no customer email matched
  const subs = await stripe.subscriptions.list({ limit: 50, status: 'all' });
  const matchedSub = subs.data.find((s) => {
    const meta = s.metadata || {};
    return (
      (profileId && (meta.profileId === profileId || meta.userId === profileId)) ||
      (handle &&
        (meta.customHandle?.toLowerCase() === handle.trim().toLowerCase() ||
          meta.handleName?.toLowerCase() === handle.trim().toLowerCase()))
    );
  });

  if (matchedSub) {
    return typeof matchedSub.customer === 'string'
      ? matchedSub.customer
      : matchedSub.customer.id;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: missing service role key.' },
        { status: 500 }
      );
    }

    const { accountId, handle, profileId, userId, email, targetTier } = await req.json();
    const rawUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'http://localhost:3000';
    const appUrl = rawUrl.trim().replace(/\/+$/, '');

    const requestedTargetTier = (targetTier || 'free').toLowerCase(); // 'free' or 'artist'

    let targetProfile: {
      id: string;
      email?: string | null;
      handle?: string | null;
      artist_handle?: string | null;
      tier?: string | null;
    } | null = null;

    // 1. Match by explicit profile/user ID
    const explicitId = profileId || userId;
    if (!targetProfile && explicitId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, email, handle, artist_handle, tier')
        .eq('id', explicitId)
        .maybeSingle();
      if (data) targetProfile = data;
    }

    // 2. Match by Stripe connected account ID
    if (!targetProfile && accountId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, email, handle, artist_handle, tier')
        .eq('stripe_account_id', accountId)
        .maybeSingle();
      if (data) targetProfile = data;
    }

    // 3. Match by handle or artist_handle (case-insensitive)
    if (!targetProfile && handle) {
      const cleanHandle = String(handle).trim().replace(/[,()]/g, '');
      if (cleanHandle) {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('id, email, handle, artist_handle, tier')
          .or(`handle.ilike.${cleanHandle},artist_handle.ilike.${cleanHandle}`)
          .maybeSingle();
        if (data) targetProfile = data;
      }
    }

    // 4. Match by account email
    if (!targetProfile && email) {
      const cleanEmail = String(email).trim().toLowerCase();
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, email, handle, artist_handle, tier')
        .ilike('email', cleanEmail)
        .maybeSingle();
      if (data) targetProfile = data;
    }

    if (!targetProfile) {
      return NextResponse.json(
        { error: 'No matching profile found to downgrade.' },
        { status: 400 }
      );
    }

    const customerId = await findStripeCustomerId(
      targetProfile.email || email,
      targetProfile.id,
      targetProfile.artist_handle || targetProfile.handle || handle
    );

    let activeSub: Stripe.Subscription | null = null;
    if (customerId) {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      });
      activeSub =
        subs.data.find((s) => s.status === 'active' || s.status === 'trialing') || null;
    }

    // -------------------------------------------------------------
    // Path A: Label -> Artist (Swap subscription item price to Artist)
    // -------------------------------------------------------------
         if (requestedTargetTier === 'artist') {
      const artistPriceId = process.env.STRIPE_ARTIST_PRICE_ID;

      if (activeSub && activeSub.items.data.length > 0) {
        const primaryItem = activeSub.items.data[0];
        let artistItemUpdate: Stripe.SubscriptionUpdateParams.Item;

        if (artistPriceId) {
          artistItemUpdate = { id: primaryItem.id, price: artistPriceId };
        } else {
          let artistProductId = process.env.STRIPE_ARTIST_PRODUCT_ID || '';

          if (!artistProductId) {
            const products = await stripe.products.list({ limit: 20 });
            const existingProduct = products.data.find(
              (p) => p.active && p.name === 'Music Market Pro - Independent Artist Tier'
            );

            if (existingProduct) {
              artistProductId = existingProduct.id;
            } else {
              const createdProduct = await stripe.products.create({
                name: 'Music Market Pro - Independent Artist Tier',
                description: 'Monthly creator subscription unlocking unlimited uploads and direct payouts.',
              });
              artistProductId = createdProduct.id;
            }
          }

          artistItemUpdate = {
            id: primaryItem.id,
            price_data: {
              currency: 'usd',
              product: artistProductId,
              unit_amount: 999,
              recurring: {
                interval: 'month',
              },
            },
          };
        }

        await stripe.subscriptions.update(activeSub.id, {
          cancel_at_period_end: false,
          proration_behavior: 'none', // Switches at next billing cycle so current paid period finishes cleanly
          items: [artistItemUpdate],
          metadata: {
            ...(activeSub.metadata || {}),
            profileId: targetProfile.id,
            tier: 'artist',
          },
        });



             // Keep 'label' until period ends if desired, or update via customer.subscription.updated webhook
        return NextResponse.json({
          url: `${appUrl}/dashboard?success=true&tier=label&scheduled=artist`,
          periodEnd: activeSub.items.data[0]?.current_period_end ?? null,
        });
      }
    }

    // -------------------------------------------------------------
    // Path B: Paid -> Free (Schedule cancellation at period end)
    // -------------------------------------------------------------
    if (activeSub) {
      await stripe.subscriptions.update(activeSub.id, {
        cancel_at_period_end: true,
        metadata: {
          ...(activeSub.metadata || {}),
          profileId: targetProfile.id,
        },
      });

      // User keeps paid access until current_period_end; webhook sets tier = 'free' on customer.subscription.deleted
      return NextResponse.json({
        url: `${appUrl}/dashboard?success=true&tier=${targetProfile.tier || 'free'}&cancel_at_period_end=true`,
        periodEnd: activeSub.items.data[0]?.current_period_end ?? null,
      });
    }


    // Fallback when there is no active Stripe subscription (e.g., already free/dev test)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ tier: 'free', updated_at: new Date().toISOString() })
      .eq('id', targetProfile.id);

    if (updateError) {
      throw new Error(`Failed to update tier: ${updateError.message}`);
    }

    return NextResponse.json({ url: `${appUrl}/dashboard?success=true&tier=free` });
  } catch (error: any) {
    console.error('Downgrade Error:', error);
    return NextResponse.json({ error: error.message || 'Error processing downgrade' }, { status: 500 });
  }
}
