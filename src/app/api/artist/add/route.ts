import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chhwujiajdhaihupvuix.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  try {
    const { name, stage_name, handle, parent_label_id } = await request.json();

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedStageName =
      typeof stage_name === 'string' && stage_name.trim()
        ? stage_name.trim()
        : trimmedName;

    if (!trimmedName || !handle || !parent_label_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Initialize Supabase Admin client with Service Role Key (bypasses RLS)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          name: trimmedName,
          stage_name: trimmedStageName,
          handle,
          tier: 'artist',
          parent_label_id,
        }
      ])
      .select()
      .single();


    if (error) {
      console.error('Database insertion error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, artist: data });
  } catch (err: any) {
    console.error('Server error adding artist:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}