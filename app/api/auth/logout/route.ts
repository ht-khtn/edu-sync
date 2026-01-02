import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function POST() {
  try {
    const resp = NextResponse.json({ ok: true });
    // clear cookies used for server auth
    resp.cookies.set("sb-access-token", "", { path: "/", maxAge: 0 });
    resp.cookies.set("sb-access-token-public", "", { path: "/", maxAge: 0 });
    resp.cookies.set("sb-refresh-token", "", { path: "/", maxAge: 0 });

    try {
      const supabase = await getSupabaseServer();
      // best-effort sign out on server
      await supabase.auth.signOut();
    } catch {
      // ignore
    }

    return resp;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Default to the Node.js runtime to avoid disabling static generation elsewhere
// and because this handler only uses standard Next.js server APIs.
export const runtime = "nodejs";
