import type { Metadata } from "next";
import { ClientHeader } from "@/components/client/ClientHeader";
import { redirect } from "next/navigation";
import { getServerAuthContext, getServerRoles, summarizeRoles } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "EduSync",
  description:
    "Hệ thống hỗ trợ quản lý phong trào và thi đua dành cho học sinh THPT",
};

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { appUserId } = await getServerAuthContext()
  if (!appUserId) {
    return (
      <>
        <ClientHeader user={null} hasAdminAccess={false} />
        {children}
      </>
    )
  }

  const roles = await getServerRoles()
  const { isStudentOnly } = summarizeRoles(roles)

  if (!isStudentOnly) {
    return redirect('/admin')
  }

  return (
    <>
      <ClientHeader user={{ id: appUserId }} hasAdminAccess={false} />
      {children}
    </>
  )
}
