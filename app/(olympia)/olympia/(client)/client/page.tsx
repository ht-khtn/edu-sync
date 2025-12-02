export const dynamic = 'force-dynamic'

export default function OlympiaClientHomePage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Chào mừng đến với đấu trường Olympia</h1>
        <p className="text-sm text-muted-foreground">
          Trang này sẽ sớm cho phép thí sinh nhập mã tham gia, xem lịch thi và truy cập trận live.
        </p>
      </div>
      <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground">
        <p>
          Tính năng đang được xây dựng. Trong giai đoạn tiếp theo, chúng tôi sẽ kết nối Supabase để hiển thị danh sách trận
          và trạng thái realtime của phiên live.
        </p>
      </div>
    </section>
  )
}
