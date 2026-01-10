import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const getSupabaseAdminServer = cache(async (): Promise<SupabaseClient> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase admin client not configured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
});

export default getSupabaseAdminServer;
