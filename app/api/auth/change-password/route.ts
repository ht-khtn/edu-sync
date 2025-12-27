import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return Response.json({ error: "Vui lòng điền đầy đủ thông tin" }, { status: 400 });
    }

    // Get session from cookies and create Supabase client
    const cookieStore = await cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            cookie: Array.from(cookieStore.getAll())
              .map(({ name, value }) => `${name}=${value}`)
              .join("; "),
          },
        },
      }
    );

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Không được xác thực" }, { status: 401 });
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      return Response.json({ error: "Mật khẩu hiện tại không chính xác" }, { status: 401 });
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("[ChangePassword]", updateError);
      return Response.json(
        { error: updateError.message || "Không thể thay đổi mật khẩu" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[ChangePassword]", error);
    return Response.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
