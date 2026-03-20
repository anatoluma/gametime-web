import { createClient } from "@supabase/supabase-js";

// Anon client for browser/public operations
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
