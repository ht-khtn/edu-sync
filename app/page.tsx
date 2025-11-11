import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>EduSync</CardTitle>
            <CardDescription>Hệ thống hỗ trợ quản lý phong trào và thi đua THPT</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild>
              <Link href="/violation-entry">Nhập vi phạm</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/login">Đăng nhập</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hướng dẫn nhanh</CardTitle>
            <CardDescription>Ban thi đua ghi nhận trực tiếp, không cần duyệt; chỉ giáo viên chủ nhiệm được quyền khiếu nại.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-700">
              <li>Vào mục “Nhập vi phạm” để ghi nhận cho lớp mình.</li>
              <li>Loại lỗi lấy từ bảng criteria; điểm âm tự động theo tiêu chí.</li>
              <li>Khiếu nại chỉ do giáo viên chủ nhiệm gửi.</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
