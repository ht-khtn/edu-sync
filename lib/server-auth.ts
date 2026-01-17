import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import getSupabaseServer from "@/lib/supabase-server";
import { cache } from "react";

export type ServerAuthContext = {
  supabase: SupabaseClient;
  authUid: string | null;
  appUserId: string | null;
};

export const getServerSupabase = async () => {
  const supabase = await getSupabaseServer();
  return supabase;
};

export const getServerAuthContext = cache(async (): Promise<ServerAuthContext> => {
  const supabase = await getSupabaseServer();

  const cookieStore = await cookies();
  const token =
    cookieStore.get("sb-access-token")?.value ??
    cookieStore.get("sb-access-token-public")?.value ??
    null;

  let authUid: string | null = null;

  if (token) {
    try {
      const payload = token.split(".")[1];
      const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8"
      );
      const parsed = JSON.parse(json);
      authUid = typeof parsed?.sub === "string" ? parsed.sub : null;
    } catch {}
  }

  // ❗ fallback cực hạn chế
  if (!authUid) {
    const { data } = await supabase.auth.getUser();
    authUid = data?.user?.id ?? null;
  }

  let appUserId: string | null = null;

  if (authUid) {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("auth_uid", authUid)
      .maybeSingle();

    appUserId = (data?.id as string | undefined) ?? null;
  }

  return { supabase, authUid, appUserId };
});

export type RoleRow = {
  role_id: string | null;
  permissions?: { scope?: string | null } | null;
  target?: string | null;
};

const STUDENT_ROLES = new Set(["S", "YUM"]);
const normalizeScope = (scope?: string | null) => (scope ?? "").trim().toLowerCase();

export const normalizeRoleId = (roleId: string | null | undefined) =>
  (roleId ?? "").trim().toUpperCase();

export const getServerRoles = cache(async (): Promise<RoleRow[]> => {
  const { supabase, authUid } = await getServerAuthContext();
  if (!authUid) return [];

  const { data } = await supabase
    .from("user_roles")
    .select("role_id, target, permissions(scope), users!inner(auth_uid)")
    .eq("users.auth_uid", authUid);

  return Array.isArray(data) ? (data as RoleRow[]) : [];
});

export type RoleSummary = {
  roleIds: string[];
  hasElevatedRole: boolean;
  isStudentOnly: boolean;
  hasSchoolScope: boolean;
  hasClassScope: boolean;
  hasCC: boolean;
  hasOlympiaAccess: boolean;
  canEnterViolations: boolean;
  canViewViolationStats: boolean;
  canManageSystem: boolean;
};

export function summarizeRoles(roleRows: RoleRow[]): RoleSummary {
  const roleIds = roleRows.map((r) => normalizeRoleId(r.role_id)).filter((id) => id.length > 0);

  let hasSchoolScope = false;
  let hasClassScope = false;
  for (const row of roleRows) {
    const scope = normalizeScope(row.permissions?.scope);
    if (scope === "school") hasSchoolScope = true;
    if (scope === "class") hasClassScope = true;
  }

  const hasCC = roleIds.includes("CC");
  const hasMOD = roleIds.includes("MOD");
  const hasSEC = roleIds.includes("SEC");
  const hasExplicitElevatedRole = roleIds.some((id) => !STUDENT_ROLES.has(id));
  const hasAnyScope = hasSchoolScope || hasClassScope;
  const hasElevatedRole = hasExplicitElevatedRole || hasAnyScope;
  const isStudentOnly = !hasElevatedRole;

  // Allow entering violations if user has CC/MOD/SEC roles
  // Additionally allow any role that has school scope and target === 'ALL'
  const hasSchoolScopeTargetAll = roleRows.some(
    (r) =>
      normalizeScope(r.permissions?.scope) === "school" &&
      String(r.target ?? "")
        .trim()
        .toUpperCase() === "ALL"
  );
  const canEnterViolations = hasCC || hasMOD || hasSEC || hasSchoolScopeTargetAll;
  const canViewViolationStats = hasSchoolScope;
  const canManageSystem = roleIds.includes("AD") || roleIds.includes("MOD");

  // Check for Olympia access via role IDs
  const hasOlympiaAccess =
    roleIds.includes("OLYMPIA_ADMIN") || roleIds.includes("OLYMPIA_USER") || hasMOD;

  return {
    roleIds,
    hasElevatedRole,
    isStudentOnly,
    hasSchoolScope,
    hasClassScope,
    hasCC,
    hasOlympiaAccess,
    canEnterViolations,
    canViewViolationStats,
    canManageSystem,
  };
}

export default getServerAuthContext;
