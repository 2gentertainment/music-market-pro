import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chhwujiajdhaihupvuix.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_bHflg5jJHZfPzoOdsC5f_Q_H3YO4v3c';

export const supabaseV2 = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'v2' },
  auth: { persistSession: true }
});
