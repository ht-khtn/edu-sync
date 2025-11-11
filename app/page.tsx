import Link from 'next/link'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet'
import { FilePen, ListChecks, BarChart3, LogIn, Menu } from 'lucide-react'

export default function HomePage() {
  return (
    <>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>EduSync</CardTitle>
          <CardDescription>Đồng bộ mọi nhịp đập học đường</CardDescription>
          <CardAction>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>Chọn hành động</SheetDescription>
                </SheetHeader>
                <Button asChild>
                  <Link href="/login">Đăng nhập</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/leaderboard">Bảng xếp hạng</Link>
                </Button>
                <SheetClose asChild>
                  <Button variant="ghost">Đóng</Button>
                </SheetClose>
              </SheetContent>
            </Sheet>
            <Button asChild>
              <Link href="/login">Đăng nhập</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/leaderboard">Bảng xếp hạng</Link>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      {/* Hero */}
      <Card>
        <CardHeader>
          <Avatar>
            <AvatarFallback>ES</AvatarFallback>
          </Avatar>
          <CardTitle>EduSync – Đồng bộ mọi nhịp đập học đường</CardTitle>
          <CardDescription>Hệ thống hỗ trợ quản lý phong trào và thi đua THPT</CardDescription>
          <CardDescription>Ghi nhận trực tiếp, không cần duyệt. Quyền ghi nhận giới hạn theo vai trò.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/login">Đăng nhập ngay</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="#guide">Xem hướng dẫn</Link>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Quick guide */}
      <Card id="guide">
        <CardHeader>
          <CardTitle>Hướng dẫn nhanh</CardTitle>
          <CardDescription>Những điều cần biết để bắt đầu</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <FilePen /> CC: 'Nhập vi phạm' để ghi nhận cho lớp thuộc phạm vi.
          </Alert>
          <Alert>
            <ListChecks /> Điểm theo tiêu chí từ bảng criteria, điểm trừ tự động.
          </Alert>
          <Alert>
            <BarChart3 /> Xem 'Bảng xếp hạng' để theo dõi tổng điểm theo lớp.
          </Alert>
        </CardContent>
      </Card>

      {/* Footer */}
      <Card>
        <CardContent>
          <small>© 2025 EduSync – Quản lý điểm số. Đơn giản. Thông minh.</small>
        </CardContent>
        <CardFooter>
          <Button asChild variant="link" size="sm">
            <Link href="#">Chính sách</Link>
          </Button>
          <Button asChild variant="link" size="sm">
            <Link href="#">Liên hệ</Link>
          </Button>
          <Button asChild variant="link" size="sm">
            <Link href="https://github.com">Github</Link>
          </Button>
        </CardFooter>
      </Card>
    </>
  )
}

