import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Supabase Server Client initialized strictly with Service Role Key (never exposed to browser)
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
