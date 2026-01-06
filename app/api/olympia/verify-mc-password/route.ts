import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { getServerSupabase } from "@/lib/server-auth";

const schema = z.object({
  joinCode: z.string().min(1),
  mcPassword: z.string().min(1),
});

type VerifyMcPasswordResponse =
  | { ok: true; message: string; data: { joinCode: string; matchId: string | null } }
  | { ok: false; error: string };

function hashPassword(raw: string) {
  return createHash("sha256").update(raw.toUpperCase()).digest("hex");
}

function isPasswordMatch(stored: string | null | undefined, provided: string) {
  if (!stored) return false;
  return stored === hashPassword(provided);
}

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Mã phòng hoặc mật khẩu không hợp lệ.";
      const body: VerifyMcPasswordResponse = { ok: false, error: message };
      return NextResponse.json(body, { status: 400 });
    }

    const joinCode = parsed.data.joinCode.trim().toUpperCase();
    if (!joinCode) {
      const body: VerifyMcPasswordResponse = {
        ok: false,
        error: "Mã phòng hoặc mật khẩu không hợp lệ.",
      };
      return NextResponse.json(body, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const olympia = supabase.schema("olympia");

    const { data: session, error } = await olympia
      .from("live_sessions")
      .select("id, match_id, mc_view_password, status")
      .eq("join_code", joinCode)
      .maybeSingle();

    if (error) {
      const body: VerifyMcPasswordResponse = { ok: false, error: error.message };
      return NextResponse.json(body, { status: 500 });
    }

    if (!session) {
      const body: VerifyMcPasswordResponse = {
        ok: false,
        error: "Không tìm thấy phòng với mã này.",
      };
      return NextResponse.json(body, { status: 404 });
    }

    if (!session.mc_view_password) {
      const body: VerifyMcPasswordResponse = {
        ok: false,
        error: "Phòng chưa cấu hình mật khẩu MC.",
      };
      return NextResponse.json(body, { status: 400 });
    }

    if (!isPasswordMatch(session.mc_view_password, parsed.data.mcPassword)) {
      const body: VerifyMcPasswordResponse = { ok: false, error: "Sai mật khẩu MC." };
      return NextResponse.json(body, { status: 401 });
    }

    if (session.status !== "running") {
      const body: VerifyMcPasswordResponse = {
        ok: true,
        message: "Mật khẩu đúng, nhưng phòng chưa chạy. Bạn vẫn có thể xem chế độ chuẩn bị.",
        data: { joinCode, matchId: session.match_id ?? null },
      };
      return NextResponse.json(body);
    }

    const body: VerifyMcPasswordResponse = {
      ok: true,
      message: "Đã mở khóa chế độ xem MC.",
      data: { joinCode, matchId: session.match_id ?? null },
    };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không thể xác thực mật khẩu MC.";
    const body: VerifyMcPasswordResponse = { ok: false, error: message };
    return NextResponse.json(body, { status: 500 });
  }
}

export const runtime = "nodejs";
