/**
 * Shared auth context helper for Olympia admin server actions.
 * Centralizes the admin context check pattern used across action files.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerAuthContext } from "@/lib/server-auth";
import { perfAction } from "@/lib/olympia/olympia-trace";

/**
 * Get authenticated Olympia admin context.
 * Throws if user is not authenticated or does not have AD role.
 */
export async function requireOlympiaAdminContext(): Promise<{
  supabase: SupabaseClient;
  appUserId: string;
}> {
  return await perfAction("[perf][action] requireOlympiaAdminContext", async () => {
    const { supabase, appUserId } = await getServerAuthContext();
    if (!appUserId) throw new Error("FORBIDDEN_OLYMPIA_ADMIN");

    const olympia = supabase.schema("olympia");
    const { data, error } = await perfAction(
      "[perf][action] supabase.participants.role",
      async () => {
        return await olympia
          .from("participants")
          .select("role")
          .eq("user_id", appUserId)
          .maybeSingle();
      }
    );
    if (error || !data || data.role !== "AD") {
      throw new Error("FORBIDDEN_OLYMPIA_ADMIN");
    }

    return { supabase, appUserId };
  });
}
