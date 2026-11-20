import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const rawBaseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
    const baseUrl = rawBaseUrl.trim().replace(/\/+$/, '');

    if (!supabaseUrl) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in environment variables.');
    }
    if (!serviceRoleKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { email, userId, profileId, tier, handleName, handle } = await req.json();

    const targetId = profileId || userId;
    let existingProfile: {
      id: string;
      email?: string | null;
      handle?: string | null;
      artist_handle?: string | null;
      tier?: string | null;
      stripe_account_id?: string | null;
    } | null = null;

    if (targetId) {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, handle, artist_handle, tier, stripe_account_id')
        .eq('id', targetId)
        .maybeSingle();
      existingProfile = data;
    } else if (email) {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, handle, artist_handle, tier, stripe_account_id')
        .eq('email', email)
        .maybeSingle();
      existingProfile = data;
    } else if (handle) {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, handle, artist_handle, tier, stripe_account_id')
        .eq('handle', handle)
        .maybeSingle();
      existingProfile = data;
    }

    const resolvedEmail = email || existingProfile?.email;
    const cleanNameSlug = (handleName || resolvedEmail?.split('@')[0] || 'creator')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    const activeHandle =
      existingProfile?.handle ||
      handle ||
      `${cleanNameSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

    const activeTier = existingProfile?.tier || tier || 'free';
    const artistProfileUrl = `${baseUrl}/artist/${activeHandle}`;

    let profileData = existingProfile;

    if (existingProfile?.id) {
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          ...(resolvedEmail ? { email: resolvedEmail } : {}),
          ...(handleName ? { full_name: handleName } : {}),
          handle: activeHandle,
          artist_handle: existingProfile.artist_handle || activeHandle,
          profile_url: artistProfileUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id)
        .select()
        .single();

      if (updateError) {
        console.error('Supabase Profile Update Warning:', updateError.message);
      } else if (updatedProfile) {
        profileData = updatedProfile;
      }
    } else if (resolvedEmail) {
      const { data: insertedProfile, error: dbError } = await supabase
        .from('profiles')
        .upsert(
          {
            ...(targetId ? { id: targetId } : {}),
            email: resolvedEmail,
            full_name: handleName || 'Independent Artist',
            handle: activeHandle,
            artist_handle: activeHandle,
            tier: activeTier,
            profile_url: artistProfileUrl,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )
        .select()
        .single();

      if (dbError) {
        console.error('Supabase Profile Warning:', dbError.message);
      } else if (insertedProfile) {
        profileData = insertedProfile;
      }
    }

    // One-time Stripe Express account creation via Accounts v2 (Application responsibility model)
    let stripeAccountId = profileData?.stripe_account_id || existingProfile?.stripe_account_id || null;

    if (!stripeAccountId) {
      const account = await stripe.v2.core.accounts.create({
        ...(resolvedEmail ? { contact_email: resolvedEmail } : {}),
        display_name: handleName || activeHandle,
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
          supabaseUserId: profileData?.id || targetId || 'temp_user_id',
          handle: activeHandle,
          displayName: handleName || '',
        },
      });

      stripeAccountId = account.id;

      if (profileData?.id) {
        const { error: stripeSaveError } = await supabase
          .from('profiles')
          .update({
            stripe_account_id: stripeAccountId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profileData.id);

        if (stripeSaveError) {
          console.error('Failed saving stripe_account_id to profile:', stripeSaveError.message);
        }
      }
    }

    const accountLink = await stripe.v2.core.accountLinks.create({
      account: stripeAccountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          refresh_url: `${baseUrl}/market?connect=refresh`,
          return_url: `${baseUrl}/dashboard?connect=success&account_id=${stripeAccountId}&handle=${activeHandle}`,
        },
      },
    });

    return NextResponse.json({
      url: accountLink.url,
      accountId: stripeAccountId,
      profileUrl: artistProfileUrl,
    });
  } catch (err: any) {
    console.error('Stripe Connect Onboarding Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
