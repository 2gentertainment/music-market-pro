import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chhwujiajdhaihupvuix.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_bHflg5jJHZfPzoOdsC5f_Q_H3YO4v3c';

// Prevent multiple GoTrueClient instances in development hot-reloads
declare global {
  interface Window {
    __supabaseInstance?: ReturnType<typeof createClient>;
  }
}

export const supabase = 
  typeof window !== 'undefined'
    ? (window.__supabaseInstance ||= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true } }))
    : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true } });
