"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureOlympiaAdminAccess } from "@/lib/olympia-access";
import { getServerAuthContext, getServerSupabase } from "@/lib/server-auth";
import type { ActionState } from "./match.actions";

function generateJoinCode() {
  return `OLY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateRoomPassword() {
  return randomBytes(3).toString("hex").toUpperCase();
}

function hashPassword(raw: string) {
  return createHash("sha256").update(raw.toUpperCase()).digest("hex");
}

function isPasswordMatch(stored: string | null | undefined, provided: string) {
  if (!stored) return false;
  const hashed = hashPassword(provided);
  return stored === hashed;
}

const joinSchema = z.object({
  joinCode: z
    .string()
    .min(4, "Mã tối thiểu 4 ký tự")
    .max(32, "Mã tối đa 32 ký tự")
    .transform((val) => val.trim().toUpperCase()),
  playerPassword: z
    .string()
    .optional()
    .transform((val) => val?.trim().toUpperCase() ?? ""),
});

const mcPasswordSchema = z.object({
  joinCode: z
    .string()
    .min(1, "Vui lòng nhập mã phòng")
    .max(20, "Mã phòng quá dài")
    .transform((val) => val.trim().toUpperCase()),
  mcPassword: z
    .string()
    .min(4, "Mật khẩu tối thiểu 4 ký tự")
    .max(64, "Mật khẩu quá dài")
    .transform((val) => val.trim()),
});

const matchIdSchema = z.object({
  matchId: z.string().uuid("Trận không hợp lệ."),
});

const regeneratePasswordSchema = z.object({
  sessionId: z.string().uuid("Session ID không hợp lệ"),
});

export async function lookupJoinCodeAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { authUid, supabase } = await getServerAuthContext();
    if (!authUid) return { error: "Bạn cần đăng nhập để tham gia phòng." };

    const parsed = joinSchema.safeParse({
      joinCode: formData.get("joinCode"),
      playerPassword: formData.get("playerPassword"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Mã tham gia không hợp lệ." };
    }

    // Get public.users.id from auth_uid (needed for FK constraint in session_verifications)
    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("auth_uid", authUid)
      .maybeSingle();

    if (userError) return { error: userError.message };
    if (!userRecord) {
      // User record does not exist yet - may be due to trigger delay, skip session verification for now
      console.warn("[Olympia] User record not found for auth_uid:", authUid);
    }

    const olympia = supabase.schema("olympia");
    const { data, error } = await olympia
      .from("live_sessions")
      .select(
        "id, status, match_id, question_state, current_round_type, player_password, requires_player_password"
      )
      .eq("join_code", parsed.data.joinCode)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!data) return { error: "Không tìm thấy phòng với mã này." };
    if (data.status === "ended") return { error: "Phòng thi đã kết thúc." };

    const requiresPassword = data.requires_player_password !== false;
    if (requiresPassword) {
      if (!parsed.data.playerPassword || parsed.data.playerPassword.length === 0) {
        return { error: "Phòng yêu cầu mật khẩu thí sinh." };
      }
      if (!isPasswordMatch(data.player_password, parsed.data.playerPassword)) {
        return { error: "Sai mật khẩu thí sinh." };
      }
    }

    // Record verification on server for cross-device persistence (only if user record exists)
    if (userRecord?.id) {
      const { error: verifyError } = await olympia.from("session_verifications").upsert(
        {
          session_id: data.id,
          user_id: userRecord.id,
          verified_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "session_id,user_id" }
      );

      if (verifyError) {
        console.error("[Olympia] Failed to record session verification:", verifyError);
        // Continue anyway - verification is secondary
      }
    }

    return {
      success:
        `Phòng đang chạy (round: ${data.current_round_type ?? "N/A"}, trạng thái: ${data.question_state}).` as const,
      data: { sessionId: data.id },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể kiểm tra mã tham gia." };
  }
}

export async function verifyMcPasswordAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const parsed = mcPasswordSchema.safeParse({
      joinCode: formData.get("joinCode"),
      mcPassword: formData.get("mcPassword"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Mã phòng hoặc mật khẩu không hợp lệ." };
    }

    const supabase = await getServerSupabase();
    const olympia = supabase.schema("olympia");
    const { data: session, error } = await olympia
      .from("live_sessions")
      .select("id, match_id, mc_view_password, status")
      .eq("join_code", parsed.data.joinCode)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!session) return { error: "Không tìm thấy phòng với mã này." };

    if (!session.mc_view_password) {
      return { error: "Phòng chưa cấu hình mật khẩu MC." };
    }

    if (!isPasswordMatch(session.mc_view_password, parsed.data.mcPassword)) {
      return { error: "Sai mật khẩu MC." };
    }

    if (session.status !== "running") {
      return {
        success: "Mật khẩu đúng, nhưng phòng chưa chạy. Bạn vẫn có thể xem chế độ chuẩn bị.",
        data: { joinCode: parsed.data.joinCode, matchId: session.match_id },
      };
    }

    return {
      success: "Đã mở khóa chế độ xem MC.",
      data: { joinCode: parsed.data.joinCode, matchId: session.match_id },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể xác thực mật khẩu MC." };
  }
}

export async function openLiveSessionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");
    const parsed = matchIdSchema.safeParse({ matchId: formData.get("matchId") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin trận." };
    }

    const matchId = parsed.data.matchId;
    const { data: match, error: matchError } = await olympia
      .from("matches")
      .select("id, status")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) return { error: matchError.message };
    if (!match) return { error: "Không tìm thấy trận." };

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, join_code, status")
      .eq("match_id", matchId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };

    const joinCode = session?.join_code ?? generateJoinCode();
    const playerPasswordPlain = generateRoomPassword();
    const mcPasswordPlain = generateRoomPassword();
    const hashedPlayerPassword = hashPassword(playerPasswordPlain);
    const hashedMcPassword = hashPassword(mcPasswordPlain);

    if (!session) {
      const { error } = await olympia.from("live_sessions").insert({
        match_id: matchId,
        join_code: joinCode,
        status: "running",
        created_by: appUserId,
        player_password: hashedPlayerPassword,
        mc_view_password: hashedMcPassword,
        requires_player_password: true,
      });
      if (error) return { error: error.message };
    } else {
      const { error } = await olympia
        .from("live_sessions")
        .update({
          status: "running",
          join_code: joinCode,
          question_state: "hidden",
          current_round_id: null,
          current_round_question_id: null,
          timer_deadline: null,
          ended_at: null,
          player_password: hashedPlayerPassword,
          mc_view_password: hashedMcPassword,
          requires_player_password: true,
        })
        .eq("id", session.id);
      if (error) return { error: error.message };
    }

    if (match.status !== "live") {
      const { error } = await olympia.from("matches").update({ status: "live" }).eq("id", matchId);
      if (error) return { error: error.message };
    }

    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    revalidatePath("/olympia/client");

    // Record password generation in history
    const { error: historyError } = await olympia.from("session_password_history").insert({
      session_id: session
        ? session.id
        : (await olympia.from("live_sessions").select("id").eq("match_id", matchId).maybeSingle())
            .data?.id,
      player_password_hash: hashedPlayerPassword,
      mc_view_password_hash: hashedMcPassword,
      player_password_plain: playerPasswordPlain,
      mc_password_plain: mcPasswordPlain,
      generated_by: appUserId,
      is_current: true,
    });

    if (historyError) {
      console.error("[Olympia] Failed to record password history:", historyError);
    }

    return {
      success: `Đã mở phòng. Mã tham gia: ${joinCode}. Mật khẩu thí sinh: ${playerPasswordPlain} Mật khẩu MC: ${mcPasswordPlain}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể mở phòng thi." };
  }
}

