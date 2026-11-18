import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { syncCreatorToAweber } from '@/lib/aweber';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chhwujiajdhaihupvuix.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_bHflg5jJHZfPzoOdsC5f_Q_H3YO4v3c';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is missing in app/api/auth/route.ts');
}

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, password, name, phone, handle, agreedToTerms } = body;

    if (action === 'signup') {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json(
          { success: false, message: 'Server configuration error: missing service role key.' },
          { status: 500 }
        );
      }

      if (!agreedToTerms) {
        return NextResponse.json(
          { success: false, message: 'You must agree to the terms of service to create an account.' },
          { status: 400 }
        );
      }

      // 1. Create user in Supabase with admin privileges
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, phone: phone }
      });

      let finalUser = authData?.user;

            if (authError || !finalUser) {
        return NextResponse.json(
          {
            success: false,
            message: authError?.message || 'Unable to create account. Try signing in instead.',
          },
          { status: 400 }
        );
      }


      const emailHandle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueHandle = handle ? handle.toLowerCase().replace(/[^a-z0-9]/g, '-') : `${emailHandle}-${Math.floor(1000 + Math.random() * 9000)}`;
      const rawUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const appUrl = rawUrl.trim().replace(/\/+$/, '');
      const artistProfileUrl = `${appUrl}/artist/${uniqueHandle}`;

      // 2. Provision profile record in Supabase defaulting to free tier with dedicated artist_handle
      if (finalUser) {
        const { error: dbError } = await supabaseAdmin.from('profiles').upsert({
          id: finalUser.id,
          email: email,
          handle: uniqueHandle,
          artist_handle: uniqueHandle, // 👈 Ensures individual artist player slug is saved immediately on sign-up
          name: name || emailHandle,
          full_name: name || emailHandle,
          full_legal_name: name || emailHandle,
          phone_number: phone || '',
          tier: 'free',
          profile_url: artistProfileUrl,
          terms_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (dbError) {
          console.error('Database profile provision error on auth signup:', dbError);
        }
      }

      // Sync creator to AWeber for /auth signups
      try {
        await syncCreatorToAweber({
          email,
          name: name || handle || emailHandle,
          tier: 'free',
          handle: uniqueHandle,
        });
      } catch (aweberErr) {
        console.error('AWeber sync warning (auth signup):', aweberErr);
      }

      // 3. Initialize Stripe Express account with verified https:// domain to prevent url_invalid errors
      const account = await stripe.accounts.create({
        type: 'express',
        email: email,
        country: 'US',
        business_type: 'individual',
        business_profile: {
          url: 'https://2g-ent.com',
          product_description: 'Independent music catalog sales and digital downloads.',
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          supabaseUserId: finalUser?.id || 'pending_auth',
          handle: uniqueHandle,
        },
      });

      if (finalUser?.id) {
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_account_id: account.id })
          .eq('id', finalUser.id);
      }

      // 4. Generate Stripe onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${appUrl}/dashboard?connect=refresh`,
        return_url: `${appUrl}/dashboard?connect=success&account_id=${account.id}`,
        type: 'account_onboarding',
      });

      // 5. Return Stripe URL so sign-up redirects straight to Stripe onboarding (Never dashboard)
      return NextResponse.json({ 
        success: true, 
        url: accountLink.url, 
        user: finalUser 
      });
    }

    if (action === 'login') {
      const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await supabaseUserClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
      }

      // Existing user login goes straight to dashboard
      return NextResponse.json({ 
        success: true, 
        redirectTo: '/dashboard',
        session: data.session,
        user: data.user
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Auth Route Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
