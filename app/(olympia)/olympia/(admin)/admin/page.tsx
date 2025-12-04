import Link from 'next/link'

const mockTournaments = [
  { name: 'Tuần 5 - Kỳ 1', matches: 3, status: 'Chuẩn bị' },
  { name: 'Tháng 12 - Chung kết', matches: 1, status: 'Đang lên lịch' },
]

const adminQuickLinks = [
  {
    title: 'Quản lý giải & trận',
    description: 'Danh sách tournament, tạo trận mới và xem lịch thi chi tiết.',
    href: '/olympia/admin/matches',
    badge: 'Giải đấu',
  },
  {
    title: 'Phòng thi & live session',
    description: 'Điều khiển phòng thi, theo dõi live session và chuẩn bị host.',
    href: '/olympia/admin/rooms',
    badge: 'Phòng',
  },
  {
    title: 'Ngân hàng câu hỏi',
    description: 'Quản lý bộ đề Olympia, import câu hỏi và gán cho từng vòng.',
    href: '/olympia/admin/question-bank',
    badge: 'Bộ đề',
  },
  {
    title: 'Admin & tài khoản thi',
    description: 'Theo dõi tài khoản Olympia, phân quyền admin và mã thí sinh.',
    href: '/olympia/admin/accounts',
    badge: 'Tài khoản',
  },
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

      <div className="grid gap-4 lg:grid-cols-2">
        {adminQuickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-400 hover:shadow-sm"
          >
            <p className="text-xs font-semibold uppercase text-blue-600">{link.badge}</p>
            <h3 className="text-lg font-semibold">{link.title}</h3>
            <p className="text-sm text-muted-foreground">{link.description}</p>
            <p className="pt-2 text-sm font-medium text-blue-600">Mở trang →</p>
          </Link>
        ))}
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
