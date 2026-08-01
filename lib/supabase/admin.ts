import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Service-role client. Bypasses RLS entirely, so it must only ever be built
 *  inside trusted server code that has already authenticated the caller — today
 *  that is the Stripe webhook, whose authenticity comes from its signature.
 *
 *  Never import this from anything that can reach the client bundle. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
