import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, ShieldCheck, BarChart3, LogIn } from 'lucide-react'
import getSupabaseServer from '@/lib/supabase-server'

export default async function Home() {
  let user: { id?: string; email?: string } | null = null
  let hasCC = false
  try {
    const supabase = await getSupabaseServer()
    const { data: userRes } = await supabase.auth.getUser()
    const authUid = userRes?.user?.id
    user = userRes?.user ?? null
    if (authUid) {
      const { data: appUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_uid', authUid)
        .maybeSingle()
      const appUserId = appUser?.id as string | undefined
      if (appUserId) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role_id')
          .eq('user_id', appUserId)
        hasCC = Array.isArray(roles) && roles.some(r => r.role_id === 'CC')
      }
    }
  } catch {
    // Supabase not configured; render generic dashboard
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>EduSync</CardTitle>
            <CardDescription>Hệ thống hỗ trợ quản lý phong trào và thi đua THPT</CardDescription>
            {user && (
              <CardAction>
                <Badge variant="secondary">{hasCC ? 'Ban thi đua (CC)' : 'Người dùng'}</Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 pt-4">
            {user ? (
              <>
                {hasCC && (
                  <>
                    <Button asChild>
                      <Link href="/violation-entry"><ShieldCheck className="mr-2 h-4 w-4"/>Nhập vi phạm</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/score-entry"><ClipboardList className="mr-2 h-4 w-4"/>Nhập điểm</Link>
                    </Button>
                  </>
                )}
                <Button asChild variant="ghost">
                  <Link href="/leaderboard"><BarChart3 className="mr-2 h-4 w-4"/>Bảng xếp hạng</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild>
                  <Link href="/login"><LogIn className="mr-2 h-4 w-4"/>Đăng nhập</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/leaderboard"><BarChart3 className="mr-2 h-4 w-4"/>Xem bảng xếp hạng</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Hướng dẫn nhanh</CardTitle>
            <CardDescription>Ghi nhận trực tiếp, không cần duyệt. Quyền ghi nhận giới hạn theo vai trò.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-700">
              <li>CC: “Nhập vi phạm” để ghi nhận cho lớp thuộc phạm vi.</li>
              <li>Điểm theo tiêu chí từ bảng criteria; điểm trừ tự động.</li>
              <li>Xem “Bảng xếp hạng” để theo dõi tổng điểm theo lớp.</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
