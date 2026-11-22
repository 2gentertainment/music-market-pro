import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { pendingAccountId, profileId, userId, handle } = await req.json();

    if (!pendingAccountId) {
      return NextResponse.json(
        { verified: false, error: 'Missing pendingAccountId' },
        { status: 400 }
      );
    }

    // Retrieve the Stripe v2 Core Account to verify onboarding completion
    const account = await stripe.v2.core.accounts.retrieve(pendingAccountId, {
      include: ['configuration.merchant', 'configuration.recipient', 'requirements'],
    });

    const currentlyDue = account.requirements?.summary?.minimum_deadline?.status;
    const merchantStatus = account.configuration?.merchant?.capabilities?.card_payments?.status;
    const recipientStatus =
      account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;

    // Account is verified once capabilities are active/pending review without past_due/currently_due blockers
    const hasBlockingRequirements =
      currentlyDue === 'currently_due' || currentlyDue === 'past_due';

    const hasRequestedOrActiveCapabilities =
      merchantStatus === 'active' ||
      merchantStatus === 'pending' ||
      recipientStatus === 'active' ||
      recipientStatus === 'pending';

    const isVerified = !hasBlockingRequirements && hasRequestedOrActiveCapabilities;

    if (!isVerified) {
      return NextResponse.json({
        verified: false,
        status: currentlyDue || 'incomplete',
        message: 'Stripe onboarding is still incomplete.',
      });
    }

    const targetProfileId =
      profileId ||
      userId ||
      (account.metadata?.supabaseUserId !== 'temp_user_id'
        ? account.metadata?.supabaseUserId
        : null);

    let updatedProfile = null;

    if (targetProfileId) {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          stripe_account_id: pendingAccountId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetProfileId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Failed updating verified stripe_account_id by id:', error.message);
      } else {
        updatedProfile = data;
      }
    } else if (handle) {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          stripe_account_id: pendingAccountId,
          updated_at: new Date().toISOString(),
        })
        .eq('handle', handle)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Failed updating verified stripe_account_id by handle:', error.message);
      } else {
        updatedProfile = data;
      }
    }

    // Mark metadata as verified on Stripe
    await stripe.v2.core.accounts.update(pendingAccountId, {
      metadata: {
        ...account.metadata,
        payoutVerified: 'true',
      },
    });

    return NextResponse.json({
      verified: true,
      accountId: pendingAccountId,
      profile: updatedProfile,
    });
  } catch (err: any) {
    console.error('Stripe Connect Verify Error:', err);
    return NextResponse.json(
      { verified: false, error: err.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