export async function getSessionPasswordAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = regeneratePasswordSchema.safeParse({
      sessionId: formData.get("sessionId"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Session ID không hợp lệ." };
    }

    const { data: passwordHistory, error: historyError } = await olympia
      .from("session_password_history")
      .select("player_password_plain, mc_password_plain")
      .eq("session_id", parsed.data.sessionId)
      .eq("is_current", true)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (historyError) return { error: historyError.message };
    if (!passwordHistory) return { error: "Không tìm thấy mật khẩu. Vui lòng mở phòng trước." };

    return {
      success: `Mật khẩu thí sinh: ${passwordHistory.player_password_plain} Mật khẩu MC: ${passwordHistory.mc_password_plain}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể lấy mật khẩu." };
  }
}

export async function regenerateSessionPasswordAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase, appUserId } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");

    const parsed = regeneratePasswordSchema.safeParse({
      sessionId: formData.get("sessionId"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Session ID không hợp lệ." };
    }

    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();

    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Không tìm thấy phòng." };

    // Generate new passwords
    const playerPasswordPlain = generateRoomPassword();
    const mcPasswordPlain = generateRoomPassword();
    const hashedPlayerPassword = hashPassword(playerPasswordPlain);
    const hashedMcPassword = hashPassword(mcPasswordPlain);

    // Update session with new passwords
    const { error: updateError } = await olympia
      .from("live_sessions")
      .update({
        player_password: hashedPlayerPassword,
        mc_view_password: hashedMcPassword,
      })
      .eq("id", parsed.data.sessionId);

    if (updateError) return { error: updateError.message };

    // Record old passwords as inactive in history
    const { error: historyError } = await olympia
      .from("session_password_history")
      .update({ is_current: false })
      .eq("session_id", parsed.data.sessionId)
      .eq("is_current", true);

    if (historyError) {
      console.error("[Olympia] Failed to update password history:", historyError);
    }

    // Record new passwords in history
    const { error: newHistoryError } = await olympia.from("session_password_history").insert({
      session_id: parsed.data.sessionId,
      player_password_hash: hashedPlayerPassword,
      mc_view_password_hash: hashedMcPassword,
      player_password_plain: playerPasswordPlain,
      mc_password_plain: mcPasswordPlain,
      generated_by: appUserId,
      is_current: true,
    });

    if (newHistoryError) {
      console.error("[Olympia] Failed to record new password history:", newHistoryError);
    }

    revalidatePath("/olympia/admin/matches");

    return {
      success: `Đã sinh lại mật khẩu. Mật khẩu thí sinh: ${playerPasswordPlain} Mật khẩu MC: ${mcPasswordPlain}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể sinh lại mật khẩu." };
  }
}

export async function endLiveSessionAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureOlympiaAdminAccess();
    const { supabase } = await getServerAuthContext();
    const olympia = supabase.schema("olympia");
    const parsed = matchIdSchema.safeParse({ matchId: formData.get("matchId") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Thiếu thông tin trận." };
    }

    const matchId = parsed.data.matchId;
    const { data: session, error: sessionError } = await olympia
      .from("live_sessions")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session) return { error: "Trận này chưa có phòng live." };
    if (session.status === "ended") {
      return { error: "Phòng đã kết thúc trước đó." };
    }

    const endedAt = new Date().toISOString();

    const [{ error: liveError }, { error: matchError }] = await Promise.all([
      olympia
        .from("live_sessions")
        .update({ status: "ended", ended_at: endedAt })
        .eq("id", session.id),
      olympia.from("matches").update({ status: "finished" }).eq("id", matchId),
    ]);

    if (liveError) return { error: liveError.message };
    if (matchError) return { error: matchError.message };

    revalidatePath("/olympia/admin/matches");
    revalidatePath("/olympia/admin");
    revalidatePath("/olympia/client");

    return { success: "Đã kết thúc phòng thi." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không thể kết thúc phòng thi." };
  }
}
