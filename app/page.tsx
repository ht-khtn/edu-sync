import { redirect } from "next/navigation";
import { getServerAuthContext, getServerRoles, summarizeRoles } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const [{ appUserId }, roles] = await Promise.all([
    getServerAuthContext(),
    getServerRoles()
  ])
  
  if (!appUserId) return redirect('/client')

  const { isStudentOnly } = summarizeRoles(roles)
  return redirect(isStudentOnly ? '/client' : '/admin')
}
