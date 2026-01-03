import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const getSupabaseServer = cache(async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase not configured on server");
  }

  // cookies() returns a Promise-like in Next 15+, await to access methods safely
  const cookieStore = await cookies();
  const accessToken =
    cookieStore.get("sb-access-token")?.value ?? cookieStore.get("sb-access-token-public")?.value;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
});

export default getSupabaseServer;
