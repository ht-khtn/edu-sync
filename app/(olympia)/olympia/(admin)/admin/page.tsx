export const dynamic = 'force-dynamic'

const mockTournaments = [
  { name: 'Tuần 5 - Kỳ 1', matches: 3, status: 'Chuẩn bị' },
  { name: 'Tháng 12 - Chung kết', matches: 1, status: 'Đang lên lịch' },
]

const mockTasks = [
  'Kiểm tra bộ đề vòng Khởi động',
  'Chốt danh sách thí sinh trận Tuần 5',
  'Khởi tạo live session để thử nghiệm',
]

export default function OlympiaAdminHomePage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bảng điều khiển Olympia</h2>
        <p className="text-sm text-muted-foreground">
          Sau khi nối dữ liệu Supabase, mục này sẽ tự động hiển thị giải đấu, trận đã lên lịch và nhiệm vụ host.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {mockTournaments.map((item) => (
          <div key={item.name} className="rounded-lg border bg-white p-4">
            <p className="text-xs uppercase text-muted-foreground">Giải đấu</p>
            <h3 className="text-lg font-semibold">{item.name}</h3>
            <p className="text-sm text-muted-foreground">Số trận: {item.matches}</p>
            <p className="text-sm font-medium text-blue-600">{item.status}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <p className="text-xs uppercase text-muted-foreground">Việc cần làm</p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {mockTasks.map((task) => (
            <li key={task} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span>{task}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
