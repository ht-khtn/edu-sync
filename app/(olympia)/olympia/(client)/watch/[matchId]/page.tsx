import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { McPasswordGate } from '@/components/olympia/shared/McPasswordGate'
import { getServerAuthContext } from '@/lib/server-auth'

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
        <p className="text-xs uppercase text-muted-foreground">Olympia</p>
        <h1 className="text-3xl font-semibold tracking-tight">Xem trận với quyền MC</h1>
        <p className="text-sm text-muted-foreground">
          {match.name} · {session ? `Trạng thái: ${session.status}` : 'Chưa mở live session'}
        </p>
      </div>

      {!session ? (
        <Alert>
          <AlertDescription>Trận này chưa mở phòng live. Bạn vẫn có thể xem lịch và chuẩn bị mật khẩu.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Chế độ guest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Ở chế độ guest, bạn có thể xem scoreboard công khai và timeline câu hỏi khi trận đang chạy.</p>
            <p>
              Mã join dành cho thí sinh: <span className="font-mono">{session?.join_code ?? 'Đang cập nhật'}</span>. Thí sinh vẫn cần mật khẩu
              riêng để vào game client.
            </p>
            <p className="text-xs text-slate-500">UI scoreboard sẽ được bổ sung trong sprint tới.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mở khóa chế độ MC</CardTitle>
          </CardHeader>
          <CardContent>
            <McPasswordGate matchId={match.id} />
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
