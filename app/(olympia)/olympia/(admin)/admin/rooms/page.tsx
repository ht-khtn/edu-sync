import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function OlympiaAdminRoomsPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase text-muted-foreground">Olympia</p>
        <h1 className="text-3xl font-bold tracking-tight">Quản lý phòng thi &amp; live session</h1>
        <p className="text-sm text-muted-foreground">
          Trang này sẽ cho phép tạo, mở và điều khiển live session cho từng trận. Trong khi chờ server actions và realtime
          console, bạn có thể xem danh sách trận ở mục Giải &amp; trận và khởi tạo session thủ công.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Trạng thái hiện tại</CardTitle>
          <CardDescription>Chưa có live session được kích hoạt trong môi trường này.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Khi tính năng hoàn thiện, bảng này sẽ hiển thị danh sách live session đang mở, mã join, host phụ trách và vòng
            hiện tại. Ban tổ chức có thể bấm để chuyển câu hỏi, cập nhật timer và phát sự kiện realtime tới thí sinh.
          </p>
          <p className="font-medium text-slate-900">
            TODO: Kết nối `olympia.live_sessions`, thêm realtime listener và server actions điều khiển phòng.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tiếp theo nên làm gì?</CardTitle>
          <CardDescription>Đi tới trang giải &amp; trận để chọn trận cần mở phòng.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/olympia/admin/matches">Xem danh sách giải &amp; trận</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}
