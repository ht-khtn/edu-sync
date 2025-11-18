import { redirect } from "next/navigation";
import getSupabaseServer from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  redirect("/admin");
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      suppressHydrationWarning
    >
      <p>Đang chuyển hướng...</p>
    </div>
  );
  // try {
  //   const supabase = await getSupabaseServer();
  //   const { data: userRes } = await supabase.auth.getUser();
  //   const authUid = userRes?.user?.id;

  //   if (authUid) {
  //     const { data: appUser } = await supabase
  //       .from("users")
  //       .select("id")
  //       .eq("auth_uid", authUid)
  //       .maybeSingle();

  //     const appUserId = appUser?.id as string | undefined;

  //     if (appUserId) {
  //       const { data: roles } = await supabase
  //         .from("user_roles")
  //         .select("role_id")
  //         .eq("user_id", appUserId);

  //       const hasAdminAccess =
  //         Array.isArray(roles) &&
  //         roles.some((r) => r.role_id === "CC" || r.role_id === "Admin");

  //       if (hasAdminAccess) {
  //         redirect("/admin");
  //       }
  //     }
  //   }

  //   redirect("/admin");
  // } catch {
  //   redirect("/admin");
  // }
}
