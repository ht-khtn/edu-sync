import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function HomePage() {
  // Resolve auth on the server to hide the login button when already signed in
  let user: { id?: string } | null = null
  try {
    const { getSupabaseServer } = await import('@/lib/supabase-server')
    const supabase = await getSupabaseServer()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    // Supabase not configured; render as public
    user = null
  }

  return (
    <>
      <section className="mx-auto max-w-3xl min-h-[70vh] px-4 flex flex-col items-center justify-center text-center">
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">EduSync</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Hệ thống hỗ trợ quản lý phong trào và thi đua dành cho học sinh THPT.
          </p>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          {!user && (
            <Button asChild>
              <Link href="/login">Đăng nhập</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="#guide">Xem hướng dẫn</Link>
          </Button>
        </div>
      </section>

      <section id="guide" className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-lg font-semibold tracking-tight">Hướng dẫn</h2>
        <p className="mt-2 text-sm text-muted-foreground">Nội dung hướng dẫn sẽ được cập nhật.</p>
      </section>
    </>
  )
}

