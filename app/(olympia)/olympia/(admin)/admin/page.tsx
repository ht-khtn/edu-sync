export const dynamic = 'force-dynamic'

export default function OlympiaAdminHomePage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bảng điều khiển Olympia</h2>
        <p className="text-sm text-muted-foreground">
          Khu vực này sẽ hiển thị tổng quan giải đấu, trận đã lên lịch và nhiệm vụ host.
        </p>
      </div>
      <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground">
        <p>
          Chưa có dữ liệu. Sau khi hoàn tất kết nối Supabase và server actions, thông tin về tournament/matches
          sẽ xuất hiện tại đây.
        </p>
      </div>
    </section>
  )
}
