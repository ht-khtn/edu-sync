import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { McPasswordGate } from '@/components/olympia/shared/McPasswordGate'
import { getServerAuthContext } from '@/lib/server-auth'
import { Eye, Lock } from 'lucide-react'

// KEEP force-dynamic: Real-time match state (live scores, current question)
export const dynamic = 'force-dynamic'

type WatchPageProps = {
  params: {
    matchId: string
  }
}

export default async function OlympiaWatchMatchPage({ params }: WatchPageProps) {
  const { supabase } = await getServerAuthContext()
  const olympia = supabase.schema('olympia')

  const [{ data: match, error: matchError }, { data: session }] = await Promise.all([
    olympia
      .from('matches')
      .select('id, name, status, scheduled_at')
      .eq('id', params.matchId)
      .maybeSingle(),
    olympia
      .from('live_sessions')
      .select('join_code, status, question_state, current_round_type')
      .eq('match_id', params.matchId)
      .maybeSingle(),
  ])

  if (matchError) {
    console.error('Olympia watch page failed', matchError.message)
  }

  if (!match) {
    notFound()
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase text-muted-foreground">Olympia - Quản lý trận</p>
        <h1 className="text-3xl font-semibold tracking-tight">🎮 {match.name}</h1>
        <p className="text-sm text-muted-foreground">
          {session ? `Trạng thái: ${session.status}` : 'Chưa mở live session'}
        </p>
      </div>

      {!session ? (
        <Alert>
          <AlertDescription>Trận này chưa mở phòng live. Bạn vẫn có thể xem lịch và chuẩn bị mật khẩu.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Guest Mode Card */}
        <Card className="border-dashed border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Chế độ khách (Public)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Chế độ này cho phép khán giả và khách xem <strong>scoreboard công khai</strong> và <strong>timeline câu hỏi</strong> khi trận đang chạy.
              </p>
              <p>
                🔑 Mã join: <span className="font-mono font-bold text-foreground">{session?.join_code ?? 'Đang cập nhật'}</span>
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Thí sinh vẫn cần mật khẩu riêng để vào game client. UI scoreboard đang được phát triển.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/olympia/client/guest/${match.id}`}>
                Xem chế độ khách →
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* MC Mode Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Chế độ MC (Mật khẩu)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Unlock toàn quyền quản lý trận: xem đầy đủ trạng thái câu hỏi, điểm số chi tiết, và log realtime.
            </p>
            <McPasswordGate matchId={match.id} />
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <Button asChild variant="outline" size="sm">
        <Link href="/olympia/client/matches">← Quay lại danh sách trận</Link>
      </Button>
    </section>
  )
}
