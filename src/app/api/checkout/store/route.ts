import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { syncCreatorToAweber } from '@/lib/aweber';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COMMISSION_RATES: Record<string, number> = {
  free: 0.15,   // 15% platform commission
  artist: 0.10, // 10% platform commission
  label: 0.05,  // 5% platform commission
};

function getCommissionRate(tier?: string): number {
  const normalized = (tier || 'free').toLowerCase();
  return COMMISSION_RATES[normalized] ?? COMMISSION_RATES.free;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, tier, handleName, fullName, phoneNumber, userId } = body;

    // 1. Sanitize base application URL cleanly
    const rawUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'http://localhost:3000';
    const appUrl = rawUrl.trim().replace(/\/+$/, '');

    const normalizedTier = (tier || 'free').toLowerCase();
    const commissionRate = getCommissionRate(normalizedTier);

    // 2. Free tier onboarding path
    if (normalizedTier === 'free') {
      if (!email) {
        return NextResponse.json({ error: 'Email is required for onboarding' }, { status: 400 });
      }

      let resolvedUserId = userId;

      // Ensure a Supabase Auth user exists if password is provided or create one automatically
      if (!resolvedUserId) {
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (existingProfile?.id) {
          resolvedUserId = existingProfile.id;
        } else {
          const tempPassword = password || Math.random().toString(36).slice(-8) + 'Aa1!';
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: fullName, phone: phoneNumber },
          });

          if (!createError && newUser?.user) {
            resolvedUserId = newUser.user.id;
          }
        }
      }

      const emailHandle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueHandle = handleName
        ? handleName.toLowerCase().replace(/[^a-z0-9]/g, '-')
        : `${emailHandle}-${Math.floor(1000 + Math.random() * 9000)}`;
      const artistProfileUrl = `${appUrl}/artist/${uniqueHandle}`;

      // 3. Perform synchronized schema upsert (tier-based commission rate derived dynamically)
      const profilePayload: Record<string, any> = {
        email,
        handle: uniqueHandle,
        name: fullName || emailHandle,
        full_name: fullName || emailHandle,
        full_legal_name: fullName || emailHandle,
        phone_number: phoneNumber || '',
        tier: normalizedTier,
        profile_url: artistProfileUrl,
        updated_at: new Date().toISOString(),
      };

      if (resolvedUserId) {
        profilePayload.id = resolvedUserId;
      }

      const { data: profileData, error: dbError } = await supabaseAdmin
        .from('profiles')
        .upsert(profilePayload, { onConflict: resolvedUserId ? 'id' : 'email' })
        .select()
        .maybeSingle();

      if (dbError) {
        console.error('Supabase Profile Provision Error in Checkout Route:', dbError.message);
      }

      try {
        await syncCreatorToAweber({
          email,
          name: fullName || handleName || emailHandle,
          tier: normalizedTier,
          handle: uniqueHandle,
        });
      } catch (aweberErr) {
        console.error('AWeber sync warning (homepage signup):', aweberErr);
      }

      const finalUserId = profileData?.id || resolvedUserId;

      // 4. Provision Stripe Express Account via Accounts v2 (Application responsibility model)
      const account = await stripe.v2.core.accounts.create({
        contact_email: email,
        display_name: handleName || fullName || emailHandle,
        identity: {
          country: 'us',
          entity_type: 'individual',
        },
        dashboard: 'express',
        defaults: {
          responsibilities: {
            fees_collector: 'application',
            losses_collector: 'application',
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
        metadata: {
          supabaseUserId: finalUserId || 'pending_auth',
          handle: uniqueHandle,
          tier: normalizedTier,
          commissionRate: String(commissionRate),
        },
      });

      // 5. Update profile immediately with generated stripe_account_id
      if (finalUserId) {
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_account_id: account.id })
          .eq('id', finalUserId);
      } else {
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_account_id: account.id })
          .eq('email', email);
      }

      // 6. Generate Stripe Express Onboarding Link via Accounts v2
      const accountLink = await stripe.v2.core.accountLinks.create({
        account: account.id,
        use_case: {
          type: 'account_onboarding',
          account_onboarding: {
            refresh_url: `${appUrl}/dashboard?connect=refresh`,
            return_url: `${appUrl}/dashboard?connect=success&account_id=${account.id}`,
          },
        },
      });

      return NextResponse.json({
        url: accountLink.url,
        accountId: account.id,
        profileUrl: artistProfileUrl,
        commissionRate,
      });
    }

    // 3. Paid Tier Subscription Path (10% Artist / 5% Label)
    const priceId =
      normalizedTier === 'label'
        ? process.env.STRIPE_LABEL_PRICE_ID
        : process.env.STRIPE_ARTIST_PRICE_ID;

    if (!priceId) {
      return NextResponse.json({ error: 'Missing price ID for selected tier' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          profileId: userId || '',
          customHandle: handleName || '',
          tier: normalizedTier,
        },
      },
      metadata: {
        tier: normalizedTier,
        commissionRate: String(commissionRate),
        handleName: handleName || '',
        fullName: fullName || '',
        phoneNumber: phoneNumber || '',
        userId: userId || '',
      },
      success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/`,
    });

    return NextResponse.json({
      url: session.url,
      commissionRate,
    });
  } catch (err: any) {
    console.error('Store / Subscription Checkout Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process subscription session' },
      { status: 500 }
    );
  }
}
