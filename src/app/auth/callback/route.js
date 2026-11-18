import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    const tokenResponse = await fetch('https://auth.aweber.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.AWEBER_CLIENT_ID || 'moj5CVeEMIYMAqtk0ZWeDMIdj7UAE2A1',
        client_secret: process.env.AWEBER_CLIENT_SECRET || 'zOgLeuFRyW7G2nrtS5beMSPIb9AZNovF',
        code: code,
        redirect_uri: 'http://localhost:3000/auth/callback',
      }),
    });

    const data = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('AWeber Token Error:', data);
      return NextResponse.json({ error: 'Token exchange failed', details: data }, { status: 500 });
    }

    console.log('\n========================================');
    console.log('SUCCESS! NEW AWEBER TOKENS:');
    console.log(`AWEBER_ACCESS_TOKEN=${data.access_token}`);
    console.log(`AWEBER_REFRESH_TOKEN=${data.refresh_token}`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      message: 'Tokens generated! Copy them from your Next.js terminal into .env.local.',
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
