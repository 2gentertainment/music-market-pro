import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TIER_COMMISSION_RATES: Record<string, number> = {
  free: 0.15,   // 15% commission
  artist: 0.10, // 10% commission
  label: 0.05,  // 5% commission
};

function getTierCommissionRate(tier?: string | null): number {
  const normalized = (tier || 'free').toLowerCase();
  return TIER_COMMISSION_RATES[normalized] ?? TIER_COMMISSION_RATES.free;
}

export async function POST(req: Request) {

  try {
    const body = await req.json();
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const { items, buyerEmail } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided for checkout' }, { status: 400 });
    }

        // Sync store buyer to AWeber mailing list using dynamic Supabase token rotation and smart tagging
    if (buyerEmail) {
      try {
        // 1. Fetch live rotating tokens from Supabase
        const { data: tokenRecord, error: tokenFetchError } = await supabase
          .from('integration_tokens')
          .select('*')
          .eq('provider', 'aweber')
          .maybeSingle();

        if (tokenFetchError || !tokenRecord) {
          console.error('AWeber buyer sync skipped—no integration_tokens row:', tokenFetchError);
              } else {
          let accessToken = tokenRecord.access_token;
          let refreshToken = tokenRecord.refresh_token;

          const accountId = process.env.AWEBER_ACCOUNT_ID;
          const rawCustomerListId = process.env.AWEBER_CUSTOMER_LIST_ID || 'awlist6985219';
          const listId = rawCustomerListId.replace(/^awlist/i, '');
          const normalizedBuyerEmail = String(buyerEmail).trim().toLowerCase();

          const primaryItem = items[0] || {};
          const artistHandle = primaryItem.artistHandle || primaryItem.handle;

          const tags = ['2g-music-market', 'buyer'];
          if (artistHandle) tags.push(`artist-${artistHandle.toLowerCase()}`);
          if (primaryItem.itemType === 'album' && primaryItem.albumName) {
            tags.push(`album-${primaryItem.albumName.toLowerCase().replace(/\s+/g, '-')}`);
          } else if (primaryItem.title) {
            tags.push(`track-${primaryItem.title.toLowerCase().replace(/\s+/g, '-')}`);
          }

          const subscriberPayload = {
            email: normalizedBuyerEmail,
            name: 'Music Market Buyer',
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

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              accessToken = refreshData.access_token;
              refreshToken = refreshData.refresh_token || refreshToken;

              await supabase
                .from('integration_tokens')
                .update({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                  updated_at: new Date().toISOString(),
                })
                .eq('provider', 'aweber');

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
          }

          if (!aweberRes.ok && aweberRes.status !== 201) {
            const errBody = await aweberRes.text().catch(() => '');
            console.error(`AWeber customer list (${listId}) sync failed (${aweberRes.status}):`, errBody);
          }
        }

      } catch (aweberErr) {
        console.error('AWeber buyer sync error:', aweberErr);
      }
    }


    // Determine the primary artist for the items to check their tier and connected Stripe account
    const primaryItem = items[0];
    const artistHandle = primaryItem.artistHandle || primaryItem.handle;
    
        let connectedStripeAccountId: string | null = null;
    let commissionRate = TIER_COMMISSION_RATES.free; // Default to 15% free tier if unmapped

          if (artistHandle) {
      const { data: artistProfile } = await supabase
        .from('profiles')
        .select('tier, stripe_account_id')
        .or(`handle.eq.${artistHandle},artist_handle.eq.${artistHandle}`)
        .maybeSingle();

      if (artistProfile) {
        connectedStripeAccountId = artistProfile.stripe_account_id || null;
        commissionRate = getTierCommissionRate(artistProfile.tier);
      }
    }




    // Build dynamic Stripe line items from your database numeric prices
    let totalCents = 0;
    const lineItems = items.map((item: any) => {
      let unitCents = 0;
      if (item.itemType === 'album') {
        unitCents = Math.round(Number(item.price || 7.99) * 100);
        totalCents += unitCents;
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Album Bundle: ${item.albumName}`,
              description: `Full project master download from @${artistHandle || '2G Entertainment'}`,
            },
            unit_amount: unitCents,
          },
          quantity: 1,
        };
      }

      unitCents = Math.round(Number(item.price || 0.99) * 100);
      totalCents += unitCents;
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.title || 'Music Market Audio Master',
            description: 'High-Quality Audio Master Download',
          },
          unit_amount: unitCents,
        },
        quantity: 1,
      };
    });

        // Configure checkout session options
        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',

      customer_email: buyerEmail || undefined,
      allow_promotion_codes: true,
      line_items: lineItems,
      metadata: {
        artistHandle: artistHandle || '',
        trackId: primaryItem?.trackId ? String(primaryItem.trackId) : primaryItem?.id ? String(primaryItem.id) : '',
        trackIds: JSON.stringify(
          items.flatMap((it: any) =>
            Array.isArray(it.trackIds) && it.trackIds.length > 0
              ? it.trackIds.map(String)
              : it.trackId || it.id
              ? [String(it.trackId || it.id)]
              : []
          )
        ),
        itemType: primaryItem?.itemType === 'album' ? 'album' : 'single',
        albumName: primaryItem?.albumName || '',
      },
      success_url: `${appUrl}/vault?success=true`,
      cancel_url: `${appUrl}/`,
    };


      // Route payout to connected Stripe account and deduct tier-based commission (Free 15%, Artist 10%, Label 5%)
    if (connectedStripeAccountId) {
      const applicationFeeAmount = Math.round(totalCents * commissionRate);
      sessionConfig.payment_intent_data = {
        transfer_data: {
          destination: connectedStripeAccountId,
        },
        application_fee_amount: applicationFeeAmount,
      };
    }


    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });

  } catch (err: any) {
    console.error('Track Checkout Route Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to process track checkout' }, { status: 500 });
  }
}
