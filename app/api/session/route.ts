import { NextResponse } from "next/server";

import getSupabaseServer from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type RoleRecord = {
  role_id: string;
  target: string | null;
  permissions: { scope: string }[] | null;
};

type SessionResponse = {
  user: { id: string } | null;
  hasCC?: boolean;
  hasSchoolScope?: boolean;
  hasOlympiaAccess?: boolean;
  ccClassId?: string | null;
  roles?: string[];
  error?: string;
};

const CACHE_TTL_MS = 5000;
const sessionCache = new Map<string, { expiresAt: number; payload: SessionResponse }>();
const inflight = new Map<string, Promise<SessionResponse>>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCached(authUid: string): SessionResponse | null {
  const cached = sessionCache.get(authUid);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    sessionCache.delete(authUid);
    return null;
  }
  return cached.payload;
}

function setCached(authUid: string, payload: SessionResponse): void {
  sessionCache.set(authUid, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
}

async function computeSession(authUid: string): Promise<SessionResponse> {
  const supabase = await getSupabaseServer();

  // Fetch user with a minimal retry (để tránh trigger chưa chạy kịp, nhưng không gây delay lớn).
  let appUserId: string | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("auth_uid", authUid)
      .maybeSingle();
    if (error) {
      return { user: null, error: error.message };
    }
    if (data?.id) {
      appUserId = data.id;
      break;
    }
    if (attempt === 0) await delay(50);
  }

  if (!appUserId) {
    return { user: null };
  }

  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role_id, target, permissions(scope)")
    .eq("user_id", appUserId);
  if (rolesError) {
    return { user: { id: appUserId }, error: rolesError.message };
  }

  const roleList = Array.isArray(rolesData) ? (rolesData as RoleRecord[]) : [];
  const roleIds = roleList.map((r) => r.role_id).filter(Boolean) as string[];

  const hasSchoolScope = roleList.some((r) => {
    const scopes = Array.isArray(r.permissions) ? r.permissions : [];
    return scopes.some((p) => p.scope === "school");
  });
  const hasCC = roleList.some((r) => r.role_id === "CC");
  const hasOlympiaAccess =
    roleIds.includes("OLYMPIA_ADMIN") ||
    roleIds.includes("OLYMPIA_USER") ||
    roleIds.includes("MOD");

  let ccClassId: string | null = null;
  if (hasCC && !hasSchoolScope) {
    const ccRole = roleList.find((r) => r.role_id === "CC" && Boolean(r.target));
    const targetName = ccRole?.target ?? null;
    if (targetName) {
      const { data: classRow, error: classError } = await supabase
        .from("classes")
        .select("id")
        .eq("homeroom_teacher_id", appUserId)
        .eq("name", targetName)
        .limit(1)
        .maybeSingle();
      if (!classError) {
        ccClassId = classRow?.id ?? null;
      }
    }
  }

  return {
    user: { id: appUserId },
    hasCC,
    hasSchoolScope,
    hasOlympiaAccess,
    ccClassId,
    roles: roleIds,
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await getSupabaseServer();
    const { data: userRes } = await supabase.auth.getUser();
    const authUid = userRes?.user?.id;
    if (!authUid) return NextResponse.json({ user: null } satisfies SessionResponse);

    const cached = getCached(authUid);
    if (cached) {
      return NextResponse.json(cached, { headers: { "Cache-Control": "no-store" } });
    }

    const existing = inflight.get(authUid);
    if (existing) {
      const payload = await existing;
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    }

    const p = computeSession(authUid)
      .then((payload) => {
        setCached(authUid, payload);
        return payload;
      })
      .finally(() => {
        inflight.delete(authUid);
      });
    inflight.set(authUid, p);

    const payload = await p;
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ user: null, error: message } satisfies SessionResponse, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
