import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client, used only for auth (signIn/signUp/signOut,
// session reads). Uses the public anon key - never the service role key,
// which stays server-only in src/lib/db/supabase-server.ts and is used for
// all business-data reads/writes, unrelated to user sessions.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
