import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveDisplayNamesForUserIds(
  supabase: SupabaseClient,
  userIds: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (uniqueIds.length === 0) return new Map();

  try {
    const [profilesRes, usersRes] = await Promise.all([
      supabase.from("user_profiles").select("user_id, full_name").in("user_id", uniqueIds),
      supabase.from("users").select("id, user_name").in("id", uniqueIds),
    ]);

    const profileNameMap = new Map<string, string>();
    for (const row of profilesRes.data ?? []) {
      const userId = (row as { user_id?: string | null }).user_id;
      const fullName = (row as { full_name?: string | null }).full_name;
      if (userId && typeof fullName === "string" && fullName.trim().length > 0) {
        profileNameMap.set(userId, fullName.trim());
      }
    }

    const userNameMap = new Map<string, string>();
    for (const row of usersRes.data ?? []) {
      const userId = (row as { id?: string | null }).id;
      const userName = (row as { user_name?: string | null }).user_name;
      if (userId && typeof userName === "string" && userName.trim().length > 0) {
        userNameMap.set(userId, userName.trim());
      }
    }

    const resolved = new Map<string, string>();
    for (const id of uniqueIds) {
      const name = profileNameMap.get(id) ?? userNameMap.get(id) ?? null;
      if (name) resolved.set(id, name);
    }

    return resolved;
  } catch {
    // Nếu RLS không cho đọc users/user_profiles ở một số context (guest), trả về rỗng để UI fallback.
    return new Map();
  }
}
