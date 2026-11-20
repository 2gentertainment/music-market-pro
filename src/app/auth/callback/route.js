import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const clientId = process.env.AWEBER_CLIENT_ID;
  const clientSecret = process.env.AWEBER_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/auth/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'AWeber OAuth credentials are not configured' },
      { status: 500 }
    );
  }

  try {
    const tokenResponse = await fetch('https://auth.aweber.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });


    const data = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('AWeber Token Error:', data);
      return NextResponse.json({ error: 'Token exchange failed', details: data }, { status: 500 });
    }

       return NextResponse.json({
      success: true,
      message: 'AWeber authorization completed.',
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
