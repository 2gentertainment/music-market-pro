import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { syncCreatorToAweber } from '@/lib/aweber';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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
      persistSession: false,
    },
  }
);

function normalizeSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, password, name, phone, handle, stageName, agreedToTerms } = body;

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

      const rawStageOrHandle =
        (typeof stageName === 'string' && stageName.trim()) ||
        (typeof handle === 'string' && handle.trim()) ||
        '';
      const emailHandle =
        String(email || '')
          .split('@')[0]
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') || 'artist';

      const uniqueHandle = rawStageOrHandle
        ? normalizeSlug(rawStageOrHandle)
        : `${emailHandle}-${Math.floor(1000 + Math.random() * 9000)}`;

      if (!uniqueHandle) {
        return NextResponse.json(
          { success: false, message: 'Please provide a valid artist stage name or label name.' },
          { status: 400 }
        );
      }

      // Check existing handles / stage names / label names before creating the auth user
      const { data: handleCollision, error: handleLookupErr } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .or(`handle.eq.${uniqueHandle},artist_handle.eq.${uniqueHandle}`)
        .limit(1);

      if (handleLookupErr) {
        console.error('Handle uniqueness lookup error:', handleLookupErr);
      } else if (handleCollision && handleCollision.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `The handle "${uniqueHandle}" is already taken. Please choose a different stage or label name.`,
          },
          { status: 409 }
        );
      }

      if (rawStageOrHandle) {
        const escapedName = rawStageOrHandle.replace(/[%_,]/g, '');
        const { data: nameCollision, error: nameLookupErr } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .or(`stage_name.ilike.${escapedName},label_name.ilike.${escapedName}`)
          .limit(1);

        if (nameLookupErr) {
          console.error('Stage/label name uniqueness lookup error:', nameLookupErr);
        } else if (nameCollision && nameCollision.length > 0) {
          return NextResponse.json(
            {
              success: false,
              message: `"${rawStageOrHandle}" is already registered as a stage or label name.`,
            },
            { status: 409 }
          );
        }
      }

      // 1. Create user in Supabase with admin privileges
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, phone: phone, stage_name: rawStageOrHandle || null },
      });

      const finalUser = authData?.user;

      if (authError || !finalUser) {
        return NextResponse.json(
          {
            success: false,
            message: authError?.message || 'Unable to create account. Try signing in instead.',
          },
          { status: 400 }
        );
      }

      const resolvedStageName = rawStageOrHandle || null;
      const rawUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        'http://localhost:3000';
      const appUrl = rawUrl.trim().replace(/\/+$/, '');
      const artistProfileUrl = `${appUrl}/artist/${uniqueHandle}`;

      // 2. Provision profile record in Supabase defaulting to free tier with dedicated artist_handle
      const { error: dbError } = await supabaseAdmin.from('profiles').upsert(
        {
          id: finalUser.id,
          email: email,
          handle: uniqueHandle,
          artist_handle: uniqueHandle,
          stage_name: resolvedStageName,
          name: name || emailHandle,
          full_name: name || emailHandle,
          full_legal_name: name || emailHandle,
          phone_number: phone || '',
          tier: 'free',
          profile_url: artistProfileUrl,
          terms_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (dbError) {
        console.error('Database profile provision error on auth signup:', dbError);
        if (dbError.code === '23505') {
          await supabaseAdmin.auth.admin.deleteUser(finalUser.id).catch(() => {});
          return NextResponse.json(
            {
              success: false,
              message: 'That stage name, label name, or handle is already in use.',
            },
            { status: 409 }
          );
        }
      }

      // Sync creator to AWeber for /auth signups
      try {
        await syncCreatorToAweber({
          email,
          name: name || rawStageOrHandle || emailHandle,
          tier: 'free',
          handle: uniqueHandle,
        });
      } catch (aweberErr) {
        console.error('AWeber sync warning (auth signup):', aweberErr);
      }

      // Sign in the newly created user so AuthPage can set the session and land on /dashboard
      const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: signInData } = await supabaseUserClient.auth.signInWithPassword({
        email,
        password,
      });

      return NextResponse.json({
        success: true,
        redirectTo: '/dashboard',
        session: signInData?.session || null,
        user: finalUser,
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
        user: data.user,
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Auth Route Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
