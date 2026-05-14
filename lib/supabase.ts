import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client. The anon-key client is intentionally not
// exported — RLS on every table is enabled with no policies, so anon would
// receive zero rows anyway, and keeping the key out of the client bundle
// shrinks attack surface.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
