import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Query your orders table in Supabase for this customer's successful purchases
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, order_items(track_id, tracks_pro(*))')
      .eq('customer_email', email)
      .eq('status', 'PAID'); // Assuming you update status to PAID via webhook

    if (error || !orders || orders.length === 0) {
      return NextResponse.json({ error: 'No purchases found for this email address.' }, { status: 404 });
    }

    // Extract all purchased tracks/albums tied to this email
    const purchasedTracks = orders.flatMap(order => 
      order.order_items?.map((item: any) => item.tracks_pro) || []
    ).filter(Boolean);

    return NextResponse.json({ success: true, tracks: purchasedTracks });
  } catch (err: any) {
    console.error('Vault verification error:', err);
    return NextResponse.json({ error: 'Internal server error verifying vault access' }, { status: 500 });
  }
}