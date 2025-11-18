import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ClientHero } from '@/components/client/ClientHero'
import { ClientMainContent } from '@/components/client/ClientMainContent'
import getSupabaseServer from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function ClientHomePage() {
  let user: { id?: string } | null = null
  
  try {
    const supabase = await getSupabaseServer()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  return (
    <>
      <ClientHero>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {!user && (
            <Button asChild size="lg">
              <Link href="/login">Đăng nhập</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link href="#guide">Xem hướng dẫn</Link>
          </Button>
        </div>
      </ClientHero>

      <ClientMainContent>
        <section id="guide" className="py-16 text-center">
          <h2 className="text-lg font-semibold tracking-tight">Hướng dẫn</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nội dung hướng dẫn sẽ được cập nhật.
          </p>
        </section>
      </ClientMainContent>
    </>
  )
}
