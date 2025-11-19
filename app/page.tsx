import { redirect } from "next/navigation";
import { getServerAuthContext, getServerRoles, summarizeRoles } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const { appUserId } = await getServerAuthContext()
  if (!appUserId) return redirect('/client')

  const roles = await getServerRoles()
  const { isStudentOnly } = summarizeRoles(roles)
  return redirect(isStudentOnly ? '/client' : '/admin')
}
