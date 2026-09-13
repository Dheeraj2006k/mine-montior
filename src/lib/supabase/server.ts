import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Session-aware Supabase client for Server Components/Route Handlers —
// reads the user's auth cookies. Distinct from src/lib/db/supabase-server.ts
// (the service-role admin client used for all business data), and from
// src/lib/supabase/client.ts (the browser client). This one only ever
// answers "who is signed in," never bypasses RLS.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component that can't set cookies — the
            // middleware below is what actually refreshes the session on
            // every request, so this is safe to ignore here.
          }
        },
      },
    },
  );
}
