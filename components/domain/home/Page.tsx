import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ClipboardList, ShieldCheck, BarChart3, LogIn } from 'lucide-react'
import getSupabaseServer from '@/lib/supabase-server'

export default async function HomePageContent() {
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
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-3xl">
        <Card className="text-center py-12 px-8 rounded-2xl bg-white/80 backdrop-blur-md shadow-2xl">
          <CardHeader className="flex flex-col items-center gap-3">
            <Avatar className="mx-auto shadow-lg ring-1 ring-white/60">
              <AvatarFallback>ES</AvatarFallback>
            </Avatar>
            <CardTitle className="text-4xl">EduSync</CardTitle>
            <CardDescription className="text-lg text-zinc-700">Hệ thống hỗ trợ quản lý phong trào và thi đua THPT</CardDescription>
            {user && (
              <CardAction>
                <Badge variant="secondary">{hasCC ? 'Ban thi đua (CC)' : 'Người dùng'}</Badge>
              </CardAction>
            )}
          </CardHeader>

          <CardContent>
            <div className="mt-6">
              <Separator />
            </div>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              {user ? (
                <>
                  {hasCC && (
                    <>
                      <Button asChild className="rounded-xl px-6 py-3" size="lg">
                  <Link href="/violation-entry" className="flex items-center justify-center"><ShieldCheck className="mr-2 h-5 w-5"/>Nhập vi phạm</Link>
                      </Button>
                      <Button asChild variant="secondary" className="rounded-xl px-6 py-3" size="lg">
                  <Link href="/score-entry" className="flex items-center justify-center"><ClipboardList className="mr-2 h-5 w-5"/>Nhập điểm</Link>
                      </Button>
                    </>
                  )}
                  <Button asChild variant="outline" className="rounded-xl px-6 py-3" size="lg">
                <Link href="/leaderboard" className="flex items-center justify-center"><BarChart3 className="mr-2 h-5 w-5"/>Bảng xếp hạng</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild className="rounded-xl px-6 py-3" size="lg">
                <Link href="/login" className="flex items-center justify-center"><LogIn className="mr-2 h-5 w-5"/>Đăng nhập</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-xl px-6 py-3" size="lg">
                <Link href="/leaderboard" className="flex items-center justify-center"><BarChart3 className="mr-2 h-5 w-5"/>Xem bảng xếp hạng</Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-center mt-4">
            <small className="text-xs text-muted-foreground">Phiên bản nội bộ • Không chia sẻ dữ liệu nhạy cảm</small>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
